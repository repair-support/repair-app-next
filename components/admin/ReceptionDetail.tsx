"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { statusStyle } from "@/lib/status-style";
import { DEFAULT_STATUS_LISTS, returnedStatusFromLists, statusOptionsForService } from "@/lib/status-options";
import { CostOption, CostReferenceData, Device, Reception } from "@/lib/types";

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
];

const EMPTY_DEVICE: Device = {
  category: "",
  model: "",
  imei: "",
  symptom: "",
  repairContent: "",
  repairPrice: "",
  cost: "",
};

function devicesFromReception(reception: Reception): Device[] {
  try {
    const parsed = JSON.parse(reception.devicesJson || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((device) => ({ ...EMPTY_DEVICE, ...device }));
    }
  } catch {
    // Fall back to the main reception fields below.
  }
  return [{
    category: reception.deviceCategory,
    model: reception.deviceModel,
    imei: reception.imei,
    symptom: reception.symptom,
    repairContent: reception.repairContent,
    repairPrice: reception.repairPrice,
    cost: reception.cost,
  }];
}

export default function ReceptionDetail({ initial }: { initial: Reception }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [devices, setDevices] = useState<Device[]>(() => devicesFromReception(initial));
  const [returnDate, setReturnDate] = useState(toDatetimeLocal(initial.returnDate) || toDatetimeLocal(new Date().toISOString()));
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [costReference, setCostReference] = useState<CostReferenceData | null>(null);
  const [statusLists, setStatusLists] = useState(DEFAULT_STATUS_LISTS);
  const [staffOptions, setStaffOptions] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [returnPending, setReturnPending] = useState(false);
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
  const isPurchase = form.serviceType.includes("買取");

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
    const normalized = normalizeReceptionDevices(form, devices);
    const response = await fetch(`/api/reception/${encodeURIComponent(form.receptionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
    });
    if (response.ok) setForm(normalized);
    setMessage(response.ok ? "保存しました。" : "保存できませんでした。");
  }

  async function remove() {
    if (!confirm("この受付を削除しますか？")) return;
    const response = await fetch(`/api/reception/${encodeURIComponent(form.receptionId)}?store=${encodeURIComponent(form.storeName)}`, { method: "DELETE" });
    if (response.ok) router.push(`/admin/${encodeURIComponent(form.storeName)}`);
  }

  async function confirmReturnAndPrint() {
    setReturnPending(true);
    setMessage("");
    try {
      const next = {
        ...normalizeReceptionDevices(form, devices),
        status: returnedStatusFromLists(statusLists, form.serviceType),
        returnDate: returnDate ? new Date(returnDate).toISOString() : new Date().toISOString(),
      };
      const response = await fetch(`/api/reception/${encodeURIComponent(form.receptionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error("返却更新に失敗しました。");
      setForm(next);
      setShowReturnModal(false);
      setMessage("返却済みに更新しました。印刷画面を開きます。");
      window.open(`/admin/${encodeURIComponent(form.storeName)}/${encodeURIComponent(form.receptionId)}/print`, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "返却更新に失敗しました。");
    } finally {
      setReturnPending(false);
    }
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
        <section className="sm:col-span-2 rounded-xl border bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">端末情報</h2>
              <p className="text-sm text-slate-600">複数台の端末情報をここで編集します。保存時にメイン項目と端末データJSONへ反映します。</p>
            </div>
            <button className="button-secondary" type="button" onClick={() => setDevices((current) => [...current, { ...EMPTY_DEVICE }])}>
              端末を追加
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {devices.map((device, index) => (
              <DeviceEditor
                device={device}
                index={index}
                isPurchase={isPurchase}
                key={index}
                canRemove={devices.length > 1}
                onChange={(field, value) => setDevices((current) => current.map((item, itemIndex) => (
                  itemIndex === index ? { ...item, [field]: value } : item
                )))}
                onRemove={() => setDevices((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              />
            ))}
          </div>
        </section>
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
        <button className="button-secondary" type="button" onClick={() => setShowReturnModal(true)}>
          返却済みにして印刷
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
        <a className="button-secondary" href={`/admin/${encodeURIComponent(form.storeName)}/${encodeURIComponent(form.receptionId)}/print?type=receipt`} target="_blank">
          お客様控えを印刷
        </a>
        <a className="button-secondary" href={`/admin/${encodeURIComponent(form.storeName)}/${encodeURIComponent(form.receptionId)}/print?type=label`} target="_blank">
          管理ラベルを印刷
        </a>
        <button className="rounded-lg border border-red-300 bg-white px-4 py-3 font-bold text-red-700" type="button" onClick={remove}>
          削除
        </button>
      </div>
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-xl font-bold">返却確認</h2>
            <p className="mt-2 text-sm text-slate-600">
              返却日を保存し、ステータスを「{returnedStatusFromLists(statusLists, form.serviceType)}」に更新してから申込書を開きます。
            </p>
            <label className="mt-4 block">
              <span className="label">返却日時</span>
              <input className="input" type="datetime-local" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button className="button-secondary" disabled={returnPending} type="button" onClick={() => setShowReturnModal(false)}>
                キャンセル
              </button>
              <button className="button disabled:opacity-50" disabled={returnPending} type="button" onClick={confirmReturnAndPrint}>
                {returnPending ? "更新中..." : "返却済みに更新して印刷"}
              </button>
            </div>
          </section>
        </div>
      )}
    </form>
  );
}

function normalizeReceptionDevices(reception: Reception, devices: Device[]): Reception {
  const normalizedDevices = devices.length > 0 ? devices : devicesFromReception(reception);
  const primary = normalizedDevices[0] ?? EMPTY_DEVICE;
  return {
    ...reception,
    deviceCategory: primary.category,
    deviceModel: primary.model,
    imei: primary.imei,
    symptom: primary.symptom,
    repairContent: primary.repairContent,
    repairPrice: primary.repairPrice,
    cost: primary.cost,
    devicesJson: JSON.stringify(normalizedDevices),
    itemCount: reception.itemCount || String(normalizedDevices.length),
  };
}

function DeviceEditor({
  device,
  index,
  isPurchase,
  canRemove,
  onChange,
  onRemove,
}: {
  device: Device;
  index: number;
  isPurchase: boolean;
  canRemove: boolean;
  onChange: (field: keyof Device, value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold">端末 {index + 1}</h3>
        {canRemove && (
          <button className="text-sm font-bold text-red-700" type="button" onClick={onRemove}>
            削除
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <DeviceInput label="端末カテゴリ" value={device.category} onChange={(value) => onChange("category", value)} />
        <DeviceInput label="機種名" value={device.model} onChange={(value) => onChange("model", value)} />
        <DeviceInput label="IMEI / シリアル" value={device.imei} onChange={(value) => onChange("imei", value)} />
        <DeviceInput label={isPurchase ? "査定金額" : "修理料金"} value={device.repairPrice} onChange={(value) => onChange("repairPrice", value)} />
        {!isPurchase && <DeviceInput label="原価" value={device.cost} onChange={(value) => onChange("cost", value)} />}
      </div>
      <label className="mt-3 block">
        <span className="label">{isPurchase ? "端末状態・査定メモ" : "症状"}</span>
        <textarea className="input min-h-20" value={device.symptom} onChange={(event) => onChange("symptom", event.target.value)} />
      </label>
      {!isPurchase && (
        <label className="mt-3 block">
          <span className="label">修理内容</span>
          <textarea className="input min-h-20" value={device.repairContent} onChange={(event) => onChange("repairContent", event.target.value)} />
        </label>
      )}
    </div>
  );
}

function DeviceInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function toDatetimeLocal(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.length >= 16 ? value.slice(0, 16) : value;
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
