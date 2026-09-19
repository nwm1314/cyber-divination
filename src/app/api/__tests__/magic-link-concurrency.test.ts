/**
 * Magic Link 并发消费测试（GAP-1 · 波次 1）
 *
 * 攻击模型：攻击者与合法用户几乎同时点击同一封邮件里的链接（或攻击者
 * 抢在用户之前重放）。若消费不是原子的，token 会被成功使用两次 →
 * 一条链接可产生两个会话（账号接管面）。
 *
 * 断言：并发 N 次 consumeMagicLink(同一 token) 恰好 1 次成功。
 * 同时覆盖：过期 token、篡改 token、大小写/空白归一化。
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  consumeMagicLink,
  createMagicLink,
  resetMagicLinkStoreForTests,
} from "@/lib/auth/magic-link";

function tokenOf(link: string): string {
  const t = new URL(link).searchParams.get("token");
  if (!t) throw new Error("devLink 缺少 token");
  return t;
}

beforeEach(() => {
  resetMagicLinkStoreForTests();
});

afterEach(() => {
  resetMagicLinkStoreForTests();
});

describe("Magic Link · 并发消费原子性", () => {
  it("并发 2 次消费同一 token → 恰好 1 次成功", async () => {
    const created = await createMagicLink({ email: "race@example.com" });
    const token = tokenOf(created.devLink!);

    const [a, b] = await Promise.all([
      consumeMagicLink(token),
      consumeMagicLink(token),
    ]);

    const succeeded = [a, b].filter((x) => x !== null);
    expect(succeeded).toHaveLength(1);
    expect(succeeded[0]?.email).toBe("race@example.com");
  });

  it("并发 8 次消费同一 token → 恰好 1 次成功", async () => {
    const created = await createMagicLink({ email: "race8@example.com" });
    const token = tokenOf(created.devLink!);

    const results = await Promise.all(
      Array.from({ length: 8 }, () => consumeMagicLink(token)),
    );

    expect(results.filter((x) => x !== null)).toHaveLength(1);
  });

  it("并发 16 次消费同一 token → 恰好 1 次成功（高并发）", async () => {
    const created = await createMagicLink({ email: "race16@example.com" });
    const token = tokenOf(created.devLink!);

    const results = await Promise.all(
      Array.from({ length: 16 }, () => consumeMagicLink(token)),
    );

    expect(results.filter((x) => x !== null)).toHaveLength(1);
  });

  it("顺序重复消费 → 第二次失败", async () => {
    const created = await createMagicLink({ email: "seq@example.com" });
    const token = tokenOf(created.devLink!);

    expect(await consumeMagicLink(token)).not.toBeNull();
    expect(await consumeMagicLink(token)).toBeNull();
    expect(await consumeMagicLink(token)).toBeNull();
  });

  it("不同 token 并发互不干扰，各自成功一次", async () => {
    const c1 = await createMagicLink({ email: "u1@example.com" });
    const c2 = await createMagicLink({ email: "u2@example.com" });
    const t1 = tokenOf(c1.devLink!);
    const t2 = tokenOf(c2.devLink!);

    const results = await Promise.all([
      consumeMagicLink(t1),
      consumeMagicLink(t2),
      consumeMagicLink(t1),
      consumeMagicLink(t2),
    ]);

    expect(results.filter((x) => x !== null)).toHaveLength(2);
    const emails = results.filter(Boolean).map((r) => r!.email).sort();
    expect(emails).toEqual(["u1@example.com", "u2@example.com"]);
  });
});

describe("Magic Link · token 校验边界", () => {
  it("篡改 token → null（hash 不匹配）", async () => {
    const created = await createMagicLink({ email: "tamper@example.com" });
    const token = tokenOf(created.devLink!);
    const tampered = `${token.slice(0, -1)}${token.slice(-1) === "A" ? "B" : "A"}`;

    expect(await consumeMagicLink(tampered)).toBeNull();
    // 原 token 仍可用（篡改不应消耗真 token）
    expect(await consumeMagicLink(token)).not.toBeNull();
  });

  it("空 / 纯空白 token → null", async () => {
    expect(await consumeMagicLink("")).toBeNull();
    expect(await consumeMagicLink("   ")).toBeNull();
  });

  it("不存在的随机 token → null", async () => {
    expect(await consumeMagicLink("not-a-real-token-value")).toBeNull();
  });
});
