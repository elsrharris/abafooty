import {
  getTeamsByLeague,
  getMatchesByLeague,
  upsertAttended,
  fmtDate,
  PREMIER_LEAGUE_ID,
  LEEDS_TEAM_ID,
} from "./app.js";

const $ = (id) => document.getElementById(id);

// Required DOM
const leagueIdInput = $("leagueId");
const teamIdInput = $("teamId");
const loadMatchesBtn = $("loadMatchesBtn");
const leagueSelect = $("leagueSelect");
const teamSelect = $("teamSelect");
const applySelectionBtn = $("applySelectionBtn");
const msg = $("msg");
const resultsTable = $("resultsTable");
const resultsBody = $("resultsBody");

function assertEl(el, id) {
  if (!el) throw new Error(`Missing element #${id} in index.html`);
  return el;
}
assertEl(leagueIdInput, "leagueId");
assertEl(teamIdInput, "teamId");
assertEl(loadMatchesBtn, "loadMatchesBtn");
assertEl(leagueSelect, "leagueSelect");
assertEl(teamSelect, "teamSelect");
assertEl(applySelectionBtn, "applySelectionBtn");
assertEl(msg, "msg");
assertEl(resultsTable, "resultsTable");
assertEl(resultsBody, "resultsBody");

function toast(text, show = true) {
  msg.textContent = text;
  msg.style.display = show ? "block" : "none";
}

function normalizeArray(data) {
  const r = data?.response;
  if (Array.isArray(r)) return r;
  const candidates = [r?.list, r?.matches, r?.games, r?.data, r?.result, r];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function getTeamsFromMatch(m) {
  const home = m.home || m.homeTeam || { id: m.hId, name: m.hTeam };
  const away = m.away || m.awayTeam || { id: m.aId, name: m.aTeam };
  return { home, away };
}

function getEventId(m) {
  return m.id ?? m.eventId ?? m.matchId ?? m.gameId ?? m.ongoing?.id;
}

function getDate(m) {
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

// Preset leagues (edit anytime)
const PRESET_LEAGUES = [
  { id: 47, name: "Premier League (47)" },
  { id: 48, name: "Championship (48)" },
  { id: 49, name: "League One (49)" },
  { id: 50, name: "League Two (50)" },
];

function initLeagueSelect() {
  leagueSelect.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "Select a league…";
  leagueSelect.appendChild(ph);

  for (const l of PRESET_LEAGUES) {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = l.name;
    leagueSelect.appendChild(opt);
  }
}

async function loadTeamsForLeague(leagueId) {
  teamSelect.disabled = true;
  applySelectionBtn.disabled = true;
  teamSelect.innerHTML = `<option value="">Loading teams…</option>`;

  toast("Loading teams…");

  const data = await getTeamsByLeague(leagueId);
  const teams = normalizeArray(data);

  if (!teams.length) {
    console.log("Teams raw:", data);
    toast("No teams returned for that league (see console).");
    teamSelect.innerHTML = `<option value="">No teams found</option>`;
    return;
  }

  teams.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  teamSelect.innerHTML = `<option value="">Select a team…</option>`;
  for (const t of teams) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name || `Team ${t.id}`;
    teamSelect.appendChild(opt);
  }

  teamSelect.disabled = false;
  toast("Teams loaded.");
}

function renderRows(list, teamId, leagueId) {
  resultsBody.innerHTML = "";
  resultsTable.style.display = "table";

  for (const m of list) {
    const { home, away } = getTeamsFromMatch(m);

    const eventId = getEventId(m);
    const date = getDate(m);

    const homeId = home?.id ?? m?.hId;
    const teamIsHome = Number(homeId) === Number(teamId);

    const hScore = m?.homeScore ?? m?.hScore ?? null;
    const aScore = m?.awayScore ?? m?.aScore ?? null;

    const record = {
      eventId,
      date,
      leagueId,
      leagueName: `League ${leagueId}`,
      teamId,
      venue: teamIsHome ? "Home" : "Away",
      homeTeam: home?.name ?? m?.hTeam ?? "?",
      awayTeam: away?.name ?? m?.aTeam ?? "?",
      teamGoals: (hScore == null || aScore == null) ? null : (teamIsHome ? hScore : aScore),
      oppGoals: (hScore == null || aScore == null) ? null : (teamIsHome ? aScore : hScore),
      result: resultFromScores(teamIsHome, hScore, aScore),
    };

    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = fmtDate(date);

    const tdMatch = document.createElement("td");
    tdMatch.textContent = `${record.homeTeam} vs ${record.awayTeam}`;

    const tdLeague = document.createElement("td");
    tdLeague.textContent = record.leagueName;

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
        toast("This match has no eventId. Check console.");
        console.log("Match missing eventId:", m);
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

async function loadMatches() {
  resultsBody.innerHTML = "";
  resultsTable.style.display = "none";

  const leagueId = Number(leagueIdInput.value || PREMIER_LEAGUE_ID);
  const teamId = Number(teamIdInput.value || LEEDS_TEAM_ID);

  toast("Loading matches…");
  loadMatchesBtn.disabled = true;

  try {
    const data = await getMatchesByLeague(leagueId);
    const matches = normalizeArray(data);

    console.log("Matches count:", matches.length);
    const filtered = matches.filter((m) => isTeamMatch(m, teamId));
    console.log("Filtered count:", filtered.length);

    toast(`Loaded ${matches.length} matches. Filtered to ${filtered.length} for team ${teamId}.`);

    // Render filtered if possible, otherwise render first 25 raw so you SEE something
    if (filtered.length) {
      renderRows(filtered, teamId, leagueId);
    } else {
      toast(`No filtered matches. Rendering first 25 unfiltered so you can inspect.`);
      renderRows(matches.slice(0, 25), teamId, leagueId);
    }
  } catch (e) {
    toast(e.message || String(e));
  } finally {
    loadMatchesBtn.disabled = false;
  }
}

// Init defaults
leagueIdInput.value = PREMIER_LEAGUE_ID;
teamIdInput.value = LEEDS_TEAM_ID;

initLeagueSelect();

// Dropdown events
leagueSelect.addEventListener("change", () => {
  const leagueId = leagueSelect.value;
  if (!leagueId) return;
  loadTeamsForLeague(leagueId).catch((e) => toast(e.message || String(e)));
});

teamSelect.addEventListener("change", () => {
  applySelectionBtn.disabled = !teamSelect.value;
});

applySelectionBtn.addEventListener("click", () => {
  const leagueId = leagueSelect.value;
  const teamId = teamSelect.value;
  if (!leagueId || !teamId) return;

  leagueIdInput.value = leagueId;
  teamIdInput.value = teamId;
  toast(`Set League ${leagueId}, Team ${teamId}. Now click “Load matches”.`);
});

loadMatchesBtn.addEventListener("click", () => loadMatches());
