import { Router } from "express";
import { z } from "zod";
import { SallaOAuthService } from "../services/sallaOAuth.service";

export const authRoutes = Router();

/**
 * This matches the redirect URI configured in Salla:
 * /auth/callback
 */
authRoutes.get("/callback", async (req: any, res, next) => {
  try {
    const qs = z
      .object({
        code: z.string().min(1),
        state: z.string().min(1),
      })
      .parse(req.query);

    await SallaOAuthService.callback(req, {
      code: String(qs.code),
      state: String(qs.state),
    });

    res.status(200).send(`
      <html>
        <head><title>Salla Connected</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>✅ Salla OAuth Connected</h2>
          <p>You can close this window now.</p>
        </body>
      </html>
    `);
  } catch (e) {
    next(e);
  }
});
