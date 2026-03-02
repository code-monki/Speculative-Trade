/*! SPDX-License-Identifier: MIT */
/* ============================================================
   Speculative Trade Generator
   Code: MIT License
   Data: CC BY-SA 4.0 (see repository LICENSE files)
   ============================================================ */

"use strict";

/* ------------------------------------------------------------
   Utilities
------------------------------------------------------------ */

const $ = (sel) => document.querySelector(sel);

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function rollD6(useRandom, promptLabel) {
  if (useRandom) return 1 + Math.floor(Math.random() * 6);

  const v = window.prompt(`${promptLabel} (enter 1-6)`, "1");
  const n = Number(v);

  if (!Number.isFinite(n) || n < 1 || n > 6) {
    throw new Error("Invalid manual die entry.");
  }

  return n;
}

/* ------------------------------------------------------------
   State
------------------------------------------------------------ */

const STATE = {
  mode: "minimal",
  tradeColumns: null,
  merchandise: null,
  theme: "dark"
};

/* ------------------------------------------------------------
   Theme
------------------------------------------------------------ */

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("st_theme", theme);
  STATE.theme = theme;
}

function toggleTheme() {
  setTheme(STATE.theme === "dark" ? "light" : "dark");
}

/* ------------------------------------------------------------
   Mode
------------------------------------------------------------ */

function setMode(mode) {
  STATE.mode = mode;
  $("#modeMinimal").setAttribute("aria-selected", mode === "minimal");
  $("#modeAdvanced").setAttribute("aria-selected", mode === "advanced");
  $("#advancedPanel").hidden = mode !== "advanced";
}

/* ------------------------------------------------------------
   Data Loading
------------------------------------------------------------ */

async function loadTables() {
  const [cols, merch] = await Promise.all([
    fetch("./trade-columns.json").then(r => r.json()),
    fetch("./merchandise.json").then(r => r.json())
  ]);

  STATE.tradeColumns = cols;
  STATE.merchandise = merch;

  $("#dataStatus").textContent = `Loaded ${merch.items.length} merchandise entries.`;
}

/* ------------------------------------------------------------
   Trade Logic
------------------------------------------------------------ */

function selectedTradeCodes() {
  const set = new Set();

  document.querySelectorAll("#tradeCodeBox input[type=checkbox]").forEach(cb => {
    if (cb.checked) set.add(cb.value);
  });

  if ($("#flagRich")?.checked) set.add("Rich");
  if ($("#flagPoor")?.checked) set.add("Poor");
  if ($("#flagBalkanized")?.checked) set.add("Balkanized");
  if ($("#flagAmber")?.checked) set.add("Amber");
  if ($("#flagHabitable")?.checked) set.add("Habitable");

  const zone = $("#zone")?.value;
  if (zone) set.add(zone);

  const tl = Number($("#techLevel")?.value);
  if (Number.isFinite(tl)) {
    if (tl <= 4) set.add("TL<=4");
    if (tl >= 10) set.add("TL>=10");
  }

  const starport = $("#starport")?.value;
  if (starport) set.add(`${starport}-starport`);

  return set;
}

function applyColumnDM(baseRoll, tradeClass, condSet) {
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
  return STATE.tradeColumns.columns[tradeClass].rows[String(rowRoll)];
}

function findMerchItem(category, rowRoll) {
  const items = STATE.merchandise.items.filter(it => it.category === category);
  return items.find(it => rowRoll >= it.roll.min && rowRoll <= it.roll.max);
}

function legalityStatus(item, lawLevel) {
  if (!item.legalityLG) return { ok: true, text: "—" };

  const parts = String(item.legalityLG).split("-").map(Number);
  const lgMax = parts.length === 2 ? Math.max(parts[0], parts[1]) : parts[0];
  const ok = lawLevel <= lgMax;

  return { ok, text: `LG ${item.legalityLG} (Law ${lawLevel})` };
}

/* ------------------------------------------------------------
   Rendering
------------------------------------------------------------ */

function renderResults(rows) {
  const host = $("#results");
  host.innerHTML = "";

  if (!rows.length) {
    host.innerHTML = '<div class="muted">No results yet.</div>';
    return;
  }

  for (const r of rows) {
    const legalClass = r.legal.ok ? "" : " badge-warn";

    host.insertAdjacentHTML("beforeend", `
      <div class="result">
        <div class="result-head">
          <div>
            <div class="result-title">${r.item.name}</div>
            <div class="muted">${r.tradeClass} → ${r.item.category}</div>
          </div>
          <div class="badge${legalClass}">
            ${r.legal.ok ? "Legal" : "Illegal?"}
          </div>
        </div>
      </div>
    `);
  }
}

