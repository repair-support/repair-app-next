import { randomBytes } from "node:crypto";
import { google, sheets_v4 } from "googleapis";
import {
  DEFAULT_PURCHASE_STATUSES,
  DEFAULT_STATUSES,
  RECEPTION_HEADERS,
  STORE_CODE_MAP,
  STORE_NAMES,
  StoreName,
  isStoreName,
} from "@/lib/constants";
import { CostOption, CostReferenceData, MasterData, ModelCostOptions, Reception } from "@/lib/types";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const COST_SPREADSHEET_ID = process.env.COST_SPREADSHEET_ID || "19C4DBrD5WbLx77572NmtV4-AxNoRYS3vxAUz-S3e0Pc";

const fields: (keyof Omit<Reception, "rowNumber">)[] = [
  "receptionId", "receptionDate", "staffName", "repairStaff", "status", "deviceCategory",
  "deviceModel", "imei", "symptom", "repairContent", "repairPrice", "cost", "returnPlanDate",
  "customerKana", "customerName", "deviceTel", "completeTel", "internalMemo", "serviceType",
  "storeName", "returnDate", "notes", "address", "repairHistory", "passcode", "agreement",
  "signatureData", "repairCategory", "lastUpdated", "panelType", "smallPartsType",
  "waterproofTape", "warrantyStatus", "birthdate", "homeTel", "mobileTel", "email",
  "occupation", "idDocuments", "devicesJson", "paymentMethod", "coating", "temperedGlass",
  "updateToken", "purchaseAgreement", "color", "carrier", "simLock", "capacity",
  "usageRestriction", "rank", "repairParts", "btLevel", "accessories", "itemCount",
  "assessStaff",
];

function requireSpreadsheetId() {
  if (!SPREADSHEET_ID) throw new Error("SPREADSHEET_ID is not configured");
  return SPREADSHEET_ID;
}

export function getSheetsClient(): sheets_v4.Sheets {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!encoded) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function toReception(row: unknown[], rowNumber: number): Reception {
  const record = Object.fromEntries(fields.map((field, index) => [field, row[index] ?? ""])) as unknown as Reception;
  return { ...record, agreement: String(record.agreement).toLowerCase() === "true", rowNumber };
}

function toRow(data: Partial<Reception>): string[] {
  return fields.map((field) => field === "agreement" ? String(Boolean(data[field])) : String(data[field] ?? ""));
}

export async function getReceptions(storeName: string): Promise<Reception[]> {
  if (!isStoreName(storeName)) throw new Error("Invalid store name");
  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: requireSpreadsheetId(),
    range: `'${storeName}'!A2:BD`,
  });
  return (response.data.values ?? []).map((row, index) => toReception(row, index + 2));
}

export async function getReceptionById(storeName: string, receptionId: string) {
  return (await getReceptions(storeName)).find((item) => item.receptionId === receptionId) ?? null;
}

export async function issueReceptionId(storeName: StoreName): Promise<string> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: requireSpreadsheetId(),
    range: "設定!A2:B",
  });
  const values = response.data.values ?? [];
  const index = values.findIndex((row) => row[0] === storeName);
  if (index < 0) throw new Error("Store counter is not initialized");
  const next = Number(values[index][1] ?? 0) + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: requireSpreadsheetId(),
    range: `設定!B${index + 2}`,
    valueInputOption: "RAW",
    requestBody: { values: [[next]] },
  });
  return `${STORE_CODE_MAP[storeName]}-${String(next).padStart(4, "0")}`;
}

export async function createReception(storeName: string, initial: Partial<Reception>) {
  if (!isStoreName(storeName)) throw new Error("Invalid store name");
  const receptionId = await issueReceptionId(storeName);
  const now = new Date().toISOString();
  const data: Partial<Reception> = {
    ...initial,
    receptionId,
    storeName,
    receptionDate: now,
    lastUpdated: now,
    status: initial.status || "受付中",
    updateToken: randomBytes(24).toString("hex"),
  };
  const result = await getSheetsClient().spreadsheets.values.append({
    spreadsheetId: requireSpreadsheetId(),
    range: `'${storeName}'!A:BD`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [toRow(data)] },
  });
  const match = result.data.updates?.updatedRange?.match(/!(?:A)?(\d+):/);
  return { receptionId, rowNumber: Number(match?.[1] ?? 0), updateToken: data.updateToken! };
}

