import { randomBytes } from "node:crypto";
import { google, sheets_v4 } from "googleapis";
import {
  DEFAULT_STATUSES,
  RECEPTION_HEADERS,
  STORE_CODE_MAP,
  STORE_NAMES,
  StoreName,
  isStoreName,
} from "@/lib/constants";
import { MasterData, Reception } from "@/lib/types";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

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
    range: "ステータス!A2:A",
  });
  return (response.data.values ?? []).map((row) => row[0]).filter(Boolean);
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
    { range: "ステータス!A1:A12", values: [["修理ステータス"], ...DEFAULT_STATUSES.map((status) => [status])] },
  ];
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
}
