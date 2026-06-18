
const DATA_KEY = "teamboard-v5-data";
const MASTER_KEY = "teamboard-v5-masters";
const MATCH_KEY = "teamboard-v9-matches";
const MATERIAL_KEY = "teamboard-v21-materials";
const SYNC_KEY = "teamboard-v5-sync";
const ACTIVE_YEAR_KEY = "teamboard-active-year";
const DEFAULT_YEAR = "2026年度";
const PARTS = [["wup","W-up"],["tr1","TR1"],["tr2","TR2"],["game","Game"]];

const defaultMasters = {
  tags: ["攻撃","守備","前進","少人数","ポゼッション","フィニッシュ","ビルドアップ","トランジション","雨の日"],
  times: ["60分","75分","90分","W-up 10 / TR1 20 / TR2 20 / Game 10","W-up 15 / TR1 20 / TR2 25 / Game 20"],
  categories: ["攻撃","守備","ポゼッション","フィニッシュ","ビルドアップ","トランジション","ウォーミングアップ","ゲーム"],
  ages: ["U-8","U-10","U-12","U-15","U-18","一般"],
  logoData: "teamboard-logo.png",
  surfaceType: "soccer",
  players: [],
  years: ["2026年度"],
  yearMasters: {}
};

let sessions = loadLocal(DATA_KEY, []);
let matches = loadLocal(MATCH_KEY, []);
let materials = loadLocal(MATERIAL_KEY, []);
let masters = loadLocal(MASTER_KEY, defaultMasters);
if(!Array.isArray(masters.players)) masters.players = [];
let syncSetting = loadLocal(SYNC_KEY, {gasUrl:"", teamKey:""});
let activeYear = loadLocal(ACTIVE_YEAR_KEY, DEFAULT_YEAR) || DEFAULT_YEAR;
let draft = emptySession();
let activePart = "wup";
let activeTool = "attack";
let pending = null;
let currentRotation = 0;
let currentPartColor = "#ffffff";

const el = id => document.getElementById(id);

function normalizeYear(v){ return String(v || DEFAULT_YEAR).trim() || DEFAULT_YEAR; }
function ensureYears(){
  if(!Array.isArray(masters.years)) masters.years = [DEFAULT_YEAR];
  masters.years = [...new Set(masters.years.map(normalizeYear).filter(Boolean))];
  if(!masters.years.length) masters.years = [DEFAULT_YEAR];
  if(!masters.years.includes(DEFAULT_YEAR)) masters.years.unshift(DEFAULT_YEAR);
  if(!masters.yearMasters || typeof masters.yearMasters !== "object") masters.yearMasters = {};
  activeYear = normalizeYear(activeYear);
  if(!masters.years.includes(activeYear)) activeYear = DEFAULT_YEAR;
}
function itemYear(item){ return normalizeYear(item && item.year); }
function inActiveYear(item){ return itemYear(item) === activeYear; }
function yearSessions(){ return sessions; }
function yearMatches(){ return matches.filter(inActiveYear); }
function yearMaterials(){ return materials.filter(inActiveYear); }
function defaultYearMaster(){
  return {
    tags: [...defaultMasters.tags],
    times: [...defaultMasters.times],
    categories: [...defaultMasters.categories],
    ages: [...defaultMasters.ages],
    players: [],
    surfaceType: "soccer"
  };
}
function activeMasterSnapshot(){
  return {
    tags: Array.isArray(masters.tags) ? [...masters.tags] : [],
    times: Array.isArray(masters.times) ? [...masters.times] : [],
    categories: Array.isArray(masters.categories) ? [...masters.categories] : [],
    ages: Array.isArray(masters.ages) ? [...masters.ages] : [],
    players: Array.isArray(masters.players) ? clone(masters.players) : [],
    surfaceType: masters.surfaceType || "soccer"
  };
}
function applyYearMaster(year){
  ensureYears();
  if(!masters.yearMasters || typeof masters.yearMasters !== "object") masters.yearMasters = {};
  const y = normalizeYear(year);
  if(!masters.yearMasters[y]) masters.yearMasters[y] = y === DEFAULT_YEAR ? activeMasterSnapshot() : defaultYearMaster();
  const ym = masters.yearMasters[y];
  masters.tags = Array.isArray(ym.tags) ? [...ym.tags] : [...defaultMasters.tags];
  masters.times = Array.isArray(ym.times) ? [...ym.times] : [...defaultMasters.times];
  masters.categories = Array.isArray(ym.categories) ? [...ym.categories] : [...defaultMasters.categories];
  masters.ages = Array.isArray(ym.ages) ? [...ym.ages] : [...defaultMasters.ages];
  masters.players = Array.isArray(ym.players) ? clone(ym.players) : [];
  masters.surfaceType = ym.surfaceType || "soccer";
}
function persistCurrentYearMaster(){
  ensureYears();
  if(!masters.yearMasters || typeof masters.yearMasters !== "object") masters.yearMasters = {};
  masters.yearMasters[activeYear] = activeMasterSnapshot();
}
function setActiveYear(year){
  persistCurrentYearMaster();
  activeYear = normalizeYear(year);
  if(!masters.years.includes(activeYear)){
    masters.years.push(activeYear);
    saveMasters();
  }
  saveLocal(ACTIVE_YEAR_KEY, activeYear);
  applyYearMaster(activeYear);
  saveMasters();
  refreshMastersUI();
  renderYearSelects();
  renderAll();
  bindYearSwitch();
  clearMatchForm();
  clearMaterialForm();
  toast(activeYear + "に切り替えました");
}
function nextSchoolYearLabel(year){
  const m = String(year || DEFAULT_YEAR).match(/(\d{4})/);
  const base = m ? Number(m[1]) : 2026;
  return `${base + 1}年度`;
}
function rolloverYear(){
  persistCurrentYearMaster();
  const fromYear = activeYear;
  const nextYear = nextSchoolYearLabel(fromYear);
  if(masters.years.includes(nextYear) && masters.yearMasters && masters.yearMasters[nextYear]){
    if(!confirm(`${nextYear}はすでにあります。${fromYear}のマスタで上書きコピーしますか？`)) return;
  }else{
    if(!confirm(`${fromYear}の選手管理・マスタ管理をコピーして、${nextYear}を作成しますか？`)) return;
  }
  if(!masters.yearMasters || typeof masters.yearMasters !== "object") masters.yearMasters = {};
  const copied = clone(masters.yearMasters[fromYear] || activeMasterSnapshot());
  masters.yearMasters[nextYear] = copied;
  if(!masters.years.includes(nextYear)) masters.years.push(nextYear);
  activeYear = nextYear;
  saveLocal(ACTIVE_YEAR_KEY, activeYear);
  applyYearMaster(activeYear);
  saveMasters();
  refreshMastersUI();
  renderYearSelects();
  renderAll();
  bindYearSwitch();
  clearMatchForm();
  clearMaterialForm();
  toast(`${nextYear}を作成しました`);
}
function renderYearSelects(){
  ensureYears();
  const opts = masters.years.map(y=>`<option value="${esc(y)}" ${y===activeYear ? "selected" : ""}>${esc(y)}</option>`).join("");
  if(el("activeYearSelect")) el("activeYearSelect").innerHTML = opts;
  if(el("masterYears")) el("masterYears").value = masters.years.join("\n");
}
function bindYearSwitch(){
  const sel = el("activeYearSelect");
  if(sel){
    sel.value = activeYear;
    sel.onchange = (e)=>setActiveYear(e.target.value);
  }
}
function migrateYearFields(){
  let changed = false;
  matches.forEach(m=>{ if(!m.year){ m.year = DEFAULT_YEAR; changed = true; } });
  materials.forEach(m=>{ if(!m.year){ m.year = DEFAULT_YEAR; changed = true; } });
  if(changed){ saveAll(); saveMatches(); saveMaterials(); }
}


function loadLocal(k, fallback){try{return JSON.parse(localStorage.getItem(k)) || fallback;}catch(e){return fallback;}}
function saveLocal(k,v){localStorage.setItem(k, JSON.stringify(v));}
function saveAll(){saveLocal(DATA_KEY, sessions);}
function saveMatches(){saveLocal(MATCH_KEY, matches);}
function saveMaterials(){saveLocal(MATERIAL_KEY, materials);}
function saveMasters(){saveLocal(MASTER_KEY, masters);}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
function clone(o){return JSON.parse(JSON.stringify(o));}
function toast(msg){el("toast").textContent=msg;el("toast").classList.add("show");setTimeout(()=>el("toast").classList.remove("show"),1800);}
function emptySession(){const parts={};PARTS.forEach(([k])=>parts[k]={objects:[],organize:"",rules:"",coaching:""});return {id:uid(),title:"",age:"U-12",category:"攻撃",timePlan:"60分",tags:"",parts,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};}
function splitTags(s){return (s||"").split(/[,\s、]+/).map(x=>x.trim()).filter(Boolean);}
function esc(s=""){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function page(id){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));el(id).classList.add("active");document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===id));window.scrollTo({top:0,behavior:"smooth"});}
function partName(k){return PARTS.find(p=>p[0]===k)?.[1]||k;}

function fillSelect(id, values, firstLabel){
  const s = el(id);
  const current = s.value;
  s.innerHTML = (firstLabel ? `<option value="">${firstLabel}</option>` : "") + values.map(v=>`<option>${esc(v)}</option>`).join("");
  if(values.includes(current)) s.value = current;
}

function refreshMastersUI(){
  fillSelect("age", masters.ages);
  fillSelect("category", masters.categories);
  fillSelect("timePlan", masters.times);
  fillSelect("categoryFilter", masters.categories, "カテゴリーすべて");
  fillSelect("matchCategory", masters.ages);
  fillSelect("materialCategory", masters.ages);
  if(!Array.isArray(masters.players)) masters.players = [];
  ensureYears();
  renderYearSelects();
  el("masterTags").value = masters.tags.join("\n");
  el("masterTimes").value = masters.times.join("\n");
  el("masterCategories").value = masters.categories.join("\n");
  el("masterAges").value = masters.ages.join("\n");
  el("surfaceType").value = masters.surfaceType || "soccer";
  renderPlayerMasterList();
}

function renderLogo(){
  const data = masters.logoData || "teamboard-logo.png";
  const html = data ? `<img src="${data}" alt="TeamBoardロゴ">` : "⚽";
  el("headerLogo").innerHTML = html;
  el("topLogoPreview").innerHTML = html;
  el("settingsLogoPreview").innerHTML = html;
}
function renderSurface(){
  document.body.dataset.surface = masters.surfaceType || "soccer";
}
function setLogoFromFile(file){
  if(!file) return;
  if(file.size > 900000){
    alert("ロゴ画像が大きすぎます。900KB以下を目安にしてください。");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    masters.logoData = reader.result;
    saveMasters();
    renderLogo();
    toast("ロゴを登録しました");
  };
  reader.readAsDataURL(file);
}
function clearLogo(){
  if(!confirm("登録したロゴを削除しますか？")) return;
  masters.logoData = "";
  saveMasters();
  renderLogo();
  toast("ロゴを削除しました");
}

function readMastersUI(){
  const lines = id => el(id).value.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  masters.tags = lines("masterTags");
  masters.times = lines("masterTimes");
  masters.categories = lines("masterCategories");
  masters.ages = lines("masterAges");
  masters.years = lines("masterYears").length ? lines("masterYears").map(normalizeYear) : [DEFAULT_YEAR];
  masters.years = [...new Set(masters.years)];
  if(!masters.years.includes(DEFAULT_YEAR)) masters.years.unshift(DEFAULT_YEAR);
  if(!masters.years.includes(activeYear)) activeYear = masters.years[0] || DEFAULT_YEAR;
  saveLocal(ACTIVE_YEAR_KEY, activeYear);
  masters.logoData = (masters.logoData === undefined || masters.logoData === null) ? "teamboard-logo.png" : masters.logoData;
  masters.surfaceType = el("surfaceType").value || "soccer";
  if(!Array.isArray(masters.players)) masters.players = [];
  persistCurrentYearMaster();
  saveMasters();
  refreshMastersUI();
  renderYearSelects();
  renderAll();
  renderTags();
  toast(activeYear + "のマスタを保存しました");
}

function pitchBase(){
  const type = masters.surfaceType || "soccer";
  const defs = `<defs><marker id="arrowHead" markerWidth="14" markerHeight="14" refX="11" refY="7" orient="auto"><path d="M2,2 L12,7 L2,12" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></marker></defs>`;
  if(type === "futsal"){
    let stripes = "";
    for(let x=0;x<1000;x+=100){
      stripes += `<rect x="${x}" y="0" width="50" height="640" fill="rgba(255,255,255,.04)"/>`;
    }
    return defs + `<rect x="0" y="0" width="1000" height="640" fill="#1f8fb8"/>${stripes}`;
  }
  let stripes = "";
  for(let x=0;x<1000;x+=100){
    stripes += `<rect x="${x}" y="0" width="50" height="640" fill="rgba(255,255,255,.05)"/>`;
  }
  return defs + `<rect x="0" y="0" width="1000" height="640" fill="#11813e"/>${stripes}`;
}


function defaultScale(type){
  const map = {
    attack:1,defense:1,free:1,gk:1,person:1,cone:1,marker:1,ladder:1,circlePart:1,squarePart:1,hLine:1,vLine:1,
    centerLine:1,centerCircle:1,courtArea:1,goalFrame:1,goal:1,penalty:1,ball:1,text:1,line:1,arrow:1,dash:1,zigzag:1
  };
  return map[type] || 1;
}
function defaultColor(type){
  const map = {
    attack:"#e53935", defense:"#1e88e5", free:"#fdd835", gk:"#8e99a5", cone:"#ff7a00", marker:"#ffea00", ladder:"#ffffff",
    circlePart:"#ffffff", squarePart:"#ffffff", hLine:"#ffffff", vLine:"#ffffff", person:"#ffffff",
    centerLine:"#ffffff", centerCircle:"#ffffff", courtArea:"#ffffff", goalFrame:"#ffffff",
    line:"#ffffff", arrow:"#ffffff", dash:"#ffffff", zigzag:"#ffffff", text:"#ffffff"
  };
  return map[type] || currentPartColor || "#ffffff";
}
function isLineType(type){ return ["line","arrow","dash","zigzag"].includes(type); }
function isColorableType(type){ return ["attack","defense","free","gk","person","cone","marker","ladder","circlePart","squarePart","hLine","vLine","centerLine","centerCircle","courtArea","goalFrame","line","arrow","dash","zigzag","text"].includes(type); }
function isFixedColorType(type){ return ["attack","defense","free","gk"].includes(type); }
function canChangeColor(type){ return isColorableType(type) && !isFixedColorType(type); }
function objColor(o){
  const type = o ? o.type : activeTool;
  if(isFixedColorType(type)) return defaultColor(type);
  return o && o.color ? o.color : defaultColor(type);
}
function currentObjects(){ return draft.parts[activePart].objects; }
let selectedObjectId = null;
let interaction = null;

