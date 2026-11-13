// Vercel Function: envio do relatório por email (ver leadradar/server/send-report-core.mjs).
// Define RESEND_API_KEY e REPORT_FROM em Vercel → Project → Settings → Environment Variables.
import { handleSendReport } from "../leadradar/server/send-report-core.mjs";

const env = (k) => process.env[k];

export async function POST(request) {
  return handleSendReport(request, env);
}

export async function GET(request) {
  return handleSendReport(request, env); // responde 405
}
