// ============================================================
// POST /api/extract
// チャットから届いた「テキスト + 画像」を受け取り、AI に予定を読み取らせる。
// ここではまだ保存しない（ユーザーが確認してから /api/events に保存する）。
// API キーはサーバー側だけで使うので、ブラウザには漏れない。
// ============================================================
import { NextResponse } from "next/server";
import { extractEvents, type ImageInput } from "@/lib/extract";


const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const MAX_BYTES = 5 * 1024 * 1024; // Claude API の画像1枚あたりの上限に合わせて 5MB

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const text = String(form.get("text") ?? "");
    const file = form.get("image");

    let image: ImageInput | undefined;
    if (file instanceof File && file.size > 0) {
      if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
        return NextResponse.json(
          { error: "対応している画像は JPEG / PNG / GIF / WebP です。" },
          { status: 400 },
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "画像は 5MB 以下にしてください。" }, { status: 400 });
      }
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      image = { mediaType: file.type as ImageInput["mediaType"], base64 };
    }

    if (!text.trim() && !image) {
      return NextResponse.json({ error: "テキストか画像を送ってください。" }, { status: 400 });
    }

    const result = await extractEvents({ text, image });
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: `読み取りに失敗しました: ${message}` }, { status: 500 });
  }
}
