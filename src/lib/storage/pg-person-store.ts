/**
 * Postgres Person（T223）
 */

import type { Person, PersonId, PersonInput, UserId } from "@/lib/types/user";
import { ensureSchema, getSql } from "@/lib/db";
import {
  assertVersionWritable,
  normalizeVersion,
  VersionConflictError,
} from "./version-guard";

function newPersonId(): PersonId {
  return `person_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function uniqIds(ids: string[] | undefined): string[] {
  if (!ids?.length) return [];
  return [...new Set(ids.filter(Boolean))];
}

function normalize(p: Person, userId: UserId, version?: number): Person {
  return {
    ...p,
    userId,
    chartIds: uniqIds(p.chartIds),
    ziweiIds: uniqIds(p.ziweiIds),
    ...(version === undefined ? {} : { version }),
  };
}

function rowToPerson(row: {
  id: string;
  user_id: string;
  payload: unknown;
  version?: number;
}): Person {
  const p = row.payload as Person;
  // 版本取自列而不是 payload，避免两处真相（B4）
  return normalize({ ...p, id: row.id }, row.user_id, normalizeVersion(row.version));
}

export async function pgListCloudPeople(userId: UserId): Promise<Person[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM people WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;
  return rows.map((r) => rowToPerson(r as never));
}

export async function pgGetCloudPerson(
  userId: UserId,
  personId: PersonId,
): Promise<Person | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM people WHERE user_id = ${userId} AND id = ${personId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return rowToPerson(rows[0] as never);
}

export async function pgUpsertCloudPerson(
  userId: UserId,
  input: PersonInput,
  options?: { expectedVersion?: number },
): Promise<Person> {
  await ensureSchema();
  const id = input.id?.trim() || newPersonId();
  const existing = await pgGetCloudPerson(userId, id);
  const now = new Date().toISOString();
  const expected = options?.expectedVersion;
  // 判定与 file 驱动共用同一函数：同一请求在两种驱动下得到同一结论
  const version = assertVersionWritable({
    resource: "person",
    resourceId: id,
    storedVersion: existing?.version,
    expectedVersion: expected,
  });
  const person = normalize(
    {
      ...input,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
    userId,
    version,
  );
  const sql = getSql();
  // payload 内不写 version：列是唯一真相，避免同一条记录有两个版本
  const payload = { ...person, version: undefined };

  if (expected === undefined) {
    // 盲写（旧客户端）：维持后写覆盖，但版本仍然自增，使后续可带版本
    await sql`
      INSERT INTO people (id, user_id, payload, version, created_at, updated_at)
      VALUES (
        ${id},
        ${userId},
        ${sql.json(payload as never)},
        ${version},
        ${person.createdAt ?? now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        payload = EXCLUDED.payload,
        version = people.version + 1,
        updated_at = EXCLUDED.updated_at
    `;
    return person;
  }

  // 带版本写：WHERE 让「比较 + 覆盖」在一条语句内原子完成
  const written = await sql`
    INSERT INTO people (id, user_id, payload, version, created_at, updated_at)
    VALUES (
      ${id},
      ${userId},
      ${sql.json(payload as never)},
      ${version},
      ${person.createdAt ?? now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      payload = EXCLUDED.payload,
      version = people.version + 1,
      updated_at = EXCLUDED.updated_at
    WHERE people.version = ${expected}
    RETURNING id
  `;
  if (written.length === 0) {
    const current = await pgGetCloudPerson(userId, id);
    throw new VersionConflictError(
      "person",
      id,
      expected,
      normalizeVersion(current?.version),
    );
  }
  return person;
}

export async function pgDeleteCloudPerson(
  userId: UserId,
  personId: PersonId,
): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM people WHERE user_id = ${userId} AND id = ${personId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function pgDeleteAllCloudPeopleForUser(
  userId: UserId,
): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM people WHERE user_id = ${userId} RETURNING id
  `;
  return rows.length;
}
