import React from "react";
import { createBrowserRouter } from "react-router-dom";
import AppShell from "../../components/layout/AppShell";
import Landing from "../../pages/shared/Landing";
import NotFound from "../../pages/shared/NotFound";
import PortalStart from "../../pages/portal/PortalStart";
import PortalHome from "../../pages/portal/PortalHome";
import MerchantHome from "../../pages/merchant/MerchantHome";
import MerchantConnection from "../../pages/merchant/MerchantConnection";
import TenantRedirect from "../../pages/shared/TenantRedirect"; // ✅ add

const wrap = (node: React.ReactNode) => <AppShell>{node}</AppShell>;

const basename = window.location.pathname.startsWith("/app") ? "/app" : "/";

export const router = createBrowserRouter(
  [
    { path: "/", element: wrap(<Landing />) },

    // ✅ add these two shortcut routes
    { path: "/p", element: wrap(<TenantRedirect to="p" />) },
    { path: "/m", element: wrap(<TenantRedirect to="m" />) },

    { path: "/p/:tenantSlug", element: wrap(<PortalStart />) },
    { path: "/p/:tenantSlug/home", element: wrap(<PortalHome />) },

    { path: "/m/:tenantSlug", element: wrap(<MerchantHome />) },
    { path: "/m/:tenantSlug/connection", element: wrap(<MerchantConnection />) },

    { path: "*", element: wrap(<NotFound />) },
  ],
  { basename }
);
