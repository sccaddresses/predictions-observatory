const one = (selector) => document.querySelector(selector);
const all = (selector) => [...document.querySelectorAll(selector)];
const pct = (value) => value == null ? "—" : `${(Number(value) * 100).toFixed(1)}%`;
const units = (value) => value == null ? "—" : `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}u`;

function state(row) {
  if (!row) return "No card";
  if (!row.prospective_freeze) return row.status || "LATE / INVALID";
  return Number(row.official_selections || 0) ? "FROZEN" : "NO SELECTIONS";
}

function render(data) {
  const current = data.current;
  all("[data-daily-date]").forEach((node) => { node.textContent = current?.date || "—"; });
  all("[data-daily-state]").forEach((node) => { node.textContent = state(current); });

  const currentBody = one("[data-daily-current]");
  const selections = current?.selections || [];
  if (!current) currentBody.innerHTML = '<tr><td colspan="6">No daily card recorded.</td></tr>';
  else if (!current.prospective_freeze) currentBody.innerHTML = `<tr><td colspan="6"><strong>${current.date}</strong> is late research only; zero official selections are credited.</td></tr>`;
  else if (!selections.length) currentBody.innerHTML = '<tr><td colspan="6">Frozen before racing; all reviewed races were abstentions.</td></tr>';
  else currentBody.innerHTML = selections.map((row) => `<tr><td>${row.off_time || "—"}</td><td>${row.course || "—"}<br><span class="tiny">${row.race_name || ""}</span></td><td><strong>${row.selection || "—"}</strong></td><td>${pct(row.model_probability)}</td><td>${row.shadow_selection || "—"}</td><td>${row.shadow_margin_pct ?? "—"}</td></tr>`).join("");

  const history = data.history || [];
  one("[data-daily-history]").innerHTML = history.map((row) => `<tr><td><strong>${row.date}</strong></td><td>${state(row)}</td><td>${row.races_reviewed ?? "—"}</td><td>${row.official_selections}</td><td>${row.settled_selections}</td><td>${row.wins}</td><td>${row.settled_selections ? pct(row.wins / row.settled_selections) : "—"}</td><td>${units(row.net_units)}</td><td>${pct(row.roi)}</td></tr>`).join("");

  for (const [selector, rows] of [["[data-daily-weekly]", data.weekly || []], ["[data-daily-monthly]", data.monthly || []]]) {
    one(selector).innerHTML = rows.map((row) => `<tr><td><strong>${row.period}</strong></td><td>${row.days_recorded}</td><td>${row.prospectively_frozen_days}</td><td>${row.late_or_invalid_days}</td><td>${row.official_selections}</td><td>${row.settled_selections}</td><td>${row.wins}</td><td>${pct(row.strike_rate)}</td><td>${units(row.net_units)}</td><td>${pct(row.roi)}</td></tr>`).join("");
  }
}

fetch("data/daily.json", { cache: "no-store" })
  .then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); })
  .then(render)
  .catch((error) => console.warn("Daily ledger unavailable", error));
