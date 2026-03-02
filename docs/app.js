/*! SPDX-License-Identifier: MIT */
/* Speculative Trade Generator (no build step)
   - Requires a world profile line: <UWP> [codes/tags...]
   - Always applies per-column modifiers when conditions match
   - Loads ./trade-columns.json and ./merchandise.json
*/

const $ = (sel) => document.querySelector(sel);

const STATE = {
  tradeColumns: null,
  merchandise: null,
  theme: null,
  world: null, // parsed
};

/* --- Parsing helpers --- */

const UWP_RE = /^[A-EXa-ex][0-9A-Fa-f]{6}-[0-9A-Fa-f]$/;

// Column trade-classes in the source table (used to decide whether a rolled column is "present on the world")
const WORLD_TRADE_CLASS_KEYS = new Set(["Ind", "nInd", "Ag", "Desert", "Water", "Vacc"]);

// Abbreviations + common variants -> canonical tokens used by our conditions / JSON.
const TOKEN_ALIASES = new Map([
  // Column trade-classes
  ["IN", "Ind"], ["IND", "Ind"], ["INDUSTRIAL", "Ind"],
  ["NI", "nInd"], ["NIND", "nInd"], ["NONIND", "nInd"], ["NON-IND", "nInd"], ["NONINDUSTRIAL", "nInd"],
  ["AG", "Ag"], ["AGRICULTURAL", "Ag"],
  ["DE", "Desert"], ["DES", "Desert"], ["DESERT", "Desert"],
  ["WA", "Water"], ["WATER", "Water"],
  ["VA", "Vacc"], ["VAC", "Vacc"], ["VACC", "Vacc"], ["VACUUM", "Vacc"],

  // Common trade codes / tags referenced by table modifiers
  ["RI", "Rich"], ["RICH", "Rich"],
  ["PO", "Poor"], ["POOR", "Poor"],
  ["BA", "Balkanized"], ["BALK", "Balkanized"], ["BALKANIZED", "Balkanized"],
  ["AM", "Amber"], ["AMBER", "Amber"],
  ["RED", "Red"], ["GREEN", "Green"],

  // Other condition tokens used by the JSON (buy/sell DMs, column DMs)
  ["NA", "nAg"], ["NAG", "nAg"], ["NONAG", "nAg"], ["NON-AG", "nAg"],
  ["INNER", "Inner"], ["OUTER", "Outer"],
  ["HAB", "Habitable"], ["HABITABLE", "Habitable"], ["INHABITABLE", "Inhabitable"],
]);

function normalizeToken(t) {
  const raw = String(t || "").trim();
  if (!raw) return "";
  const up = raw.toUpperCase();
  if (TOKEN_ALIASES.has(up)) return TOKEN_ALIASES.get(up);
  return raw; // keep as-is (future-proof / house rules)
}

function parseHexDigit(ch) {
  const n = parseInt(ch, 16);
  if (!Number.isFinite(n)) throw new Error(`Invalid hex digit: ${ch}`);
  return n;
}

function parseUWP(uwp) {
  if (!UWP_RE.test(uwp)) throw new Error("UWP must look like A867A74-C");

  const s = uwp.toUpperCase();

  // UWP: A 8 6 7 A 7 4 - C
  //      0 1 2 3 4 5 6 7 8
  const starport = s[0];
  const law = parseHexDigit(s[6]);
  const tl = parseHexDigit(s[8]);

  return { uwp: s, starport, law, tl };
}

function parseWorldProfile(line) {
  const text = String(line || "").trim();
  if (!text) throw new Error("Enter a world profile (UWP + codes), e.g. A867A74-C Ag Ri In Inner");

  const parts = text.split(/\s+/).filter(Boolean);
  const base = parseUWP(parts[0]);

  const tokens = parts.slice(1).map(normalizeToken).filter(Boolean);

  const worldTradeClasses = new Set();
  const tags = new Set();

  for (const tok of tokens) {
    if (WORLD_TRADE_CLASS_KEYS.has(tok)) worldTradeClasses.add(tok);
    else tags.add(tok);
  }

  const cond = new Set();

  // trade classes present on the world (Ind/nInd/Ag/Desert/Water/Vacc)
  for (const c of worldTradeClasses) cond.add(c);

  // tags/extra codes
  for (const t of tags) cond.add(t);

  // Starport marker token used by some merchandise multipliers
  cond.add(`${base.starport}-starport`);

  // TL bands used by column DMs (see trade-columns.json)
  if (base.tl <= 4) cond.add("TL<=4");
  if (base.tl >= 10) cond.add("TL>=10");

  return {
    ...base,
    worldTradeClasses,
    tags,
    conditions: cond,
  };
}

