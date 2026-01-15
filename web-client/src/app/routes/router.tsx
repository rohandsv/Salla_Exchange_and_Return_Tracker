import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AppShell from "../../components/layout/AppShell";
import Landing from "../../pages/shared/Landing";
import NotFound from "../../pages/shared/NotFound";

import MerchantShell from "../../components/layout/MerchantShell";
import MerchantOverview from "../../pages/merchant/Overview";
import MerchantInbox from "../../pages/merchant/Inbox";
import MerchantRules from "../../pages/merchant/Rules";
import MerchantSettings from "../../pages/merchant/Settings";

import PortalShell from "../../components/layout/PortalShell";
import PortalStart from "../../pages/portal/Start";
import PortalVerify from "../../pages/portal/Verify";
import PortalChooseItems from "../../pages/portal/ChooseItems";
import PortalResolution from "../../pages/portal/Resolution";
import PortalSuccess from "../../pages/portal/Success";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Landing />} />

          <Route path="/merchant/:tenantSlug" element={<MerchantShell />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<MerchantOverview />} />
            <Route path="inbox" element={<MerchantInbox />} />
            <Route path="rules" element={<MerchantRules />} />
            <Route path="settings" element={<MerchantSettings />} />
          </Route>

          <Route path="/r/:portalSlug" element={<PortalShell />}>
            <Route index element={<PortalStart />} />
            <Route path="verify" element={<PortalVerify />} />
            <Route path="items" element={<PortalChooseItems />} />
            <Route path="resolution" element={<PortalResolution />} />
            <Route path="success" element={<PortalSuccess />} />
          </Route>

          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
