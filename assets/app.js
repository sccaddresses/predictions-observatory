const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const formatPct = (value, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${(Number(value) * 100).toFixed(digits)}%`;
};

const formatNumber = (value, digits = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const cleanHorse = (name) => String(name || "—").replace(/\s*\([A-Z]{2,3}\)\s*$/, "");

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("predictions-theme", theme);
  const button = $("[data-theme-toggle]");
  if (button) {
    const next = theme === "light" ? "dark" : "light";
    button.setAttribute("aria-label", `Use ${next} theme`);
    button.textContent = theme === "light" ? "☾" : "☀";
  }
}

function initTheme() {
  const saved = localStorage.getItem("predictions-theme");
  const systemLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  setTheme(saved || (systemLight ? "light" : "dark"));
  $("[data-theme-toggle]")?.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
  });
}

function initNav() {
  const toggle = $("[data-nav-toggle]");
  const links = $("[data-nav-links]");
  if (!toggle || !links) return;

  const close = () => {
    links.dataset.open = "false";
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const open = links.dataset.open !== "true";
    links.dataset.open = String(open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  $$("a", links).forEach((link) => link.addEventListener("click", close));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}

function bindSimple(data) {
  $$('[data-bind]').forEach((node) => {
    const path = node.dataset.bind.split(".");
    let value = data;
    for (const key of path) value = value?.[key];
    if (value !== undefined && value !== null) node.textContent = value;
  });
}

function renderHeadlineMetrics(data) {
  const ledger = data.ledger || {};
  const values = {
    cards: ledger.cards_with_evaluation ?? ledger.cards_evaluated ?? 0,
    complete: ledger.fully_reconciled_cards ?? ledger.complete_cards ?? 0,
    legs: ledger.race_legs_evaluated ?? 0,
    threshold: ledger.retuning_threshold_cards ?? 50,
    latest: ledger.latest_card || "Awaiting card",
  };
  Object.entries(values).forEach(([key, value]) => {
    const node = $(`[data-metric="${key}"]`);
    if (node) node.textContent = value;
  });

  const progress = ledger.retuning_threshold_cards
    ? Math.min(100, (Number(ledger.fully_reconciled_cards || ledger.complete_cards || 0) / Number(ledger.retuning_threshold_cards)) * 100)
    : 0;
  $$('[data-retuning-progress]').forEach((node) => {
    node.style.setProperty("--progress", `${progress}%`);
  });
}

const modelMeta = {
  frozen_scc: { key: "frozen", description: "SCC Core legacy selection stream; ranking-only until probability estimates are introduced prospectively." },
  transparent_baseline: { key: "baseline", description: "A deterministic race-normalised benchmark." },
  quant_shadow: { key: "shadow", description: "Independent Monte Carlo scenario model; market-blind by design." },
};

function renderModels(data) {
  const host = $("[data-model-grid]");
  if (!host) return;
  const models = data.models || {};
  host.innerHTML = Object.entries(modelMeta).map(([name, meta]) => {
    const model = models[name] || {};
    const scored = Number(model.legs_scored || 0);
    const wins = Number(model.wins || 0);
    const winRate = scored ? wins / scored : 0;
    return `
      <article class="model-card" data-model="${meta.key}">
        <div class="model-chip">${model.label || name}</div>
        <h3>${model.label || name}</h3>
        <p>${meta.description}</p>
        <div class="model-stats">
          <div class="model-stat"><strong>${wins}/${scored}</strong><span>winners / legs</span></div>
          <div class="model-stat"><strong>${formatPct(model.top3_rate)}</strong><span>top-three rate</span></div>
          <div class="model-stat"><strong>${model.mean_log_loss ?? "—"}</strong><span>mean log loss</span></div>
          <div class="model-stat"><strong>${model.mean_brier_score ?? "—"}</strong><span>mean Brier</span></div>
        </div>
        <div class="progress" aria-label="Winner hit rate"><span style="--progress:${(winRate * 100).toFixed(1)}%"></span></div>
      </article>`;
  }).join("");
}

function finishLabel(model) {
  if (!model) return "—";
  if (model.winner_hit) return '<span class="result-win">WIN</span>';
  if (model.non_finish) return `<span class="result-loss">${model.result_code || "NF"}</span>`;
  const finish = model.finish_position;
  if (finish && finish <= 3) return `<span class="result-place">${finish}</span>`;
  return `<span class="result-loss">${finish || model.result_code || "—"}</span>`;
}

function selectionCell(model) {
  if (!model) return "—";
  return `<strong>${model.selection || "—"}</strong><br><span class="tiny">Finish ${finishLabel(model)}</span>`;
}

function renderCurrentForecast(data) {
  const host = $("[data-current-races]");
  if (!host) return;
  const current = data.current_forecast;
  const legs = current?.legs || [];
  if (!legs.length) {
    host.innerHTML = '<tr><td colspan="7">No current frozen ITV7 forecast is published.</td></tr>';
    return;
  }

  $$('[data-current-date]').forEach((node) => { node.textContent = current.date || "—"; });
  $$('[data-current-state]').forEach((node) => { node.textContent = current.state || "FROZEN"; });
  $$('[data-current-model-status]').forEach((node) => {
    node.textContent = current.model_status || "PROVISIONAL";
  });

  host.innerHTML = legs.map((leg) => {
    const agreement = leg.agreement === true
      ? '<span class="result-win">AGREE</span>'
      : leg.agreement === false
        ? '<span class="result-loss">DISAGREE</span>'
        : "—";
    const share = leg.evidence_share === null || leg.evidence_share === undefined
      ? "—"
      : formatPct(leg.evidence_share, 2);
    const margin = leg.shadow_margin_pct === null || leg.shadow_margin_pct === undefined
      ? "—"
      : `${formatNumber(leg.shadow_margin_pct, 2)}pp`;
    return `
      <tr>
        <td><strong>${leg.leg}</strong></td>
        <td><strong>${leg.off_time || "—"} ${leg.course || ""}</strong><br><span class="tiny">${leg.race_name || ""}</span></td>
        <td><strong>${cleanHorse(leg.baseline_selection)}</strong></td>
        <td>${share}</td>
        <td><strong>${cleanHorse(leg.shadow_selection)}</strong></td>
        <td>${margin}</td>
        <td>${agreement}</td>
      </tr>`;
  }).join("");

  const agreementNode = $("[data-current-agreement]");
  if (agreementNode) {
    const agreements = current.agreements;
    const compared = current.legs_compared;
    agreementNode.textContent = Number.isFinite(Number(agreements)) && Number.isFinite(Number(compared))
      ? `${agreements}/${compared} model-family concordance`
      : "Model-family concordance awaiting comparison";
  }
}

function renderLatestRaces(data) {
  const host = $("[data-latest-races]");
  if (!host) return;
  const latest = data.latest_card;
  const races = latest?.races || [];
  if (!races.length) {
    host.innerHTML = '<tr><td colspan="6">No completed forward-validation card has been published yet.</td></tr>';
    return;
  }
  host.innerHTML = races.map((race) => `
    <tr>
      <td><strong>${race.leg}</strong></td>
      <td><strong>${race.off_time || "—"} ${race.course || ""}</strong><br><span class="tiny">${race.race_name || ""}</span></td>
      <td><strong>${cleanHorse(race.winner)}</strong></td>
      <td>${selectionCell(race.models?.frozen_scc)}</td>
      <td>${selectionCell(race.models?.transparent_baseline)}</td>
      <td>${selectionCell(race.models?.quant_shadow)}</td>
    </tr>`).join("");
  $$('[data-latest-date]').forEach((node) => { node.textContent = latest.date || "—"; });
}

function renderRecentCards(data) {
  const host = $("[data-recent-cards]");
  if (!host) return;
  const cards = data.recent_cards || [];
  if (!cards.length) {
    host.innerHTML = '<tr><td colspan="7">Forward-validation ledger is awaiting its first card.</td></tr>';
    return;
  }
  host.innerHTML = cards.map((card) => {
    const frozen = card.models?.frozen_scc || {};
    const baseline = card.models?.transparent_baseline || {};
    const shadow = card.models?.quant_shadow || {};
    return `
      <tr>
        <td><strong>${card.date || "—"}</strong></td>
        <td>${card.completed_results || 0}/${card.itv7_legs || 0}</td>
        <td>${frozen.wins || 0}</td>
        <td>${baseline.wins || 0}</td>
        <td>${shadow.wins || 0}</td>
        <td>${baseline.mean_log_loss ?? "—"}</td>
        <td>${shadow.mean_log_loss ?? "—"}</td>
      </tr>`;
  }).join("");
}

function renderPrinciples(data) {
  const host = $("[data-principles]");
  if (!host) return;
  host.innerHTML = (data.principles || []).map((text) => `<article class="principle-card"><strong>${text}</strong></article>`).join("");
}

async function loadData() {
  try {
    const response = await fetch("data/latest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    const data = await response.json();
    bindSimple(data);
    renderHeadlineMetrics(data);
    renderModels(data);
    renderCurrentForecast(data);
    renderLatestRaces(data);
    renderRecentCards(data);
    renderPrinciples(data);
    document.documentElement.dataset.dataState = "ready";
  } catch (error) {
    console.warn("PREDICTIONS site data unavailable", error);
    document.documentElement.dataset.dataState = "fallback";
    $$('[data-data-status]').forEach((node) => {
      node.textContent = "Live ledger unavailable — methodology content remains current.";
    });
  }
}

function initSignalField() {
  const field = $("[data-signal-field]");
  if (!field || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const nodes = [
    [12, 22], [29, 62], [47, 35], [64, 72], [78, 26], [89, 57],
  ];
  nodes.forEach(([x, y], index) => {
    const dot = document.createElement("span");
    dot.className = "signal-node";
    dot.style.left = `${x}%`;
    dot.style.top = `${y}%`;
    dot.style.opacity = String(.5 + index * .07);
    field.append(dot);
  });
}

function setYear() {
  $$('[data-year]').forEach((node) => { node.textContent = new Date().getFullYear(); });
}

initTheme();
initNav();
initSignalField();
setYear();
loadData();