function mergeContextOverrides(world) {
  const merged = new Set(world.conditions);

  const zone = $("#zone")?.value;
  if (zone) merged.add(zone);

  const habitability = $("#habitability")?.value;
  if (habitability === "Habitable") merged.add("Habitable"); // Inhabitable is inert

  const travelZone = $("#travelZone")?.value;
  // Green is inert; Amber/Red can be tags (Amber already used by some multipliers)
  if (travelZone === "Amber" || travelZone === "Red") merged.add(travelZone);

  const gov = $("#governmentType")?.value;
  // Only Balkanisation affects the current trade modifiers; map to the condition key used by JSON.
  if (gov === "7") merged.add("Balkanized");

  const econ = $("#economicStatus")?.value;
  if (econ) merged.add(econ);

  return merged;
}

/* --- Theme --- */

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("st_theme", theme);
  STATE.theme = theme;

  const btn = $("#themeToggle");
  if (btn) {
    if (theme === "dark") btn.textContent = "Theme: Dark";
    else if (theme === "light") btn.textContent = "Theme: Light";
    else if (theme === "warm") btn.textContent = "Theme: Warm";
    else btn.textContent = "Theme";
  }
}

function toggleTheme() {
  const cur = STATE.theme ?? "dark";
  if (cur === "dark") setTheme("light");
  else if (cur === "light") setTheme("warm");
  else setTheme("dark");
}

/* --- Dice / selection --- */

function rollD6(useRandom, promptLabel) {
  if (useRandom) return 1 + Math.floor(Math.random() * 6);
  const v = window.prompt(`${promptLabel} (enter 1-6)`, "1");
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 6) throw new Error("Invalid manual die entry.");
  return n;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function applyColumnDM(baseRoll, tradeClass, condSet) {
  const cols = STATE.tradeColumns;
  if (!cols) return baseRoll;

  const col = cols.columns[tradeClass];
  if (!col || !col.columnDM) return baseRoll;

  let dm = 0;
  for (const rule of col.columnDM) {
    if (condSet.has(rule.condition)) dm += Number(rule.dm) || 0;
  }
  return clamp(baseRoll + dm, 1, 6);
}

function pickTradeClass(colRoll, worldTradeClasses) {
  const tc = STATE.tradeColumns.tradeClassesByColumnRoll[String(colRoll)];
  if (worldTradeClasses.has(tc)) return tc;
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
  return { total, applied };
}

function calcMultipliers(item, condSet) {
  // Multipliers are shown in results; you can extend this later to compute actual price.
  const applied = [];
  if (!item.multipliers) return applied;
  for (const [k, v] of Object.entries(item.multipliers)) {
    if (condSet.has(k)) applied.push(`${k}×${v}`);
  }
  return applied;
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
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}MCr`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}KCr`;
  return `${n}Cr`;
}

/* --- UI updates --- */

function setDerivedUI(world) {
  $("#derivedStarport").textContent = world.starport ?? "—";
  $("#derivedTL").textContent = Number.isFinite(world.tl) ? String(world.tl) : "—";
  $("#derivedLaw").textContent = Number.isFinite(world.law) ? String(world.law) : "—";

  const tc = Array.from(world.worldTradeClasses).sort();
  $("#derivedTradeCodes").textContent = tc.length ? tc.join(", ") : "—";

  const tags = Array.from(world.tags).sort();
  $("#derivedTags").textContent = tags.length ? tags.join(", ") : "—";
}

function clearResults() {
  $("#results").innerHTML = "<div class=\"muted\">No results yet.</div>";
  $("#resultsMeta").textContent = "";
}

function tryParseAndUpdateWorld() {
  const line = $("#worldProfile").value;
  try {
    const world = parseWorldProfile(line);
    STATE.world = world;
    setDerivedUI(world);
    return true;
  } catch (e) {
    STATE.world = null;
    $("#derivedStarport").textContent = "—";
    $("#derivedTL").textContent = "—";
    $("#derivedLaw").textContent = "—";
    $("#derivedTradeCodes").textContent = "—";
    $("#derivedTags").textContent = "—";
    return false;
  }
}

/* --- Generation --- */

