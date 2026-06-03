"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { MasterData, Reception } from "@/lib/types";

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
    returnPlanDate: toDatetimeLocal(data.returnPlanDate),
    returnDate: toDatetimeLocal(data.returnDate),
    notes: data.notes ?? "",
    waterproofTape: data.waterproofTape ?? "",
    coating: data.coating ?? "",
    temperedGlass: data.temperedGlass ?? "",
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

export default function PublicUpdateForm({ id, token }: { id: string; token: string }) {
  const [reception, setReception] = useState<PublicReception | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [master, setMaster] = useState<MasterData | null>(null);
  const [statuses, setStatuses] = useState<string[]>(FALLBACK_STATUSES);
  const [message, setMessage] = useState("読み込み中...");
  const [saving, setSaving] = useState(false);

  const endpoint = `/api/public/reception/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`;

  useEffect(() => {
    let active = true;

    async function load() {
      const [receptionResponse, masterResponse, statusResponse] = await Promise.all([
        fetch(endpoint),
        fetch("/api/master"),
        fetch("/api/status"),
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
        </div>
        <TextAreaField label="症状" name="symptom" value={form.symptom ?? ""} onChange={updateField} />
        <SelectField label="修理内容" name="repairContent" value={form.repairContent ?? ""} options={repairOptions} placeholder="手入力または選択" onChange={updateField} />
        <TextAreaField label="追記事項" name="notes" value={form.notes ?? ""} onChange={updateField} />
      </section>

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
