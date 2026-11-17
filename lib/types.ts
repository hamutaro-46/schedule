// ============================================================
// 型定義
// AI が返す「下書き」と、保存済みの「イベント」を分けておくと、
// 「AIの提案 → ユーザーが確認 → 保存」という流れが作りやすくなる。
// ============================================================

/** AI が写真やテキストから読み取った予定の下書き */
export type EventDraft = {
  title: string;
  /** 開始日 YYYY-MM-DD */
  date: string;
  /** 終了日 YYYY-MM-DD（同じ日なら空文字） */
  endDate: string;
  /** 開始時刻 HH:mm（終日なら空文字） */
  startTime: string;
  /** 終了時刻 HH:mm（不明なら空文字） */
  endTime: string;
  allDay: boolean;
  location: string;
  notes: string;
};

/** カレンダーに保存されたイベント（FullCalendar にそのまま渡せる形） */
export type CalendarEvent = {
  id: string;
  title: string;
  /** 終日: YYYY-MM-DD / 時間指定: YYYY-MM-DDTHH:mm:00（ローカル時刻） */
  start: string;
  end?: string;
  allDay: boolean;
  location: string;
  notes: string;
  createdAt: string;
};

export type NewEvent = Omit<CalendarEvent, "id" | "createdAt">;

/** /api/extract のレスポンス */
export type ExtractResponse = {
  reply: string;
  events: EventDraft[];
};

/** YYYY-MM-DD に日数を足す（タイムゾーンの影響を受けないよう UTC で計算） */
function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** 下書き → 保存用イベントに変換 */
export function draftToEvent(d: EventDraft): NewEvent {
  const isAllDay = d.allDay || !d.startTime;
  const lastDate = d.endDate || d.date;

  if (isAllDay) {
    return {
      title: d.title,
      start: d.date,
      // FullCalendar の終日イベントの end は「その日を含まない」ので +1 日する
      end: addDays(lastDate, 1),
      allDay: true,
      location: d.location,
      notes: d.notes,
    };
  }

  return {
    title: d.title,
    start: `${d.date}T${d.startTime}:00`,
    end: d.endTime ? `${lastDate}T${d.endTime}:00` : undefined,
    allDay: false,
    location: d.location,
    notes: d.notes,
  };
}
