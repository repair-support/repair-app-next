import Link from "next/link";
import { STORE_NAMES } from "@/lib/constants";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-8">
        <p className="text-sm font-bold text-blue-700">Repair Reception</p>
        <h1 className="text-3xl font-bold">修理受付アプリ</h1>
        <p className="mt-2 text-slate-600">受付を行う店舗を選択してください。</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STORE_NAMES.map((store) => (
          <Link className="card hover:border-blue-500" href={`/form/${encodeURIComponent(store)}`} key={store}>
            <span className="text-lg font-bold">{store}</span>
            <span className="mt-1 block text-sm text-slate-500">受付フォームを開く</span>
          </Link>
        ))}
      </div>
      <Link className="mt-8 inline-block text-sm font-bold text-blue-700" href="/admin">
        スタッフ管理画面へ
      </Link>
    </main>
  );
}
