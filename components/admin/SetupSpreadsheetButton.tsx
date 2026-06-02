"use client";

import { useState } from "react";

export default function SetupSpreadsheetButton() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function setup() {
    if (!confirm("Google Sheetsの初期セットアップを実行しますか？")) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/setup", { method: "POST" });
      const body = await response.json();
      setMessage(body.ok ? "スプレッドシートをセットアップしました。" : body.error ?? "セットアップに失敗しました。");
    } catch {
      setMessage("セットアップに失敗しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <p className="font-bold">初回セットアップ</p>
      <p className="mt-1 text-sm text-slate-600">最初のログイン後に一度実行してください。再実行しても受付IDの連番は保持されます。</p>
      <button className="button mt-3 disabled:opacity-50" type="button" disabled={pending} onClick={setup}>
        {pending ? "セットアップ中..." : "Google Sheetsをセットアップ"}
      </button>
      {message && <p className="mt-3 text-sm font-bold">{message}</p>}
    </div>
  );
}
