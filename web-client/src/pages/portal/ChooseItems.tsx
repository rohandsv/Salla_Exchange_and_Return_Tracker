import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import { getOrder } from "../../services/api/portal";
import { PortalOrder } from "../../domain/portal";
import { readPortalSession, writePortalSession } from "../../lib/storage/portalSession";
import { normalizeError } from "../../services/http/errors";

export default function PortalChooseItems() {
  const { portalSlug = "elite-store" } = useParams();
  const nav = useNavigate();
  const session = useMemo(() => readPortalSession(), []);
  const [order, setOrder] = useState<PortalOrder | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState({ open: false, type: "error" as any, msg: "" });

  useEffect(() => {
    getOrder(portalSlug)
      .then((o) => {
        setOrder(o);
        setSelected(session?.selectedItemIds || []);
      })
      .catch((e) => {
        const err = normalizeError(e);
        setToast({ open: true, type: "error", msg: err.message });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalSlug]);

  if (!session || session.portalSlug !== portalSlug) return <Navigate to={`/r/${portalSlug}`} replace />;
  if (!session.verified) return <Navigate to={`/r/${portalSlug}/verify`} replace />;

  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const next = () => {
    writePortalSession({ ...session, selectedItemIds: selected });
    nav(`/r/${portalSlug}/resolution`);
  };

  return (
    <>
      <Toast open={toast.open} type={toast.type} message={toast.msg} onClose={() => setToast((t) => ({ ...t, open: false }))} />
      <div className="portal-center">
        <Card className="portal-card wide">
          <div className="portal-toprow">
            <button className="back" onClick={() => nav(-1)} aria-label="back">←</button>
            <div className="portal-title-sm">Choose Items</div>
            <div style={{ width: 40 }} />
          </div>

          <div className="items">
            {order?.items.map((it) => {
              const on = selected.includes(it.id);
              return (
                <button type="button" className={`item ${on ? "selected" : ""}`} key={it.id} onClick={() => toggle(it.id)}>
                  <img className="item-img" src={it.imageUrl} alt={it.title} />
                  <div className="item-meta">
                    <div className="strong">{it.title}</div>
                    <div className="muted small">SKU : {it.sku}</div>
                    <div className="strong small">SAR {it.priceSar}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <Button className="portal-btn" variant="soft" size="lg" onClick={next} disabled={selected.length === 0}>
            Continue
          </Button>
        </Card>
      </div>
    </>
  );
}
