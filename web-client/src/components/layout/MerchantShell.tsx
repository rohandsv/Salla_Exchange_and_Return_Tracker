import React from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import Segment from "../ui/Segment";
import Button from "../ui/Button";

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={false}
      className={({ isActive }) => `m-tab ${isActive ? "active" : ""}`}
    >
      {label}
    </NavLink>
  );
}

export default function MerchantShell() {
  const { tenantSlug } = useParams();
  const nav = useNavigate();
  const slug = tenantSlug || "elite-store";

  return (
    <div className="m-app">
      <style>{`
        /* =========================================================
          LIGHT THEME • FULL WIDTH • RESPONSIVE FOUNDATION
        ========================================================= */
        :root{
          --m-bg: #f6f7fb;
          --m-surface: #ffffff;
          --m-border: #e6e8f0;
          --m-text: #0f172a;
          --m-muted: #64748b;
          --m-primary: #2563eb;
          --m-primary-soft: rgba(37, 99, 235, 0.10);
          --m-success-soft: #ecfdf5;
          --m-success: #047857;
          --m-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
          --m-radius: 16px;

          /* responsive spacing */
          --m-pad: clamp(12px, 2.2vw, 28px);
          --m-gap: clamp(10px, 1.6vw, 16px);
        }

        .m-app{
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          background: var(--m-bg);
          color: var(--m-text);
        }

        /* =========================================================
          TOPBAR
        ========================================================= */
        .m-topbar{
          position: sticky;
          top: 0;
          z-index: 50;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px var(--m-pad);
          background: var(--m-surface);
          border-bottom: 1px solid var(--m-border);
        }

        .m-brand{
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          user-select: none;
          min-width: 0;
        }

        .m-brand-icon{
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: var(--m-primary-soft);
          color: var(--m-primary);
          font-weight: 1000;
          flex: 0 0 auto;
        }

        .m-brand-name{
          font-weight: 1000;
          letter-spacing: 0.2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 60vw;
        }

        .m-topbar-right{
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        /* =========================================================
          MAIN
        ========================================================= */
        .m-main{
          flex: 1;
          width: 100%;
          padding: var(--m-gap) var(--m-pad);
          display: flex;
          flex-direction: column;
          gap: var(--m-gap);
        }

        /* =========================================================
          HERO ROW (TITLE + SEGMENT)
          - always aligned
          - no broken layout
        ========================================================= */
        .m-hero{
          width: 100%;
          display: grid;
          gap: 12px;
          align-items: end;
          /* Default: stacked (mobile-first) */
          grid-template-columns: 1fr;
        }

        .m-hero-left{
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .m-title{
          font-size: clamp(18px, 1.6vw, 24px);
          font-weight: 1000;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .m-live{
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 1000;
          font-size: 12px;
          background: var(--m-success-soft);
          color: var(--m-success);
          border: 1px solid #a7f3d0;
        }

        .m-subtitle{
          color: var(--m-muted);
          line-height: 1.25;
        }

        .m-hero-right{
          width: 100%;
          min-width: 0;
          display: flex;
        }

        /* =========================================================
          SEGMENT + TABS (THIS IS THE FIX)
          - Segment stretches full width
          - Tabs align properly
          - Tabs wrap on medium screens
          - Tabs scroll on small screens
        ========================================================= */
        .m-segWrap{
          width: 100%;
          display: flex;
          min-width: 0;
        }

        .m-tabsRow{
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;

          /* default behavior */
          flex-wrap: wrap;
          justify-content: flex-start;
        }

        .m-tab{
          flex: 0 0 auto;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: 0.7px;
          text-decoration: none;
          color: var(--m-muted);
          border: 1px solid transparent;
          transition: all .15s ease;
          white-space: nowrap;
          line-height: 1;
        }

        .m-tab:hover{
          background: rgba(15, 23, 42, 0.05);
          color: var(--m-text);
        }

        .m-tab.active{
          background: var(--m-primary-soft);
          color: var(--m-primary);
          border-color: rgba(37, 99, 235, 0.25);
        }

        /* SMALL screens: no wrap, horizontal scroll */
        @media (max-width: 720px){
          .m-tabsRow{
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
            padding-bottom: 2px;
          }
        }

        /* LARGE screens: 2 columns layout */
        @media (min-width: 900px){
          .m-hero{
            grid-template-columns: 1fr 1.05fr;
            align-items: end;
          }
          .m-hero-right{
            justify-content: flex-end;
          }
        }

        /* =========================================================
          OUTLET
        ========================================================= */
        .m-outlet{
          width: 100%;
          min-width: 0;
          flex: 1;
        }

        /* =========================================================
          FOOTER
        ========================================================= */
        .m-footer{
          width: 100%;
          padding: 14px var(--m-pad);
          text-align: center;
          color: var(--m-muted);
          border-top: 1px solid var(--m-border);
          font-weight: 800;
          background: var(--m-surface);
        }

        /* =========================================================
          TOPBAR BREAKPOINT (MOBILE)
        ========================================================= */
        @media (max-width: 520px){
          .m-topbar{
            align-items: flex-start;
            flex-wrap: wrap;
          }
          .m-topbar-right{
            width: 100%;
            justify-content: flex-end;
          }
          .m-brand-name{
            max-width: 80vw;
          }
        }
      `}</style>

      <header className="m-topbar">
        <div
          className="m-brand"
          role="button"
          tabIndex={0}
          onClick={() => nav("/")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") nav("/");
          }}
        >
          <div className="m-brand-icon">⇆</div>
          <div className="m-brand-name">Salla Returns</div>
        </div>

        <div className="m-topbar-right">
          <Button variant="ghost" onClick={() => nav(`/r/${slug}`)}>
            Portal
          </Button>
          <Button variant="primary" onClick={() => nav(`/merchant/${slug}/overview`)}>
            Dashboard
          </Button>
        </div>
      </header>

      <main className="m-main">
        <section className="m-hero">
          <div className="m-hero-left">
            <div className="m-title">
              Command Center <span className="m-live">LIVE</span>
            </div>
            <div className="m-subtitle">
              Monitoring returns for <b>Elite Store</b>{" "}
              <span style={{ opacity: 0.8 }}>(Salla Admin)</span>
            </div>
          </div>

          <div className="m-hero-right">
            <div className="m-segWrap">
              <Segment>
                <div className="m-tabsRow">
                  <TabLink to="overview" label="OVERVIEW" />
                  <TabLink to="inbox" label="INBOX" />
                  <TabLink to="rules" label="RULES" />
                  <TabLink to="settings" label="SETTINGS" />
                </div>
              </Segment>
            </div>
          </div>
        </section>

        <section className="m-outlet">
          <Outlet />
        </section>
      </main>

      <footer className="m-footer">
        Built for Salla • Powered by Zoho Catalyst AppSail
      </footer>
    </div>
  );
}
