"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import SignatureCanvas from "@/components/form/SignatureCanvas";
import { SERVICE_TYPES } from "@/lib/constants";
import { MasterData } from "@/lib/types";

type Completion = { receptionId: string; updateToken: string; qr?: string };

export default function ReceptionForm({ store }: { store: string }) {
  const [step, setStep] = useState(1);
  const [master, setMaster] = useState<MasterData>({ categories: [], deviceMap: {}, repairMap: {}, modelRepairMap: {} });
  const [form, setForm] = useState<Record<string, string | boolean>>({ storeName: store, serviceType: "修理受付", agreement: false });
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { fetch("/api/master").then((res) => res.json()).then((body) => body.ok && setMaster(body.data)).catch(() => undefined); }, []);
  function set(name: string, value: string | boolean) { setForm((current) => ({ ...current, [name]: value })); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.agreement || !form.signatureData) return setError("同意チェックと署名が必要です。");
    const response = await fetch("/api/reception", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = await response.json();
    if (!body.ok) return setError(body.error ?? "受付を登録できませんでした。");
    const url = `${location.origin}/update/${body.receptionId}?token=${body.updateToken}`;
    const qrResponse = await fetch("/api/qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: url }) });
    const qrBody = await qrResponse.json();
    setCompletion({ receptionId: body.receptionId, updateToken: body.updateToken, qr: qrBody.dataUrl });
  }

  if (completion) return (
    <section className="card mx-auto max-w-lg text-center">
      <p className="font-bold text-green-700">受付が完了しました</p>
      <h2 className="my-5 text-4xl font-black">{completion.receptionId}</h2>
      <p className="text-sm text-slate-600">QRコードは修理状況の確認・更新に使用します。</p>
      {completion.qr && <Image className="mx-auto mt-4" src={completion.qr} alt="修理状況更新用QRコード" width={320} height={320} unoptimized />}
    </section>
  );

  const category = String(form.deviceCategory ?? "");
  return (
    <form className="card mx-auto max-w-2xl" onSubmit={submit}>
      <p className="mb-4 text-sm font-bold text-blue-700">ステップ {step} / 4</p>
      {step === 1 && <div className="space-y-4">
        <h2 className="text-xl font-bold">サービス種別</h2>
        {SERVICE_TYPES.map((type) => <label className="block rounded-xl border p-3" key={type}><input checked={form.serviceType === type} name="service" type="radio" onChange={() => set("serviceType", type)} /> <span className="ml-2">{type}</span></label>)}
      </div>}
      {step === 2 && <div className="grid gap-4 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-xl font-bold">端末情報</h2>
        <Field label="端末カテゴリ"><select className="input" value={category} onChange={(e) => set("deviceCategory", e.target.value)}><option value="">選択してください</option>{master.categories.map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="機種名"><select className="input" value={String(form.deviceModel ?? "")} onChange={(e) => set("deviceModel", e.target.value)}><option value="">選択してください</option>{(master.deviceMap[category] ?? []).map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="症状・修理内容"><input className="input" value={String(form.symptom ?? "")} onChange={(e) => set("symptom", e.target.value)} placeholder="例: 画面割れ" /></Field>
        <Field label="IMEI（任意）"><input className="input" value={String(form.imei ?? "")} onChange={(e) => set("imei", e.target.value)} /></Field>
      </div>}
      {step === 3 && <div className="grid gap-4 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-xl font-bold">お客様情報</h2>
        <TextField label="お名前" name="customerName" required />
        <TextField label="フリガナ" name="customerKana" />
        <TextField label="ご依頼端末の電話番号" name="deviceTel" />
        <TextField label="修理完了時の連絡先" name="completeTel" />
        <TextField label="パスコード（任意）" name="passcode" />
        <TextField label="過去の修理歴（任意）" name="repairHistory" />
      </div>}
      {step === 4 && <div className="space-y-4">
        <h2 className="text-xl font-bold">確認・同意・署名</h2>
        <div className="rounded-xl bg-slate-50 p-4 text-sm"><p>{String(form.customerName ?? "")}</p><p>{String(form.deviceCategory ?? "")} {String(form.deviceModel ?? "")}</p><p>{String(form.symptom ?? "")}</p></div>
        <label className="block"><input type="checkbox" checked={Boolean(form.agreement)} onChange={(e) => set("agreement", e.target.checked)} /> <span className="ml-2">個人情報の利用と受付内容に同意します</span></label>
        <SignatureCanvas onChange={(value) => set("signatureData", value)} />
      </div>}
      {error && <p className="mt-4 text-sm font-bold text-red-700">{error}</p>}
      <div className="mt-6 flex justify-between gap-3">
        <button className="button-secondary disabled:opacity-40" type="button" disabled={step === 1} onClick={() => setStep((value) => value - 1)}>戻る</button>
        {step < 4 ? <button className="button" type="button" onClick={() => setStep((value) => value + 1)}>次へ</button> : <button className="button" type="submit">受付を登録</button>}
      </div>
    </form>
  );

  function TextField({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
    return <Field label={label}><input className="input" required={required} value={String(form[name] ?? "")} onChange={(e) => set(name, e.target.value)} /></Field>;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="label">{label}</span>{children}</label>;
}
