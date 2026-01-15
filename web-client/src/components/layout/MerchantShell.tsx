import React from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import Segment from "../ui/Segment";
import Button from "../ui/Button";

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `seg-tab ${isActive ? "active" : ""}`}>
      {label}
    </NavLink>
  );
}

export default function MerchantShell() {
  const { tenantSlug } = useParams();
  const nav = useNavigate();
  const slug = tenantSlug || "elite-store";

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand" role="button" tabIndex={0} onClick={() => nav("/")}>
          <div className="brand-icon">⇆</div>
          <div className="brand-name">Salla Returns</div>
        </div>

        <div className="topbar-right">
          <Button variant="ghost" onClick={() => nav(`/r/${slug}`)}>
            Portal
          </Button>
          <Button variant="primary" onClick={() => nav(`/merchant/${slug}/overview`)}>
            Dashboard
          </Button>
        </div>
      </header>

      <main className="container">
        <div className="hero">
          <div>
            <div className="hero-title">
              Command Center <span className="live-pill">LIVE</span>
            </div>
            <div className="hero-subtitle">
              Monitoring returns for <b>Elite Store</b> <span className="muted">(Salla Admin)</span>
            </div>
          </div>

          <Segment>
            <TabLink to="overview" label="OVERVIEW" />
            <TabLink to="inbox" label="INBOX" />
            <TabLink to="rules" label="RULES" />
            <TabLink to="settings" label="SETTINGS" />
          </Segment>
        </div>

        <Outlet />

        <footer className="footer">Built for Salla • Powered by Zoho Catalyst AppSail</footer>
      </main>
    </div>
  );
}
