import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import "../../styles/app.css";
import { resolveTenantSlug } from "../../lib/tenant";

function useTenantSlug() {
  const p = useParams();
  return (p as any).tenantSlug as string | undefined;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const tenantParam = useTenantSlug();

  // ✅ Dynamic slug (URL -> localStorage -> env -> "")
  const tenantSlug = resolveTenantSlug(tenantParam);

  const isMerchant = loc.pathname.startsWith("/m/");
  const isPortal = loc.pathname.startsWith("/p/");

  return (
    <div className="shell">
      <div className="topbar">
        <div className="container topbarInner">
          <div className="brand">
            <div className="logo" />
            <div className="brandTitle">
              <b>Salla Returns</b>
              <span>{isMerchant ? "Merchant Hub" : isPortal ? "Return & Exchange Portal" : "BRD-3 MVP"}</span>
            </div>
          </div>

          <div className="navRight">
            <Badge tone="neutral">Tenant: {tenantSlug || "—"}</Badge>

            <Link to={tenantSlug ? `/p/${tenantSlug}` : "/"}>
              <Button variant={isPortal ? "primary" : "outline"} size="sm" disabled={!tenantSlug}>
                Portal
              </Button>
            </Link>

            <Link to={tenantSlug ? `/m/${tenantSlug}` : "/"}>
              <Button variant={isMerchant ? "primary" : "outline"} size="sm" disabled={!tenantSlug}>
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <main className="main">
        <div className="container">{children}</div>
      </main>

      <footer className="footer">
        <div className="container" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>Built for Salla • Powered by Zoho Catalyst AppSail</span>
          <span>BRD-3 MVP • Secure sessions • No OAuth tokens exposed via UI</span>
        </div>
      </footer>
    </div>
  );
}
