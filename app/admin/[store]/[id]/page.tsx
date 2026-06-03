import { notFound } from "next/navigation";
import ReceptionDetail from "@/components/admin/ReceptionDetail";
import { isStoreName } from "@/lib/constants";
import { getReceptionById } from "@/lib/sheets";

export default async function DetailPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store, id } = await params;
  const decoded = decodeURIComponent(store);
  if (!isStoreName(decoded)) notFound();
  const reception = await getReceptionById(decoded, decodeURIComponent(id));
  if (!reception) notFound();
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-3xl font-bold">{reception.receptionId} 詳細編集</h1>
      <ReceptionDetail initial={reception} />
    </main>
  );
}
