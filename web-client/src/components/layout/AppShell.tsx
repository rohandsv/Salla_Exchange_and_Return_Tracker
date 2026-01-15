import React from "react";
import { Outlet } from "react-router-dom";

export default function AppShell() {
  return (
    <div className="app-root">
      <Outlet />
    </div>
  );
}
