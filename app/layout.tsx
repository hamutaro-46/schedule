import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "スケジュールチャット",
  description: "写真やメッセージから予定をカレンダーに登録",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
