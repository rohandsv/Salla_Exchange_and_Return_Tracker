export type PortalOrderItem = {
  id: string;
  title: string;
  sku: string;
  priceSar: number;
  imageUrl?: string;
};

export type PortalOrder = {
  orderNumber: string;
  email: string;
  items: PortalOrderItem[];
};

export type PortalSession = {
  portalSlug: string;
  orderNumber: string;
  email: string;
  verified: boolean;
  selectedItemIds: string[];
  reason?: string;
  resolution?: "REFUND" | "STORE_CREDIT" | "EXCHANGE";
};
