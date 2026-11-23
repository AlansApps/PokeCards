// PoGo Team Cards — builds a team card from live PvPoke data.
// Data:   PvPoke gamemaster + cup rankings (github.com/pvpoke/pvpoke, MIT)
// Images: PokeAPI official artwork (github.com/PokeAPI/sprites)

const PVPOKE = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data";
const ART = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const ROLES = ["LEAD", "SAFE SWITCH", "CLOSER"];
const DEFAULT_TEAM = ["sableye_mega", "melmetal", "machamp_shadow"];

// ---------- type chart (Pokémon GO multipliers) ----------
const TYPES = ["normal","fire","water","electric","grass","ice","fighting","poison","ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"];
const CHART = { // attacker: [super effective], [not very effective], [immune]
  normal:[[],["rock","steel"],["ghost"]],
  fire:[["grass","ice","bug","steel"],["fire","water","rock","dragon"],[]],
  water:[["fire","ground","rock"],["water","grass","dragon"],[]],
  electric:[["water","flying"],["electric","grass","dragon"],["ground"]],
  grass:[["water","ground","rock"],["fire","grass","poison","flying","bug","dragon","steel"],[]],
  ice:[["grass","ground","flying","dragon"],["fire","water","ice","steel"],[]],
  fighting:[["normal","ice","rock","dark","steel"],["poison","flying","psychic","bug","fairy"],["ghost"]],
  poison:[["grass","fairy"],["poison","ground","rock","ghost"],["steel"]],
  ground:[["fire","electric","poison","rock","steel"],["grass","bug"],["flying"]],
  flying:[["grass","fighting","bug"],["electric","rock","steel"],[]],
  psychic:[["fighting","poison"],["psychic","steel"],["dark"]],
  bug:[["grass","psychic","dark"],["fire","fighting","poison","flying","ghost","steel","fairy"],[]],
  rock:[["fire","ice","flying","bug"],["fighting","ground","steel"],[]],
  ghost:[["psychic","ghost"],["dark"],["normal"]],
  dragon:[["dragon"],["steel"],["fairy"]],
  dark:[["psychic","ghost"],["fighting","dark","fairy"],[]],
  steel:[["ice","rock","fairy"],["fire","water","electric","steel"],[]],
  fairy:[["fighting","dragon","dark"],["fire","poison","steel"],[]],
};
function eff(atk, defTypes) {
  let m = 1;
  for (const d of defTypes) {
    if (!d || d === "none") continue;
    const [se, nve, imm] = CHART[atk];
    if (se.includes(d)) m *= 1.6;
    else if (nve.includes(d)) m *= 0.625;
    else if (imm.includes(d)) m *= 0.390625;
  }
  return m;
}

// ---------- stats ----------
const CPM_INT = [0,0.094,0.16639787,0.21573247,0.25572005,0.29024988,0.3210876,0.34921268,0.3752356,0.39956728,0.4225,0.44310755,0.46279839,0.48168495,0.49985844,0.51739395,0.53435433,0.55079269,0.56675452,0.58227891,0.5974,0.61215729,0.62656713,0.64065295,0.65443563,0.667934,0.68116492,0.69414365,0.7068842,0.71939909,0.7317,0.73776948,0.74378943,0.74976104,0.75568551,0.76156384,0.76739717,0.7731865,0.77893275,0.78463697,0.79030001,0.79530001,0.8003,0.8053,0.81029999,0.81529999,0.82029999,0.82529999,0.83029999,0.83529999,0.84029999,0.84529999];
function cpm(level) {
  const f = Math.floor(level);
  if (level === f) return CPM_INT[f];
  return Math.sqrt((CPM_INT[f] ** 2 + CPM_INT[f + 1] ** 2) / 2);
}
function stats(p, cp) {
  const iv = (p.defaultIVs && p.defaultIVs["cp" + cp]) || [40, 15, 15, 15];
  const c = cpm(iv[0]);
  let atk = (p.baseStats.atk + iv[1]) * c;
  let def = (p.baseStats.def + iv[2]) * c;
  const hp = Math.max(10, Math.floor((p.baseStats.hp + iv[3]) * c));
  if (isShadow(p.speciesId)) { atk *= 1.2; def *= 5 / 6; }
  return { atk, def, hp };
}

