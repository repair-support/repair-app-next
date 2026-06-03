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

type Completion = { receptionId: string; qr?: string; updateUrl: string };

const repairHistoryOptions = ["他店で修理したことがある", "当店で修理を受けたことがある", "ない", "わからない"];

const standardTerms = [
  "修理作業により、メーカー保証が受けられなくなる場合があります。",
  "データは基本そのままで作業しますが、データの変化・消失について保証するものではありません。",
  "端末の状態により、修理作業中に症状が悪化したり、起動しなくなる可能性があります。",
  "修理完了後の保管期限を過ぎた場合、規定に基づき処分となる場合があります。",
];

const repairMasterTerms = [
  "症状によっては、お見積り前（検証作業中）に修理が完了する場合があります。その場合、作業料金が発生します。",
  "作業中、お預かり機器の故障状態が変化する場合があります。スタッフによる故意または重大な過失がある場合を除き、当店では弁済等を含め一切の責任を負いかねます。",
  "記憶媒体上に記録されたデータの変化・消失に関しては、いかなる場合も保証いたしかねます。",
  "メーカー独自の特殊部品など、部品入手が困難な場合は未修理返却となる場合があります。",
  "到着部品の不良や配送時の予期せぬトラブル等により、予定納期や見積内容が修理中に変わる場合があります。",
  "修理不可の場合は、所定の作業費を頂戴いたします。",
  "パーツ到着後、お客様都合で依頼をキャンセルされた場合は、パーツ代金の全額を頂戴いたします。",
  "修理依頼品の保管期限は修理完了日より30日間です。30日経過後は所有権放棄と判断し、依頼品を処分する場合があります。",
];

