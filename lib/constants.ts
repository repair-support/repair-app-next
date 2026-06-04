export const STORE_NAMES = [
  "青森店",
  "盛岡店",
  "長岡店",
  "宇都宮店",
  "成田店",
  "幕張店",
  "五反田店",
  "錦糸町店",
  "菖蒲店",
  "岐阜店",
  "大分店",
  "木津川店",
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

export const STORE_CODE_MAP: Record<StoreName, string> = {
  青森店: "AO",
  盛岡店: "MO",
  長岡店: "NG",
  宇都宮店: "UT",
  成田店: "NA",
  幕張店: "MA",
  五反田店: "GO",
  錦糸町店: "KI",
  菖蒲店: "SH",
  岐阜店: "GI",
  大分店: "OI",
  木津川店: "KZ",
};

export const SERVICE_TYPES = ["修理受付", "買取査定", "郵送受付"] as const;

export const SERVICE_BRANDS = [
  "ダイワンテレコム",
  "SWEEPMASTER",
  "EarphoneMASTER",
  "リペアマスター",
  "SwitchMaster",
  "ダイワンテレコム 買取",
] as const;

export const COMMON_RECEPTION_OPTIONS = ["郵送受付", "ダイワン送付", "Mac郵送", "Fixmart", "パーツマスター", "FYL"] as const;

export const DEFAULT_STAFF_MAP: Partial<Record<StoreName, string[]>> = {
  青森店: ["中村", "成田", "浅利", "鳥谷部", "高橋"],
};

export const DEFAULT_STATUSES = [
  "受付中",
  "受付済み",
  "見積中",
  "連絡待ち",
  "パーツ発注中",
  "修理中",
  "修理完了",
  "申込書発行済",
  "来店予定",
  "返却済み",
  "キャンセル",
] as const;

export const DEFAULT_PURCHASE_STATUSES = [
  "査定受付中",
  "査定済み",
  "未出品",
  "出品中",
  "売却済み",
  "返却済み",
  "キャンセル",
] as const;

export const RECEPTION_HEADERS = [
  "受付ID", "受付日時", "受付担当", "修理担当者", "ステータス", "端末カテゴリ",
  "機種名", "IMEI", "症状", "修理内容", "修理料金", "原価", "来店予定日",
  "フリガナ", "お名前", "ご依頼端末の電話番号", "修理完了時の連絡先", "店舗内メモ",
  "サービス種別", "店舗名", "返却日", "追記事項", "住所", "過去の修理歴",
  "パスコード", "同意チェック", "署名データ", "修理カテゴリ", "最終更新日時",
  "パネル種別", "スモールパーツ種別", "防水テープ施工", "保証有無", "生年月日",
  "自宅電話", "携帯電話", "メールアドレス", "ご職業", "本人確認書類",
  "端末データJSON", "決済方法", "コーティング", "強化ガラス", "QR更新トークン",
  "買取承諾", "色", "キャリア", "SIMロック", "容量", "利用制限", "ランク", "修理箇所",
  "BT残量", "付属品", "品目数", "査定員",
] as const;

export function isStoreName(value: string): value is StoreName {
  return STORE_NAMES.includes(value as StoreName);
}

export function storeFromReceptionId(id: string): StoreName | null {
  const code = id.split("-")[0];
  return STORE_NAMES.find((store) => STORE_CODE_MAP[store] === code) ?? null;
}
