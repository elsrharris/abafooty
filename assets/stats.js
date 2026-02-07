import { loadAttended, removeAttended, fmtDate, safeText } from "./app.js";

const $ = (id) => document.getElementById(id);

function kpi(n, label) {
  const div = document.createElement("div");
  div.className = "kpi";
  div.innerHTML = `<div class="n">${n}</div><div class="l">${label}</div>`;
  return div;
}

function pillResult(r) {
  if (!r) return `<span class="pill">—</span>`;
  const cls = r === "W" ? "good" : r === "L" ? "bad" : "warn";
  return `<span class="pill ${cls}">${r}</span>`;
}

function countBy(list, keyFn) {
  const map = new Map();
  for (const x of list) {
    const k = keyFn(x) || "Unknown";
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].sort((a,b) => b[1]-a[1]);
}

function render() {
  const attended = loadAttended();

  // KPIs
  const total = attended.length;
  const home = attended.filter(m => m.venue === "Home").length;
  const away = attended.filter(m => m.venue === "Away").length;

  const finished = attended.filter(m => m.result);
  const wins = finished.filter(m => m.result === "W").length;
  const draws = finished.filter(m => m.result === "D").length;
  const losses = finished.filter(m => m.result === "L").length;

  const gf = finished.reduce((s, m) => s + (m.leedsGoals ?? 0), 0);
  const ga = finished.reduce((s, m) => s + (m.oppGoals ?? 0), 0);

  const kpis = $("kpis");
  kpis.innerHTML = "";
  kpis.append(
    kpi(total, "Matches attended"),
    kpi(`${home} / ${away}`, "Home / Away"),
    kpi(`${wins}-${draws}-${losses}`, "W-D-L (finished only)"),
    kpi(`${gf}-${ga}`, "Goals For-Against (finished only)"),
  );

  // List
  const tbody = $("list");
  tbody.innerHTML = "";

  for (const m of attended) {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = fmtDate(m.date);

    const tdMatch = document.createElement("td");
    tdMatch.textContent = `${safeText(m.homeTeam)} vs ${safeText(m.awayTeam)}`;

    const tdComp = document.createElement("td");
    tdComp.textContent = safeText(m.league);

    const tdVenue = document.createElement("td");
    tdVenue.textContent = safeText(m.venue);

    const tdRes = document.createElement("td");
    tdRes.innerHTML = pillResult(m.result);

    const tdDel = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "secondary";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      removeAttended(m.fixtureId);
      render();
    });
    tdDel.appendChild(btn);

    tr.append(tdDate, tdMatch, tdComp, tdVenue, tdRes, tdDel);
    tbody.appendChild(tr);
  }

  // Breakdowns
  const byComp = countBy(attended, m => m.league);
  $("byComp").innerHTML = byComp.length
    ? byComp.map(([k,v]) => `<div>${safeText(k)}: <strong>${v}</strong></div>`).join("")
    : "No matches yet.";

  const byVenue = countBy(attended, m => m.venue);
  $("byVenue").innerHTML = byVenue.length
    ? byVenue.map(([k,v]) => `<div>${safeText(k)}: <strong>${v}</strong></div>`).join("")
    : "No matches yet.";
}

render();
