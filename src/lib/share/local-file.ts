import { promises as fs } from "fs";
import path from "path";
import type { ShareSnapshot } from "@/lib/types";
import type { ShareStore } from "./types";

/**
 * 本地/单机开发用文件快照（data/shares.json）。
 * Vercel 等无持久磁盘的 Serverless 环境不可靠，生产请用 upstash。
 */
export class LocalFileShareStore implements ShareStore {
  private readonly sharesFile: string;

  constructor(options?: { dataDir?: string; filePath?: string }) {
    if (options?.filePath) {
      this.sharesFile = options.filePath;
    } else {
      const dir = options?.dataDir ?? path.join(process.cwd(), "data");
      this.sharesFile = path.join(dir, "shares.json");
    }
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(path.dirname(this.sharesFile), { recursive: true });
  }

  private async readAll(): Promise<Record<string, ShareSnapshot>> {
    try {
      await this.ensureDir();
      const raw = await fs.readFile(this.sharesFile, "utf-8");
      return JSON.parse(raw) as Record<string, ShareSnapshot>;
    } catch {
      return {};
    }
  }

  private async writeAll(data: Record<string, ShareSnapshot>): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.sharesFile, JSON.stringify(data, null, 2), "utf-8");
  }

  async save(snapshot: ShareSnapshot): Promise<void> {
    const all = await this.readAll();
    all[snapshot.token] = snapshot;
    await this.writeAll(all);
  }

  async get(token: string): Promise<ShareSnapshot | null> {
    const all = await this.readAll();
    return all[token] ?? null;
  }

  async delete(token: string): Promise<void> {
    const all = await this.readAll();
    if (!(token in all)) return;
    delete all[token];
    await this.writeAll(all);
  }
}
