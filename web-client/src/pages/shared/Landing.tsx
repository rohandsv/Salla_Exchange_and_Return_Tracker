import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { resolveTenantSlug, setLastTenantSlug } from "../../lib/tenant";

export default function Landing() {
  const nav = useNavigate();

  // ✅ Prefill using storage/env via resolver
  const [tenant, setTenant] = useState(() => resolveTenantSlug(null) || "");
  const slug = useMemo(() => tenant.trim(), [tenant]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h1 className="h1">Returns & Exchanges</h1>
        <div className="sub">
          BRD-3 MVP UI: customer verification + tracking visibility, and merchant connection + hub shell.
        </div>
      </div>

      <div className="grid2">
        <Card style={{ padding: 18 }}>
          <div className="sectionTitle">
            <div style={{ fontWeight: 900, fontSize: 16 }}>Open portal or dashboard</div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <Input
              label="Tenant (portal_public_slug)"
              value={tenant}
              onChange={(e) => {
                const v = e.target.value;
                setTenant(v);
                setLastTenantSlug(v); // ✅ persist for next visits + /p, /m redirects
              }}
              placeholder="e.g. demo-tenant"
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="primary" disabled={!slug} onClick={() => nav(`/p/${slug}`)}>
                Go to Portal
              </Button>
              <Button variant="outline" disabled={!slug} onClick={() => nav(`/m/${slug}`)}>
                Go to Dashboard
              </Button>
            </div>

            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
              If you see TENANT_NOT_FOUND, ensure a row exists in <b>tenants</b> table with{" "}
              <b>portal_public_slug</b> = this value.
            </div>
          </div>
        </Card>

        <Card style={{ padding: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>What’s included (MVP)</div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {[
              { t: "Customer verification", d: "Order number + OTP (phone/email) entry flow." },
              { t: "Return tracking visibility", d: "Portal can list requests and current status once verified." },
              { t: "Merchant connection", d: "OAuth connect entrypoint + safe diagnostics screen." },
              { t: "Merchant hub shell", d: "Inbox/Rules/Analytics navigation foundation." },
            ].map((x) => (
              <div
                key={x.t}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: 12,
                  background: "rgba(255,255,255,0.85)",
                }}
              >
                <div style={{ fontWeight: 900 }}>{x.t}</div>
                <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
                  {x.d}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
