// GET  /api/events  … 保存済みの予定一覧
// POST /api/events  … 下書き（EventDraft）を受け取って保存
import { NextResponse, connection } from "next/server";
import { addEvents, listEvents } from "@/lib/store";
import { draftToEvent, type EventDraft } from "@/lib/types";

export async function GET() {
  // 毎回最新のデータを返す（ビルド時にキャッシュさせない）
  await connection();
  const events = await listEvents();
  return NextResponse.json(events);
}

export async function POST(req: Request) {
  const body = (await req.json()) as { drafts?: EventDraft[] };
  if (!Array.isArray(body.drafts) || body.drafts.length === 0) {
    return NextResponse.json({ error: "drafts が空です。" }, { status: 400 });
  }
  const created = await addEvents(body.drafts.map(draftToEvent));
  return NextResponse.json(created, { status: 201 });
}
