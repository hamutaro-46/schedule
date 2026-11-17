// ============================================================
// AI で予定を読み取る（このアプリの心臓部）
// Claude API に「画像 + テキスト」を送り、
// structured outputs（output_config.format）で
// 決まった形の JSON だけを返してもらう。
// ============================================================
import Anthropic from "@anthropic-ai/sdk";
import type { EventDraft, ExtractResponse } from "./types";

// ANTHROPIC_API_KEY は環境変数から自動で読まれる
const client = new Anthropic();

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
const TIME_ZONE = process.env.APP_TIME_ZONE ?? "Asia/Tokyo";

export type ImageInput = {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  base64: string;
};

// AI に返してほしい JSON の形（JSON Schema）
// 省略可能な項目も「空文字で返す」ルールにして、すべて required にしておくと扱いやすい
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "events"],
  properties: {
    reply: {
      type: "string",
      description: "ユーザーへの短い返事（日本語）",
    },
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "date", "endDate", "startTime", "endTime", "allDay", "location", "notes"],
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
      },
    },
  },
} as const;

/** 「今日」を AI に伝えるための文字列（"明日" "来週火曜" を正しく日付にするため） */
function nowInfo() {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now); // 2026-11-17
  const human = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIME_ZONE,
    dateStyle: "full",
    timeStyle: "short",
  }).format(now); // 2026年11月17日火曜日 9:13
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

export async function extractEvents(input: {
  text: string;
  image?: ImageInput;
}): Promise<ExtractResponse> {
  const content: Anthropic.ContentBlockParam[] = [];

  // 画像は文章より先に置くと読み取り精度が上がりやすい
  if (input.image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.image.mediaType, data: input.image.base64 },
    });
  }
  content.push({
    type: "text",
    text: input.text.trim() || "この画像から予定を読み取って登録してください。",
  });

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content }],
    output_config: {
      format: { type: "json_schema", schema: SCHEMA },
    },
  });

  if (res.stop_reason === "refusal") {
    return { reply: "この内容は処理できませんでした。", events: [] };
  }
  if (res.stop_reason === "max_tokens") {
    throw new Error("応答が長すぎて途中で切れました。画像を分けて送ってください。");
  }

  // 思考ブロックなどが混ざることがあるので、text ブロックを探して取り出す
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("AI から予定データを受け取れませんでした。");
  }

  const parsed = JSON.parse(block.text) as ExtractResponse;
  return {
    reply: parsed.reply,
    events: parsed.events.filter(isValidDraft),
  };
}

// 念のためサーバー側でも形式をチェックしておく
function isValidDraft(d: EventDraft): boolean {
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(d.date);
  const endDateOk = d.endDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(d.endDate);
  const timeOk = (t: string) => t === "" || /^\d{2}:\d{2}$/.test(t);
  return Boolean(d.title) && dateOk && endDateOk && timeOk(d.startTime) && timeOk(d.endTime);
}
