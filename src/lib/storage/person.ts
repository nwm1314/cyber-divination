/**
 * Person 统一档案（T121）
 * 游客 sessionStorage / 账号 localStorage（见 mode.ts）
 */

import type {
  Person,
  PersonId,
  PersonInput,
  PersonListEntry,
  UserId,
} from "@/lib/types/user";
import { kvGet, kvGetJson, kvRemove, kvSet, kvSetJson } from "./kv";

const PREFIX_PERSON = "bd_person_";
const KEY_PERSON_LIST = "bd_person_list_";

function nowIso(): string {
  return new Date().toISOString();
}

function newPersonId(): PersonId {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `person_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }
  return `person_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function uniqIds(ids: string[] | undefined): string[] {
  if (!ids?.length) return [];
  return [...new Set(ids.filter(Boolean))];
}

function normalizePerson(p: Person): Person {
  return {
    ...p,
    chartIds: uniqIds(p.chartIds),
    ziweiIds: uniqIds(p.ziweiIds),
  };
}

function getIdList(): PersonId[] {
  return kvGetJson<PersonId[]>(KEY_PERSON_LIST) ?? [];
}

function setIdList(ids: PersonId[]): void {
  kvSetJson(KEY_PERSON_LIST, ids);
}

function touchList(id: PersonId): void {
  const list = getIdList();
  const idx = list.indexOf(id);
  if (idx >= 0) {
    list.splice(idx, 1);
  }
  list.unshift(id);
  setIdList(list);
}

/** 创建 Person（未传 id 则自动生成） */
export function createPerson(input: PersonInput): Person {
  const ts = nowIso();
  const person = normalizePerson({
    ...input,
    id: input.id?.trim() || newPersonId(),
    chartIds: input.chartIds ?? [],
    ziweiIds: input.ziweiIds ?? [],
    createdAt: ts,
    updatedAt: ts,
  });
  kvSet(PREFIX_PERSON + person.id, JSON.stringify(person));
  touchList(person.id);
  return person;
}

/** 全量写入 / 覆盖（保留 createdAt 若已存在） */
export function savePerson(person: Person): Person {
  const existing = getPerson(person.id);
  const ts = nowIso();
  const next = normalizePerson({
    ...person,
    chartIds: person.chartIds ?? existing?.chartIds ?? [],
    ziweiIds: person.ziweiIds ?? existing?.ziweiIds ?? [],
    createdAt: existing?.createdAt ?? person.createdAt ?? ts,
    updatedAt: ts,
  });
  kvSet(PREFIX_PERSON + next.id, JSON.stringify(next));
  touchList(next.id);
  return next;
}

export function getPerson(id: PersonId): Person | null {
  const raw = kvGet(PREFIX_PERSON + id);
  if (!raw) return null;
  try {
    return normalizePerson(JSON.parse(raw) as Person);
  } catch {
    return null;
  }
}

/** 列表（完整 Person；T122 可用 toPersonListEntry 做摘要） */
export function listPersons(userId?: UserId | null): Person[] {
  const ids = getIdList();
  const out: Person[] = [];
  for (const id of ids) {
    const p = getPerson(id);
    if (!p) continue;
    if (userId !== undefined) {
      const uid = p.userId ?? null;
      if (uid !== userId) continue;
    }
    out.push(p);
  }
  return out;
}

/** T122 UI 钩子：列表摘要 */
export function listPersonEntries(userId?: UserId | null): PersonListEntry[] {
  return listPersons(userId).map(toPersonListEntry);
}

export function toPersonListEntry(p: Person): PersonListEntry {
  return {
    id: p.id,
    name: p.name,
    gender: p.gender,
    solarDate: p.solarDate,
    chartCount: p.chartIds?.length ?? 0,
    ziweiCount: p.ziweiIds?.length ?? 0,
    updatedAt: p.updatedAt,
  };
}

export function deletePerson(id: PersonId): void {
  kvRemove(PREFIX_PERSON + id);
  setIdList(getIdList().filter((x) => x !== id));
}

/** 局部更新字段（不含 id） */
export function updatePerson(
  id: PersonId,
  patch: Partial<Omit<Person, "id" | "createdAt">>,
): Person | null {
  const existing = getPerson(id);
  if (!existing) return null;
  return savePerson({
    ...existing,
    ...patch,
    id,
    chartIds: patch.chartIds !== undefined ? patch.chartIds : existing.chartIds,
    ziweiIds: patch.ziweiIds !== undefined ? patch.ziweiIds : existing.ziweiIds,
  });
}

/** 关联八字盘 id（= profileId）；已存在则不重复 */
export function linkChartId(personId: PersonId, chartId: string): Person | null {
  const p = getPerson(personId);
  if (!p || !chartId) return p;
  const chartIds = uniqIds([...(p.chartIds ?? []), chartId]);
  if (chartIds.length === (p.chartIds?.length ?? 0)) return p;
  return updatePerson(personId, { chartIds });
}

/** 取消关联八字盘 */
export function unlinkChartId(personId: PersonId, chartId: string): Person | null {
  const p = getPerson(personId);
  if (!p) return null;
  const chartIds = (p.chartIds ?? []).filter((x) => x !== chartId);
  return updatePerson(personId, { chartIds });
}

/** 关联紫微盘 id */
export function linkZiweiId(personId: PersonId, ziweiId: string): Person | null {
  const p = getPerson(personId);
  if (!p || !ziweiId) return p;
  const ziweiIds = uniqIds([...(p.ziweiIds ?? []), ziweiId]);
  if (ziweiIds.length === (p.ziweiIds?.length ?? 0)) return p;
  return updatePerson(personId, { ziweiIds });
}

/** 取消关联紫微盘 */
export function unlinkZiweiId(personId: PersonId, ziweiId: string): Person | null {
  const p = getPerson(personId);
  if (!p) return null;
  const ziweiIds = (p.ziweiIds ?? []).filter((x) => x !== ziweiId);
  return updatePerson(personId, { ziweiIds });
}