/* ------------------------------------------------------------
   Generation
------------------------------------------------------------ */

function generate() {
  const useRandom = $("#useRandom").checked;
  const rollCount = clamp(Number($("#rollCount").value), 1, 50);
  const lawLevel = clamp(Number($("#lawLevel").value), 0, 15);

  const worldCodes = selectedTradeCodes();
  const condSet = selectedTradeCodes();

  const rows = [];

  for (let i = 0; i < rollCount; i++) {
    const baseCol = rollD6(useRandom, `Lot ${i + 1}: column roll`);
    let tradeClass = pickTradeClass(baseCol, worldCodes);

    let colRoll = baseCol;

    if (STATE.mode === "advanced") {
      colRoll = applyColumnDM(baseCol, tradeClass, condSet);
      tradeClass = pickTradeClass(colRoll, worldCodes);
    }

    const rowRoll = rollD6(useRandom, `Lot ${i + 1}: row roll`);
    const category = pickCategory(tradeClass, rowRoll);
    const item = findMerchItem(category, rowRoll);

    if (!item) continue;

    rows.push({
      tradeClass,
      item,
      legal: legalityStatus(item, lawLevel)
    });
  }

  renderResults(rows);
}

/* ------------------------------------------------------------
   Modal System
------------------------------------------------------------ */

function openModal(title, html) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  $("#modalOverlay").hidden = false;
}

function closeModal() {
  $("#modalOverlay").hidden = true;
}

/* ------------------------------------------------------------
   About / Help / Legal
------------------------------------------------------------ */

function openAboutModal() {
  openModal("About", `
    <p><strong>Speculative Trade Generator</strong> is a small web utility that loads trade tables from JSON and generates speculative trade lots using a 1D6 column + 1D6 row workflow.</p>
    <p>
      The underlying speculative trade table was published by <strong>u/InterceptSpaceCombat</strong> on the Reddit Traveller channel.
      This project does not claim ownership of the table content; it provides a convenient, structured way to use it.
    </p>
    <p>
      Source: <a href="https://www.reddit.com/r/traveller/comments/1rimleq/speculative_trade_table/" target="_blank" rel="noopener">Reddit thread</a>
    </p>
    <p class="muted">Code is MIT; data/transcription and the included source image are CC BY-SA 4.0. See Legal for details.</p>
  `);
}

function openHelpModal() {
  openModal("Help", `
    <ol>
      <li>Select the world’s <strong>trade codes</strong> (Ind/nInd/Ag/Desert/Water/Vacc).</li>
      <li>Set <strong>Number of lots</strong> (how many items to generate).</li>
      <li>Set <strong>Law Level</strong> if you want legality warnings based on item LG values.</li>
      <li>
        Choose dice input:
        <ul>
          <li><strong>Random dice</strong> uses RNG.</li>
          <li>Uncheck it to manually enter each 1D6 roll via prompt.</li>
        </ul>
      </li>
      <li>Click <strong>Generate</strong>.</li>
    </ol>
    <p>
      <strong>Advanced mode</strong> enables column modifiers (DM rules) defined in <code>trade-columns.json</code>
      (e.g., Rich/Balkanized, TL thresholds, Inner/Outer, etc.).
    </p>
  `);
}

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
    openModal("Legal / NOTICE", "<p>Unable to load NOTICE file.</p>");
  }
}

/* ------------------------------------------------------------
   Event Wiring
------------------------------------------------------------ */

function wireUI() {
  $("#themeToggle").addEventListener("click", toggleTheme);

  $("#btnAbout").addEventListener("click", openAboutModal);
  $("#btnHelp").addEventListener("click", openHelpModal);
  $("#btnLegal").addEventListener("click", openNoticeModal);

  $("#modeMinimal").addEventListener("click", () => setMode("minimal"));
  $("#modeAdvanced").addEventListener("click", () => setMode("advanced"));

  $("#btnGenerate").addEventListener("click", generate);
  $("#btnClear").addEventListener("click", () => { $("#results").innerHTML = ""; });

  $("#modalClose").addEventListener("click", closeModal);
  $("#modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
}

/* ------------------------------------------------------------
   Bootstrap
------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", async () => {
  const saved = localStorage.getItem("st_theme");
  setTheme(saved || "dark");

  wireUI();
  setMode("minimal");

  try {
    await loadTables();
  } catch (e) {
    $("#dataStatus").textContent = "Failed to load JSON tables.";
    console.error(e);
  }
});