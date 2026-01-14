export type MerchantKpis = {
  awaitingAction: number;
  transitVolume: number;
  retentionRate: number; // %
  automationPct: number; // %
};

export type MerchantInboxItem = {
  rma: string;
  orderRef: string;
  customerEmail: string;
  resolution: "REFUND" | "STORE_CREDIT" | "EXCHANGE";
  status: "REQUESTED" | "APPROVED" | "IN_TRANSIT";
};

export type MerchantRules = {
  returnWindowDays: number;
  autoApprovalThresholdSar: number;
  acceptStoreCredit: boolean;
  allowExchanges: boolean;
  autoApproveLowValue: boolean;
  categoryOverrides: Array<{
    category: string;
    mode: "STANDARD_WINDOW" | "NON_RETURNABLE" | "DAY_LIMIT";
    label: string;
  }>;
};

export type MerchantSettings = {
  portalEndpoint: string;
  accent: "blue" | "black" | "green" | "orange";
  language: "AR_SA" | "EN";
};
