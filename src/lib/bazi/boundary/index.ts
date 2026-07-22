// @ts-expect-error lunar-javascript 无官方类型
import { Solar } from "lunar-javascript";
import {
  FLAG_JIEQI_BOUNDARY,
  FLAG_LICHUN_NEAR,
  FLAG_TRUE_SOLAR_NO_LNG,
} from "../calendar/constants";

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

/**
 * 节气/立春交界 flags（对齐 PRODUCT 边界提示）
 * - lichun_near：立春前后 24h 内
 * - jieqi_boundary：最近「节」交接点 12h 内（月柱可能交界）
 * - true_solar_no_lng：开启真太阳时但无经度
 */
export function detectBoundaryFlags(input: {
  solarDate: string;
  birthTime?: string;
  useTrueSolarTime?: boolean;
  lng?: number;
}): string[] {
  const flags: string[] = [];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.solarDate.trim());
  if (!m) return flags;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  let hour = 12;
  let minute = 0;
  if (input.birthTime) {
    const tm = /^(\d{1,2}):(\d{2})$/.exec(input.birthTime.trim());
    if (tm) {
      hour = Number(tm[1]);
      minute = Number(tm[2]);
    }
  }

  const birthMs = Date.UTC(year, month - 1, day, hour, minute);

  try {
    const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    const lunar = solar.getLunar();
    const prevJie = lunar.getPrevJie();
    const nextJie = lunar.getNextJie();

    const checkJie = (jie: {
      getSolar: () => {
        getYear: () => number;
        getMonth: () => number;
        getDay: () => number;
        getHour: () => number;
        getMinute: () => number;
        getSecond?: () => number;
      };
      getName: () => string;
    }) => {
      const js = jie.getSolar();
      const sec =
        typeof js.getSecond === "function" ? Number(js.getSecond()) || 0 : 0;
      const jieMs = Date.UTC(
        js.getYear(),
        js.getMonth() - 1,
        js.getDay(),
        js.getHour(),
        js.getMinute(),
        sec,
      );
      const dist = Math.abs(jieMs - birthMs);
      const name = String(jie.getName() ?? "");
      if (name.includes("立春") && dist <= MS_PER_DAY) {
        if (!flags.includes(FLAG_LICHUN_NEAR)) flags.push(FLAG_LICHUN_NEAR);
      }
      if (dist <= MS_PER_HOUR * 12) {
        if (!flags.includes(FLAG_JIEQI_BOUNDARY)) flags.push(FLAG_JIEQI_BOUNDARY);
      }
    };

    if (prevJie) checkJie(prevJie);
    if (nextJie) checkJie(nextJie);
  } catch {
    // 库异常时不阻断排盘
  }

  if (
    input.useTrueSolarTime &&
    (input.lng == null || !Number.isFinite(input.lng))
  ) {
    flags.push(FLAG_TRUE_SOLAR_NO_LNG);
  }

  return flags;
}
