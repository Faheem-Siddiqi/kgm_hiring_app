import "server-only";

import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { ObjectId, type Collection, type Db, type WithId } from "mongodb";
import { getDatabase } from "@/db";

const scrypt = promisify(scryptCallback);
const SESSION_DURATION_MS = 30 * 60 * 1000;
const RESET_TOKEN_DURATION_MS = 20 * 60 * 1000;
const ADMIN_INVITATION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
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

export async function listAdminUsers() {
  await ensureAdminSeeds();
  const { users } = await getAdminCollections();
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
  const expiresAt = new Date(Date.now() + ADMIN_INVITATION_DURATION_MS);

  await users.updateOne(
    { _id: new ObjectId(userId), role: "sub-admin" },
    {
      $set: {
        temporaryPasswordBackup: password,
        invitationExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    },
  );
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

export async function createPasswordReset(email: string) {
  await ensureAdminSeeds();
  const { users } = await getAdminCollections();
  const user = await users.findOne({ email: normalizeEmail(email) });

  if (!user) {
    return null;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_DURATION_MS);

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        resetTokenHash: hashToken(token),
        resetTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    },
  );

  return { user: toPublicAdminUser(user), token, expiresAt };
}

export async function resetPasswordWithToken(token: string, password: string) {
  if (password.length < 8) {
    throw new AdminUserError("Password must be at least 8 characters.", 400);
  }

  const { users } = await getAdminCollections();
  const user = await users.findOne({ resetTokenHash: hashToken(token) });

  if (!user || isExpired(user.resetTokenExpiresAt)) {
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
      },
    },
  );
}

export async function removeAllSubAdminsForCleanStart() {
  // Clean-start helper: call this from a one-off maintenance route/script only
  // when you intentionally want to remove every sub admin from MongoDB.
  const { users, sessions } = await getAdminCollections();
  await users.deleteMany({ role: "sub-admin" });
  await sessions.deleteMany({ email: { $ne: getPrimaryAdminInput().email } });
}
