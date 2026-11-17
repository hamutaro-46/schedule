// ============================================================
// DELETE /api/events/:id … 予定を1件削除
// Next.js 15 以降、params は Promise なので await して取り出す。
// ============================================================
import { NextResponse } from "next/server";
import { deleteEvent } from "@/lib/store";


export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteEvent(id);
  if (!ok) return NextResponse.json({ error: "見つかりません。" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
