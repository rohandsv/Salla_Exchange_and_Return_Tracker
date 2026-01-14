import React from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import Button from "../ui/Button";

export default function PortalShell() {
  const nav = useNavigate();
  const { portalSlug } = useParams();
  const slug = portalSlug || "elite-store";

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand" role="button" tabIndex={0} onClick={() => nav("/")}>
          <div className="brand-icon">⇆</div>
          <div className="brand-name">Salla Returns</div>
        </div>

        <div className="topbar-right">
          <Button variant="primary" onClick={() => nav(`/r/${slug}`)}>
            Portal
          </Button>
          <Button variant="ghost" onClick={() => nav(`/merchant/${slug}/overview`)}>
            Dashboard
          </Button>
        </div>
      </header>

      <main className="portal-canvas">
        <Outlet />
        <div className="portal-footer">
          <span className="portal-shield">🛡 SALLA SHIELD PROTECTED</span>
          <span className="portal-links">
            <span>SAFETY</span>
            <span>POLICY</span>
          </span>
        </div>
      </main>
    </div>
  );
}
