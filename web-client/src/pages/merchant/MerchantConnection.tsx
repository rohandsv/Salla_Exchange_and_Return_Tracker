import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useToast } from "../../app/providers/toast";
import { merchantOAuthStartRedirect, merchantOAuthStatus } from "../../services/api/merchant";
import { toErrorMessage } from "../../services/http";

export default function MerchantConnection() {
  const { tenantSlug } = useParams();
  const slug = (tenantSlug || "").trim();

  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const refresh = useCallback(async () => {
    if (!slug) {
      setLoading(false);
      setConnected(false);
      toast.push({
        title: "Missing tenant",
        message: "Tenant slug is missing in the URL.",
        tone: "danger",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await merchantOAuthStatus(slug);
      setConnected(!!res.connected);
    } catch (e) {
      toast.push({
        title: "Failed to load status",
        message: toErrorMessage(e),
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [slug, toast]);

  const connect = useCallback(async () => {
    if (!slug) {
      toast.push({
        title: "Missing tenant",
        message: "Tenant slug is missing in the URL.",
        tone: "danger",
      });
      return;
    }

    setConnecting(true);
    try {
      await merchantOAuthStartRedirect(slug);
    } catch (e) {
      toast.push({
        title: "Unable to start connection",
        message: toErrorMessage(e),
        tone: "danger",
      });
      setConnecting(false);
    }
  }, [slug, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="grid2">
      <Card style={{ padding: 18 }}>
        <div className="sectionTitle">
          <div>
            <div className="h2">Merchant connection</div>
            <div className="sub">Connect your Salla store to enable automation and secure event ingestion.</div>
          </div>
          {connected ? <Badge tone="success">Connected</Badge> : <Badge tone="warning">Not connected</Badge>}
        </div>

        <Card inset style={{ padding: 14, marginTop: 14, background: "rgba(15,23,42,0.03)" }}>
          <div style={{ fontWeight: 900 }}>Connection status</div>

          <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13 }}>
            {loading
              ? "Loading..."
              : connected
              ? "Salla connection is active for this tenant."
              : "No active connection found for this tenant."}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Button variant="outline" onClick={refresh} disabled={loading || connecting}>
              Refresh
            </Button>
            <Button variant="primary" onClick={connect} disabled={loading || connecting || !slug}>
              {connecting ? "Redirecting..." : "Connect to Salla"}
            </Button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
            Tokens are stored encrypted on the server and are never returned to the UI.
          </div>
        </Card>
      </Card>
    </div>
  );
}
