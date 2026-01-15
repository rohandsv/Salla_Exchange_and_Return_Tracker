import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { MerchantKpis } from "../../domain/merchant";
import { getMerchantKpis } from "../../services/api/merchant";
import Spinner from "../../components/ui/Spinner";

export default function MerchantOverview() {
  const { tenant = "elite-store" } = useParams();
  const [kpis, setKpis] = useState<MerchantKpis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const data = await getMerchantKpis();
        if (mounted) setKpis(data);
      } catch {
        if (mounted) setKpis(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tenant]);

  const chart = useMemo(
    () => [
      { day: "Mon", h: 85 },
      { day: "Tue", h: 130 },
      { day: "Wed", h: 105 },
      { day: "Thu", h: 155 },
      { day: "Fri", h: 210, active: true },
      { day: "Sat", h: 165 },
      { day: "Sun", h: 120 },
    ],
    []
  );

  return (
    <div className="ov-wrap">
      <style>{`
        /* =========================================================
          Responsive heights driven by screen size
          - Analytics cards get taller AND adapt to viewport
          - No “dead space” inside cards (flex layout)
        ========================================================= */

        .ov-wrap{
          width:100%;
          display:flex;
          flex-direction:column;
          gap:12px;
          /* Let this page grow to fill MerchantShell outlet height */
          height: 100%;
          min-height: 100%;
        }

        /* KPI cards */
        .ov-kpis{
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
          width:100%;
        }

        .ov-kpi{
          display:flex;
          align-items:center;
          gap:14px;
          padding:20px;
          border-radius:16px;
          background:#fff;
          border:1px solid #e6e8f0;
          box-shadow: 0 10px 28px rgba(15,23,42,0.06);
          /* Taller + responsive */
          min-height: clamp(120px, 14vh, 150px);
        }

        .ov-kpiIcon{
          width:52px;
          height:52px;
          border-radius:16px;
          display:grid;
          place-items:center;
          background: rgba(37,99,235,0.10);
          color:#2563eb;
          font-weight:900;
          flex: 0 0 auto;
          font-size: 16px;
        }
        .ov-kpi.warm .ov-kpiIcon{ background: rgba(245, 158, 11, 0.14); color:#b45309; }
        .ov-kpi.greenish .ov-kpiIcon{ background: rgba(16, 185, 129, 0.14); color:#047857; }

        .ov-kpiMeta{ min-width:0; }
        .ov-kpiLabel{
          font-size:12px;
          font-weight:900;
          letter-spacing:.6px;
          color:#64748b;
        }
        .ov-kpiValue{
          margin-top:8px;
          font-size:30px;
          font-weight:1000;
          color:#0f172a;
          line-height:1.05;
        }

        /* Lower analytics row */
        .ov-lower{
          width:100%;
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
          gap: 12px;
          align-items: stretch;
          /* IMPORTANT: let it expand so the page uses available height */
          flex: 1;
        }

        /*
          Analytics card height rules:
          - taller overall
          - adapts to screen height (vh)
          - still has sensible min/max
        */
        .ov-lower{
          --ov-analytics-h: clamp(560px, 62vh, 760px);
        }

        .ov-card{
          background:#fff;
          border:1px solid #e6e8f0;
          border-radius:16px;
          box-shadow: 0 10px 28px rgba(15,23,42,0.06);
          overflow:hidden;

          height: var(--ov-analytics-h);
          display:flex;
          flex-direction:column;
        }

        /* Chart card content */
        .ov-chart{
          padding:18px;
          display:flex;
          flex-direction:column;
          gap: 12px;
          height: 100%;
        }

        .ov-chartHead{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 10px;
          flex-wrap:wrap;
        }
        .ov-chartTitle{ font-weight:1000; color:#0f172a; }
        .ov-chartSub{ color:#64748b; font-size:12px; margin-top:2px; }

        .ov-chartBtn{
          border:1px solid #e6e8f0;
          background:#fff;
          border-radius:12px;
          padding:8px 10px;
          font-weight:900;
          color:#0f172a;
          cursor:pointer;
        }

        /* Bars fill remaining height (no empty space) */
        .ov-bars{
          flex: 1;
          min-height: 260px; /* increased */
          display:flex;
          align-items:flex-end;
          justify-content:space-between;
          gap: 12px;
          padding: 14px 10px 10px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #eef2ff;
        }

        .ov-barCol{
          flex: 1 1 0;
          min-width: 30px;
          display:flex;
          flex-direction:column;
          align-items:center;
          gap: 10px;
        }

        .ov-bar{
          width:100%;
          max-width: 40px;
          border-radius: 12px;
          background: rgba(37,99,235,0.18);
          border: 1px solid rgba(37,99,235,0.18);
          transition: transform .12s ease;
        }
        .ov-bar.active{
          background: rgba(37,99,235,0.35);
          border-color: rgba(37,99,235,0.35);
        }
        .ov-barCol:hover .ov-bar{ transform: translateY(-2px); }
        .ov-day{ font-size:12px; font-weight:900; color:#64748b; }

        /* Financial guard content */
        .ov-fg{
          padding:18px;
          display:flex;
          flex-direction:column;
          gap: 12px;
          height: 100%;
        }

        .ov-fgTitle{ font-weight:1000; color:#0f172a; }
        .ov-fgSub{ color:#64748b; font-size:12px; margin-top:2px; }

        .ov-fgBlock{
          padding:18px;
          border-radius:16px;
          border:1px dashed #e6e8f0;
          background: #f8fafc;
        }

        .ov-fgSmall{ font-size:12px; font-weight:900; color:#64748b; letter-spacing:.6px; }
        .ov-fgBig{
          margin-top:10px;
          font-size:32px;
          font-weight:1000;
          color:#0f172a;
          display:flex;
          align-items:center;
          gap: 10px;
          flex-wrap:wrap;
        }

        .ov-fgChip{
          font-size:12px;
          font-weight:1000;
          padding:4px 10px;
          border-radius:999px;
          background:#ecfdf5;
          color:#047857;
          border:1px solid #a7f3d0;
        }

        .ov-lines{
          display:flex;
          flex-direction:column;
          gap: 12px;
        }

        .ov-line{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          padding:14px 14px;
          border-radius:14px;
          border:1px solid #e6e8f0;
          background:#fff;
          font-weight:900;
        }
        .ov-neg{ color:#b91c1c; }
        .ov-pos{ color:#047857; }

        .ov-fgBtn{
          margin-top: auto; /* pins to bottom = perfect alignment */
          border:none;
          width:100%;
          padding:14px 14px;
          border-radius:14px;
          background: rgba(37,99,235,0.12);
          color:#2563eb;
          font-weight:1000;
          cursor:pointer;
        }

        /* Loading */
        .ov-loading{
          width:100%;
          display:flex;
          align-items:center;
          justify-content:center;
          gap: 10px;
          padding: 18px;
          border-radius:16px;
          background:#fff;
          border:1px solid #e6e8f0;
        }
        .ov-muted{ color:#64748b; font-weight:900; }

        /* =========================================================
          Breakpoints: keep “as per screen”
        ========================================================= */
        @media (max-width: 1200px){
          .ov-lower{ --ov-analytics-h: clamp(560px, 66vh, 780px); }
        }

        @media (max-width: 1024px){
          /* When cards often stack, give them more height */
          .ov-lower{ --ov-analytics-h: clamp(620px, 72vh, 860px); }
          .ov-bars{ min-height: 280px; }
        }

        @media (max-width: 520px){
          /* On phones, natural height prevents overflow */
          .ov-card{ height: auto; }
          .ov-bars{ min-height: 220px; padding: 12px 8px 8px; }
          .ov-bar{ max-width: 32px; }
        }
      `}</style>

      {loading && (
        <div className="ov-loading">
          <Spinner />
          <div className="ov-muted">Loading KPIs…</div>
        </div>
      )}

      {!loading && kpis && (
        <div className="ov-kpis">
          <div className="ov-kpi warm">
            <div className="ov-kpiIcon">!</div>
            <div className="ov-kpiMeta">
              <div className="ov-kpiLabel">AWAITING ACTION</div>
              <div className="ov-kpiValue">{kpis.awaitingAction}</div>
            </div>
          </div>

          <div className="ov-kpi">
            <div className="ov-kpiIcon">🚚</div>
            <div className="ov-kpiMeta">
              <div className="ov-kpiLabel">TRANSIT VOLUME</div>
              <div className="ov-kpiValue">{kpis.transitVolume}</div>
            </div>
          </div>

          <div className="ov-kpi greenish">
            <div className="ov-kpiIcon">↗</div>
            <div className="ov-kpiMeta">
              <div className="ov-kpiLabel">RETENTION RATE</div>
              <div className="ov-kpiValue">{kpis.retentionRate.toFixed(1)}%</div>
            </div>
          </div>

          <div className="ov-kpi">
            <div className="ov-kpiIcon">⚡</div>
            <div className="ov-kpiMeta">
              <div className="ov-kpiLabel">AUTOMATION %</div>
              <div className="ov-kpiValue">{kpis.automationPct}%</div>
            </div>
          </div>
        </div>
      )}

      {!loading && !kpis && (
        <div className="ov-loading">
          <div>
            <div style={{ fontWeight: 1000, color: "#0f172a" }}>Could not load KPIs</div>
            <div className="ov-muted" style={{ fontSize: 12, marginTop: 4 }}>
              If backend is down, set <b>REACT_APP_USE_MOCKS=true</b>.
            </div>
          </div>
        </div>
      )}

      <div className="ov-lower">
        {/* Return Trajectory */}
        <div className="ov-card">
          <div className="ov-chart">
            <div className="ov-chartHead">
              <div>
                <div className="ov-chartTitle">Return Trajectory</div>
                <div className="ov-chartSub">Weekly return volume snapshot</div>
              </div>
              <button className="ov-chartBtn" type="button">
                Export report
              </button>
            </div>

            <div className="ov-bars">
              {chart.map((c) => (
                <div className="ov-barCol" key={c.day}>
                  <div
                    className={`ov-bar ${c.active ? "active" : ""}`}
                    style={{ height: `${c.h}px` }}
                  />
                  <div className="ov-day">{c.day}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Financial Guard */}
        <div className="ov-card">
          <div className="ov-fg">
            <div>
              <div className="ov-fgTitle">Financial Guard</div>
              <div className="ov-fgSub">Estimated value retained through Store Credit</div>
            </div>

            <div className="ov-fgBlock">
              <div className="ov-fgSmall">TOTAL SAVINGS</div>
              <div className="ov-fgBig">
                SAR 12k <span className="ov-fgChip">+14%</span>
              </div>
            </div>

            <div className="ov-lines">
              <div className="ov-line">
                <span>Cash Refunded</span>
                <span className="ov-neg">-SAR 4,500</span>
              </div>
              <div className="ov-line">
                <span>Credit Issued</span>
                <span className="ov-pos">+SAR 8,200</span>
              </div>
            </div>

            <button className="ov-fgBtn" type="button">
              View Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
