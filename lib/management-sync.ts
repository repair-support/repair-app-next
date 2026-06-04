import { google, type sheets_v4 } from "googleapis";
import { getGoogleAuth, getSheetsClient } from "@/lib/sheets";
import type { Device, Reception } from "@/lib/types";

const MAIN_SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const PURCHASE_MGMT_SPREADSHEET_ID =
  process.env.PURCHASE_MGMT_SPREADSHEET_ID || "1RM5t_deiYb1vbEBDb5Kq1VRQ0dfdwmYNOWuC6KvrO_w";

const CUSTOMER_MGMT_SHEET_NAME = "顧客管理";
const CUSTOMER_MGMT_ID_HEADER = "受付ID(管理用)";
const CUSTOMER_MGMT_LINKS_SHEET_NAME = "顧客管理表一覧";
const CUSTOMER_MGMT_LINK_HEADERS = ["店舗名", "年月", "スプレッドシートID", "URL", "更新日時"] as const;

const CUSTOMER_MGMT_HEADERS = [
  "No.",
  "受付日",
  "返却日",
  "店舗名",
  "受付ID",
  "お名前",
  "フリガナ",
  "電話番号",
  "修理カテゴリー",
  "修理端末",
  "IMEI / シリアル / モデル",
  "受注者",
  "修理担当者",
  "修理内容",
  "パネル 種類",
  "スモールパーツ",
  "防水テープ",
  "保証有無",
  "修理料金",
  "原価",
  "コーティング",
  "強化ガラス",
  "備考",
  CUSTOMER_MGMT_ID_HEADER,
] as const;

const CUSTOMER_FIELD_MAP: Record<string, keyof Reception | "phone" | "device" | "managedId" | "receptionDateOnly" | "returnDateOnly"> = {
  "受付日": "receptionDateOnly",
  "受付日時": "receptionDateOnly",
  "返却日": "returnDateOnly",
  "店舗名": "storeName",
  "受付ID": "receptionId",
  "お名前": "customerName",
  "顧客名": "customerName",
  "フリガナ": "customerKana",
  "電話番号": "phone",
  "修理カテゴリー": "repairCategory",
  "修理カテゴリ": "repairCategory",
  "修理端末": "device",
  "IMEI / シリアル / モデル": "imei",
  "IMEI": "imei",
  "受注者": "staffName",
  "受付担当": "staffName",
  "修理担当者": "repairStaff",
  "修理内容": "repairContent",
  "パネル 種類": "panelType",
  "パネル種別": "panelType",
  "スモールパーツ": "smallPartsType",
  "スモールパーツ種別": "smallPartsType",
  "防水テープ": "waterproofTape",
  "防水テープ施工": "waterproofTape",
  "保証有無": "warrantyStatus",
  "修理料金": "repairPrice",
  "原価": "cost",
  "コーティング": "coating",
  "強化ガラス": "temperedGlass",
  "備考": "notes",
  "追記事項": "notes",
  [CUSTOMER_MGMT_ID_HEADER]: "managedId",
};

const PURCHASE_HEADERS = [
  "受付ID",
  "買取成立日",
  "店舗名",
  "査定員",
  "お名前",
  "フリガナ",
  "電話番号",
  "機種名",
  "IMEI",
  "査定金額",
  "色",
  "キャリア",
  "SIMロック",
  "容量",
  "利用制限",
  "ランク",
  "修理箇所",
  "BT残量",
  "付属品",
  "本人確認書類",
  "買取承諾",
  "支払方法",
  "備考",
] as const;

function parseDevices(value: string): Device[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dateOnly(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function yenNumber(value: string) {
  const number = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) && number !== 0 ? number : "";
}

function storeSheetName(storeName: string) {
  return storeName.replace(/店$/, "");
}

function parseCustomerMgmtSpreadsheetIds() {
  const raw = process.env.CUSTOMER_MGMT_SPREADSHEET_IDS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== ""),
    );
  } catch {
    return {};
  }
}

