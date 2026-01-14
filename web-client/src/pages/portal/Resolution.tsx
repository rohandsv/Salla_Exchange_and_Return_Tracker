import React, { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import { readPortalSession, writePortalSession } from "../../lib/storage/portalSession";
import { createReturn } from "../../services/api/portal";
import { normalizeError } from "../../services/http/errors";

export default function PortalResolution() {
  const { portalSlug = "elite-store" } = useParams();
  const nav = useNavigate();
  const session = useMemo(() => readPortalSession(), []);

  const [reason, setReason] = useState(session?.reason || "Doesn't fit");
  const [resolution, setResolution] = useState<"REFUND" | "STORE_CREDIT" | "EXCHANGE">(session?.resolution || "REFUND");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ open: false, type: "error" as any, msg: "" });

  if (!session || session.portalSlug !== portalSlug) return <Navigate to={`/r/${portalSlug}`} replace />;
  if (!session.verified) return <Navigate to={`/r/${portalSlug}/verify`} replace />;
  if (!session.selectedItemIds.length) return <Navigate to={`/r/${portalSlug}/items`} replace />;

  const submit = async () => {
    setSubmitting(true);
    try {
      writePortalSession({ ...session, reason, resolution });
      await createReturn(portalSlug, {
        orderNumber: session.orderNumber,
        itemIds: session.selectedItemIds,
        reason,
        resolution,
      });
      nav(`/r/${portalSlug}/success`);
    } catch (e) {
      const err = normalizeError(e);
      setToast({ open: true, type: "error", msg: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Toast open={toast.open} type={toast.type} message={toast.msg} onClose={() => setToast((t) => ({ ...t, open: false }))} />
      <div className="portal-center">
        <Card className="portal-card wide">
          <div className="portal-toprow">
            <button className="back" onClick={() => nav(-1)} aria-label="back">←</button>
            <div className="portal-title-sm">Resolution</div>
            <div style={{ width: 40 }} />
          </div>

          <div className="field">
            <div className="field-label">RETURN REASON</div>
            <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option>Doesn't fit</option>
              <option>Damaged</option>
              <option>Not as described</option>
              <option>Changed mind</option>
            </select>
          </div>

          <div className="field">
            <div className="field-label">PREFERRED SOLUTION</div>

            <button type="button" className={`choice ${resolution === "REFUND" ? "active" : ""}`} onClick={() => setResolution("REFUND")}>
              <div className="choice-ico">💳</div>
              <div className="choice-body">
                <div className="strong">Original Refund</div>
                <div className="muted small">Back to your bank account</div>
              </div>
            </button>

            <button type="button" className={`choice ${resolution === "STORE_CREDIT" ? "active" : ""}`} onClick={() => setResolution("STORE_CREDIT")}>
              <div className="choice-ico soft">↻</div>
              <div className="choice-body">
                <div className="strong">Instant Store Credit</div>
                <div className="muted small">SAR 10 bonus for your next order</div>
              </div>
              <div className="chip green">VALUE PICK</div>
            </button>

            <button type="button" className={`choice ${resolution === "EXCHANGE" ? "active" : ""}`} onClick={() => setResolution("EXCHANGE")}>
              <div className="choice-ico soft">📦</div>
              <div className="choice-body">
                <div className="strong">Easy Exchange</div>
                <div className="muted small">Swap for a different item</div>
              </div>
            </button>
          </div>

          <Button className="portal-btn" variant="dark" size="lg" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting..." : "Complete Request"}
          </Button>
        </Card>
      </div>
    </>
  );
}
