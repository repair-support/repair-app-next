"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import SignatureCanvas from "@/components/form/SignatureCanvas";
import { SERVICE_BRANDS } from "@/lib/constants";
import type { Device, MasterData } from "@/lib/types";

type IssuedReception = {
  receptionId: string;
  rowNumber: number;
  serviceType: string;
  customerName?: string;
  deviceModel?: string;
  updateToken?: string;
};

type Completion = { receptionId: string; qr?: string; updateUrl: string };

type FormState = Record<string, string | boolean>;

const EMPTY_DEVICE: Device = {
  category: "",
  model: "",
  imei: "",
  symptom: "",
  repairContent: "",
  repairPrice: "",
  cost: "",
};

const repairHistoryOptions = [
  "他店で修理したことがある",
  "当店で修理を受けたことがある",
  "なし",
  "わからない",
];

const paymentOptions = ["未定", "現金", "クレジットカード", "QR決済", "振込", "代引き", "その他"];
const idDocumentOptions = ["未確認", "運転免許証", "マイナンバーカード", "健康保険証", "学生証", "その他"];
const yesNoOptions = ["あり", "なし"];
const warrantyOptions = ["保証あり", "保証なし", "保証対象外", "確認中"];
const panelOptions = ["未選択", "純正同等", "有機EL", "液晶", "再生パネル", "その他"];
const smallPartsOptions = ["未選択", "バッテリー", "ドックコネクタ", "カメラ", "スピーカー", "ボタン", "その他"];
const purchaseAgreementOptions = ["未承諾", "承諾済み"];
const carrierOptions = ["未確認", "docomo", "au", "SoftBank", "楽天モバイル", "SIMフリー", "その他"];
const simLockOptions = ["未確認", "解除済み", "SIMロックあり", "SIMフリー", "対象外"];
const usageRestrictionOptions = ["未確認", "○", "△", "×", "-"];
const rankOptions = ["未査定", "S", "A", "B", "C", "D", "ジャンク"];

const standardTerms = [
  "修理作業によりメーカー保証が受けられなくなる場合があります。",
  "データは基本的にそのまま作業しますが、データの変化・消失について保証するものではありません。必ず事前にバックアップを行ってください。",
  "端末の状態により、作業中に症状が悪化したり、起動しなくなる可能性があります。",
  "修理完了後の保管期限を過ぎた場合、規定に基づき処分となる場合があります。",
];

const repairMasterTerms = [
  "症状によっては、お見積り前の検証作業中に修理が完了する場合があります。その場合、作業料金が発生します。",
  "作業中、機器の故障状態が変化する場合があります。重大な過失がある場合を除き、当店では一部責任を負いかねます。",
  "記録媒体上のデータ変化・消失については、いかなる場合も保証いたしかねます。",
  "部品入手が困難な場合、未修理返却となる場合があります。",
  "修理不可の場合でも、診断・作業費用を頂戴する場合があります。",
  "部品到着後にお客様都合でキャンセルされる場合、部品代を頂戴する場合があります。",
  "修理依頼品の保管期限は修理完了日より30日間です。",
];

const brandTerms: Partial<Record<string, { warrantyDays: number; title: string }>> = {
  SWEEPMASTER: { warrantyDays: 30, title: "SWEEPMASTER 修理規約" },
  EarphoneMASTER: { warrantyDays: 8, title: "EarphoneMASTER 修理規約" },
};

function isPurchaseService(serviceType: string) {
  return serviceType.includes("買取");
}

function TextField({
  label,
  name,
  required = false,
  value,
  type = "text",
  inputMode,
  onChange,
}: {
  label: string;
  name: string;
  required?: boolean;
  value: unknown;
  type?: string;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  onChange: (name: string, value: string) => void;
}) {
  return (
    <label>
      <span className="label">
        {label}
        {required && <span className="ml-1 text-red-600">必須</span>}
      </span>
      <input
        className="input"
        inputMode={inputMode}
        required={required}
        type={type}
        value={String(value ?? "")}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  value: unknown;
  options: string[];
  required?: boolean;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <label>
      <span className="label">
        {label}
        {required && <span className="ml-1 text-red-600">必須</span>}
      </span>
      <select className="input" required={required} value={String(value ?? "")} onChange={(event) => onChange(name, event.target.value)}>
        <option value="">選択してください</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
  value: unknown;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <textarea className="input min-h-24" value={String(value ?? "")} onChange={(event) => onChange(name, event.target.value)} />
    </label>
  );
}