function generate() {
  if (!STATE.tradeColumns || !STATE.merchandise) return;
  const world = STATE.world;
  if (!world) throw new Error("Enter a valid world profile first.");

  const useRandom = $("#useRandom").checked;
  const rollCount = clamp(Number($("#rollCount").value || 0), 1, 50);

  const condSet = mergeContextOverrides(world);
  const rows = [];

  for (let i = 0; i < rollCount; i++) {
    const baseCol = rollD6(useRandom, `Lot ${i + 1}: column roll`);

    // Step 1: base pick (or None)
    let tradeClass = pickTradeClass(baseCol, world.worldTradeClasses);

    // Step 2: apply per-column DM for that tradeClass
    const colRoll = applyColumnDM(baseCol, tradeClass, condSet);

    // Step 3: re-pick after DM (DM can move you to a different column)
    tradeClass = pickTradeClass(colRoll, world.worldTradeClasses);

    // Step 4: row roll and lookup
    const rowRoll = rollD6(useRandom, `Lot ${i + 1}: row roll`);
    const category = pickCategory(tradeClass, rowRoll);
    const item = findMerchItem(category, rowRoll);
    if (!item) continue;

    const dm = calcBuySellDM(item, condSet);
    const mult = calcMultipliers(item, condSet);
    const legal = legalityStatus(item, world.law);

    rows.push({ i: i + 1, baseCol, colRoll, tradeClass, rowRoll, category, item, dm, mult, legal });
  }

  renderResults(rows);
}