// ---------- names / ids ----------
const isShadow = id => /_shadow$/.test(id);
const baseId = id => id.replace(/_shadow$/, "").replace(/_mega(_[xy])?$/, "").replace(/_primal$/, "");
const REGION = { Alolan: "Alolan", Galarian: "Galarian", Hisuian: "Hisuian", Paldean: "Paldean" };
function prettyName(speciesName, { keepVariant }) {
  // "Muk (Alolan) (Shadow)" style -> "Shadow Alolan Muk"
  let name = speciesName, prefix = [], suffix = [];
  for (const m of [...speciesName.matchAll(/\(([^)]+)\)/g)]) {
    const tag = m[1].trim();
    name = name.replace(m[0], "");
    if (tag === "Shadow") { if (keepVariant) prefix.unshift("Shadow"); }
    else if (/^Mega( [XY])?$/.test(tag)) { if (keepVariant) { prefix.push("Mega"); if (tag.length > 4) suffix.push(tag.slice(5)); } }
    else if (tag === "Primal") { if (keepVariant) prefix.push("Primal"); }
    else if (REGION[tag]) prefix.push(REGION[tag]);
    else suffix.push(`(${tag})`);
  }
  return [...prefix, name.trim(), ...suffix].join(" ").replace(/\s+/g, " ");
}
function pokeapiName(id) {
  return id.replace(/_shadow$/, "")
    .replace(/_alolan/, "-alola").replace(/_galarian/, "-galar").replace(/_hisuian/, "-hisui").replace(/_paldean/, "-paldea")
    .replace(/_mega_x$/, "-mega-x").replace(/_mega_y$/, "-mega-y").replace(/_mega$/, "-mega").replace(/_primal$/, "-primal")
    .replace(/_/g, "-");
}

// ---------- sprite lookup (cached) ----------
let spriteCache = {};
try { spriteCache = JSON.parse(localStorage.getItem("spriteCache") || "{}"); } catch {}
async function spriteFor(p, keepVariant) {
  const id = keepVariant ? p.speciesId.replace(/_shadow$/, "") : baseId(p.speciesId);
  if (spriteCache[id]) return spriteCache[id];
  let url = ART(p.dex);
  const name = pokeapiName(id);
  if (name.includes("-")) {
    try {
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
      if (r.ok) {
        const j = await r.json();
        url = j.sprites?.other?.["official-artwork"]?.front_default || url;
      }
    } catch {}
  }
  spriteCache[id] = url;
  try { localStorage.setItem("spriteCache", JSON.stringify(spriteCache)); } catch {}
  return url;
}

// ---------- data ----------
let GM, POKE = {}, MOVES = {}, rankingsCache = {};
async function loadGM() {
  GM = await (await fetch(`${PVPOKE}/gamemaster.min.json`)).json();
  for (const p of GM.pokemon) if (p.released !== false) POKE[p.speciesId] = p;
  for (const m of GM.moves) MOVES[m.moveId] = m;
}
async function loadRankings(cup, cp) {
  const key = `${cup}-${cp}`;
  if (!rankingsCache[key]) {
    const r = await fetch(`${PVPOKE}/rankings/${cup}/overall/rankings-${cp}.json`);
    if (!r.ok) throw new Error(`No PvPoke rankings for ${cup} (${cp})`);
    rankingsCache[key] = await r.json();
  }
  return rankingsCache[key];
}

// ---------- battle estimate ----------
function moveDamage(move, attacker, aStats, defender, dStats) {
  const stab = attacker.types.includes(move.type) ? 1.2 : 1;
  return Math.floor(0.5 * move.power * (aStats.atk / dStats.def) * stab * eff(move.type, defender.types) * 1.3) + 1;
}
// Damage per turn of a fast + best charged move loop (no shields, no buffs).
function dpt(att, aStats, moveset, def, dStats) {
  const fast = MOVES[moveset[0]];
  if (!fast) return 0;
  const fd = moveDamage(fast, att, aStats, def, dStats);
  const turns = fast.turns || fast.cooldown / 500;
  let best = fd / turns;
  for (const id of moveset.slice(1)) {
    const c = MOVES[id];
    if (!c || !c.energy) continue;
    const n = Math.ceil(c.energy / Math.max(1, fast.energyGain));
    const v = (n * fd + moveDamage(c, att, aStats, def, dStats)) / (n * turns);
    best = Math.max(best, v);
  }
  return best;
}
// > 1 means "me" KOs the opponent before it KOs me.
function matchupScore(me, meMoves, opp, oppMoves, cp) {
  const ms = stats(me, cp), os = stats(opp, cp);
  const myTTK = os.hp / dpt(me, ms, meMoves, opp, os);
  const oppTTK = ms.hp / dpt(opp, os, oppMoves, me, ms);
  return oppTTK / myTTK;
}
function defaultMoveset(p, rankings) {
  const r = rankings.find(x => x.speciesId === p.speciesId);
  if (r?.moveset) return r.moveset;
  const fast = [...p.fastMoves].sort((a, b) => (MOVES[b]?.energyGain || 0) - (MOVES[a]?.energyGain || 0))[0];
  return [fast, ...(p.chargedMoves || []).slice(0, 2)];
}

