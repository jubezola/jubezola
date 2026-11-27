// Vercel Function: Conversas (ver leadradar/server/social-core.mjs).
import { handleSocial } from "../leadradar/server/social-core.mjs";

export async function GET(request) {
  return handleSocial(request);
}
