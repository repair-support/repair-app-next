"use client";

import { useEffect, useState } from "react";

type CustomerManagementLink = {
  storeName: string;
  month: string;
  spreadsheetId: string;
  url: string;
  updatedAt: string;
};

function formatUpdatedAt(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export default function CustomerManagementLinks() {
  const [links, setLinks] = useState<CustomerManagementLink[]>([]);
  const [message, setMessage] = useState("読み込み中...");

  useEffect(() => {
    let active = true;
    fetch("/api/customer-management")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "顧客管理表一覧の取得に失敗しました");
        return body.links as CustomerManagementLink[];
      })
      .then((nextLinks) => {
        if (!active) return;
        setLinks(nextLinks);
        setMessage(nextLinks.length ? "" : "まだ月別顧客管理表は作成されていません。受付を保存すると自動作成されます。");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "顧客管理表一覧の取得に失敗しました");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">月別顧客管理表</h2>
      <p className="mt-1 text-sm text-slate-600">店舗・年月ごとに自動作成された顧客管理表へのリンクです。</p>
      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
      {links.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">店舗</th>
                <th className="py-2 pr-4">年月</th>
                <th className="py-2 pr-4">更新日時</th>
                <th className="py-2 pr-4">リンク</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr className="border-b last:border-b-0" key={`${link.storeName}-${link.month}-${link.spreadsheetId}`}>
                  <td className="py-2 pr-4 font-medium">{link.storeName}</td>
                  <td className="py-2 pr-4">{link.month}</td>
                  <td className="py-2 pr-4">{formatUpdatedAt(link.updatedAt)}</td>
                  <td className="py-2 pr-4">
                    <a className="text-blue-600 underline" href={link.url} target="_blank" rel="noreferrer">
                      開く
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
