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
      <Card className="settings-card">
        <div className="muted" style={{ fontWeight: 900 }}>Loading settings…</div>
      </Card>
    );
  }

  return (
    <>
      <Toast open={toast.open} type={toast.type} message={toast.msg} onClose={() => setToast((t) => ({ ...t, open: false }))} />
      <div className="settings-wrap">
        <Card className="settings-card">
          <div className="settings-ico">🌐</div>
          <div className="settings-title">Portal Branding</div>
          <div className="settings-sub">How your customers experience the return flow</div>

          <div className="field">
            <div className="field-label">PUBLIC PORTAL ENDPOINT</div>
            <div className="copy-row">
              <div className="copy-pill">{settings.portalEndpoint}</div>
              <Button variant="dark" onClick={copy}>COPY</Button>
            </div>
          </div>

          <div className="settings-row">
            <div className="field">
              <div className="field-label">PRIMARY ACCENT</div>
              <div className="color-row">
                {(["blue", "black", "green", "orange"] as const).map((c) => (
                  <button
                    key={c}
                    className={`color-dot ${c} ${settings.accent === c ? "sel" : ""}`}
                    onClick={() => setSettings({ ...settings, accent: c })}
                    type="button"
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <div className="field">
              <div className="field-label">INTERFACE LANGUAGE</div>
              <select
                className="select"
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value as any })}
              >
                <option value="AR_SA">ARABIC (SA)</option>
                <option value="EN">ENGLISH</option>
              </select>
            </div>
          </div>

          <Button className="publish" variant="primary" onClick={save} disabled={saving}>
            {saving ? "Publishing..." : "Publish Portal Config"}
          </Button>
        </Card>
      </div>
    </>
  );
}
