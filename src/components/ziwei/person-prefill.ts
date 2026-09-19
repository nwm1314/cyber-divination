import type { Gender } from "@/lib/types";
import type { Person } from "@/lib/types/user";

/**
 * 新建紫微盘时复用人物档案（B15 / IA-6）的纯映射层。
 *
 * 紫微向导的草稿字段与 `Person` 的生辰子集一一对应，此前用户必须整表重填。
 * 这里只做「档案 → 草稿」的取值映射，不含 IO，便于单测覆盖边界：
 * - 档案缺字段时保留草稿空值，而不是写入猜测值（事实层不得被臆造）；
 * - 经纬度等 number 字段转回表单使用的 string；
 * - `shichenBranch`（时辰地支快捷选择）不属于 Person，交由用户重选。
 */
export type ZiweiBirthDraftFields = {
  name: string;
  solarDate: string;
  lunarDate: string;
  isLeapMonth: boolean;
  birthTime: string;
  shichenUnknown: boolean;
  gender: Gender | "";
  province: string;
  city: string;
  lng: string;
};

export function emptyZiweiBirthDraftFields(): ZiweiBirthDraftFields {
  return {
    name: "",
    solarDate: "",
    lunarDate: "",
    isLeapMonth: false,
    birthTime: "",
    shichenUnknown: false,
    gender: "",
    province: "",
    city: "",
    lng: "",
  };
}

export function personToZiweiDraftFields(
  person: Person,
): ZiweiBirthDraftFields {
  const base = emptyZiweiBirthDraftFields();
  return {
    ...base,
    name: person.name ?? "",
    solarDate: person.solarDate ?? "",
    lunarDate: person.lunarDate ?? "",
    isLeapMonth: person.isLeapMonth === true,
    birthTime: person.birthTime ?? "",
    shichenUnknown: person.shichenUnknown === true,
    gender: person.gender ?? "",
    province: person.birthPlace?.province ?? "",
    city: person.birthPlace?.city ?? "",
    lng:
      typeof person.birthPlace?.lng === "number" &&
      Number.isFinite(person.birthPlace.lng)
        ? String(person.birthPlace.lng)
        : "",
  };
}

/** 下拉选项文案：姓名 + 可辨识的生辰摘要（无生日时明确标注） */
export function personOptionLabel(person: Person): string {
  const name = person.name?.trim() || "未命名档案";
  const date = person.solarDate ?? person.lunarDate;
  const gender =
    person.gender === "male" ? "男" : person.gender === "female" ? "女" : "";
  return [name, gender, date || "未填生日"].filter(Boolean).join(" · ");
}
