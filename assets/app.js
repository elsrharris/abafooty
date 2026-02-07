// Free API Live Football Data (RapidAPI)
const API_HOST = "free-api-live-football-data.p.rapidapi.com";
const API_BASE = `https://${API_HOST}`;

// IMPORTANT: paste your RapidAPI key here locally (do NOT commit publicly if you can avoid it)
const RAPIDAPI_KEY = "PASTE_YOUR_RAPIDAPI_KEY_HERE";

// Known IDs from your API responses:
export const PREMIER_LEAGUE_ID = 47;
export const LEEDS_TEAM_ID = 8463;

export async function apiGet(path, params = {}) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": API_HOST,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }

  return res.json();
}

// Endpoint wrappers you gave:
export async function getMatchesByLeague(leagueId) {
  return apiGet("/football-get-all-matches-by-league", { leagueid: leagueId });
}

export async function getPlayers(teamId) {
  return apiGet("/football-get-list-player", { teamid: teamId });
}

export async function getMatchAllStats(eventId) {
  return apiGet("/football-get-match-event-all-stats", { eventid: eventId });
}

// Storage
const STORE_KEY = "dadfootball_attended_v1";

export function loadAttended() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
  catch { return []; }
}

export function saveAttended(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

export function upsertAttended(match) {
  const list = loadAttended();
  const idx = list.findIndex(m => m.eventId === match.eventId);
  if (idx >= 0) list[idx] = match;
  else list.unshift(match);
  saveAttended(list);
  return list;
}

export function removeAttended(eventId) {
  const list = loadAttended().filter(m => m.eventId !== eventId);
  saveAttended(list);
  return list;
}

export function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function safeText(s) {
  return (s ?? "").toString();
}
