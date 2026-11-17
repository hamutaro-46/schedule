// ============================================================
// データ保存（JSON ファイル版）
// まずは data/events.json に保存するだけのシンプルな実装。
// 関数の形（list / add / delete）をそろえておけば、
// 後で Supabase や SQLite に差し替えるときもこのファイルだけ直せば済む。
// ============================================================
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { CalendarEvent, NewEvent } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "events.json");

async function readAll(): Promise<CalendarEvent[]> {
  try {
    const text = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(text) as CalendarEvent[];
  } catch (e) {
    // ファイルがまだ無いときは空の一覧
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeAll(events: CalendarEvent[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(events, null, 2), "utf-8");
}

// 書き込みが同時に走ってデータが消えないよう、処理を1本の列に並べる簡易ロック
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.catch(() => undefined);
  return result;
}

export function listEvents(): Promise<CalendarEvent[]> {
  return readAll();
}

export function addEvents(newEvents: NewEvent[]): Promise<CalendarEvent[]> {
  return serialize(async () => {
    const all = await readAll();
    const now = new Date().toISOString();
    const created = newEvents.map((e) => ({ ...e, id: randomUUID(), createdAt: now }));
    await writeAll([...all, ...created]);
    return created;
  });
}

export function deleteEvent(id: string): Promise<boolean> {
  return serialize(async () => {
    const all = await readAll();
    const rest = all.filter((e) => e.id !== id);
    if (rest.length === all.length) return false;
    await writeAll(rest);
    return true;
  });
}
