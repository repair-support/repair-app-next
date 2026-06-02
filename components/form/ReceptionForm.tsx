"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import SignatureCanvas from "@/components/form/SignatureCanvas";
import { SERVICE_BRANDS } from "@/lib/constants";

type IssuedReception = {
  receptionId: string;
  rowNumber: number;
  serviceType: string;
  customerName?: string;
  deviceModel?: string;
  updateToken?: string;
};

type Completion = { receptionId: string; qr?: string };

const repairHistoryOptions = ["他店で修理したことがある", "当店で修理を受けたことがある", "ない", "わからない"];

export default function ReceptionForm({ store }: { store: string }) {
  const [step, setStep] = useState<"issue" | "customer" | "confirm">("issue");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [serviceType, setServiceType] = useState("ダイワンテレコム");
  const [issued, setIssued] = useState<IssuedReception | null>(null);
  const [existing, setExisting] = useState<IssuedReception[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Record<string, string | boolean>>({ agreement: false });
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return existing.filter((item) => `${item.receptionId} ${item.customerName ?? ""} ${item.deviceModel ?? ""}`.toLowerCase().includes(q));
  }, [existing, search]);

  function set(name: string, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

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

  async function issueNumber() {
    if (serviceType === "ダイワンテレコム 買取") {
      return setError("買取専用フローは次の移植段階で追加します。修理受付媒体を選択してください。");
    }
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
    if (!form.customerName || !form.customerKana || !form.completeTel || !form.repairHistory) return setError("必須項目を入力してください。");
    if (!form.agreement || !form.signatureData) return setError("同意チェックと署名が必要です。");
    setStep("confirm");
  }

  async function submit() {
    if (!issued) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/form/reception/${encodeURIComponent(issued.receptionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, updateToken: issued.updateToken ?? "" }),
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
      setCompletion({ receptionId: body.receptionId, qr: qrBody.dataUrl });
    } finally {
      setPending(false);
    }
  }

  if (completion) return (
    <section className="card mx-auto max-w-lg text-center">
      <p className="font-bold text-green-700">受付が完了しました</p>
      <h2 className="my-5 text-4xl font-black">{completion.receptionId}</h2>
      <p className="text-sm text-slate-600">スタッフへお知らせください。QRコードは修理状況の更新に使用します。</p>
      {completion.qr && <Image className="mx-auto mt-4" src={completion.qr} alt="修理状況更新用QRコード" width={280} height={280} unoptimized />}
      <button className="button-secondary mt-4" type="button" onClick={() => location.reload()}>次の受付へ</button>
    </section>
  );

  if (step === "issue") return (
    <section className="card mx-auto max-w-2xl space-y-5">
      <div>
        <p className="text-sm font-bold text-blue-700">STEP 1</p>
        <h2 className="mt-1 text-xl font-bold">受付方法の選択</h2>
      </div>
      <div className="rounded-xl bg-slate-100 p-4">
        <p className="text-xs font-bold text-slate-500">受付店舗</p>
        <p className="mt-1 text-lg font-bold">{store}</p>
      </div>
      <div>
        <p className="label">サービス媒体</p>
        <div className="flex flex-wrap gap-2">
          {SERVICE_BRANDS.map((brand) => <button className={serviceType === brand ? "button" : "button-secondary"} key={brand} type="button" onClick={() => { setServiceType(brand); setError(""); }}>{brand}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className={mode === "new" ? "button" : "button-secondary"} type="button" onClick={() => setMode("new")}>新規受付</button>
        <button className={mode === "existing" ? "button" : "button-secondary"} type="button" onClick={() => setMode("existing")}>既存番号から受付</button>
      </div>
      {mode === "new" ? <div className="space-y-3">
        {issued && <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center"><p className="text-sm font-bold text-blue-700">受付番号</p><p className="mt-2 text-4xl font-black">{issued.receptionId}</p></div>}
        {!issued ? <button className="button w-full" disabled={pending} type="button" onClick={issueNumber}>{pending ? "番号を発行中..." : "受付番号を発行する"}</button> : <button className="button w-full" type="button" onClick={goCustomerStep}>お客様入力へ進む</button>}
      </div> : <div className="space-y-3">
        <input className="input" placeholder="番号・名前・機種で検索..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-2">
          {filtered.length === 0 && <p className="p-2 text-sm text-slate-500">受付中の番号はありません。</p>}
          {filtered.map((item) => <button className={`w-full rounded-lg border p-3 text-left ${selectedId === item.receptionId ? "border-blue-600 bg-blue-50" : "bg-white"}`} key={item.receptionId} type="button" onClick={() => setSelectedId(item.receptionId)}><span className="font-bold">{item.receptionId}</span><span className="ml-2 text-sm text-slate-500">{item.customerName || "お客様情報未入力"} {item.deviceModel || ""}</span></button>)}
        </div>
        <button className="button w-full" type="button" onClick={proceedExisting}>この番号でお客様入力へ進む</button>
      </div>}
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
    </section>
  );

  if (step === "confirm") return (
    <section className="card mx-auto max-w-2xl space-y-4">
      <p className="text-sm font-bold text-blue-700">STEP 3</p>
      <h2 className="text-xl font-bold">受付内容の確認</h2>
      <dl className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
        <Confirm label="受付番号" value={issued?.receptionId} />
        <Confirm label="お名前" value={form.customerName} />
        <Confirm label="フリガナ" value={form.customerKana} />
        <Confirm label="連絡先" value={form.completeTel} />
        <Confirm label="住所" value={form.address} />
        <Confirm label="過去の修理歴" value={form.repairHistory} />
      </dl>
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
      <div className="flex justify-between gap-3">
        <button className="button-secondary" type="button" onClick={() => setStep("customer")}>修正する</button>
        <button className="button" disabled={pending} type="button" onClick={submit}>{pending ? "送信中..." : "この内容で送信する"}</button>
      </div>
    </section>
  );

  return (
    <form className="mx-auto max-w-2xl space-y-4" onSubmit={showConfirm}>
      <section className="card space-y-4">
        <p className="text-sm font-bold text-blue-700">STEP 2</p>
        <h2 className="text-xl font-bold">お客様情報</h2>
        <TextField label="お名前" name="customerName" required />
        <TextField label="フリガナ" name="customerKana" required />
        <TextField label="ご依頼端末の電話番号" name="deviceTel" />
        <TextField label="修理完了時の連絡先" name="completeTel" required />
        <TextField label="ご住所" name="address" />
      </section>
      <section className="card space-y-4">
        <h2 className="text-xl font-bold">修理確認事項</h2>
        <label><span className="label">過去の修理歴</span><select className="input" required value={String(form.repairHistory ?? "")} onChange={(event) => set("repairHistory", event.target.value)}><option value="">選択してください</option>{repairHistoryOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <TextField label="パスコード（任意）" name="passcode" />
        <p className="text-xs text-slate-500">修理前後の動作確認のため、パスコードを使用する場合があります。</p>
      </section>
      <section className="card space-y-4">
        <h2 className="text-xl font-bold">利用規約の同意</h2>
        <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm leading-6">
          <p>修理作業により、メーカー保証が受けられなくなる場合があります。</p>
          <p>データは基本そのままで作業しますが、データの変化・消失について保証するものではありません。</p>
          <p>端末の状態により、修理作業中に症状が悪化したり、起動しなくなる可能性があります。</p>
          <p>修理完了後の保管期限を過ぎた場合、規定に基づき処分となる場合があります。</p>
        </div>
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

  function TextField({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
    return <label><span className="label">{label}{required && <span className="ml-1 text-red-600">必須</span>}</span><input className="input" required={required} value={String(form[name] ?? "")} onChange={(event) => set(name, event.target.value)} /></label>;
  }
}

function Confirm({ label, value }: { label: string; value: unknown }) {
  return <div><dt className="font-bold text-slate-500">{label}</dt><dd className="mt-1">{String(value ?? "") || "未入力"}</dd></div>;
}
