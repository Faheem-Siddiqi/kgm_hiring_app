import { ObjectId, type Collection, type Db, type WithId } from "mongodb";
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import "server-only";

import { getDatabase } from "@/db";
import { ADMIN_INVITATION_DURATION_MS } from "@/lib/admin-constants";

const scrypt = promisify(scryptCallback);
const SESSION_DURATION_MS = 30 * 60 * 1000;
const RESET_TOKEN_DURATION_MS = 20 * 60 * 1000;
const DEFAULT_ADMIN_PASSWORD = "1234";

export type AdminUserRole = "main-admin" | "sub-admin";

export type AdminUserDocument = {
  name: string;
  designation: string;
  email: string;
  passwordHash: string;
  role: AdminUserRole;
  isAdmin: boolean;
  canManageAdmins?: boolean;
  paused?: boolean;
  mustChangePassword: boolean;
  temporaryPasswordBackup?: string;
  invitationExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  resetTokenPurpose?: "admin-invitation" | "password-reset";
};

export type PublicAdminUser = {
  id: string;
  name: string;
  designation: string;
  email: string;
  role: AdminUserRole;
  isAdmin: boolean;
  canManageAdmins?: boolean;
  paused?: boolean;
  mustChangePassword: boolean;
  temporaryPasswordBackup?: string;
  invitationExpiresAt?: string;
  createdAt: string;
};

export type AdminSession = {
  user: PublicAdminUser;
  expiresAt: string;
};

export type PasswordTokenStatus = {
  valid: boolean;
  purpose: "admin-invitation" | "password-reset" | null;
  message?: string;
  email?: string;
  expiresAt?: string;
};

type AdminSessionDocument = {
  userId: ObjectId;
  email: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
};

type AdminCollections = {
  users: Collection<AdminUserDocument>;
  sessions: Collection<AdminSessionDocument>;
};

export class AdminUserError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AdminUserError";
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isExpired(date?: Date) {
  return !date || date.getTime() <= Date.now();
}

export function canManageAdminUsers(
  user: Pick<PublicAdminUser, "role" | "isAdmin">,
) {
  return user.role === "main-admin" && user.isAdmin === true;
}

export function canModerateAdminUsers(user: Pick<PublicAdminUser, "designation">) {
  return user.designation.trim().toLowerCase() === "it administrator";
}

export function canViewTemporaryPasswords(
  user: Pick<PublicAdminUser, "role" | "designation">,
) {
  return user.role === "main-admin" || canModerateAdminUsers(user);
}

export function canViewCandidateInviteOtp(
  user: Pick<PublicAdminUser, "role" | "designation">,
) {
  const designation = user.designation.trim().toLowerCase();
  return (
    user.role === "main-admin" ||
    designation.includes("hod") ||
    designation.includes("it")
  );
}

function getPrimaryAdminInput() {
  return {
    name: "Faheem Siddiqi",
    designation: "IT Administrator",
    email: normalizeEmail(process.env.ADMIN_EMAIL || "admin@kgm.com"),
    password: process.env.ADMIN_PASSWORD || "admin123",
  };
}

function getDefaultAdminInputs() {
  return [
    {
      name: "Ayesha Khan",
      designation: "HR Admin",
      email: "ayesha.admin@kgm.com",
    },
    {
      name: "Bilal Ahmed",
      designation: "Operations HOD",
      email: "bilal.hod@kgm.com",
    },
    {
      name: "Sana Malik",
      designation: "Recruitment Admin",
      email: "sana.admin@kgm.com",
    },
  ];
}

