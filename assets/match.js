import { loadAttended, saveAttended, fmtDate, safeText, getMatchAllStats } from "./app.js";

const $ = (id) => document.getElementById(id);

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function showError(msg) {
  const box = $("errorBox");
  box.style.display = "block";
  box.textContent = msg;
}

function pillHtml(text, kind) {
  const cls =
    kind === "good" ? "pill good" :
    kind === "bad" ? "pill bad" :
    kind === "warn" ? "pill warn" : "pill";
  return `<span class="${cls}">${safeText(text) || "—"}</span>`;
}

function resultKind(r) {
  if (r === "W") return "good";
  if (r === "L") return "bad";
  if (r === "D") return "warn";
  return null;
}

function findMatch(eventId) {
  const list = loadAttended();
  return list.find(m => String(m.eventId) === String(eventId));
}

function upsertMatch(updated) {
  const list = loadAttended();
  const idx = list.findIndex(m => String(m.eventId) === String(updated.eventId));
  if (idx >= 0) list[idx] = updated;
  else list.unshift(updated);
  saveAttended(list);
}

function renderSummary(m) {
  $("matchTitle").textContent = `${safeText(m.homeTeam)} vs ${safeText(m.awayTeam)}`;
  $("subhead").textContent = `Event ID: ${m.eventId}`;

  $("matchDate").textContent = fmtDate(m.date);
  $("matchLeague").textContent = safeText(m.leagueName) || "—";
  $("matchVenue").textContent = safeText(m.venue) || "—";
  $("matchResult").innerHTML = pillHtml(m.result || "—", resultKind(m.result));
}

function normalizeStatsPayload(data) {
  // Expect shape: { status: "success", response: { stats: [...] } }
  const sections = data?.response?.stats;
  return Array.isArray(sections) ? sections : [];
}

function renderStatsSections(sections) {
  const host = $("statsSections");
  host.innerHTML = "";

  for (const section of sections) {
    const title = safeText(section.title || "Stats");
    const rows = Array.isArray(section.stats) ? section.stats : [];

    const card = document.createElement("div");
    card.className = "card";
    card.style.marginTop = "12px";

    const h = document.createElement("h2");
    h.textContent = title;
    h.style.marginBottom = "8px";

    const tableWrap = document.createElement("div");
    tableWrap.style.overflow = "auto";

    const table = document.createElement("table");
    table.className = "table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th style="width:40%;">Metric</th>
        <th style="width:30%;">Home</th>
        <th style="width:30%;">Away</th>
      </tr>
    `;

    const tbody = document.createElement("tbody");

    for (const r of rows) {
      // Some entries are section titles: type === "title"
      if (r?.type === "title") continue;

      const metric = safeText(r?.title);
      const vals = Array.isArray(r?.stats) ? r.stats : [null, null];
      const homeVal = vals[0] ?? "—";
      const awayVal = vals[1] ?? "—";

      const tr = document.createElement("tr");

      const tdMetric = document.createElement("td");
      tdMetric.textContent = metric;

      const tdHome = document.createElement("td");
      tdHome.textContent = safeText(homeVal);

      const tdAway = document.createElement("td");
      tdAway.textContent = safeText(awayVal);

      // highlight: "home" | "away" | "equal"
      if (r?.highlighted === "home") tdHome.innerHTML = pillHtml(homeVal, "good");
      if (r?.highlighted === "away") tdAway.innerHTML = pillHtml(awayVal, "good");
      if (r?.highlighted === "equal") {
        tdHome.innerHTML = pillHtml(homeVal, null);
        tdAway.innerHTML = pillHtml(awayVal, null);
      }

      tr.append(tdMetric, tdHome, tdAway);
      tbody.appendChild(tr);
    }

    table.append(thead, tbody);
    tableWrap.appendChild(table);

    card.append(h, tableWrap);
    host.appendChild(card);
  }

  $("statsContainer").style.display = "block";
}

async function loadAndRenderStats(m) {
  // Cache key on the match object itself:
  if (m.cachedStats && Array.isArray(m.cachedStatsSections)) {
    renderStatsSections(m.cachedStatsSections);
    return;
  }

  $("loadStatsBtn").disabled = true;
  $("loadStatsBtn").textContent = "Loading…";

  try {
    const data = await getMatchAllStats(m.eventId);
    const sections = normalizeStatsPayload(data);

    if (!sections.length) {
      showError("No stats returned for this match (empty response).");
      return;
    }

    // Save to cache
    const updated = {
      ...m,
      cachedStats: true,
      cachedStatsSections: sections,
      cachedStatsFetchedAt: new Date().toISOString(),
    };
    upsertMatch(updated);

    renderStatsSections(sections);
  } catch (e) {
    showError(e.message || String(e));
  } finally {
    $("loadStatsBtn").disabled = false;
    $("loadStatsBtn").textContent = "Load detailed stats";
  }
}

// ===== INIT =====
const eventId = getQueryParam("eventId");
if (!eventId) {
  showError("Missing eventId in URL. Go back to Stats and click View.");
} else {
  const match = findMatch(eventId);
  if (!match) {
    showError("Match not found in your saved list. Add it first from Home.");
  } else {
    renderSummary(match);

    $("loadStatsBtn").addEventListener("click", () => loadAndRenderStats(match));

    // Auto-render if cached
    if (match.cachedStats && Array.isArray(match.cachedStatsSections)) {
      renderStatsSections(match.cachedStatsSections);
    }
  }
}
