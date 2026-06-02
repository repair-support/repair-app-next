import { notFound } from "next/navigation";
import ReceptionForm from "@/components/form/ReceptionForm";
import { isStoreName } from "@/lib/constants";

export default async function FormPage({ params }: { params: Promise<{ store: string }> }) {
  const { store } = await params;
  const decoded = decodeURIComponent(store);
  if (!isStoreName(decoded)) notFound();
  return <main className="p-4 sm:p-8"><h1 className="mx-auto mb-4 max-w-2xl text-2xl font-bold">{decoded} 受付フォーム</h1><ReceptionForm store={decoded} /></main>;
}
