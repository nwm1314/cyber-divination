/**
 * 云端 Person 存储（T121 / T223）
 * data/cloud-people.json 或 Postgres
 */

import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Person, PersonId, PersonInput, UserId } from "@/lib/types/user";
import { getCloudStoreDriver } from "./driver";
import {
  pgDeleteAllCloudPeopleForUser,
  pgDeleteCloudPerson,
  pgGetCloudPerson,
  pgListCloudPeople,
  pgUpsertCloudPerson,
} from "./pg-person-store";

function isPostgresDriver(): boolean {
  return getCloudStoreDriver() === "postgres";
}

type CloudPeopleFile = {
  version: 1;
  users: Record<UserId, Record<PersonId, Person>>;
};

const EMPTY: CloudPeopleFile = { version: 1, users: {} };

let memory: CloudPeopleFile | null = null;
let loaded = false;

function dataFile(): string {
  return path.join(process.cwd(), "data", "cloud-people.json");
}

function nowIso(): string {
  return new Date().toISOString();
}

function newPersonId(): PersonId {
  return `person_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function uniqIds(ids: string[] | undefined): string[] {
  if (!ids?.length) return [];
  return [...new Set(ids.filter(Boolean))];
}

function normalize(p: Person, userId: UserId): Person {
  return {
    ...p,
    userId,
    chartIds: uniqIds(p.chartIds),
    ziweiIds: uniqIds(p.ziweiIds),
  };
}

async function ensureLoaded(): Promise<void> {
  if (loaded && memory) return;
  loaded = true;
  try {
    const raw = await fs.readFile(dataFile(), "utf-8");
    const parsed = JSON.parse(raw) as CloudPeopleFile;
    if (parsed?.version === 1 && parsed.users && typeof parsed.users === "object") {
      memory = parsed;
      return;
    }
  } catch {
    // miss
  }
  memory = { ...EMPTY, users: {} };
}

async function persist(): Promise<void> {
  if (!memory) return;
  const dir = path.dirname(dataFile());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(dataFile(), JSON.stringify(memory, null, 2), "utf-8");
}

export function resetCloudPeopleStoreForTests(): void {
  memory = { version: 1, users: {} };
  loaded = true;
}

export async function listCloudPeople(userId: UserId): Promise<Person[]> {
  if (isPostgresDriver()) return pgListCloudPeople(userId);
  await ensureLoaded();
  return Object.values(memory!.users[userId] ?? {}).sort((a, b) =>
    (a.updatedAt ?? "") < (b.updatedAt ?? "") ? 1 : -1,
  );
}

export async function getCloudPerson(
  userId: UserId,
  personId: PersonId,
): Promise<Person | null> {
  if (isPostgresDriver()) return pgGetCloudPerson(userId, personId);
  await ensureLoaded();
  return memory!.users[userId]?.[personId] ?? null;
}

export async function upsertCloudPerson(
  userId: UserId,
  input: PersonInput,
): Promise<Person> {
  if (isPostgresDriver()) return pgUpsertCloudPerson(userId, input);
  await ensureLoaded();
  const id = input.id?.trim() || newPersonId();
  const existing = memory!.users[userId]?.[id];
  const ts = nowIso();
  const person = normalize(
    {
      ...input,
      id,
      chartIds: input.chartIds ?? existing?.chartIds ?? [],
      ziweiIds: input.ziweiIds ?? existing?.ziweiIds ?? [],
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    },
    userId,
  );

  if (!memory!.users[userId]) memory!.users[userId] = {};
  memory!.users[userId][id] = person;
  await persist().catch(() => undefined);
  return person;
}

export async function deleteCloudPerson(
  userId: UserId,
  personId: PersonId,
): Promise<boolean> {
  if (isPostgresDriver()) return pgDeleteCloudPerson(userId, personId);
  await ensureLoaded();
  const bag = memory!.users[userId];
  if (!bag || !(personId in bag)) return false;
  delete bag[personId];
  await persist().catch(() => undefined);
  return true;
}

export async function deleteAllCloudPeopleForUser(
  userId: UserId,
): Promise<number> {
  if (isPostgresDriver()) return pgDeleteAllCloudPeopleForUser(userId);
  await ensureLoaded();
  const bag = memory!.users[userId];
  if (!bag) return 0;
  const n = Object.keys(bag).length;
  delete memory!.users[userId];
  await persist().catch(() => undefined);
  return n;
}