const CONFIGURED_CUSTOMER_MGMT_SPREADSHEET_IDS = parseCustomerMgmtSpreadsheetIds();

function managementShareEmails() {
  return Array.from(new Set([
    process.env.ADMIN_EMAIL,
    ...(process.env.ALLOWED_EMAILS ?? "").split(","),
  ]
    .map((email) => email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email))));
}

function monthKey(value: string) {
  const date = value ? new Date(value) : new Date();
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  });
  return formatter.format(validDate);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return `${year}年${Number(month)}月`;
}

function customerMgmtTargetDate(reception: Pick<Reception, "returnDate" | "receptionDate" | "lastUpdated">) {
  return reception.returnDate || reception.receptionDate || reception.lastUpdated;
}

function colNumToLetter(n: number) {
  let result = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    n = Math.floor((n - mod) / 26);
  }
  return result;
}

async function ensureSheet(sheets: sheets_v4.Sheets, spreadsheetId: string, title: string) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = metadata.data.sheets?.find((sheet) => sheet.properties?.title === title);
  if (existing?.properties?.sheetId !== undefined) return existing.properties.sheetId;
  const created = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  return created.data.replies?.[0]?.addSheet?.properties?.sheetId;
}

async function readValues(sheets: sheets_v4.Sheets, spreadsheetId: string, range: string) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return response.data.values ?? [];
}

