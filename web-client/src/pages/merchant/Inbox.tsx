import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Toast from "../../components/ui/Toast";
import { MerchantInboxItem } from "../../domain/merchant";
import { getMerchantInbox } from "../../services/api/merchant";
import { normalizeError } from "../../services/http/errors";

type AnyInboxItem = MerchantInboxItem & {
  createdAt?: string | number;
  updatedAt?: string | number;
  ts?: string | number;
};

export default function MerchantInbox() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<AnyInboxItem[]>([]);
  const [toast, setToast] = useState<{ open: boolean; type: any; msg: string }>({
    open: false,
    type: "info",
    msg: "",
  });

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = async () => {
    try {
      const data = (await getMerchantInbox()) as AnyInboxItem[];
      setItems(data || []);
      setPage(1); // reset page on refresh
    } catch (e) {
      const err = normalizeError(e);
      setToast({ open: true, type: "error", msg: err.message });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusTone = (s: MerchantInboxItem["status"]) => {
    if (s === "REQUESTED") return "warn";
    if (s === "APPROVED") return "success";
    return "info";
  };

  // Pick best "date-like" field available
  const getTime = (x: AnyInboxItem) => {
    const v = x.createdAt ?? x.updatedAt ?? x.ts;
    if (v === undefined || v === null) return NaN;
    if (typeof v === "number") return v;
    const t = Date.parse(String(v));
    return Number.isNaN(t) ? NaN : t;
  };

  // 1) Filter by search
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (x) =>
        x.rma.toLowerCase().includes(s) ||
        x.orderRef.toLowerCase().includes(s) ||
        x.customerEmail.toLowerCase().includes(s)
    );
  }, [items, q]);

  // 2) Sort latest first
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const ta = getTime(a);
      const tb = getTime(b);

      // If we have valid timestamps, sort by them
      const aHas = !Number.isNaN(ta);
      const bHas = !Number.isNaN(tb);
      if (aHas && bHas) return tb - ta;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;

      // Fallback: sort by RMA desc (string compare)
      return String(b.rma).localeCompare(String(a.rma));
    });
    return arr;
  }, [filtered]);

  // 3) Paginate
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = sorted.slice(start, end);

  // Keep page valid if filter reduces total pages
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const pageNumbers = useMemo(() => {
    // Simple compact pager: show up to 5 pages around current
    const range: number[] = [];
    const from = Math.max(1, safePage - 2);
    const to = Math.min(totalPages, safePage + 2);
    for (let i = from; i <= to; i++) range.push(i);
    return range;
  }, [safePage, totalPages]);

  return (
    <>
      <style>{`
        .ib-wrap{ width:100%; }
        .ib-card{ width:100%; border-radius:16px; overflow:hidden; background:#fff; border:1px solid #e6e8f0; }

        .ib-head{
          display:flex; align-items:center; justify-content:space-between;
          gap:12px; flex-wrap:wrap;
          padding:14px;
          border-bottom: 1px solid #e6e8f0;
          background:#fff;
        }
        .ib-search{ flex: 1 1 320px; min-width: 220px; }
        .ib-actions{ display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }

        /* Table */
        .ib-table{ width:100%; background:#fff; }
        .ib-th{
          display:grid;
          grid-template-columns: 1.2fr 1.4fr 1fr 0.9fr 0.3fr;
          gap:12px;
          padding:12px 14px;
          font-weight:1000;
          font-size:12px;
          letter-spacing:.6px;
          color:#64748b;
          border-bottom: 1px solid #e6e8f0;
        }
        .ib-row{
          display:grid;
          grid-template-columns: 1.2fr 1.4fr 1fr 0.9fr 0.3fr;
          gap:12px;
          padding:14px;
          align-items:center;
          border-bottom: 1px solid rgba(230,232,240,0.8);
        }
        .ib-right{ justify-self:end; }

        .ib-strong{ font-weight:1000; color:#0f172a; }
        .ib-muted{ color:#64748b; font-weight:900; font-size:12px; }
        .ib-linkish{ color:#2563eb; font-weight:1000; font-size:12px; }

        .ib-avatarRow{ display:flex; align-items:center; gap:10px; }
        .ib-avatar{
          width:36px; height:36px; border-radius:14px;
          display:grid; place-items:center;
          background: rgba(37,99,235,0.10);
          color:#2563eb;
          font-weight:1000;
          flex: 0 0 auto;
        }

        .ib-res{ display:flex; align-items:center; gap:10px; }
        .ib-dot{ width:10px; height:10px; border-radius:999px; background: rgba(37,99,235,0.30); }

        .ib-kebab{
          border:1px solid #e6e8f0;
          background:#fff;
          border-radius:12px;
          width:38px; height:38px;
          cursor:pointer;
          font-weight:1000;
          color:#0f172a;
        }

        /* Pagination */
        .ib-pager{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          padding: 12px 14px;
          background:#fff;
        }
        .ib-pagerLeft{
          color:#64748b;
          font-weight:900;
          font-size:12px;
        }
        .ib-pagerBtns{
          display:flex;
          gap: 8px;
          flex-wrap:wrap;
          justify-content:flex-end;
        }
        .ib-pageBtn{
          border:1px solid #e6e8f0;
          background:#fff;
          border-radius:12px;
          padding:8px 10px;
          font-weight:1000;
          cursor:pointer;
          color:#0f172a;
          min-width: 40px;
        }
        .ib-pageBtn.active{
          background: rgba(37,99,235,0.10);
          border-color: rgba(37,99,235,0.25);
          color:#2563eb;
        }
        .ib-pageBtn:disabled{
          opacity:0.5;
          cursor:not-allowed;
        }

        /* Mobile card layout */
        .ib-cardRow{ display:none; padding:14px; border-bottom: 1px solid rgba(230,232,240,0.8); background:#fff; }
        .ib-cardTop{ display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
        .ib-grid2{ margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
        .ib-field{
          border:1px solid #e6e8f0;
          border-radius:14px;
          padding:10px 12px;
          background:#f8fafc;
          min-width:0;
        }
        .ib-label{ font-size:11px; font-weight:1000; letter-spacing:.6px; color:#64748b; }
        .ib-value{ margin-top:4px; font-weight:1000; color:#0f172a; word-break: break-word; }

        @media (max-width: 860px){
          .ib-th, .ib-row{ display:none; }
          .ib-cardRow{ display:block; }
          .ib-pager{ flex-direction:column; align-items:flex-start; }
          .ib-pagerBtns{ width:100%; justify-content:flex-start; }
        }

        @media (max-width: 520px){
          .ib-grid2{ grid-template-columns: 1fr; }
        }
      `}</style>

      <Toast
        open={toast.open}
        type={toast.type}
        message={toast.msg}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />

      <div className="ib-wrap">
        <Card className="ib-card">
          <div className="ib-head">
            <div className="ib-search">
              <Input
                placeholder="Find RMA or Order ID..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                leftIcon={<span>🔎</span>}
              />
            </div>

            <div className="ib-actions">
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

          {/* Desktop */}
          <div className="ib-table">
            <div className="ib-th">
              <div>RMA IDENTITY</div>
              <div>CUSTOMER</div>
              <div>RESOLUTION</div>
              <div>STATUS FLOW</div>
              <div className="ib-right">ACTION</div>
            </div>

            {pageItems.map((r) => (
              <div className="ib-row" key={r.rma}>
                <div>
                  <div className="ib-strong">{r.rma}</div>
                  <div className="ib-muted">ORDER {r.orderRef}</div>
                </div>

                <div>
                  <div className="ib-avatarRow">
                    <div className="ib-avatar">US</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="ib-strong" style={{ wordBreak: "break-word" }}>
                        {r.customerEmail}
                      </div>
                      <div className="ib-linkish">VERIFIED SALLA ACCOUNT</div>
                    </div>
                  </div>
                </div>

                <div className="ib-res">
                  <span className="ib-dot" />
                  <span className="ib-strong">{r.resolution}</span>
                </div>

                <div>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </div>

                <div className="ib-right">
                  <button className="ib-kebab" aria-label="menu" type="button">
                    ⋮
                  </button>
                </div>
              </div>
            ))}

            {/* Mobile */}
            {pageItems.map((r) => (
              <div className="ib-cardRow" key={`m-${r.rma}`}>
                <div className="ib-cardTop">
                  <div style={{ minWidth: 0 }}>
                    <div className="ib-strong">{r.rma}</div>
                    <div className="ib-muted">ORDER {r.orderRef}</div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    <button className="ib-kebab" aria-label="menu" type="button">
                      ⋮
                    </button>
                  </div>
                </div>

                <div className="ib-grid2">
                  <div className="ib-field">
                    <div className="ib-label">CUSTOMER</div>
                    <div className="ib-value">{r.customerEmail}</div>
                  </div>

                  <div className="ib-field">
                    <div className="ib-label">RESOLUTION</div>
                    <div className="ib-value">{r.resolution}</div>
                  </div>
                </div>
              </div>
            ))}

            {/* Pagination Footer */}
            <div className="ib-pager">
              <div className="ib-pagerLeft">
                Showing <b>{total === 0 ? 0 : start + 1}</b>–<b>{Math.min(end, total)}</b> of <b>{total}</b>
                {" "}• Page <b>{safePage}</b> / <b>{totalPages}</b>
              </div>

              <div className="ib-pagerBtns">
                <button
                  className="ib-pageBtn"
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={safePage === 1}
                >
                  {"<<"}
                </button>
                <button
                  className="ib-pageBtn"
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  Prev
                </button>

                {pageNumbers[0] > 1 && (
                  <>
                    <button className="ib-pageBtn" type="button" onClick={() => setPage(1)}>
                      1
                    </button>
                    {pageNumbers[0] > 2 && <span style={{ padding: "8px 4px", color: "#64748b", fontWeight: 900 }}>…</span>}
                  </>
                )}

                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    className={`ib-pageBtn ${n === safePage ? "active" : ""}`}
                    type="button"
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}

                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                  <>
                    {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                      <span style={{ padding: "8px 4px", color: "#64748b", fontWeight: 900 }}>…</span>
                    )}
                    <button className="ib-pageBtn" type="button" onClick={() => setPage(totalPages)}>
                      {totalPages}
                    </button>
                  </>
                )}

                <button
                  className="ib-pageBtn"
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  Next
                </button>
                <button
                  className="ib-pageBtn"
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={safePage === totalPages}
                >
                  {">>"}
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
