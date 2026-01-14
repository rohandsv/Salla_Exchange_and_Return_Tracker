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
        // If your API signature is getMerchantKpis(tenant), change this call to: getMerchantKpis(tenant)
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
    <div className="container">
      <div className="merchant-grid">
        {/* KPIs */}
        {loading && (
          <div className="row-center">
            <Spinner />
            <div className="muted">Loading KPIs…</div>
          </div>
        )}

        {!loading && kpis && (
          <div className="kpis">
            <div className="card kpi warm">
              <div className="kpi-icon">!</div>
              <div className="kpi-label">AWAITING ACTION</div>
              <div className="kpi-value">{kpis.awaitingAction}</div>
            </div>

            <div className="card kpi">
              <div className="kpi-icon">🚚</div>
              <div className="kpi-label">TRANSIT VOLUME</div>
              <div className="kpi-value">{kpis.transitVolume}</div>
            </div>

            <div className="card kpi greenish">
              <div className="kpi-icon">↗</div>
              <div className="kpi-label">RETENTION RATE</div>
              <div className="kpi-value">{kpis.retentionRate.toFixed(1)}%</div>
            </div>

            <div className="card kpi">
              <div className="kpi-icon">⚡</div>
              <div className="kpi-label">AUTOMATION %</div>
              <div className="kpi-value">{kpis.automationPct}%</div>
            </div>
          </div>
        )}

        {!loading && !kpis && (
          <div className="card inbox-card">
            <div className="strong">Could not load KPIs</div>
            <div className="muted small">
              If backend is down, set <span className="strong">REACT_APP_USE_MOCKS=true</span>.
            </div>
          </div>
        )}

        {/* Lower section */}
        <div className="lower">
          {/* Return Trajectory */}
          <div className="card chart-card">
            <div className="chart-head">
              <div>
                <div className="chart-title">Return Trajectory</div>
                <div className="small muted">Weekly return volume snapshot</div>
              </div>
              <button className="btn sm ghost">Export report</button>
            </div>

            <div className="bar-chart">
              {chart.map((c) => (
                <div className="bar-col" key={c.day}>
                  <div
                    className={`bar ${c.active ? "active" : ""}`}
                    style={{ height: `${c.h}px` }}
                  />
                  <div className="bar-day">{c.day}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Guard */}
          <div className="card financial-guard">
            <div className="fg-title">Financial Guard</div>
            <div className="fg-sub">Estimated value retained through Store Credit</div>

            <div className="fg-block">
              <div className="fg-small">TOTAL SAVINGS</div>
              <div className="fg-big">
                SAR 12k <span className="fg-chip">+14%</span>
              </div>
            </div>

            <div className="fg-lines">
              <div className="fg-line">
                <span>Cash Refunded</span>
                <span className="neg">-SAR 4,500</span>
              </div>
              <div className="fg-line">
                <span>Credit Issued</span>
                <span className="pos">+SAR 8,200</span>
              </div>
            </div>

            <button className="btn soft fg-btn">View Analytics</button>
          </div>
        </div>
      </div>
    </div>
  );
}
