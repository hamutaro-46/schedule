"use client";
// カレンダー表示（FullCalendar v7）
import FullCalendar from "@fullcalendar/react";
import themePlugin from "@fullcalendar/react/themes/classic";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import jaLocale from "@fullcalendar/react/locales/ja";

import "@fullcalendar/react/skeleton.css"; // 必須
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";

import type { CalendarEvent } from "@/lib/types";

type Props = {
  events: CalendarEvent[];
  onDelete: (id: string) => void;
};

export default function CalendarView({ events, onDelete }: Props) {
  return (
    <FullCalendar
      plugins={[themePlugin, dayGridPlugin, timeGridPlugin]}
      initialView="dayGridMonth"
      locale={jaLocale}
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      }}
      height="100%"
      events={events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        extendedProps: { location: e.location, notes: e.notes },
      }))}
      eventClick={(info) => {
        const { location, notes } = info.event.extendedProps as { location: string; notes: string };
        const detail = [info.event.title, location && `場所: ${location}`, notes && `メモ: ${notes}`]
          .filter(Boolean)
          .join("\n");
        if (window.confirm(`${detail}\n\nこの予定を削除しますか？`)) onDelete(info.event.id);
      }}
    />
  );
}
