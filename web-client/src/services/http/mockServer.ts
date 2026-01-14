function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getPath(input: RequestInfo): string {
  const url = typeof input === "string" ? input : input.url;
  return new URL(url, window.location.origin).pathname;
}

export async function tryMock(input: RequestInfo, init?: RequestInit): Promise<Response | null> {
  const method = (init?.method || "GET").toUpperCase();
  const path = getPath(input);

  // normalize:
  // /merchant/kpis OR /merchant/:tenant/kpis -> treat same
  const m = path.match(/^\/merchant(?:\/[^/]+)?\/(kpis|returns|rules|settings)$/);
  if (!m) return null;

  const resource = m[1];

  if (method === "GET" && resource === "kpis") {
    return json({
      awaitingAction: 3,
      transitVolume: 24,
      retentionRate: 42.5,
      automationPct: 88,
    });
  }

  if (method === "GET" && resource === "returns") {
    return json([
      { rma: "RMA-99281", customerEmail: "sarah@example.com", resolution: "REFUND", status: "REQUESTED" },
      { rma: "RMA-99282", customerEmail: "ahmed@salla.sa", resolution: "STORE_CREDIT", status: "APPROVED" },
      { rma: "RMA-99283", customerEmail: "linda@domain.com", resolution: "EXCHANGE", status: "IN_TRANSIT" },
    ]);
  }

  if (method === "GET" && resource === "rules") {
    return json({
      autoApproveLowValue: true,
      requirePhotoEvidence: false,
      notes: "Mock rules",
    });
  }

  if (method === "POST" && resource === "rules") {
    return json({ ok: true });
  }

  if (method === "GET" && resource === "settings") {
    return json({
      portalEndpoint: "returns.salla.sa/r/elite-store",
      language: "AR_SA",
    });
  }

  if (method === "POST" && resource === "settings") {
    return json({ ok: true });
  }

  return null;
}
