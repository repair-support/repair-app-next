import { notFound } from "next/navigation";
import Image from "next/image";
import { isStoreName } from "@/lib/constants";
import { getReceptionById } from "@/lib/sheets";
import type { Device } from "@/lib/types";

function valueOrPending(value: string | undefined) {
  return value || "未確定";
}

function parseDevices(value: string): Device[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });
}

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string; id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { store, id } = await params;
  const { type = "application" } = await searchParams;
  const decoded = decodeURIComponent(store);
  if (!isStoreName(decoded)) notFound();
  const data = await getReceptionById(decoded, decodeURIComponent(id));
  if (!data) notFound();
  const devices = parseDevices(data.devicesJson);
  const isPurchase = data.serviceType.includes("買取");
  const primary = devices[0] ?? {
    category: data.deviceCategory,
    model: data.deviceModel,
    imei: data.imei,
    symptom: data.symptom,
    repairContent: data.repairContent,
    repairPrice: data.repairPrice,
    cost: data.cost,
  };

  if (type === "label") {
    return (
      <main className="mx-auto max-w-[210mm] bg-white p-4 text-xs">
        <p className="no-print mb-3 rounded-lg bg-blue-50 p-3 font-bold text-blue-800">ブラウザの印刷機能を使用してください。</p>
        <section className="flex min-h-[120mm] overflow-hidden rounded border-2 border-slate-900">
          <div className="flex-1 border-r-2 border-slate-900 p-4">
            <p className="text-[11px] text-slate-500">{data.storeName} / ラベル発行: {formatDate(new Date().toISOString())}</p>
            <p className="mt-3 text-3xl font-black">{data.customerName || "（未入力）"}</p>
            <p className="border-b pb-2 text-sm text-slate-600">{data.customerKana || "　"}</p>
            <p className="mt-4 text-2xl font-black text-red-700">{data.receptionId}</p>
            <div className="mt-4 space-y-1">
              <p><span className="font-bold text-slate-500">サービス:</span> {data.serviceType}</p>
              <p><span className="font-bold text-slate-500">端末:</span> {primary.category || data.deviceCategory} {primary.model || data.deviceModel}</p>
              <p><span className="font-bold text-slate-500">{isPurchase ? "査定金額" : "修理料金"}:</span> {valueOrPending(primary.repairPrice || data.repairPrice)}</p>
              <p><span className="font-bold text-slate-500">連絡先:</span> {data.completeTel || data.deviceTel}</p>
              {!isPurchase && <p><span className="font-bold text-slate-500">パスコード:</span> {data.passcode}</p>}
            </div>
            <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 font-bold">{primary.symptom || data.symptom}</p>
          </div>
          <div className="flex w-48 flex-col items-center justify-center p-4 text-center">
            <p className="text-sm font-bold">受付ID</p>
            <p className="mt-2 text-xl font-black">{data.receptionId}</p>
            <p className="mt-5 text-xs text-slate-600">QR更新URLは受付完了画面で発行されたものを使用してください。</p>
          </div>
        </section>
      </main>
    );
  }

  if (type === "receipt") {
    return (
      <main className="mx-auto max-w-[148mm] bg-white p-6 text-sm">
        <p className="no-print mb-4 rounded-lg bg-blue-50 p-3 font-bold text-blue-800">ブラウザの印刷機能を使用してください。</p>
        <h1 className="border-b pb-3 text-2xl font-black">{isPurchase ? "買取受付控え" : "修理受付控え"}</h1>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <p>店舗: {data.storeName}</p>
          <p>受付ID: <span className="font-black">{data.receptionId}</span></p>
          <p>受付日時: {formatDate(data.receptionDate)}</p>
          <p>担当: {data.staffName}</p>
          <p>お名前: {data.customerName}</p>
          <p>連絡先: {data.completeTel || data.deviceTel}</p>
          <p className="col-span-2">端末: {primary.category || data.deviceCategory} {primary.model || data.deviceModel}</p>
          <p className="col-span-2">IMEI / シリアル: {primary.imei || data.imei}</p>
        </div>
        <section className="mt-5 rounded-lg border p-4">
          <h2 className="font-bold">{isPurchase ? "査定内容" : "修理内容"}</h2>
          <p className="mt-2 whitespace-pre-wrap">{primary.symptom || data.symptom}</p>
          {!isPurchase && <p className="mt-2 whitespace-pre-wrap">{primary.repairContent || data.repairContent}</p>}
          <p className="mt-4 text-2xl font-black">{isPurchase ? "査定金額" : "修理料金"}: {valueOrPending(primary.repairPrice || data.repairPrice)}</p>
        </section>
        <section className="mt-5 rounded-lg bg-slate-50 p-4 text-xs leading-6">
          <p className="font-bold">ご案内</p>
          <p>{isPurchase ? "査定結果や本人確認内容により、買取条件が変更または買取不可となる場合があります。" : "修理内容、端末状態、部品入荷状況により、金額や納期が変更となる場合があります。"}</p>
          <p>お問い合わせの際は受付IDをスタッフへお伝えください。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[210mm] bg-white p-8 text-sm">
      <p className="no-print mb-6 rounded-lg bg-blue-50 p-3 font-bold text-blue-800">
        ブラウザの印刷機能を使用してください。
      </p>
      <h1 className="border-b pb-3 text-2xl font-bold">{isPurchase ? "買取申込書・承諾書" : "修理受付申込書"}</h1>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <p>店舗: {data.storeName}</p>
        <p>受付ID: {data.receptionId}</p>
        <p>受付日時: {data.receptionDate}</p>
        <p>お名前: {data.customerName}</p>
        <p>フリガナ: {data.customerKana}</p>
        <p>連絡先: {data.completeTel}</p>
        <p>依頼端末の電話番号: {data.deviceTel}</p>
        <p>端末: {data.deviceCategory} {data.deviceModel}</p>
        <p>IMEI / シリアル: {data.imei}</p>
        <p>来店予定日: {data.returnPlanDate}</p>
        {isPurchase && <p>生年月日: {data.birthdate}</p>}
        {isPurchase && <p>職業: {data.occupation}</p>}
        {isPurchase && <p>本人確認書類: {data.idDocuments}</p>}
        {isPurchase && <p>買取承諾: {data.purchaseAgreement}</p>}
      </div>
      {isPurchase ? (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="font-bold">買取査定内容</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <p>査定員: {valueOrPending(data.assessStaff)}</p>
            <p>品目数: {valueOrPending(data.itemCount)}</p>
            <p>色: {valueOrPending(data.color)}</p>
            <p>キャリア: {valueOrPending(data.carrier)}</p>
            <p>SIMロック: {valueOrPending(data.simLock)}</p>
            <p>容量: {valueOrPending(data.capacity)}</p>
            <p>利用制限: {valueOrPending(data.usageRestriction)}</p>
            <p>ランク: {valueOrPending(data.rank)}</p>
            <p>BT残量: {valueOrPending(data.btLevel)}</p>
            <p>決済方法: {valueOrPending(data.paymentMethod)}</p>
          </div>
          <p className="mt-3 whitespace-pre-wrap">状態・修理箇所: {valueOrPending(data.repairParts)}</p>
          <p className="mt-3 whitespace-pre-wrap">付属品: {valueOrPending(data.accessories)}</p>
          <p className="mt-3 whitespace-pre-wrap">査定メモ: {valueOrPending(data.symptom)}</p>
        </section>
      ) : (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="font-bold">症状・修理内容</h2>
          <p className="mt-2 whitespace-pre-wrap">{data.symptom}</p>
          <p className="mt-2 whitespace-pre-wrap">{data.repairContent}</p>
        </section>
      )}
      {devices.length > 1 && (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="font-bold">複数端末情報</h2>
          <div className="mt-3 space-y-3">
            {devices.map((device, index) => (
              <div className="rounded-lg bg-slate-50 p-3" key={index}>
                <p className="font-bold">端末 {index + 1}: {device.category} {device.model}</p>
                <p>IMEI / シリアル: {device.imei}</p>
                <p>{isPurchase ? "査定メモ" : "症状"}: {device.symptom}</p>
                {!isPurchase && <p>修理内容: {device.repairContent}</p>}
                <p>{isPurchase ? "査定金額" : "修理料金"}: {valueOrPending(device.repairPrice)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="mt-6 text-2xl font-bold">{isPurchase ? "査定金額" : "修理料金"}: {valueOrPending(data.repairPrice)}</p>
      {data.signatureData && (
        <Image className="mt-6 max-h-36 border object-contain" src={data.signatureData} alt="署名" width={480} height={160} unoptimized />
      )}
      <section className="mt-8 border-t pt-4 text-xs text-slate-600">
        <h2 className="font-bold">{isPurchase ? "買取確認事項" : "免責事項"}</h2>
        <p className="mt-2">
          {isPurchase
            ? "本人確認書類と申込内容を確認し、端末の正当な所有者として買取条件に承諾しました。"
            : "修理作業に伴うデータ消失等について、受付時に説明を受け同意しました。"}
        </p>
      </section>
    </main>
  );
}
