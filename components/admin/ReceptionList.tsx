"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { statusCardStyle, statusStyle } from "@/lib/status-style";
import { combinedStatusOptions, DEFAULT_STATUS_LISTS, statusOptionsForService } from "@/lib/status-options";
import { Reception } from "@/lib/types";

export default function ReceptionList({ initial, store }: { initial: Reception[]; store: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [statusLists, setStatusLists] = useState(DEFAULT_STATUS_LISTS);
  const [staffOptions, setStaffOptions] = useState<string[]>([]);
  const [staffName, setStaffName] = useState("");

  useEffect(() => {
    fetch("/api/status?mode=lists")
      .then((response) => response.json())
      .then((body) => {
        if (body.ok && body.data?.repair?.length && body.data?.purchase?.length) setStatusLists(body.data);
      })
      .catch(() => undefined);
    fetch(`/api/staff?store=${encodeURIComponent(store)}`)
      .then((response) => response.json())
      .then((body) => {
        if (body.ok && Array.isArray(body.data)) {
          setStaffOptions(body.data);
          setStaffName((current) => current || body.data[0] || "");
        }
      })
      .catch(() => undefined);
  }, [store]);

  const filtered = useMemo(() => {
    const keyword = q.toLowerCase();
    return items.filter((item) => {
      const text = `${item.receptionId} ${item.customerName} ${item.customerKana} ${item.deviceModel} ${item.completeTel}`.toLowerCase();
      return (!status || item.status === status) && text.includes(keyword);
    });
  }, [items, q, status]);

  const statuses = useMemo(() => combinedStatusOptions(statusLists), [statusLists]);

  async function changeStatus(item: Reception, next: string) {
    const response = await fetch(`/api/reception/${encodeURIComponent(item.receptionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeName: store, status: next }),
    });
    if (response.ok) {
      setItems((current) => current.map((value) => (value.receptionId === item.receptionId ? { ...value, status: next } : value)));
    }
  }

  async function createReception() {
    const response = await fetch("/api/reception", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeName: store, serviceType: "修理受付", staffName }),
    });
    const body = await response.json();
    if (body.ok) router.push(`/admin/${encodeURIComponent(store)}/${encodeURIComponent(body.receptionId)}`);
  }

  return (
    <>
      <button className="button mb-4" type="button" onClick={createReception}>
        新規受付を作成
      </button>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <input className="input" placeholder="受付ID・お名前・機種・電話番号で検索" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">全ステータス</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select className="input" value={staffName} onChange={(event) => setStaffName(event.target.value)}>
          <option value="">受付担当未設定</option>
          {staffOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-3">
        {filtered.map((item) => (
          <article className="card border-l-8" key={item.receptionId} style={statusCardStyle(item.status)}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link className="font-bold text-blue-700" href={`/admin/${encodeURIComponent(store)}/${encodeURIComponent(item.receptionId)}`}>
                  {item.receptionId} {item.customerName || "お名前未入力"}
                </Link>
                <span className="ml-2 inline-block rounded-full border px-2 py-0.5 text-xs font-bold" style={statusStyle(item.status)}>
                  {item.status || "未設定"}
                </span>
              </div>
              <select className="rounded-lg border px-2 py-1 text-sm font-bold" style={statusStyle(item.status)} value={item.status} onChange={(event) => changeStatus(item, event.target.value)}>
                {statusOptionsForService(statusLists, item.serviceType, item.status).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {item.receptionDate} / {item.deviceCategory} {item.deviceModel}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