// ---------- card analysis ----------
function analyse(team, metaN, rankings, cp) {
  const rows = team.map((t, i) => {
    const p = t.poke;
    const resists = [], weak = [];
    for (const a of TYPES) {
      const m = eff(a, p.types);
      if (m < 1) resists.push([a, m]);
      if (m > 1) weak.push([a, m]);
    }
    resists.sort((x, y) => x[1] - y[1]);
    weak.sort((x, y) => y[1] - x[1]);
    const hits = new Map(); // defending type -> best multiplier from my moves
    for (const id of t.moves) {
      const mv = MOVES[id];
      if (!mv) continue;
      for (const d of TYPES) if (eff(mv.type, [d]) > 1) hits.set(d, (hits.get(d) || 0) + 1);
    }
    const damages = [...hits.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
    return { ...t, role: ROLES[i], resists: resists.map(x => x[0]), weak: weak.map(x => x[0]), damages, punishes: [], safe: [] };
  });

  // Meta: top N, unify shadow/mega with their regular version.
  const seen = new Set(), meta = [];
  for (const r of rankings) {
    if (meta.length >= metaN) break;
    const p = POKE[r.speciesId];
    if (!p) continue;
    const key = baseId(r.speciesId);
    if (seen.has(key)) continue;
    seen.add(key);
    meta.push({ poke: p, moves: r.moveset || defaultMoveset(p, rankings) });
  }

  for (const m of meta) {
    const scores = rows.map(row => matchupScore(row.poke, row.moves, m.poke, m.moves, cp));
    const best = scores.indexOf(Math.max(...scores));
    const row = rows[best];
    const hitsSE = row.moves.some(id => MOVES[id] && eff(MOVES[id].type, m.poke.types) > 1);
    (scores[best] >= 1.25 && hitsSE ? row.punishes : row.safe).push({ ...m, score: scores[best] });
  }
  for (const r of rows) { r.punishes.sort((a, b) => b.score - a.score); r.safe.sort((a, b) => b.score - a.score); }
  return rows;
}

// ---------- render ----------
const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const cap = s => s[0].toUpperCase() + s.slice(1);
function typeIcon(t) {
  return `<div class="type"><img class="ic" src="assets/type-icons/${t}.png" alt=""><span>${cap(t)}</span></div>`;
}
const typeGrid = (list, cols) => list.length
  ? `<div class="types" style="--cols:${Math.min(cols, Math.max(1, list.length))}">${list.map(typeIcon).join("")}</div>`
  : `<div class="empty">—</div>`;
async function monList(list) {
  if (!list.length) return `<div class="empty">—</div>`;
  const items = await Promise.all(list.map(async m =>
    `<div class="mon"><img crossorigin="anonymous" src="${await spriteFor(m.poke, false)}" alt=""><span>${esc(prettyName(m.poke.speciesName, { keepVariant: false }))}</span></div>`));
  return `<div class="mons">${items.join("")}</div>`;
}
async function render(rows) {
  const html = await Promise.all(rows.map(async r => {
    const rc = r.resists.length > 8 ? 6 : 4;
    return `<section class="prow">
      <div class="who"><img crossorigin="anonymous" class="${isShadow(r.poke.speciesId) ? "shadow" : ""}" src="${await spriteFor(r.poke, true)}" alt="">
        <div class="name">${esc(prettyName(r.poke.speciesName, { keepVariant: true }))}</div><div class="role">${r.role}</div></div>
      <div class="block good"><h2>GOOD</h2><div class="subs">
        <div class="sub"><h3>RESISTS</h3>${typeGrid(r.resists, rc)}</div>
        <div class="sub dmg"><h3>DAMAGES</h3>${typeGrid(r.damages, r.damages.length > 6 ? 4 : 3)}</div></div></div>
      <div class="block bad"><h2>BAD</h2><div class="subs"><div class="sub">${typeGrid(r.weak, r.weak.length > 4 ? 3 : 2)}</div></div></div>
      <div class="block use"><h2>USE AGAINST</h2><div class="subs">
        <div class="sub"><h3>PUNISHES</h3>${await monList(r.punishes)}</div>
        <div class="sub"><h3>SAFE OPTION</h3>${await monList(r.safe)}</div></div></div>
    </section>`;
  }));
  const card = document.getElementById("card");
  card.innerHTML = html.join("");
  card.classList.toggle("no-names", !document.getElementById("showNames").checked);
}

// ---------- UI ----------
const $ = id => document.getElementById(id);
const setStatus = s => ($("status").textContent = s);
const nameToId = {};
let currentRankings = [];

function moveOptions(ids, selected) {
  return ids.map(id => `<option value="${id}" ${id === selected ? "selected" : ""}>${esc(MOVES[id]?.name || id)}</option>`).join("");
}
function fillMoves(slot, id) {
  const p = POKE[id];
  const box = slot.querySelector(".moves");
  if (!p) { box.innerHTML = ""; return; }
  const ms = defaultMoveset(p, currentRankings);
  const charged = [...p.chargedMoves, ...(p.extraChargedMoves || [])];
  box.innerHTML = `<select data-k="f">${moveOptions(p.fastMoves, ms[0])}</select>
    <select data-k="c1">${moveOptions(charged, ms[1])}</select>
    <select data-k="c2"><option value="">—</option>${moveOptions(charged, ms[2])}</select>`;
}
function buildTeamInputs() {
  $("teamInputs").innerHTML = ROLES.map((r, i) => `<div class="slot" data-i="${i}"><b>${r}</b>
    <input type="text" list="speciesList" placeholder="Pokémon…" value="${esc(POKE[DEFAULT_TEAM[i]]?.speciesName || "")}">
    <div class="moves"></div></div>`).join("");
  document.querySelectorAll(".slot").forEach((slot, i) => {
    fillMoves(slot, DEFAULT_TEAM[i]);
    slot.querySelector("input").addEventListener("change", e => fillMoves(slot, nameToId[e.target.value]));
  });
}
function readTeam() {
  return [...document.querySelectorAll(".slot")].map(slot => {
    const id = nameToId[slot.querySelector("input").value];
    if (!id) throw new Error(`Unknown Pokémon: "${slot.querySelector("input").value}"`);
    const moves = [...slot.querySelectorAll("select")].map(s => s.value).filter(Boolean);
    return { poke: POKE[id], moves };
  });
}
function selectedFormat() { const [cup, cp] = $("cup").value.split("|"); return { cup, cp: +cp }; }

async function build() {
  try {
    const { cup, cp } = selectedFormat();
    setStatus("Loading meta…");
    currentRankings = await loadRankings(cup, cp);
    const rows = analyse(readTeam(), +$("topN").value || 30, currentRankings, cp);
    setStatus("Drawing…");
    await render(rows);
    setStatus(`Meta: top ${$("topN").value} of ${$("cup").selectedOptions[0].text} · PvPoke data ${GM.timestamp || ""}`);
  } catch (e) { setStatus("⚠ " + e.message); console.error(e); }
}

async function downloadPng() {
  const card = $("card");
  if (!card.innerHTML) return;
  setStatus("Rendering PNG…");
  try {
    const url = await htmlToImage.toPng(card, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: false });
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-card-${selectedFormat().cup}.png`;
    a.click();
    setStatus("PNG downloaded.");
  } catch (e) { setStatus("⚠ PNG failed: " + e.message); }
}

(async function init() {
  try {
    await loadGM();
    // Fixed leagues + whatever cups PvPoke currently lists (rotating ones change over time).
    const fixed = [
      { title: "Great League", cup: "all", cp: 1500 },
      { title: "Ultra League", cup: "all", cp: 2500 },
      { title: "Master League", cup: "all", cp: 10000 },
    ];
    const listed = [...fixed, ...GM.formats.filter(f => f.cup !== "custom")];
    const ok = await Promise.all(listed.map(f =>
      fetch(`${PVPOKE}/rankings/${f.cup}/overall/rankings-${f.cp}.json`, { method: "HEAD" }).then(r => r.ok).catch(() => false)));
    const formats = listed.filter((_, i) => ok[i]);
    $("cup").innerHTML =
      `<optgroup label="Rotating / special cups">${formats.slice(3).filter(f => f.showFormat !== false).map(opt).join("")}</optgroup>` +
      `<optgroup label="Fixed leagues">${formats.filter(f => fixed.includes(f)).map(opt).join("")}</optgroup>` +
      `<optgroup label="Other (not featured now)">${formats.filter(f => f.showFormat === false).map(opt).join("")}</optgroup>`;
    function opt(f) { return `<option value="${f.cup}|${f.cp}">${esc(f.title)}</option>`; }
    const list = Object.values(POKE).sort((a, b) => a.speciesName.localeCompare(b.speciesName));
    for (const p of list) nameToId[p.speciesName] = p.speciesId;
    $("speciesList").innerHTML = list.map(p => `<option value="${esc(p.speciesName)}">`).join("");
    const { cup, cp } = selectedFormat();
    currentRankings = await loadRankings(cup, cp).catch(() => []);
    buildTeamInputs();
    $("cup").addEventListener("change", async () => {
      const f = selectedFormat();
      currentRankings = await loadRankings(f.cup, f.cp).catch(() => []);
    });
    $("build").addEventListener("click", build);
    $("png").addEventListener("click", downloadPng);
    $("showNames").addEventListener("change", e => $("card").classList.toggle("no-names", !e.target.checked));
    setStatus("Ready.");
  } catch (e) { setStatus("⚠ Could not load PvPoke data: " + e.message); }
})();
