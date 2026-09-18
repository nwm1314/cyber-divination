import { describe, expect, it } from "vitest";
import { toSafeErrorMessage } from "./safe-error";

describe("toSafeErrorMessage（P1 安全回归）", () => {
  it("放行本项目自定义的中文业务校验消息", () => {
    expect(
      toSafeErrorMessage(new Error("缺少 Bazi 出生信息或有效命盘"), "兜底"),
    ).toBe("缺少 Bazi 出生信息或有效命盘");
    expect(
      toSafeErrorMessage(new Error("profile.id 与 chart.profileId 不一致"), "兜底"),
    ).toMatch(/profile\.id/);
    expect(toSafeErrorMessage(new Error("请填写阳历或农历生日"), "兜底")).toBe(
      "请填写阳历或农历生日",
    );
  });

  it("拦截 Postgres 驱动错误，避免泄露表名/列名/约束名", () => {
    const leaks = [
      'null value in column "question" violates not-null constraint',
      'duplicate key value violates unique constraint "bazi_charts_pkey"',
      'relation "users" does not exist',
      "syntax error at or near \"SELECT\"",
      'insert or update on table "people" violates foreign key constraint "people_user_id_fkey"',
    ];
    for (const leak of leaks) {
      const r = toSafeErrorMessage(new Error(leak), "保存失败，请稍后重试");
      expect(r).toBe("保存失败，请稍后重试");
      // 关键断言：不得回传任何原始片段
      expect(r).not.toContain("constraint");
      expect(r).not.toContain("column");
      expect(r).not.toContain("relation");
      expect(r).not.toContain("bazi_charts_pkey");
    }
  });

  it("拦截英文技术错误与堆栈残留", () => {
    expect(
      toSafeErrorMessage(new Error("connect ECONNREFUSED 127.0.0.1:5432"), "保存失败"),
    ).toBe("保存失败");
    expect(
      toSafeErrorMessage(
        new Error("TypeError: cannot read properties of undefined\n    at foo (/app/src/lib/db/client.ts:42:11)"),
        "保存失败",
      ),
    ).toBe("保存失败");
  });

  it("拦截超长消息（多半是拼接的驱动详情）", () => {
    const long = "错误" + "x".repeat(500);
    expect(toSafeErrorMessage(new Error(long), "保存失败")).toBe("保存失败");
  });

  it("非 Error 输入（字符串/null/对象）也安全兜底", () => {
    expect(toSafeErrorMessage("plain string error", "保存失败")).toBe("保存失败");
    expect(toSafeErrorMessage(null, "保存失败")).toBe("保存失败");
    expect(toSafeErrorMessage(undefined, "保存失败")).toBe("保存失败");
    expect(toSafeErrorMessage({ weird: true }, "保存失败")).toBe("保存失败");
  });

  it("通过 onLog 把原文交给服务端日志，且返回值仍是安全文案", () => {
    const logged: string[] = [];
    const leak = 'null value in column "question" violates not-null constraint';
    const r = toSafeErrorMessage(new Error(leak), "保存失败", (o) => logged.push(o));

    expect(r).toBe("保存失败");
    // 原文进日志（服务端可见），但不进响应
    expect(logged).toEqual([leak]);
  });

  it("onLog 不会因回调抛错而影响返回", () => {
    const r = toSafeErrorMessage(new Error("boom"), "保存失败", () => {
      throw new Error("logger down");
    });
    expect(r).toBe("保存失败");
  });
});
