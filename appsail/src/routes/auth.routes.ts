import { Router } from "express";
import { z } from "zod";
import { SallaOAuthService } from "../services/sallaOAuth.service";
import { AppError } from "../lib/errors";

export const authRoutes = Router();

authRoutes.get("/callback", async (req: any, res, next) => {
  try {
    if (SallaOAuthService.mode() === "easy") {
      return res.status(400).send(renderHtml({ title: "Not Used", heading: "Not Used", body: "<p>Easy mode does not use OAuth callback.</p>" }));
    }

    const qs = z
      .object({
        code: z.string().min(1),
        state: z.string().min(1),
        return_to: z.string().optional(),
      })
      .parse(req.query);

    const returnTo = sanitizeRelativeReturnTo(qs.return_to);

    const result = await SallaOAuthService.callback(req, {
      code: String(qs.code),
      state: String(qs.state),
    });

    if (returnTo) return res.redirect(returnTo);

    return res.status(200).send(
      renderHtml({
        title: "Salla Connected",
        heading: "Salla Connected",
        body: `<p>Connection completed successfully.</p><p><b>Verified:</b> ${result?.verified ? "Yes" : "No"}</p><p>You can close this window now.</p>`,
      })
    );
  } catch (e) {
    if (e instanceof AppError) {
      const status = (e as any).statusCode ?? (e as any).status ?? (e as any).status_code ?? (e as any).httpStatus ?? 500;

      return res.status(status).send(
        renderHtml({
          title: "Salla Connection Failed",
          heading: "Salla Connection Failed",
          body: `<p><b>Error:</b> ${escapeHtml(String(e.message || "Unknown error"))}</p><p><b>Code:</b> ${escapeHtml(String((e as any).code || "UNKNOWN"))}</p>${
            (e as any).details
              ? `<pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px;">${escapeHtml(String((e as any).details))}</pre>`
              : ""
          }<p>You can close this window now.</p>`,
        })
      );
    }

    next(e);
  }
});

function sanitizeRelativeReturnTo(v?: string): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s.startsWith("/")) return null;
  if (s.startsWith("//")) return null;
  if (s.includes("://")) return null;
  if (!/^[\/a-zA-Z0-9\-._~%!$&'()*+,;=:@?]*$/.test(s)) return null;
  return s;
}

function renderHtml(args: { title: string; heading: string; body: string }) {
  return `<html><head><title>${escapeHtml(args.title)}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="font-family: Arial, sans-serif; padding: 24px; line-height: 1.45;"><h2>${escapeHtml(args.heading)}</h2>${args.body}</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
