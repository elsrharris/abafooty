import { apiGet, getApiKey, setApiKey, getLeedsTeamId, fmtDate, upsertAttended } from "./app.js";

const $ = (id) => document.getElementById(id);

const apiKeyInput = $("apiKey");
const saveKeyBtn = $("saveKeyBtn");
const settingsMsg = $("settingsMsg");

const seasonInput = $("season");
const fromInput = $("from");
const toInput = $("to");
const searchBtn = $("searchBtn");
const searchMsg = $("searchMsg");

const resultsTable = $("resultsTable");
const resultsBody = $("resultsBody");

function toast(el, msg, show = true) {
  el.textContent = msg;
  el.style.display = show ? "block" : "none";
}

function currentSeasonGuess() {
  // Leeds season is just a year value in API-Football.
  // Use current UTC year; user can adjust.
  const now = new Date();
  return now.getUTCFullYear();
}

function scoreText(fx) {
  const g = fx?.goals;
  if (!g || (g.home == null && g.away == null)) return "—";
  return `${g.home ?? 0}-${g.away ?? 0}`;
}

function venueText(fx, leedsId) {
  const homeId = fx?.teams?.home?.id;
  if (!homeId || !leedsId) return "—";
  return homeId === leedsId ? "Home" : "Away";
}

function opponentName(fx, leedsId) {
  const home = fx?.teams?.home;
  const away = fx?.teams?.away;
  if (home?.id === leedsId) return away?.name || "Unknown";
  return home?.name || "Unknown";
}

function compName(fx) {
  const l = fx?.league;
  if (!l) return "—";
  return `${l.name}${l.round ? " • " + l.round : ""}`;
}

function buildMatchRecord(fx, leeds) {
  const leedsId = leeds.teamId;
  const home = fx.teams.home;
  const away = fx.teams.away;
  const isHome = home.id === leedsId;

  // W/D/L only makes sense for finished matches
  const homeGoals = fx.goals?.home;
  const awayGoals = fx.goals?.away;
  let result = null;
  if (homeGoals != null && awayGoals != null) {
    const leedsGoals = isHome ? homeGoals : awayGoals;
    const oppGoals = isHome ? awayGoals : homeGoals;
    result = leedsGoals > oppGoals ? "W" : leedsGoals < oppGoals ? "L" : "D";
  }

  return {
    fixtureId: fx.fixture.id,
    date: fx.fixture.date,
    league: fx.league?.name || "",
    round: fx.league?.round || "",
    season: fx.league?.season,
    venue: isHome ? "Home" : "Away",
    opponent: opponentName(fx, leedsId),
    leedsGoals: (homeGoals == null || awayGoals == null) ? null : (isHome ? homeGoals : awayGoals),
    oppGoals: (homeGoals == null || awayGoals == null) ? null : (isHome ? awayGoals : homeGoals),
    result, // "W" | "D" | "L" | null
    homeTeam: home?.name || "",
    awayTeam: away?.name || "",
  };
}

async function runSearch() {
  resultsBody.innerHTML = "";
  resultsTable.style.display = "none";

  try {
    if (!getApiKey()) throw new Error("Add your RapidAPI key first (above).");

    toast(searchMsg, "Finding Leeds United team id…");
    const leeds = await getLeedsTeamId();

    const season = seasonInput.value || currentSeasonGuess();
    const params = { team: leeds.teamId, season };

    // API-Football fixtures supports date range filtering via from/to in many examples/docs. :contentReference[oaicite:3]{index=3}
    if (fromInput.value) params.from = fromInput.value;
    if (toInput.value) params.to = toInput.value;

    toast(searchMsg, "Loading fixtures…");
    const data = await apiGet("/fixtures", params);
    const fixtures = data.response || [];

    if (!fixtures.length) {
      toast(searchMsg, "No fixtures found for that range/season.");
      return;
    }

    toast(searchMsg, `Found ${fixtures.length} fixtures. Click “Add” for games he attended.`);
    resultsTable.style.display = "table";

    for (const item of fixtures) {
      const fx = item; // API-Football returns a fixture object with fixture/teams/league/goals etc.
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.textContent = fmtDate(fx.fixture?.date);

      const tdMatch = document.createElement("td");
      tdMatch.textContent = `${fx.teams?.home?.name || "?"} vs ${fx.teams?.away?.name || "?"}`;

      const tdComp = document.createElement("td");
      tdComp.textContent = compName(fx);

      const tdVenue = document.createElement("td");
      tdVenue.textContent = venueText(fx, leeds.teamId);

      const tdScore = document.createElement("td");
      tdScore.textContent = scoreText(fx);

      const tdBtn = document.createElement("td");
      const btn = document.createElement("button");
      btn.className = "secondary";
      btn.textContent = "Add";
      btn.addEventListener("click", () => {
        const rec = buildMatchRecord(fx, leeds);
        upsertAttended(rec);
        btn.textContent = "Added ✓";
        btn.disabled = true;
      });
      tdBtn.appendChild(btn);

      tr.append(tdDate, tdMatch, tdComp, tdVenue, tdScore, tdBtn);
      resultsBody.appendChild(tr);
    }
  } catch (e) {
    toast(searchMsg, e.message || String(e));
  }
}

// Init
apiKeyInput.value = getApiKey();
seasonInput.value = currentSeasonGuess();

saveKeyBtn.addEventListener("click", () => {
  setApiKey(apiKeyInput.value);
  toast(settingsMsg, "Saved. You can now search fixtures.");
  setTimeout(() => (settingsMsg.style.display = "none"), 2500);
});

searchBtn.addEventListener("click", runSearch);
