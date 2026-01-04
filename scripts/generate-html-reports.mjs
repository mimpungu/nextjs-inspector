import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "reports", "raw");
const OUT = path.join(ROOT, "reports", "html");
const VENDOR = path.join(OUT, "vendor");

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(VENDOR, { recursive: true });

function exists(p) { try { return fs.existsSync(p); } catch (_) { return false; } }
function readText(p) { return exists(p) ? fs.readFileSync(p, "utf8") : ""; }
function readJson(p) { if (!exists(p)) return null; try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; } }
function numOr0(v) { const n = Number(String(v || "").trim()); return Number.isFinite(n) ? n : 0; }

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function write(name, content) { fs.writeFileSync(path.join(OUT, name), content, "utf8"); }

function ensureLocalChartJs() {
  const candidates = [
    path.join(ROOT, "node_modules", "chart.js", "dist", "chart.umd.min.js"),
    path.join(ROOT, "node_modules", "chart.js", "dist", "chart.umd.js"),
  ];
  let src = candidates.find(exists);
  if (!src) return "https://cdn.jsdelivr.net/npm/chart.js";
  const dst = path.join(VENDOR, "chart.umd.min.js");
  try { fs.copyFileSync(src, dst); return "./vendor/chart.umd.min.js"; } catch (e) { return "https://cdn.jsdelivr.net/npm/chart.js"; }
}

const chartScriptPath = ensureLocalChartJs();

