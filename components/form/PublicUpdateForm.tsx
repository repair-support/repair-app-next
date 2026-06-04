"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CostOption, CostReferenceData, MasterData, Reception } from "@/lib/types";

type PublicReception = Partial<Reception> & { receptionId: string };

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

const SERVICE_BRANDS = [
  "ダイワンテレコム",
  "SWEEPMASTER",
  "EarphoneMASTER",
  "リペアマスター",
  "SwitchMaster",
  "ダイワンテレコム 買取",
];

const YES_NO_OPTIONS = ["あり", "なし"];
const PURCHASE_AGREEMENT_OPTIONS = ["未承諾", "承諾済み"];
const CARRIER_OPTIONS = ["未確認", "docomo", "au", "SoftBank", "楽天モバイル", "SIMフリー", "その他"];
const SIM_LOCK_OPTIONS = ["未確認", "解除済み", "SIMロックあり", "SIMフリー", "対象外"];
const USAGE_RESTRICTION_OPTIONS = ["未確認", "○", "△", "×", "-"];
const RANK_OPTIONS = ["未査定", "S", "A", "B", "C", "D", "ジャンク"];

function toDatetimeLocal(value: string | undefined) {
  if (!value) return "";
  return value.length >= 16 ? value.slice(0, 16) : value;
}

function normalizeForm(data: PublicReception): Record<string, string> {
  return {
    status: data.status ?? "",
    staffName: data.staffName ?? "",
    repairStaff: data.repairStaff ?? "",
    serviceType: data.serviceType ?? "",
    deviceCategory: data.deviceCategory ?? "",
    deviceModel: data.deviceModel ?? "",
    imei: data.imei ?? "",
    symptom: data.symptom ?? "",
    repairContent: data.repairContent ?? "",
    repairPrice: data.repairPrice ?? "",
    cost: data.cost ?? "",
    returnPlanDate: toDatetimeLocal(data.returnPlanDate),
    returnDate: toDatetimeLocal(data.returnDate),
    internalMemo: data.internalMemo ?? "",
    notes: data.notes ?? "",
    waterproofTape: data.waterproofTape ?? "",
    coating: data.coating ?? "",
    temperedGlass: data.temperedGlass ?? "",
    paymentMethod: data.paymentMethod ?? "",
    idDocuments: data.idDocuments ?? "",
    purchaseAgreement: data.purchaseAgreement ?? "",
    color: data.color ?? "",
    carrier: data.carrier ?? "",
    simLock: data.simLock ?? "",
    capacity: data.capacity ?? "",
    usageRestriction: data.usageRestriction ?? "",
    rank: data.rank ?? "",
    repairParts: data.repairParts ?? "",
    btLevel: data.btLevel ?? "",
    accessories: data.accessories ?? "",
    itemCount: data.itemCount ?? "",
    assessStaff: data.assessStaff ?? "",
  };
}

