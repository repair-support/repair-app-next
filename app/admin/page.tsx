import Link from "next/link";
import CustomerManagementLinks from "@/components/admin/CustomerManagementLinks";
import MasterDataPanel from "@/components/admin/MasterDataPanel";
import SetupSpreadsheetButton from "@/components/admin/SetupSpreadsheetButton";
import StatusSettingsPanel from "@/components/admin/StatusSettingsPanel";
import { STORE_NAMES } from "@/lib/constants";

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-3xl font-bold">店舗管理</h1>
      <SetupSpreadsheetButton />
      <MasterDataPanel />
      <StatusSettingsPanel />
      <CustomerManagementLinks />
      <Link className="card mb-6 font-bold text-blue-700 hover:border-blue-500" href="/admin/qr">
        店舗別QRコード一覧を印刷
      </Link>
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
