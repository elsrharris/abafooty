import {
  getMatchesByLeague,
  fmtDate,
  upsertAttended,
  PREMIER_LEAGUE_ID,
  LEEDS_TEAM_ID
} from "./app.js";

const $ = (id) => document.getElementById(id);

const leagueIdInput = $("leagueId");
const teamIdInput = $("teamId");
const searchBtn = $("searchBtn");
const searchMsg = $("searchMsg");
const resultsTable = $("resultsTable");
const resultsBody = $("resultsBody");

function toast(el, msg, show = true) {
  el.textContent = msg;
  el.style.display = show ? "block" : "none";
}

function normalizeMatchList(data) {
  // Different endpoints sometimes return different keys.
  // We try a few common shapes.
  return (
    data?.response?.matches ||
    data?.response?.allMatches ||
    data?.response?.list ||
    data?.response?.result ||
    data?.response ||
    []
  );
}

function getTeams(m) {
  // FotMob-like objects can vary; handle both nested and flat.
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
  // Sometimes FotMob returns scoreStr; sometimes flat scores.
  const s = m?.status?.scoreStr || m?.scoreStr || null;
  if (s) return s;

  const h = m?.homeScore ?? m?.hScore ?? null;
  const a = m?.awayScore ?? m?.aScore ?? null;
  if (h == null && a == null) return "—";
  return `${h ?? 0}-${a ?? 0}`;
}

function isTeamMatch(m, teamId) {
  const { home, away } = getTeams(m);
  const hId = home?.id ?? m?.hId;
  const aId = away?.id ?? m?.aId;
  return Number(hId) === Number(teamId) || Number(aId) === Number(teamId);
}

function resultFromScores(leedsIsHome, h, a) {
  if (h == null || a == null) return null;
  const leedsGoals = leedsIsHome ? h : a;
  const oppGoals = leedsIsHome ? a : h;
  return leedsGoals > oppGoals ? "W" : leedsGoals < oppGoals ? "L" : "D";
}

async function runSearch() {
  resultsBody.innerHTML = "";
  resultsTable.style.display = "none";

  const leagueId = Number(leagueIdInput.value || PREMIER_LEAGUE_ID);
  const teamId = Number(teamIdInput.value || LEEDS_TEAM_ID);

  try {
    toast(searchMsg, "Loading league matches…");

    const data = await getMatchesByLeague(leagueId);
    const matches = normalizeMatchList(data);

    const filtered = (Array.isArray(matches) ? matches : []).filter(m => isTeamMatch(m, teamId));

    if (!filtered.length) {
      toast(searchMsg, "No matches found for that team in this league response.");
      return;
    }

    toast(searchMsg, `Found ${filtered.length} matches. Click “Add” for the ones he attended.`);
    resultsTable.style.display = "table";

    for (const m of filtered) {
      const { home, away } = getTeams(m);
      const eventId = getEventId(m);
      const date = getDate(m);

      const homeId = home?.id ?? m?.hId;
      const leedsIsHome = Number(homeId) === teamId;

      const hScore = m?.homeScore ?? m?.hScore ?? null;
      const aScore = m?.awayScore ?? m?.aScore ?? null;

      const record = {
        eventId,
        date,
        leagueId,
        leagueName: "Premier League",
        venue: leedsIsHome ? "Home" : "Away",
        homeTeam: home?.name ?? m?.hTeam ?? "?",
        awayTeam: away?.name ?? m?.aTeam ?? "?",
        leedsGoals: (hScore == null || aScore == null) ? null : (leedsIsHome ? hScore : aScore),
        oppGoals: (hScore == null || aScore == null) ? null : (leedsIsHome ? aScore : hScore),
        result: resultFromScores(leedsIsHome, hScore, aScore),
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
          toast(searchMsg, "This match didn’t include an eventId in the response. Paste one match object here and I’ll map it.");
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
  } catch (e) {
    toast(searchMsg, e.message || String(e));
  }
}

leagueIdInput.value = PREMIER_LEAGUE_ID;
teamIdInput.value = LEEDS_TEAM_ID;
searchBtn.addEventListener("click", runSearch);
