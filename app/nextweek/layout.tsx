import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "次週タスクボード",
  description: "週次ログから次週タスクだけを抽出して並べ替える個人用ボード",
  icons: {
    icon: "/nextweek-icon.svg",
    shortcut: "/nextweek-icon.svg",
    apple: "/nextweek-icon.svg",
  },
};

export default function NextweekLayout({ children }: { children: React.ReactNode }) {
  return children;
}
