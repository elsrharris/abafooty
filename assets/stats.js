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
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

// Backwards-compatible helpers (older saved matches used leedsGoals)
function getTeamGoals(m) {
  return m.teamGoals ?? m.leedsGoals ?? null;
}
function getOppGoals(m) {
  return m.oppGoals ?? null;
}

function render() {
  const attended = loadAttended();

  const total = attended.length;
  const home = attended.filter((m) => m.venue === "Home").length;
  const away = attended.filter((m) => m.venue === "Away").length;

  const finished = attended.filter((m) => m.result);
  const wins = finished.filter((m) => m.result === "W").length;
  const draws = finished.filter((m) => m.result === "D").length;
  const losses = finished.filter((m) => m.result === "L").length;

  const gf = finished.reduce((s, m) => s + (getTeamGoals(m) ?? 0), 0);
  const ga = finished.reduce((s, m) => s + (getOppGoals(m) ?? 0), 0);

  // If multiple teams are being tracked, this helps show what’s in the data
  const teamsTracked = countBy(attended, (m) => m.teamName || "Unknown team");

  const kpis = $("kpis");
  kpis.innerHTML = "";
  kpis.append(
    kpi(total, "Matches attended"),
    kpi(`${home} / ${away}`, "Home / Away"),
    kpi(`${wins}-${draws}-${losses}`, "W-D-L (finished only)"),
    kpi(`${gf}-${ga}`, "Goals For-Against (finished only)")
  );

  // Optionally show what teams are in the dataset (useful now you can choose any team)
  // If you don’t want this, delete this next block.
  if (teamsTracked.length > 1) {
    const note = document.createElement("div");
    note.className = "toast muted";
    note.style.marginTop = "12px";
    note.innerHTML =
      `<strong>Teams tracked:</strong><br>` +
      teamsTracked.map(([k, v]) => `${safeText(k)}: <strong>${v}</strong>`).join("<br>");
    kpis.parentElement.appendChild(note);
  }

  const tbody = $("list");
  tbody.innerHTML = "";

  for (const m of attended) {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = fmtDate(m.date);

    const tdMatch = document.createElement("td");
    tdMatch.textContent = `${safeText(m.homeTeam)} vs ${safeText(m.awayTeam)}`;

    const tdLeague = document.createElement("td");
    tdLeague.textContent = safeText(m.leagueName);

    const tdVenue = document.createElement("td");
    tdVenue.textContent = safeText(m.venue);

    const tdRes = document.createElement("td");
    tdRes.innerHTML = pillResult(m.result);

    const tdView = document.createElement("td");
    if (m.eventId) {
      const a = document.createElement("a");
      a.href = `./match.html?eventId=${encodeURIComponent(m.eventId)}`;
      a.textContent = m.cachedStats ? "View (cached)" : "View";
      tdView.appendChild(a);
    } else {
      tdView.textContent = "—";
    }

    const tdDel = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "secondary";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      removeAttended(m.eventId);
      render();
    });
    tdDel.appendChild(btn);

    tr.append(tdDate, tdMatch, tdLeague, tdVenue, tdRes, tdView, tdDel);
    tbody.appendChild(tr);
  }

  const byLeague = countBy(attended, (m) => m.leagueName);
  $("byLeague").innerHTML = byLeague.length
    ? byLeague.map(([k, v]) => `<div>${safeText(k)}: <strong>${v}</strong></div>`).join("")
    : "No matches yet.";

  const byVenue = countBy(attended, (m) => m.venue);
  $("byVenue").innerHTML = byVenue.length
    ? byVenue.map(([k, v]) => `<div>${safeText(k)}: <strong>${v}</strong></div>`).join("")
    : "No matches yet.";
}

render();