function ensureObjectDefaults(o){
  if(!o.id) o.id = uid();
  if(o.r == null) o.r = 0;
  if(o.s == null) o.s = defaultScale(o.type);
  if(o.type === "goal") o.type = "goalFrame";
  if(o.type === "penalty") o.type = "courtArea";
  if(isFixedColorType(o.type)) o.color = defaultColor(o.type);
  else if(isColorableType(o.type) && !o.color) o.color = defaultColor(o.type);
  return o;
}
function normalizeCurrentObjects(){ currentObjects().forEach(ensureObjectDefaults); }
function getObjectById(id){ normalizeCurrentObjects(); return currentObjects().find(o => o.id === id); }
function getSelectedObject(){ return selectedObjectId ? getObjectById(selectedObjectId) : null; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function rotNorm(v){ return ((v % 360) + 360) % 360; }

function defaultLineEndPoint(start, type){
  const baseLen = type === "zigzag" ? 190 : 165;
  const x1 = start && start.x != null ? start.x : 120;
  const y1 = start && start.y != null ? start.y : 320;
  return {
    x2: clamp(x1 + baseLen, 20, 980),
    y2: clamp(y1, 20, 620)
  };
}
function normalizeLineObject(o){
  if(!o || !isLineType(o.type)) return o;
  const dist = Math.hypot((o.x2 || o.x1) - o.x1, (o.y2 || o.y1) - o.y1);
  if(dist < 12){
    const end = defaultLineEndPoint({x:o.x1, y:o.y1}, o.type);
    o.x2 = end.x2;
    o.y2 = end.y2;
  }
  return o;
}


function playerShape(x,y,color,label,text="#fff",s=1,r=0){
  const bodyR = 22*s;
  const headR = 8*s;
  const sw = Math.max(2, 4*s);
  const fs = Math.max(12, 18*s);
  const bib = ["#fdd835","#8e99a5"].includes(color) ? "#2b2b2b" : "#ffffff";
  return `<g transform="rotate(${r} ${x} ${y})">
    <circle cx="${x}" cy="${y+4*s}" r="${bodyR}" fill="${color}" stroke="#15331f" stroke-width="${sw}"/>
    <circle cx="${x}" cy="${y-20*s}" r="${headR}" fill="#f8f8f8" stroke="#15331f" stroke-width="${Math.max(1.5,2.5*s)}"/>
    <path d="M ${x-11*s} ${y-4*s} Q ${x} ${y-14*s} ${x+11*s} ${y-4*s}" fill="none" stroke="${bib}" stroke-width="${Math.max(2,3*s)}" stroke-linecap="round"/>
    <path d="M ${x-7*s} ${y+15*s} L ${x} ${y+20*s} L ${x+7*s} ${y+15*s}" fill="none" stroke="${bib}" stroke-width="${Math.max(2,3*s)}" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${x}" y="${y+11*s}" text-anchor="middle" font-size="${fs}" font-weight="900" fill="${text}">${label}</text>
  </g>`;
}
function coneShape(x,y,s=1){
  const h = 28*s, w = 24*s, sw = Math.max(2,4*s), lw = 13*s;
  return `<path d="M${x} ${y-h} L${x-w} ${y+w} L${x+w} ${y+w} Z" fill="#ff7a00" stroke="#fff" stroke-width="${sw}"/><line x1="${x-lw}" y1="${y}" x2="${x+lw}" y2="${y}" stroke="#fff" stroke-width="${sw}"/>`;
}
function markerShape(x,y,s=1,color="#ffea00"){
  const r = 15*s, sw = Math.max(2,4*s);
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#17351f" stroke-width="${sw}"/>`;
}
function ladderShape(x,y,s=1,color="#ffffff",r=0){
  const w = 108*s, h = 34*s;
  const railInset = 10*s;
  const stroke = Math.max(3,5*s);
  const rungStroke = Math.max(2,4*s);
  const left = x - w/2, right = x + w/2, top = y - h/2, bottom = y + h/2;
  let rungs = "";
  const count = 5;
  for(let i=1;i<=count;i++){
    const rx = left + (w/(count+1))*i;
    rungs += `<line x1="${rx}" y1="${top+railInset*0.45}" x2="${rx}" y2="${bottom-railInset*0.45}" stroke="${color}" stroke-width="${rungStroke}" stroke-linecap="round"/>`;
  }
  return `<g transform="rotate(${r} ${x} ${y})">
    <line x1="${left}" y1="${top}" x2="${right}" y2="${top}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>
    <line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>
    ${rungs}
  </g>`;
}
function simpleCircleShape(x,y,s=1,color="#ffffff"){
  const r = 28*s, sw = Math.max(2,4*s);
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity=".22" stroke="${color}" stroke-width="${sw}"/>`;
}
function squarePartShape(x,y,s=1,color="#ffffff",r=0){
  const w = 58*s, h = 58*s, sw = Math.max(2,4*s);
  return `<g transform="rotate(${r} ${x} ${y})"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="${8*s}" ry="${8*s}" fill="${color}" fill-opacity=".18" stroke="${color}" stroke-width="${sw}"/></g>`;
}
function hLineShape(x,y,r=0,s=1,color="#ffffff"){
  const len = 120*s, sw = Math.max(4, 9*s);
  return `<g transform="rotate(${r} ${x} ${y})"><line x1="${x-len/2}" y1="${y}" x2="${x+len/2}" y2="${y}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/></g>`;
}
function vLineShape(x,y,r=0,s=1,color="#ffffff"){
  const len = 120*s, sw = Math.max(4, 9*s);
  return `<g transform="rotate(${r} ${x} ${y})"><line x1="${x}" y1="${y-len/2}" x2="${x}" y2="${y+len/2}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/></g>`;
}
function centerLineShape(x,y,r=0,s=1,color="#ffffff"){
  const len = 260*s, sw = Math.max(3, 7*s);
  return `<g transform="rotate(${r} ${x} ${y})"><line x1="${x}" y1="${y-len}" x2="${x}" y2="${y+len}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/></g>`;
}
function centerCircleShape(x,y,r=0,s=1,color="#ffffff"){
  const rr = 76*s, sw = Math.max(3,7*s), dot = Math.max(4,6*s);
  return `<g transform="rotate(${r} ${x} ${y})"><circle cx="${x}" cy="${y}" r="${rr}" fill="none" stroke="${color}" stroke-width="${sw}"/><circle cx="${x}" cy="${y}" r="${dot}" fill="${color}"/></g>`;
}
function soccerPenaltyShape(x,y,r=0,s=1){
  const swMain = Math.max(3,6*s), swSub = Math.max(2,4*s);
  const goalLineX = x - 136*s;
  const outerDepth = 182*s, outerHalfH = 132*s;
  const innerDepth = 62*s, innerHalfH = 50*s;
  const spotX = goalLineX + 110*s;
  const arcR = 70*s;
  const arcStartX = goalLineX + outerDepth;
  return `<g transform="rotate(${r} ${x} ${y})">
    <line x1="${goalLineX}" y1="${y-outerHalfH-10*s}" x2="${goalLineX}" y2="${y+outerHalfH+10*s}" stroke="#fff" stroke-width="${swMain}" stroke-linecap="round"/>
    <path d="M ${goalLineX} ${y-outerHalfH} L ${goalLineX+outerDepth} ${y-outerHalfH} L ${goalLineX+outerDepth} ${y+outerHalfH} L ${goalLineX} ${y+outerHalfH}" fill="none" stroke="#fff" stroke-width="${swMain}" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M ${goalLineX} ${y-innerHalfH} L ${goalLineX+innerDepth} ${y-innerHalfH} L ${goalLineX+innerDepth} ${y+innerHalfH} L ${goalLineX} ${y+innerHalfH}" fill="none" stroke="#fff" stroke-width="${swSub}" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${spotX}" cy="${y}" r="${Math.max(4,5*s)}" fill="#fff"/>
    <path d="M ${arcStartX} ${y-42*s} A ${arcR} ${arcR} 0 0 1 ${arcStartX} ${y+42*s}" fill="none" stroke="#fff" stroke-width="${swSub}" stroke-linecap="round"/>
  </g>`;
}
function futsalGoalAreaShape(x,y,r=0,s=1){
  const sw = Math.max(3,6*s);
  const goalLineX = x - 118*s;
  const topY = y - 76*s;
  const bottomY = y + 76*s;
  const arcX = goalLineX + 82*s;
  const spotX = goalLineX + 76*s;
  return `<g transform="rotate(${r} ${x} ${y})">
    <line x1="${goalLineX}" y1="${y-128*s}" x2="${goalLineX}" y2="${y+128*s}" stroke="#fff" stroke-width="${sw}" stroke-linecap="round"/>
    <path d="M ${goalLineX} ${topY}
             C ${goalLineX+42*s} ${topY} ${arcX} ${y-42*s} ${arcX} ${y}
             C ${arcX} ${y+42*s} ${goalLineX+42*s} ${bottomY} ${goalLineX} ${bottomY}"
          fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${spotX}" cy="${y}" r="${Math.max(3,4*s)}" fill="#fff"/>
  </g>`;
}
function courtAreaShape(x,y,r=0,s=1){
  const type = masters.surfaceType || "soccer";
  return type === "futsal" ? futsalGoalAreaShape(x,y,r,s) : soccerPenaltyShape(x,y,r,s);
}
function goalFrameShape(x,y,r=0,s=1){
  const frontW = 136*s;
  const frontH = 92*s;
  const depthX = 22*s;
  const depthY = 18*s;
  const stroke = Math.max(4, 8*s);
  const netStroke = Math.max(1.3, 2.4*s);
  const innerPad = 14*s;
  const left = x - frontW/2;
  const right = x + frontW/2;
  const top = y - frontH/2;
  const bottom = y + frontH/2;
  const sideTop = top - depthY;
  const sideBottom = bottom + depthY;
  const sideLeft = left - depthX;
  const sideRight = right + depthX;

  const cols = 7;
  const rows = 4;
  let backNet = "";
  for(let i=1;i<cols;i++){
    const vx = left + (frontW/cols)*i;
    backNet += `<line x1="${vx}" y1="${top+innerPad*0.55}" x2="${vx}" y2="${bottom-innerPad*0.55}" stroke="#fff" stroke-width="${netStroke}" stroke-linecap="round"/>`;
  }
  for(let j=1;j<rows;j++){
    const hy = top + (frontH/rows)*j;
    backNet += `<line x1="${left+innerPad*0.55}" y1="${hy}" x2="${right-innerPad*0.55}" y2="${hy}" stroke="#fff" stroke-width="${netStroke}" stroke-linecap="round"/>`;
  }

  let topNet = "";
  for(let i=0;i<7;i++){
    const tx = left + 12*s + i*(frontW-24*s)/6;
    topNet += `<line x1="${tx}" y1="${top}" x2="${tx-depthX*0.72}" y2="${sideTop}" stroke="#fff" stroke-width="${netStroke}" stroke-linecap="round"/>`;
  }
  topNet += `<line x1="${left+8*s}" y1="${top-depthY*0.24}" x2="${right-8*s}" y2="${top-depthY*0.24}" stroke="#fff" stroke-width="${netStroke}" stroke-linecap="round"/>`;

  let leftNet = "";
  let rightNet = "";
  for(let j=1;j<4;j++){
    const ly = top + (frontH/4)*j;
    leftNet += `<line x1="${left}" y1="${ly}" x2="${sideLeft}" y2="${ly + (j-2)*1.5*s}" stroke="#fff" stroke-width="${netStroke}" stroke-linecap="round"/>`;
    rightNet += `<line x1="${right}" y1="${ly}" x2="${sideRight}" y2="${ly + (j-2)*1.5*s}" stroke="#fff" stroke-width="${netStroke}" stroke-linecap="round"/>`;
  }
  for(let i=1;i<3;i++){
    const px = left - (depthX/3)*i;
    leftNet += `<line x1="${px}" y1="${sideTop+8*s}" x2="${px}" y2="${sideBottom-8*s}" stroke="#fff" stroke-width="${netStroke}" stroke-linecap="round"/>`;
    const rx = right + (depthX/3)*i;
    rightNet += `<line x1="${rx}" y1="${sideTop+8*s}" x2="${rx}" y2="${sideBottom-8*s}" stroke="#fff" stroke-width="${netStroke}" stroke-linecap="round"/>`;
  }

  return `<g transform="rotate(${r} ${x} ${y})">
    <path d="M ${left} ${top} L ${sideLeft} ${sideTop} L ${sideRight} ${sideTop} L ${right} ${top}" fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M ${left} ${bottom} L ${left} ${top} L ${right} ${top} L ${right} ${bottom}" fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="${left}" y1="${top}" x2="${sideLeft}" y2="${sideTop}" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round"/>
    <line x1="${left}" y1="${bottom}" x2="${sideLeft}" y2="${sideBottom}" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round"/>
    <line x1="${right}" y1="${top}" x2="${sideRight}" y2="${sideTop}" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round"/>
    <line x1="${right}" y1="${bottom}" x2="${sideRight}" y2="${sideBottom}" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round"/>
    <line x1="${sideLeft}" y1="${sideTop}" x2="${sideLeft}" y2="${sideBottom}" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round"/>
    <line x1="${sideRight}" y1="${sideTop}" x2="${sideRight}" y2="${sideBottom}" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round"/>
    ${backNet}
    ${topNet}
    ${leftNet}
    ${rightNet}
  </g>`;
}
function ballShape(x,y,s=1){
  const r = 17*s, sw = Math.max(1.6,2.6*s);
  const outer = [];
  for(let i=0;i<5;i++){
    const a = -Math.PI/2 + i * Math.PI*2/5;
    outer.push([x + Math.cos(a)*11*s, y + Math.sin(a)*11*s]);
  }
  const centerPent = outer.map(([px,py]) => `${px},${py}`).join(" ");
  const small = [];
  for(let i=0;i<5;i++){
    const a = -Math.PI/2 + i * Math.PI*2/5;
    const ax = x + Math.cos(a)*15.2*s, ay = y + Math.sin(a)*15.2*s;
    const bx = x + Math.cos(a + Math.PI/5)*11*s, by = y + Math.sin(a + Math.PI/5)*11*s;
    const cx = x + Math.cos(a + 2*Math.PI/5)*15.2*s, cy = y + Math.sin(a + 2*Math.PI/5)*15.2*s;
    small.push([[ax,ay],[bx,by],[cx,cy]]);
  }
  return `<g>
    <circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#111" stroke-width="${sw}"/>
    <polygon points="${centerPent}" fill="#111"/>
    ${small.map(poly=>`<polygon points="${poly.map(([px,py])=>`${px},${py}`).join(" ")}" fill="none" stroke="#111" stroke-width="${Math.max(1,1.6*s)}" stroke-linejoin="round"/>`).join("")}
  </g>`;
}
function textShape(x,y,text,s=1){
  const safe = esc(text);
  const fs = Math.max(16, 26*s);
  const w = Math.max(72*s, safe.length * fs * 0.62 + 24*s);
  const h = Math.max(34*s, 38*s);
  return `<g>
    <rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="${10*s}" fill="rgba(0,0,0,.42)" stroke="#fff" stroke-width="${Math.max(2,2*s)}"/>
    <text x="${x}" y="${y + fs*0.18}" text-anchor="middle" font-size="${fs}" font-weight="900" fill="#fff">${safe}</text>
  </g>`;
}
function shapeSvg(o){
  ensureObjectDefaults(o);
  const s = o.s || 1;
  const c = objColor(o);
  if(o.type==="attack") return playerShape(o.x,o.y,c || "#e53935","A","#fff",s,o.r||0);
  if(o.type==="defense") return playerShape(o.x,o.y,c || "#1e88e5","D","#fff",s,o.r||0);
  if(o.type==="free") return playerShape(o.x,o.y,c || "#fdd835","F","#17211b",s,o.r||0);
  if(o.type==="gk") return playerShape(o.x,o.y,c || "#8e99a5","GK","#17211b",s,o.r||0);
  if(o.type==="person") return playerShape(o.x,o.y,c || "#ffffff","","#17211b",s,o.r||0);
  if(o.type==="cone") return coneShape(o.x,o.y,s);
  if(o.type==="marker") return markerShape(o.x,o.y,s,c);
  if(o.type==="ladder") return ladderShape(o.x,o.y,s,c,o.r||0);
  if(o.type==="circlePart") return simpleCircleShape(o.x,o.y,s,c);
  if(o.type==="squarePart") return squarePartShape(o.x,o.y,s,c,o.r||0);
  if(o.type==="hLine") return hLineShape(o.x,o.y,o.r||0,s,c);
  if(o.type==="vLine") return vLineShape(o.x,o.y,o.r||0,s,c);
  if(o.type==="centerLine") return centerLineShape(o.x,o.y,o.r||0,s,c);
  if(o.type==="centerCircle") return centerCircleShape(o.x,o.y,o.r||0,s,c);
  if(o.type==="courtArea") return courtAreaShape(o.x,o.y,o.r||0,s);
  if(o.type==="goalFrame") return goalFrameShape(o.x,o.y,o.r||0,s);
  if(o.type==="ball") return ballShape(o.x,o.y,s);
  if(o.type==="text") return textShape(o.x,o.y,o.text||"テキスト",s);
  if(o.type==="line") return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="${c}" stroke-width="${Math.max(4, 8*(o.s||1))}" stroke-linecap="round"/>`;
  if(o.type==="arrow") return straightArrowSvg(o,false,false);
  if(o.type==="dash") return straightArrowSvg(o,true,false);
  if(o.type==="zigzag") return zigzagArrowSvg(o,false);
  return "";
}
function objectWrapper(o){ ensureObjectDefaults(o); return `<g class="board-object" data-obj-id="${o.id}" data-type="${o.type}">${shapeSvg(o)}</g>`; }
function objectsSvg(list){ return (list||[]).map(objectWrapper).join(""); }

function objectBounds(o){
  ensureObjectDefaults(o);
  const s = o.s || 1;
  if(isLineType(o.type)){
    return {x:Math.min(o.x1,o.x2)-18,y:Math.min(o.y1,o.y2)-18,w:Math.abs(o.x2-o.x1)+36,h:Math.abs(o.y2-o.y1)+36};
  }
  const boxes = {
    attack:[56*s,56*s], defense:[56*s,56*s], free:[56*s,56*s], gk:[56*s,56*s], person:[56*s,56*s], cone:[58*s,58*s], marker:[40*s,40*s], ladder:[130*s,54*s],
    circlePart:[70*s,70*s], squarePart:[72*s,72*s], hLine:[140*s,32*s], vLine:[32*s,140*s],
    centerLine:[80*s,540*s], centerCircle:[170*s,170*s], goalFrame:[142*s,84*s], courtArea:[300*s,310*s],
    ball:[44*s,44*s], text:[Math.max(90*s,(o.text||"テキスト").length*18*s+40), 48*s]
  };
  const wh = boxes[o.type] || [70*s,70*s];
  return {x:o.x - wh[0]/2, y:o.y - wh[1]/2, w:wh[0], h:wh[1]};
}
function selectionSvg(o){
  if(!o) return "";
  if(isLineType(o.type)){
    const cx=(o.x1+o.x2)/2, cy=(o.y1+o.y2)/2;
    return `<g class="selection-ui">
      <line class="selection-line" x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}"/>
      <circle class="sel-handle" data-handle="start" data-obj-id="${o.id}" cx="${o.x1}" cy="${o.y1}" r="13"/>
      <circle class="sel-handle" data-handle="end" data-obj-id="${o.id}" cx="${o.x2}" cy="${o.y2}" r="13"/>
      <circle class="sel-handle" data-handle="mid" data-obj-id="${o.id}" cx="${cx}" cy="${cy}" r="10"/>
    </g>`;
  }
  const b = objectBounds(o);
  return `<g class="selection-ui">
    <rect class="selection-box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="12"/>
    <circle class="sel-handle" data-handle="resize" data-obj-id="${o.id}" cx="${b.x+b.w}" cy="${b.y+b.h}" r="13"/>
  </g>`;
}
function previewDrawingSvg(){
  if(!interaction || interaction.mode !== "drawLine" || !interaction.temp) return "";
  const o = interaction.temp;
  const type = o.type;
  const sw = 7;
  const c = objColor(o);
  if(type==="line") return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>`;
  if(type==="arrow") return straightArrowSvg(o,false,true);
  if(type==="dash") return straightArrowSvg(o,true,true);
  if(type==="zigzag") return zigzagArrowSvg(o,true);
  return "";
}
function selectedLabel(o){
  return o ? `${toolLabelName(o.type)} を選択中` : "未選択";
}
function updateSelectionInfo(){
  const o = getSelectedObject();
  if(el("selectedInfo")) el("selectedInfo").textContent = selectedLabel(o);
  if(el("boardHintLabel")){
    el("boardHintLabel").textContent = o
      ? "ドラッグで移動 / サイズ変更 / 複製 / 削除 / 回転"
      : "空いている場所をタップで配置。置いた後はドラッグ移動。";
  }
  ["sizeDownBtn","sizeUpBtn","duplicateBtn","deleteSelectedBtn"].forEach(id=>{
    if(el(id)) el(id).disabled = !o;
  });
  updateRotation();
}
function renderBoard(){
  normalizeCurrentObjects();
  const selected = getSelectedObject();
  el("board").innerHTML = pitchBase() + objectsSvg(currentObjects()) + previewDrawingSvg() + selectionSvg(selected);
  updateSelectionInfo();
  syncPartColorInput();
}
function saveNotes(){draft.parts[activePart].organize=el("organize").value;draft.parts[activePart].rules=el("rules").value;draft.parts[activePart].coaching=el("coaching").value;}
function loadNotes(){const p=draft.parts[activePart];el("organize").value=p.organize||"";el("rules").value=p.rules||"";el("coaching").value=p.coaching||"";el("noteTitle").textContent=partName(activePart)+"の内容";el("partName").textContent=partName(activePart);}
function setPart(k){saveNotes();activePart=k;interaction=null;selectedObjectId=null;document.querySelectorAll(".part").forEach(b=>b.classList.toggle("active",b.dataset.part===k));loadNotes();renderBoard();}
function toolLabelName(t){
  const isFutsal = (masters.surfaceType || "soccer") === "futsal";
  const names = {
    attack:"攻撃", defense:"守備", free:"フリーマン", gk:"GK", person:"人", cone:"コーン", marker:"マーカー", ladder:"ラダー",
    circlePart:"円", squarePart:"四角", hLine:"横線", vLine:"縦線",
    centerLine:"センターライン", centerCircle:"センターサークル",
    courtArea: isFutsal ? "ゴール前エリア" : "ペナルティエリア",
    goalFrame:"ゴール", goal:"ゴール", penalty: isFutsal ? "ゴール前エリア" : "ペナルティエリア",
    ball:"ボール", text:"テキスト", line:"白線", arrow:"矢印", dash:"点線矢印", zigzag:"ジグザグ矢印"
  };
  return names[t] || t;
}
function renderToolPalette(){
  const isFutsal = (masters.surfaceType || "soccer") === "futsal";
  if(el("toolLabelCenterLine")) el("toolLabelCenterLine").textContent = "センターライン";
  if(el("toolLabelCenterCircle")) el("toolLabelCenterCircle").textContent = "センターサークル";
  if(el("toolLabelCourtArea")) el("toolLabelCourtArea").textContent = isFutsal ? "ゴール前エリア" : "ペナルティエリア";
  if(el("toolLabelGoalFrame")) el("toolLabelGoalFrame").textContent = "ゴール";
  if(el("toolName")) el("toolName").textContent = toolLabelName(activeTool);
}
function setTool(t){
  activeTool=t; interaction=null;
  document.querySelectorAll(".tool").forEach(b=>b.classList.toggle("active",b.dataset.tool===t));
  el("toolName").textContent=toolLabelName(t);
  syncPartColorInput();
}
function syncPartColorInput(){
  const input = el("partColor");
  if(!input) return;
  const o = getSelectedObject();
  const targetType = o ? o.type : activeTool;
  input.disabled = !canChangeColor(targetType);
  input.value = isColorableType(targetType) ? objColor(o || {type:targetType}) : currentPartColor;
}
function changePartColor(value){
  const o = getSelectedObject();
  const targetType = o ? o.type : activeTool;
  if(!canChangeColor(targetType)){
    syncPartColorInput();
    return;
  }
  currentPartColor = value || "#ffffff";
  if(o && isColorableType(o.type)){
    o.color = currentPartColor;
    renderBoard();
  }else{
    syncPartColorInput();
  }
}
function updateRotation(){
  const o = getSelectedObject();
  const value = o ? rotNorm(o.r || 0) : rotNorm(currentRotation);
  if(el("rotationValue")) el("rotationValue").textContent = value + "°";
}
function rotateCurrent(delta){
  const o = getSelectedObject();
  if(o){
    o.r = (o.r || 0) + delta;
    renderBoard();
  }else{
    currentRotation += delta;
    updateRotation();
  }
}
function boardPoint(evt){
  const r = el("board").getBoundingClientRect();
  const cx = evt.clientX ?? (evt.touches && evt.touches[0] && evt.touches[0].clientX) ?? 0;
  const cy = evt.clientY ?? (evt.touches && evt.touches[0] && evt.touches[0].clientY) ?? 0;
  return {x:Math.round((cx-r.left)/r.width*1000), y:Math.round((cy-r.top)/r.height*640)};
}
function createObjectAt(p){
  let obj;
  if(activeTool==="text"){
    const value = prompt("挿入するテキストを入力してください", "ポイント");
    if(!value) return null;
    obj = {id:uid(), type:"text", x:p.x, y:p.y, text:value, r:currentRotation, s:1, color:currentPartColor};
  }else{
    const color = isFixedColorType(activeTool) ? defaultColor(activeTool) : currentPartColor;
    obj = {id:uid(), type:activeTool, x:p.x, y:p.y, r:currentRotation, s:1, color};
  }
  ensureObjectDefaults(obj);
  currentObjects().push(obj);
  selectedObjectId = obj.id;
  return obj;
}
function moveObjectBy(o, dx, dy, base){
  if(isLineType(o.type)){
    o.x1 = base.x1 + dx; o.y1 = base.y1 + dy; o.x2 = base.x2 + dx; o.y2 = base.y2 + dy;
  }else{
    o.x = base.x + dx; o.y = base.y + dy;
  }
}
function scaleSelectedObject(o, factor){
  if(!o) return;
  factor = clamp(factor, 0.4, 3);
  if(isLineType(o.type)){
    const cx = (o.x1 + o.x2) / 2, cy = (o.y1 + o.y2) / 2;
    o.x1 = cx + (o.x1 - cx) * factor;
    o.y1 = cy + (o.y1 - cy) * factor;
    o.x2 = cx + (o.x2 - cx) * factor;
    o.y2 = cy + (o.y2 - cy) * factor;
  }else{
    o.s = clamp((o.s || 1) * factor, 0.45, 3);
  }
}
function boardPointerDown(evt){
  evt.preventDefault();
  normalizeCurrentObjects();
  const p = boardPoint(evt);
  const handle = evt.target.closest("[data-handle]");
  const objEl = evt.target.closest("[data-obj-id]");
  if(handle){
    const id = handle.getAttribute("data-obj-id");
    selectedObjectId = id;
    interaction = {mode:"handle", handle:handle.getAttribute("data-handle"), objectId:id, start:p, snapshot:clone(getObjectById(id))};
    if(el("board").setPointerCapture) el("board").setPointerCapture(evt.pointerId);
    renderBoard();
    return;
  }
  if(objEl){
    const id = objEl.getAttribute("data-obj-id");
    selectedObjectId = id;
    interaction = {mode:"move", objectId:id, start:p, snapshot:clone(getObjectById(id))};
    if(el("board").setPointerCapture) el("board").setPointerCapture(evt.pointerId);
    renderBoard();
    return;
  }
  selectedObjectId = null;
  if(isLineType(activeTool)){
    const end = defaultLineEndPoint(p, activeTool);
    interaction = {mode:"drawLine", temp:{id:uid(), type:activeTool, x1:p.x, y1:p.y, x2:end.x2, y2:end.y2, s:1, color:currentPartColor}, moved:false};
    if(el("board").setPointerCapture) el("board").setPointerCapture(evt.pointerId);
    renderBoard();
    return;
  }
  const obj = createObjectAt(p);
  if(!obj){ renderBoard(); return; }
  interaction = {mode:"move", objectId:obj.id, start:p, snapshot:clone(obj), created:true};
  if(el("board").setPointerCapture) el("board").setPointerCapture(evt.pointerId);
  renderBoard();
}
function boardPointerMove(evt){
  if(!interaction) return;
  const p = boardPoint(evt);
  if(interaction.mode === "drawLine"){
    interaction.moved = true;
    interaction.temp.x2 = p.x; interaction.temp.y2 = p.y;
    renderBoard();
    return;
  }
  const o = getObjectById(interaction.objectId);
  if(!o) return;
  if(interaction.mode === "move"){
    const dx = p.x - interaction.start.x, dy = p.y - interaction.start.y;
    moveObjectBy(o, dx, dy, interaction.snapshot);
    renderBoard();
    return;
  }
  if(interaction.mode === "handle"){
    if(isLineType(o.type)){
      if(interaction.handle === "start"){
        o.x1 = p.x; o.y1 = p.y;
      }else if(interaction.handle === "end"){
        o.x2 = p.x; o.y2 = p.y;
      }else if(interaction.handle === "mid"){
        const dx = p.x - interaction.start.x, dy = p.y - interaction.start.y;
        moveObjectBy(o, dx, dy, interaction.snapshot);
      }
    }else if(interaction.handle === "resize"){
      const cx = interaction.snapshot.x, cy = interaction.snapshot.y;
      const startDist = Math.max(20, Math.hypot(interaction.start.x - cx, interaction.start.y - cy));
      const nowDist = Math.max(20, Math.hypot(p.x - cx, p.y - cy));
      const factor = nowDist / startDist;
      o.s = clamp((interaction.snapshot.s || 1) * factor, 0.45, 3);
    }
    renderBoard();
  }
}
function boardPointerUp(evt){
  if(!interaction) return;
  if(interaction.mode === "drawLine"){
    const t = normalizeLineObject(interaction.temp);
    ensureObjectDefaults(t);
    currentObjects().push(t);
    selectedObjectId = t.id;
    interaction = null;
    renderBoard();
    return;
  }
  interaction = null;
  renderBoard();
}

