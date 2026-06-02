"use client";

import { FormEvent, useEffect, useState } from "react";
import { DEFAULT_STATUSES } from "@/lib/constants";

export default function PublicUpdateForm({ id, token }: { id: string; token: string }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("読み込み中...");
  const endpoint = `/api/public/reception/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`;
  useEffect(() => {
    fetch(endpoint).then((response) => response.json()).then((body) => {
      if (!body.ok) return setMessage(body.error);
      setForm(body.data);
      setMessage("");
    });
  }, [endpoint]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = await response.json();
    setMessage(body.ok ? "更新しました。" : body.error);
  }
  return (
    <form className="card mx-auto max-w-lg space-y-4" onSubmit={submit}>
      <h1 className="text-2xl font-bold">修理状況更新</h1>
      <p className="text-sm text-slate-600">受付ID: {id}</p>
      {message && <p className="rounded-lg bg-slate-100 p-3 text-sm font-bold">{message}</p>}
      <label><span className="label">ステータス</span><select className="input" value={form.status ?? ""} onChange={(e) => setForm({ ...form, status: e.target.value })}>{DEFAULT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label><span className="label">返却日時</span><input className="input" type="datetime-local" value={form.returnDate ?? ""} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} /></label>
      {["waterproofTape:防水テープ施工", "coating:コーティング", "temperedGlass:強化ガラス"].map((item) => {
        const [name, label] = item.split(":");
        return <label key={name}><span className="label">{label}</span><select className="input" value={form[name] ?? ""} onChange={(e) => setForm({ ...form, [name]: e.target.value })}><option value="">未選択</option><option>あり</option><option>なし</option></select></label>;
      })}
      <button className="button w-full" type="submit">更新する</button>
    </form>
  );
}
