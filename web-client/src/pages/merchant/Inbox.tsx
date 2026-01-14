import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Toast from "../../components/ui/Toast";
import { MerchantInboxItem } from "../../domain/merchant";
import { getMerchantInbox } from "../../services/api/merchant";
import { normalizeError } from "../../services/http/errors";

export default function MerchantInbox() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MerchantInboxItem[]>([]);
  const [toast, setToast] = useState<{ open: boolean; type: any; msg: string }>({ open: false, type: "info", msg: "" });

  const load = async () => {
    try {
      const data = await getMerchantInbox();
      setItems(data);
    } catch (e) {
      const err = normalizeError(e);
      setToast({ open: true, type: "error", msg: err.message });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => x.rma.toLowerCase().includes(s) || x.orderRef.toLowerCase().includes(s) || x.customerEmail.toLowerCase().includes(s));
  }, [items, q]);

  const statusTone = (s: MerchantInboxItem["status"]) => {
    if (s === "REQUESTED") return "warn";
    if (s === "APPROVED") return "success";
    return "info";
  };

  return (
    <>
      <Toast open={toast.open} type={toast.type} message={toast.msg} onClose={() => setToast((t) => ({ ...t, open: false }))} />

      <Card className="inbox-card">
        <div className="inbox-head">
          <div className="inbox-search">
            <Input
              placeholder="Find RMA or Order ID..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              leftIcon={<span>🔎</span>}
            />
          </div>

          <div className="inbox-actions">
            <Button
              variant="ghost"
              leftIcon={<span>⎘</span>}
              onClick={() => setToast({ open: true, type: "info", msg: "Filters coming next." })}
            >
              FILTERS
            </Button>
            <Button variant="primary" leftIcon={<span>⟳</span>} onClick={load}>
              SYNC SALLA
            </Button>
          </div>
        </div>

        <div className="table">
          <div className="tr th">
            <div>RMA IDENTITY</div>
            <div>CUSTOMER</div>
            <div>RESOLUTION</div>
            <div>STATUS FLOW</div>
            <div className="right">ACTION</div>
          </div>

          {filtered.map((r) => (
            <div className="tr" key={r.rma}>
              <div>
                <div className="strong">{r.rma}</div>
                <div className="muted">ORDER {r.orderRef}</div>
              </div>

              <div>
                <div className="avatar-row">
                  <div className="avatar">US</div>
                  <div>
                    <div className="strong">{r.customerEmail}</div>
                    <div className="muted linkish">VERIFIED SALLA ACCOUNT</div>
                  </div>
                </div>
              </div>

              <div className="resolution">
                <span className="dot" />
                <span className="strong">{r.resolution}</span>
              </div>

              <div>
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
              </div>

              <div className="right">
                <button className="kebab" aria-label="menu">⋮</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