async function setupCustomerMgmtLinksSheet(sheets: sheets_v4.Sheets) {
  if (!MAIN_SPREADSHEET_ID) return;
  await ensureSheet(sheets, MAIN_SPREADSHEET_ID, CUSTOMER_MGMT_LINKS_SHEET_NAME);
  const values = await readValues(sheets, MAIN_SPREADSHEET_ID, `'${CUSTOMER_MGMT_LINKS_SHEET_NAME}'!A1:E1`);
  if ((values[0] ?? []).join("") === "") {
    await sheets.spreadsheets.values.update({
      spreadsheetId: MAIN_SPREADSHEET_ID,
      range: `'${CUSTOMER_MGMT_LINKS_SHEET_NAME}'!A1:E1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...CUSTOMER_MGMT_LINK_HEADERS]] },
    });
  }
}

async function findCustomerMgmtLink(sheets: sheets_v4.Sheets, storeName: string, key: string) {
  if (!MAIN_SPREADSHEET_ID) return undefined;
  await setupCustomerMgmtLinksSheet(sheets);
  const rows = await readValues(sheets, MAIN_SPREADSHEET_ID, `'${CUSTOMER_MGMT_LINKS_SHEET_NAME}'!A2:E`);
  const index = rows.findIndex((row) => String(row[0] ?? "") === storeName && String(row[1] ?? "") === key);
  if (index < 0) return undefined;
  const row = rows[index];
  const spreadsheetId = String(row[2] ?? "");
  if (!spreadsheetId) return undefined;
  return {
    rowNumber: index + 2,
    spreadsheetId,
    url: String(row[3] ?? ""),
  };
}

async function saveCustomerMgmtLink(
  sheets: sheets_v4.Sheets,
  storeName: string,
  key: string,
  spreadsheetId: string,
  url: string,
  rowNumber?: number,
) {
  if (!MAIN_SPREADSHEET_ID) return;
  await setupCustomerMgmtLinksSheet(sheets);
  const values = [[storeName, key, spreadsheetId, url, new Date().toISOString()]];
  if (rowNumber) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: MAIN_SPREADSHEET_ID,
      range: `'${CUSTOMER_MGMT_LINKS_SHEET_NAME}'!A${rowNumber}:E${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
    return;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: MAIN_SPREADSHEET_ID,
    range: `'${CUSTOMER_MGMT_LINKS_SHEET_NAME}'!A:E`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}

async function createCustomerMgmtSpreadsheet(sheets: sheets_v4.Sheets, storeName: string, key: string) {
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `${storeSheetName(storeName)} 顧客管理表 ${monthLabel(key)}`,
      },
    },
  });
  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("顧客管理表の作成に失敗しました");
  await shareSpreadsheetWithManagers(spreadsheetId);
  return {
    spreadsheetId,
    url: created.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

async function shareSpreadsheetWithManagers(spreadsheetId: string) {
  const emails = managementShareEmails();
  if (!emails.length) return;
  try {
    const auth = getGoogleAuth([
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ]);
    const drive = google.drive({ version: "v3", auth });
    for (const emailAddress of emails) {
      await drive.permissions.create({
        fileId: spreadsheetId,
        sendNotificationEmail: false,
        requestBody: {
          type: "user",
          role: "writer",
          emailAddress,
        },
      });
    }
  } catch (error) {
    console.warn("Customer management spreadsheet sharing failed:", error);
  }
}

async function getCustomerMgmtTarget(
  sheets: sheets_v4.Sheets,
  reception: Pick<Reception, "storeName" | "returnDate" | "receptionDate" | "lastUpdated">,
) {
  const storeName = reception.storeName || "未設定";
  const key = monthKey(customerMgmtTargetDate(reception));
  const configuredId = CONFIGURED_CUSTOMER_MGMT_SPREADSHEET_IDS[storeName] ?? CONFIGURED_CUSTOMER_MGMT_SPREADSHEET_IDS[storeSheetName(storeName)];
  if (configuredId) {
    const url = `https://docs.google.com/spreadsheets/d/${configuredId}`;
    const existing = await findCustomerMgmtLink(sheets, storeName, key);
    await saveCustomerMgmtLink(sheets, storeName, key, configuredId, url, existing?.rowNumber);
    return { spreadsheetId: configuredId, url };
  }

  const existing = await findCustomerMgmtLink(sheets, storeName, key);
  if (existing) return existing;

  const created = await createCustomerMgmtSpreadsheet(sheets, storeName, key);
  await saveCustomerMgmtLink(sheets, storeName, key, created.spreadsheetId, created.url);
  return created;
}

export async function getCustomerMgmtLinks() {
  if (!MAIN_SPREADSHEET_ID) return [];
  const sheets = getSheetsClient();
  await setupCustomerMgmtLinksSheet(sheets);
  const rows = await readValues(sheets, MAIN_SPREADSHEET_ID, `'${CUSTOMER_MGMT_LINKS_SHEET_NAME}'!A2:E`);
  return rows
    .filter((row) => row.some(Boolean))
    .map((row) => ({
      storeName: String(row[0] ?? ""),
      month: String(row[1] ?? ""),
      spreadsheetId: String(row[2] ?? ""),
      url: String(row[3] ?? ""),
      updatedAt: String(row[4] ?? ""),
    }));
}

async function setupCustomerMgmtSheet(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  await ensureSheet(sheets, spreadsheetId, CUSTOMER_MGMT_SHEET_NAME);
  const values = await readValues(sheets, spreadsheetId, `'${CUSTOMER_MGMT_SHEET_NAME}'!A1:BT3`);
  const rowWithIdHeader = values.find((row) => row.includes(CUSTOMER_MGMT_ID_HEADER));
  if (rowWithIdHeader) return;
  if ((values[1] ?? []).some(Boolean)) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${CUSTOMER_MGMT_SHEET_NAME}'!A2:X2`,
    valueInputOption: "RAW",
    requestBody: { values: [[...CUSTOMER_MGMT_HEADERS]] },
  });
}

