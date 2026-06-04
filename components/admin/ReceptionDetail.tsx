"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { statusStyle } from "@/lib/status-style";
import { DEFAULT_STATUS_LISTS, statusOptionsForService } from "@/lib/status-options";
import { CostOption, CostReferenceData, Reception } from "@/lib/types";

const editable: [keyof Reception, string][] = [
  ["staffName", "受付担当"],
  ["repairStaff", "修理担当者"],
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
  ["purchaseAgreement", "買取承諾"],
  ["color", "色"],
  ["carrier", "キャリア"],
  ["simLock", "SIMロック"],
  ["capacity", "容量"],
  ["usageRestriction", "利用制限"],
  ["rank", "ランク"],
  ["repairParts", "修理箇所"],
  ["btLevel", "BT残量"],
  ["accessories", "付属品"],
  ["itemCount", "品目数"],
  ["assessStaff", "査定員"],
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
  const [costReference, setCostReference] = useState<CostReferenceData | null>(null);
  const [statusLists, setStatusLists] = useState(DEFAULT_STATUS_LISTS);
  const [staffOptions, setStaffOptions] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const canPrint = form.status === "申込書発行済" || form.status === "返却済み" || form.serviceType.includes("買取");

  useEffect(() => {
    fetch("/api/status?mode=lists")
      .then((response) => response.json())
      .then((body) => {
        if (body.ok && body.data?.repair?.length && body.data?.purchase?.length) setStatusLists(body.data);
      })
      .catch(() => undefined);
    fetch("/api/cost-reference")
      .then((response) => response.json())
      .then((body) => {
        if (body.ok) setCostReference(body.data);
      })
      .catch(() => undefined);
    fetch(`/api/staff?store=${encodeURIComponent(initial.storeName)}`)
      .then((response) => response.json())
      .then((body) => {
        if (body.ok && Array.isArray(body.data)) setStaffOptions(body.data);
      })
      .catch(() => undefined);
  }, [initial.storeName]);

  const costOptions = useMemo(() => {
    if (!costReference || !form.deviceModel) return [];
    const costs = costReference.modelCosts[form.deviceModel];
    if (!costs) return [];
    return [...costs.screen, ...costs.battery, ...costs.small, ...costs.glass, ...costs.other];
  }, [costReference, form.deviceModel]);

  const statuses = useMemo(() => statusOptionsForService(statusLists, form.serviceType, form.status), [form.serviceType, form.status, statusLists]);

  const suggestedCost = useMemo(() => {
    if (!costReference || !form.deviceModel) return null;
    const costs = costReference.modelCosts[form.deviceModel];
    if (!costs) return null;
    const repairText = `${form.repairContent ?? ""} ${form.panelType ?? ""} ${form.smallPartsType ?? ""}`;
    const all = [...costs.screen, ...costs.battery, ...costs.small, ...costs.glass, ...costs.other];
    const exact = all.find((option) => repairText.includes(option.label) || repairText.includes(option.type));
    if (exact) return exact;
    if (/画面|液晶|パネル|有機EL|OLED/i.test(repairText)) return costs.screen[0] ?? null;
    if (/バッテリー|電池|BT/i.test(repairText)) return costs.battery[0] ?? null;
    if (/強化ガラス|保護ガラス|ガラスコーティング|コーティング/i.test(repairText)) return costs.glass[0] ?? null;
    if (/スモール|パーツ|カメラ|スピーカー|コネクタ|ボタン|ドック/i.test(repairText)) return costs.small[0] ?? null;
    return null;
  }, [costReference, form.deviceModel, form.panelType, form.repairContent, form.smallPartsType]);

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
        <label className="sm:col-span-2">
          <span className="label">ステータス</span>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-block rounded-full border px-3 py-1 text-sm font-bold" style={statusStyle(form.status)}>
              {form.status || "未設定"}
            </span>
            <select className="input max-w-sm font-bold" style={statusStyle(form.status)} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            </select>
          </div>
        </label>
        {editable.map(([name, label]) => {
          const multiline = ["symptom", "repairContent", "internalMemo", "notes", "accessories", "devicesJson"].includes(name);
          return (
            <label className={multiline ? "sm:col-span-2" : undefined} key={name}>
              <span className="label">{label}</span>
              {["staffName", "repairStaff", "assessStaff"].includes(name) ? (
                <select className="input" value={String(form[name] ?? "")} onChange={(event) => setForm({ ...form, [name]: event.target.value })}>
                  <option value="">未設定</option>
                  {staffOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : multiline ? (
                <textarea className="input min-h-24" value={String(form[name] ?? "")} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
              ) : (
                <input className="input" value={String(form[name] ?? "")} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
              )}
            </label>
          );
        })}
        {costOptions.length > 0 && (
          <section className="sm:col-span-2 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">原価候補</p>
                {suggestedCost && <p className="mt-1 text-xs text-slate-600">推定: {suggestedCost.label} / {suggestedCost.cost.toLocaleString()}円</p>}
              </div>
              {suggestedCost && (
                <button className="button-secondary" type="button" onClick={() => setForm({ ...form, cost: String(suggestedCost.cost) })}>
                  推定原価を反映
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {costOptions.slice(0, 16).map((option: CostOption) => (
                <button
                  className="rounded-full border bg-white px-3 py-1 text-xs font-bold"
                  key={`${option.type}-${option.label}-${option.cost}`}
                  type="button"
                  onClick={() => setForm({ ...form, cost: String(option.cost) })}
                >
                  {option.label}: {option.cost.toLocaleString()}円
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      {message && <p className="font-bold text-green-700">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="button" type="submit">
          変更を保存
        </button>
        {canPrint ? (
          <a className="button-secondary" href={`/admin/${encodeURIComponent(form.storeName)}/${encodeURIComponent(form.receptionId)}/print`} target="_blank">
            申込書を印刷
          </a>
        ) : (
          <button className="button-secondary" type="button" onClick={() => setMessage("申込書はステータスが「申込書発行済」または「返却済み」の場合に印刷できます。")}>
            申込書を印刷
          </button>
        )}
        <button className="rounded-lg border border-red-300 bg-white px-4 py-3 font-bold text-red-700" type="button" onClick={remove}>
          削除
        </button>
      </div>
    </form>
  );
}
