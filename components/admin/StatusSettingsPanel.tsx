"use client";

import { useEffect, useMemo, useState } from "react";
import { statusStyle } from "@/lib/status-style";

type StatusLists = {
  repair: string[];
  purchase: string[];
};

function linesToStatuses(value: string) {
  return Array.from(new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)));
}

function StatusPreview({ title, text }: { title: string; text: string }) {
  const statuses = useMemo(() => linesToStatuses(text), [text]);
  return (
    <div className="mt-3">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {statuses.map((status) => (
          <span className="rounded-full border px-2 py-1 text-xs font-bold" key={status} style={statusStyle(status)}>
            {status}
          </span>
        ))}
        {statuses.length === 0 && <span className="text-xs text-slate-500">未入力</span>}
      </div>
    </div>
  );
}

export default function StatusSettingsPanel() {
  const [repairText, setRepairText] = useState("");
  const [purchaseText, setPurchaseText] = useState("");
  const [message, setMessage] = useState("読み込み中...");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch("/api/status?mode=lists")
      .then((response) => response.json())
      .then((body) => {
        if (!body.ok) throw new Error(body.error ?? "ステータス設定を取得できませんでした");
        const data = body.data as StatusLists;
        setRepairText(data.repair.join("\n"));
        setPurchaseText(data.purchase.join("\n"));
        setMessage("");
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "ステータス設定を取得できませんでした");
      });
  }, []);

  async function save() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repairStatuses: linesToStatuses(repairText),
          purchaseStatuses: linesToStatuses(purchaseText),
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "ステータス設定を保存できませんでした");
      const data = body.data as StatusLists;
      setRepairText(data.repair.join("\n"));
      setPurchaseText(data.purchase.join("\n"));
      setMessage("ステータス設定を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ステータス設定を保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">ステータス管理</h2>
      <p className="mt-1 text-sm text-slate-600">
        修理受付と買取受付のステータス候補を別々に管理します。1行につき1ステータスで入力してください。
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-bold" htmlFor="repair-statuses">修理ステータス</label>
          <textarea
            className="input mt-2 min-h-48"
            id="repair-statuses"
            value={repairText}
            onChange={(event) => setRepairText(event.target.value)}
          />
          <StatusPreview text={repairText} title="修理ステータス表示" />
        </div>

        <div>
          <label className="text-sm font-bold" htmlFor="purchase-statuses">買取ステータス</label>
          <textarea
            className="input mt-2 min-h-48"
            id="purchase-statuses"
            value={purchaseText}
            onChange={(event) => setPurchaseText(event.target.value)}
          />
          <StatusPreview text={purchaseText} title="買取ステータス表示" />
        </div>
      </div>

      <button className="button mt-4 disabled:opacity-50" disabled={pending} type="button" onClick={save}>
        {pending ? "保存中..." : "ステータス設定を保存"}
      </button>
      {message && <p className="mt-3 text-sm font-bold">{message}</p>}
    </section>
  );
}