function toPublicAdminUser(user: WithId<AdminUserDocument>): PublicAdminUser {
  return {
    id: user._id.toString(),
    name: user.name,
    designation: user.designation,
    email: user.email,
    role: user.role,
    isAdmin: user.isAdmin ?? user.role === "main-admin",
    canManageAdmins: user.canManageAdmins,
    paused: user.paused,
    mustChangePassword: user.mustChangePassword,
    temporaryPasswordBackup: user.temporaryPasswordBackup,
    invitationExpiresAt: user.invitationExpiresAt?.toISOString(),
    createdAt: user.createdAt.toISOString(),
  };
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const storedBuffer = Buffer.from(hash, "hex");
  const derivedKey = (await scrypt(password, salt, storedBuffer.length)) as Buffer;

  return (
    storedBuffer.length === derivedKey.length &&
    timingSafeEqual(storedBuffer, derivedKey)
  );
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function generateTemporaryPassword() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*";
  const all = `${letters}${numbers}${symbols}`;
  const required = [
    letters[randomBytes(1)[0] % letters.length],
    numbers[randomBytes(1)[0] % numbers.length],
    symbols[randomBytes(1)[0] % symbols.length],
  ];

  while (required.length < 14) {
    required.push(all[randomBytes(1)[0] % all.length]);
  }

  return required
    .map((value) => ({ value, sort: randomBytes(1)[0] }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
    .join("");
}

async function getAdminCollections(): Promise<AdminCollections> {
  const database = await getDatabase();
  await ensureAdminIndexes(database);

  return {
    users: database.collection<AdminUserDocument>("admin_users"),
    sessions: database.collection<AdminSessionDocument>("admin_sessions"),
  };
}

let indexesReady: Promise<void> | null = null;

function ensureAdminIndexes(database: Db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      database
        .collection<AdminUserDocument>("admin_users")
        .createIndex({ email: 1 }, { unique: true }),
      database
        .collection<AdminSessionDocument>("admin_sessions")
        .createIndex({ tokenHash: 1 }, { unique: true }),
      database
        .collection<AdminSessionDocument>("admin_sessions")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      database
        .collection<AdminUserDocument>("admin_users")
        .createIndex({ invitationExpiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).then(() => undefined);
  }

  return indexesReady;
}

let seedsReady: Promise<void> | null = null;

async function seedAdminUsers() {
  const { users } = await getAdminCollections();
  const primaryAdmin = getPrimaryAdminInput();
  const now = new Date();
  const [primaryPasswordHash, defaultPasswordHash] = await Promise.all([
    hashPassword(primaryAdmin.password),
    hashPassword(DEFAULT_ADMIN_PASSWORD),
  ]);
  const defaultOperations = getDefaultAdminInputs().map((admin) => {
    return {
      updateOne: {
        filter: { email: normalizeEmail(admin.email) },
        update: {
          $set: {
            name: admin.name,
            designation: admin.designation.trim(),
            role: "sub-admin" as const,
            isAdmin: false,
            canManageAdmins: false,
            updatedAt: now,
          },
          $setOnInsert: {
            passwordHash: defaultPasswordHash,
            paused: false,
            mustChangePassword: false,
            createdAt: now,
          },
        },
        upsert: true,
      },
    };
  });

  await users.bulkWrite([
    {
      updateOne: {
        filter: { email: primaryAdmin.email },
        update: {
          $set: {
            name: primaryAdmin.name,
            designation: primaryAdmin.designation,
            role: "main-admin",
            isAdmin: true,
            canManageAdmins: true,
            paused: false,
            updatedAt: now,
          },
          $setOnInsert: {
            passwordHash: primaryPasswordHash,
            mustChangePassword: false,
            createdAt: now,
          },
        },
        upsert: true,
      },
    },
    ...defaultOperations,
  ]);

  await users.updateMany(
    { role: "sub-admin" },
    { $set: { isAdmin: false, canManageAdmins: false, updatedAt: now } },
  );
}

async function ensureAdminSeeds() {
  if (!seedsReady) {
    seedsReady = seedAdminUsers().catch((error) => {
      seedsReady = null;
      throw error;
    });
  }

  return seedsReady;
}

async function clearExpiredPasswordResetTokens(
  users: Collection<AdminUserDocument>,
) {
  await users.updateMany(
    {
      resetTokenPurpose: "password-reset",
      resetTokenExpiresAt: { $lte: new Date() },
    },
    {
      $unset: {
        resetTokenHash: "",
        resetTokenExpiresAt: "",
        resetTokenPurpose: "",
      },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function listAdminUsers() {
  await ensureAdminSeeds();
  const { users } = await getAdminCollections();
  await clearExpiredPasswordResetTokens(users);
  const adminUsers = await users
    .find(
      {},
      {
        projection: {
          name: 1,
          designation: 1,
          email: 1,
          role: 1,
          isAdmin: 1,
          canManageAdmins: 1,
          paused: 1,
          mustChangePassword: 1,
          temporaryPasswordBackup: 1,
          invitationExpiresAt: 1,
          createdAt: 1,
        },
      },
    )
    .sort({ role: 1, createdAt: 1 })
    .toArray();

  return adminUsers.map(toPublicAdminUser);
}

export async function listAdminInvitationManagers() {
  await ensureAdminSeeds();
  const { users } = await getAdminCollections();
  const adminUsers = await users
    .find(
      {
        role: "main-admin",
        isAdmin: true,
        paused: { $ne: true },
      },
      {
        projection: {
          name: 1,
          designation: 1,
          email: 1,
          role: 1,
          isAdmin: 1,
          canManageAdmins: 1,
          paused: 1,
          mustChangePassword: 1,
          createdAt: 1,
        },
      },
    )
    .toArray();

  return adminUsers.map(toPublicAdminUser).filter(canManageAdminUsers);
}

export async function findAdminInvitationManagerByEmail(email: string) {
  await ensureAdminSeeds();
  const { users } = await getAdminCollections();
  const user = await users.findOne({
    email: normalizeEmail(email),
    role: "main-admin",
    isAdmin: true,
    paused: { $ne: true },
  });

  if (!user) {
    return null;
  }

  const publicUser = toPublicAdminUser(user);

  return canManageAdminUsers(publicUser) ? publicUser : null;
}

export async function getAdminAccessRequestState(email: string) {
  await ensureAdminSeeds();
  const { users } = await getAdminCollections();
  const user = await users.findOne({ email: normalizeEmail(email) });

  if (!user) {
    return {
      status: "not-found",
      user: null,
    } as const;
  }

  if (user.paused) {
    return {
      status: "paused",
      user: toPublicAdminUser(user),
    } as const;
  }

  if (user.mustChangePassword) {
    return {
      status: isExpired(user.invitationExpiresAt)
        ? "expired-pending"
        : "pending",
      user: toPublicAdminUser(user),
    } as const;
  }

  return {
    status: "active",
    user: toPublicAdminUser(user),
  } as const;
}

export async function createSubAdminUser(input: {
  name: string;
  designation: string;
  email: string;
}) {
  await ensureAdminSeeds();
  const { users } = await getAdminCollections();
  const normalizedEmail = normalizeEmail(input.email);
  const existing = await users.findOne({ email: normalizedEmail });

  if (existing) {
    throw new AdminUserError("User already added with the same email.", 409);
  }

  const temporaryPassword = generateTemporaryPassword();
  const now = new Date();
  const invitationExpiresAt = new Date(now.getTime() + ADMIN_INVITATION_DURATION_MS);

  const result = await users
    .insertOne({
      name: input.name.trim(),
      designation: input.designation.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(temporaryPassword),
      role: "sub-admin",
      isAdmin: false,
      canManageAdmins: false,
      paused: false,
      mustChangePassword: true,
      invitationExpiresAt,
      createdAt: now,
      updatedAt: now,
    })
    .catch((error: unknown) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        throw new AdminUserError("User already added with the same email.", 409);
      }

      throw error;
    });

  const user = await users.findOne({ _id: result.insertedId });

  if (!user) {
    throw new AdminUserError("Admin was created but could not be loaded.", 500);
  }

  return { user: toPublicAdminUser(user), temporaryPassword };
}

export async function saveTemporaryPasswordBackup(
  userId: string,
  password: string,
) {
  const { users } = await getAdminCollections();

  await users.updateOne(
    { _id: new ObjectId(userId), role: "sub-admin" },
    {
      $set: {
        temporaryPasswordBackup: password,
        mustChangePassword: false,
        updatedAt: new Date(),
      },
      $unset: {
        invitationExpiresAt: "",
        resetTokenHash: "",
        resetTokenExpiresAt: "",
        resetTokenPurpose: "",
      },
    },
  );

  const user = await users.findOne({ _id: new ObjectId(userId) });
  return user ? toPublicAdminUser(user) : null;
}

export async function clearTemporaryPasswordBackup(userId: string) {
  const { users } = await getAdminCollections();

  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $unset: { temporaryPasswordBackup: "" },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function findAdminUserByCredentials(email: string, password: string) {
  await ensureAdminSeeds();
  const { users } = await getAdminCollections();
  await clearExpiredPasswordResetTokens(users);
  const user = await users.findOne({ email: normalizeEmail(email) });

  if (
    user?.role === "sub-admin" &&
    user.mustChangePassword &&
    isExpired(user.invitationExpiresAt)
  ) {
    await users.deleteOne({ _id: user._id });
    return null;
  }

  if (!user || user.paused || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }

  await users.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: new Date(), updatedAt: new Date() } },
  );

  return toPublicAdminUser(user);
}

export async function setAdminUserPaused(userId: string, paused: boolean) {
  const { users, sessions } = await getAdminCollections();
  const objectId = new ObjectId(userId);
  const user = await users.findOne({ _id: objectId });

  if (!user) {
    throw new AdminUserError("Admin account was not found.", 404);
  }

  if (user.role === "main-admin") {
    throw new AdminUserError("Main admin cannot be paused.", 400);
  }

  await users.updateOne(
    { _id: objectId },
    {
      $set: {
        paused,
        updatedAt: new Date(),
      },
    },
  );

  if (paused) {
    await sessions.deleteMany({ userId: objectId });
  }

  const updatedUser = await users.findOne({ _id: objectId });

  if (!updatedUser) {
    throw new AdminUserError("Admin account was not found.", 404);
  }

  return toPublicAdminUser(updatedUser);
}

export async function deleteAdminUser(userId: string) {
  const { users, sessions } = await getAdminCollections();
  const objectId = new ObjectId(userId);
  const user = await users.findOne({ _id: objectId });

  if (!user) {
    throw new AdminUserError("Admin account was not found.", 404);
  }

  if (user.role === "main-admin") {
    throw new AdminUserError("Main admin cannot be deleted.", 400);
  }

  await users.deleteOne({ _id: objectId });
  await sessions.deleteMany({ userId: objectId });
}

export async function createAdminSession(user: PublicAdminUser) {
  const { sessions } = await getAdminCollections();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  await sessions.insertOne({
    userId: new ObjectId(user.id),
    email: user.email,
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function validateAdminSessionToken(token?: string | null) {
  if (!token) {
    return null;
  }

  await ensureAdminSeeds();
  const { users, sessions } = await getAdminCollections();
  const session = await sessions.findOne({ tokenHash: hashToken(token) });

  if (!session || isExpired(session.expiresAt)) {
    if (session) {
      await sessions.deleteOne({ _id: session._id });
    }
    return null;
  }

  const user = await users.findOne({ _id: session.userId });

  if (!user) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }

  return {
    user: toPublicAdminUser(user),
    expiresAt: session.expiresAt.toISOString(),
  } satisfies AdminSession;
}

export async function deleteAdminSessionToken(token?: string | null) {
  if (!token) {
    return;
  }

  const { sessions } = await getAdminCollections();
  await sessions.deleteOne({ tokenHash: hashToken(token) });
}

async function createPasswordToken(
  email: string,
  purpose: "admin-invitation" | "password-reset",
) {
  await ensureAdminSeeds();
  const { users } = await getAdminCollections();
  await clearExpiredPasswordResetTokens(users);
  const user = await users.findOne({ email: normalizeEmail(email) });

  if (!user) {
    return null;
  }

  if (purpose === "password-reset" && (user.mustChangePassword || user.paused)) {
    return null;
  }

  if (purpose === "admin-invitation") {
    if (user.role !== "sub-admin") {
      throw new AdminUserError("Invitation links are only available for sub-admin accounts.", 400);
    }

    if (!user.mustChangePassword) {
      throw new AdminUserError("This admin has already set a password.", 409);
    }

    if (isExpired(user.invitationExpiresAt)) {
      await users.deleteOne({ _id: user._id });
      throw new AdminUserError(
        "This invitation expired. Add the admin again to send a fresh setup link.",
        410,
      );
    }
  }

  const token = generateToken();
  const duration = purpose === "admin-invitation"
    ? ADMIN_INVITATION_DURATION_MS
    : RESET_TOKEN_DURATION_MS;
  const expiresAt = new Date(Date.now() + duration);

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        resetTokenHash: hashToken(token),
        resetTokenExpiresAt: expiresAt,
        resetTokenPurpose: purpose,
        updatedAt: new Date(),
      },
    },
  );

  return { user: toPublicAdminUser(user), token, expiresAt };
}

