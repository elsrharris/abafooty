// ====== CONFIG ======
const API_HOST = "api-football-v1.p.rapidapi.com";
const API_BASE = `https://${API_HOST}/v3`;

// ====== API KEY (hard-coded) ======
const RAPIDAPI_KEY = "PASTE_YOUR_RAPIDAPI_KEY_HERE";

export function getApiKey() {
  return RAPIDAPI_KEY;
}


// ====== API CALL ======
export async function apiGet(path, params = {}) {
  const key = getApiKey();
  if (!key) throw new Error("Missing RapidAPI key. Add it in Settings.");

  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-key": key,
      "x-rapidapi-host": API_HOST,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }

  const data = await res.json();
  if (data?.errors && Object.keys(data.errors).length) {
    throw new Error(`API errors: ${JSON.stringify(data.errors)}`);
  }
  return data;
}

// ====== APP STATE (attended matches) ======
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
  const idx = list.findIndex(m => m.fixtureId === match.fixtureId);
  if (idx >= 0) list[idx] = match;
  else list.unshift(match);
  saveAttended(list);
  return list;
}
export function removeAttended(fixtureId) {
  const list = loadAttended().filter(m => m.fixtureId !== fixtureId);
  saveAttended(list);
  return list;
}

// ====== TEAM RESOLUTION (avoid hardcoding Leeds ID) ======
const TEAM_CACHE_KEY = "dadfootball_teamcache_v1";

export async function getLeedsTeamId() {
  const cached = JSON.parse(localStorage.getItem(TEAM_CACHE_KEY) || "null");
  if (cached?.teamId && cached?.teamName) return cached;

  // Find Leeds United by search (docs: Teams endpoint exists). :contentReference[oaicite:1]{index=1}
  const data = await apiGet("/teams", { search: "Leeds", country: "England" });
  const pick = (data.response || []).find(x =>
    (x.team?.name || "").toLowerCase().includes("leeds")
  );

  if (!pick?.team?.id) throw new Error("Could not find Leeds United team id.");

  const obj = { teamId: pick.team.id, teamName: pick.team.name, logo: pick.team.logo };
  localStorage.setItem(TEAM_CACHE_KEY, JSON.stringify(obj));
  return obj;
}

// ====== UTIL ======
export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
export function safeText(s) {
  return (s ?? "").toString();
}
