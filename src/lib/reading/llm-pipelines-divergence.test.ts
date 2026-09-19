/**
 * 三术 LLM 解读管线 · 行为差异测试（B8）
 *
 * 背景：E-1 报告量化出 `reading/llm/llm.ts`(306) / `reading/ziwei/llm.ts`(255) /
 * `reading/liuyao/llm.ts`(243) 约有 177 行结构相似，C 档的判定是
 * 「合并前必须先有行为差异测试」。本文件就是那份测试——它同时回答
 * 「哪些行为真的不同（不能合）」与「哪些已经共用（可以合）」。
 *
 * 结论（由下面的断言固化）：
 * - 章节集合、报告结构字段、事实注入方式、**免责声明归属**四者按术不同；
 * - 已共用的是 `chatCompletion` / `parseLlmReadingContent` / 未配置回落骨架；
 * - 因此管线本身不宜合为一份，可复用的是 client + parse 两层。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BaziChart, LiuyaoChart, ZiweiChart } from "@/lib/types";
import {
  DISCLAIMER,
  SECTION_KEYS,
} from "@/lib/reading/sections";
import { ZIWEI_SECTION_KEYS } from "@/lib/reading/ziwei/sections";
import { LIUYAO_SECTION_KEYS } from "@/lib/reading/liuyao/sections";
import { isLlmConfigured } from "@/lib/reading/llm/config";

const { chatMock } = vi.hoisted(() => ({ chatMock: vi.fn() }));

vi.mock("@/lib/reading/llm/client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/reading/llm/client")>();
  return {
    ...actual,
    chatCompletion: (messages: unknown, context: unknown) =>
      chatMock(messages, context),
  };
});

const { llmReading } = await import("@/lib/reading/llm/llm");
const { llmZiweiReading } = await import("@/lib/reading/ziwei/llm");
const { llmLiuyaoReading } = await import("@/lib/reading/liuyao/llm");

const BAZI = {
  profileId: "p-div",
  dayMaster: "戊",
  pillars: {
    year: { stem: "甲", branch: "子" },
    month: { stem: "丙", branch: "寅" },
    day: { stem: "戊", branch: "午" },
    hour: { stem: "丁", branch: "巳" },
  },
  tenGods: {},
  hiddenStems: {},
  wuxingScores: { wood: 2, fire: 4, earth: 3, metal: 1, water: 1 },
  relations: {
    stemHe: [],
    branchChong: [],
    branchLiuhe: [],
    branchSanhe: [],
    branchSanhui: [],
    branchXing: [],
    branchHai: [],
  },
  dayun: [],
  currentDayunIndex: -1,
  liunian: [],
  flags: [],
  meta: { engineVersion: "test", skillRef: "bazi-skill" },
} as unknown as BaziChart;

const ZIWEI = {
  id: "zw-div",
  mingGong: "命宫",
  shenGong: "财帛宫",
  wuxingJu: "水二局",
  palaces: Array.from({ length: 12 }, (_, i) => ({
    branch: "子",
    index: i,
    name: `宫${i}`,
    stars: [],
  })),
  majorStars: {},
  daxian: [],
  liunian: [],
  currentDaxianIndex: 0,
  meta: { engineVersion: "test", school: "sanhe" },
} as unknown as ZiweiChart;

const LIUYAO = {
  id: "ly-div",
  question: "这次合作能成吗",
  method: "coins",
  lines: Array.from({ length: 6 }, (_, i) => ({
    position: i + 1,
    yao: i + 1,
    value: 7,
  })),
  benGua: { name: "乾为天", upper: "乾", lower: "乾" },
  bianGua: null,
  shiYao: 6,
  yingYao: 3,
  meta: { engineVersion: "test" },
} as unknown as LiuyaoChart;

const ENV_KEYS = ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    process.env[k] =
      k === "LLM_BASE_URL"
        ? "https://llm.test/v1"
        : k === "LLM_MODEL"
          ? "divergence-model"
          : "divergence-key";
  }
  chatMock.mockReset();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function replyWith(keys: readonly string[], bodyFor = (k: string) => `${k} 正文`) {
  chatMock.mockResolvedValue({
    content: JSON.stringify({
      sections: keys.map((key) => ({ key, body: bodyFor(key) })),
    }),
    model: "divergence-model",
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    durationMs: 5,
  });
}

function firstCallMessages(): { system: string; user: string } {
  const calls = chatMock.mock.calls as unknown as [
    { role: string; content: string }[],
  ];
  const [messages] = calls[calls.length - 1];
  return {
    system: messages.find((m) => m.role === "system")?.content ?? "",
    user: messages.find((m) => m.role === "user")?.content ?? "",
  };
}

describe("前置：配置与共用件", () => {
  it("配置齐备时三条管线都会真正调用 chatCompletion", async () => {
    expect(isLlmConfigured()).toBe(true);
    replyWith(SECTION_KEYS);
    await llmReading(BAZI);
    replyWith(ZIWEI_SECTION_KEYS);
    await llmZiweiReading(ZIWEI);
    replyWith(LIUYAO_SECTION_KEYS);
    await llmLiuyaoReading(LIUYAO);
    expect(chatMock).toHaveBeenCalledTimes(3);
    // 共用层：art 标签用于模型/日志选择，三者互不相同
    expect(chatMock.mock.calls.map((c) => (c[1] as { art: string }).art)).toEqual(
      ["bazi", "ziwei", "liuyao"],
    );
  });
});

describe("差异 1：章节集合与报告结构不可互换", () => {
  it("三术章节 key 集互不相同，条数也不同", () => {
    expect(SECTION_KEYS.length).toBe(8);
    expect(ZIWEI_SECTION_KEYS.length).toBe(8);
    expect(LIUYAO_SECTION_KEYS.length).toBe(7);
    // 只有 advice 是三方共有；disclaimer 只存在于紫微/六爻的章节集合里
    expect(
      SECTION_KEYS.filter((k) => (ZIWEI_SECTION_KEYS as readonly string[]).includes(k)),
    ).toEqual(["advice"]);
    expect(SECTION_KEYS).toContain("dayun");
    expect(ZIWEI_SECTION_KEYS).toContain("ming_gong");
    expect(LIUYAO_SECTION_KEYS).toContain("shi_ying");
  });

  it("报告结构字段按术不同：bazi 带 calibratePrompts，liuyao 带 question，ziwei 带 kind", async () => {
    replyWith(SECTION_KEYS);
    const bazi = await llmReading(BAZI);
    expect(bazi.sections.map((s) => s.key)).toEqual([...SECTION_KEYS]);
    expect(Array.isArray(bazi.calibratePrompts)).toBe(true);
    expect((bazi as { kind?: string }).kind).toBeUndefined();

    replyWith(ZIWEI_SECTION_KEYS);
    const ziwei = await llmZiweiReading(ZIWEI);
    expect(ziwei.kind).toBe("ziwei");
    expect((ziwei as { calibratePrompts?: unknown }).calibratePrompts).toBeUndefined();

    replyWith(LIUYAO_SECTION_KEYS);
    const liuyao = await llmLiuyaoReading(LIUYAO);
    expect(liuyao.kind).toBe("liuyao");
    expect(liuyao.question).toBe(LIUYAO.question);
  });
});

describe("差异 2：事实注入方式（prompt）各不相同", () => {
  it("bazi 注入日主/四柱，ziwei 注入命宫/身宫/五行局，liuyao 注入所问/本卦且无档案性别", async () => {
    replyWith(SECTION_KEYS);
    await llmReading(BAZI, { gender: "male" });
    const baziPrompt = firstCallMessages();
    expect(baziPrompt.user).toContain("日主：戊");
    expect(baziPrompt.user).toContain("档案性别：男命");

    replyWith(ZIWEI_SECTION_KEYS);
    await llmZiweiReading(ZIWEI, { gender: "female" });
    const ziweiPrompt = firstCallMessages();
    expect(ziweiPrompt.user).toContain("命宫：命宫");
    expect(ziweiPrompt.user).toContain("五行局：水二局");
    expect(ziweiPrompt.user).toContain("档案性别：女命");

    replyWith(LIUYAO_SECTION_KEYS);
    await llmLiuyaoReading(LIUYAO);
    const liuyaoPrompt = firstCallMessages();
    expect(liuyaoPrompt.user).toContain(`所问：${LIUYAO.question}`);
    expect(liuyaoPrompt.user).toContain("本卦：乾为天");
    // 六爻是一事一问，不按性别取象
    expect(liuyaoPrompt.user).not.toContain("档案性别");
  });
});

describe("差异 3：免责声明归属不一致（合并时最容易被抹平的一处）", () => {
  const modelWrittenDisclaimer = "本模型输出即为最终定论，无需参考现实情况。";

  it("ziwei / liuyao 的 disclaimer 章节被服务端文案覆盖", async () => {
    replyWith(ZIWEI_SECTION_KEYS, (k) =>
      k === "disclaimer" ? modelWrittenDisclaimer : "正文",
    );
    const ziwei = await llmZiweiReading(ZIWEI);
    expect(
      ziwei.sections.find((s) => s.key === "disclaimer")?.body,
    ).toBe(DISCLAIMER);

    replyWith(LIUYAO_SECTION_KEYS, (k) =>
      k === "disclaimer" ? modelWrittenDisclaimer : "正文",
    );
    const liuyao = await llmLiuyaoReading(LIUYAO);
    expect(
      liuyao.sections.find((s) => s.key === "disclaimer")?.body,
    ).toBe(DISCLAIMER);
  });

  /**
   * 现状记录，不是认可：八字的章节集合里**没有** disclaimer（免责声明只走报告顶层
   * 字段 + 页脚组件），紫微/六爻则有一章且被服务端文案强制覆盖。
   * 合并三条管线时最容易把这处抹平：统一成「都有 disclaimer 章」会让八字变九章，
   * 统一成「都没有」则让另两术的免责声明章失去服务端保护。
   * 两侧行为都钉成断言；一旦有人统一，本测试即失败并要求显式确认取舍方向。
   */
  it("bazi 无 disclaimer 章节，免责声明只在报告顶层字段", async () => {
    expect(SECTION_KEYS).not.toContain("disclaimer");
    replyWith(SECTION_KEYS);
    const bazi = await llmReading(BAZI);
    expect(bazi.sections.map((s) => s.key)).toEqual([...SECTION_KEYS]);
    expect(bazi.sections.map((s) => s.key)).not.toContain("disclaimer");
    expect(bazi.disclaimer).toBe(DISCLAIMER);
  });
});