async function getCustomerMgmtLayout(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  await setupCustomerMgmtSheet(sheets, spreadsheetId);
  const headerCandidates = await readValues(sheets, spreadsheetId, `'${CUSTOMER_MGMT_SHEET_NAME}'!A1:BT3`);
  const headerIndex = headerCandidates.findIndex((row) => row.includes(CUSTOMER_MGMT_ID_HEADER));
  const fallbackIndex = headerCandidates.findIndex((row) => row.includes("お名前") || row.includes("顧客名"));
  const index = headerIndex >= 0 ? headerIndex : Math.max(fallbackIndex, 1);
  let headers = headerCandidates[index] ?? [...CUSTOMER_MGMT_HEADERS];
  if (!headers.includes(CUSTOMER_MGMT_ID_HEADER)) {
    headers = [...headers, CUSTOMER_MGMT_ID_HEADER];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${CUSTOMER_MGMT_SHEET_NAME}'!${colNumToLetter(headers.length)}${index + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[CUSTOMER_MGMT_ID_HEADER]] },
    });
  }
  const idIndex = headers.indexOf(CUSTOMER_MGMT_ID_HEADER);
  return {
    headers,
    headerRow: index + 1,
    firstDataRow: index + 2,
    idIndex,
    lastColumn: colNumToLetter(headers.length),
  };
}

function customerSourceRows(reception: Reception) {
  const devices = parseDevices(reception.devicesJson);
  const sourceDevices = devices.length > 0 ? devices : [{
    category: reception.deviceCategory,
    model: reception.deviceModel,
    imei: reception.imei,
    symptom: reception.symptom,
    repairContent: reception.repairContent,
    repairPrice: reception.repairPrice,
    cost: reception.cost,
  }];

  return sourceDevices.map((device, index) => {
    const managedId = index === 0 ? reception.receptionId : `${reception.receptionId}#${index + 1}`;
    return {
      ...reception,
      deviceCategory: device.category || reception.deviceCategory,
      deviceModel: device.model || reception.deviceModel,
      imei: device.imei || reception.imei,
      repairContent: device.repairContent || reception.repairContent,
      repairPrice: device.repairPrice || reception.repairPrice,
      cost: device.cost || reception.cost,
      managedId,
      phone: reception.completeTel || reception.deviceTel || reception.mobileTel,
      device: `${device.category || reception.deviceCategory} ${device.model || reception.deviceModel}`.trim(),
      receptionDateOnly: dateOnly(reception.receptionDate),
      returnDateOnly: dateOnly(reception.returnDate),
    };
  });
}

function customerRowFromHeaders(headers: unknown[], source: ReturnType<typeof customerSourceRows>[number]) {
  return headers.map((rawHeader) => {
    const header = String(rawHeader ?? "").trim();
    if (header === "No.") return "";
    const field = CUSTOMER_FIELD_MAP[header];
    if (!field) return "";
    const value = source[field as keyof typeof source];
    if (field === "repairPrice" || field === "cost") return yenNumber(String(value ?? ""));
    return value ?? "";
  });
}

export async function syncReceptionToCustomerMgmt(reception: Reception) {
  if (!MAIN_SPREADSHEET_ID) return;
  const sheets = getSheetsClient();
  const target = await getCustomerMgmtTarget(sheets, reception);
  const layout = await getCustomerMgmtLayout(sheets, target.spreadsheetId);
  const rows = await readValues(sheets, target.spreadsheetId, `'${CUSTOMER_MGMT_SHEET_NAME}'!A${layout.firstDataRow}:${layout.lastColumn}`);
  const targetRows = customerSourceRows(reception).map((source) => customerRowFromHeaders(layout.headers, source));
  const existingById = new Map<string, number>();
  rows.forEach((row, index) => {
    const managedId = String(row[layout.idIndex] ?? "");
    if (managedId) existingById.set(managedId, index + layout.firstDataRow);
  });

  for (const row of targetRows) {
    const managedId = String(row[layout.idIndex]);
    const existingRow = existingById.get(managedId);
    if (existingRow) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: target.spreadsheetId,
        range: `'${CUSTOMER_MGMT_SHEET_NAME}'!A${existingRow}:${layout.lastColumn}${existingRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: target.spreadsheetId,
        range: `'${CUSTOMER_MGMT_SHEET_NAME}'!A:${layout.lastColumn}`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
    }
  }
}

export async function removeReceptionFromCustomerMgmt(
  reception: Pick<Reception, "receptionId" | "storeName" | "returnDate" | "receptionDate" | "lastUpdated">,
) {
  if (!MAIN_SPREADSHEET_ID) return;
  const sheets = getSheetsClient();
  const target = await getCustomerMgmtTarget(sheets, reception);
  const layout = await getCustomerMgmtLayout(sheets, target.spreadsheetId);
  const rows = await readValues(sheets, target.spreadsheetId, `'${CUSTOMER_MGMT_SHEET_NAME}'!A${layout.firstDataRow}:${layout.lastColumn}`);
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: target.spreadsheetId });
  const sheetId = metadata.data.sheets?.find((sheet) => sheet.properties?.title === CUSTOMER_MGMT_SHEET_NAME)?.properties?.sheetId;
  if (sheetId === undefined) return;

  const rowNumbers = rows
    .map((row, index) => ({ id: String(row[layout.idIndex] ?? ""), rowNumber: index + layout.firstDataRow }))
    .filter((row) => row.id === reception.receptionId || row.id.startsWith(`${reception.receptionId}#`))
    .map((row) => row.rowNumber)
    .sort((a, b) => b - a);

  for (const rowNumber of rowNumbers) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: target.spreadsheetId,
      requestBody: { requests: [{ deleteDimension: { range: {
        sheetId,
        dimension: "ROWS",
        startIndex: rowNumber - 1,
        endIndex: rowNumber,
      } } }] },
    });
  }
}

