import { describe, expect, it } from "vitest";
import {
  chartMatchesProfile,
  computeAuthoritativeChart,
  computeChart,
  ENGINE_VERSION,
  SKILL_REF,
} from "./index";
import type { BirthProfile } from "@/lib/types";

function makeProfile(overrides?: Partial<BirthProfile>): BirthProfile {
  return {
    id: "test-001",
    name: "测试",
    solarDate: "1990-05-15",
    birthTime: "10:30",
    gender: "male",
    birthPlace: { province: "北京", city: "北京", lng: 116.4, lat: 39.9 },
    alive: true,
    analysisBaseDate: "2026-07-20",
    useTrueSolarTime: false,
    ...overrides,
  };
}

describe("computeChart", () => {
  it("服务端 authority 从出生资料重算并识别伪造派生结果", () => {
    const profile = makeProfile();
    const authoritative = computeAuthoritativeChart(profile);
    expect(authoritative).toEqual(computeChart(profile));
    expect(chartMatchesProfile(profile, authoritative)).toBe(true);
    expect(
      chartMatchesProfile(profile, {
        ...authoritative,
        dayMaster: "伪造",
      }),
    ).toBe(false);
  });

  it("1990-05-15 庚午男 完整排盘", () => {
    const chart = computeChart(makeProfile());

    // meta
    expect(chart.profileId).toBe("test-001");
    expect(chart.meta.engineVersion).toBe(ENGINE_VERSION);
    expect(chart.meta.skillRef).toBe(SKILL_REF);
    expect(chart.meta.provenance?.skillRef).toBe(SKILL_REF);
    expect(chart.meta.provenance?.referenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(chart.meta.provenance?.execution).toBe("deterministic-project-engine");

    // pillars
    expect(chart.pillars.year.stem).toBe("庚");
    expect(chart.pillars.year.branch).toBe("午");
    expect(chart.pillars.month.stem).toBe("辛");
    expect(chart.pillars.month.branch).toBe("巳");
    expect(chart.pillars.day.stem).toBe("庚");
    expect(chart.pillars.day.branch).toBe("辰");
    expect(chart.pillars.hour).not.toBeNull();
    expect(chart.pillars.hour!.stem).toBe("辛");
    expect(chart.pillars.hour!.branch).toBe("巳");

    // dayMaster
    expect(chart.dayMaster).toBe("庚");

    // tenGods
    expect(chart.tenGods["庚"]).toBe("比肩");
    expect(chart.tenGods["辛"]).toBe("劫财");

    // tenGod on pillars
    expect(chart.pillars.year.tenGod).toBe("比肩");
    expect(chart.pillars.month.tenGod).toBe("劫财");
    expect(chart.pillars.day.tenGod).toBe("比肩");
    expect(chart.pillars.hour!.tenGod).toBe("劫财");

    // hiddenStems
    expect(chart.pillars.year.hiddenStems).toEqual(["丁", "己"]);
    expect(chart.pillars.month.hiddenStems).toEqual(["丙", "庚", "戊"]);
    expect(chart.pillars.day.hiddenStems).toEqual(["戊", "乙", "癸"]);
    expect(chart.pillars.hour!.hiddenStems).toEqual(["丙", "庚", "戊"]);
    expect(chart.hiddenStems["午"]).toEqual(["丁", "己"]);
    expect(chart.hiddenStems["巳"]).toEqual(["丙", "庚", "戊"]);
    expect(chart.hiddenStems["辰"]).toEqual(["戊", "乙", "癸"]);

    // wuxingScores — 藏干权重 0.6/0.3/0.1（skill）
    // stems: 庚+1, 辛+1, 庚+1, 辛+1 = 金 4.0
    // 午: 丁(火)0.6 + 己(土)0.3
    // 巳: 丙(火)0.6 + 庚(金)0.3 + 戊(土)0.1  ×2
    // 辰: 戊(土)0.6 + 乙(木)0.3 + 癸(水)0.1
    expect(chart.wuxingScores.wood).toBeCloseTo(0.3);
    expect(chart.wuxingScores.fire).toBeCloseTo(1.8);
    expect(chart.wuxingScores.earth).toBeCloseTo(1.1);
    expect(chart.wuxingScores.metal).toBeCloseTo(4.6);
    expect(chart.wuxingScores.water).toBeCloseTo(0.1);

    // dayun：含起运前小运 + 8 步正式大运
    const formal = chart.dayun.filter((d) => !d.isPreDayun);
    expect(formal.length).toBe(8);
    expect(formal[0].stem).toBe("壬");
    expect(formal[0].branch).toBe("午");
    expect(formal[0].startAge).toBe(7);
    expect(formal[0].endAge).toBe(16);
    expect(formal[0].startYear).toBe(1997);
    expect(formal[0].endYear).toBe(2006);
    expect(chart.dayun.some((d) => d.isPreDayun)).toBe(true);
    expect(chart.startAgeDetail).toBeDefined();
    expect(chart.changSheng?.month).toBeTruthy();

    // currentDayunIndex (age 36 in 2026 → 3rd step, index 2)
    expect(chart.currentDayunIndex).toBe(2);

    // liunian
    expect(chart.liunian.length).toBe(3);
    expect(chart.liunian[0].year).toBe(2024);
    expect(chart.liunian[1].year).toBe(2025);
    expect(chart.liunian[2].year).toBe(2026);

    // flags：非节气敏感样例可不含 night_zi / shichen_unknown
    expect(chart.flags).not.toContain("night_zi");
    expect(chart.flags).not.toContain("shichen_unknown");
    // relations 字段存在
    expect(chart.relations).toBeDefined();
    expect(Array.isArray(chart.relations.stemHe)).toBe(true);
    expect(Array.isArray(chart.relations.branchChong)).toBe(true);
  });

  it("确定性：同输入两次结果 deep equal", () => {
    const profile = makeProfile();
    const a = computeChart(profile);
    const b = computeChart(profile);
    expect(a).toEqual(b);
  });

  it("未知时辰 → hour 为 null, tenGods 不含时柱", () => {
    const chart = computeChart(makeProfile({ shichenUnknown: true, birthTime: undefined }));
    expect(chart.pillars.hour).toBeNull();
    expect(chart.flags).toContain("shichen_unknown");
    expect(chart.pillars.year.stem).toBe("庚");
    expect(chart.pillars.day.stem).toBe("庚");
  });

  it("已故 → liunian 截断至 deathYear", () => {
    const chart = computeChart(makeProfile({ alive: false, deathYear: 1995 }));
    for (const item of chart.liunian) {
      expect(item.year).toBeLessThanOrEqual(1995);
    }
  });

  it("真太阳时开启 + 有经度 → 时间被校正并标记", () => {
    const chart = computeChart(makeProfile({ useTrueSolarTime: true }));
    // Beijing (lng 116.4) → offset ≈ (116.4-120)*4 = -14.4 min + eot
    expect(chart.dayMaster).toBe("庚");
    expect(chart.pillars.hour).not.toBeNull();
    expect(chart.flags).toContain("true_solar_applied");
  });

  it("真太阳时开启但无经度 → 标记未校正", () => {
    const chart = computeChart(
      makeProfile({
        useTrueSolarTime: true,
        birthPlace: { province: "新疆", city: "乌鲁木齐" },
      }),
    );
    expect(chart.flags).toContain("true_solar_no_lng");
    expect(chart.flags).not.toContain("true_solar_applied");
  });
});
