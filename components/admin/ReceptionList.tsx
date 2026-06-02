"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_STATUSES } from "@/lib/constants";
import { Reception } from "@/lib/types";

export default function ReceptionList({ initial, store }: { initial: Reception[]; store: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const filtered = useMemo(() => items.filter((item) => (!status || item.status === status) && `${item.receptionId} ${item.customerName}`.toLowerCase().includes(q.toLowerCase())), [items, q, status]);
  async function changeStatus(item: Reception, next: string) {
    const response = await fetch(`/api/reception/${encodeURIComponent(item.receptionId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeName: store, status: next }) });
    if (response.ok) setItems((current) => current.map((value) => value.receptionId === item.receptionId ? { ...value, status: next } : value));
  }
  async function createReception() {
    const response = await fetch("/api/reception", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeName: store, serviceType: "修理受付", staffName: "スタッフ" }) });
    const body = await response.json();
    if (body.ok) router.push(`/admin/${encodeURIComponent(store)}/${encodeURIComponent(body.receptionId)}`);
  }
  return (
    <>
      <button className="button mb-4" type="button" onClick={createReception}>新規受付を作成</button>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <input className="input" placeholder="受付ID・お名前で検索" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">全ステータス</option>{DEFAULT_STATUSES.map((value) => <option key={value}>{value}</option>)}</select>
      </div>
      <div className="space-y-3">
        {filtered.map((item) => <article className="card" key={item.receptionId}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Link className="font-bold text-blue-700" href={`/admin/${encodeURIComponent(store)}/${encodeURIComponent(item.receptionId)}`}>{item.receptionId} {item.customerName || "お名前未入力"}</Link>
            <select className="rounded-lg border px-2 py-1 text-sm" value={item.status} onChange={(e) => changeStatus(item, e.target.value)}>{DEFAULT_STATUSES.map((value) => <option key={value}>{value}</option>)}</select>
          </div>
          <p className="mt-2 text-sm text-slate-600">{item.receptionDate} / {item.deviceCategory} {item.deviceModel}</p>
        </article>)}
      </div>
    </>
  );
}
