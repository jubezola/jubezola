// Vercel Function: Conversas (ver leadradar/server/social-core.mjs).
// Opcional: BRAVE_API_KEY em Project → Settings → Environment Variables.
import { handleSocial } from "../leadradar/server/social-core.mjs";

export async function GET(request) {
  return handleSocial(request, (k) => process.env[k]);
}
