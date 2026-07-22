import { describe, expect, it } from "vitest";
import {
  ANON_USER_ID_PREFIX,
  createAnonymousUserId,
  isAnonymousUserId,
  toAppSession,
  userToSessionUser,
  type AuthJsSession,
} from "./types";
import { ErrorCode, type Person, type User } from "@/lib/types";

describe("Auth 契约（T80）", () => {
  it("匿名前缀与判定", () => {
    expect(ANON_USER_ID_PREFIX).toBe("anon_");
    expect(isAnonymousUserId(null)).toBe(true);
    expect(isAnonymousUserId(undefined)).toBe(true);
    expect(isAnonymousUserId("")).toBe(true);
    expect(isAnonymousUserId("anon_abc")).toBe(true);
    expect(isAnonymousUserId("user_real_1")).toBe(false);
  });

  it("createAnonymousUserId 带前缀", () => {
    const id = createAnonymousUserId("fixedpart");
    expect(id).toBe("anon_fixedpart");
    expect(isAnonymousUserId(id)).toBe(true);
  });

  it("toAppSession：无 session → 匿名", () => {
    const s = toAppSession(null);
    expect(s.authenticated).toBe(false);
    expect(s.userId).toBeNull();
    expect(s.expires).toBeNull();
  });

  it("toAppSession：真实用户", () => {
    const session: AuthJsSession = {
      user: {
        id: "usr_001",
        email: "a@b.com",
        name: "测",
        image: null,
      },
      expires: "2099-01-01T00:00:00.000Z",
    };
    const s = toAppSession(session);
    expect(s.authenticated).toBe(true);
    expect(s.userId).toBe("usr_001");
    expect(s.email).toBe("a@b.com");
  });

  it("toAppSession：anon_ 会话不算已登录", () => {
    const session: AuthJsSession = {
      user: { id: "anon_local1" },
      expires: "2099-01-01T00:00:00.000Z",
    };
    expect(toAppSession(session).authenticated).toBe(false);
  });

  it("User / Person 结构可赋值（与 BirthProfile 关联字段）", () => {
    const user: User = {
      id: "usr_1",
      email: "x@y.z",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const person: Person = {
      id: "person_1",
      userId: null,
      name: "本地人",
      gender: "male",
      solarDate: "1990-01-01",
    };
    expect(userToSessionUser(user).id).toBe("usr_1");
    expect(person.userId).toBeNull();
  });

  it("ErrorCode 含 AUTH_*", () => {
    expect(ErrorCode.AUTH_REQUIRED).toBe("AUTH_REQUIRED");
    expect(ErrorCode.AUTH_SESSION_INVALID).toBe("AUTH_SESSION_INVALID");
    expect(ErrorCode.AUTH_LOGIN_FAILED).toBe("AUTH_LOGIN_FAILED");
    expect(ErrorCode.AUTH_FORBIDDEN).toBe("AUTH_FORBIDDEN");
    expect(ErrorCode.AUTH_USER_NOT_FOUND).toBe("AUTH_USER_NOT_FOUND");
    expect(ErrorCode.AUTH_MERGE_CONFLICT).toBe("AUTH_MERGE_CONFLICT");
  });
});
