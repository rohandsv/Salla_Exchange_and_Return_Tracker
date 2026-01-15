import React, { useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { clearPortalSession, readPortalSession } from "../../lib/storage/portalSession";

export default function PortalSuccess() {
  const { portalSlug = "elite-store" } = useParams();
  const nav = useNavigate();
  const session = useMemo(() => readPortalSession(), []);

  if (!session || session.portalSlug !== portalSlug) return <Navigate to={`/r/${portalSlug}`} replace />;

  const again = () => {
    clearPortalSession();
    nav(`/r/${portalSlug}`);
  };

  return (
    <div className="portal-center">
      <Card className="portal-card">
        <div className="success-ico">✅</div>
        <div className="portal-title">You're all set!</div>
        <div className="portal-sub">
          Your return for order <b>{session.orderNumber}</b> has been submitted for instant approval.
        </div>

        <div className="steps-mini">
          <div className="step active">
            <div className="step-n">1</div>
            <div>
              <div className="strong">System Review</div>
              <div className="muted small">Our AI is verifying your request details...</div>
            </div>
          </div>

          <div className="step">
            <div className="step-n">2</div>
            <div>
              <div className="strong muted">Shipping Label</div>
              <div className="muted small">Check your email for the return label</div>
            </div>
          </div>
        </div>

        <Button className="portal-btn" variant="ghost" onClick={again}>
          Track Another Return
        </Button>
      </Card>
    </div>
  );
}
