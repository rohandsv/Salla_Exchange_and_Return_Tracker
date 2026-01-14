// web-client/src/pages/merchant/MerchantHome.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Input from "../../components/ui/Input";
import { useToast } from "../../app/providers/toast";
import { merchantOAuthStartRedirect, merchantOAuthStatus } from "../../services/api/merchant";
import { toErrorMessage } from "../../services/http";
import { resolveTenantSlug } from "../../lib/tenant";

type Tab = "inbox" | "rules" | "analytics";

export default function MerchantHome() {
  const { tenantSlug } = useParams();
  const slug = resolveTenantSlug(tenantSlug);

  const nav = useNavigate();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();

  const tab = (sp.get("tab") as Tab) || "inbox";
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{
    connected: boolean;
    store_name?: string;
    store_domain?: string;
  } | null>(null);

  const title = useMemo(() => status?.store_name || "Your Store", [status?.store_name]);

  const refresh = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await merchantOAuthStatus(slug);
      setStatus({
        connected: !!res.connected,
        store_name: res.store_name,
        store_domain: res.store_domain,
      });
    } catch (e) {
      toast.push({
        title: "Failed to load connection status",
        message: toErrorMessage(e),
        tone: "danger",
      });
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [slug, toast]);

  /**
   * ✅ FIXED:
   * merchantOAuthStartRedirect() ALREADY redirects the browser.
   * It returns void, so we must not expect {url} here or do a second redirect.
   */
  const connect = useCallback(async () => {
    if (!slug) return;
    try {
      await merchantOAuthStartRedirect(slug);
      // no toast here usually — browser will navigate away immediately
    } catch (e) {
      toast.push({
        title: "Unable to start OAuth",
        message: toErrorMessage(e),
        tone: "danger",
      });
    }
  }, [slug, toast]);

  // ✅ If no slug, force user to choose tenant on Landing
  useEffect(() => {
    if (!slug) nav("/", { replace: true });
  }, [slug, nav]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div>
          <div className="h2" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            Merchant Hub{" "}
            {status?.connected ? <Badge tone="success">SALLA LINKED</Badge> : <Badge tone="warning">NOT CONNECTED</Badge>}
          </div>
          <div className="sub">
            Managing <b>{title}</b>
            {status?.store_domain ? <> • {status.store_domain}</> : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="outline" onClick={refresh} disabled={loading || !slug}>
            Refresh
          </Button>

          <Button variant="primary" onClick={connect} disabled={!slug}>
            Connect Salla
          </Button>

          <Link to={slug ? `/p/${slug}` : "/"}>
            <Button variant="outline" disabled={!slug}>
              Portal
            </Button>
          </Link>
        </div>
      </div>

      <Card style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { k: "inbox", t: "Inbox" },
              { k: "rules", t: "Rules" },
              { k: "analytics", t: "Analytics" },
            ].map((x) => (
              <Button
                key={x.k}
                variant={tab === x.k ? "primary" : "outline"}
                size="sm"
                onClick={() => {
                  const next = new URLSearchParams(sp);
                  next.set("tab", x.k);
                  setSp(next, { replace: true });
                }}
              >
                {x.t}
              </Button>
            ))}
          </div>

          <Badge tone="neutral">BRD-3 MVP</Badge>
        </div>
      </Card>

      {tab === "inbox" ? (
        <Card style={{ padding: 16 }}>
          <div className="sectionTitle">
            <div style={{ fontWeight: 900, fontSize: 16 }}>Inbox</div>
            <Button
              variant="soft"
              size="sm"
              onClick={() =>
                toast.push({
                  title: "Sync not wired in UI yet",
                  message: "Hook up to your ingestion/sync endpoint when ready.",
                  tone: "neutral",
                })
              }
            >
              Sync Salla
            </Button>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <Input placeholder="Search orders..." />
            <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
              This screen is the BRD-3 “Returns inbox” foundation. Next step is wiring list filters (status, reason, SKU,
              date range) and detail actions (approve/reject) to your existing backend endpoints.
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Salla Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 800 }}>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>
                    <Badge tone="neutral">Empty</Badge>
                  </td>
                  <td>—</td>
                  <td>
                    <div className="rowActions">
                      <Button variant="outline" size="sm" disabled>
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      ) : tab === "rules" ? (
        <Card style={{ padding: 16 }}>
          <div className="sectionTitle">
            <div style={{ fontWeight: 900, fontSize: 16 }}>Rules</div>
            <Badge tone="primary">MVP</Badge>
          </div>

          <div style={{ display: "grid", gap: 14, maxWidth: 720 }}>
            <Input label="Return eligibility window (days)" placeholder="e.g. 14" />
            <Input label="Category restrictions (comma separated)" placeholder="e.g. electronics, beauty" />
            <Input label="Auto-approve threshold (amount or criteria)" placeholder="e.g. under 200 SAR" />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="primary" disabled>
                Save rules
              </Button>
              <Button variant="outline" onClick={() => nav(slug ? `/m/${slug}?tab=inbox` : "/")}>
                Back to Inbox
              </Button>
            </div>

            <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
              BRD-3 requires configurable rules (return window, category restrictions, auto-approve/manual). This UI is
              ready; wire it to your rules endpoints when available.
            </div>
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 16 }}>
          <div className="sectionTitle">
            <div style={{ fontWeight: 900, fontSize: 16 }}>Analytics</div>
            <Badge tone="neutral">Preview</Badge>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
            BRD-3 success metrics: reduction in support tickets, time-to-resolution, completion rate, merchant retention.
            Add charts once your usage_monthly / outcomes tables are surfaced via endpoints.
          </div>
        </Card>
      )}
    </div>
  );
}