export function createAdminInvitationToken(email: string) {
  return createPasswordToken(email, "admin-invitation");
}

export function createPasswordReset(email: string) {
  return createPasswordToken(email, "password-reset");
}

function getPasswordTokenPurpose(user: AdminUserDocument) {
  if (
    user.resetTokenPurpose === "admin-invitation" ||
    (user.role === "sub-admin" &&
      user.mustChangePassword &&
      Boolean(user.invitationExpiresAt))
  ) {
    return "admin-invitation" as const;
  }

  return "password-reset" as const;
}

async function getPasswordTokenStatus(
  token: string,
  expectedPurpose?: "admin-invitation" | "password-reset",
): Promise<PasswordTokenStatus> {
  if (!token) {
    return {
      valid: false,
      purpose: null,
      message:
        expectedPurpose === "password-reset"
          ? "Password reset link is missing. Request a new reset link."
          : "Admin setup link is missing. Ask an administrator for a new invitation.",
    };
  }

  const { users } = await getAdminCollections();
  const user = await users.findOne({ resetTokenHash: hashToken(token) });

  if (!user) {
    return {
      valid: false,
      purpose: null,
      message: "This link is invalid, expired, or has already been used.",
    };
  }

  const purpose = getPasswordTokenPurpose(user);

  if (expectedPurpose && purpose !== expectedPurpose) {
    return {
      valid: false,
      purpose,
      message:
        expectedPurpose === "admin-invitation"
          ? "This is not an admin setup link. Ask an administrator for a new invitation."
          : "This is not a password reset link. Use the first-time setup page from your invitation email.",
    };
  }

  if (purpose === "admin-invitation" && isExpired(user.invitationExpiresAt)) {
    await users.deleteOne({ _id: user._id });
    return {
      valid: false,
      purpose,
      message:
        "This setup link expired and the pending admin account was removed. Ask an administrator to add the account again.",
    };
  }

  if (isExpired(user.resetTokenExpiresAt)) {
    if (purpose === "admin-invitation") {
      await users.deleteOne({ _id: user._id });
      return {
        valid: false,
        purpose,
        message:
          "This setup link expired and the pending admin account was removed. Ask an administrator to add the account again.",
      };
    }

    await users.updateOne(
      { _id: user._id },
      {
        $unset: {
          resetTokenHash: "",
          resetTokenExpiresAt: "",
          resetTokenPurpose: "",
        },
        $set: { updatedAt: new Date() },
      },
    );

    return {
      valid: false,
      purpose,
      message: "This link has expired. Request a new one to continue.",
    };
  }

  if (purpose === "admin-invitation" && !user.mustChangePassword) {
    await users.updateOne(
      { _id: user._id },
      {
        $unset: {
          resetTokenHash: "",
          resetTokenExpiresAt: "",
          resetTokenPurpose: "",
        },
        $set: { updatedAt: new Date() },
      },
    );

    return {
      valid: false,
      purpose,
      message:
        "This setup link has already been used. Sign in with your existing password.",
    };
  }

  return {
    valid: true,
    purpose,
    email: user.email,
    expiresAt: user.resetTokenExpiresAt?.toISOString(),
  };
}

