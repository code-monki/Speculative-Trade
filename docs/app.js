/*! SPDX-License-Identifier: MIT */
/* Speculative Trade Generator (no build step)
   - Loads ./trade-columns.json and ./merchandise.json
   - Minimal + Advanced modes
   - Column: roll 1D6 -> trade class (Ind/nInd/Ag/Desert/Water/Vacc), fallback None if not present
   - Row: roll 1D6 -> merchandise category, then select the 1-3 / 4-5 / 6 item
*/

const $ = (sel) => document.querySelector(sel);

const STATE = {
  mode: "minimal",
  tradeColumns: null,
  merchandise: null,
  theme: null,
};

const TRADE_CODES = [
  { key: "Ind", label: "Ind" },
  { key: "nInd", label: "nInd" },
  { key: "Ag", label: "Ag" },
  { key: "Desert", label: "Desert" },
  { key: "Water", label: "Water" },
  { key: "Vacc", label: "Vacc" },
  { key: "Rich", label: "Rich (adv)" },
  { key: "Poor", label: "Poor (adv)" },
  { key: "Balkanized", label: "Balkanized (adv)" },
  { key: "Amber", label: "Amber (adv)" },
];

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("st_theme", theme);
  STATE.theme = theme;
}

function toggleTheme() {
  const cur = STATE.theme ?? "dark";
  setTheme(cur === "dark" ? "light" : "dark");
}

function setMode(mode) {
  STATE.mode = mode;
  $("#modeMinimal").setAttribute("aria-selected", mode === "minimal" ? "true" : "false");
  $("#modeAdvanced").setAttribute("aria-selected", mode === "advanced" ? "true" : "false");
  $("#advancedPanel").hidden = mode !== "advanced";
}

function rollD6(useRandom, promptLabel) {
  if (useRandom) return 1 + Math.floor(Math.random() * 6);
  const v = window.prompt(`${promptLabel} (enter 1-6)`, "1");
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 6) throw new Error("Invalid manual die entry.");
  return n;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function selectedTradeCodes() {
  const set = new Set();
  document.querySelectorAll("#tradeCodeBox input[type=checkbox]").forEach(cb => {
    if (cb.checked) set.add(cb.value);
  });
  // Advanced flags (separate controls) also map to conditions
  if (!$("#advancedPanel").hidden) {
    if ($("#flagRich").checked) set.add("Rich");
    if ($("#flagPoor").checked) set.add("Poor");
    if ($("#flagBalkanized").checked) set.add("Balkanized");
    if ($("#flagAmber").checked) set.add("Amber");
  }
  return set;
}

function currentConditions() {
  const cond = new Set(selectedTradeCodes());

  const zone = $("#zone").value;
  if (zone) cond.add(zone); // Inner / Outer

  if ($("#flagHabitable").checked) cond.add("Habitable");

  const tl = Number($("#techLevel").value);
  if (Number.isFinite(tl)) {
    if (tl <= 4) cond.add("TL<=4");
    if (tl >= 10) cond.add("TL>=10");
  }

  const sp = $("#starport").value;
  if (sp) cond.add(`${sp}-starport`);

  return cond;
}

function applyColumnDM(baseRoll, tradeClass, condSet) {
  if (!STATE.tradeColumns) return baseRoll;
  const col = STATE.tradeColumns.columns[tradeClass];
  if (!col || !col.columnDM) return baseRoll;

  let dm = 0;
  for (const rule of col.columnDM) {
    if (condSet.has(rule.condition)) dm += Number(rule.dm) || 0;
  }
  return clamp(baseRoll + dm, 1, 6);
}

function pickTradeClass(colRoll, worldCodes) {
  const tc = STATE.tradeColumns.tradeClassesByColumnRoll[String(colRoll)];
  if (worldCodes.has(tc)) return tc;
  return "None";
}

function pickCategory(tradeClass, rowRoll) {
  const rows = STATE.tradeColumns.columns[tradeClass].rows;
  return rows[String(rowRoll)];
}

function findMerchItem(category, rowRoll) {
  const items = STATE.merchandise.items.filter(it => it.category === category);
  for (const it of items) {
    if (rowRoll >= it.roll.min && rowRoll <= it.roll.max) return it;
  }
  return null;
}

function calcBuySellDM(item, condSet) {
  let total = 0;
  const applied = [];
  for (const [k, v] of Object.entries(item.buySellDM || {})) {
    if (condSet.has(k)) {
      total += v;
      applied.push(`${k} ${v >= 0 ? "+" : ""}${v}`);
    }
  }
  // Multipliers are ambiguous in the original; we display them rather than applying.
  return { total, applied };
}

function legalityStatus(item, lawLevel) {
  if (!item.legalityLG) return { ok: true, text: "—" };
  const s = String(item.legalityLG);
  const parts = s.split("-").map(x => Number(x));
  const lgMax = parts.length === 2 ? Math.max(parts[0], parts[1]) : parts[0];
  const ok = lawLevel <= lgMax;
  return { ok, text: `LG ${s} (Law ${lawLevel})` };
}