function renderResults(rows) {
  const host = $("#results");
  host.innerHTML = "";
  if (!rows.length) {
    host.innerHTML = "<div class=\"muted\">No results yet.</div>";
    $("#resultsMeta").textContent = "";
    return;
  }

  $("#resultsMeta").textContent = `Generated ${rows.length} lot(s).`;

  for (const r of rows) {
    const item = r.item;
    const dm = r.dm;
    const legal = r.legal;

    const warn = legal.ok ? "" : " badge-warn";
    const legalBadge = legal.ok ? "Legal" : "Illegal?";

    const multStr = r.mult.length ? r.mult.join(", ") : (item.multipliers ? "none matched" : "—");

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
          <div class="k">Column → Category</div>
          <div class="v">${r.tradeClass} (col ${r.colRoll}; base ${r.baseCol}) → ${item.category} (row ${r.rowRoll})</div>

          <div class="k">Cr / dTon</div>
          <div class="v">${formatCr(item.crPerDTon)}</div>

          <div class="k">Allotment</div>
          <div class="v">${item.allotmentDTon ?? "—"} dTon</div>

          <div class="k">Handling / Notes</div>
          <div class="v">${[item.handling, item.notes].filter(Boolean).join(" • ") || "—"}</div>

          <div class="k">Buy/Sell DM</div>
          <div class="v">${dm.total} (${dm.applied.length ? dm.applied.join(", ") : "no matches"})</div>

          <div class="k">Multipliers</div>
          <div class="v">${multStr}</div>

          <div class="k">Legality</div>
          <div class="v">${legal.text}</div>
        </div>
      </div>
    `);
  }
}

/* --- Modal + About/Help/Legal --- */

function openModal(title, bodyHtml) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = bodyHtml;
  $("#modalOverlay").hidden = false;
}

function closeModal() {
  $("#modalOverlay").hidden = true;
  $("#modalTitle").textContent = "Modal";
  $("#modalBody").innerHTML = "";
}

async function fetchTextWithFallback(paths) {
  for (const p of paths) {
    try {
      const resp = await fetch(p, { cache: "no-store" });
      if (resp.ok) return await resp.text();
    } catch (e) {
      // continue
    }
  }
  return null;
}

async function openNoticeModal() {
  const text = await fetchTextWithFallback(["./NOTICE", "../NOTICE"]);
  if (!text) {
    openModal(
      "Legal / NOTICE",
      "<p>Unable to load NOTICE.</p><p class=\"muted\">If you publish via GitHub Pages using <code>/docs</code> as the site root, place a copy of <code>NOTICE</code> inside <code>docs/</code> to make it available to the app.</p>"
    );
    return;
  }

  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  openModal("Legal / NOTICE", `<pre class="notice-pre">${escaped}</pre>`);
}

function openAboutModal() {
  openModal("About", `
    <p><b>Speculative Trade Generator</b> is a no-build, single-page web app that rolls speculative trade lots from JSON-transcribed tables.</p>
    <p class="muted">Attribution and licensing are documented in the repository <code>README.md</code> and <code>NOTICE</code>.</p>
  `);
}

function renderColumnModifierDoc() {
  const cols = STATE.tradeColumns;
  if (!cols) return "<p class=\"muted\">Tables not loaded yet.</p>";

  const lines = [];
  const order = ["Ind", "nInd", "Ag", "Desert", "Water", "Vacc", "None"];
  for (const key of order) {
    const col = cols.columns[key];
    const rules = (col && col.columnDM) ? col.columnDM : [];
    if (!rules.length) continue;

    const ruleStr = rules.map(r => `<code>${r.condition}</code> ${r.dm >= 0 ? "+" : ""}${r.dm}`).join(", ");
    lines.push(`<li><b>${key}</b>: ${ruleStr}</li>`);
  }

  if (!lines.length) return "<p class=\"muted\">No per-column modifiers found.</p>";
  return `<ul>${lines.join("")}</ul>`;
}

function openHelpModal() {
  const aliasPairs = [
    ["In", "Ind"],
    ["Ni", "nInd"],
    ["Ag", "Ag"],
    ["De", "Desert"],
    ["Wa", "Water"],
    ["Va", "Vacc"],
    ["Ri", "Rich"],
    ["Po", "Poor"],
    ["Na", "nAg"],
    ["Ba", "Balkanized"],
    ["Amber", "Amber"],
    ["Inner/Outer", "Inner/Outer"],
  ];

  const aliasHtml = aliasPairs.map(([a, b]) => `<code>${a}</code>→<code>${b}</code>`).join(", ");

  openModal("Help", `
    <h4>Input</h4>
    <p>Enter <b>UWP</b> first, then any codes/tags (example: <code>A867A74-C Ag Ri In Inner Amber</code>).</p>
    <p class="muted">Accepted abbreviations: ${aliasHtml}</p>

    <h4>Algorithm</h4>
    <ol>
      <li>Roll 1D6 for the <b>column</b>. This maps to a trade class per the table.</li>
      <li>If the rolled trade class is <b>not present</b> in your world’s trade classes, treat it as <b>None</b>.</li>
      <li>Apply <b>per-column modifiers</b> (DMs) for that trade class when their conditions match (TL bands, Rich, Balkanized, Inner/Outer, Habitable).</li>
      <li>After applying the DM, re-select the trade class from the adjusted column roll (and again fall back to None if not present on the world).</li>
      <li>Roll 1D6 for the <b>row</b> within the resulting column to get a merchandise category.</li>
      <li>Select the merchandise entry whose roll range includes that row roll.</li>
      <li>Compute <b>Buy/Sell DM</b> from the item’s modifiers (based on matching conditions).</li>
      <li>Evaluate <b>Legality</b>: an item with LG X is legal if <b>Law ≤ X</b> (or ≤ the max of a range like <code>3-4</code>).</li>
    </ol>

    <h4>Per-column modifiers</h4>
    ${renderColumnModifierDoc()}

    <h4>Notes</h4>
    <ul>
      <li><b>Trade classes present</b> are only the column classes: Ind, nInd, Ag, Desert, Water, Vacc.</li>
      <li>Other tokens (e.g. Rich, Poor, Amber, Balkanized, Inner/Outer) are treated as <b>conditions</b> that may affect DMs, multipliers, or buy/sell modifiers.</li>
    </ul>
  `);
}

/* --- Load + wire --- */

async function loadTables() {
  const [cols, merch] = await Promise.all([
    fetch("./trade-columns.json").then(r => r.json()),
    fetch("./merchandise.json").then(r => r.json()),
  ]);
  STATE.tradeColumns = cols;
  STATE.merchandise = merch;
  $("#dataStatus").textContent = `Loaded ${merch.items.length} merchandise entries.`;
}

function wireEvents() {
  $("#themeToggle").addEventListener("click", toggleTheme);

  $("#btnGenerate").addEventListener("click", () => {
    try {
      const ok = tryParseAndUpdateWorld();
      if (!ok) throw new Error("Invalid world profile. Example: A867A74-C Ag Ri In Inner");
      generate();
    } catch (e) {
      alert(String(e.message || e));
    }
  });

  $("#btnClear").addEventListener("click", clearResults);

  $("#worldProfile").addEventListener("input", () => {
    tryParseAndUpdateWorld();
  });

  // Modal wiring
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalOverlay").addEventListener("click", (e) => {
    if (e.target && e.target.id === "modalOverlay") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  $("#btnLegal").addEventListener("click", openNoticeModal);
  $("#btnAbout").addEventListener("click", openAboutModal);
  $("#btnHelp").addEventListener("click", openHelpModal);
}

(function main() {
  const saved = localStorage.getItem("st_theme");
  if (saved === "light" || saved === "dark" || saved === "warm") setTheme(saved);
  else {
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(prefersLight ? "light" : "dark");
  }

  wireEvents();
  clearResults();

  loadTables().catch((e) => {
    $("#dataStatus").textContent = "Failed to load JSON tables. If running locally, use a static server (or GitHub Pages).";
    console.error(e);
  });

  tryParseAndUpdateWorld();
})();