function isPurchaseReception(reception: Reception) {
  return reception.serviceType.includes("買取") || Boolean(reception.purchaseAgreement);
}

async function setupPurchaseSheet(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetName: string) {
  await ensureSheet(sheets, spreadsheetId, sheetName);
  const values = await readValues(sheets, spreadsheetId, `'${sheetName}'!A1:W10`);
  const hasHeader = values.some((row) => row.includes("買取成立日"));
  if (hasHeader) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1:W1`,
    valueInputOption: "RAW",
    requestBody: { values: [[...PURCHASE_HEADERS]] },
  });
}

function purchaseRow(reception: Reception) {
  return [
    reception.receptionId,
    dateOnly(reception.returnDate || reception.lastUpdated || reception.receptionDate),
    reception.storeName,
    reception.assessStaff || reception.repairStaff || reception.staffName,
    reception.customerName,
    reception.customerKana,
    reception.mobileTel || reception.completeTel || reception.deviceTel,
    reception.deviceModel,
    reception.imei,
    yenNumber(reception.repairPrice),
    reception.color,
    reception.carrier,
    reception.simLock,
    reception.capacity,
    reception.usageRestriction,
    reception.rank,
    reception.repairParts,
    reception.btLevel,
    reception.accessories,
    reception.idDocuments,
    reception.purchaseAgreement,
    reception.paymentMethod,
    reception.notes,
  ];
}

export async function syncPurchaseToManagement(reception: Reception) {
  if (!PURCHASE_MGMT_SPREADSHEET_ID || !isPurchaseReception(reception)) return;
  const sheets = getSheetsClient();
  const sheetName = storeSheetName(reception.storeName);
  await setupPurchaseSheet(sheets, PURCHASE_MGMT_SPREADSHEET_ID, sheetName);
  const rows = await readValues(sheets, PURCHASE_MGMT_SPREADSHEET_ID, `'${sheetName}'!A2:W`);
  const existingIndex = rows.findIndex((row) => String(row[0] ?? "") === reception.receptionId);
  const row = purchaseRow(reception);
  if (existingIndex >= 0) {
    const rowNumber = existingIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: PURCHASE_MGMT_SPREADSHEET_ID,
      range: `'${sheetName}'!A${rowNumber}:W${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
    return;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: PURCHASE_MGMT_SPREADSHEET_ID,
    range: `'${sheetName}'!A:W`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export async function syncReceptionSideEffects(reception: Reception) {
  await Promise.allSettled([
    syncReceptionToCustomerMgmt(reception),
    syncPurchaseToManagement(reception),
  ]).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") console.warn("Management sync failed:", result.reason);
    }
  });
}
