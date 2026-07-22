/**
 * 服务端读取当前会话（Route Handler / Server Component）
 */

import { cookies } from "next/headers";
import type { AppSession } from "@/lib/types/user";
import {
  SESSION_COOKIE_NAME,
  sessionFromToken,
} from "./session";
import { toAppSession } from "./types";

export async function getServerSession(): Promise<AppSession> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE_NAME)?.value;
    return sessionFromToken(token);
  } catch {
    return toAppSession(null);
  }
}