function boardDoubleClick(evt){
  const objEl = evt.target.closest("[data-obj-id]");
  if(!objEl) return;
  const o = getObjectById(objEl.getAttribute("data-obj-id"));
  if(o && o.type === "text"){
    const value = prompt("テキストを編集", o.text || "");
    if(value !== null){
      o.text = value;
      renderBoard();
    }
  }
}
function addToBoard(evt){ boardPointerDown(evt); }
function deleteSelectedObject(){
  if(!selectedObjectId) return;
  draft.parts[activePart].objects = currentObjects().filter(o => o.id !== selectedObjectId);
  selectedObjectId = null;
  renderBoard();
}
function duplicateSelectedObject(){
  const o = getSelectedObject();
  if(!o) return;
  const c = clone(o);
  c.id = uid();
  if(isLineType(c.type)){
    c.x1 += 24; c.y1 += 24; c.x2 += 24; c.y2 += 24;
  }else{
    c.x += 24; c.y += 24;
  }
  currentObjects().push(c);
  selectedObjectId = c.id;
  renderBoard();
}
function adjustSelectedSize(mult){
  const o = getSelectedObject();
  if(!o) return;
  if(isLineType(o.type)){
    const factor = mult > 1 ? 1.1 : 0.9;
    scaleSelectedObject(o, factor);
  }else{
    o.s = clamp((o.s || 1) * (mult > 1 ? 1.1 : 0.9), 0.45, 3);
  }
  renderBoard();
}

