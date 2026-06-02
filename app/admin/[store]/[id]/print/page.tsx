import { notFound } from "next/navigation";
import Image from "next/image";
import { isStoreName } from "@/lib/constants";
import { getReceptionById } from "@/lib/sheets";

export default async function PrintPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store, id } = await params;
  const decoded = decodeURIComponent(store);
  if (!isStoreName(decoded)) notFound();
  const data = await getReceptionById(decoded, decodeURIComponent(id));
  if (!data) notFound();
  return <main className="mx-auto max-w-[210mm] bg-white p-8 text-sm">
    <p className="no-print mb-6 rounded-lg bg-blue-50 p-3 font-bold text-blue-800">ブラウザの印刷機能を使用してください。</p>
    <h1 className="border-b pb-3 text-2xl font-bold">修理受付申込書</h1>
    <div className="mt-4 grid grid-cols-2 gap-3"><p>店舗: {data.storeName}</p><p>受付ID: {data.receptionId}</p><p>受付日時: {data.receptionDate}</p><p>お名前: {data.customerName}</p><p>連絡先: {data.completeTel}</p><p>端末: {data.deviceCategory} {data.deviceModel}</p></div>
    <section className="mt-6 rounded-lg border p-4"><h2 className="font-bold">症状・修理内容</h2><p className="mt-2">{data.symptom}</p><p>{data.repairContent}</p></section>
    <p className="mt-6 text-2xl font-bold">修理料金: {data.repairPrice || "未確定"}</p>
    {data.signatureData && <Image className="mt-6 max-h-36 border object-contain" src={data.signatureData} alt="署名" width={480} height={160} unoptimized />}
    <section className="mt-8 border-t pt-4 text-xs text-slate-600"><h2 className="font-bold">免責事項</h2><p className="mt-2">修理作業に伴うデータ消失等について、受付時に説明を受け同意しました。</p></section>
  </main>;
}
