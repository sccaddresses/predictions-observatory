const daily$ = (selector, root = document) => root.querySelector(selector);
const daily$$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const dailyPct = (value, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${(Number(value) * 100).toFixed(digits)}%`;
};

const dailyUnits = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const number = Number(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}u`;
};

function dailyState(row) {
  if (!row) return "No card";
  if (row.prospective_freeze && Number(row.official_selections || 0) > 0) return "FROZEN";
  if (row.prospective_freeze) return "NO SELECTIONS";
  return row.status || "LATE / INVALID";
}

function renderDaily(data) {
  const daily = data.daily_racing || {};
  const current = daily.current;
  daily$$('[data-daily-date]').forEach((node) => { node.textContent = current?.date || "—"; });
  daily$$('[data-daily-state]').forEach((node) => { node.textContent = dailyState(current); });

  const currentHost = daily$("[data-daily-current]");
  if (currentHost) {
    const selections = current?.selections || [];
    if (!current) {
      currentHost.innerHTML = '<tr><td colspan="6">No SCC daily research card is recorded yet.</td></tr>';
    } else if (!current.prospective_freeze) {
      currentHost.innerHTML = `<tr><td colspan="6"><strong>${current.date}</strong> was captured after the first known off time. It remains visible as late research evidence, but zero official selections are credited.</td></tr>`;
    } else if (!selections.length) {
      currentHost.innerHTML = `<tr><td colspan="6"><strong>${current.date}</strong> passed the pre-race freeze gate, but all reviewed races were abstentions. No selection was forced.</td></tr>`;
    } else {
      currentHost.innerHTML = selections.map((leg) => `<tr><td><strong>${leg.off_time || "—"}</strong></td><td><strong>${leg.course || "—"}</strong><br><span class="tiny">${leg.race_name || ""}</span></td><td><strong>${leg.selection || "—"}</strong></td><td>${dailyPct(leg.model_probability, 2)}</td><td><strong>${leg.shadow_selection || "—"}</strong></td><td>${leg.shadow_margin_pct ?? "—"}</td></tr>`).join("");
    }
  }

  const historyHost = daily$("[data-daily-history]");
  if (historyHost) {
    const rows = daily.history || [];
    historyHost.innerHTML = rows.length ? rows.map((row) => `<tr><td><strong>${row.date || "—"}</strong></td><td>${dailyState(row)}</td><td>${row.races_reviewed ?? 0}</td><td>${row.official_selections ?? 0}</td><td>${row.settled_selections ?? 0}</td><td>${row.wins ?? 0}</td><td>${row.settled_selections ? dailyPct(Number(row.wins || 0) / Number(row.settled_selections), 1) : "—"}</td><td>${dailyUnits(row.net_units)}</td><td>${dailyPct(row.roi, 1)}</td></tr>`).join("") : '<tr><td colspan="9">No daily forward-validation history is recorded yet.</td></tr>';
  }

  for (const [selector, rows] of [["[data-daily-weekly]", daily.weekly || []], ["[data-daily-monthly]", daily.monthly || []]]) {
    const host = daily$(selector);
    if (!host) continue;
    host.innerHTML = rows.length ? rows.map((row) => `<tr><td><strong>${row.period}</strong></td><td>${row.days_recorded}</td><td>${row.prospectively_frozen_days}</td><td>${row.late_or_invalid_days}</td><td>${row.official_selections}</td><td>${row.settled_selections}</td><td>${row.wins}</td><td>${dailyPct(row.strike_rate, 1)}</td><td>${dailyUnits(row.net_units)}</td><td>${dailyPct(row.roi, 1)}</td></tr>`).join("") : '<tr><td colspan="10">No period summary is available yet.</td></tr>';
  }
}

fetch("data/latest.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    return response.json();
  })
  .then(renderDaily)
  .catch((error) => console.warn("SCC daily ledger unavailable", error));
