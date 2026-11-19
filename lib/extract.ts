import { GoogleGenAI } from "@google/genai";
import type { EventDraft, ExtractResponse } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
const TIME_ZONE = process.env.APP_TIME_ZONE ?? "Asia/Tokyo";

export type ImageInput = {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  base64: string;
};

const SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "ユーザーへの短い返事（日本語）" },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          date: { type: "string", description: "開始日 YYYY-MM-DD" },
          endDate: { type: "string", description: "終了日 YYYY-MM-DD。開始日と同じなら空文字" },
          startTime: { type: "string", description: "開始時刻 HH:mm（24時間）。終日なら空文字" },
          endTime: { type: "string", description: "終了時刻 HH:mm。不明なら空文字" },
          allDay: { type: "boolean" },
          location: { type: "string", description: "場所。不明なら空文字" },
          notes: { type: "string", description: "補足メモ。無ければ空文字" },
        },
        required: ["title", "date", "endDate", "startTime", "endTime", "allDay", "location", "notes"],
      },
    },
  },
  required: ["reply", "events"],
};

function nowInfo() {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
  const human = new Intl.DateTimeFormat("ja-JP", { timeZone: TIME_ZONE, dateStyle: "full", timeStyle: "short" }).format(now);
  return { ymd, human };
}

function buildSystemPrompt(): string {
  const { ymd, human } = nowInfo();
  return `あなたはスケジュール登録アシスタントです。
ユーザーが送ったテキストや画像（チラシ、招待状、時間割、スクリーンショット、手書きメモなど）から、カレンダーに登録すべき予定を抽出してください。

# 現在
- 現在日時: ${human}（${TIME_ZONE}）
- 今日の日付: ${ymd}

# ルール
- 「明日」「来週の金曜」「月末」などの相対的な表現は、上の現在日時を基準に YYYY-MM-DD に変換する。
- 年が書かれていない日付は、今日以降で最も近い日付と解釈する。
- 時刻が分からない予定は allDay を true、startTime と endTime を空文字にする。
- 終了時刻が書かれていなければ endTime は空文字にする（勝手に推測しない）。
- 1つの画像に複数の予定があれば、すべて events に入れる。
- 予定が見つからない場合や、日付が特定できない場合は events を空にし、reply で何が足りないかを短く質問する。
- reply には、何件の予定を見つけたかなどを1〜2文の日本語で書く。`;
}

export async function extractEvents(input: { text: string; image?: ImageInput }): Promise<ExtractResponse> {
  // Gemini では画像やテキストを "parts" の配列として送る
  const parts: ({ inlineData: { mimeType: string; data: string } } | { text: string })[] = [];
  if (input.image) {
    parts.push({ inlineData: { mimeType: input.image.mediaType, data: input.image.base64 } });
  }
  parts.push({ text: input.text.trim() || "この画像から予定を読み取って登録してください。" });

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: buildSystemPrompt(),
      responseMimeType: "application/json",
      responseJsonSchema: SCHEMA,
    },
  });

  const text = res.text;
  if (!text) throw new Error("AI から予定データを受け取れませんでした。");

  const parsed = JSON.parse(text) as ExtractResponse;
  return { reply: parsed.reply ?? "", events: (parsed.events ?? []).filter(isValidDraft) };
}

function isValidDraft(d: EventDraft): boolean {
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(d.date);
  const endDateOk = d.endDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(d.endDate);
  const timeOk = (t: string) => t === "" || /^\d{2}:\d{2}$/.test(t);
  return Boolean(d.title) && dateOk && endDateOk && timeOk(d.startTime) && timeOk(d.endTime);
}