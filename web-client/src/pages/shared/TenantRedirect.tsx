import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * TenantRedirect
 * Safe redirect helper if user lands on a tenant-less merchant URL.
 * Example: /merchant -> /merchant/elite-store/overview
 */
export default function TenantRedirect() {
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    // You can customize this default tenant slug.
    const defaultTenant = "elite-store";

    // Preserve querystring if any
    const qs = loc.search || "";
    nav(`/merchant/${defaultTenant}/overview${qs}`, { replace: true });
  }, [nav, loc.search]);

  return null;
}