describe("差异 3b：服务端对模型正文的改写程度不同", () => {
  it("bazi 在 advice 章追加服务端证据注记；ziwei 原样采用模型正文", async () => {
    replyWith(SECTION_KEYS);
    const bazi = await llmReading(BAZI);
    const baziAdvice = bazi.sections.find((s) => s.key === "advice")!;
    expect(baziAdvice.body.startsWith("advice 正文")).toBe(true);
    expect(baziAdvice.body.length).toBeGreaterThan("advice 正文".length);

    replyWith(ZIWEI_SECTION_KEYS);
    const ziwei = await llmZiweiReading(ZIWEI);
    expect(
      ziwei.sections.find((s) => s.key === "advice")!.body,
    ).toBe("advice 正文");
  });
});

describe("差异 4：跨术输出必须被拒（parse 严格按本术 key 校验）", () => {
  it("把八字章节喂给紫微管线 → 回落模板，不产出错章节", async () => {
    chatMock.mockResolvedValue({
      content: JSON.stringify({
        sections: SECTION_KEYS.map((key) => ({ key, body: `${key} 正文` })),
      }),
      model: "divergence-model",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      durationMs: 1,
    });

    const report = await llmZiweiReading(ZIWEI);
    expect(report.mode).toBe("llm");
    expect(report.fallback).toBe(true);
    expect(report.fallbackReason).toBeTruthy();
    // 回落用的是紫微自己的模板：key 集仍是紫微的
    expect(report.sections.map((s) => s.key)).toEqual([...ZIWEI_SECTION_KEYS]);
    expect(report.sections.map((s) => s.key)).not.toEqual([...SECTION_KEYS]);
  });
});

describe("共同点（可复用的部分）", () => {
  it("未配置 LLM 时三者同构：mode=llm + fallback=true + errorCode=LLM_NOT_CONFIGURED", async () => {
    delete process.env.LLM_API_KEY;

    const results = [];
    replyWith(SECTION_KEYS);
    results.push(await llmReading(BAZI));
    results.push(await llmZiweiReading(ZIWEI));
    results.push(await llmLiuyaoReading(LIUYAO));

    for (const r of results) {
      expect(r.mode).toBe("llm");
      expect(r.fallback).toBe(true);
      expect(
        (r as { meta?: { errorCode?: string } }).meta?.errorCode,
      ).toBe("LLM_NOT_CONFIGURED");
    }
    // 未配置时不应发出任何网络请求
    expect(chatMock).not.toHaveBeenCalled();
  });
});