export async function updateReception(storeName: string, receptionId: string, data: Partial<Reception>) {
  const current = await getReceptionById(storeName, receptionId);
  if (!current) throw new Error("Reception not found");
  const updated = { ...current, ...data, receptionId, storeName, lastUpdated: new Date().toISOString() };
  await getSheetsClient().spreadsheets.values.update({
    spreadsheetId: requireSpreadsheetId(),
    range: `'${storeName}'!A${current.rowNumber}:BD${current.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [toRow(updated)] },
  });
  return updated;
}

export async function deleteReception(storeName: string, receptionId: string) {
  const current = await getReceptionById(storeName, receptionId);
  if (!current) throw new Error("Reception not found");
  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: requireSpreadsheetId() });
  const sheet = metadata.data.sheets?.find((item) => item.properties?.title === storeName);
  if (sheet?.properties?.sheetId === undefined) throw new Error("Store sheet not found");
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: requireSpreadsheetId(),
    requestBody: { requests: [{ deleteDimension: { range: {
      sheetId: sheet.properties.sheetId, dimension: "ROWS",
      startIndex: current.rowNumber - 1, endIndex: current.rowNumber,
    } } }] },
  });
  return current;
}

export async function getStatuses(): Promise<string[]> {
  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: requireSpreadsheetId(),
    range: "ステータス!A2:B",
  });
  return Array.from(new Set((response.data.values ?? []).flatMap((row) => [row[0], row[1]]).filter(Boolean)));
}

export async function getMasterData(): Promise<MasterData> {
  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: requireSpreadsheetId(),
    range: "マスターデータ!A2:D",
  });
  const result: MasterData = { categories: [], deviceMap: {}, repairMap: {}, modelRepairMap: {} };
  for (const [category, model, repair, modelRepair] of response.data.values ?? []) {
    if (category && !result.categories.includes(category)) result.categories.push(category);
    if (category && model) (result.deviceMap[category] ??= []).push(model);
    if (category && repair) (result.repairMap[category] ??= []).push(repair);
    if (model && modelRepair) (result.modelRepairMap[model] ??= []).push(modelRepair);
  }
  return result;
}

function numericCost(value: unknown) {
  if (typeof value === "number") return Math.round(value);
  return Number(String(value ?? "").replace(/[^\d.-]/g, "")) || 0;
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim();
}

function classifyCostOption(text: string) {
  if (/画面|液晶|パネル|有機EL|OLED/i.test(text)) return "screen";
  if (/バッテリー|電池|BT/i.test(text)) return "battery";
  if (/強化ガラス|保護ガラス|ガラスコーティング|コーティング/i.test(text)) return "glass";
  if (/スモール|パーツ|カメラ|スピーカー|コネクタ|ボタン|ドック|近接|センサー/i.test(text)) return "small";
  return "other";
}

function emptyModelCosts(): ModelCostOptions {
  return { screen: [], battery: [], small: [], glass: [], other: [] };
}

function pushUniqueOption(target: ModelCostOptions, bucket: keyof ModelCostOptions, option: CostOption) {
  if (!option.cost || !option.label) return;
  if (!target[bucket].some((current) => current.label === option.label && current.cost === option.cost)) {
    target[bucket].push(option);
  }
}

export async function getCostReferenceData(): Promise<CostReferenceData> {
  const result: CostReferenceData = { modelCosts: {}, smallParts: {} };
  if (!COST_SPREADSHEET_ID) return result;

  const sheets = getSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: COST_SPREADSHEET_ID });
  const titles = metadata.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean) as string[] | undefined;
  for (const title of titles ?? []) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: COST_SPREADSHEET_ID,
      range: `'${title}'!A1:Z`,
    });
    const values = response.data.values ?? [];
    if (values.length < 2) continue;

    const headers = values[0].map(normalizeHeader);
    const modelCol = headers.findIndex((header) => /機種|モデル|model/i.test(header));
    const repairCol = headers.findIndex((header) => /修理内容|内容|部品名|パーツ名|商品名|品名|repair|part/i.test(header));
    const categoryCol = headers.findIndex((header) => /カテゴリ|分類|種別|区分|category|type/i.test(header));
    const costCol = headers.findIndex((header) => /原価|仕入|価格|金額|cost|price/i.test(header));
    if (modelCol < 0 || costCol < 0) continue;

    for (const row of values.slice(1)) {
      const model = String(row[modelCol] ?? "").trim();
      if (!model) continue;
      const label = String(row[repairCol >= 0 ? repairCol : categoryCol] ?? row[categoryCol >= 0 ? categoryCol : repairCol] ?? "").trim();
      const type = String(row[categoryCol >= 0 ? categoryCol : repairCol] ?? label).trim();
      const cost = numericCost(row[costCol]);
      const bucket = classifyCostOption(`${type} ${label}`) as keyof ReturnType<typeof emptyModelCosts>;
      const modelCosts = result.modelCosts[model] ??= emptyModelCosts();
      pushUniqueOption(modelCosts, bucket, { type, label: label || type, cost });
      if (bucket === "small" && type) {
        const list = result.smallParts[type] ??= [];
        if (!list.some((current) => current.label === label && current.cost === cost)) list.push({ type, label: label || type, cost });
      }
    }
  }

  return result;
}

export async function setupSpreadsheet() {
  const sheets = getSheetsClient();
  const spreadsheetId = requireSpreadsheetId();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set(metadata.data.sheets?.map((sheet) => sheet.properties?.title));
  const titles = ["設定", ...STORE_NAMES, "マスターデータ", "ステータス"];
  const missing = titles.filter((title) => !existing.has(title));
  if (missing.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) },
    });
  }
  const data = [
    ...(!existing.has("設定") ? [{ range: "設定!A1:B13", values: [["店舗名", "受付ID連番"], ...STORE_NAMES.map((store) => [store, 0])] }] : []),
    ...STORE_NAMES.map((store) => ({ range: `'${store}'!A1:BD1`, values: [[...RECEPTION_HEADERS]] })),
    { range: "マスターデータ!A1:D1", values: [["端末カテゴリ", "機種名", "修理内容", "機種別修理内容"]] },
    {
      range: "ステータス!A1:B12",
      values: [
        ["修理ステータス", "買取ステータス"],
        ...Array.from({ length: Math.max(DEFAULT_STATUSES.length, DEFAULT_PURCHASE_STATUSES.length) }, (_, index) => [
          DEFAULT_STATUSES[index] ?? "",
          DEFAULT_PURCHASE_STATUSES[index] ?? "",
        ]),
      ],
    },
  ];
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
}