function formatCr(n) {
  if (!Number.isFinite(n)) return String(n);
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}MCr`;
  if (n >= 1000) return `${(n/1000).toFixed(0)}KCr`;
  return `${n}Cr`;
}

function renderResults(rows) {
  const host = $("#results");
  host.innerHTML = "";
  if (!rows.length) {
    host.innerHTML = `<div class="muted">No results yet.</div>`;
    return;
  }

  for (const r of rows) {
    const item = r.item;
    const dm = r.dm;
    const legal = r.legal;

    const warn = legal.ok ? "" : " badge-warn";
    const legalBadge = legal.ok ? "Legal" : "Illegal?";

    const mult = item.multipliers
      ? Object.entries(item.multipliers).map(([k,v]) => `${k}×${v}`).join(", ")
      : "—";

    host.insertAdjacentHTML("beforeend", `
      <div class="result">
        <div class="result-head">
          <div>
            <div class="result-title">${item.name}</div>
            <div class="muted">${item.category} • row ${item.roll.min}${item.roll.max !== item.roll.min ? "-" + item.roll.max : ""}</div>
          </div>
          <div class="badge${warn}" title="${legal.text}">${legalBadge}</div>
        </div>

        <div class="kv">
          <div class="k">Column → Category</div><div class="v">${r.tradeClass} (col ${r.colRoll}) → ${item.category} (row ${r.rowRoll})</div>
          <div class="k">Cr / dTon</div><div class="v">${formatCr(item.crPerDTon)}</div>
          <div class="k">Allotment</div><div class="v">${item.allotmentDTon ?? "—"} dTon</div>
          <div class="k">Handling / Notes</div><div class="v">${[item.handling, item.notes].filter(Boolean).join(" • ") || "—"}</div>
          <div class="k">Buy/Sell DM</div><div class="v">${dm.total} (${dm.applied.length ? dm.applied.join(", ") : "no matches"})</div>
          <div class="k">Multipliers</div><div class="v">${mult}</div>
          <div class="k">Legality</div><div class="v">${legal.text}</div>
        </div>
      </div>
    `);
  }
}

async function loadTables() {
  const [cols, merch] = await Promise.all([
    fetch("./trade-columns.json").then(r => r.json()),
    fetch("./merchandise.json").then(r => r.json()),
  ]);
  STATE.tradeColumns = cols;
  STATE.merchandise = merch;
  $("#dataStatus").textContent = `Loaded ${merch.items.length} merchandise entries.`;
}

function initTradeCodeUI() {
  const host = $("#tradeCodeBox");
  host.innerHTML = "";
  for (const tc of TRADE_CODES.slice(0, 6)) {
    host.insertAdjacentHTML("beforeend", `
      <label class="pill">
        <input type="checkbox" value="${tc.key}" />
        <span>${tc.label}</span>
      </label>
    `);
  }
}

function clearResults() {
  $("#results").innerHTML = "";
}

function generate() {
  if (!STATE.tradeColumns || !STATE.merchandise) return;

  const useRandom = $("#useRandom").checked;
  const rollCount = clamp(Number($("#rollCount").value || 0), 1, 50);
  const lawLevel = clamp(Number($("#lawLevel").value || 0), 0, 15);

  const worldCodes = selectedTradeCodes();
  const condSet = currentConditions();

  const rows = [];

  for (let i = 0; i < rollCount; i++) {
    const baseCol = rollD6(useRandom, `Lot ${i+1}: column roll`);
    // advanced: column DM applies to the *rolled trade class* column
    let tradeClass = pickTradeClass(baseCol, worldCodes);

    // if advanced mode, apply DM to the chosen column roll (per that column's DM rules)
    let colRoll = baseCol;
    if (STATE.mode === "advanced") {
      colRoll = applyColumnDM(baseCol, tradeClass, condSet);
      tradeClass = pickTradeClass(colRoll, worldCodes);
    }

    const rowRoll = rollD6(useRandom, `Lot ${i+1}: row roll`);
    const category = pickCategory(tradeClass, rowRoll);
    const item = findMerchItem(category, rowRoll);

    if (!item) continue;

    const dm = calcBuySellDM(item, condSet);
    const legal = legalityStatus(item, lawLevel);

    rows.push({ i: i+1, baseCol, colRoll, tradeClass, rowRoll, category, item, dm, legal });
  }

  renderResults(rows);
}

function wireEvents() {
  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#modeMinimal").addEventListener("click", () => setMode("minimal"));
  $("#modeAdvanced").addEventListener("click", () => setMode("advanced"));
  $("#btnGenerate").addEventListener("click", () => {
    try { generate(); } catch (e) { alert(String(e.message || e)); }
  });
  $("#btnClear").addEventListener("click", clearResults);
}

(async function main() {
  // theme
  const saved = localStorage.getItem("st_theme");
  if (saved === "light" || saved === "dark") setTheme(saved);
  else {
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(prefersLight ? "light" : "dark");
  }

  initTradeCodeUI();
  wireEvents();
  setMode("minimal");

  try {
    await loadTables();
  } catch (e) {
    $("#dataStatus").textContent = "Failed to load JSON tables. If running locally, use a static server (or GitHub Pages).";
    console.error(e);
  }

  renderResults([]);
})();


/* ------------------------------------------------------------
   Legal / NOTICE Modal
------------------------------------------------------------ */

async function openNoticeModal() {
  try {
    const resp = await fetch("./NOTICE", { cache: "no-store" });
    const text = await resp.text();
    const escaped = text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    openModal("Legal / NOTICE", `<pre class="notice-pre">${escaped}</pre>`);
  } catch (e) {
    openModal("Legal / NOTICE", `<p>Unable to load NOTICE file.</p>`);
  }
}
