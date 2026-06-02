export interface Device {
  category: string;
  model: string;
  imei: string;
  symptom: string;
  repairContent: string;
  repairPrice: string;
  cost: string;
}

export interface Reception {
  receptionId: string;
  rowNumber: number;
  storeName: string;
  receptionDate: string;
  lastUpdated: string;
  staffName: string;
  repairStaff: string;
  status: string;
  serviceType: string;
  deviceCategory: string;
  deviceModel: string;
  imei: string;
  symptom: string;
  repairContent: string;
  repairPrice: string;
  cost: string;
  returnPlanDate: string;
  returnDate: string;
  customerName: string;
  customerKana: string;
  deviceTel: string;
  completeTel: string;
  internalMemo: string;
  notes: string;
  address: string;
  repairHistory: string;
  passcode: string;
  agreement: boolean;
  signatureData: string;
  repairCategory: string;
  panelType: string;
  smallPartsType: string;
  waterproofTape: string;
  warrantyStatus: string;
  birthdate: string;
  homeTel: string;
  mobileTel: string;
  email: string;
  occupation: string;
  idDocuments: string;
  devicesJson: string;
  paymentMethod: string;
  coating: string;
  temperedGlass: string;
  updateToken: string;
}

export interface MasterData {
  categories: string[];
  deviceMap: Record<string, string[]>;
  repairMap: Record<string, string[]>;
  modelRepairMap: Record<string, string[]>;
}
