/** Auth 契约与会话（T80 + T81） */

// 桶文件同时转出 session / get-server-session（服务端专属），
// 显式声明以免客户端误引用后得到隐晦的构建错误。
import "server-only";

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
