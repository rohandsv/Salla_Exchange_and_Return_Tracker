import React from "react";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

export default function NotFound() {
  return (
    <Card style={{ padding: 18 }}>
      <div className="h2">Page not found</div>
      <div className="sub">The page you’re looking for doesn’t exist.</div>
      <div style={{ marginTop: 14 }}>
        <Link to="/"><Button variant="primary">Go home</Button></Link>
      </div>
    </Card>
  );
}
