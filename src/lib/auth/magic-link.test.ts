import { afterEach, describe, expect, it } from "vitest";
import {
  allowDevCredentialsLogin,
  consumeMagicLink,
  createMagicLink,
  preferMagicLink,
  resetMagicLinkStoreForTests,
} from "./magic-link";

describe("magic-link（T222 / T252）", () => {
  const prevNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    resetMagicLinkStoreForTests();
    delete process.env.AUTH_METHOD;
    delete process.env.AUTH_ALLOW_DEV_LOGIN;
    // @ts-expect-error test override
    process.env.NODE_ENV = prevNodeEnv;
  });

  it("创建后可消费一次，第二次失败", async () => {
    const created = await createMagicLink({
      email: "a@example.com",
      displayName: "甲",
      callbackUrl: "/account",
    });
    expect(created.email).toBe("a@example.com");
    expect(created.devLink).toBeTruthy();
    const token = new URL(created.devLink!).searchParams.get("token");
    expect(token).toBeTruthy();

    const once = await consumeMagicLink(token!);
    expect(once?.email).toBe("a@example.com");
    expect(once?.callbackUrl).toBe("/account");

    const twice = await consumeMagicLink(token!);
    expect(twice).toBeNull();
  });

  it("生产环境不返回 devLink", async () => {
    // @ts-expect-error test override
    process.env.NODE_ENV = "production";
    const created = await createMagicLink({
      email: "prod@example.com",
    });
    expect(created.devLink).toBeUndefined();
    expect(created.email).toBe("prod@example.com");
  });

  it("非生产可返回 devLink", async () => {
    // @ts-expect-error test override
    process.env.NODE_ENV = "development";
    const created = await createMagicLink({
      email: "dev@example.com",
    });
    expect(created.devLink).toMatch(/\/auth\/callback\?token=/);
  });

  it("无效 token 返回 null", async () => {
    expect(await consumeMagicLink("not-a-real-token")).toBeNull();
  });

  it("allowDevCredentialsLogin / preferMagicLink", () => {
    expect(allowDevCredentialsLogin()).toBe(true);
    process.env.AUTH_METHOD = "magic";
    expect(preferMagicLink()).toBe(true);
  });
});
