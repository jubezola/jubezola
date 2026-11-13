// Netlify Function: envio do relatório por email (ver ../../server/send-report-core.mjs).
import { handleSendReport } from "../../server/send-report-core.mjs";

export default (req) => handleSendReport(req, (k) => Netlify.env.get(k));

export const config = { path: "/api/send-report" };
