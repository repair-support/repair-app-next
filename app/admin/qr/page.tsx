import QRCode from "qrcode";
import { STORE_NAMES } from "@/lib/constants";

function appBaseUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function qrDataUrl(text: string) {
  return QRCode.toDataURL(text, { margin: 1, width: 220 });
}

export default async function AdminQrPage() {
  const baseUrl = appBaseUrl();
  const rows = await Promise.all(STORE_NAMES.map(async (store) => {
    const formUrl = `${baseUrl}/form/${encodeURIComponent(store)}`;
    const adminUrl = `${baseUrl}/admin/${encodeURIComponent(store)}`;
    return {
      store,
      formUrl,
      adminUrl,
      formQr: await qrDataUrl(formUrl),
      adminQr: await qrDataUrl(adminUrl),
    };
  }));

  return (
    <main className="mx-auto max-w-[210mm] bg-white p-6 text-sm print:p-0">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-50 p-4">
        <div>
          <h1 className="text-2xl font-bold">店舗別QRコード一覧</h1>
          <p className="text-slate-600">受付フォームと管理画面のQRコードを印刷できます。</p>
        </div>
        <p className="rounded-lg bg-white px-4 py-2 font-bold text-blue-800">ブラウザの印刷機能で印刷してください</p>
      </div>

      <h1 className="mb-4 hidden text-center text-2xl font-bold print:block">店舗別 受付フォーム / 管理画面 QRコード一覧</h1>
      <div className="grid grid-cols-2 gap-4 print:gap-2">
        {rows.map((row) => (
          <section className="break-inside-avoid rounded-xl border border-slate-300 p-4 print:p-3" key={row.store}>
            <h2 className="text-center text-lg font-black">{row.store}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="mb-2 rounded bg-blue-700 px-2 py-1 text-xs font-bold text-white">受付フォーム</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="mx-auto h-28 w-28 print:h-24 print:w-24" src={row.formQr} alt={`${row.store} 受付フォーム QR`} />
                <p className="mt-2 break-all text-[10px] text-slate-500">{row.formUrl}</p>
              </div>
              <div>
                <p className="mb-2 rounded bg-slate-800 px-2 py-1 text-xs font-bold text-white">管理画面</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="mx-auto h-28 w-28 print:h-24 print:w-24" src={row.adminQr} alt={`${row.store} 管理画面 QR`} />
                <p className="mt-2 break-all text-[10px] text-slate-500">{row.adminUrl}</p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
