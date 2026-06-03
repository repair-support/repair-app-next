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

export default async function PrintPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store, id } = await params;
  const decoded = decodeURIComponent(store);
  if (!isStoreName(decoded)) notFound();
  const data = await getReceptionById(decoded, decodeURIComponent(id));
  if (!data) notFound();
  const devices = parseDevices(data.devicesJson);
  const isPurchase = data.serviceType.includes("買取");

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
