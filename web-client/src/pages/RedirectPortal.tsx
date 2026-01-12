// src/pages/RedirectPortal.tsx
import { Navigate } from "react-router-dom";
import { resolveTenantSlug } from "../lib/tenant";

export default function RedirectPortal() {
  const slug = resolveTenantSlug(null);
  return <Navigate to={slug ? `/p/${slug}` : "/"} replace />;
}