function htmlShell(title, body, script) {
  const chartTag = chartScriptPath ? `<script src="${chartScriptPath}"></script>` : "";
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)} | Dashboard by Deo Mimpungu</title>
  <style>
    :root { --primary: #2563eb; --success: #10b981; --error: #ef4444; --warning: #f59e0b; --bg: #f8fafc; --text: #1e293b; --card-bg: #ffffff; --border: #e2e8f0; --header-bg: #1e293b; }
    
    /* Dark Mode Variables */
    [data-theme="dark"] { --bg: #0f172a; --text: #f1f5f9; --card-bg: #1e293b; --border: #334155; --header-bg: #020617; }

    body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; line-height: 1.5; display: flex; flex-direction: column; min-height: 100vh; transition: background 0.3s, color 0.3s; }
    header { background: var(--header-bg); color: white; padding: 1.5rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 0 1rem; width: 100%; box-sizing: border-box; }
    .container { flex: 1; max-width: 1200px; margin: 2rem auto; padding: 0 1rem; width: 100%; box-sizing: border-box; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
    @media (max-width: 1024px) { .grid, .grid-2 { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 768px) { .grid, .grid-2 { grid-template-columns: 1fr; } }
    
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; height: 280px; display: flex; flex-direction: column; transition: transform 0.2s, background 0.3s, border 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card:hover { transform: translateY(-5px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
    .card h2 { margin: 0; font-size: 1.1rem; color: var(--text); opacity: 0.8; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    
    .kpi { font-size: 1.8rem; font-weight: 800; color: var(--primary); margin: 0.5rem 0; line-height: 1; }
    .row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .pill { background: rgba(100, 116, 139, 0.1); padding: 2px 10px; border: 1px solid var(--border); border-radius: 999px; font-size: 11px; font-weight: 600; color: var(--text); opacity: 0.7; }
    .chart-container { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; min-height: 0; padding: 5px 0; }
    canvas { max-height: 100% !important; max-width: 100% !important; }
    
    .card-footer-row { margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--border); }
    .btn-detail { color: var(--primary); text-decoration: none; font-weight: 600; font-size: 0.85rem; }
    .footer-text-small { font-size: 10px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px; }
    
    .theme-toggle { cursor: pointer; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; transition: 0.2s; }
    .theme-toggle:hover { background: rgba(255,255,255,0.2); }

    .section-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin: 1.5rem 0 0.5rem 0; }
    .copy-btn { background: var(--primary); color: white; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; }
    .footer { padding: 2rem; background: var(--card-bg); border-top: 1px solid var(--border); color: var(--text); opacity: 0.7; margin-top: 2rem; text-align: center; }
    .footer-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
    .footer-links a { margin-left: 1.5rem; color: var(--primary); text-decoration: none; font-weight: 600; }
    pre { background: #010409; color: #e2e8f0; padding: 1rem; border-radius: 8px; overflow: auto; font-size: 12px; margin-top: 0.5rem; border: 1px solid var(--border); }
    .status-badge { padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; display: inline-block; margin-top: 5px; }
    .status-ok { background: #dcfce7; color: #166534; }
    .status-ko { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
<header>
  <div class="header-content">
    <div>
      <h1 style="margin:0; font-size: 1.5rem;">Analyse Next.js</h1>
      <span style="font-size: 0.8rem; opacity: 0.8;">Réalisé par <strong>Deo Mimpungu</strong></span>
    </div>
    <div style="display:flex; gap: 10px; align-items:center;">
      <button class="theme-toggle" onclick="toggleTheme()" id="themeBtn">🌙 Dark Mode</button>
      <div class="pill" style="background: rgba(255,255,255,0.1); color: white; border-color: rgba(255,255,255,0.2);">Build Pipeline v1.0</div>
    </div>
  </div>
</header>
<div class="container">${body}</div>
<div class="footer">
  <div class="footer-content">
    <div>Code Analysis Tooling &copy; 2026 - <strong>Réalisé par Deo Mimpungu</strong></div>
    <div class="footer-links"><a href="#">Documentation</a><a href="https://github.com/">GitHub</a><a href="#">Support</a></div>
  </div>
</div>
${chartTag}
<script>
// --- Theme Management ---
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    document.getElementById('themeBtn').innerText = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
    
    if(window.Chart) {
        // Couleurs plus contrastées pour le mode light
        const textColor = theme === 'dark' ? '#f1f5f9' : '#0f172a';
        const gridColor = theme === 'dark' ? '#334155' : '#cbd5e1';

        Chart.defaults.color = textColor;
        Chart.defaults.borderColor = gridColor;
        
        // Mettre à jour les graphiques existants
        Object.keys(Chart.instances).forEach(function(id) {
            const chart = Chart.instances[id];
            chart.options.color = textColor;
            chart.options.borderColor = gridColor;
            
            // Mise à jour des échelles (scales)
            if (chart.options.scales) {
                Object.keys(chart.options.scales).forEach(function(key) {
                   const scale = chart.options.scales[key];
                   if (scale.ticks) scale.ticks.color = textColor;
                   if (scale.grid) scale.grid.color = gridColor;
                });
            }
            chart.update();
        });
    }
}
function toggleTheme() {
    const current = localStorage.getItem('theme') || 'light';
    setTheme(current === 'light' ? 'dark' : 'light');
}
// Apply saved theme on load
const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

function copyPre(btn, preId) {
  const pre = document.getElementById(preId);
  navigator.clipboard.writeText(pre.innerText).then(() => {
    const orig = btn.innerText; btn.innerText = "Copié !";
    setTimeout(() => btn.innerText = orig, 2000);
  });
}
(function(){ try { ${script || ""} } catch (e) { console.error("Report error:", e); } })();
</script>
</body>
</html>`;
}

// ---- Chart helpers (design inchangé)
function mkBarChart(ctxId, labels, data, datasetLabel, color = "#3b82f6") {
  return `if(window.Chart){ new Chart(document.getElementById('${ctxId}'), { type: "bar", data: { labels: ${JSON.stringify(labels)}, datasets: [{ label: ${JSON.stringify(datasetLabel)}, data: ${JSON.stringify(data)}, backgroundColor: '${color}' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } }); }`;
}
function mkDoughnutChart(ctxId, labels, data, colors) {
  const bg = colors || ["#ef4444", "#f59e0b", "#10b981", "#3b82f6"];
  return `if(window.Chart){ new Chart(document.getElementById('${ctxId}'), { type: "doughnut", data: { labels: ${JSON.stringify(labels)}, datasets: [{ data: ${JSON.stringify(data)}, backgroundColor: ${JSON.stringify(bg)} }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } } }); }`;
}

// ---- Data Processing (statique existant)
const pkg = readJson(path.join(ROOT, "package.json")) || {};
const totalDeps = Object.keys(pkg.dependencies || {}).length + Object.keys(pkg.devDependencies || {}).length;

const eslintJson = readJson(path.join(RAW, "eslint.json")) || [];
const depcheckJson = readJson(path.join(RAW, "depcheck.json")) || {};
const typecheckTxt = readText(path.join(RAW, "typecheck.txt"));
const prettierTxt = readText(path.join(RAW, "prettier.txt"));
const tsPruneTxt = readText(path.join(RAW, "ts-prune.txt"));
const madgeTxt = readText(path.join(RAW, "madge-circular.txt"));
const nextBuildTxt = readText(path.join(RAW, "next-build.txt"));
const buildExit = numOr0(readText(path.join(RAW, "next-build.exitcode")));
const buildStatus = (buildExit === 0) ? "RÉUSSI" : (buildExit === 2) ? "SKIP" : "ÉCHEC";

function countTsErrors(text) { return text.split(/\r?\n/).filter(l => /\berror TS\d+:/i.test(l)).length; }
function parseMadgeCycles(text) { return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).filter(l => l.indexOf("->") >= 0); }
function parseTsPrune(text) { return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).filter(l => l.indexOf(":") >= 0 && l.indexOf(" - ") >= 0); }
function eslintStats(eslintArr) {
  let errorCount = 0, warnCount = 0, byRule = new Map(), byFile = new Map();
  eslintArr.forEach(file => {
    (file.messages || []).forEach(m => {
      if (m.severity === 2) errorCount++; else if (m.severity === 1) warnCount++;
      byRule.set(m.ruleId || "none", (byRule.get(m.ruleId || "none") || 0) + 1);
      const shortFile = path.relative(ROOT, file.filePath || "");
      byFile.set(shortFile, (byFile.get(shortFile) || 0) + 1);
    });
  });
  return {
    errorCount,
    warnCount,
    topRules: [...byRule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    topFiles: [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
  };
}

const eslint = eslintStats(eslintJson);
const tsErrors = countTsErrors(typecheckTxt);
const madgeCycles = parseMadgeCycles(madgeTxt);
const tsPrune = parseTsPrune(tsPruneTxt);
const depUnused = (depcheckJson.dependencies || []).length + (depcheckJson.devDependencies || []).length;
const depUsed = Math.max(0, totalDeps - depUnused);
const prettierOk = !/code style issues found/i.test(prettierTxt);

// =============================================================
// SÉCURITÉ & VULNÉRABILITÉS (NOUVEAU, design inchangé)
// =============================================================

// --- Audit PM (npm/pnpm/yarn)
const npmAuditJson = readJson(path.join(RAW, "npm-audit.json"));
const pnpmAuditJson = readJson(path.join(RAW, "pnpm-audit.json"));
const yarnAuditRaw = readText(path.join(RAW, "yarn-audit.json"));
const auditExitNpm = numOr0(readText(path.join(RAW, "npm-audit.exitcode")));
const auditExitPnpm = numOr0(readText(path.join(RAW, "pnpm-audit.exitcode")));
const auditExitYarn = numOr0(readText(path.join(RAW, "yarn-audit.exitcode")));
const auditExit = (exists(path.join(RAW, "npm-audit.exitcode")) ? auditExitNpm :
                  exists(path.join(RAW, "pnpm-audit.exitcode")) ? auditExitPnpm :
                  exists(path.join(RAW, "yarn-audit.exitcode")) ? auditExitYarn : 0);

function parseAuditVulnsFromNpmLike(json) {
  // npm audit --json (v6/v7+) => metadata.vulnerabilities.{info,low,moderate,high,critical}
  // pnpm audit --json => souvent similaire, mais on reste robuste
  const empty = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  if (!json || typeof json !== "object") return empty;

  const meta = json.metadata && json.metadata.vulnerabilities ? json.metadata.vulnerabilities : null;
  if (meta && typeof meta === "object") {
    const info = Number(meta.info || 0);
    const low = Number(meta.low || 0);
    const moderate = Number(meta.moderate || 0);
    const high = Number(meta.high || 0);
    const critical = Number(meta.critical || 0);
    return { info, low, moderate, high, critical, total: info + low + moderate + high + critical };
  }

  // fallback: sometimes vulns are in "advisories" (older npm)
  if (json.advisories && typeof json.advisories === "object") {
    const sev = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
    for (const k of Object.keys(json.advisories)) {
      const a = json.advisories[k];
      const s = String(a?.severity || "").toLowerCase();
      if (s === "low") sev.low++;
      else if (s === "moderate") sev.moderate++;
      else if (s === "high") sev.high++;
      else if (s === "critical") sev.critical++;
      else sev.info++;
    }
    const total = sev.info + sev.low + sev.moderate + sev.high + sev.critical;
    return { ...sev, total };
  }

  return empty;
}

function parseYarnAuditNdjson(text) {
  // yarn audit --json peut produire NDJSON : type=auditAdvisory
  const sev = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  if (!text) return sev;

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    let obj = null;
    try { obj = JSON.parse(line); } catch (_) { obj = null; }
    if (!obj) continue;

    const type = obj.type || obj?.data?.type;
    if (type !== "auditAdvisory" && obj.type !== "auditAdvisory") continue;

    const severity = String(obj?.data?.advisory?.severity || obj?.advisory?.severity || "").toLowerCase();
    if (severity === "low") sev.low++;
    else if (severity === "moderate") sev.moderate++;
    else if (severity === "high") sev.high++;
    else if (severity === "critical") sev.critical++;
    else sev.info++;
  }
  sev.total = sev.info + sev.low + sev.moderate + sev.high + sev.critical;
  return sev;
}

const auditFromNpm = parseAuditVulnsFromNpmLike(npmAuditJson);
const auditFromPnpm = parseAuditVulnsFromNpmLike(pnpmAuditJson);
const auditFromYarn = parseYarnAuditNdjson(yarnAuditRaw);

const audit = (npmAuditJson ? auditFromNpm : pnpmAuditJson ? auditFromPnpm : yarnAuditRaw ? auditFromYarn : { info:0, low:0, moderate:0, high:0, critical:0, total:0 });

// --- OSV Scanner
const osvJson = readJson(path.join(RAW, "osv.json"));
const osvExit = numOr0(readText(path.join(RAW, "osv.exitcode")));

function osvSeverityBuckets(osv) {
  // OSV: résultats dans results[].packages[].vulnerabilities[]
  // On calcule : total + buckets via score CVSSv3 si présent (sinon unknown=>low)
  const out = { low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  if (!osv || typeof osv !== "object") return out;

  const vulns = [];
  const results = Array.isArray(osv.results) ? osv.results : [];
  for (const r of results) {
    const packages = Array.isArray(r.packages) ? r.packages : [];
    for (const p of packages) {
      const vs = Array.isArray(p.vulnerabilities) ? p.vulnerabilities : [];
      for (const v of vs) vulns.push(v);
    }
    // parfois: r.vulnerabilities
    const rv = Array.isArray(r.vulnerabilities) ? r.vulnerabilities : [];
    for (const v of rv) vulns.push(v);
  }
  // fallback: osv.vulnerabilities
  if (Array.isArray(osv.vulnerabilities)) {
    for (const v of osv.vulnerabilities) vulns.push(v);
  }

  function scoreFromVuln(v) {
    // osv schema: severity: [{type:"CVSS_V3", score:"7.5"}]
    const sevArr = Array.isArray(v?.severity) ? v.severity : [];
    for (const s of sevArr) {
      const type = String(s?.type || "").toUpperCase();
      const score = Number(s?.score);
      if (type.includes("CVSS") && Number.isFinite(score)) return score;
    }
    // parfois: database_specific.severity, ecosystem_specific.severity
    const dbs = String(v?.database_specific?.severity || v?.ecosystem_specific?.severity || "").toLowerCase();
    if (dbs === "critical") return 10;
    if (dbs === "high") return 8.5;
    if (dbs === "moderate" || dbs === "medium") return 5.5;
    if (dbs === "low") return 2;
    return null;
  }

  for (const v of vulns) {
    const score = scoreFromVuln(v);
    if (score == null) out.low++;
    else if (score >= 9) out.critical++;
    else if (score >= 7) out.high++;
    else if (score >= 4) out.moderate++;
    else out.low++;
  }
  out.total = out.low + out.moderate + out.high + out.critical;
  return out;
}

const osvStats = osvSeverityBuckets(osvJson);

// --- Semgrep
const semgrepJson = readJson(path.join(RAW, "semgrep.json"));
const semgrepExit = numOr0(readText(path.join(RAW, "semgrep.exitcode")));

function semgrepStats(json) {
  const out = { error: 0, warning: 0, info: 0, total: 0, topRules: [] };
  if (!json || typeof json !== "object") return out;
  const results = Array.isArray(json.results) ? json.results : [];
  const byRule = new Map();
  for (const r of results) {
    const sev = String(r?.extra?.severity || r?.severity || "").toUpperCase();
    if (sev === "ERROR") out.error++;
    else if (sev === "WARNING") out.warning++;
    else out.info++;

    const rule = String(r?.check_id || r?.rule_id || "unknown");
    byRule.set(rule, (byRule.get(rule) || 0) + 1);
  }
  out.total = out.error + out.warning + out.info;
  out.topRules = [...byRule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return out;
}

const semgrep = semgrepStats(semgrepJson);

// --- Gitleaks
const gitleaksJson = readJson(path.join(RAW, "gitleaks.json"));
const gitleaksTxt = readText(path.join(RAW, "gitleaks.txt"));
const gitleaksExit = numOr0(readText(path.join(RAW, "gitleaks.exitcode")));

function gitleaksStats(json) {
  const out = { total: 0, byRule: [] };
  if (!json) return out;

  // gitleaks json report: souvent Array
  const arr = Array.isArray(json) ? json : Array.isArray(json.findings) ? json.findings : [];
  out.total = arr.length;

  const by = new Map();
  for (const f of arr) {
    const rule = String(f?.RuleID || f?.Rule || f?.Description || "unknown");
    by.set(rule, (by.get(rule) || 0) + 1);
  }
  out.byRule = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return out;
}

const gitleaks = gitleaksStats(gitleaksJson);

// --- Status labels (comme build)
function statusLabel(exitCode, existsFlag) {
  if (!existsFlag) return { label: "SKIP", ok: true, code: 2 };
  if (exitCode === 0) return { label: "RÉUSSI", ok: true, code: 0 };
  // certains outils retournent 1 si findings
  return { label: "ÉCHEC", ok: false, code: exitCode };
}

const hasAudit = !!(npmAuditJson || pnpmAuditJson || yarnAuditRaw);
const hasOsv = exists(path.join(RAW, "osv.exitcode")) || exists(path.join(RAW, "osv.json")) || exists(path.join(RAW, "osv.txt"));
const hasSemgrep = exists(path.join(RAW, "semgrep.exitcode")) || exists(path.join(RAW, "semgrep.json")) || exists(path.join(RAW, "semgrep.txt"));
const hasGitleaks = exists(path.join(RAW, "gitleaks.exitcode")) || exists(path.join(RAW, "gitleaks.json")) || exists(path.join(RAW, "gitleaks.txt"));

const auditStatus = statusLabel(auditExit, hasAudit);
const osvStatus = statusLabel(osvExit, hasOsv);
const semgrepStatus = statusLabel(semgrepExit, hasSemgrep);
const gitleaksStatus = statusLabel(gitleaksExit, hasGitleaks);

// ---------------- INDEX (DASHBOARD) AVEC SECTIONS
const indexBody = `
<div class="section-header">
  <h2 style="margin:0;">Analyse statique</h2>
  <div class="pill">Qualité & Architecture</div>
</div>

<div class="grid">
  <div class="card">
    <h2>Linter ESLint</h2>
    <div class="row"><div class="kpi" style="color:var(--error)">${eslint.errorCount}</div><div class="pill">Erreurs</div><div class="kpi" style="color:var(--warning); font-size:1.5rem">${eslint.warnCount}</div><div class="pill">Warnings</div></div>
    <div class="chart-container"><canvas id="eslintPie"></canvas></div>
    <div class="card-footer-row"><span class="footer-text-small">Analyse de Code</span><a href="./eslint.html" class="btn-detail">Voir le rapport détaillé →</a></div>
  </div>

  <div class="card">
    <h2>TypeScript</h2>
    <div class="kpi" style="color:${tsErrors > 0 ? 'var(--error)' : 'var(--success)'}">${tsErrors}</div>
    <div class="pill">Erreurs détectées</div>
    <div class="chart-container"><canvas id="tsBar"></canvas></div>
    <div class="card-footer-row"><span class="footer-text-small">Type Check</span><a href="./typescript.html" class="btn-detail">Voir le rapport détaillé →</a></div>
  </div>

  <div class="card">
    <h2>Dead Code</h2>
    <div class="kpi">${tsPrune.length}</div>
    <div class="pill">Exports non utilisés</div>
    <div class="chart-container"><canvas id="deadBar"></canvas></div>
    <div class="card-footer-row"><span class="footer-text-small">ts-prune</span><a href="./deadcode.html" class="btn-detail">Voir le rapport détaillé →</a></div>
  </div>

  <div class="card">
    <h2>Dépendances</h2>
    <div class="row"><div class="kpi" style="color:var(--success)">${depUsed}</div><div class="pill">Utilisés</div><div class="kpi" style="color:#3b82f6; font-size:1.5rem">${depUnused}</div><div class="pill">Inutilisés</div></div>
    <div class="chart-container"><canvas id="depsPie"></canvas></div>
    <div class="card-footer-row"><span class="footer-text-small">depcheck</span><a href="./deps.html" class="btn-detail">Voir le rapport détaillé →</a></div>
  </div>

  <div class="card">
    <h2>Circular Deps</h2>
    <div class="kpi">${madgeCycles.length}</div>
    <div class="pill">Cycles détectés</div>
    <div class="chart-container"><canvas id="madgeBar"></canvas></div>
    <div class="card-footer-row"><span class="footer-text-small">madge</span><a href="./madge.html" class="btn-detail">Voir le rapport détaillé →</a></div>
  </div>

  <div class="card">
    <h2>Formatage</h2>
    <div class="kpi" style="color:${prettierOk ? 'var(--success)' : 'var(--error)'}">${prettierOk ? 'Valide' : 'Invalide'}</div>
    <div class="status-badge ${prettierOk ? 'status-ok' : 'status-ko'}">${prettierOk ? 'Prettier OK' : 'Issues détectées'}</div>
    <div class="chart-container"><canvas id="formatPie"></canvas></div>
    <div class="card-footer-row"><span class="footer-text-small">Code Style</span><a href="./format.html" class="btn-detail">Voir le rapport détaillé →</a></div>
  </div>

  <div class="card">
    <h2>Build Next.js</h2>
    <div class="kpi" style="color:${buildExit === 0 ? 'var(--success)' : 'var(--error)'}">${buildStatus}</div>
    <div class="status-badge ${buildExit === 0 ? 'status-ok' : 'status-ko'}">Code: ${buildExit}</div>
    <div class="chart-container"><canvas id="buildPie"></canvas></div>
    <div class="card-footer-row"><span class="footer-text-small">Production</span><a href="./build.html" class="btn-detail">Voir le rapport détaillé →</a></div>
  </div>
</div>

<div class="section-header">
  <h2 style="margin:0;">Sécurité et vulnérabilités</h2>
  <div class="pill">SAST • SCA • Secrets</div>
</div>

<div class="grid">
  <div class="card">
    <h2>Audit Dépendances</h2>
    <div class="row">
      <div class="kpi" style="color:${audit.critical + audit.high > 0 ? 'var(--error)' : (audit.total>0 ? 'var(--warning)' : 'var(--success)')}">${audit.total}</div>
      <div class="pill">Vulnérabilités</div>
    </div>
    <div class="status-badge ${auditStatus.ok ? 'status-ok' : 'status-ko'}">Statut: ${auditStatus.label} • Code: ${auditStatus.code}</div>
    <div class="chart-container"><canvas id="auditPie"></canvas></div>
    <div class="card-footer-row"><span class="footer-text-small">npm/pnpm/yarn audit</span><a href="./audit.html" class="btn-detail">Voir le rapport détaillé →</a></div>
  </div>

  <div class="card">
    <h2>OSV-Scanner</h2>
    <div class="row">
      <div class="kpi" style="color:${osvStats.critical + osvStats.high > 0 ? 'var(--error)' : (osvStats.total>0 ? 'var(--warning)' : 'var(--success)')}">${osvStats.total}</div>
      <div class="pill">Vulnérabilités</div>
    </div>
    <div class="status-badge ${osvStatus.ok ? 'status-ok' : 'status-ko'}">Statut: ${osvStatus.label} • Code: ${osvStatus.code}</div>
    <div class="chart-container"><canvas id="osvPie"></canvas></div>
    <div class="card-footer-row"><span class="footer-text-small">OSV</span><a href="./osv.html" class="btn-detail">Voir le rapport détaillé →</a></div>
  </div>

  <div class="card">
    <h2>Semgrep SAST</h2>
    <div class="row">
      <div class="kpi" style="color:${semgrep.error > 0 ? 'var(--error)' : (semgrep.warning>0 ? 'var(--warning)' : 'var(--success)')}">${semgrep.total}</div>
      <div class="pill">Findings</div>
    </div>
    <div class="status-badge ${semgrepStatus.ok ? 'status-ok' : 'status-ko'}">Statut: ${semgrepStatus.label} • Code: ${semgrepStatus.code}</div>
    <div class="chart-container"><canvas id="semgrepPie"></canvas></div>
    <div class="card-footer-row"><span class="footer-text-small">SAST</span><a href="./semgrep.html" class="btn-detail">Voir le rapport détaillé →</a></div>
  </div>

  <div class="card">
    <h2>Secrets (Gitleaks)</h2>
    <div class="row">
      <div class="kpi" style="color:${gitleaks.total > 0 ? 'var(--error)' : 'var(--success)'}">${gitleaks.total}</div>
      <div class="pill">Secrets</div>
    </div>
    <div class="status-badge ${gitleaksStatus.ok ? 'status-ok' : 'status-ko'}">Statut: ${gitleaksStatus.label} • Code: ${gitleaksStatus.code}</div>
    <div class="chart-container"><canvas id="gitleaksPie"></canvas></div>
    <div class="card-footer-row"><span class="footer-text-small">Secrets Scan</span><a href="./gitleaks.html" class="btn-detail">Voir le rapport détaillé →</a></div>
  </div>
</div>
`;

const indexScript =
  // statique
  mkDoughnutChart("eslintPie", ["Erreurs", "Warnings"], [eslint.errorCount, eslint.warnCount], ["#ef4444", "#f59e0b"]) +
  mkBarChart("tsBar", ["Erreurs TS"], [tsErrors], "Total", tsErrors > 0 ? "#ef4444" : "#10b981") +
  mkBarChart("deadBar", ["Exports"], [tsPrune.length], "Total", "#3b82f6") +
  mkDoughnutChart("depsPie", ["Utilisés", "Inutilisés"], [depUsed, depUnused], ["#10b981", "#3b82f6"]) +
  mkBarChart("madgeBar", ["Cycles"], [madgeCycles.length], "Total", "#f59e0b") +
  mkDoughnutChart("formatPie", ["OK", "KO"], [prettierOk ? 1 : 0, prettierOk ? 0 : 1], ["#10b981", "#ef4444"]) +
  mkDoughnutChart("buildPie", ["Succès", "Échec"], [buildExit === 0 ? 1 : 0, buildExit !== 0 ? 1 : 0], ["#10b981", "#ef4444"]) +

  // sécurité
  mkDoughnutChart("auditPie", ["Crit", "High", "Mod", "Low/Info"], [audit.critical, audit.high, audit.moderate, audit.low + audit.info], ["#ef4444", "#f97316", "#f59e0b", "#10b981"]) +
  mkDoughnutChart("osvPie", ["Crit", "High", "Mod", "Low"], [osvStats.critical, osvStats.high, osvStats.moderate, osvStats.low], ["#ef4444", "#f97316", "#f59e0b", "#10b981"]) +
  mkDoughnutChart("semgrepPie", ["Error", "Warning", "Info"], [semgrep.error, semgrep.warning, semgrep.info], ["#ef4444", "#f59e0b", "#10b981"]) +
  mkDoughnutChart("gitleaksPie", ["Secrets", "OK"], [gitleaks.total, gitleaks.total > 0 ? 0 : 1], ["#ef4444", "#10b981"]);

write("index.html", htmlShell("Dashboard Qualité", indexBody, indexScript));

// ---------------- PAGES DE DÉTAILS (inchangé + sécurité)
function generateDetailPage(name, title, content, chartsHtml = "", chartsScript = "", useGrid2 = true) {
  const preId = "pre_" + name;
  const gridClass = useGrid2 ? "grid-2" : "grid";
  const body = `<h1>${title}</h1><a href="index.html" style="font-weight:bold; color:var(--primary); text-decoration:none;">← Retour au Dashboard</a>
    ${chartsHtml ? `<div class="${gridClass}" style="margin-top:1.5rem">${chartsHtml}</div>` : ""}
    <div class="section-header"><h2>Détails complets</h2><button class="copy-btn" onclick="copyPre(this, '${preId}')">Copier le texte</button></div>
    <pre id="${preId}">${escapeHtml(content)}</pre>`;
  write(`${name}.html`, htmlShell(title, body, chartsScript));
}

// ----- 1 à 7 : cartes et pages statiques (comme avant)
generateDetailPage("eslint", "Analyse ESLint", JSON.stringify(eslintJson, null, 2),
  `<div class="card"><h2>Règles les plus violées</h2><div class="chart-container"><canvas id="ruleChart"></canvas></div></div>
   <div class="card"><h2>Fichiers à corriger</h2><div class="chart-container"><canvas id="fileChart"></canvas></div></div>`,
  mkBarChart("ruleChart", eslint.topRules.map(r => r[0]), eslint.topRules.map(r => r[1]), "Violations", "#ef4444") +
  mkBarChart("fileChart", eslint.topFiles.map(f => f[0].split("/").pop()), eslint.topFiles.map(f => f[1]), "Erreurs", "#f59e0b")
);

generateDetailPage("typescript", "TypeScript", typecheckTxt,
  `<div class="card"><h2>État du Typecheck</h2><div class="chart-container"><canvas id="tsDetailPie"></canvas></div></div>
   <div class="card"><h2>Résumé</h2><div class="kpi" style="color:${tsErrors > 0 ? 'var(--error)' : 'var(--success)'}">${tsErrors}</div><div class="pill">Erreurs TS totales</div></div>`,
  mkDoughnutChart("tsDetailPie", ["Erreurs", "Valide"], [tsErrors, tsErrors === 0 ? 1 : 0], [tsErrors > 0 ? "#ef4444" : "#10b981", "#f1f5f9"])
);

generateDetailPage("deps", "Dépendances", JSON.stringify(depcheckJson, null, 2),
  `<div class="card"><h2>Stats d'utilisation</h2><div class="chart-container"><canvas id="depsPieDetail"></canvas></div></div>
   <div class="card"><h2>Résumé</h2><div class="row"><div class="kpi" style="color:var(--success)">${depUsed}</div><div class="pill">Utilisés</div><div class="kpi" style="color:#3b82f6; margin-left:1rem">${depUnused}</div><div class="pill">Inutilisés</div></div></div>`,
  mkDoughnutChart("depsPieDetail", ["Utilisés", "Inutilisés"], [depUsed, depUnused], ["#10b981", "#3b82f6"])
);

generateDetailPage("deadcode", "Dead Code", tsPruneTxt,
  `<div class="card"><h2>Exports non utilisés</h2><div class="chart-container"><canvas id="deadDetailBar"></canvas></div></div>
   <div class="card"><h2>Analyse</h2><div class="kpi">${tsPrune.length}</div><div class="pill">Fichiers avec du code mort</div></div>`,
  mkBarChart("deadDetailBar", ["Code Mort"], [tsPrune.length], "Total", "#3b82f6")
);

generateDetailPage("madge", "Circular Deps", madgeTxt,
  `<div class="card"><h2>Dépendances Circulaires</h2><div class="chart-container"><canvas id="madgeDetailBar"></canvas></div></div>
   <div class="card"><h2>Gravité</h2><div class="kpi" style="color:${madgeCycles.length > 0 ? 'var(--warning)' : 'var(--success)'}">${madgeCycles.length}</div><div class="pill">Cycles détectés</div></div>`,
  mkBarChart("madgeDetailBar", ["Cycles"], [madgeCycles.length], "Total", "#f59e0b")
);

generateDetailPage("format", "Formatage Prettier", prettierTxt,
  `<div class="card"><h2>Respect du Style</h2><div class="chart-container"><canvas id="formatDetailPie"></canvas></div></div>
   <div class="card"><h2>Statut</h2><div class="status-badge ${prettierOk ? 'status-ok' : 'status-ko'}" style="font-size:1.5rem">${prettierOk ? "OK" : "KO"}</div></div>`,
  mkDoughnutChart("formatDetailPie", ["OK", "Issues"], [prettierOk ? 1 : 0, prettierOk ? 0 : 1], ["#10b981", "#ef4444"])
);

generateDetailPage("build", "Build Next.js", nextBuildTxt,
  `<div class="card"><h2>Statut du Build</h2><div class="chart-container"><canvas id="buildDetailPie"></canvas></div></div>
   <div class="card"><h2>Exit Code</h2><div class="kpi" style="color:${buildExit === 0 ? 'var(--success)' : 'var(--error)'}">${buildExit}</div><div class="pill">${buildStatus}</div></div>`,
  mkDoughnutChart("buildDetailPie", ["Succès", "Échec"], [buildExit === 0 ? 1 : 0, buildExit !== 0 ? 1 : 0], ["#10b981", "#ef4444"])
);

// ----- SÉCURITÉ : pages détails + cards
const auditContent =
  npmAuditJson ? JSON.stringify(npmAuditJson, null, 2) :
  pnpmAuditJson ? JSON.stringify(pnpmAuditJson, null, 2) :
  yarnAuditRaw ? yarnAuditRaw :
  "Aucun fichier d'audit trouvé (npm-audit.json / pnpm-audit.json / yarn-audit.json).";

generateDetailPage("audit", "Sécurité - Audit dépendances", auditContent,
  `<div class="card"><h2>Répartition des vulnérabilités</h2><div class="chart-container"><canvas id="auditDetailPie"></canvas></div></div>
   <div class="card"><h2>Statut</h2>
     <div class="kpi" style="color:${audit.critical + audit.high > 0 ? 'var(--error)' : (audit.total>0 ? 'var(--warning)' : 'var(--success)')}">${audit.total}</div>
     <div class="pill">Total vulnérabilités</div>
     <div class="status-badge ${auditStatus.ok ? 'status-ok' : 'status-ko'}">Statut: ${auditStatus.label} • Code: ${auditStatus.code}</div>
   </div>`,
  mkDoughnutChart("auditDetailPie", ["Critical", "High", "Moderate", "Low", "Info"], [audit.critical, audit.high, audit.moderate, audit.low, audit.info], ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6"])
);

generateDetailPage("osv", "Sécurité - OSV Scanner", osvJson ? JSON.stringify(osvJson, null, 2) : readText(path.join(RAW, "osv.txt")) || "Aucun rapport OSV trouvé.",
  `<div class="card"><h2>Répartition des vulnérabilités</h2><div class="chart-container"><canvas id="osvDetailPie"></canvas></div></div>
   <div class="card"><h2>Statut</h2>
     <div class="kpi" style="color:${osvStats.critical + osvStats.high > 0 ? 'var(--error)' : (osvStats.total>0 ? 'var(--warning)' : 'var(--success)')}">${osvStats.total}</div>
     <div class="pill">Total vulnérabilités</div>
     <div class="status-badge ${osvStatus.ok ? 'status-ok' : 'status-ko'}">Statut: ${osvStatus.label} • Code: ${osvStatus.code}</div>
   </div>`,
  mkDoughnutChart("osvDetailPie", ["Critical", "High", "Moderate", "Low"], [osvStats.critical, osvStats.high, osvStats.moderate, osvStats.low], ["#ef4444", "#f97316", "#f59e0b", "#10b981"])
);

generateDetailPage("semgrep", "Sécurité - Semgrep SAST", semgrepJson ? JSON.stringify(semgrepJson, null, 2) : readText(path.join(RAW, "semgrep.txt")) || "Aucun rapport Semgrep trouvé.",
  `<div class="card"><h2>Répartition des findings</h2><div class="chart-container"><canvas id="semgrepDetailPie"></canvas></div></div>
   <div class="card"><h2>Top règles</h2><div class="chart-container"><canvas id="semgrepRulesBar"></canvas></div></div>`,
  mkDoughnutChart("semgrepDetailPie", ["ERROR", "WARNING", "INFO"], [semgrep.error, semgrep.warning, semgrep.info], ["#ef4444", "#f59e0b", "#10b981"]) +
  mkBarChart("semgrepRulesBar", semgrep.topRules.map(r => r[0]).slice(0, 10), semgrep.topRules.map(r => r[1]).slice(0, 10), "Occurrences", "#ef4444")
);

generateDetailPage("gitleaks", "Sécurité - Secrets (Gitleaks)", gitleaksJson ? JSON.stringify(gitleaksJson, null, 2) : (gitleaksTxt || "Aucun rapport Gitleaks trouvé."),
  `<div class="card"><h2>Secrets détectés</h2><div class="chart-container"><canvas id="gitleaksDetailPie"></canvas></div></div>
   <div class="card"><h2>Top règles</h2><div class="chart-container"><canvas id="gitleaksRulesBar"></canvas></div></div>`,
  mkDoughnutChart("gitleaksDetailPie", ["Secrets", "OK"], [gitleaks.total, gitleaks.total > 0 ? 0 : 1], ["#ef4444", "#10b981"]) +
  mkBarChart("gitleaksRulesBar", gitleaks.byRule.map(r => r[0]).slice(0, 10), gitleaks.byRule.map(r => r[1]).slice(0, 10), "Occurrences", "#f59e0b")
);

console.log("✅ Terminé : Dashboard (Analyse statique + Sécurité) généré avec sections et cartes.");
