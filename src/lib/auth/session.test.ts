import { createHmac } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSessionToken,
  sessionFromToken,
  verifySessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "./session";
import {
  findOrCreateUserByEmail,
  resetUserStoreForTests,
  validateLoginEmail,
} from "./users";
import { DEV_AUTH_SECRET_FALLBACK } from "./constants";

function forgeToken(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const body = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sig = createHmac("sha256", secret)
    .update(body)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${body}.${sig}`;
}

describe("Auth 会话（T81 / T252）", () => {
  afterEach(() => {
    resetUserStoreForTests();
    delete process.env.AUTH_SECRET;
  });

  it("签发与校验 token", () => {
    process.env.AUTH_SECRET = "test-secret-for-unit";
    const token = createSessionToken({
      id: "usr_abc",
      email: "a@b.com",
      displayName: "测",
    });
    const payload = verifySessionToken(token);
    expect(payload?.sub).toBe("usr_abc");
    expect(payload?.email).toBe("a@b.com");
    expect(payload?.name).toBe("测");
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("篡改签名失败", () => {
    process.env.AUTH_SECRET = "test-secret-for-unit";
    const token = createSessionToken({ id: "usr_1", email: "x@y.z" });
    const bad = token.slice(0, -4) + "xxxx";
    expect(verifySessionToken(bad)).toBeNull();
  });

  it("过期 token 无效", () => {
    process.env.AUTH_SECRET = "test-secret-for-unit";
    const now = 1_700_000_000;
    const token = createSessionToken(
      { id: "usr_1" },
      { maxAgeSec: 10, now },
    );
    expect(verifySessionToken(token, { now: now + 5 })?.sub).toBe("usr_1");
    expect(verifySessionToken(token, { now: now + 20 })).toBeNull();
  });

  it("sessionFromToken → AppSession", () => {
    process.env.AUTH_SECRET = "test-secret-for-unit";
    const token = createSessionToken({
      id: "usr_real",
      email: "u@e.com",
      displayName: "名",
    });
    const s = sessionFromToken(token);
    expect(s.authenticated).toBe(true);
    expect(s.userId).toBe("usr_real");
    expect(s.email).toBe("u@e.com");
    expect(sessionFromToken(null).authenticated).toBe(false);
  });

  it("Cookie 选项：httpOnly + sameSite lax；开发默认 secure=false", () => {
    // vitest 下 NODE_ENV 多为 test/development，secure 应为 false
    const opts = sessionCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.secure).toBe(process.env.NODE_ENV === "production");
  });

  it("SESSION_COOKIE_NAME 固定", () => {
    expect(SESSION_COOKIE_NAME).toBe("cyber_session");
  });

  it("邮箱校验", () => {
    expect(validateLoginEmail("  A@B.Com ")).toBe("a@b.com");
    expect(validateLoginEmail("bad")).toBeNull();
    expect(validateLoginEmail(1)).toBeNull();
  });

  it("findOrCreateUserByEmail 幂等", async () => {
    const u1 = await findOrCreateUserByEmail({
      email: "same@test.dev",
      displayName: "甲",
    });
    const u2 = await findOrCreateUserByEmail({
      email: "SAME@test.dev",
    });
    expect(u1.id).toBe(u2.id);
    expect(u1.id.startsWith("usr_")).toBe(true);
    expect(u1.id.startsWith("anon_")).toBe(false);
  });

  it("错误密钥无法校验", () => {
    process.env.AUTH_SECRET = "secret-a";
    const token = createSessionToken({ id: "usr_x" });
    expect(
      verifySessionToken(token, { secret: "secret-b" }),
    ).toBeNull();
    expect(
      verifySessionToken(token, { secret: "secret-a" })?.sub,
    ).toBe("usr_x");
  });

  it("开发缺省 secret 可签验", () => {
    delete process.env.AUTH_SECRET;
    const token = createSessionToken({ id: "usr_dev" });
    expect(
      verifySessionToken(token, { secret: DEV_AUTH_SECRET_FALLBACK })?.sub,
    ).toBe("usr_dev");
  });

  it("iat/exp 严格校验：缺 exp 无效", () => {
    process.env.AUTH_SECRET = "test-secret-for-unit";
    const token = forgeToken(
      { sub: "usr_1", iat: 1_700_000_000 },
      "test-secret-for-unit",
    );
    expect(verifySessionToken(token, { now: 1_700_000_001 })).toBeNull();
  });

  it("iat/exp 严格校验：缺 iat 无效", () => {
    process.env.AUTH_SECRET = "test-secret-for-unit";
    const token = forgeToken(
      { sub: "usr_1", exp: 1_800_000_000 },
      "test-secret-for-unit",
    );
    expect(verifySessionToken(token, { now: 1_700_000_000 })).toBeNull();
  });

  it("iat 在未来（>60s）无效", () => {
    process.env.AUTH_SECRET = "test-secret-for-unit";
    const now = 1_700_000_000;
    const token = createSessionToken(
      { id: "usr_1" },
      { now: now + 120, maxAgeSec: 3600 },
    );
    expect(verifySessionToken(token, { now })).toBeNull();
  });

  it("iat 晚于 exp 无效", () => {
    process.env.AUTH_SECRET = "test-secret-for-unit";
    const token = forgeToken(
      {
        sub: "usr_1",
        iat: 1_700_001_000,
        exp: 1_700_000_000,
      },
      "test-secret-for-unit",
    );
    expect(
      verifySessionToken(token, { now: 1_700_000_500 }),
    ).toBeNull();
  });
});
