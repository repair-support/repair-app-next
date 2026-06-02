import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "修理受付アプリ",
  description: "店舗向け修理受付管理",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
