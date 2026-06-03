import Link from "next/link";
import SetupSpreadsheetButton from "@/components/admin/SetupSpreadsheetButton";
import { STORE_NAMES } from "@/lib/constants";

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-3xl font-bold">店舗管理</h1>
      <SetupSpreadsheetButton />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STORE_NAMES.map((store) => (
          <Link className="card font-bold hover:border-blue-500" href={`/admin/${encodeURIComponent(store)}`} key={store}>
            {store}
          </Link>
        ))}
      </div>
    </main>
  );
}