function Confirm({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="mt-1">{String(value ?? "") || "未入力"}</dd>
    </div>
  );
}

export default function ReceptionForm({ store }: { store: string }) {
  const [step, setStep] = useState<"issue" | "customer" | "confirm">("issue");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [serviceType, setServiceType] = useState<string>(SERVICE_BRANDS[0] ?? "修理受付");
  const [issued, setIssued] = useState<IssuedReception | null>(null);
  const [existing, setExisting] = useState<IssuedReception[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>({
    agreement: false,
    repairHistory: "",
    paymentMethod: "未定",
    idDocuments: "未確認",
    purchaseAgreement: "未承諾",
    carrier: "未確認",
    simLock: "未確認",
    usageRestriction: "未確認",
    rank: "未査定",
    itemCount: "1",
    assessStaff: "",
    color: "",
    capacity: "",
    repairParts: "",
    btLevel: "",
    accessories: "",
    waterproofTape: "",
    coating: "",
    temperedGlass: "",
    warrantyStatus: "",
  });
  const [devices, setDevices] = useState<Device[]>([{ ...EMPTY_DEVICE }]);
  const [master, setMaster] = useState<MasterData | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isPurchase = isPurchaseService(serviceType);

  useEffect(() => {
    fetch("/api/master")
      .then((response) => response.json())
      .then((body) => {
        if (body.ok) setMaster(body.data);
      })
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return existing.filter((item) => `${item.receptionId} ${item.customerName ?? ""} ${item.deviceModel ?? ""}`.toLowerCase().includes(q));
  }, [existing, search]);

  const loadExisting = useCallback(async () => {
    setError("");
    const response = await fetch(`/api/form/receptions?store=${encodeURIComponent(store)}`);
    const body = await response.json();
    if (!body.ok) return setError(body.error ?? "既存の受付番号を取得できませんでした。");
    setExisting(body.data);
  }, [store]);

  useEffect(() => {
    if (mode === "existing") void loadExisting();
  }, [loadExisting, mode]);

  function set(name: string, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateDevice(index: number, field: keyof Device, value: string) {
    setDevices((current) => current.map((device, i) => {
      if (i !== index) return device;
      const next = { ...device, [field]: value };
      if (field === "category") {
        next.model = "";
        next.repairContent = "";
      }
      if (field === "model") next.repairContent = "";
      return next;
    }));
  }

  function addDevice() {
    setDevices((current) => [...current, { ...EMPTY_DEVICE }]);
  }

  function removeDevice(index: number) {
    setDevices((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  }

  async function issueNumber() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/reception", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeName: store, serviceType }),
      });
      const body = await response.json();
      if (!body.ok) return setError(body.error ?? "受付番号を発行できませんでした。");
      setIssued({ receptionId: body.receptionId, rowNumber: body.rowNumber, updateToken: body.updateToken, serviceType });
    } finally {
      setPending(false);
    }
  }

  function proceedExisting() {
    const selected = existing.find((item) => item.receptionId === selectedId);
    if (!selected) return setError("受付番号を選択してください。");
    setIssued(selected);
    setServiceType(selected.serviceType || serviceType);
    setStep("customer");
    setError("");
  }

  function goCustomerStep() {
    if (!issued) return setError("先に受付番号を発行してください。");
    setStep("customer");
    setError("");
  }

  function showConfirm(event: FormEvent) {
    event.preventDefault();
    setError("");
    const primary = devices[0];
    if (!form.customerName || !form.customerKana || !form.completeTel) {
      return setError("必須項目を入力してください。");
    }
    if (!primary?.category || !primary.model) {
      return setError("1台目の端末カテゴリ、機種名を入力してください。");
    }
    if (isPurchase) {
      if (!form.idDocuments || form.idDocuments === "未確認") {
        return setError("買取受付では本人確認書類を選択してください。");
      }
    } else if (!form.repairHistory || !primary.symptom) {
      return setError("修理受付では過去の修理歴と症状を入力してください。");
    }
    if (!form.agreement || !form.signatureData) {
      return setError("同意チェックと署名が必要です。");
    }
    setStep("confirm");
  }

  async function submit() {
    if (!issued) return;
    setPending(true);
    setError("");
    try {
      const primary = devices[0] ?? EMPTY_DEVICE;
      const response = await fetch(`/api/form/reception/${encodeURIComponent(issued.receptionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          serviceType,
          deviceCategory: primary.category,
          deviceModel: primary.model,
          imei: primary.imei,
          symptom: isPurchase ? String(primary.symptom || "買取査定") : primary.symptom,
          repairContent: isPurchase ? String(primary.repairContent || "買取査定") : primary.repairContent,
          repairPrice: primary.repairPrice,
          cost: primary.cost,
          repairHistory: isPurchase ? String(form.repairHistory || "買取受付") : form.repairHistory,
          purchaseAgreement: isPurchase ? "承諾済み" : String(form.purchaseAgreement ?? ""),
          color: form.color ?? "",
          carrier: form.carrier ?? "",
          simLock: form.simLock ?? "",
          capacity: form.capacity ?? "",
          usageRestriction: form.usageRestriction ?? "",
          rank: form.rank ?? "",
          repairParts: form.repairParts ?? "",
          btLevel: form.btLevel ?? "",
          accessories: form.accessories ?? "",
          itemCount: form.itemCount || String(devices.length),
          assessStaff: form.assessStaff ?? "",
          devicesJson: JSON.stringify(devices),
          updateToken: issued.updateToken ?? "",
        }),
      });
      const body = await response.json();
      if (!body.ok) return setError(body.error ?? "受付を登録できませんでした。");
      const url = `${location.origin}/update/${body.receptionId}?token=${body.updateToken}`;
      const qrResponse = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: url }),
      });
      const qrBody = await qrResponse.json();
      setCompletion({ receptionId: body.receptionId, qr: qrBody.dataUrl, updateUrl: url });
    } finally {
      setPending(false);
    }
  }

  if (completion) {
    return (
      <section className="card mx-auto max-w-lg text-center">
        <p className="font-bold text-green-700">受付が完了しました</p>
        <h2 className="my-5 text-4xl font-black">{completion.receptionId}</h2>
        <p className="text-sm text-slate-600">スタッフへお知らせください。QRコードは修理状況の更新に使用します。</p>
        {completion.qr && <Image className="mx-auto mt-4" src={completion.qr} alt="修理状況更新用QRコード" width={280} height={280} unoptimized />}
        <div className="mt-4 flex flex-col gap-2">
          <button className="button" type="button" onClick={() => printManagementLabel(completion)}>管理ラベルを印刷する</button>
          <button className="button-secondary" type="button" onClick={() => location.reload()}>次の受付へ</button>
        </div>
      </section>
    );
  }

  if (step === "issue") {
    return (
      <section className="card mx-auto max-w-2xl space-y-5">
        <div>
          <p className="text-sm font-bold text-blue-700">STEP 1</p>
          <h2 className="mt-1 text-xl font-bold">受付方法を選択</h2>
        </div>
        <div className="rounded-xl bg-slate-100 p-4">
          <p className="text-xs font-bold text-slate-500">受付店舗</p>
          <p className="mt-1 text-lg font-bold">{store}</p>
        </div>
        <div>
          <p className="label">サービス媒体</p>
          <div className="flex flex-wrap gap-2">
            {SERVICE_BRANDS.map((brand) => (
              <button className={serviceType === brand ? "button" : "button-secondary"} key={brand} type="button" onClick={() => { setServiceType(brand); setError(""); }}>
                {brand}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className={mode === "new" ? "button" : "button-secondary"} type="button" onClick={() => setMode("new")}>新規受付</button>
          <button className={mode === "existing" ? "button" : "button-secondary"} type="button" onClick={() => setMode("existing")}>既存番号から受付</button>
        </div>
        {mode === "new" ? (
          <div className="space-y-3">
            {issued && <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center"><p className="text-sm font-bold text-blue-700">受付番号</p><p className="mt-2 text-4xl font-black">{issued.receptionId}</p></div>}
            {!issued ? <button className="button w-full" disabled={pending} type="button" onClick={issueNumber}>{pending ? "番号を発行中..." : "受付番号を発行する"}</button> : <button className="button w-full" type="button" onClick={goCustomerStep}>お客様入力へ進む</button>}
          </div>
        ) : (
          <div className="space-y-3">
            <input className="input" placeholder="番号・名前・機種で検索..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-2">
              {filtered.length === 0 && <p className="p-2 text-sm text-slate-500">受付中の番号はありません。</p>}
              {filtered.map((item) => (
                <button className={`w-full rounded-lg border p-3 text-left ${selectedId === item.receptionId ? "border-blue-600 bg-blue-50" : "bg-white"}`} key={item.receptionId} type="button" onClick={() => setSelectedId(item.receptionId)}>
                  <span className="font-bold">{item.receptionId}</span>
                  <span className="ml-2 text-sm text-slate-500">{item.customerName || "お客様情報未入力"} {item.deviceModel || ""}</span>
                </button>
              ))}
            </div>
            <button className="button w-full" type="button" onClick={proceedExisting}>この番号でお客様入力へ進む</button>
          </div>
        )}
        {error && <p className="text-sm font-bold text-red-700">{error}</p>}
      </section>
    );
  }

  if (step === "confirm") {
    const primary = devices[0] ?? EMPTY_DEVICE;
    return (
      <section className="card mx-auto max-w-2xl space-y-4">
        <p className="text-sm font-bold text-blue-700">STEP 3</p>
        <h2 className="text-xl font-bold">受付内容の確認</h2>
        <dl className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
          <Confirm label="受付番号" value={issued?.receptionId} />
          <Confirm label="お名前" value={form.customerName} />
          <Confirm label="フリガナ" value={form.customerKana} />
          <Confirm label="連絡先" value={form.completeTel} />
          <Confirm label="端末" value={`${primary.category} ${primary.model}`} />
          {!isPurchase && <Confirm label="症状" value={primary.symptom} />}
          {!isPurchase && <Confirm label="修理内容" value={primary.repairContent} />}
          <Confirm label={isPurchase ? "査定金額" : "修理金額"} value={primary.repairPrice} />
          {isPurchase && <Confirm label="本人確認書類" value={form.idDocuments} />}
          {isPurchase && <Confirm label="色" value={form.color} />}
          {isPurchase && <Confirm label="キャリア" value={form.carrier} />}
          {isPurchase && <Confirm label="SIMロック" value={form.simLock} />}
          {isPurchase && <Confirm label="容量" value={form.capacity} />}
          {isPurchase && <Confirm label="利用制限" value={form.usageRestriction} />}
          {isPurchase && <Confirm label="ランク" value={form.rank} />}
          {isPurchase && <Confirm label="BT残量" value={form.btLevel} />}
          {isPurchase && <Confirm label="付属品" value={form.accessories} />}
          {isPurchase && <Confirm label="支払方法" value={form.paymentMethod} />}
          <Confirm label="複数端末" value={`${devices.length}台`} />
        </dl>
        {error && <p className="text-sm font-bold text-red-700">{error}</p>}
        <div className="flex justify-between gap-3">
          <button className="button-secondary" type="button" onClick={() => setStep("customer")}>修正する</button>
          <button className="button" disabled={pending} type="button" onClick={submit}>{pending ? "送信中..." : "この内容で送信する"}</button>
        </div>
      </section>
    );
  }

  return (
    <form className="mx-auto max-w-3xl space-y-4" onSubmit={showConfirm}>
      <section className="card space-y-4">
        <p className="text-sm font-bold text-blue-700">STEP 2</p>
        <h2 className="text-xl font-bold">お客様情報</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="お名前" name="customerName" required value={form.customerName} onChange={set} />
          <TextField label="フリガナ" name="customerKana" required value={form.customerKana} onChange={set} />
          <TextField label={isPurchase ? "買取端末の電話番号" : "ご依頼端末の電話番号"} name="deviceTel" value={form.deviceTel} inputMode="tel" onChange={set} />
          <TextField label="修理完了時の連絡先" name="completeTel" required value={form.completeTel} inputMode="tel" onChange={set} />
          <TextField label="生年月日" name="birthdate" type="date" value={form.birthdate} onChange={set} />
          <TextField label="自宅電話" name="homeTel" value={form.homeTel} inputMode="tel" onChange={set} />
          <TextField label="携帯電話" name="mobileTel" value={form.mobileTel} inputMode="tel" onChange={set} />
          <TextField label="メールアドレス" name="email" type="email" value={form.email} onChange={set} />
          <TextField label="職業" name="occupation" value={form.occupation} onChange={set} />
          <SelectField label="本人確認書類" name="idDocuments" required={isPurchase} value={form.idDocuments} options={idDocumentOptions} onChange={set} />
        </div>
        <TextField label="ご住所" name="address" value={form.address} onChange={set} />
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{isPurchase ? "買取端末情報" : "端末・修理情報"}</h2>
          <button className="button-secondary" type="button" onClick={addDevice}>端末を追加</button>
        </div>
        {devices.map((device, index) => {
          const models = master?.deviceMap[device.category] ?? [];
          const repairOptions = device.model && master?.modelRepairMap[device.model] ? master.modelRepairMap[device.model] : master?.repairMap[device.category] ?? [];
          return (
            <div className="space-y-3 rounded-2xl border p-4" key={index}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold">端末 {index + 1}</h3>
                {devices.length > 1 && <button className="text-sm font-bold text-red-700" type="button" onClick={() => removeDevice(index)}>削除</button>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <SelectDeviceField label="端末カテゴリ" value={device.category} options={master?.categories ?? []} required={index === 0} onChange={(value) => updateDevice(index, "category", value)} />
                <SelectDeviceField label="機種名" value={device.model} options={models} required={index === 0} onChange={(value) => updateDevice(index, "model", value)} />
                <DeviceTextField label="IMEI / シリアル" value={device.imei} onChange={(value) => updateDevice(index, "imei", value)} />
                <DeviceTextField label={isPurchase ? "査定金額" : "修理金額"} value={device.repairPrice} inputMode="decimal" onChange={(value) => updateDevice(index, "repairPrice", value)} />
                {!isPurchase && <DeviceTextField label="原価" value={device.cost} inputMode="decimal" onChange={(value) => updateDevice(index, "cost", value)} />}
              </div>
              {isPurchase ? (
                <DeviceTextArea label="端末状態・査定メモ" value={device.symptom} onChange={(value) => updateDevice(index, "symptom", value)} />
              ) : (
                <>
                  <DeviceTextArea label="症状" value={device.symptom} onChange={(value) => updateDevice(index, "symptom", value)} />
                  <DeviceComboField label="修理内容" value={device.repairContent} options={repairOptions} onChange={(value) => updateDevice(index, "repairContent", value)} />
                </>
              )}
            </div>
          );
        })}
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-bold">{isPurchase ? "買取確認事項" : "修理確認事項"}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {!isPurchase && <SelectField label="過去の修理歴" name="repairHistory" required value={form.repairHistory} options={repairHistoryOptions} onChange={set} />}
          {!isPurchase && <TextField label="パスコード（任意）" name="passcode" value={form.passcode} onChange={set} />}
          {!isPurchase && <SelectField label="修理カテゴリ" name="repairCategory" value={form.repairCategory} options={["画面", "バッテリー", "水没", "基板", "その他"]} onChange={set} />}
          {!isPurchase && <SelectField label="パネル種別" name="panelType" value={form.panelType} options={panelOptions} onChange={set} />}
          {!isPurchase && <SelectField label="スモールパーツ種別" name="smallPartsType" value={form.smallPartsType} options={smallPartsOptions} onChange={set} />}
          {!isPurchase && <SelectField label="防水テープ施工" name="waterproofTape" value={form.waterproofTape} options={yesNoOptions} onChange={set} />}
          {!isPurchase && <SelectField label="保証有無" name="warrantyStatus" value={form.warrantyStatus} options={warrantyOptions} onChange={set} />}
          {isPurchase && <TextField label="査定員" name="assessStaff" value={form.assessStaff} onChange={set} />}
          {isPurchase && <TextField label="品目数" name="itemCount" value={form.itemCount} inputMode="numeric" onChange={set} />}
          {isPurchase && <TextField label="色" name="color" value={form.color} onChange={set} />}
          {isPurchase && <SelectField label="キャリア" name="carrier" value={form.carrier} options={carrierOptions} onChange={set} />}
          {isPurchase && <SelectField label="SIMロック" name="simLock" value={form.simLock} options={simLockOptions} onChange={set} />}
          {isPurchase && <TextField label="容量" name="capacity" value={form.capacity} onChange={set} />}
          {isPurchase && <SelectField label="利用制限" name="usageRestriction" value={form.usageRestriction} options={usageRestrictionOptions} onChange={set} />}
          {isPurchase && <SelectField label="ランク" name="rank" value={form.rank} options={rankOptions} onChange={set} />}
          {isPurchase && <TextField label="修理箇所・状態" name="repairParts" value={form.repairParts} onChange={set} />}
          {isPurchase && <TextField label="BT残量" name="btLevel" value={form.btLevel} onChange={set} />}
          <SelectField label="決済方法" name="paymentMethod" value={form.paymentMethod} options={paymentOptions} onChange={set} />
          {!isPurchase && <SelectField label="コーティング" name="coating" value={form.coating} options={yesNoOptions} onChange={set} />}
          {!isPurchase && <SelectField label="強化ガラス" name="temperedGlass" value={form.temperedGlass} options={yesNoOptions} onChange={set} />}
          {isPurchase && <SelectField label="買取承諾" name="purchaseAgreement" value={form.purchaseAgreement} options={purchaseAgreementOptions} onChange={set} />}
        </div>
        {isPurchase && <TextAreaField label="付属品" name="accessories" value={form.accessories} onChange={set} />}
        <TextAreaField label="追記事項" name="notes" value={form.notes} onChange={set} />
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-bold">利用規約・同意</h2>
        <AgreementBox serviceType={serviceType} store={store} />
        <label className="block"><input checked={Boolean(form.agreement)} type="checkbox" onChange={(event) => set("agreement", event.target.checked)} /> <span className="ml-2">上記内容および利用規約に同意します</span></label>
      </section>

      <section className="card space-y-3">
        <h2 className="text-xl font-bold">ご署名</h2>
        <p className="text-sm text-slate-600">枠内に指またはタッチペンでご署名ください。</p>
        <SignatureCanvas onChange={(value) => set("signatureData", value)} />
      </section>

      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
      <div className="flex justify-between gap-3">
        <button className="button-secondary" type="button" onClick={() => setStep("issue")}>戻る</button>
        <button className="button" type="submit">受付内容を確認する</button>
      </div>
    </form>
  );

  function printManagementLabel(done: Completion) {
    const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
    const row = (label: string, value: unknown) => value ? `<div class="irow"><span class="il">${label}</span><span class="iv">${escapeHtml(value)}</span></div>` : "";
    const primary = devices[0] ?? EMPTY_DEVICE;
    const receivedAt = new Date().toLocaleString("ja-JP", { hour12: false });
    const labelHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>管理ラベル</title><style>
@page{size:A5 landscape;margin:6mm}body{margin:0;font-family:"Yu Gothic",Meiryo,sans-serif;font-size:11px;color:#111;background:#fff}.wrap{width:100%;border:2px solid #111;border-radius:4px;overflow:hidden;display:flex;box-sizing:border-box}.left{flex:1;padding:8px 10px;border-right:2px solid #111;overflow:hidden}.right{width:210px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;gap:4px;flex-shrink:0}.meta{font-size:10px;color:#666;margin-bottom:3px}.name{font-size:20px;font-weight:900;margin-bottom:2px}.kana{font-size:11px;color:#444;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px}.rid{font-size:13px;font-weight:900;letter-spacing:1px;margin-bottom:6px;color:#c00}.section{font-size:9px;font-weight:700;color:#888;margin:5px 0 2px;letter-spacing:.5px}.irow{display:flex;gap:4px;margin-bottom:2px;align-items:flex-start}.il{color:#555;font-size:9px;min-width:64px;padding-top:1px;flex-shrink:0}.iv{font-weight:700;flex:1;word-break:break-all;line-height:1.3}.symptom{background:#fff8e1;border:1px solid #ffe082;border-radius:3px;padding:4px 6px;margin-top:4px;font-size:10px;line-height:1.4;font-weight:700}.qr-cap{font-size:9px;color:#555;text-align:center;line-height:1.4}.qr{width:200px;height:200px;object-fit:contain}@media print{.pbtn{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div style="text-align:center;margin-bottom:6px;"><button class="pbtn" onclick="window.print()" style="border:none;border-radius:6px;padding:7px 18px;font-size:13px;font-weight:700;color:#fff;background:#333;cursor:pointer;">印刷する</button></div><div class="wrap"><div class="left"><div class="meta">${escapeHtml(store)}　ラベル発行：${escapeHtml(receivedAt)}</div><div class="name">${escapeHtml(form.customerName || "（未入力）")}</div><div class="kana">${escapeHtml(form.customerKana || "　")}</div><div class="rid">${escapeHtml(done.receptionId)}</div><div class="section">端末情報</div>${row("サービス", serviceType)}${row("端末", `${primary.category} ${primary.model}`)}${row("修理内容", primary.repairContent)}${row("修理金額", primary.repairPrice)}<div class="symptom">${escapeHtml(primary.symptom)}</div><div class="section">お客様情報</div>${row("電話番号", form.deviceTel)}${row("連絡先", form.completeTel)}${row("修理歴", form.repairHistory)}${row("パスコード", form.passcode)}</div><div class="right">${done.qr ? `<img class="qr" src="${done.qr}" alt="QR">` : `<div>${escapeHtml(done.updateUrl)}</div>`}<div class="qr-cap">QRを読み込んで<br>修理状況を更新</div></div></div></body></html>`;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("印刷画面を開けませんでした。ブラウザのポップアップを許可してください。");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(labelHtml);
    printWindow.document.close();
  }
}

function SelectDeviceField({
  label,
  value,
  options,
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="label">
        {label}
        {required && <span className="ml-1 text-red-600">必須</span>}
      </span>
      <select className="input" required={required} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">選択してください</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function DeviceTextField({
  label,
  value,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="input" inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function DeviceTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <textarea className="input min-h-24" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function DeviceComboField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const listId = `${label}-options`;
  return (
    <label>
      <span className="label">{label}</span>
      <input className="input" list={listId} value={value} onChange={(event) => onChange(event.target.value)} />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}

function AgreementBox({ serviceType, store }: { serviceType: string; store: string }) {
  const brand = brandTerms[serviceType];
  if (isPurchaseService(serviceType)) {
    return (
      <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm leading-6">
        <p className="font-bold">買取受付に関する確認事項</p>
        <p>本人確認書類の内容と申込情報を確認したうえで買取受付を行います。</p>
        <p>端末の状態、動作確認、ネットワーク利用制限、アクティベーションロック、残債状況等により、査定金額が変更または買取不可となる場合があります。</p>
        <p>買取成立後は、端末内のデータ削除、初期化、SIMカード・記録媒体の抜き忘れがないことを確認してください。</p>
        <p>盗難品、不正取得品、所有権に問題がある端末は買取できません。申込者は端末の正当な所有者であることを保証します。</p>
      </div>
    );
  }
  if (store === "青森店" && serviceType === "ダイワンテレコム") {
    return (
      <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm leading-6">
        <p className="font-bold">利用規約・修理に関する注意事項の動画をご確認ください。</p>
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <iframe className="h-full w-full" src="https://www.youtube.com/embed/ijqAbHncTM0" title="利用規約・修理に関する注意事項" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        </div>
        <p className="text-xs text-slate-500">動画をご確認いただいたうえで、同意チェックをお願いします。</p>
      </div>
    );
  }
  if (brand) {
    return (
      <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm leading-6">
        <p className="font-bold">{brand.title}</p>
        <p><strong>1. 修理サービス</strong><br />当社の修理サービスは、お客様からお預かりした機器等を、お客様ご指定の症状に対して復旧・改善するよう修理または作業を行うことを目的とします。</p>
        <p><strong>2. 時間目安</strong><br />提示する修理時間は目安であり、機器の状態によっては修理時間が想定より長くなる場合があります。</p>
        <p><strong>3. 保証と保管期限</strong><br />修理完了後、交換部品の不具合または当社作業内容の不備による不具合が発生した場合、{brand.warrantyDays}日以内のお申し出に限り無償対応します。修理依頼品の保管期限は修理完了連絡日より30日間です。</p>
        <p><strong>4. 個人情報の取扱</strong><br />取得した個人情報は、修理サービス、発送案内、ご注文に関するお知らせ等に使用します。</p>
      </div>
    );
  }
  const terms = serviceType === "リペアマスター" || serviceType === "SwitchMaster" ? repairMasterTerms : standardTerms;
  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm leading-6">
      {terms.map((term) => <p key={term}>{term}</p>)}
    </div>
  );
}
