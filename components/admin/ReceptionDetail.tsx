"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Reception } from "@/lib/types";

const FALLBACK_STATUSES = [
  "受付中",
  "受付済み",
  "見積中",
  "連絡待ち",
  "パーツ発注中",
  "修理中",
  "修理完了",
  "申込書発行済",
  "来店予定",
  "返却済み",
  "キャンセル",
];

const editable: [keyof Reception, string][] = [
  ["customerName", "お名前"],
  ["customerKana", "フリガナ"],
  ["completeTel", "連絡先"],
  ["deviceTel", "依頼端末の電話番号"],
  ["birthdate", "生年月日"],
  ["homeTel", "自宅電話"],
  ["mobileTel", "携帯電話"],
  ["email", "メールアドレス"],
  ["occupation", "職業"],
  ["address", "住所"],
  ["idDocuments", "本人確認書類"],
  ["deviceCategory", "端末カテゴリ"],
  ["deviceModel", "機種名"],
  ["imei", "IMEI / シリアル"],
  ["symptom", "症状"],
  ["repairContent", "修理内容"],
  ["repairPrice", "修理料金"],
  ["cost", "原価"],
  ["repairCategory", "修理カテゴリ"],
  ["panelType", "パネル種別"],
  ["smallPartsType", "スモールパーツ種別"],
  ["waterproofTape", "防水テープ施工"],
  ["warrantyStatus", "保証有無"],
  ["paymentMethod", "決済方法"],
  ["coating", "コーティング"],
  ["temperedGlass", "強化ガラス"],
  ["repairHistory", "過去の修理歴"],
  ["passcode", "パスコード"],
  ["returnPlanDate", "来店予定日"],
  ["returnDate", "返却日"],
  ["internalMemo", "店舗内メモ"],
  ["notes", "追記事項"],
  ["devicesJson", "端末データJSON"],
];

export default function ReceptionDetail({ initial }: { initial: Reception }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [statuses, setStatuses] = useState(FALLBACK_STATUSES);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/status")
      .then((response) => response.json())
      .then((body) => {
        if (body.ok && Array.isArray(body.data) && body.data.length > 0) setStatuses(body.data);
      })
      .catch(() => undefined);
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/reception/${encodeURIComponent(form.receptionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
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
        <label>
          <span className="label">ステータス</span>
          <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        {editable.map(([name, label]) => {
          const multiline = ["symptom", "repairContent", "internalMemo", "notes", "devicesJson"].includes(name);
          return (
            <label className={multiline ? "sm:col-span-2" : undefined} key={name}>
              <span className="label">{label}</span>
              {multiline ? (
                <textarea className="input min-h-24" value={String(form[name] ?? "")} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
              ) : (
                <input className="input" value={String(form[name] ?? "")} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
              )}
            </label>
          );
        })}
      </div>
      {message && <p className="font-bold text-green-700">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="button" type="submit">
          変更を保存
        </button>
        <a className="button-secondary" href={`/admin/${encodeURIComponent(form.storeName)}/${encodeURIComponent(form.receptionId)}/print`} target="_blank">
          申込書を印刷
        </a>
        <button className="rounded-lg border border-red-300 bg-white px-4 py-3 font-bold text-red-700" type="button" onClick={remove}>
          削除
        </button>
      </div>
    </form>
  );
}
