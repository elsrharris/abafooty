import {
  getPopularLeagues,
  getTeamsByLeague,
  getMatchesByLeague,
  upsertAttended,
  fmtDate,
} from "./app.js";

const $ = (id) => document.getElementById(id);

const leagueSelect = $("leagueSelect");
const teamSelect = $("teamSelect");
const loadMatchesBtn = $("loadMatchesBtn");
const msg = $("msg");

const resultsTable = $("resultsTable");
const resultsBody = $("resultsBody");

function toast(text, show = true) {
  msg.textContent = text;
  msg.style.display = show ? "block" : "none";
}

function normalizeList(data) {
  // Common shapes for this API: response.list, response.leagues, response.teams, response
  const r = data?.response;
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.list)) return r.list;
  if (Array.isArray(r?.leagues)) return r.leagues;
  if (Array.isArray(r?.teams)) return r.teams;
  return [];
}

function getTeamsFromMatch(m) {
  // Handle both nested and flat shapes
  const home = m.home || m.homeTeam || { id: m.hId, name: m.hTeam };
  const away = m.away || m.awayTeam || { id: m.aId, name: m.aTeam };
  return { home, away };
}

function getEventId(m) {
  return m.id ?? m.eventId ?? m.matchId ?? m.gameId ?? m.ongoing?.id;
}

function getDate(m) {
  // common fields
  return m?.status?.utcTime || m?.utcTime || m?.time || m?.date || m?.startTimeUTC || "";
}

function getScore(m) {
  const s = m?.status?.scoreStr || m?.scoreStr || null;
  if (s) return s;

  const h = m?.homeScore ?? m?.hScore ?? null;
  const a = m?.awayScore ?? m?.aScore ?? null;
  if (h == null && a == null) return "—";
  return `${h ?? 0}-${a ?? 0}`;
}

function isTeamMatch(m, teamId) {
  const { home, away } = getTeamsFromMatch(m);
  const hId = home?.id ?? m?.hId;
  const aId = away?.id ?? m?.aId;
  return Number(hId) === Number(teamId) || Number(aId) === Number(teamId);
}

function resultFromScores(teamIsHome, h, a) {
  if (h == null || a == null) return null;
  const teamGoals = teamIsHome ? h : a;
  const oppGoals = teamIsHome ? a : h;
  return teamGoals > oppGoals ? "W" : teamGoals < oppGoals ? "L" : "D";
}

async function loadLeagues() {
  leagueSelect.innerHTML = "";
  teamSelect.innerHTML = "";
  teamSelect.disabled = true;
  loadMatchesBtn.disabled = true;

  resultsBody.innerHTML = "";
  resultsTable.style.display = "none";

  toast("Loading leagues…");

  const data = await getPopularLeagues();
  const leagues = normalizeList(data);

  if (!leagues.length) {
    toast("No leagues returned. Check your API key/subscription.");
    return;
  }

  // Populate
  for (const l of leagues) {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = l.localizedName || l.name || `League ${l.id}`;
    leagueSelect.appendChild(opt);
  }

  toast("Pick a league to load teams.");
}

async function loadTeamsForSelectedLeague() {
  const leagueId = leagueSelect.value;
  teamSelect.innerHTML = "";
  teamSelect.disabled = true;
  loadMatchesBtn.disabled = true;

  resultsBody.innerHTML = "";
  resultsTable.style.display = "none";

  toast("Loading teams…");

  const data = await getTeamsByLeague(leagueId);
  const teams = normalizeList(data);

  if (!teams.length) {
    toast("No teams returned for that league.");
    return;
  }

  // Sort alphabetically
  teams.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  for (const t of teams) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name || `Team ${t.id}`;
    teamSelect.appendChild(opt);
  }

  teamSelect.disabled = false;
  loadMatchesBtn.disabled = false;

  toast("Now click “Load matches”.");
}

async function loadMatches() {
  const leagueId = Number(leagueSelect.value);
  const teamId = Number(teamSelect.value);

  resultsBody.innerHTML = "";
  resultsTable.style.display = "none";

  const leagueName = leagueSelect.options[leagueSelect.selectedIndex]?.textContent || "League";

  toast("Loading matches…");

  const data = await getMatchesByLeague(leagueId);
  const matches = normalizeList(data);

  const filtered = (Array.isArray(matches) ? matches : []).filter((m) => isTeamMatch(m, teamId));

  if (!filtered.length) {
    toast("No matches found for that team in this league response.");
    return;
  }

  toast(`Found ${filtered.length} matches for ${teamSelect.options[teamSelect.selectedIndex]?.textContent}. Click “Add”.`);
  resultsTable.style.display = "table";

  for (const m of filtered) {
    const { home, away } = getTeamsFromMatch(m);

    const eventId = getEventId(m);
    const date = getDate(m);

    const homeId = home?.id ?? m?.hId;
    const teamIsHome = Number(homeId) === teamId;

    const hScore = m?.homeScore ?? m?.hScore ?? null;
    const aScore = m?.awayScore ?? m?.aScore ?? null;

    const record = {
      eventId,
      date,
      leagueId,
      leagueName,
      venue: teamIsHome ? "Home" : "Away",
      homeTeam: home?.name ?? m?.hTeam ?? "?",
      awayTeam: away?.name ?? m?.aTeam ?? "?",
      // NOTE: These are “selected team” goals, not specifically Leeds anymore
      teamGoals: (hScore == null || aScore == null) ? null : (teamIsHome ? hScore : aScore),
      oppGoals: (hScore == null || aScore == null) ? null : (teamIsHome ? aScore : hScore),
      result: resultFromScores(teamIsHome, hScore, aScore),
      teamId,
      teamName: teamSelect.options[teamSelect.selectedIndex]?.textContent || "",
    };

    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = fmtDate(date);

    const tdMatch = document.createElement("td");
    tdMatch.textContent = `${record.homeTeam} vs ${record.awayTeam}`;

    const tdLeague = document.createElement("td");
    tdLeague.textContent = leagueName;

    const tdVenue = document.createElement("td");
    tdVenue.textContent = record.venue;

    const tdScore = document.createElement("td");
    tdScore.textContent = getScore(m);

    const tdBtn = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "secondary";
    btn.textContent = "Add";
    btn.addEventListener("click", () => {
      if (!record.eventId) {
        toast("This match didn’t include an eventId in the response. Paste one match object and I’ll map it.");
        return;
      }
      upsertAttended(record);
      btn.textContent = "Added ✓";
      btn.disabled = true;
    });

    tdBtn.appendChild(btn);

    tr.append(tdDate, tdMatch, tdLeague, tdVenue, tdScore, tdBtn);
    resultsBody.appendChild(tr);
  }
}

// Wire up UI
leagueSelect.addEventListener("change", () => {
  loadTeamsForSelectedLeague().catch((e) => toast(e.message || String(e)));
});

loadMatchesBtn.addEventListener("click", () => {
  loadMatches().catch((e) => toast(e.message || String(e)));
});

// Init
loadLeagues()
  .then(() => loadTeamsForSelectedLeague())
  .catch((e) => toast(e.message || String(e)));
