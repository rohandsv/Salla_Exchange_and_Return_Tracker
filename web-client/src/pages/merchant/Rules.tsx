import React, { useEffect, useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Switch from "../../components/ui/Switch";
import Toast from "../../components/ui/Toast";
import { MerchantRules as RulesType } from "../../domain/merchant";
import { getMerchantRules, saveMerchantRules } from "../../services/api/merchant";
import { normalizeError } from "../../services/http/errors";

export default function MerchantRules() {
  const [rules, setRules] = useState<RulesType | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ open: false, type: "success" as any, msg: "" });

  useEffect(() => {
    getMerchantRules().then(setRules).catch(() => setRules(null));
  }, []);

  const save = async () => {
    if (!rules) return;
    setSaving(true);
    try {
      await saveMerchantRules(rules);
      setToast({ open: true, type: "success", msg: "Rules saved successfully." });
    } catch (e) {
      const err = normalizeError(e);
      setToast({ open: true, type: "error", msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!rules) {
    return (
      <Card className="rl-card">
        <style>{`
          .rl-card{ width:100%; border-radius:16px; padding:18px; }
          .rl-muted{ color:#64748b; font-weight:1000; }
        `}</style>
        <div className="rl-muted">Loading rules…</div>
      </Card>
    );
  }

  return (
    <>
      <style>{`
        .rl-wrap{ width:100%; }
        .rl-grid{
          width:100%;
          display:grid;
          grid-template-columns: 1.15fr 1fr;
          gap: 12px;
          align-items:start;
        }

        .rl-card{
          width:100%;
          border-radius:16px;
          overflow:hidden;
        }

        .rl-head{
          display:flex;
          align-items:center;
          gap:12px;
          padding:14px;
          border-bottom:1px solid #e6e8f0;
          background:#fff;
        }

        .rl-ico{
          width:42px; height:42px;
          border-radius:14px;
          display:grid; place-items:center;
          background: rgba(37,99,235,0.10);
          color:#2563eb;
          font-weight:1000;
          flex:0 0 auto;
        }
        .rl-title{ font-weight:1000; color:#0f172a; }
        .rl-sub{ color:#64748b; font-size:12px; font-weight:900; margin-top:2px; }

        .rl-body{ padding:14px; background:#fff; display:flex; flex-direction:column; gap:12px; }

        .rl-block{
          border:1px solid #e6e8f0;
          border-radius:16px;
          padding:12px;
          background:#f8fafc;
          display:flex;
          flex-direction:column;
          gap:10px;
        }

        .rl-rowSpace{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          flex-wrap:wrap;
        }

        .rl-label{
          font-size:12px;
          font-weight:1000;
          letter-spacing:.6px;
          color:#64748b;
        }

        .rl-strong{ font-weight:1000; color:#0f172a; }

        .rl-range{ width:100%; }

        .rl-money{
          display:flex;
          align-items:center;
          gap:8px;
          border:1px solid #e6e8f0;
          background:#fff;
          border-radius:14px;
          padding:10px 12px;
        }
        .rl-money input{
          border:none;
          outline:none;
          width:100%;
          font-weight:1000;
          color:#0f172a;
          background:transparent;
        }

        .rl-toggles{
          display:flex;
          flex-direction:column;
          gap:10px;
        }

        .rl-toggleRow{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          padding:12px;
          border:1px solid #e6e8f0;
          border-radius:16px;
          background:#fff;
        }

        .rl-save{
          width:100%;
          border-radius:14px;
        }

        /* Right side categories */
        .rl-catList{
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .rl-catCard{
          border:1px solid #e6e8f0;
          border-radius:16px;
          background:#fff;
          padding:12px;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 10px;
        }
        .rl-pill{
          font-size:12px;
          font-weight:1000;
          color:#64748b;
        }
        .rl-pill.red{ color:#b91c1c; }
        .rl-pill.orange{ color:#b45309; }
        .rl-pill.green{ color:#047857; }

        .rl-trash{
          border:1px solid #e6e8f0;
          background:#fff;
          border-radius:12px;
          width:38px; height:38px;
          cursor:pointer;
        }

        .rl-dashed{
          width:100%;
          border:1px dashed #cbd5e1;
          background:#f8fafc;
          border-radius:16px;
          padding:12px;
          font-weight:1000;
          cursor:pointer;
        }

        @media (max-width: 980px){
          .rl-grid{ grid-template-columns: 1fr; }
        }
      `}</style>

      <Toast
        open={toast.open}
        type={toast.type}
        message={toast.msg}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />

      <div className="rl-wrap">
        <div className="rl-grid">
          {/* LEFT */}
          <Card className="rl-card">
            <div className="rl-head">
              <div className="rl-ico">🛡</div>
              <div style={{ minWidth: 0 }}>
                <div className="rl-title">Automation Core</div>
                <div className="rl-sub">Define global automation rules</div>
              </div>
            </div>

            <div className="rl-body">
              <div className="rl-block">
                <div className="rl-rowSpace">
                  <div className="rl-label">RETURN WINDOW</div>
                  <div className="rl-strong">{rules.returnWindowDays} DAYS</div>
                </div>
                <input
                  className="rl-range"
                  type="range"
                  min={1}
                  max={60}
                  value={rules.returnWindowDays}
                  onChange={(e) =>
                    setRules({ ...rules, returnWindowDays: Number(e.target.value) })
                  }
                />
              </div>

              <div className="rl-block">
                <div className="rl-label">AUTO-APPROVAL THRESHOLD</div>
                <div className="rl-money">
                  <span className="rl-label">SAR</span>
                  <input
                    value={rules.autoApprovalThresholdSar}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        autoApprovalThresholdSar: Number(e.target.value || "0"),
                      })
                    }
                  />
                </div>
              </div>

              <div className="rl-toggles">
                <div className="rl-toggleRow">
                  <div className="rl-strong">ACCEPT STORE CREDIT</div>
                  <Switch
                    checked={rules.acceptStoreCredit}
                    onChange={(v) => setRules({ ...rules, acceptStoreCredit: v })}
                  />
                </div>
                <div className="rl-toggleRow">
                  <div className="rl-strong">ALLOW EXCHANGES</div>
                  <Switch
                    checked={rules.allowExchanges}
                    onChange={(v) => setRules({ ...rules, allowExchanges: v })}
                  />
                </div>
                <div className="rl-toggleRow">
                  <div className="rl-strong">AUTO-APPROVE LOW VALUE</div>
                  <Switch
                    checked={rules.autoApproveLowValue}
                    onChange={(v) => setRules({ ...rules, autoApproveLowValue: v })}
                  />
                </div>
              </div>

              <Button className="rl-save" variant="dark" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save Architecture"}
              </Button>
            </div>
          </Card>

          {/* RIGHT */}
          <Card className="rl-card">
            <div className="rl-head">
              <div className="rl-ico">🎚</div>
              <div style={{ minWidth: 0 }}>
                <div className="rl-title">Category Governance</div>
                <div className="rl-sub">Overrides by category</div>
              </div>
            </div>

            <div className="rl-body">
              <div className="rl-catList">
                {rules.categoryOverrides.map((c) => (
                  <div className="rl-catCard" key={c.category}>
                    <div style={{ minWidth: 0 }}>
                      <div className="rl-strong">{c.category}</div>
                      <div
                        className={`rl-pill ${
                          c.mode === "NON_RETURNABLE"
                            ? "red"
                            : c.mode === "DAY_LIMIT"
                            ? "orange"
                            : "green"
                        }`}
                      >
                        {c.label}
                      </div>
                    </div>
                    <button className="rl-trash" aria-label="delete" type="button">
                      🗑
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="rl-dashed"
                type="button"
                onClick={() =>
                  setToast({ open: true, type: "info", msg: "Override builder comes next." })
                }
              >
                + DEPLOY CATEGORY OVERRIDE
              </button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
