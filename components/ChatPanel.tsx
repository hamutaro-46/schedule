"use client";
// ============================================================
// チャット画面
// - テキスト入力 / 画像の選択・貼り付け（Ctrl+V）・ドラッグ&ドロップ
// - AI が読み取った予定を「下書きカード」で表示し、確認してから追加
// ============================================================
import { useMemo, useRef, useState } from "react";
import type { CalendarEvent, EventDraft, ExtractResponse } from "@/lib/types";

type Message =
  | { role: "user"; text: string; imageUrl?: string }
  | { role: "assistant"; text: string; drafts: EventDraft[]; added: boolean[] }
  | { role: "error"; text: string };

type Props = {
  onAdded: (events: CalendarEvent[]) => void;
};

export default function ChatPanel({ onAdded }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "予定の写真を送るか、「明日15時から渋谷で打ち合わせ」のように書いてください。",
      drafts: [],
      added: [],
    },
  ]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // 添付プレビュー用のURL（画像が変わったときだけ作り直す）
  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : ""), [image]);

  const scrollToBottom = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

  // ---- 送信 ------------------------------------------------
  async function send() {
    if (loading || (!text.trim() && !image)) return;

    const userMsg: Message = {
      role: "user",
      text,
      imageUrl: image ? URL.createObjectURL(image) : undefined,
    };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    scrollToBottom();

    const form = new FormData();
    form.append("text", text);
    if (image) form.append("image", image);
    setText("");
    setImage(null);

    try {
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "エラーが発生しました");
      const result = data as ExtractResponse;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: result.reply,
          drafts: result.events,
          added: result.events.map(() => false),
        },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", text: (e as Error).message }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  // ---- 下書きをカレンダーに追加 ------------------------------
  async function addDrafts(msgIndex: number, draftIndexes: number[]) {
    const msg = messages[msgIndex];
    if (msg.role !== "assistant") return;
    const targets = draftIndexes.filter((i) => !msg.added[i]);
    if (targets.length === 0) return;

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drafts: targets.map((i) => msg.drafts[i]) }),
    });
    if (!res.ok) {
      setMessages((m) => [...m, { role: "error", text: "カレンダーへの追加に失敗しました" }]);
      return;
    }
    const created = (await res.json()) as CalendarEvent[];
    onAdded(created);

    setMessages((m) =>
      m.map((x, i) =>
        i === msgIndex && x.role === "assistant"
          ? { ...x, added: x.added.map((a, j) => a || targets.includes(j)) }
          : x,
      ),
    );
  }

  // ---- 画像の受け取り（選択 / 貼り付け / ドロップ） -----------
  function pickImage(file: File | undefined | null) {
    if (file && file.type.startsWith("image/")) setImage(file);
  }

  return (
    <div
      className="chat"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        pickImage(e.dataTransfer.files[0]);
      }}
    >
      <div className="chat-log">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === "user" && m.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.imageUrl} alt="送信した画像" className="bubble-image" />
            )}
            {m.text && <p>{m.text}</p>}

            {m.role === "assistant" && m.drafts.length > 0 && (
              <div className="drafts">
                {m.drafts.map((d, j) => (
                  <div key={j} className="draft">
                    <div className="draft-title">{d.title}</div>
                    <div className="draft-meta">{formatDraft(d)}</div>
                    {d.location && <div className="draft-meta">📍 {d.location}</div>}
                    {d.notes && <div className="draft-meta">📝 {d.notes}</div>}
                    <button disabled={m.added[j]} onClick={() => addDrafts(i, [j])}>
                      {m.added[j] ? "追加済み ✓" : "カレンダーに追加"}
                    </button>
                  </div>
                ))}
                {m.drafts.length > 1 && (
                  <button
                    className="add-all"
                    disabled={m.added.every(Boolean)}
                    onClick={() => addDrafts(i, m.drafts.map((_, j) => j))}
                  >
                    すべて追加
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="bubble assistant">読み取り中…</div>}
        <div ref={bottomRef} />
      </div>

      {image && (
        <div className="preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="添付画像" />
          <button onClick={() => setImage(null)}>×</button>
        </div>
      )}

      <div className="composer">
        <button className="attach" onClick={() => fileInput.current?.click()} title="画像を添付">
          📷
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          hidden
          onChange={(e) => {
            pickImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <textarea
          value={text}
          placeholder="例: 来週火曜の19時から歓迎会（新宿）"
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const item = Array.from(e.clipboardData.items).find((x) => x.type.startsWith("image/"));
            if (item) pickImage(item.getAsFile());
          }}
          onKeyDown={(e) => {
            // Enter で送信、Shift+Enter で改行。日本語変換の確定 Enter では送信しない
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
        />
        <button className="send" onClick={send} disabled={loading}>
          送信
        </button>
      </div>
    </div>
  );
}

function formatDraft(d: EventDraft): string {
  const range = d.endDate && d.endDate !== d.date ? `${d.date} 〜 ${d.endDate}` : d.date;
  if (d.allDay || !d.startTime) return `🗓 ${range}（終日）`;
  return `🗓 ${range} ${d.startTime}${d.endTime ? `〜${d.endTime}` : ""}`;
}