const brandTerms: Partial<Record<string, { warrantyDays: number; title: string }>> = {
  SWEEPMASTER: { warrantyDays: 30, title: "SWEEPMASTER 修理規約" },
  EarphoneMASTER: { warrantyDays: 8, title: "EarphoneMASTER 修理規約" },
};

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
      setCompletion({ receptionId: body.receptionId, qr: qrBody.dataUrl, updateUrl: url });
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
      <div className="mt-4 flex flex-col gap-2">
        <button className="button" type="button" onClick={() => printManagementLabel(completion)}>管理ラベルを印刷する</button>
        <button className="button-secondary" type="button" onClick={() => location.reload()}>次の受付へ</button>
      </div>
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

  function TextField({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
    return <label><span className="label">{label}{required && <span className="ml-1 text-red-600">必須</span>}</span><input className="input" required={required} value={String(form[name] ?? "")} onChange={(event) => set(name, event.target.value)} /></label>;
  }

  function printManagementLabel(done: Completion) {
    const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
    const row = (label: string, value: unknown) => value ? `<div class="irow"><span class="il">${label}</span><span class="iv">${escapeHtml(value)}</span></div>` : "";
    const now = new Date();
    const receivedAt = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const labelHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>管理ラベル</title><style>
@page{size:A5 landscape;margin:6mm}body{margin:0;font-family:"Yu Gothic",Meiryo,sans-serif;font-size:11px;color:#111;background:#fff}.wrap{width:100%;border:2px solid #111;border-radius:4px;overflow:hidden;display:flex;box-sizing:border-box}.left{flex:1;padding:8px 10px;border-right:2px solid #111;overflow:hidden}.right{width:210px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;gap:4px;flex-shrink:0}.meta{font-size:10px;color:#666;margin-bottom:3px}.name{font-size:20px;font-weight:900;margin-bottom:2px}.kana{font-size:11px;color:#444;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px}.rid{font-size:13px;font-weight:900;letter-spacing:1px;margin-bottom:6px;color:#c00}.section{font-size:9px;font-weight:700;color:#888;margin:5px 0 2px;text-transform:uppercase;letter-spacing:.5px}.irow{display:flex;gap:4px;margin-bottom:2px;align-items:flex-start}.il{color:#555;font-size:9px;min-width:60px;padding-top:1px;flex-shrink:0}.iv{font-weight:700;flex:1;word-break:break-all;line-height:1.3}.symptom{background:#fff8e1;border:1px solid #ffe082;border-radius:3px;padding:4px 6px;margin-top:4px;font-size:10px;line-height:1.4;font-weight:700}.hw-section{margin-top:8px;padding-top:6px;border-top:1.5px solid #111}.hw-title{font-size:9px;font-weight:700;color:#888;margin-bottom:4px}.hw-row{display:flex;align-items:flex-end;gap:6px;margin-bottom:6px;max-width:260px}.hw-label{font-size:9px;color:#555;min-width:64px;flex-shrink:0;padding-bottom:2px}.hw-line{flex:1;border-bottom:1.5px solid #555;min-height:18px;min-width:80px}.hw-unit{font-size:9px;color:#555;flex-shrink:0;padding-bottom:2px}.qr-cap{font-size:9px;color:#555;text-align:center;line-height:1.4}.qr{width:200px;height:200px;object-fit:contain}@media print{.pbtn{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div style="text-align:center;margin-bottom:6px;"><button class="pbtn" onclick="window.print()" style="border:none;border-radius:6px;padding:7px 18px;font-size:13px;font-weight:700;color:#fff;background:#333;cursor:pointer;">印刷する</button></div><div class="wrap"><div class="left"><div class="meta">${escapeHtml(store)}　ラベル発行：${receivedAt}</div><div class="name">${escapeHtml(form.customerName || "（未入力）")}</div><div class="kana">${escapeHtml(form.customerKana || "　")}</div><div class="rid">${escapeHtml(done.receptionId)}</div><div class="section">端末情報</div>${row("サービス", serviceType)}<div class="section">お客様情報</div>${row("電話番号", form.deviceTel)}${row("連絡先", form.completeTel)}${row("住所", form.address)}${row("修理歴", form.repairHistory)}${row("パスコード", form.passcode)}<div class="hw-section"><div class="hw-title">手書きメモ欄</div><div class="hw-row"><span class="hw-label">端末</span><span class="hw-line"></span></div><div class="hw-row"><span class="hw-label">修理内容</span><span class="hw-line"></span></div><div class="hw-row"><span class="hw-label">修理金額</span><span class="hw-line"></span><span class="hw-unit">円</span></div><div class="hw-row"><span class="hw-label">来店予定日</span><span class="hw-line"></span></div></div></div><div class="right">${done.qr ? `<img class="qr" src="${done.qr}" alt="QR">` : `<div>${escapeHtml(done.updateUrl)}</div>`}<div class="qr-cap">QRを読み込んで<br>修理状況を更新</div></div></div></body></html>`;
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

function Confirm({ label, value }: { label: string; value: unknown }) {
  return <div><dt className="font-bold text-slate-500">{label}</dt><dd className="mt-1">{String(value ?? "") || "未入力"}</dd></div>;
}

function AgreementBox({ serviceType, store }: { serviceType: string; store: string }) {
  const brand = brandTerms[serviceType];
  if (store === "青森店" && serviceType === "ダイワンテレコム") {
    return <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm leading-6">
      <p className="font-bold">利用規約・修理に関する注意事項の動画をご確認ください。</p>
      <div className="aspect-video overflow-hidden rounded-xl bg-black">
        <iframe className="h-full w-full" src="https://www.youtube.com/embed/ijqAbHncTM0" title="利用規約・修理に関する注意事項" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
      </div>
      <p className="text-xs text-slate-500">動画をご確認いただいたうえで、同意チェックをお願いいたします。</p>
    </div>;
  }
  if (brand) {
    return <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm leading-6">
      <p className="font-bold">{brand.title}</p>
      <p><strong>1. 修理サービス</strong><br />当社の修理サービスは、お客様からお預かりした機器等を、お客様ご指摘の症状に対して復旧・改善するよう修理または作業を行うことを目的とします。</p>
      <p><strong>2. 時間目安</strong><br />提示する修理時間は当店実績をもとにした目安であり、機器の状態によっては修理時間が想定より長くなる場合があります。</p>
      <p><strong>3. 保証と保管期限</strong><br />修理完了後、交換部品の不具合または当社作業内容の不備による不具合が発生した場合、{brand.warrantyDays}日以内のお申し出に限り無償対応します。修理依頼品の保管期限は修理完了連絡日より30日間です。</p>
      <p><strong>4. 個人情報の取扱</strong><br />取得した個人情報は、修理サービスに関する情報提供・発送案内・ご注文に関するお知らせ等に使用します。</p>
    </div>;
  }
  const terms = serviceType === "リペアマスター" || serviceType === "SwitchMaster" ? repairMasterTerms : standardTerms;
  return <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm leading-6">
    {terms.map((term) => <p key={term}>{term}</p>)}
  </div>;
}
