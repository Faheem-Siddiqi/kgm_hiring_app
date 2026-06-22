export const ADMIN_SESSION_COOKIE = "kgm-hiring-admin-session";
export const ADMIN_SESSION_PREFIX = "session:";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 30 * 60;

export function createAdminSessionValue(token: string) {
  return `${ADMIN_SESSION_PREFIX}${token}`;
}

export function isAdminSessionValue(value?: string) {
  return value?.startsWith(ADMIN_SESSION_PREFIX) ?? false;
}

export function getAdminSessionToken(value?: string) {
  if (!value || !isAdminSessionValue(value)) {
    return null;
  }

  return value.slice(ADMIN_SESSION_PREFIX.length);
}