function readMeta(){draft.title=el("planTitle").value.trim();draft.age=el("age").value;draft.category=el("category").value;draft.timePlan=el("timePlan").value;draft.tags=el("tags").value.trim();draft.updatedAt=new Date().toISOString();}
function fillMeta(){el("planTitle").value=draft.title||"";el("age").value=draft.age||masters.ages[0];el("category").value=draft.category||masters.categories[0];el("timePlan").value=draft.timePlan||masters.times[0];el("tags").value=draft.tags||"";}
function newSession(){draft=emptySession();activePart="wup";selectedObjectId=null;interaction=null;fillMeta();setPart("wup");el("editorMode").textContent="指導案作成ページ";page("createPage");}
function editSession(id){const s=sessions.find(x=>x.id===id);if(!s)return;draft=clone(s);activePart="wup";selectedObjectId=null;interaction=null;fillMeta();setPart("wup");el("editorMode").textContent="指導案編集ページ";page("createPage");}
function saveDraft(){saveNotes();readMeta();if(!draft.title){toast("タイトルを入力してください");return;}const i=sessions.findIndex(x=>x.id===draft.id);if(i>=0)sessions[i]=clone(draft);else sessions.unshift(clone(draft));saveAll();renderAll();page("homePage");toast("保存しました");}
function copySession(id){const s=sessions.find(x=>x.id===id);if(!s)return;const c=clone(s);c.id=uid();c.title=(c.title||"無題")+" コピー";c.createdAt=new Date().toISOString();c.updatedAt=new Date().toISOString();sessions.unshift(c);saveAll();renderAll();toast("コピーしました");}
function deleteSession(id){if(!confirm("削除しますか？"))return;sessions=sessions.filter(x=>x.id!==id);saveAll();renderAll();}
function hasPart(p){return (p.objects&&p.objects.length)||p.organize||p.rules||p.coaching;}
function firstPart(s){return PARTS.find(([k])=>s.parts[k].objects.length)?.[0]||"wup";}

function cardHtml(s, compact=false){
  const fp=firstPart(s);
  return `<article class="card" data-id="${s.id}">
    <svg class="preview-svg" viewBox="0 0 1000 640">${pitchBase()}${objectsSvg((s.parts[fp].objects||[]).slice(0,24))}</svg>
    <div class="card-body">
      <div class="badges"><span class="badge">${esc(s.age||"")}</span><span class="badge">${esc(s.category||"")}</span>${splitTags(s.tags).slice(0,compact?2:5).map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div>
      <h3>${esc(s.title||"無題の指導案")}</h3>
      <div class="part-badges">${PARTS.map(([k,n])=>`<span class="badge part-badge">${n}${hasPart(s.parts[k])?" ✓":""}</span>`).join("")}</div>
      <div class="card-actions"><button data-act="preview">プレビュー</button><button data-act="edit">編集</button><button data-act="copy">コピー</button><button class="danger" data-act="delete">削除</button></div>
    </div>
  </article>`;
}

function bindCardActions(root=document){
  root.querySelectorAll("[data-act]").forEach(b=>{b.onclick=()=>{const id=b.closest("[data-id]").dataset.id;const act=b.dataset.act;if(act==="preview")preview(id);if(act==="edit")editSession(id);if(act==="copy")copySession(id);if(act==="delete")deleteSession(id);};});
}

function renderRecent(){
  const recent = yearSessions().slice(0,4);
  el("recentCards").innerHTML = recent.length ? recent.map(s=>cardHtml(s,true)).join("") : `<div class="empty"><h3>まだ指導案がありません</h3><p>新規作成から始めてください。</p></div>`;
  bindCardActions(el("recentCards"));
}

function filteredSessions(){
  const q=el("keyword").value.toLowerCase().trim();
  const pf=el("partFilter").value;
  const cf=el("categoryFilter").value;
  const tf=el("tagFilter").value.toLowerCase().trim();
  return yearSessions().filter(s=>{
    const parts=pf?[s.parts[pf]]:Object.values(s.parts);
    const text=[s.title,s.age,s.category,s.timePlan,s.tags,...parts.flatMap(p=>[p.organize,p.rules,p.coaching])].join(" ").toLowerCase();
    const tags=splitTags(s.tags).map(t=>t.toLowerCase());
    return (!q||text.includes(q)) && (!cf||s.category===cf) && (!tf||tags.some(t=>t.includes(tf)));
  });
}

function renderSearch(){
  const filtered=filteredSessions();
  el("countBadge").textContent=filtered.length+"件";
  el("cards").innerHTML=filtered.length ? filtered.map(s=>cardHtml(s)).join("") : `<div class="empty"><h3>該当する指導案がありません</h3><p>検索条件を変えてください。</p></div>`;
  bindCardActions(el("cards"));
  renderTags();
}