function TextField({
  label,
  name,
  value,
  type = "text",
  inputMode,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  onChange: (name: string, value: string) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="input" name={name} type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(name, event.target.value)} />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <textarea className="input min-h-24" name={name} value={value} onChange={(event) => onChange(name, event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
  placeholder = "未選択",
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="input" name={name} value={value} onChange={(event) => onChange(name, event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ComboField({
  label,
  name,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (name: string, value: string) => void;
}) {
  const listId = `${name}-options`;
  return (
    <label>
      <span className="label">{label}</span>
      <input
        className="input"
        list={listId}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}

export default function PublicUpdateForm({ id, token }: { id: string; token: string }) {
  const [reception, setReception] = useState<PublicReception | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [master, setMaster] = useState<MasterData | null>(null);
  const [costReference, setCostReference] = useState<CostReferenceData | null>(null);
  const [statuses, setStatuses] = useState<string[]>(FALLBACK_STATUSES);
  const [message, setMessage] = useState("読み込み中...");
  const [saving, setSaving] = useState(false);

  const endpoint = `/api/public/reception/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`;

  useEffect(() => {
    let active = true;

    async function load() {
      const [receptionResponse, masterResponse, statusResponse, costResponse] = await Promise.all([
        fetch(endpoint),
        fetch("/api/master"),
        fetch("/api/status"),
        fetch("/api/cost-reference"),
      ]);

      const receptionBody = await receptionResponse.json();
      if (!active) return;
      if (!receptionBody.ok) {
        setMessage(receptionBody.error ?? "受付情報を読み込めませんでした。");
        return;
      }

      setReception(receptionBody.data);
      setForm(normalizeForm(receptionBody.data));
      setMessage("");

      const masterBody = await masterResponse.json().catch(() => null);
      if (masterBody?.ok) setMaster(masterBody.data);

      const statusBody = await statusResponse.json().catch(() => null);
      if (statusBody?.ok && Array.isArray(statusBody.data) && statusBody.data.length > 0) {
        setStatuses(statusBody.data);
      }

      const costBody = await costResponse.json().catch(() => null);
      if (costBody?.ok) setCostReference(costBody.data);
    }

    load().catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : "読み込みに失敗しました。");
    });

    return () => {
      active = false;
    };
  }, [endpoint]);

  const deviceModels = useMemo(() => {
    if (!master || !form.deviceCategory) return [];
    return master.deviceMap[form.deviceCategory] ?? [];
  }, [form.deviceCategory, master]);

  const repairOptions = useMemo(() => {
    if (!master) return [];
    if (form.deviceModel && master.modelRepairMap[form.deviceModel]) return master.modelRepairMap[form.deviceModel];
    if (form.deviceCategory && master.repairMap[form.deviceCategory]) return master.repairMap[form.deviceCategory];
    return [];
  }, [form.deviceCategory, form.deviceModel, master]);
  const isPurchase = (form.serviceType ?? "").includes("買取");

  const costOptions = useMemo(() => {
    if (!costReference || !form.deviceModel) return [];
    const costs = costReference.modelCosts[form.deviceModel];
    if (!costs) return [];
    return [...costs.screen, ...costs.battery, ...costs.small, ...costs.glass, ...costs.other];
  }, [costReference, form.deviceModel]);

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

  useEffect(() => {
    if (isPurchase || !suggestedCost) return;
    setForm((current) => {
      if (current.cost === String(suggestedCost.cost)) return current;
      if (current.cost && current.cost !== "0") return current;
      return { ...current, cost: String(suggestedCost.cost) };
    });
  }, [isPurchase, suggestedCost]);

  function updateField(name: string, value: string) {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "deviceCategory" && value !== current.deviceCategory) {
        next.deviceModel = "";
        next.repairContent = "";
      }
      if (name === "deviceModel" && value !== current.deviceModel) {
        next.repairContent = "";
      }
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      setMessage(body.ok ? "更新しました。" : body.error ?? "更新に失敗しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card mx-auto max-w-4xl space-y-6" onSubmit={submit}>
      <div>
        <p className="text-xs font-bold text-blue-700">Repair Reception</p>
        <h1 className="text-2xl font-bold">修理状況更新</h1>
        <p className="text-sm text-slate-600">受付ID: {id}</p>
      </div>

      {reception && (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-3">
          <div>
            <span className="label">お客様名</span>
            <p className="font-bold">{reception.customerName || "-"}</p>
          </div>
          <div>
            <span className="label">連絡先</span>
            <p className="font-bold">{reception.completeTel || reception.deviceTel || "-"}</p>
          </div>
          <div>
            <span className="label">店舗</span>
            <p className="font-bold">{reception.storeName || "-"}</p>
          </div>
        </div>
      )}

      {message && <p className="rounded-lg bg-slate-100 p-3 text-sm font-bold">{message}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">受付・作業状況</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="ステータス" name="status" value={form.status ?? ""} options={statuses} onChange={updateField} />
          <SelectField label="サービス種別" name="serviceType" value={form.serviceType ?? ""} options={SERVICE_BRANDS} onChange={updateField} />
          <TextField label="受付担当" name="staffName" value={form.staffName ?? ""} onChange={updateField} />
          <TextField label="修理担当" name="repairStaff" value={form.repairStaff ?? ""} onChange={updateField} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">端末・修理内容</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="端末カテゴリ" name="deviceCategory" value={form.deviceCategory ?? ""} options={master?.categories ?? []} onChange={updateField} />
          <SelectField label="機種名" name="deviceModel" value={form.deviceModel ?? ""} options={deviceModels} onChange={updateField} />
          <TextField label="IMEI / シリアル" name="imei" value={form.imei ?? ""} onChange={updateField} />
          <TextField label="修理料金" name="repairPrice" value={form.repairPrice ?? ""} inputMode="decimal" onChange={updateField} />
          <TextField label="原価" name="cost" value={form.cost ?? ""} inputMode="decimal" onChange={updateField} />
        </div>
        {!isPurchase && costOptions.length > 0 && (
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-bold">原価候補</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {costOptions.slice(0, 10).map((option: CostOption) => (
                <button
                  className="rounded-full border bg-white px-3 py-1"
                  key={`${option.type}-${option.label}-${option.cost}`}
                  type="button"
                  onClick={() => updateField("cost", String(option.cost))}
                >
                  {option.label}: {option.cost.toLocaleString()}円
                </button>
              ))}
            </div>
          </div>
        )}
        <TextAreaField label="症状" name="symptom" value={form.symptom ?? ""} onChange={updateField} />
        <ComboField label="修理内容" name="repairContent" value={form.repairContent ?? ""} options={repairOptions} placeholder="候補から選択、または手入力" onChange={updateField} />
        <TextAreaField label="店舗内メモ" name="internalMemo" value={form.internalMemo ?? ""} onChange={updateField} />
        <TextAreaField label="追記事項" name="notes" value={form.notes ?? ""} onChange={updateField} />
      </section>

      {isPurchase && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">買取査定情報</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="査定員" name="assessStaff" value={form.assessStaff ?? ""} onChange={updateField} />
            <TextField label="品目数" name="itemCount" value={form.itemCount ?? ""} inputMode="numeric" onChange={updateField} />
            <SelectField label="本人確認書類" name="idDocuments" value={form.idDocuments ?? ""} options={["未確認", "運転免許証", "マイナンバーカード", "健康保険証", "学生証", "その他"]} onChange={updateField} />
            <SelectField label="買取承諾" name="purchaseAgreement" value={form.purchaseAgreement ?? ""} options={PURCHASE_AGREEMENT_OPTIONS} onChange={updateField} />
            <TextField label="色" name="color" value={form.color ?? ""} onChange={updateField} />
            <SelectField label="キャリア" name="carrier" value={form.carrier ?? ""} options={CARRIER_OPTIONS} onChange={updateField} />
            <SelectField label="SIMロック" name="simLock" value={form.simLock ?? ""} options={SIM_LOCK_OPTIONS} onChange={updateField} />
            <TextField label="容量" name="capacity" value={form.capacity ?? ""} onChange={updateField} />
            <SelectField label="利用制限" name="usageRestriction" value={form.usageRestriction ?? ""} options={USAGE_RESTRICTION_OPTIONS} onChange={updateField} />
            <SelectField label="ランク" name="rank" value={form.rank ?? ""} options={RANK_OPTIONS} onChange={updateField} />
            <TextField label="修理箇所・状態" name="repairParts" value={form.repairParts ?? ""} onChange={updateField} />
            <TextField label="BT残量" name="btLevel" value={form.btLevel ?? ""} onChange={updateField} />
            <TextField label="決済方法" name="paymentMethod" value={form.paymentMethod ?? ""} onChange={updateField} />
          </div>
          <TextAreaField label="付属品" name="accessories" value={form.accessories ?? ""} onChange={updateField} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">返却・オプション</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="来店予定日" name="returnPlanDate" type="datetime-local" value={form.returnPlanDate ?? ""} onChange={updateField} />
          <TextField label="返却日時" name="returnDate" type="datetime-local" value={form.returnDate ?? ""} onChange={updateField} />
          <SelectField label="防水テープ施工" name="waterproofTape" value={form.waterproofTape ?? ""} options={YES_NO_OPTIONS} onChange={updateField} />
          <SelectField label="コーティング" name="coating" value={form.coating ?? ""} options={YES_NO_OPTIONS} onChange={updateField} />
          <SelectField label="強化ガラス" name="temperedGlass" value={form.temperedGlass ?? ""} options={YES_NO_OPTIONS} onChange={updateField} />
        </div>
      </section>

      <button className="button w-full" type="submit" disabled={saving}>
        {saving ? "更新中..." : "更新する"}
      </button>
    </form>
  );
}
