"use client";
// トップページ: 左にチャット、右にカレンダー
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ChatPanel from "@/components/ChatPanel";
import type { CalendarEvent } from "@/lib/types";

// カレンダーは「今日の日付」を使うので、サーバーでは描画せずブラウザだけで描画する
const CalendarView = dynamic(() => import("@/components/CalendarView"), {
  ssr: false,
  loading: () => <p>カレンダーを読み込み中…</p>,
});

export default function Home() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data: CalendarEvent[]) => setEvents(data))
      .catch(console.error);
  }, []);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (res.ok) setEvents((list) => list.filter((e) => e.id !== id));
  }

  return (
    <main className="layout">
      <section className="pane chat-pane">
        <h1>📅 スケジュールチャット</h1>
        <ChatPanel onAdded={(created) => setEvents((list) => [...list, ...created])} />
      </section>
      <section className="pane calendar-pane">
        <CalendarView events={events} onDelete={handleDelete} />
      </section>
    </main>
  );
}
