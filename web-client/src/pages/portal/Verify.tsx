import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import OtpInput from "../../components/ui/OtpInput";
import Toast from "../../components/ui/Toast";
import { readPortalSession, writePortalSession } from "../../lib/storage/portalSession";
import { verifyOtp } from "../../services/api/portal";
import { normalizeError } from "../../services/http/errors";

export default function PortalVerify() {
  const { portalSlug = "elite-store" } = useParams();
  const nav = useNavigate();
  const session = useMemo(() => readPortalSession(), []);
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(45);
  const [toast, setToast] = useState({ open: false, type: "error" as any, msg: "" });

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  if (!session || session.portalSlug !== portalSlug) {
    return <Navigate to={`/r/${portalSlug}`} replace />;
  }

  const submit = async () => {
    try {
      await verifyOtp(portalSlug, code);
      writePortalSession({ ...session, verified: true });
      nav(`/r/${portalSlug}/items`);
    } catch (e) {
      const err = normalizeError(e);
      setToast({ open: true, type: "error", msg: err.message });
    }
  };

  return (
    <>
      <Toast open={toast.open} type={toast.type} message={toast.msg} onClose={() => setToast((t) => ({ ...t, open: false }))} />
      <div className="portal-center">
        <Card className="portal-card">
          <div className="portal-icon">🛡</div>
          <div className="portal-title">Verification</div>
          <div className="portal-sub">We sent a code to your email</div>

          <OtpInput length={4} value={code} onChange={setCode} />

          <Button className="portal-btn" variant="primary" size="lg" onClick={submit} disabled={code.length !== 4}>
            Verify Identity
          </Button>

          <div className="resend">RESEND CODE IN {seconds}s</div>
        </Card>
      </div>
    </>
  );
}
