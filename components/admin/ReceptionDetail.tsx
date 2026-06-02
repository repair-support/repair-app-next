"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_STATUSES } from "@/lib/constants";
import { Reception } from "@/lib/types";

const editable: [keyof Reception, string][] = [
  ["customerName", "お名前"], ["customerKana", "フリガナ"], ["completeTel", "連絡先"],
  ["deviceCategory", "端末カテゴリ"], ["deviceModel", "機種名"], ["imei", "IMEI"],
  ["symptom", "症状"], ["repairContent", "修理内容"], ["repairPrice", "修理料金"],
  ["cost", "原価"], ["internalMemo", "店舗内メモ"], ["returnDate", "返却日"],
];

export default function ReceptionDetail({ initial }: { initial: Reception }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/reception/${encodeURIComponent(form.receptionId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setMessage(response.ok ? "保存しました。" : "保存できませんでした。");
  }
  async function remove() {
    if (!confirm("この受付を削除しますか？")) return;
    const response = await fetch(`/api/reception/${encodeURIComponent(form.receptionId)}?store=${encodeURIComponent(form.storeName)}`, { method: "DELETE" });
    if (response.ok) router.push(`/admin/${encodeURIComponent(form.storeName)}`);
  }
  return (
    <form className="space-y-5" onSubmit={save}>
      <div className="card grid gap-4 sm:grid-cols-2">
        <label><span className="label">ステータス</span><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{DEFAULT_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
        {editable.map(([name, label]) => <label key={name}><span className="label">{label}</span><input className="input" value={String(form[name] ?? "")} onChange={(e) => setForm({ ...form, [name]: e.target.value })} /></label>)}
      </div>
      {message && <p className="font-bold text-green-700">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="button" type="submit">変更を保存</button>
        <a className="button-secondary" href={`/admin/${encodeURIComponent(form.storeName)}/${encodeURIComponent(form.receptionId)}/print`} target="_blank">申込書を印刷</a>
        <button className="rounded-lg border border-red-300 bg-white px-4 py-3 font-bold text-red-700" type="button" onClick={remove}>削除</button>
      </div>
    </form>
  );
}
