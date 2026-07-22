import type { LiuyaoLine, YaoPosition, YaoValue } from "@/lib/types/liuyao";

export function isChanging(value: YaoValue): boolean {
  return value === 6 || value === 9;
}

/** 阴阳：阳=1（7/9），阴=0（6/8） */
export function yaoToBit(value: YaoValue): 0 | 1 {
  return value === 7 || value === 9 ? 1 : 0;
}

/** 动爻变：老阴 6→7，老阳 9→8；静爻不变 */
export function changeYao(value: YaoValue): YaoValue {
  if (value === 6) return 7;
  if (value === 9) return 8;
  return value;
}

export function toLines(values: readonly YaoValue[]): LiuyaoLine[] {
  if (values.length !== 6) {
    throw new Error(`装卦需 6 爻，收到 ${values.length}`);
  }
  return values.map((value, i) => ({
    yao: (i + 1) as YaoPosition,
    value,
    changing: isChanging(value),
  }));
}

/** 自下而上六位阴阳 */
export function toBinary(
  values: readonly YaoValue[],
): readonly [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1] {
  if (values.length !== 6) {
    throw new Error(`装卦需 6 爻，收到 ${values.length}`);
  }
  return [
    yaoToBit(values[0]!),
    yaoToBit(values[1]!),
    yaoToBit(values[2]!),
    yaoToBit(values[3]!),
    yaoToBit(values[4]!),
    yaoToBit(values[5]!),
  ] as const;
}

export function toBianValues(values: readonly YaoValue[]): YaoValue[] {
  return values.map(changeYao);
}

export function assertYaoValue(n: number): YaoValue {
  if (n === 6 || n === 7 || n === 8 || n === 9) return n;
  throw new Error(`非法爻值 ${n}，应为 6|7|8|9`);
}
