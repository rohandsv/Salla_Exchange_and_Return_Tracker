import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import { portalStart, requestOtp } from "../../services/api/portal";
import { writePortalSession } from "../../lib/storage/portalSession";
import { normalizeError } from "../../services/http/errors";

export default function PortalStart() {
  const { portalSlug = "elite-store" } = useParams();
  const nav = useNavigate();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState({ open: false, type: "error" as any, msg: "" });

  useEffect(() => {
    portalStart(portalSlug).catch(() => {});
  }, [portalSlug]);

  const submit = async () => {
    try {
      await requestOtp(portalSlug, orderNumber, email);
      writePortalSession({ portalSlug, orderNumber, email, verified: false, selectedItemIds: [] });
      nav(`/r/${portalSlug}/verify`);
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
          <div className="portal-title">Hello again!</div>
          <div className="portal-sub">Enter your order details to manage your return</div>

          <Input label="ORDER NUMBER" placeholder="e.g. #55412" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} leftIcon={<span>🔎</span>} />
          <Input label="EMAIL ADDRESS" placeholder="customer@example.com" value={email} onChange={(e) => setEmail(e.target.value)} leftIcon={<span>✉️</span>} />

          <Button className="portal-btn" variant="dark" size="lg" onClick={submit} disabled={!orderNumber || !email} rightIcon={<span>›</span>}>
            Track My Order
          </Button>
        </Card>
      </div>
    </>
  );
}
