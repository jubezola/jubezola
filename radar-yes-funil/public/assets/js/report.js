// Relatório geral: PDF, Excel, CSV, email e resumo para WhatsApp.
import { CONFIG, PIPELINE_STAGES } from "./config.js";
import { DISTRICTS, DISTRICT_BY_ID, CATEGORY_BY_ID, CATEGORIES } from "./data.js";

const loaded = {};
function loadScript(src) {
  if (!loaded[src]) {
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { delete loaded[src]; reject(new Error("Não foi possível carregar " + src)); };
      document.head.appendChild(s);
    });
  }
  return loaded[src];
}

const fmtDate = (d = new Date()) => d.toLocaleString("pt-PT", { dateStyle: "long", timeStyle: "short" });
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const eur = (n) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

/** Agrega todos os dados do relatório. */
export function buildReport({ leads, crm, settings, scope }) {
  const byDistrict = DISTRICTS.map((d) => {
    const ls = leads.filter((l) => l.district === d.id);
    return {
      id: d.id, name: d.name, total: ls.length,
      quente: ls.filter((l) => l.heat === "quente").length,
      whatsapp: ls.filter((l) => l.whatsapp).length,
      instagram: ls.filter((l) => l.instagram).length,
      soTelefone: ls.filter((l) => !l.whatsapp && !l.instagram).length,
    };
  }).filter((r) => r.total > 0).sort((a, b) => b.total - a.total);

  const byCategory = CATEGORIES.map((c) => {
    const ls = leads.filter((l) => l.cat === c.id);
    return { id: c.id, name: c.label, total: ls.length, quente: ls.filter((l) => l.heat === "quente").length };
  }).filter((r) => r.total > 0).sort((a, b) => b.total - a.total);

  const entries = Object.values(crm);
  const pipeline = PIPELINE_STAGES.map((s) => ({ ...s, count: entries.filter((e) => e.status === s.id).length }));
  const closed = entries.filter((e) => e.status === "fechado");
  const revenue = closed.reduce((sum, e) => sum + (Number(e.value) || Number(settings.sitePrice) || 0), 0);
  const contacted = entries.filter((e) => ["contactado", "interessado", "fechado", "perdido"].includes(e.status)).length;
  const positive = entries.filter((e) => ["interessado", "fechado"].includes(e.status)).length;

  const totals = {
    leads: leads.length,
    quente: leads.filter((l) => l.heat === "quente").length,
    morno: leads.filter((l) => l.heat === "morno").length,
    frio: leads.filter((l) => l.heat === "frio").length,
    whatsapp: leads.filter((l) => l.whatsapp).length,
    instagram: leads.filter((l) => l.instagram).length,
    soTelefone: leads.filter((l) => !l.whatsapp && !l.instagram).length,
    districts: byDistrict.length,
    potential: leads.filter((l) => l.heat === "quente").length * (Number(settings.sitePrice) || 0),
    pipeline: entries.length, contacted, positive, closed: closed.length, revenue,
    responseRate: contacted ? Math.round((positive / contacted) * 100) : 0,
  };

  const top = [...leads].sort((a, b) => b.score - a.score).slice(0, 50);
  return { generatedAt: new Date(), scope, settings, totals, byDistrict, byCategory, pipeline, entries, top, leads };
}

function leadRow(l) {
  const crmStatus = l._status ? PIPELINE_STAGES.find((s) => s.id === l._status)?.label : "";
  return {
    "Nome": l.name,
    "Categoria": CATEGORY_BY_ID[l.cat]?.label || "",
    "Tipo": l.type,
    "Distrito": DISTRICT_BY_ID[l.district]?.name || "",
    "Concelho/Localidade": l.concelho || l.city || "",
    "Morada": [l.street, l.postcode].filter(Boolean).join(" "),
    "WhatsApp": l.whatsapp ? "+" + l.whatsapp : "",
    "Instagram": l.instagram ? "@" + l.instagram : "",
    "Telefones": (l.phones || []).map((p) => p.display).join(" / "),
    "Email": l.email || "",
    "Site atual": l.site === "dead" ? `Desativado (${l.siteUrl})` : l.site === "social" ? `Só rede social (${l.siteUrl})` : "",
    "Facebook": l.facebook || "",
    "Horário": l.hours || "",
    "Pontuação": l.score,
    "Temperatura": l.heat,
    "Estado no pipeline": crmStatus || "",
    "Link WhatsApp": l.whatsapp ? `https://wa.me/${l.whatsapp}` : "",
    "Link Instagram": l.instagram ? `https://instagram.com/${l.instagram}` : "",
    "OpenStreetMap": `https://www.openstreetmap.org/${l.osm}`,
  };
}

