import { MerchantInboxItem, MerchantKpis, MerchantRules, MerchantSettings } from "../../domain/merchant";
import { PortalOrder } from "../../domain/portal";

export const mockKpis: MerchantKpis = {
  awaitingAction: 3,
  transitVolume: 24,
  retentionRate: 42.5,
  automationPct: 88,
};

export const mockInbox: MerchantInboxItem[] = [
  { rma: "RMA-99281", orderRef: "#55412", customerEmail: "sarah@example.com", resolution: "REFUND", status: "REQUESTED" },
  { rma: "RMA-99282", orderRef: "#55418", customerEmail: "ahmed@salla.sa", resolution: "STORE_CREDIT", status: "APPROVED" },
  { rma: "RMA-99283", orderRef: "#55420", customerEmail: "linda@domain.com", resolution: "EXCHANGE", status: "IN_TRANSIT" },
];

export const mockRules: MerchantRules = {
  returnWindowDays: 30,
  autoApprovalThresholdSar: 150,
  acceptStoreCredit: true,
  allowExchanges: true,
  autoApproveLowValue: true,
  categoryOverrides: [
    { category: "Accessories", mode: "STANDARD_WINDOW", label: "STANDARD WINDOW" },
    { category: "Sale Items", mode: "NON_RETURNABLE", label: "NON-RETURNABLE" },
    { category: "Electronics", mode: "DAY_LIMIT", label: "7 DAY LIMIT" },
  ],
};

export const mockSettings: MerchantSettings = {
  portalEndpoint: "returns.salla.sa/r/elite-store",
  accent: "blue",
  language: "AR_SA",
};

export const mockPortalOrder: PortalOrder = {
  orderNumber: "#55412",
  email: "customer@example.com",
  items: [
    {
      id: "i1",
      title: "Original Salla Hoodie",
      sku: "SH-01",
      priceSar: 150,
      imageUrl: "https://images.unsplash.com/photo-1520975958225-1c74dfb6e442?auto=format&fit=crop&w=256&q=80",
    },
    {
      id: "i2",
      title: "Leather Keychain",
      sku: "LK-99",
      priceSar: 45,
      imageUrl: "https://images.unsplash.com/photo-1520975745551-2c3f9f80d3d6?auto=format&fit=crop&w=256&q=80",
    },
    {
      id: "i3",
      title: "Premium Cap",
      sku: "CP-44",
      priceSar: 85,
      imageUrl: "https://images.unsplash.com/photo-1520975904622-0f3a22eeefc5?auto=format&fit=crop&w=256&q=80",
    },
  ],
};
