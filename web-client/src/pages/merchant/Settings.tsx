import React, { useEffect, useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import { MerchantSettings as SettingsType } from "../../domain/merchant";
import { getMerchantSettings, saveMerchantSettings } from "../../services/api/merchant";
import { normalizeError } from "../../services/http/errors";

export default function MerchantSettings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ open: false, type: "success" as any, msg: "" });

  useEffect(() => {
    getMerchantSettings().then(setSettings).catch(() => setSettings(null));
  }, []);

  const copy = async () => {
    if (!settings) return;
    try {
      await navigator.clipboard.writeText(settings.portalEndpoint);
      setToast({ open: true, type: "success", msg: "Copied." });
    } catch {
      setToast({ open: true, type: "error", msg: "Copy failed." });
    }
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveMerchantSettings(settings);
      setToast({ open: true, type: "success", msg: "Published successfully." });
    } catch (e) {
      const err = normalizeError(e);
      setToast({ open: true, type: "error", msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <Card className="st-card">
        <style>{`
          .st-card{ width:100%; border-radius:16px; padding:18px; }
          .st-muted{ color:#64748b; font-weight:1000; }
        `}</style>
        <div className="st-muted">Loading settings…</div>
      </Card>
    );
  }

  return (
    <>
      <style>{`
        .st-wrap{
          width:100%;
          display:flex;
          justify-content:center;
        }

        .st-card{
          width:100%;
          max-width: 900px;
          border-radius:16px;
          overflow:hidden;
        }

        .st-body{
          padding: 16px;
          background:#fff;
          display:flex;
          flex-direction:column;
          gap: 14px;
        }

        .st-top{
          display:flex;
          align-items:flex-start;
          gap:12px;
        }

        .st-ico{
          width:44px; height:44px;
          border-radius:14px;
          display:grid; place-items:center;
          background: rgba(37,99,235,0.10);
          color:#2563eb;
          font-weight:1000;
          flex:0 0 auto;
        }

        .st-title{ font-weight:1000; color:#0f172a; }
        .st-sub{ color:#64748b; font-size:12px; font-weight:900; margin-top:2px; }

        .st-field{
          display:flex;
          flex-direction:column;
          gap: 8px;
        }
        .st-label{
          font-size:12px;
          font-weight:1000;
          letter-spacing:.6px;
          color:#64748b;
        }

        .st-copyRow{
          display:flex;
          align-items:center;
          gap: 10px;
          flex-wrap:wrap;
        }

        .st-pill{
          flex: 1 1 420px;
          min-width: 240px;
          border:1px solid #e6e8f0;
          border-radius:14px;
          padding:10px 12px;
          background:#f8fafc;
          font-weight:1000;
          color:#0f172a;
          word-break: break-word;
        }

        .st-grid2{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          width:100%;
        }

        .st-colorRow{
          display:flex;
          gap: 10px;
          flex-wrap:wrap;
        }

        .st-dot{
          width:38px; height:38px;
          border-radius:14px;
          border:1px solid #e6e8f0;
          cursor:pointer;
        }

        .st-dot.sel{
          outline: 3px solid rgba(37,99,235,0.25);
          border-color: rgba(37,99,235,0.35);
        }

        .st-dot.blue{ background:#2563eb; }
        .st-dot.black{ background:#0f172a; }
        .st-dot.green{ background:#16a34a; }
        .st-dot.orange{ background:#f97316; }

        .st-select{
          width:100%;
          border:1px solid #e6e8f0;
          border-radius:14px;
          padding:10px 12px;
          font-weight:1000;
          color:#0f172a;
          background:#fff;
          outline:none;
        }

        .st-publish{
          width:100%;
          border-radius:14px;
        }

        @media (max-width: 860px){
          .st-grid2{ grid-template-columns: 1fr; }
          .st-card{ max-width: 100%; }
        }
      `}</style>

      <Toast
        open={toast.open}
        type={toast.type}
        message={toast.msg}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />

      <div className="st-wrap">
        <Card className="st-card">
          <div className="st-body">
            <div className="st-top">
              <div className="st-ico">🌐</div>
              <div style={{ minWidth: 0 }}>
                <div className="st-title">Portal Branding</div>
                <div className="st-sub">How your customers experience the return flow</div>
              </div>
            </div>

            <div className="st-field">
              <div className="st-label">PUBLIC PORTAL ENDPOINT</div>
              <div className="st-copyRow">
                <div className="st-pill">{settings.portalEndpoint}</div>
                <Button variant="dark" onClick={copy}>COPY</Button>
              </div>
            </div>

            <div className="st-grid2">
              <div className="st-field">
                <div className="st-label">PRIMARY ACCENT</div>
                <div className="st-colorRow">
                  {(["blue", "black", "green", "orange"] as const).map((c) => (
                    <button
                      key={c}
                      className={`st-dot ${c} ${settings.accent === c ? "sel" : ""}`}
                      onClick={() => setSettings({ ...settings, accent: c })}
                      type="button"
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>

              <div className="st-field">
                <div className="st-label">INTERFACE LANGUAGE</div>
                <select
                  className="st-select"
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value as any })}
                >
                  <option value="AR_SA">ARABIC (SA)</option>
                  <option value="EN">ENGLISH</option>
                </select>
              </div>
            </div>

            <Button className="st-publish" variant="primary" onClick={save} disabled={saving}>
              {saving ? "Publishing..." : "Publish Portal Config"}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
