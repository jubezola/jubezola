// Netlify Function: Conversas (ver ../../server/social-core.mjs).
import { handleSocial } from "../../server/social-core.mjs";

export default (req) => handleSocial(req);

export const config = { path: "/api/social" };
