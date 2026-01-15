import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";

export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="page">
      <header className="topbar">
        <div className="brand" role="button" tabIndex={0} onClick={() => nav("/")}>
          <div className="brand-icon">⇆</div>
          <div className="brand-name">Salla Returns</div>
        </div>
        <div className="topbar-right">
          <Button variant="primary" onClick={() => nav("/r/elite-store")}>Portal</Button>
          <Button variant="ghost" onClick={() => nav("/merchant/elite-store/overview")}>Dashboard</Button>
        </div>
      </header>

      <main className="container landing">
        <Card className="landing-card">
          <div className="landing-title">Salla Return & Warranty Automator</div>
          <div className="landing-sub">Choose where you want to go.</div>

          <div className="landing-actions">
            <Button size="lg" variant="primary" onClick={() => nav("/merchant/elite-store/overview")}>
              Open Dashboard
            </Button>
            <Button size="lg" variant="dark" onClick={() => nav("/r/elite-store")}>
              Open Portal
            </Button>
          </div>
        </Card>

        <div className="footer">Built for Salla • Powered by Zoho Catalyst AppSail</div>
      </main>
    </div>
  );
}