function withStatus(report) {
  const crm = Object.fromEntries(report.entries.map((e) => [e.lead?.id, e.status]));
  return report.leads.map((l) => ({ ...l, _status: crm[l.id] }));
}

// ── CSV (compatível com Excel em PT: separador ";" e BOM UTF-8) ──
export function toCsv(report) {
  const rows = withStatus(report).sort((a, b) => b.score - a.score).map(leadRow);
  if (!rows.length) return "﻿sem dados\n";
  const head = Object.keys(rows[0]);
  const q = (v) => {
    const s = String(v ?? "");
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [head.join(";"), ...rows.map((r) => head.map((h) => q(r[h])).join(";"))].join("\r\n");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadCsv(report) {
  downloadBlob(new Blob([toCsv(report)], { type: "text/csv;charset=utf-8" }), `relatorio-leads-${stamp()}.csv`);
}

// ── Excel com várias folhas ──
export async function buildXlsx(report) {
  await loadScript("assets/vendor/xlsx.mini.min.js");
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();
  const t = report.totals;
  const resumo = [
    [`${CONFIG.brand} — Relatório geral`],
    ["Gerado em", fmtDate(report.generatedAt)],
    ["Âmbito", report.scope],
    [],
    ["Negócios sem website encontrados", t.leads],
    ["Leads quentes", t.quente], ["Leads mornos", t.morno], ["Leads frios", t.frio],
    ["Com WhatsApp", t.whatsapp], ["Com Instagram", t.instagram], ["Só telefone", t.soTelefone],
    ["Distritos analisados", t.districts],
    ["Potencial (quentes × preço)", t.potential],
    [],
    ["Pipeline: negócios acompanhados", t.pipeline],
    ["Contactados", t.contacted], ["Interessados ou fechados", t.positive],
    ["Taxa de resposta positiva (%)", t.responseRate],
    ["Fechados", t.closed], ["Receita fechada (€)", t.revenue],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resumo);
  ws1["!cols"] = [{ wch: 38 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumo");

  const distRows = report.byDistrict.map((d) => ({ Distrito: d.name, Leads: d.total, Quentes: d.quente, WhatsApp: d.whatsapp, Instagram: d.instagram, "Só telefone": d.soTelefone }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(distRows.length ? distRows : [{ Distrito: "sem dados" }]), "Por distrito");

  const catRows = report.byCategory.map((c) => ({ Categoria: c.name, Leads: c.total, Quentes: c.quente }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows.length ? catRows : [{ Categoria: "sem dados" }]), "Por categoria");

  const rows = withStatus(report).sort((a, b) => b.score - a.score).map(leadRow);
  const ws4 = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nome: "sem dados" }]);
  ws4["!cols"] = [{ wch: 34 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 30 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Leads");

  const pipeRows = report.entries.map((e) => ({
    Nome: e.lead?.name, Estado: PIPELINE_STAGES.find((s) => s.id === e.status)?.label,
    Distrito: DISTRICT_BY_ID[e.lead?.district]?.name || "", WhatsApp: e.lead?.whatsapp ? "+" + e.lead.whatsapp : "",
    Telefone: (e.lead?.phones || []).map((p) => p.display).join(" / "), Valor: Number(e.value) || "",
    Notas: e.note || "", "Atualizado": new Date(e.updated).toLocaleString("pt-PT"),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pipeRows.length ? pipeRows : [{ Nome: "pipeline vazio" }]), "Pipeline");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function downloadXlsx(report) {
  downloadBlob(await buildXlsx(report), `relatorio-leads-${stamp()}.xlsx`);
}

// ── PDF ──
export async function buildPdf(report, { fullList = true } = {}) {
  await loadScript("assets/vendor/jspdf.umd.min.js");
  await loadScript("assets/vendor/jspdf.plugin.autotable.min.js");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const cobalt = [29, 63, 160];
  const ink = [16, 27, 61];
  const t = report.totals;

  // Capa / cabeçalho
  doc.setFillColor(...cobalt);
  doc.rect(0, 0, W, 132, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Relatório geral de leads", 40, 62);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${CONFIG.brand} ${CONFIG.brandSuffix}  |  ${fmtDate(report.generatedAt)}`, 40, 86);
  doc.text(`Âmbito: ${report.scope}`, 40, 104);
  if (report.settings.sellerName) doc.text(`Preparado para ${report.settings.sellerName}`, 40, 120);

  // Indicadores
  const kpis = [
    ["Negócios sem site", t.leads], ["Leads quentes", t.quente], ["Com WhatsApp", t.whatsapp],
    ["Com Instagram", t.instagram], ["Só telefone", t.soTelefone], ["Potencial", eur(t.potential)],
  ];
  let y = 164;
  const boxW = (W - 80 - 20) / 3;
  kpis.forEach(([label, val], i) => {
    const x = 40 + (i % 3) * (boxW + 10);
    const yy = y + Math.floor(i / 3) * 64;
    doc.setDrawColor(214, 220, 236);
    doc.setFillColor(245, 247, 252);
    doc.roundedRect(x, yy, boxW, 54, 4, 4, "FD");
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(String(val), x + 12, yy + 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 92, 130);
    doc.text(label, x + 12, yy + 42);
  });
  y += 140;

  const section = (title) => {
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, 40, y);
    y += 8;
  };
  const table = (head, body, opts = {}) => {
    doc.autoTable({
      startY: y, head: [head], body, margin: { left: 40, right: 40 },
      styles: { fontSize: 8.5, cellPadding: 4, textColor: ink, lineColor: [214, 220, 236], lineWidth: 0.5 },
      headStyles: { fillColor: cobalt, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      ...opts,
    });
    y = doc.lastAutoTable.finalY + 26;
  };

  section("Pipeline comercial");
  table(
    ["Acompanhados", "Contactados", "Resposta positiva", "Fechados", "Receita"],
    [[t.pipeline, t.contacted, `${t.responseRate}%`, t.closed, eur(t.revenue)]],
  );

  if (report.byDistrict.length) {
    section("Leads por distrito");
    table(["Distrito", "Leads", "Quentes", "WhatsApp", "Instagram", "Só telefone"],
      report.byDistrict.map((d) => [d.name, d.total, d.quente, d.whatsapp, d.instagram, d.soTelefone]));
  }
  if (report.byCategory.length) {
    section("Leads por categoria");
    table(["Categoria", "Leads", "Quentes"], report.byCategory.map((c) => [c.name, c.total, c.quente]));
  }
  if (report.top.length) {
    section("Top 50 leads para contactar primeiro");
    table(["Nome", "Tipo", "Local", "WhatsApp / Telefone", "Instagram", "Pont."],
      report.top.map((l) => [
        l.name, l.type, `${l.city || ""}${l.city ? ", " : ""}${DISTRICT_BY_ID[l.district]?.name || ""}`,
        l.whatsapp ? "+" + l.whatsapp : (l.phones[0]?.display || ""), l.instagram ? "@" + l.instagram : "", l.score,
      ]),
      { columnStyles: { 0: { cellWidth: 130 }, 5: { halign: "right" } } });
  }
  if (fullList && report.leads.length > report.top.length) {
    doc.addPage();
    y = 50;
    section(`Lista completa (${report.leads.length} negócios)`);
    table(["Nome", "Categoria", "Distrito", "Contacto", "Instagram", "Pont."],
      [...report.leads].sort((a, b) => b.score - a.score).map((l) => [
        l.name, CATEGORY_BY_ID[l.cat]?.short || "", DISTRICT_BY_ID[l.district]?.name || "",
        l.whatsapp ? "WA +" + l.whatsapp : (l.phones[0]?.display || ""), l.instagram ? "@" + l.instagram : "", l.score,
      ]),
      { styles: { fontSize: 7.5, cellPadding: 3, textColor: ink, lineColor: [214, 220, 236], lineWidth: 0.5 } });
  }

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 160);
    doc.text(`Dados © colaboradores do OpenStreetMap (ODbL)  |  Página ${i} de ${pages}`, 40, doc.internal.pageSize.getHeight() - 20);
  }
  return doc.output("blob");
}

export async function downloadPdf(report, opts) {
  downloadBlob(await buildPdf(report, opts), `relatorio-leads-${stamp()}.pdf`);
}

// ── Texto curto (WhatsApp / corpo de email) ──
export function summaryText(report) {
  const t = report.totals;
  const lines = [
    `${CONFIG.brand} — relatório geral (${fmtDate(report.generatedAt)})`,
    `Âmbito: ${report.scope}`,
    "",
    `Negócios sem website: ${t.leads}`,
    `Quentes: ${t.quente} | Mornos: ${t.morno} | Frios: ${t.frio}`,
    `Com WhatsApp: ${t.whatsapp} | Instagram: ${t.instagram} | Só telefone: ${t.soTelefone}`,
    `Potencial: ${eur(t.potential)}`,
    "",
    `Pipeline: ${t.pipeline} acompanhados, ${t.contacted} contactados, ${t.closed} fechados (${eur(t.revenue)})`,
  ];
  if (report.byDistrict.length) {
    lines.push("", "Top distritos:");
    report.byDistrict.slice(0, 5).forEach((d) => lines.push(`- ${d.name}: ${d.total} (${d.quente} quentes)`));
  }
  if (report.top.length) {
    lines.push("", "Contactar primeiro:");
    report.top.slice(0, 5).forEach((l) => lines.push(`- ${l.name} (${DISTRICT_BY_ID[l.district]?.name}) ${l.whatsapp ? "+" + l.whatsapp : l.phones[0]?.display || ""}`));
  }
  return lines.join("\n");
}

export function summaryHtml(report) {
  const t = report.totals;
  const e = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rows = (arr, cols) => arr.map((r) => `<tr>${cols.map((c) => `<td style="padding:6px 10px;border-bottom:1px solid #D6DCEC">${e(r[c])}</td>`).join("")}</tr>`).join("");
  return `<div style="font-family:Arial,sans-serif;color:#101B3D;max-width:640px">
  <div style="background:#1D3FA0;color:#fff;padding:24px 28px;border-radius:6px 6px 0 0">
    <div style="font-size:22px;font-weight:bold">Relatório geral de leads</div>
    <div style="opacity:.85;margin-top:6px">${e(CONFIG.brand)} | ${e(fmtDate(report.generatedAt))} | ${e(report.scope)}</div>
  </div>
  <div style="padding:20px 28px;border:1px solid #D6DCEC;border-top:0">
    <p style="font-size:16px"><b>${t.leads}</b> negócios sem website, <b>${t.quente}</b> quentes. ${t.whatsapp} com WhatsApp, ${t.instagram} com Instagram, ${t.soTelefone} só com telefone.</p>
    <p>Potencial estimado: <b>${e(eur(t.potential))}</b>. Pipeline: ${t.contacted} contactados, ${t.closed} fechados (${e(eur(t.revenue))}).</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:12px">
      <tr style="background:#F5F7FC"><th align="left" style="padding:6px 10px">Distrito</th><th align="left">Leads</th><th align="left">Quentes</th></tr>
      ${rows(report.byDistrict.slice(0, 20), ["name", "total", "quente"])}
    </table>
    <p style="margin-top:18px">A lista completa segue em anexo.</p>
    <p style="font-size:11px;color:#5A6690">Dados © colaboradores do OpenStreetMap (ODbL).</p>
  </div></div>`;
}

async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Envia o relatório por email via Netlify Function. Devolve {ok, fallback}. */
export async function sendEmail(report, to) {
  const xlsx = await buildXlsx(report);
  const payload = {
    to,
    subject: `Relatório de leads — ${report.totals.leads} negócios sem website`,
    html: summaryHtml(report),
    text: summaryText(report),
    attachments: [{ filename: `relatorio-leads-${stamp()}.xlsx`, content: await blobToBase64(xlsx) }],
  };
  try {
    const res = await fetch(CONFIG.emailEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    const info = await res.json().catch(() => ({}));
    return { ok: false, fallback: true, reason: info.error || `erro ${res.status}`, xlsx };
  } catch (err) {
    return { ok: false, fallback: true, reason: err.message, xlsx };
  }
}
