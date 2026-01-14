import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

export default function NotFound() {
  const nav = useNavigate();
  return (
    <div className="page">
      <main className="container landing">
        <Card className="landing-card">
          <div className="landing-title">404</div>
          <div className="landing-sub">Page not found.</div>
          <div className="landing-actions">
            <Button variant="primary" onClick={() => nav("/")}>Go Home</Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
