/** Auth 契约与会话（T80 + T81） */

export {
  ANON_USER_ID_PREFIX,
  createAnonymousUserId,
  isAnonymousUserId,
  toAppSession,
  userToSessionUser,
  type AuthJsJwtPayload,
  type AuthJsSession,
  type AuthJsSessionUser,
  type AuthProviderId,
} from "./types";

export {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  SESSION_REAUTH_MAX_AGE_SEC,
  createSessionToken,
  verifySessionToken,
  sessionFromToken,
  sessionCookieOptions,
  clearSessionCookieOptions,
  getAuthSecret,
  payloadToAuthJsSession,
} from "./session";

export {
  findOrCreateUserByEmail,
  getUserById,
  deleteUserById,
  validateLoginEmail,
  sanitizeDisplayName,
  resetUserStoreForTests,
} from "./users";

export {
  buildAccountExport,
  deleteAccount,
  type AccountExportBundle,
  type DeleteAccountResult,
} from "./account";

export { getServerSession } from "./get-session";
