// src/pages/RedirectMerchant.tsx
import { Navigate } from "react-router-dom";
import { resolveTenantSlug } from "../lib/tenant";

export default function RedirectMerchant() {
  const slug = resolveTenantSlug(null);
  return <Navigate to={slug ? `/m/${slug}` : "/"} replace />;
}