export function getAdminInvitationTokenStatus(token: string) {
  return getPasswordTokenStatus(token, "admin-invitation");
}

export function getPasswordResetTokenStatus(token: string) {
  return getPasswordTokenStatus(token, "password-reset");
}

async function updatePasswordWithToken(
  token: string,
  password: string,
  expectedPurpose: "admin-invitation" | "password-reset",
) {
  if (password.length < 8) {
    throw new AdminUserError("Password must be at least 8 characters.", 400);
  }

  const { users } = await getAdminCollections();
  const user = await users.findOne({ resetTokenHash: hashToken(token) });

  if (!user) {
    throw new AdminUserError("This reset link is invalid or expired.", 400);
  }

  const purpose = getPasswordTokenPurpose(user);

  if (purpose !== expectedPurpose) {
    throw new AdminUserError(
      expectedPurpose === "admin-invitation"
        ? "This is not an admin setup link. Ask an administrator for a new invitation."
        : "This is not a password reset link. Use the first-time setup page from your invitation email.",
      400,
    );
  }

  if (purpose === "admin-invitation" && !user.mustChangePassword) {
    await users.updateOne(
      { _id: user._id },
      {
        $unset: {
          resetTokenHash: "",
          resetTokenExpiresAt: "",
          resetTokenPurpose: "",
        },
        $set: { updatedAt: new Date() },
      },
    );
    throw new AdminUserError(
      "This setup link has already been used. Sign in with your existing password.",
      409,
    );
  }

  if (purpose === "admin-invitation" && isExpired(user.invitationExpiresAt)) {
    await users.deleteOne({ _id: user._id });
    throw new AdminUserError(
      "This setup link expired and the pending admin account was removed. Ask an administrator to add the account again.",
      410,
    );
  }

  if (isExpired(user.resetTokenExpiresAt)) {
    const isPendingSubAdmin =
      user.role === "sub-admin" &&
      user.mustChangePassword;
    const isExpiredInvitationToken =
      isPendingSubAdmin &&
      (user.resetTokenPurpose === "admin-invitation" ||
        (!user.resetTokenPurpose && isExpired(user.invitationExpiresAt)));

    if (isExpiredInvitationToken) {
      await users.deleteOne({ _id: user._id });
      throw new AdminUserError(
        "This setup link expired and the pending admin account was removed. Ask an administrator to add the account again.",
        400,
      );
    } else {
      await users.updateOne(
        { _id: user._id },
        {
          $unset: {
            resetTokenHash: "",
            resetTokenExpiresAt: "",
            resetTokenPurpose: "",
          },
          $set: { updatedAt: new Date() },
        },
      );
    }

    throw new AdminUserError("This reset link is invalid or expired.", 400);
  }

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
        updatedAt: new Date(),
      },
      $unset: {
        temporaryPasswordBackup: "",
        invitationExpiresAt: "",
        resetTokenHash: "",
        resetTokenExpiresAt: "",
        resetTokenPurpose: "",
      },
    },
  );
}

export function setAdminPasswordWithInvitation(token: string, password: string) {
  return updatePasswordWithToken(token, password, "admin-invitation");
}

export function resetPasswordWithToken(token: string, password: string) {
  return updatePasswordWithToken(token, password, "password-reset");
}

export async function removeAllSubAdminsForCleanStart() {
  // Clean-start helper: call this from a one-off maintenance route/script only
  // when you intentionally want to remove every sub admin from MongoDB.
  const { users, sessions } = await getAdminCollections();
  await users.deleteMany({ role: "sub-admin" });
  await sessions.deleteMany({ email: { $ne: getPrimaryAdminInput().email } });
}
