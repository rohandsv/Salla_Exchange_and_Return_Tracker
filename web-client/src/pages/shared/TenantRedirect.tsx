import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { resolveTenantSlug } from "../../lib/tenant";

export default function TenantRedirect({ to }: { to: "p" | "m" }) {
  const nav = useNavigate();

  useEffect(() => {
    const slug = resolveTenantSlug(null);

    // If nothing found, send them to landing to enter tenant
    if (!slug) {
      nav("/", { replace: true });
      return;
    }

    nav(`/${to}/${slug}`, { replace: true });
  }, [nav, to]);

  return null;
}
