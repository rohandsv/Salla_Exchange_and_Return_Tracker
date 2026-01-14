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
      <Card className="rules-left">
        <div style={{ padding: 18 }}>
          <div className="muted" style={{ fontWeight: 900 }}>Loading rules…</div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Toast open={toast.open} type={toast.type} message={toast.msg} onClose={() => setToast((t) => ({ ...t, open: false }))} />

      <div className="rules-grid">
        <Card className="rules-left">
          <div className="rules-title">
            <div className="rules-ico">🛡</div>
            <div>
              <div className="strong">Automation Core</div>
              <div className="muted small">Define global automation rules</div>
            </div>
          </div>

          <div className="rules-block">
            <div className="row space">
              <div className="muted small">RETURN WINDOW</div>
              <div className="strong">{rules.returnWindowDays} DAYS</div>
            </div>
            <input
              className="range"
              type="range"
              min={1}
              max={60}
              value={rules.returnWindowDays}
              onChange={(e) => setRules({ ...rules, returnWindowDays: Number(e.target.value) })}
            />
          </div>

          <div className="rules-block">
            <div className="muted small">AUTO-APPROVAL THRESHOLD</div>
            <div className="money-input">
              <span className="muted">SAR</span>
              <input
                value={rules.autoApprovalThresholdSar}
                onChange={(e) => setRules({ ...rules, autoApprovalThresholdSar: Number(e.target.value || "0") })}
              />
            </div>
          </div>

          <div className="rules-toggles">
            <div className="toggle-row">
              <div className="toggle-label">ACCEPT STORE CREDIT</div>
              <Switch checked={rules.acceptStoreCredit} onChange={(v) => setRules({ ...rules, acceptStoreCredit: v })} />
            </div>
            <div className="toggle-row">
              <div className="toggle-label">ALLOW EXCHANGES</div>
              <Switch checked={rules.allowExchanges} onChange={(v) => setRules({ ...rules, allowExchanges: v })} />
            </div>
            <div className="toggle-row">
              <div className="toggle-label">AUTO-APPROVE LOW VALUE</div>
              <Switch checked={rules.autoApproveLowValue} onChange={(v) => setRules({ ...rules, autoApproveLowValue: v })} />
            </div>
          </div>

          <Button className="big-save" variant="dark" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Architecture"}
          </Button>
        </Card>

        <Card className="rules-right">
          <div className="rules-title">
            <div className="rules-ico">🎚</div>
            <div>
              <div className="strong">Category Governance</div>
              <div className="muted small">Overrides by category</div>
            </div>
          </div>

          <div className="cat-list">
            {rules.categoryOverrides.map((c) => (
              <div className="cat-card" key={c.category}>
                <div>
                  <div className="strong">{c.category}</div>
                  <div className={`muted small ${c.mode === "NON_RETURNABLE" ? "red" : c.mode === "DAY_LIMIT" ? "orange" : "green"}`}>
                    {c.label}
                  </div>
                </div>
                <button className="trash" aria-label="delete">🗑</button>
              </div>
            ))}

            <button className="dashed-btn" type="button" onClick={() => setToast({ open: true, type: "info", msg: "Override builder comes next." })}>
              + DEPLOY CATEGORY OVERRIDE
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}
