import React from "react";
import { createHashRouter } from "react-router-dom";
import AppShell from "../../components/layout/AppShell";
import Landing from "../../pages/shared/Landing";
import NotFound from "../../pages/shared/NotFound";
import PortalStart from "../../pages/portal/PortalStart";
import PortalHome from "../../pages/portal/PortalHome";
import MerchantHome from "../../pages/merchant/MerchantHome";
import MerchantConnection from "../../pages/merchant/MerchantConnection";
import TenantRedirect from "../../pages/shared/TenantRedirect";

const wrap = (node: React.ReactNode) => <AppShell>{node}</AppShell>;

export const router = createHashRouter([
  { path: "/", element: wrap(<Landing />) },

  { path: "/p", element: wrap(<TenantRedirect to="p" />) },
  { path: "/m", element: wrap(<TenantRedirect to="m" />) },

  { path: "/p/:tenantSlug", element: wrap(<PortalStart />) },
  { path: "/p/:tenantSlug/home", element: wrap(<PortalHome />) },

  { path: "/m/:tenantSlug", element: wrap(<MerchantHome />) },
  { path: "/m/:tenantSlug/connection", element: wrap(<MerchantConnection />) },

  { path: "*", element: wrap(<NotFound />) },
]);