function renderTags(){
  const tags=[...new Set([...masters.tags,...sessions.flatMap(s=>splitTags(s.tags))])].slice(0,30);
  el("tagList").innerHTML=tags.map(t=>`<button class="tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join("");
  document.querySelectorAll("[data-tag]").forEach(b=>{b.onclick=()=>{el("tagFilter").value=b.dataset.tag;renderSearch();page("searchPage");};});
}

function preview(id){
  const s=sessions.find(x=>x.id===id);if(!s)return;
  el("previewBody").innerHTML=`<h2>${esc(s.title)}</h2><div class="badges"><span class="badge">${esc(s.age)}</span><span class="badge">${esc(s.category||"")}</span><span class="badge">${esc(s.timePlan||"")}</span>${splitTags(s.tags).map(t=>`<span class="badge">#${esc(t)}</span>`).join("")}</div><div class="dialog-grid">${PARTS.map(([k,n])=>{const p=s.parts[k];return `<section class="dialog-part"><svg viewBox="0 0 1000 640">${pitchBase()}${objectsSvg(p.objects)}</svg><div class="dialog-text"><h3>${n}</h3>${p.organize?`<p><b>オーガナイズ：</b>${esc(p.organize)}</p>`:""}${p.rules?`<p><b>ルール：</b>${esc(p.rules)}</p>`:""}${p.coaching?`<p><b>コーチング：</b>${esc(p.coaching)}</p>`:""}</div></section>`;}).join("")}</div>`;
  el("previewDialog").showModal();
}

function updateSyncStatus(){el("syncStatus").textContent=(syncSetting.gasUrl&&syncSetting.teamKey)?"同期設定あり：右上の同期からDrive保存・読み込みできます":"Drive未接続：端末内に保存中";}
function openSync(){el("gasUrl").value=syncSetting.gasUrl||"";el("teamKey").value=syncSetting.teamKey||"";el("syncDialog").showModal();}
function saveSyncSetting(){syncSetting={gasUrl:el("gasUrl").value.trim(),teamKey:el("teamKey").value.trim()};saveLocal(SYNC_KEY,syncSetting);updateSyncStatus();toast("同期設定を保存しました");}
async function pushDrive(){saveSyncSetting();if(!syncSetting.gasUrl||!syncSetting.teamKey){toast("URLとチームキーを入力してください");return;}const payload={action:"save",teamKey:syncSetting.teamKey,data:{version:27,updatedAt:new Date().toISOString(),activeYear,sessions,masters,matches,materials}};try{const res=await fetch(syncSetting.gasUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});const json=await res.json();if(!json.ok)throw new Error(json.error||"保存失敗");toast("Driveへ保存しました");}catch(e){alert("Drive保存に失敗しました。URL、チームキー、Apps Scriptのデプロイ設定を確認してください。\n\n"+e.message);}}
async function pullDrive(){saveSyncSetting();if(!syncSetting.gasUrl||!syncSetting.teamKey){toast("URLとチームキーを入力してください");return;}if(sessions.length&&!confirm("Driveのデータでこの端末のデータを置き換えますか？"))return;try{const url=syncSetting.gasUrl+"?action=load&teamKey="+encodeURIComponent(syncSetting.teamKey);const res=await fetch(url);const json=await res.json();if(!json.ok)throw new Error(json.error||"読み込み失敗");sessions=(json.data&&json.data.sessions)||[];matches=(json.data&&json.data.matches)||[];materials=(json.data&&json.data.materials)||[];masters={...defaultMasters, ...((json.data&&json.data.masters)||masters)};activeYear=normalizeYear((json.data&&json.data.activeYear)||activeYear);ensureYears();migrateYearFields();applyYearMaster(activeYear);saveAll();saveMatches();saveMaterials();saveMasters();refreshMastersUI();renderAll();toast("Driveから読み込みました");}catch(e){alert("Drive読み込みに失敗しました。URL、チームキー、Apps Scriptのデプロイ設定を確認してください。\n\n"+e.message);}}
function downloadJson(){const blob=new Blob([JSON.stringify({version:27,updatedAt:new Date().toISOString(),activeYear,sessions,masters,matches,materials},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="TeamBoard-data.json";a.click();URL.revokeObjectURL(a.href);}



function todayISO(){
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function num(id){
  return Math.max(0, Number(el(id).value || 0));
}

let lineupState = { official:{}, officialSubs:[], officialBench:[], trm:{} };
let goalEventState = [];

function emptyLineupState(){ return { official:{}, officialSubs:[], officialBench:[], trm:{} }; }
function playerLabel(p){ return `#${p.number} ${p.name}`; }
function getPlayers(){ return Array.isArray(masters.players) ? masters.players : []; }
function sortedPlayers(){ return [...getPlayers()].sort((a,b)=>Number(a.number)-Number(b.number) || String(a.name).localeCompare(String(b.name), "ja")); }
function playerById(id){ return getPlayers().find(p=>p.id===id); }
function currentMatchSurface(){ return el("matchSurface") ? (el("matchSurface").value || "soccer") : "soccer"; }
function formationPitchLines(surface="soccer"){
  let stripes = "";
  for(let x=0;x<1000;x+=100){
    stripes += `<rect x="${x}" y="0" width="50" height="640" fill="rgba(255,255,255,.05)"/>`;
  }
  const base = `<rect x="0" y="0" width="1000" height="640" fill="#11813e"/>${stripes}
    <rect x="24" y="24" width="952" height="592" rx="28" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
    <line x1="500" y1="24" x2="500" y2="616" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
    <circle cx="500" cy="320" r="80" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
    <circle cx="500" cy="320" r="4" fill="#fff"/>`;
  if(surface === "futsal"){
    return base + `
      <path d="M 24 240 C 92 240 130 276 130 320 C 130 364 92 400 24 400" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      <path d="M 976 240 C 908 240 870 276 870 320 C 870 364 908 400 976 400" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>`;
  }
  return base + `
    <rect x="24" y="180" width="156" height="280" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
    <rect x="820" y="180" width="156" height="280" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
    <rect x="24" y="255" width="54" height="130" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
    <rect x="922" y="255" width="54" height="130" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>`;
}
function currentMatchType(){ return el("matchType") ? (el("matchType").value || "official") : "official"; }
function currentTrmCount(){ return Math.max(3, Math.min(6, Number(el("trmCount")?.value || 3))); }
function currentGroupKeys(){
  if(currentMatchType()==="trm") return Array.from({length:currentTrmCount()},(_,i)=>`trm_${i+1}`);
  return ["official_start"];
}
function lineupGroupTitle(key){
  if(key==="official_start") return "スタメン";
  if(key==="official_subs") return "交代選手";
  const m = String(key).match(/trm_(\d+)/);
  return m ? `${m[1]}本メンバー` : key;
}
function ensureLineupState(){
  if(!lineupState || typeof lineupState !== "object") lineupState = emptyLineupState();
  if(!lineupState.official || typeof lineupState.official !== "object") lineupState.official = {};
  if(!Array.isArray(lineupState.officialSubs)) lineupState.officialSubs = [];
  if(!Array.isArray(lineupState.officialBench)) lineupState.officialBench = [];
  if(!lineupState.trm || typeof lineupState.trm !== "object") lineupState.trm = {};
}
function normalizePlayerDeleteInLineup(id){
  ensureLineupState();
  Object.keys(lineupState.official).forEach(k=>{
    if(lineupState.official[k] && lineupState.official[k].playerId === id) lineupState.official[k].playerId = "";
  });
  lineupState.officialSubs.forEach(s=>{ if(s.playerId === id) s.playerId = ""; });
  Object.values(lineupState.trm).forEach(group=>{
    if(group && typeof group === "object"){
      Object.keys(group).forEach(k=>{ if(group[k] && group[k].playerId === id) group[k].playerId = ""; });
    }
  });
}
function addPlayerMaster(){
  const number = String(el("playerNumberInput").value || "").trim();
  const name = el("playerNameInput").value.trim();
  if(!number || !name){
    toast("背番号と名前を入力してください");
    return;
  }
  if(getPlayers().some(p => String(p.number) === number)){
    toast("同じ背番号の選手がいます");
    return;
  }
  masters.players.push({id:uid(), number, name});
  persistCurrentYearMaster();
  saveMasters();
  renderPlayerMasterList();
  renderPlayerStats();
  renderGoalEventInputs();
  renderStarterAssignments();
  el("playerNumberInput").value = "";
  el("playerNameInput").value = "";
  toast("選手を登録しました");
}
function deletePlayerMaster(id){
  if(!confirm("この選手を削除しますか？")) return;
  masters.players = getPlayers().filter(p => p.id !== id);
  normalizePlayerDeleteInLineup(id);
  persistCurrentYearMaster();
  saveMasters();
  renderPlayerMasterList();
  renderPlayerStats();
  renderGoalEventInputs();
  renderStarterAssignments();
  toast("選手を削除しました");
}
function formationRoleNames(count){
  if(count === 2) return ["DF","FW"];
  if(count === 3) return ["DF","MF","FW"];
  if(count === 4) return ["DF","MF","AM","FW"];
  if(count === 5) return ["DF","DM","CM","AM","FW"];
  return Array.from({length:count},(_,i)=>`L${i+1}`);
}
function parseFormation(v){
  const nums = String(v || "").split(/[‐‑‒–—―ー－-]+/).map(x=>Number(x.trim())).filter(n=>Number.isFinite(n) && n > 0);
  return nums.length ? nums : [4,4,2];
}
function getFormationSlots(value){
  const lines = parseFormation(value);
  const roles = formationRoleNames(lines.length);
  const slots = [{slotId:"GK1", label:"GK"}];
  lines.forEach((count, lineIdx)=>{
    const role = roles[lineIdx] || `L${lineIdx+1}`;
    for(let i=1;i<=count;i++){
      slots.push({slotId:`${role}${i}`, label:`${role}${i}`});
    }
  });
  return slots;
}
function optionsHtml(selected, usedIds=[]){
  const players = sortedPlayers();
  const used = new Set((usedIds || []).filter(Boolean));
  return `<option value="">未選択</option>` + players.map(p => {
    const isSelected = selected === p.id;
    const disabled = used.has(p.id) && !isSelected ? "disabled" : "";
    return `<option value="${p.id}" ${isSelected ? "selected" : ""} ${disabled}>${esc(playerLabel(p))}${disabled ? "（選択済み）" : ""}</option>`;
  }).join("");
}
function usedIdsInObject(obj, exceptSlotId=""){
  return Object.values(obj || {})
    .filter(v => v && v.playerId && v.slotId !== exceptSlotId)
    .map(v => v.playerId);
}
function officialUsedIdsExcept(kind="", key=""){
  ensureLineupState();
  const ids = [];
  Object.values(lineupState.official || {}).forEach(v=>{
    if(v && v.playerId && !(kind==="starter" && v.slotId===key)) ids.push(v.playerId);
  });
  (lineupState.officialSubs || []).forEach(v=>{
    if(v && v.playerId && !(kind==="sub" && v.id===key)) ids.push(v.playerId);
  });
  (lineupState.officialBench || []).forEach(v=>{
    if(v && v.playerId && !(kind==="bench" && v.id===key)) ids.push(v.playerId);
  });
  return ids;
}
function hasDuplicateIds(ids){
  const seen = new Set();
  for(const id of ids.filter(Boolean)){
    if(seen.has(id)) return id;
    seen.add(id);
  }
  return "";
}
function validateLineupDuplicates(){
  ensureLineupState();
  if(currentMatchType()==="official"){
    const starterIds = Object.values(lineupState.official || {}).map(v=>v && v.playerId).filter(Boolean);
    const subIds = (lineupState.officialSubs || []).map(v=>v && v.playerId).filter(Boolean);
    const benchIds = (lineupState.officialBench || []).map(v=>v && v.playerId).filter(Boolean);
    const dup = hasDuplicateIds([...starterIds, ...subIds, ...benchIds]);
    if(dup){
      Object.keys(lineupState.official || {}).forEach(k=>{
        if(lineupState.official[k].playerId === dup) lineupState.official[k].playerId = "";
      });
      lineupState.officialSubs = (lineupState.officialSubs || []).map(s => s.playerId === dup ? {...s, playerId:"", number:"", name:""} : s);
      lineupState.officialBench = (lineupState.officialBench || []).map(s => s.playerId === dup ? {...s, playerId:"", number:"", name:""} : s);
      const p = playerById(dup);
      toast(`${p ? playerLabel(p) : "同じ選手"} が重複しているため解除しました`);
      return false;
    }
    return true;
  }
  for(const key of currentGroupKeys()){
    const group = lineupState.trm[key] || {};
    const ids = Object.values(group).map(v=>v && v.playerId).filter(Boolean);
    const dup = hasDuplicateIds(ids);
    if(dup){
      Object.keys(group).forEach(k=>{
        if(group[k].playerId === dup) group[k].playerId = "";
      });
      lineupState.trm[key] = group;
      const p = playerById(dup);
      toast(`${lineupGroupTitle(key)}で ${p ? playerLabel(p) : "同じ選手"} が重複しているため解除しました`);
      return false;
    }
  }
  return true;
}
function lineupEntryFromSelect(playerId, slot){
  const p = playerById(playerId);
  return {
    slotId: slot.slotId,
    label: slot.label,
    playerId: playerId || "",
    number: p ? p.number : "",
    name: p ? p.name : ""
  };
}
function captureStarterStateFromDOM(){
  ensureLineupState();
  if(currentMatchType()==="official"){
    const official = {};
    document.querySelectorAll("[data-lineup-group='official_start'][data-starter-slot]").forEach(sel=>{
      const slot = {slotId:sel.dataset.starterSlot, label:sel.dataset.slotLabel || sel.dataset.starterSlot};
      official[slot.slotId] = lineupEntryFromSelect(sel.value || "", slot);
    });
    lineupState.official = official;
    lineupState.officialBench = Array.from(document.querySelectorAll("[data-bench-row]")).map(row=>{
      const playerId = row.querySelector("[data-bench-player]")?.value || "";
      const p = playerById(playerId);
      return {
        id: row.dataset.benchRow || uid(),
        label: row.dataset.benchLabel || "",
        playerId,
        number: p ? p.number : "",
        name: p ? p.name : ""
      };
    }).filter(s=>s.playerId);
    lineupState.officialSubs = Array.from(document.querySelectorAll("[data-sub-row]")).map(row=>{
      const playerId = row.querySelector("[data-sub-player]")?.value || "";
      const p = playerById(playerId);
      return {
        id: row.dataset.subRow || uid(),
        playerId,
        number: p ? p.number : "",
        name: p ? p.name : "",
        minute: row.querySelector("[data-sub-minute]")?.value || "",
        position: row.querySelector("[data-sub-position]")?.value || ""
      };
    }).filter(s=>s.playerId || s.minute || s.position);
  }else{
    const trm = {};
    document.querySelectorAll("[data-lineup-group^='trm_'][data-starter-slot]").forEach(sel=>{
      const group = sel.dataset.lineupGroup;
      const slot = {slotId:sel.dataset.starterSlot, label:sel.dataset.slotLabel || sel.dataset.starterSlot};
      if(!trm[group]) trm[group] = {};
      trm[group][slot.slotId] = lineupEntryFromSelect(sel.value || "", slot);
    });
    lineupState.trm = trm;
  }
}
function setStarterStateFromSaved(startersOrLineup, subs){
  lineupState = emptyLineupState();
  if(startersOrLineup && startersOrLineup.official || startersOrLineup && startersOrLineup.trm){
    lineupState = {
      official: startersOrLineup.official || {},
      officialSubs: startersOrLineup.officialSubs || [],
      officialBench: startersOrLineup.officialBench || [],
      trm: startersOrLineup.trm || {}
    };
    return;
  }
  (startersOrLineup || []).forEach(s=>{
    if(s && s.slotId) lineupState.official[s.slotId] = {...s};
  });
  lineupState.officialSubs = subs || [];
}
function renderPlayerMasterList(){
  const list = el("playerMasterList");
  if(!list) return;
  const players = sortedPlayers();
  list.innerHTML = players.length ? players.map(p => `
    <div class="player-master-row">
      <span>${esc(playerLabel(p))}</span>
      <button type="button" class="danger small-btn" data-delete-player="${esc(p.id)}">削除</button>
    </div>
  `).join("") : `<div class="no-player-note">選手を登録すると、試合結果のメンバー設定に表示されます。</div>`;
  document.querySelectorAll("[data-delete-player]").forEach(btn=>{
    btn.onclick = () => deletePlayerMaster(btn.dataset.deletePlayer);
  });
}
function renderLineupGroup(groupKey, stateObj){
  const slots = getFormationSlots(el("formationInput").value);
  const groupUsed = stateObj || {};
  return `<section class="member-group" data-member-group="${esc(groupKey)}">
    <div class="member-group-title">${esc(lineupGroupTitle(groupKey))}</div>
    <div class="member-grid">
      ${slots.map(slot=>{
        const selected = stateObj?.[slot.slotId]?.playerId || "";
        const usedIds = currentMatchType()==="official"
          ? officialUsedIdsExcept("starter", slot.slotId)
          : usedIdsInObject(groupUsed, slot.slotId);
        return `<div class="starter-row member-row">
          <span class="slot-label">${esc(slot.label)}</span>
          <select data-lineup-group="${esc(groupKey)}" data-starter-slot="${esc(slot.slotId)}" data-slot-label="${esc(slot.label)}">
            ${optionsHtml(selected, usedIds)}
          </select>
        </div>`;
      }).join("")}
    </div>
  </section>`;
}

function renderOfficialBench(){
  ensureLineupState();
  const rows = Array.from({length:10},(_,i)=>{
    const saved = (lineupState.officialBench || [])[i] || {};
    return {id:saved.id || `bench_${i+1}`, label:`ベンチ${i+1}`, playerId:saved.playerId || ""};
  });
  return `<section class="member-group official-bench-group">
    <div class="member-group-title"><span>ベンチメンバー 10人</span></div>
    <div class="member-grid bench-grid">
      ${rows.map((s,i)=>`
        <div class="starter-row member-row" data-bench-row="${esc(s.id)}" data-bench-label="${esc(s.label)}">
          <span class="slot-label">${esc(s.label)}</span>
          <select data-bench-player>${optionsHtml(s.playerId || "", officialUsedIdsExcept("bench", s.id || ""))}</select>
        </div>
      `).join("")}
    </div>
  </section>`;
}

function renderOfficialSubs(){
  const subs = lineupState.officialSubs || [];
  const rows = subs.length ? subs : [{id:uid(), playerId:"", minute:"", position:""}];
  return `<section class="member-group official-sub-group">
    <div class="member-group-title">
      <span>交代選手</span>
      <button type="button" id="addSubRowBtn" class="small-btn">＋ 交代追加</button>
    </div>
    <div class="sub-grid">
      ${rows.map((s,i)=>`
        <div class="sub-row" data-sub-row="${esc(s.id || uid())}">
          <label>選手
            <select data-sub-player>${optionsHtml(s.playerId || "", officialUsedIdsExcept("sub", s.id || ""))}</select>
          </label>
          <label>時間
            <input data-sub-minute type="text" placeholder="例：58分" value="${esc(s.minute || "")}">
          </label>
          <label>変更後ポジション
            <input data-sub-position type="text" placeholder="例：右SH / FW" value="${esc(s.position || "")}">
          </label>
          <button type="button" class="danger small-btn" data-remove-sub="${esc(s.id || "")}">削除</button>
        </div>
      `).join("")}
    </div>
  </section>`;
}
function bindLineupInputs(){
  document.querySelectorAll("[data-starter-slot], [data-sub-player], [data-bench-player]").forEach(elm=>{
    elm.onchange = ()=>{
      captureStarterStateFromDOM();
      const ok = validateLineupDuplicates();
      if(!ok){
        renderStarterAssignments();
        return;
      }
      renderStarterAssignments();
    };
  });
  document.querySelectorAll("[data-sub-minute], [data-sub-position]").forEach(elm=>{
    elm.oninput = ()=>{ captureStarterStateFromDOM(); renderFormationPreview(); };
    elm.onchange = ()=>{ captureStarterStateFromDOM(); renderFormationPreview(); };
  });
  const addBtn = el("addSubRowBtn");
  if(addBtn){
    addBtn.onclick = ()=>{
      captureStarterStateFromDOM();
      lineupState.officialSubs.push({id:uid(), playerId:"", minute:"", position:""});
      renderStarterAssignments();
    };
  }
  document.querySelectorAll("[data-remove-sub]").forEach(btn=>{
    btn.onclick = ()=>{
      captureStarterStateFromDOM();
      const id = btn.closest("[data-sub-row]")?.dataset.subRow;
      lineupState.officialSubs = (lineupState.officialSubs || []).filter(s=>s.id !== id);
      renderStarterAssignments();
    };
  });
}
function renderStarterAssignments(){
  ensureLineupState();
  const wrap = el("starterAssignList");
  const preview = el("formationPreview");
  const title = el("lineupSettingTitle");
  if(!wrap || !preview) return;
  captureStarterStateFromDOM();
  const players = sortedPlayers();

  if(!players.length){
    wrap.innerHTML = `<div class="no-player-note">設定ページで選手登録をすると、ここでメンバーを選択できます。</div>`;
    if(title) title.textContent = currentMatchType()==="trm" ? "TRMメンバー設定" : "スタメン / 交代設定";
    renderFormationPreview();
    return;
  }

  if(currentMatchType()==="trm"){
    if(title) title.textContent = "TRMメンバー設定";
    const keys = currentGroupKeys();
    wrap.innerHTML = `<div class="lineup-mode-note">TRMはスタメンではなく、本数ごとのメンバーを登録します。</div>` +
      keys.map(key => renderLineupGroup(key, lineupState.trm[key] || {})).join("");
  }else{
    if(title) title.textContent = "スタメン / 交代設定";
    wrap.innerHTML = renderLineupGroup("official_start", lineupState.official || {}) + renderOfficialBench() + renderOfficialSubs();
  }
  bindLineupInputs();
  renderFormationPreview();
}
function buildFormationCoords(formationValue){
  const lines = parseFormation(formationValue);
  const totalRows = lines.length + 1;
  const coords = [{slotId:"GK1", label:"GK", x:120, y:320}];
  const roles = formationRoleNames(lines.length);
  lines.forEach((count, i)=>{
    const x = totalRows === 1 ? 500 : 150 + ((i+1) * 700 / (totalRows-1));
    const maxSpread = Math.min(440, 115 * Math.max(1, count - 1));
    const startY = 320 - maxSpread / 2;
    for(let k=0; k<count; k++){
      const y = count === 1 ? 320 : startY + (k * (maxSpread / (count-1)));
      coords.push({slotId:`${roles[i]}${k+1}`, label:`${roles[i]}${k+1}`, x, y});
    }
  });
  return coords;
}
function selectedEntriesForPreview(groupKey){
  ensureLineupState();
  const stateObj = currentMatchType()==="trm"
    ? (lineupState.trm[groupKey] || {})
    : (lineupState.official || {});
  return buildFormationCoords(el("formationInput").value).map(pos=>{
    const entry = stateObj[pos.slotId] || {};
    return {
      ...pos,
      playerId: entry.playerId || "",
      number: entry.number || "",
      name: entry.name || ""
    };
  });
}
function formationPreviewSvg(groupKey){
  const coords = selectedEntriesForPreview(groupKey);
  const playersSvg = coords.map(p => `
    <g transform="translate(${p.x},${p.y})">
      <circle cx="0" cy="0" r="27" fill="${p.number ? "#ffffff" : "rgba(255,255,255,.22)"}" stroke="#102d1c" stroke-width="3"/>
      <text x="0" y="7" text-anchor="middle" font-size="20" font-weight="900" fill="#102d1c">${esc(p.number || p.label)}</text>
      <text x="0" y="48" text-anchor="middle" font-size="14" font-weight="800" fill="#ffffff">${esc(p.name || "")}</text>
    </g>
  `).join("");
  return `
    <svg viewBox="0 0 1000 640" aria-label="formation preview">
      ${formationPitchLines(currentMatchSurface())}
      ${playersSvg}
    </svg>
  `;
}
function renderFormationPreview(){
  const box = el("formationPreview");
  if(!box) return;
  if(currentMatchType()==="trm"){
    const keys = currentGroupKeys();
    box.innerHTML = `<div class="preview-title">本数ごとの配置プレビュー</div>
      <div class="trm-preview-grid">
        ${keys.map(key => `<section class="formation-preview-card">
          <h5>${esc(lineupGroupTitle(key))}</h5>
          ${formationPreviewSvg(key)}
        </section>`).join("")}
      </div>`;
    return;
  }
  box.innerHTML = `
    <div class="preview-title">スタメン配置プレビュー</div>
    <div class="formation-preview-card official-preview-card">
      ${formationPreviewSvg("official_start")}
    </div>
  `;
}
function collectLineupFromState(){
  ensureLineupState();
  if(currentMatchType()==="trm"){
    return {trm: clone(lineupState.trm || {})};
  }
  return {official: clone(lineupState.official || {}), officialBench: clone(lineupState.officialBench || []), officialSubs: clone(lineupState.officialSubs || [])};
}
function collectStartersFromState(){
  ensureLineupState();
  const src = currentMatchType()==="trm" ? (lineupState.trm["trm_1"] || {}) : (lineupState.official || {});
  return Object.values(src).filter(s=>s && s.playerId);
}
function getScoreLabels(type, count){
  if(type === "official") return ["前半", "後半"];
  const n = Math.max(3, Math.min(6, Number(count || 3)));
  return Array.from({length:n}, (_,i)=>`${i+1}本目`);
}
function readDynamicScores(){
  const labels = getScoreLabels(el("matchType").value, el("trmCount").value);
  return labels.map((label, i)=>({
    label,
    own: Math.max(0, Number((el(`scoreOwn_${i}`)?.value) || 0)),
    opp: Math.max(0, Number((el(`scoreOpp_${i}`)?.value) || 0))
  }));
}
function updateMatchTotal(){
  const scores = readDynamicScores();
  const own = scores.reduce((a,b)=>a + Number(b.own || 0), 0);
  const opp = scores.reduce((a,b)=>a + Number(b.opp || 0), 0);
  el("totalScore").textContent = `${own} - ${opp}`;
  el("resultLabel").textContent = own > opp ? "WIN" : own < opp ? "LOSE" : "DRAW";
}
function renderScoreInputs(prefill){
  const type = el("matchType").value;
  const count = el("trmCount").value;
  const labels = getScoreLabels(type, count);
  el("trmCountWrap").style.display = type === "trm" ? "grid" : "none";
  el("matchScoreNote").textContent = type === "official"
    ? "公式戦は 前半 / 後半 のスコアを入力します。"
    : "TRMは 3〜6本 を選択して、本数ごとのスコアを入力します。";

  const oldScores = prefill?.scores || readDynamicScores();
  const map = {};
  oldScores.forEach((s, i)=>{ map[s.label || i] = s; });

  el("dynamicScoreGrid").innerHTML = labels.map((label, i)=> {
    const src = map[label] || oldScores[i] || {own:0, opp:0};
    return `
      <div class="score-box">
        <h3>${esc(label)}</h3>
        <label>自チーム
          <input id="scoreOwn_${i}" type="number" min="0" value="${Number(src.own || 0)}">
        </label>
        <label>相手
          <input id="scoreOpp_${i}" type="number" min="0" value="${Number(src.opp || 0)}">
        </label>
      </div>
    `;
  }).join("") + `
    <div class="score-box total-score-box">
      <h3>合計</h3>
      <div id="totalScore" class="total-score">0 - 0</div>
      <p id="resultLabel" class="result-label">DRAW</p>
    </div>
  `;

  labels.forEach((_,i)=>{
    el(`scoreOwn_${i}`).oninput = updateMatchTotal;
    el(`scoreOpp_${i}`).oninput = updateMatchTotal;
  });
  updateMatchTotal();
  renderGoalEventInputs();
}

function playerOptionHtml(selected){
  const players = sortedPlayers();
  return `<option value="">未選択</option>` + players.map(p=>`<option value="${p.id}" ${selected===p.id ? "selected" : ""}>${esc(playerLabel(p))}</option>`).join("");
}
function scoreLabelOptions(selected){
  const labels = getScoreLabels(el("matchType").value, el("trmCount").value);
  return labels.map(label=>`<option value="${esc(label)}" ${selected===label ? "selected" : ""}>${esc(label)}</option>`).join("");
}
function normalizeGoalEvent(e={}){
  return {
    id: e.id || uid(),
    period: e.period || getScoreLabels(el("matchType").value, el("trmCount").value)[0] || "",
    minute: e.minute || "",
    scorerId: e.scorerId || "",
    assistId: e.assistId || "",
    note: e.note || ""
  };
}

function addGoalEvent(){
  captureGoalEventStateFromDOM();
  goalEventState.push(normalizeGoalEvent({}));
  renderGoalEventInputs();
}

function renderGoalEventInputs(){
  const wrap = el("goalEventList");
  if(!wrap) return;
  if(!goalEventState.length) goalEventState = [normalizeGoalEvent({})];
  const players = sortedPlayers();
  if(!players.length){
    wrap.innerHTML = `<div class="no-player-note">設定ページで選手登録をすると、得点者・アシストを選択できます。</div>`;
    return;
  }
  wrap.innerHTML = goalEventState.map((e, i)=>{
    const ev = normalizeGoalEvent(e);
    return `<div class="goal-event-row" data-goal-event="${esc(ev.id)}">
      <label>区分
        <select data-goal-period>${scoreLabelOptions(ev.period)}</select>
      </label>
      <label>時間
        <input data-goal-minute type="text" placeholder="例：23分" value="${esc(ev.minute)}">
      </label>
      <label>得点
        <select data-goal-scorer>${playerOptionHtml(ev.scorerId)}</select>
      </label>
      <label>アシスト
        <select data-goal-assist>${playerOptionHtml(ev.assistId)}</select>
      </label>
      <label>メモ
        <input data-goal-note type="text" placeholder="例：CK / PK" value="${esc(ev.note)}">
      </label>
      <button type="button" class="danger small-btn" data-remove-goal-event>削除</button>
    </div>`;
  }).join("");
  document.querySelectorAll("[data-goal-event]").forEach(row=>{
    const save = ()=>captureGoalEventStateFromDOM();
    row.querySelectorAll("select,input").forEach(inp=>{
      inp.onchange = save;
      inp.oninput = save;
    });
    const del = row.querySelector("[data-remove-goal-event]");
    if(del){
      del.onclick = ()=>{
        const id = row.dataset.goalEvent;
        goalEventState = goalEventState.filter(e=>e.id !== id);
        if(!goalEventState.length) goalEventState = [normalizeGoalEvent({})];
        renderGoalEventInputs();
      };
    }
  });
}
function captureGoalEventStateFromDOM(){
  const rows = Array.from(document.querySelectorAll("[data-goal-event]"));
  goalEventState = rows.map(row=>({
    id: row.dataset.goalEvent || uid(),
    period: row.querySelector("[data-goal-period]")?.value || "",
    minute: row.querySelector("[data-goal-minute]")?.value || "",
    scorerId: row.querySelector("[data-goal-scorer]")?.value || "",
    assistId: row.querySelector("[data-goal-assist]")?.value || "",
    note: row.querySelector("[data-goal-note]")?.value || ""
  })).filter(e=>e.scorerId || e.assistId || e.minute || e.note);
}
function readGoalEvents(){
  captureGoalEventStateFromDOM();
  return goalEventState.map(e=>{
    const scorer = playerById(e.scorerId);
    const assist = playerById(e.assistId);
    return {
      id: e.id || uid(),
      period: e.period || "",
      minute: e.minute || "",
      scorerId: e.scorerId || "",
      scorerNumber: scorer ? scorer.number : "",
      scorerName: scorer ? scorer.name : "",
      assistId: e.assistId || "",
      assistNumber: assist ? assist.number : "",
      assistName: assist ? assist.name : "",
      note: e.note || ""
    };
  }).filter(e=>e.scorerId || e.assistId || e.minute || e.note);
}
function setGoalEventsFromSaved(events=[]){
  goalEventState = (events || []).map(e=>normalizeGoalEvent({
    id: e.id,
    period: e.period,
    minute: e.minute,
    scorerId: e.scorerId,
    assistId: e.assistId,
    note: e.note
  }));
  if(!goalEventState.length) goalEventState = [normalizeGoalEvent({})];
}
function playerPlaytimeTextForMatch(match, playerId){
  const type = match.matchType || "official";
  if(type === "trm"){
    const n = Math.max(3, Math.min(6, Number(match.trmCount || 3)));
    const labels = [];
    for(let i=1;i<=n;i++){
      const key = `trm_${i}`;
      const items = lineupEntriesForMatch(match, key);
      if(items.some(p=>p.playerId === playerId)) labels.push(`${i}本目`);
    }
    return labels.join(" / ");
  }
  const starters = lineupEntriesForMatch(match, "official_start");
  const subs = match.lineup?.officialSubs || match.subs || [];
  if(starters.some(p=>p.playerId === playerId)) return "スタメン";
  const sub = subs.find(p=>p.playerId === playerId);
  if(sub) return `交代 ${sub.minute || ""}${sub.position ? " / " + sub.position : ""}`.trim();
  return "";
}
function buildPlayerStats(){
  const stats = {};
  const scopedMatches = yearMatches();
  sortedPlayers().forEach(p=>{
    stats[p.id] = {player:p, goals:0, assists:0, playtime:[], matches:0};
  });
  matches.forEach(m=>{
    (m.goalEvents || []).forEach(e=>{
      if(e.scorerId && stats[e.scorerId]) stats[e.scorerId].goals += 1;
      if(e.assistId && stats[e.assistId]) stats[e.assistId].assists += 1;
    });
    Object.keys(stats).forEach(pid=>{
      const pt = playerPlaytimeTextForMatch(m, pid);
      if(pt){
        stats[pid].matches += 1;
        stats[pid].playtime.push(`${m.date || "-"} ${m.name || ""}${m.opponent ? " vs " + m.opponent : ""}: ${pt}`);
      }
    });
  });
  return Object.values(stats);
}
function renderPlayerStats(){
  const wrap = el("playerStatsList");
  const badge = el("playerStatsCountBadge");
  if(!wrap) return;
  const stats = buildPlayerStats();
  if(badge) badge.textContent = stats.length + "人";
  wrap.innerHTML = stats.length ? `<div class="player-stats-table">
    <div class="player-stats-head">
      <span>選手</span><span>得点</span><span>アシスト</span><span>プレータイム</span>
    </div>
    ${stats.map(s=>`<div class="player-stats-row">
      <span class="player-name-cell">${esc(playerLabel(s.player))}</span>
      <span>${s.goals}</span>
      <span>${s.assists}</span>
      <span class="playtime-cell">${s.playtime.length ? esc(s.playtime.join(" / ")) : "-"}</span>
    </div>`).join("")}
  </div>` : `<div class="empty"><h3>選手が登録されていません</h3><p>設定ページで背番号と名前を登録してください。</p></div>`;
}
function goalEventsBlock(m){
  const events = m.goalEvents || [];
  if(!events.length) return "";
  return `<div class="goal-events-block">
    <h4>得点 / アシスト</h4>
    <div class="goal-event-chips">
      ${events.map(e=>`<span class="goal-event-chip">
        ${e.period ? esc(e.period) + " " : ""}${e.minute ? esc(e.minute) + " " : ""}
        得点 ${e.scorerNumber ? "#" + esc(e.scorerNumber) + " " : ""}${esc(e.scorerName || "-")}
        ${e.assistId ? ` / A ${e.assistNumber ? "#" + esc(e.assistNumber) + " " : ""}${esc(e.assistName || "-")}` : ""}
        ${e.note ? ` / ${esc(e.note)}` : ""}
      </span>`).join("")}
    </div>
  </div>`;
}

function videoUrlIds(){ return [1,2,3,4,5,6].map(i=>`videoUrl${i}`); }
function clearVideoInputs(){
  videoUrlIds().forEach(id=>{ if(el(id)) el(id).value = ""; });
}
function readVideoUrls(){
  const urls = videoUrlIds().map(id=>el(id)?.value.trim() || "");
  return urls.filter(Boolean);
}
function setVideoInputs(m={}){
  const urls = Array.isArray(m.videoUrls) ? m.videoUrls : (m.videoUrl ? [m.videoUrl] : []);
  videoUrlIds().forEach((id,i)=>{ if(el(id)) el(id).value = urls[i] || ""; });
}
function videoButtonsBlock(m){
  const urls = Array.isArray(m.videoUrls) && m.videoUrls.length ? m.videoUrls : (m.videoUrl ? [m.videoUrl] : []);
  const buttons = urls.slice(0,6).map((url,i)=> url ? `<a class="video-link video-chip" href="${esc(url)}" target="_blank" rel="noopener noreferrer">動画${"①②③④⑤⑥"[i] || (i+1)}</a>` : "").join("");
  return buttons ? `<div class="video-buttons">${buttons}</div>` : "";
}
function clearMatchForm(){
  el("matchId").value = "";
  el("matchType").value = "official";
  el("matchName").value = "公式戦";
  el("matchSurface").value = "soccer";
  el("matchCategory").value = masters.ages[0] || "U-12";
  el("opponentName").value = "";
  el("matchDate").value = todayISO();
  clearVideoInputs();
  el("trmCount").value = "3";
  el("formationInput").value = "4-4-2";
  el("matchMemo").value = "";
  lineupState = emptyLineupState();
  goalEventState = [normalizeGoalEvent({})];
  renderScoreInputs({scores:[{label:"前半",own:0,opp:0},{label:"後半",own:0,opp:0}]});
  renderGoalEventInputs();
  renderStarterAssignments();
}
function readMatchForm(){
  captureStarterStateFromDOM();
  validateLineupDuplicates();
  const scores = readDynamicScores();
  const totalOwn = scores.reduce((a,b)=>a+Number(b.own||0),0);
  const totalOpp = scores.reduce((a,b)=>a+Number(b.opp||0),0);
  const lineup = collectLineupFromState();
  const starters = collectStartersFromState();
  const goalEvents = readGoalEvents();
  const videoUrls = readVideoUrls();
  return {
    id: el("matchId").value || uid(),
    year: activeYear,
    matchType: el("matchType").value || "official",
    matchSurface: el("matchSurface").value || "soccer",
    name: el("matchName").value.trim() || (el("matchType").value === "trm" ? "TRM" : "公式戦"),
    category: el("matchCategory").value || "",
    opponent: el("opponentName").value.trim(),
    date: el("matchDate").value || todayISO(),
    trmCount: Number(el("trmCount").value || 3),
    scores,
    firstOwn: scores[0]?.own ?? 0,
    firstOpp: scores[0]?.opp ?? 0,
    secondOwn: scores[1]?.own ?? 0,
    secondOpp: scores[1]?.opp ?? 0,
    totalOwn,
    totalOpp,
    formation: el("formationInput").value.trim() || "4-4-2",
    lineup,
    starters,
    subs: lineup.officialSubs || [],
    goalEvents,
    videoUrls,
    videoUrl: videoUrls[0] || "",
    memo: el("matchMemo").value.trim(),
    updatedAt: new Date().toISOString()
  };
}
function saveMatch(){
  const item = readMatchForm();
  item.year = activeYear;
  const i = matches.findIndex(m => m.id === item.id);
  if(i >= 0) matches[i] = item;
  else matches.unshift(item);
  saveMatches();
  renderMatches();
  renderPlayerStats();
  clearMatchForm();
  clearMaterialForm();
  toast("試合結果を保存しました");
}
function editMatch(id){
  const m = matches.find(x => x.id === id);
  if(!m) return;
  el("matchId").value = m.id;
  el("matchType").value = m.matchType || "official";
  el("matchSurface").value = m.matchSurface || "soccer";
  el("matchName").value = m.name || ((m.matchType === "trm") ? "TRM" : "公式戦");
  el("matchCategory").value = m.category || masters.ages[0] || "";
  el("opponentName").value = m.opponent || "";
  el("matchDate").value = m.date || todayISO();
  setVideoInputs(m);
  el("trmCount").value = String(m.trmCount || 3);
  el("formationInput").value = m.formation || "4-4-2";
  el("matchMemo").value = m.memo || "";
  setStarterStateFromSaved(m.lineup || m.starters || [], m.subs || []);
  const scores = m.scores?.length ? m.scores : [
    {label:"前半", own:m.firstOwn ?? 0, opp:m.firstOpp ?? 0},
    {label:"後半", own:m.secondOwn ?? 0, opp:m.secondOpp ?? 0}
  ];
  setGoalEventsFromSaved(m.goalEvents || []);
  renderScoreInputs({scores});
  renderGoalEventInputs();
  renderStarterAssignments();
  page("resultsPage");
}

function copyMatchLineupOnly(id){
  const m = matches.find(x => x.id === id);
  if(!m) return;
  clearMatchForm();
  el("matchId").value = "";
  el("matchType").value = m.matchType || "official";
  el("matchSurface").value = m.matchSurface || "soccer";
  el("matchName").value = (m.matchType === "trm") ? "TRM" : "公式戦";
  el("matchCategory").value = m.category || masters.ages[0] || "";
  el("opponentName").value = "";
  el("matchDate").value = todayISO();
  clearVideoInputs();
  el("trmCount").value = String(m.trmCount || 3);
  el("formationInput").value = m.formation || "4-4-2";
  el("matchMemo").value = "";
  const copiedLineup = m.lineup ? clone(m.lineup) : {official:{}, officialBench:[], officialSubs:[], trm:{}};
  if(copiedLineup.officialSubs) copiedLineup.officialSubs = [];
  setStarterStateFromSaved(copiedLineup, []);
  setGoalEventsFromSaved([]);
  renderScoreInputs();
  renderGoalEventInputs();
  renderStarterAssignments();
  page("resultsPage");
  toast("メンバーとフォーメーションをコピーしました");
}

function deleteMatch(id){
  if(!confirm("この試合結果を削除しますか？")) return;
  matches = matches.filter(m => m.id !== id);
  saveMatches();
  renderMatches();
  renderPlayerStats();
}
function resultText(m){
  return m.totalOwn > m.totalOpp ? "勝ち" : m.totalOwn < m.totalOpp ? "負け" : "引き分け";
}
function matchScoreBadges(m){
  const scores = m.scores?.length ? m.scores : [
    {label:"前半", own:m.firstOwn ?? 0, opp:m.firstOpp ?? 0},
    {label:"後半", own:m.secondOwn ?? 0, opp:m.secondOpp ?? 0}
  ];
  return scores.map(s => `<span class="badge">${esc(s.label)} ${s.own} - ${s.opp}</span>`).join("") + `<span class="badge">合計 ${m.totalOwn} - ${m.totalOpp}</span>`;
}
function lineupEntriesForMatch(match, groupKey){
  if(match.lineup){
    if(groupKey==="official_start") return Object.values(match.lineup.official || {}).filter(s=>s && s.playerId);
    if(groupKey==="official_bench") return (match.lineup.officialBench || []).filter(s=>s && s.playerId);
    if(groupKey.startsWith("trm_")) return Object.values((match.lineup.trm || {})[groupKey] || {}).filter(s=>s && s.playerId);
  }
  if(groupKey==="official_start") return (match.starters || []).filter(s=>s && s.playerId);
  return [];
}
function miniFormationSVG(match, groupKey="official_start"){
  if(!match.formation) return "";
  const coords = buildFormationCoords(match.formation);
  const starters = {};
  lineupEntriesForMatch(match, groupKey).forEach(s=>{ if(s && s.slotId) starters[s.slotId] = s; });
  const body = coords.map(p=>{
    const st = starters[p.slotId] || {};
    const number = st.number || "";
    const name = st.name || "";
    return `<g transform="translate(${p.x},${p.y})">
      <circle cx="0" cy="0" r="24" fill="${number ? "#ffffff" : "rgba(255,255,255,.22)"}" stroke="#102d1c" stroke-width="3"/>
      <text x="0" y="6" text-anchor="middle" font-size="18" font-weight="900" fill="#102d1c">${esc(number || p.label)}</text>
      <text x="0" y="40" text-anchor="middle" font-size="13" font-weight="800" fill="#ffffff">${esc(name)}</text>
    </g>`;
  }).join("");
  return `<div class="mini-lineup-board"><svg viewBox="0 0 1000 640">
      ${formationPitchLines(match.matchSurface || "soccer")}
      ${body}
    </svg></div>`;
}
function lineupChipList(items, emptyText="未登録"){
  const arr = (items || []).filter(s => s && s.playerId && s.number && s.name);
  return arr.length ? `<div class="lineup-chip-row">${arr.map(s => `<span class="lineup-chip">#${esc(s.number)} ${esc(s.name)}${s.position ? ` / ${esc(s.position)}` : ""}${s.minute ? ` / ${esc(s.minute)}` : ""}</span>`).join("")}</div>` : `<p class="lineup-empty-small">${esc(emptyText)}</p>`;
}
function matchLineupBlock(m){
  if(!(m.formation || "").trim()) return "";
  if((m.matchType || "official") === "trm"){
    const n = Math.max(3, Math.min(6, Number(m.trmCount || 3)));
    return `<div class="match-lineup">
      <div><span class="lineup-formation-badge">${esc(m.formation)}</span><span class="lineup-formation-badge">${(m.matchSurface || "soccer") === "futsal" ? "フットサル" : "サッカー"}</span></div>
      <div class="match-trm-groups">
        ${Array.from({length:n},(_,i)=>{
          const key = `trm_${i+1}`;
          const items = lineupEntriesForMatch(m, key);
          return `<section class="saved-member-group">
            <h4>${i+1}本メンバー</h4>
            ${i===0 ? miniFormationSVG(m, key) : ""}
            ${lineupChipList(items)}
          </section>`;
        }).join("")}
      </div>
    </div>`;
  }
  const starters = lineupEntriesForMatch(m, "official_start");
  const bench = m.lineup?.officialBench || [];
  const subs = m.lineup?.officialSubs || m.subs || [];
  return `<div class="match-lineup">
    <div><span class="lineup-formation-badge">${esc(m.formation)}</span><span class="lineup-formation-badge">${(m.matchSurface || "soccer") === "futsal" ? "フットサル" : "サッカー"}</span></div>
    ${miniFormationSVG(m, "official_start")}
    <section class="saved-member-group"><h4>スタメン</h4>${lineupChipList(starters)}</section>
    <section class="saved-member-group"><h4>ベンチ</h4>${lineupChipList(bench, "ベンチ登録なし")}</section>
    <section class="saved-member-group"><h4>交代選手</h4>${lineupChipList(subs, "交代選手なし")}</section>
  </div>`;
}
function starterChips(match){
  return matchLineupBlock(match);
}
function renderMatches(){
  const scopedMatches = yearMatches();
  el("matchCountBadge").textContent = scopedMatches.length + "件";
  el("matchList").innerHTML = scopedMatches.length ? scopedMatches.map(m => `
    <article class="match-card" data-match-id="${m.id}">
      <div class="match-card-head">
        <div>
          <h3>${esc(m.name || "TRM")}${m.opponent ? ` vs ${esc(m.opponent)}` : ""}</h3>
          <div class="badges">
            <span class="badge">${esc(itemYear(m))}</span>\n            <span class="badge">${(m.matchSurface || "soccer") === "futsal" ? "フットサル" : "サッカー"}</span>
            <span class="badge match-type-badge ${esc(m.matchType || "official")}">${m.matchType === "trm" ? "TRM" : "公式戦"}</span>
            <span class="badge">対象 ${esc(m.category || "-")}</span>
            ${m.opponent ? `<span class="badge">相手 ${esc(m.opponent)}</span>` : ""}
            <span class="badge">${esc(m.date || "-")}</span>
            <span class="badge">${resultText(m)}</span>
          </div>
        </div>
        <div class="match-score">${m.totalOwn} - ${m.totalOpp}</div>
      </div>
      <div class="match-breakdown">
        ${matchScoreBadges(m)}
      </div>
      ${goalEventsBlock(m)}
      ${matchLineupBlock(m)}
      ${videoButtonsBlock(m)}
      ${m.memo ? `<div class="match-memo">${esc(m.memo)}</div>` : ""}
      <div class="card-actions">
        <button data-match-act="edit">編集</button>
        <button data-match-act="copy">コピー</button>
        <button class="danger" data-match-act="delete">削除</button>
      </div>
    </article>
  `).join("") : `<div class="empty"><h3>まだ試合結果がありません</h3><p>試合名・スコア・スタメン・メモを入力して保存してください。</p></div>`;
  document.querySelectorAll("[data-match-act]").forEach(b => {
    b.onclick = () => {
      const id = b.closest("[data-match-id]").dataset.matchId;
      if(b.dataset.matchAct === "edit") editMatch(id);
      if(b.dataset.matchAct === "copy") copyMatchLineupOnly(id);
      if(b.dataset.matchAct === "delete") deleteMatch(id);
    };
  });
}


let pendingMaterialFile = null;

function formatBytes(bytes){
  if(!bytes && bytes !== 0) return "";
  const units = ["B","KB","MB"];
  let v = Number(bytes);
  let i = 0;
  while(v >= 1024 && i < units.length-1){ v /= 1024; i++; }
  return `${v.toFixed(i===0?0:1)} ${units[i]}`;
}
function materialFileType(name="", mime=""){
  const lower = String(name).toLowerCase();
  if(mime.includes("pdf") || lower.endsWith(".pdf")) return "PDF";
  if(lower.endsWith(".ppt") || lower.endsWith(".pptx") || mime.includes("powerpoint") || mime.includes("presentation")) return "PPT";
  return "FILE";
}
function clearMaterialForm(){
  el("materialId").value = "";
  el("materialTitle").value = "";
  el("materialCategory").value = masters.ages[0] || "U-12";
  el("materialDate").value = todayISO();
  el("materialMemo").value = "";
  el("materialFileInput").value = "";
  pendingMaterialFile = null;
  el("materialFileInfo").textContent = "ファイル未選択";
}
function handleMaterialFile(file){
  if(!file) return;
  const allowed = [".pdf",".ppt",".pptx"];
  const ok = allowed.some(ext => file.name.toLowerCase().endsWith(ext));
  if(!ok){
    alert("PDF / PowerPoint（.pdf / .ppt / .pptx）のみ保存できます。");
    el("materialFileInput").value = "";
    pendingMaterialFile = null;
    el("materialFileInfo").textContent = "ファイル未選択";
    return;
  }
  const maxBytes = 12 * 1024 * 1024;
  if(file.size > maxBytes){
    alert("ファイルが大きすぎます。端末保存・Drive同期の安定性のため、12MB以下を目安にしてください。");
    el("materialFileInput").value = "";
    pendingMaterialFile = null;
    el("materialFileInfo").textContent = "ファイル未選択";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingMaterialFile = {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      dataUrl: reader.result,
      fileType: materialFileType(file.name, file.type || "")
    };
    el("materialFileInfo").textContent = `${pendingMaterialFile.fileType}：${file.name} / ${formatBytes(file.size)}`;
  };
  reader.readAsDataURL(file);
}
function readMaterialForm(){
  const existing = el("materialId").value ? materials.find(m => m.id === el("materialId").value) : null;
  const file = pendingMaterialFile || (existing ? {
    fileName: existing.fileName,
    mimeType: existing.mimeType,
    size: existing.size,
    dataUrl: existing.dataUrl,
    fileType: existing.fileType
  } : null);
  return {
    id: el("materialId").value || uid(),
    year: activeYear,
    title: el("materialTitle").value.trim() || (file ? file.fileName : "無題の資料"),
    category: el("materialCategory").value || "",
    date: el("materialDate").value || todayISO(),
    memo: el("materialMemo").value.trim(),
    fileName: file?.fileName || "",
    mimeType: file?.mimeType || "",
    size: file?.size || 0,
    dataUrl: file?.dataUrl || "",
    fileType: file?.fileType || "FILE",
    updatedAt: new Date().toISOString()
  };
}
function saveMaterial(){
  const item = readMaterialForm();
  item.year = activeYear;
  if(!item.dataUrl){
    toast("PDFまたはPowerPointを選択してください");
    return;
  }
  const i = materials.findIndex(m => m.id === item.id);
  if(i >= 0) materials[i] = item;
  else materials.unshift(item);
  saveMaterials();
  renderMaterials();
  clearMaterialForm();
  toast("資料を保存しました");
}
function editMaterial(id){
  const m = materials.find(x => x.id === id);
  if(!m) return;
  el("materialId").value = m.id;
  el("materialTitle").value = m.title || "";
  el("materialCategory").value = m.category || masters.ages[0] || "";
  el("materialDate").value = m.date || todayISO();
  el("materialMemo").value = m.memo || "";
  el("materialFileInput").value = "";
  pendingMaterialFile = null;
  el("materialFileInfo").textContent = `${m.fileType || materialFileType(m.fileName,m.mimeType)}：${m.fileName || "保存済みファイル"} / ${formatBytes(m.size)}`;
  page("materialsPage");
}
function deleteMaterial(id){
  if(!confirm("この資料を削除しますか？")) return;
  materials = materials.filter(m => m.id !== id);
  saveMaterials();
  renderMaterials();
}
function renderMaterials(){
  if(!el("materialCountBadge")) return;
  const scopedMaterials = yearMaterials();
  el("materialCountBadge").textContent = scopedMaterials.length + "件";
  el("materialList").innerHTML = scopedMaterials.length ? scopedMaterials.map(m => `
    <article class="material-card" data-material-id="${m.id}">
      <div class="material-card-head">
        <div>
          <h3>${esc(m.title || "無題の資料")}</h3>
          <div class="badges">
            <span class="badge">${esc(itemYear(m))}</span>\n            <span class="badge">対象 ${esc(m.category || "-")}</span>\n            <span class="badge">${esc(m.date || "-")}</span>
            <span class="badge">${esc(m.fileName || "-")}</span>
          </div>
        </div>
        <span class="material-file-type">${esc(m.fileType || materialFileType(m.fileName,m.mimeType))}</span>
      </div>
      <a class="material-link" href="${m.dataUrl}" target="_blank" rel="noopener noreferrer" download="${esc(m.fileName || "material")}">${(m.fileType === "PDF") ? "PDFを開く / 保存" : "PowerPointを保存"}</a>
      <div class="material-size-note">${esc(m.fileName || "")} ${m.size ? " / " + formatBytes(m.size) : ""}</div>
      ${m.memo ? `<div class="material-memo">${esc(m.memo)}</div>` : ""}
      <div class="card-actions">
        <button data-material-act="edit">編集</button>
        <button class="danger" data-material-act="delete">削除</button>
      </div>
    </article>
  `).join("") : `<div class="empty"><h3>まだ資料がありません</h3><p>PDFやPowerPointを選択して保存してください。</p></div>`;
  document.querySelectorAll("[data-material-act]").forEach(b => {
    b.onclick = () => {
      const id = b.closest("[data-material-id]").dataset.materialId;
      if(b.dataset.materialAct === "edit") editMaterial(id);
      if(b.dataset.materialAct === "delete") deleteMaterial(id);
    };
  });
}


function sample(){

  const s=emptySession();s.title="前進するためのサポート";s.age="U-12";s.category="攻撃";s.timePlan="60分";s.tags="攻撃, 前進, 少人数";
  s.parts.wup.objects=[{type:"attack",x:250,y:260},{type:"attack",x:390,y:260},{type:"defense",x:320,y:350},{type:"cone",x:190,y:210},{type:"cone",x:450,y:410},{type:"arrow",x1:250,y1:260,x2:390,y2:260}];
  s.parts.wup.organize="12m×12m。攻撃2人、守備1人。";s.parts.wup.rules="5本つなげたら1点。守備が奪ったら交代。";s.parts.wup.coaching="受ける前に観る。パス後に角度を変える。";
  s.parts.tr1.objects=[{type:"attack",x:220,y:320},{type:"attack",x:390,y:220},{type:"attack",x:390,y:420},{type:"defense",x:530,y:320},{type:"ball",x:220,y:320},{type:"dash",x1:390,y1:220,x2:620,y2:230},{type:"arrow",x1:220,y1:320,x2:390,y2:220}];
  s.parts.tr1.organize="3対1。前方ゲートを設定。";s.parts.tr1.rules="3本以内に前方ゲートを通過。";s.parts.tr1.coaching="ボール保持者を助ける角度を作る。";
  s.parts.tr2.objects=[{type:"attack",x:260,y:240},{type:"attack",x:260,y:400},{type:"free",x:500,y:320},{type:"defense",x:390,y:300},{type:"defense",x:650,y:320},{type:"line",x1:500,y1:80,x2:500,y2:560}];
  s.parts.tr2.organize="4対2＋フリーマン。中央ラインを越えたら1点。";s.parts.tr2.rules="フリーマンは攻撃側。奪ったら逆方向へ攻撃。";
  s.parts.game.objects=[{type:"attack",x:350,y:180},{type:"attack",x:350,y:320},{type:"attack",x:350,y:460},{type:"defense",x:620,y:180},{type:"defense",x:620,y:320},{type:"defense",x:620,y:460},{type:"ball",x:350,y:320}];
  s.parts.game.organize="6対6。ゴール付き。";s.parts.game.rules="中央レーンを使って前進できたら得点2倍。";
  return s;
}

function renderAll(){ensureYears();migrateYearFields();renderYearSelects();bindYearSwitch();renderSurface();renderToolPalette();renderLogo();renderRecent();renderSearch();renderTags();renderPlayerMasterList();renderPlayerStats();renderMatches();renderMaterials();updateSyncStatus();}

document.addEventListener("DOMContentLoaded",()=>{
  if(!sessions.length){sessions=[sample()];saveAll();}
  if(!Array.isArray(masters.players)) masters.players = [];
  if(!Array.isArray(materials)) materials = [];
  ensureYears();
  migrateYearFields();
  applyYearMaster(activeYear);
  saveMasters();

  refreshMastersUI();

  document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>page(b.dataset.page));

  el("homeCreateBtn").onclick=newSession;
  el("goSearchBtn").onclick=()=>page("searchPage");
  el("homeSearchBtn").onclick=()=>page("searchPage");
  el("homeResultsBtn").onclick=()=>page("resultsPage");
  if(el("homeMaterialsBtn")) el("homeMaterialsBtn").onclick=()=>page("materialsPage");
  bindYearSwitch();

  el("settingsOpenBtn").onclick=()=>page("settingsPage");
  el("syncOpenBtn").onclick=openSync;

  el("newBlankBtn").onclick=newSession;
  el("saveBtn").onclick=saveDraft;

  el("board").addEventListener("pointerdown", boardPointerDown);
  el("board").addEventListener("pointermove", boardPointerMove);
  el("board").addEventListener("pointerup", boardPointerUp);
  el("board").addEventListener("pointercancel", boardPointerUp);
  el("board").addEventListener("dblclick", boardDoubleClick);

  el("undoBtn").onclick=()=>{
    if(selectedObjectId){ deleteSelectedObject(); return; }
    draft.parts[activePart].objects.pop();
    renderBoard();
  };
  el("clearBtn").onclick=()=>{
    if(confirm("図をクリアしますか？")){
      draft.parts[activePart].objects=[];
      selectedObjectId=null;
      interaction=null;
      renderBoard();
    }
  };
  el("sizeDownBtn").onclick=()=>adjustSelectedSize(0.9);
  el("sizeUpBtn").onclick=()=>adjustSelectedSize(1.1);
  el("duplicateBtn").onclick=duplicateSelectedObject;
  el("deleteSelectedBtn").onclick=deleteSelectedObject;
  el("rotateLeftBtn").onclick=()=>rotateCurrent(-45);
  el("rotateRightBtn").onclick=()=>rotateCurrent(45);

  document.querySelectorAll(".part").forEach(b=>b.onclick=()=>setPart(b.dataset.part));
  document.querySelectorAll(".tool").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));

  ["keyword","partFilter","categoryFilter","tagFilter"].forEach(id=>{
    el(id).oninput=renderSearch;
    el(id).onchange=renderSearch;
  });
  el("clearSearchBtn").onclick=()=>{
    el("keyword").value="";
    el("partFilter").value="";
    el("categoryFilter").value="";
    el("tagFilter").value="";
    renderSearch();
  };

  el("saveMastersBtn").onclick=readMastersUI;
  if(el("rolloverYearBtn")) el("rolloverYearBtn").onclick=rolloverYear;
  el("surfaceType").onchange=()=>{
    masters.surfaceType=el("surfaceType").value;
    saveMasters();
    renderAll();
    renderBoard();
    toast("コート仕様を変更しました");
  };

  // 選手登録
  el("addPlayerBtn").onclick=addPlayerMaster;
  el("playerNumberInput").addEventListener("keydown", e=>{ if(e.key==="Enter") addPlayerMaster(); });
  el("playerNameInput").addEventListener("keydown", e=>{ if(e.key==="Enter") addPlayerMaster(); });

  // 試合結果
  el("newMatchBtn").onclick=clearMatchForm;
  el("saveMatchBtn").onclick=saveMatch;
  el("matchType").onchange=()=>{
    if(!el("matchName").value || el("matchName").value==="TRM" || el("matchName").value==="公式戦"){
      el("matchName").value = el("matchType").value==="trm" ? "TRM" : "公式戦";
    }
    renderScoreInputs();
    renderStarterAssignments();
  };
  el("trmCount").onchange=()=>{ renderScoreInputs(); renderStarterAssignments(); };
  el("formationInput").oninput=()=>renderStarterAssignments();
  el("matchSurface").onchange=()=>renderFormationPreview();
  if(el("addGoalEventBtn")) el("addGoalEventBtn").onclick=addGoalEvent;
  el("partColor").oninput=(e)=>changePartColor(e.target.value);

  // 資料
  el("clearMaterialFormBtn").onclick=clearMaterialForm;
  el("saveMaterialBtn").onclick=saveMaterial;
  el("materialFileInput").onchange=(e)=>handleMaterialFile(e.target.files[0]);

  // ロゴ
  el("logoFileInput").onchange=(e)=>setLogoFromFile(e.target.files[0]);
  el("clearLogoBtn").onclick=clearLogo;

  // 同期
  el("saveSyncSettingBtn").onclick=saveSyncSetting;
  el("pushBtn").onclick=pushDrive;
  el("pullBtn").onclick=pullDrive;
  el("downloadBtn").onclick=downloadJson;

  setTool("attack");
  updateRotation();
  renderBoard();
  renderAll();
  clearMatchForm();
  clearMaterialForm();
  renderStarterAssignments();
});
