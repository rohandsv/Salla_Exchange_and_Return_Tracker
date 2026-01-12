import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Segment from "../../components/ui/Segment";
import Badge from "../../components/ui/Badge";
import { useToast } from "../../app/providers/toast";
import { portalStart, portalVerify } from "../../services/api/portal";
import { setPortalSession } from "../../lib/storage/portalSession";
import { toErrorMessage } from "../../services/http";
import { resolveTenantSlug } from "../../lib/tenant";

export default function PortalStart() {
  const { tenantSlug } = useParams();
  const slug = resolveTenantSlug(tenantSlug);

  const nav = useNavigate();
  const toast = useToast();

  const [orderNumber, setOrderNumber] = useState("");
  const [channel, setChannel] = useState<"phone" | "email">("phone");
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!slug) nav("/", { replace: true });
  }, [slug, nav]);

  const canSend = useMemo(
    () => !!slug && orderNumber.trim().length >= 3 && contact.trim().length >= 3,
    [slug, orderNumber, contact]
  );

  const canVerify = useMemo(
    () => !!slug && orderNumber.trim().length >= 3 && otp.trim().length >= 3,
    [slug, orderNumber, otp]
  );

  async function onSend() {
    if (!slug) return;

    setSending(true);
    try {
      await portalStart({
        portal_public_slug: slug,
        order_number: orderNumber.trim(),
        channel,
        contact: contact.trim(),
      });

      toast.push({
        title: "OTP sent",
        message: `Verification sent via ${channel}.`,
        tone: "success",
      });
    } catch (e) {
      toast.push({
        title: "Failed to send OTP",
        message: toErrorMessage(e),
        tone: "danger",
      });
    } finally {
      setSending(false);
    }
  }

  async function onVerify() {
    if (!slug) return;

    setVerifying(true);
    try {
      const res = await portalVerify({
        portal_public_slug: slug,
        order_number: orderNumber.trim(),
        otp: otp.trim(),
      });

      setPortalSession(slug, res.session_token);

      toast.push({
        title: "Verified",
        message: "You can now view return tracking.",
        tone: "success",
      });

      nav(`/p/${slug}/home`);
    } catch (e) {
      toast.push({
        title: "Verification failed",
        message: toErrorMessage(e),
        tone: "danger",
      });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="grid2">
      <Card style={{ padding: 20 }}>
        <div className="sectionTitle">
          <div>
            <div className="h2">Return & Exchange Portal</div>
            <div className="sub">Fast, easy resolutions for your Salla orders.</div>
          </div>
          <Badge tone="primary">Secure</Badge>
        </div>

        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
          <Input
            label="Order Number"
            placeholder="e.g. #12345"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          />

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>Verification method</div>
            <Segment
              value={channel}
              onChange={(v) => setChannel(v as "phone" | "email")}
              options={[
                { value: "phone", label: "Phone" },
                { value: "email", label: "Email" },
              ]}
            />
          </div>

          <Input
            label={channel === "phone" ? "Phone number" : "Email"}
            placeholder={channel === "phone" ? "+9665xxxxxxxx" : "name@domain.com"}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="primary" disabled={!canSend || sending} onClick={onSend}>
              {sending ? "Sending..." : "Send OTP"}
            </Button>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>OTP is verified server-side. Tokens are never exposed by UI.</span>
          </div>

          <Input label="OTP" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="primary" disabled={!canVerify || verifying} onClick={onVerify}>
              {verifying ? "Verifying..." : "Find My Order"}
            </Button>

            <Button variant="outline" onClick={() => nav(slug ? `/m/${slug}` : "/")} disabled={!slug}>
              Merchant Dashboard
            </Button>
          </div>
        </div>
      </Card>

      <Card style={{ padding: 18 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>What you can do</div>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {[
            { t: "Track your return", d: "View status updates across the return lifecycle pipeline." },
            { t: "Upload evidence", d: "Add images for damaged items or warranty cases." },
            { t: "Choose resolution", d: "Refund, exchange, or store credit based on merchant policy." },
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
  );
}
