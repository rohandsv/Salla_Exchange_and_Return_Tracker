import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useToast } from "../../app/providers/toast";
import { portalReturns } from "../../services/api/portal";
import { clearPortalSession, getPortalSession } from "../../lib/storage/portalSession";
import { toErrorMessage } from "../../services/http";

const statusTone = (s: string) => {
    const v = (s || "").toLowerCase();
    if (v.includes("resolved") || v.includes("completed")) return "success";
    if (v.includes("approved") || v.includes("transit")) return "primary";
    if (v.includes("rejected") || v.includes("failed")) return "danger";
    if (v.includes("received")) return "warning";
    return "neutral";
};

export default function PortalHome() {
    const { tenantSlug } = useParams();
    const slug = (tenantSlug || "").trim();
    const nav = useNavigate();
    const toast = useToast();

    const session = useMemo(() => getPortalSession(slug), [slug]);

    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<
        Array<{ return_request_id: string; status: string; created_at: string; mode?: string; tracking_number?: string }>
    >([]);

    useEffect(() => {
        if (!session?.token) {
            nav(`/p/${slug}`);
            return;
        }

        let alive = true;

        (async () => {
            setLoading(true);
            try {
                const res = await portalReturns(slug, session.token);
                if (!alive) return;
                setItems(res.items || []);
            } catch (e) {
                toast.push({ title: "Unable to load returns", message: toErrorMessage(e), tone: "danger" });
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [slug, nav, session?.token, toast]);

    return (
        <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                    <div className="h2">Return tracking</div>
                    <div className="sub">Your requests and current status (BRD-3 pipeline visibility).</div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button
                        variant="outline"
                        onClick={() => {
                            clearPortalSession(slug);
                            nav(`/p/${slug}`);
                        }}
                    >
                        Sign out
                    </Button>
                </div>
            </div>

            <Card style={{ padding: 16 }}>
                {loading ? (
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading...</div>
                ) : items.length === 0 ? (
                    <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>No return requests yet</div>
                        <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
                            Once a return request is created, it will appear here with status updates (Requested → Approved → In Transit →
                            Received → Resolved).
                        </div>
                    </div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Request ID</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Tracking</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((r) => (
                                <tr key={r.return_request_id}>
                                    <td style={{ fontWeight: 800 }}>{r.return_request_id}</td>
                                    <td>
                                        <Badge tone={statusTone(r.status) as any}>{r.status || "pending"}</Badge>
                                    </td>
                                    <td>{new Date(r.created_at).toLocaleString()}</td>
                                    <td>{r.tracking_number || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
}
