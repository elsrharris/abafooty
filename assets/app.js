// =====================================================
// Free API Live Football Data (RapidAPI) – CONFIG
// =====================================================
const API_HOST = "free-api-live-football-data.p.rapidapi.com";
const API_BASE = `https://${API_HOST}`;

// 🔐 Paste your NEW RapidAPI key here
// (rotate the old one first in RapidAPI)
const RAPIDAPI_KEY = "ab0e509211msh236be082d98284bp181843jsnb107450cf09e";

// Known IDs (confirmed from your API responses)
export const PREMIER_LEAGUE_ID = 47;
export const LEEDS_TEAM_ID = 8463;

// =====================================================
// Core API helper (THIS is where your snippet belongs)
// =====================================================
export async function apiGet(path, params = {}) {
  const url = new URL(API_BASE + path);

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": "ab0e509211msh236be082d98284bp181843jsnb107450cf09e",
      "X-RapidAPI-Host": API_HOST,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${body}`);
  }

  return res.json();
}

// =====================================================
// API WRAPPERS (your confirmed endpoints)
// =====================================================
export async function getMatchesByLeague(leagueId) {
  return apiGet("/football-get-all-matches-by-league", {
    leagueid: leagueId,
  });
}

export async function getPlayers(teamId = LEEDS_TEAM_ID) {
  return apiGet("/football-get-list-player", {
    teamid: teamId,
  });
}

export async function getMatchAllStats(eventId) {
  return apiGet("/football-get-match-event-all-stats", {
    eventid: eventId,
  });
}

// =====================================================
// LOCAL STORAGE (attended matches)
// =====================================================
const STORE_KEY = "dadfootball_attended_v1";

export function loadAttended() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveAttended(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

export function upsertAttended(match) {
  const list = loadAttended();
  const idx = list.findIndex((m) => m.eventId === match.eventId);

  if (idx >= 0) {
    list[idx] = match;
  } else {
    list.unshift(match);
  }

  saveAttended(list);
  return list;
}

export function removeAttended(eventId) {
  const list = loadAttended().filter((m) => m.eventId !== eventId);
  saveAttended(list);
  return list;
}

// =====================================================
// UTILITIES
// =====================================================
export function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function safeText(v) {
  return (v ?? "").toString();
}
