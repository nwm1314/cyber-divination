/**
 * Postgres Person（T223）
 */

import type { Person, PersonId, PersonInput, UserId } from "@/lib/types/user";
import { ensureSchema, getSql } from "@/lib/db";

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

function rowToPerson(row: {
  id: string;
  user_id: string;
  payload: unknown;
}): Person {
  const p = row.payload as Person;
  return normalize({ ...p, id: row.id }, row.user_id);
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
): Promise<Person> {
  await ensureSchema();
  const id = input.id?.trim() || newPersonId();
  const existing = await pgGetCloudPerson(userId, id);
  const now = new Date().toISOString();
  const person = normalize(
    {
      ...input,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
    userId,
  );
  const sql = getSql();
  await sql`
    INSERT INTO people (id, user_id, payload, created_at, updated_at)
    VALUES (
      ${id},
      ${userId},
      ${sql.json(person as never)},
      ${person.createdAt ?? now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      payload = EXCLUDED.payload,
      updated_at = EXCLUDED.updated_at
  `;
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
