import { notFound } from "next/navigation";
import ReceptionList from "@/components/admin/ReceptionList";
import { isStoreName } from "@/lib/constants";
import { getReceptions } from "@/lib/sheets";

export default async function StoreAdminPage({ params }: { params: Promise<{ store: string }> }) {
  const { store } = await params;
  const decoded = decodeURIComponent(store);
  if (!isStoreName(decoded)) notFound();
  return <main className="mx-auto max-w-5xl p-6"><h1 className="mb-6 text-3xl font-bold">{decoded} 受付一覧</h1><ReceptionList initial={await getReceptions(decoded)} store={decoded} /></main>;
}
