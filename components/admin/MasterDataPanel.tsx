"use client";

import { useEffect, useMemo, useState } from "react";
import type { MasterData } from "@/lib/types";

const emptyMaster: MasterData = { categories: [], deviceMap: {}, repairMap: {}, modelRepairMap: {} };

export default function MasterDataPanel() {
  const [master, setMaster] = useState<MasterData>(emptyMaster);
  const [category, setCategory] = useState("");
  const [model, setModel] = useState("");
  const [repairModel, setRepairModel] = useState("");
  const [repair, setRepair] = useState("");
  const [message, setMessage] = useState("読み込み中...");
  const [pending, setPending] = useState(false);

  const allModels = useMemo(() => {
    return Array.from(new Set(Object.values(master.deviceMap).flat())).sort();
  }, [master.deviceMap]);

  async function load() {
    const response = await fetch("/api/master");
    const body = await response.json();
    if (!body.ok) throw new Error(body.error ?? "マスターデータを取得できませんでした");
    setMaster(body.data);
    setMessage("");
  }

  useEffect(() => {
    load().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "マスターデータを取得できませんでした");
    });
  }, []);

  async function post(action: "addModel" | "addRepair", payload: Record<string, string>) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "保存できませんでした");
      setMaster(body.data);
      setMessage("マスターデータを更新しました。");
      if (action === "addModel") setModel("");
      if (action === "addRepair") setRepair("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">マスターデータ管理</h2>
      <p className="mt-1 text-sm text-slate-600">受付フォームの端末カテゴリ・機種名・修理内容候補を追加します。</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="font-bold">機種を追加</p>
          <input className="input mt-2" list="master-category-options" placeholder="カテゴリ" value={category} onChange={(event) => setCategory(event.target.value)} />
          <datalist id="master-category-options">
            {master.categories.map((item) => <option key={item} value={item} />)}
          </datalist>
          <input className="input mt-2" placeholder="機種名" value={model} onChange={(event) => setModel(event.target.value)} />
          <button className="button mt-2 disabled:opacity-50" disabled={pending} type="button" onClick={() => post("addModel", { category, model })}>
            機種を追加
          </button>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="font-bold">修理内容を追加</p>
          <input className="input mt-2" list="master-model-options" placeholder="機種名" value={repairModel} onChange={(event) => setRepairModel(event.target.value)} />
          <datalist id="master-model-options">
            {allModels.map((item) => <option key={item} value={item} />)}
          </datalist>
          <input className="input mt-2" placeholder="修理内容" value={repair} onChange={(event) => setRepair(event.target.value)} />
          <button className="button mt-2 disabled:opacity-50" disabled={pending} type="button" onClick={() => post("addRepair", { model: repairModel, repair })}>
            修理内容を追加
          </button>
        </div>
      </div>

      {message && <p className="mt-3 text-sm font-bold">{message}</p>}
    </section>
  );
}
