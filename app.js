
const DATA_KEY = "teamboard-v5-data";
const MASTER_KEY = "teamboard-v5-masters";
const MATCH_KEY = "teamboard-v9-matches";
const MATERIAL_KEY = "teamboard-v21-materials";
const SYNC_KEY = "teamboard-v5-sync";
const PARTS = [["wup","W-up"],["tr1","TR1"],["tr2","TR2"],["game","Game"]];

const defaultMasters = {
  tags: ["攻撃","守備","前進","少人数","ポゼッション","フィニッシュ","ビルドアップ","トランジション","雨の日"],
  times: ["60分","75分","90分","W-up 10 / TR1 20 / TR2 20 / Game 10","W-up 15 / TR1 20 / TR2 25 / Game 20"],
  categories: ["攻撃","守備","ポゼッション","フィニッシュ","ビルドアップ","トランジション","ウォーミングアップ","ゲーム"],
  ages: ["U-8","U-10","U-12","U-15","U-18","一般"],
  logoData: "teamboard-logo.png",
  surfaceType: "soccer",
  players: []
};

let sessions = loadLocal(DATA_KEY, []);
let matches = loadLocal(MATCH_KEY, []);
let materials = loadLocal(MATERIAL_KEY, []);
let masters = loadLocal(MASTER_KEY, defaultMasters);
if(!Array.isArray(masters.players)) masters.players = [];
let syncSetting = loadLocal(SYNC_KEY, {gasUrl:"", teamKey:""});
let draft = emptySession();
let activePart = "wup";
let activeTool = "attack";
let pending = null;
let currentRotation = 0;

const el = id => document.getElementById(id);

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
  masters.logoData = (masters.logoData === undefined || masters.logoData === null) ? "teamboard-logo.png" : masters.logoData;
  masters.surfaceType = el("surfaceType").value || "soccer";
  if(!Array.isArray(masters.players)) masters.players = [];
  saveMasters();
  refreshMastersUI();
  renderTags();
  toast("マスタを保存しました");
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
  const map = {attack:1,defense:1,free:1,cone:1,marker:1,centerLine:1,centerCircle:1,courtArea:1,goalFrame:1,goal:1,penalty:1,ball:1,text:1,line:1,arrow:1,dash:1};
  return map[type] || 1;
}
function isLineType(type){ return ["line","arrow","dash"].includes(type); }
function currentObjects(){ return draft.parts[activePart].objects; }
let selectedObjectId = null;
let interaction = null;

function ensureObjectDefaults(o){
  if(!o.id) o.id = uid();
  if(o.r == null) o.r = 0;
  if(o.s == null) o.s = defaultScale(o.type);
  if(o.type === "goal") o.type = "goalFrame";
  if(o.type === "penalty") o.type = "courtArea";
  return o;
}
function normalizeCurrentObjects(){ currentObjects().forEach(ensureObjectDefaults); }
function getObjectById(id){ normalizeCurrentObjects(); return currentObjects().find(o => o.id === id); }
function getSelectedObject(){ return selectedObjectId ? getObjectById(selectedObjectId) : null; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function rotNorm(v){ return ((v % 360) + 360) % 360; }

function playerShape(x,y,color,label,text="#fff",s=1){
  const r = 24*s, sw = Math.max(2, 5*s), fs = Math.max(12, 20*s);
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#fff" stroke-width="${sw}"/><text x="${x}" y="${y + 0.3*fs}" text-anchor="middle" font-size="${fs}" font-weight="900" fill="${text}">${label}</text>`;
}
function coneShape(x,y,s=1){
  const h = 28*s, w = 24*s, sw = Math.max(2,4*s), lw = 13*s;
  return `<path d="M${x} ${y-h} L${x-w} ${y+w} L${x+w} ${y+w} Z" fill="#ff7a00" stroke="#fff" stroke-width="${sw}"/><line x1="${x-lw}" y1="${y}" x2="${x+lw}" y2="${y}" stroke="#fff" stroke-width="${sw}"/>`;
}
function markerShape(x,y,s=1){
  const r = 15*s, sw = Math.max(2,4*s);
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffea00" stroke="#17351f" stroke-width="${sw}"/>`;
}
function centerLineShape(x,y,r=0,s=1){
  const len = 260*s, sw = Math.max(3, 7*s);
  return `<g transform="rotate(${r} ${x} ${y})"><line x1="${x}" y1="${y-len}" x2="${x}" y2="${y+len}" stroke="#fff" stroke-width="${sw}" stroke-linecap="round"/></g>`;
}
function centerCircleShape(x,y,r=0,s=1){
  const rr = 76*s, sw = Math.max(3,7*s), dot = Math.max(4,6*s);
  return `<g transform="rotate(${r} ${x} ${y})"><circle cx="${x}" cy="${y}" r="${rr}" fill="none" stroke="#fff" stroke-width="${sw}"/><circle cx="${x}" cy="${y}" r="${dot}" fill="#fff"/></g>`;
}
function goalFrameShape(x,y,r=0,s=1){
  const w = 124*s, h = 58*s, sw = Math.max(3,7*s), mesh = Math.max(1.5,2.4*s);
  const left = x - w/2, top = y - h/2;
  return `<g transform="rotate(${r} ${x} ${y})">
    <path d="M ${left} ${top+h} L ${left} ${top} L ${left+w} ${top} L ${left+w} ${top+h}" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
    <g opacity=".6">
      <line x1="${left+18*s}" y1="${top+8*s}" x2="${left+18*s}" y2="${top+h-2*s}" stroke="#fff" stroke-width="${mesh}"/>
      <line x1="${left+w/2}" y1="${top+5*s}" x2="${left+w/2}" y2="${top+h-2*s}" stroke="#fff" stroke-width="${mesh}"/>
      <line x1="${left+w-18*s}" y1="${top+8*s}" x2="${left+w-18*s}" y2="${top+h-2*s}" stroke="#fff" stroke-width="${mesh}"/>
      <line x1="${left+2*s}" y1="${top+18*s}" x2="${left+w-2*s}" y2="${top+18*s}" stroke="#fff" stroke-width="${mesh}"/>
      <line x1="${left+2*s}" y1="${top+36*s}" x2="${left+w-2*s}" y2="${top+36*s}" stroke="#fff" stroke-width="${mesh}"/>
    </g>
  </g>`;
}
function soccerPenaltyShape(x,y,r=0,s=1){
  const swMain = Math.max(3,7*s), swSub = Math.max(2,5*s);
  const goalLineX = x - 110*s;
  const boxDepth = 182*s;
  const boxHalfH = 132*s;
  const goalAreaDepth = 62*s;
  const goalAreaHalfH = 64*s;
  const spotX = goalLineX + 80*s;
  const arcR = 64*s;
  return `<g transform="rotate(${r} ${x} ${y})">
    <line x1="${goalLineX}" y1="${y-boxHalfH}" x2="${goalLineX}" y2="${y+boxHalfH}" stroke="#fff" stroke-width="${swMain}" stroke-linecap="round"/>
    <path d="M ${goalLineX} ${y-boxHalfH} L ${goalLineX+boxDepth} ${y-boxHalfH} L ${goalLineX+boxDepth} ${y+boxHalfH} L ${goalLineX} ${y+boxHalfH}" fill="none" stroke="#fff" stroke-width="${swMain}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M ${goalLineX} ${y-goalAreaHalfH} L ${goalLineX+goalAreaDepth} ${y-goalAreaHalfH} L ${goalLineX+goalAreaDepth} ${y+goalAreaHalfH} L ${goalLineX} ${y+goalAreaHalfH}" fill="none" stroke="#fff" stroke-width="${swSub}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${spotX}" cy="${y}" r="${Math.max(4,5*s)}" fill="#fff"/>
    <path d="M ${spotX+arcR*Math.cos(-0.92)} ${y+arcR*Math.sin(-0.92)}
             A ${arcR} ${arcR} 0 0 1 ${spotX+arcR*Math.cos(0.92)} ${y+arcR*Math.sin(0.92)}"
          fill="none" stroke="#fff" stroke-width="${swSub}" stroke-linecap="round"/>
  </g>`;
}
function futsalGoalAreaShape(x,y,r=0,s=1){
  const swMain = Math.max(3,7*s), swSub = Math.max(2,4*s);
  const goalLineX = x - 102*s;
  const radius = 92*s;
  const boxHalfH = 116*s;
  return `<g transform="rotate(${r} ${x} ${y})">
    <line x1="${goalLineX}" y1="${y-boxHalfH}" x2="${goalLineX}" y2="${y+boxHalfH}" stroke="#fff" stroke-width="${swMain}" stroke-linecap="round"/>
    <path d="M ${goalLineX} ${y-boxHalfH}
             A ${radius} ${radius} 0 0 1 ${goalLineX} ${y+boxHalfH}"
          fill="none" stroke="#fff" stroke-width="${swMain}" stroke-linecap="round"/>
    <rect x="${goalLineX-2*s}" y="${y-40*s}" width="${34*s}" height="${80*s}" rx="${3*s}" fill="none" stroke="#fff" stroke-width="${swSub}"/>
    <circle cx="${goalLineX+60*s}" cy="${y}" r="${Math.max(3,4*s)}" fill="#fff"/>
  </g>`;
}
function courtAreaShape(x,y,r=0,s=1){
  const type = masters.surfaceType || "soccer";
  return type === "futsal" ? futsalGoalAreaShape(x,y,r,s) : soccerPenaltyShape(x,y,r,s);
}
function ballShape(x,y,s=1){
  const r = 16*s, sw = Math.max(1.8,3*s);
  const p = [
    [0,-6.5],[6,-2],[3.7,5],[-3.7,5],[-6,-2]
  ].map(([dx,dy])=>`${x+dx*s},${y+dy*s}`).join(" ");
  const top = [[0,-13],[5,-9],[3,-3],[-3,-3],[-5,-9]].map(([dx,dy])=>`${x+dx*s},${y+dy*s}`).join(" ");
  const left = [[-12,-4],[-7,-1],[-8,5],[-13,7],[-15,1]].map(([dx,dy])=>`${x+dx*s},${y+dy*s}`).join(" ");
  const right = [[12,-4],[15,1],[13,7],[8,5],[7,-1]].map(([dx,dy])=>`${x+dx*s},${y+dy*s}`).join(" ");
  const lowerL = [[-6,9],[-2,6],[2,9],[0,14],[-6,14]].map(([dx,dy])=>`${x+dx*s},${y+dy*s}`).join(" ");
  const lowerR = [[6,9],[0,14],[6,14],[11,10],[10,5]].map(([dx,dy])=>`${x+dx*s},${y+dy*s}`).join(" ");
  return `<g>
    <circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#101010" stroke-width="${sw}"/>
    <polygon points="${p}" fill="#111"/>
    <polygon points="${top}" fill="none" stroke="#111" stroke-width="${Math.max(1.2,2*s)}" stroke-linejoin="round"/>
    <polygon points="${left}" fill="none" stroke="#111" stroke-width="${Math.max(1.2,2*s)}" stroke-linejoin="round"/>
    <polygon points="${right}" fill="none" stroke="#111" stroke-width="${Math.max(1.2,2*s)}" stroke-linejoin="round"/>
    <polygon points="${lowerL}" fill="none" stroke="#111" stroke-width="${Math.max(1.2,2*s)}" stroke-linejoin="round"/>
    <polygon points="${lowerR}" fill="none" stroke="#111" stroke-width="${Math.max(1.2,2*s)}" stroke-linejoin="round"/>
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
  if(o.type==="attack") return playerShape(o.x,o.y,"#e53935","A","#fff",s);
  if(o.type==="defense") return playerShape(o.x,o.y,"#1e88e5","D","#fff",s);
  if(o.type==="free") return playerShape(o.x,o.y,"#fdd835","F","#17211b",s);
  if(o.type==="cone") return coneShape(o.x,o.y,s);
  if(o.type==="marker") return markerShape(o.x,o.y,s);
  if(o.type==="centerLine") return centerLineShape(o.x,o.y,o.r||0,s);
  if(o.type==="centerCircle") return centerCircleShape(o.x,o.y,o.r||0,s);
  if(o.type==="courtArea") return courtAreaShape(o.x,o.y,o.r||0,s);
  if(o.type==="goalFrame") return goalFrameShape(o.x,o.y,o.r||0,s);
  if(o.type==="ball") return ballShape(o.x,o.y,s);
  if(o.type==="text") return textShape(o.x,o.y,o.text||"テキスト",s);
  if(o.type==="line") return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#fff" stroke-width="${Math.max(4, 8*(o.s||1))}" stroke-linecap="round"/>`;
  if(o.type==="arrow") return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#fff" stroke-width="${Math.max(4, 8*(o.s||1))}" stroke-linecap="round" marker-end="url(#arrowHead)"/>`;
  if(o.type==="dash") return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#fff" stroke-width="${Math.max(4, 7*(o.s||1))}" stroke-dasharray="${18*(o.s||1)} ${16*(o.s||1)}" stroke-linecap="round" marker-end="url(#arrowHead)"/>`;
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
    attack:[56,56], defense:[56,56], free:[56,56], cone:[58,58], marker:[40,40], ball:[34,34],
    centerLine:[80,540*s], centerCircle:[170*s,170*s], goalFrame:[142*s,84*s], courtArea:[300*s,310*s], ball:[44*s,44*s], text:[Math.max(90*s,(o.text||"テキスト").length*18*s+40), 48*s]
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
  if(type==="line") return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="rgba(255,255,255,.82)" stroke-width="${sw}" stroke-linecap="round"/>`;
  if(type==="arrow") return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="rgba(255,255,255,.82)" stroke-width="${sw}" stroke-linecap="round" marker-end="url(#arrowHead)"/>`;
  if(type==="dash") return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="rgba(255,255,255,.82)" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="18 16" marker-end="url(#arrowHead)"/>`;
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
}
function saveNotes(){draft.parts[activePart].organize=el("organize").value;draft.parts[activePart].rules=el("rules").value;draft.parts[activePart].coaching=el("coaching").value;}
function loadNotes(){const p=draft.parts[activePart];el("organize").value=p.organize||"";el("rules").value=p.rules||"";el("coaching").value=p.coaching||"";el("noteTitle").textContent=partName(activePart)+"の内容";el("partName").textContent=partName(activePart);}
function setPart(k){saveNotes();activePart=k;interaction=null;selectedObjectId=null;document.querySelectorAll(".part").forEach(b=>b.classList.toggle("active",b.dataset.part===k));loadNotes();renderBoard();}
function toolLabelName(t){
  const isFutsal = (masters.surfaceType || "soccer") === "futsal";
  const names = {
    attack:"攻撃", defense:"守備", free:"フリー", cone:"コーン", marker:"マーカー",
    centerLine:"センターライン", centerCircle:"センターサークル",
    courtArea: isFutsal ? "ゴール前エリア" : "ペナルティエリア",
    goalFrame:"ゴール枠", goal:"ゴール枠", penalty: isFutsal ? "ゴール前エリア" : "ペナルティエリア",
    ball:"ボール", text:"テキスト", line:"白線", arrow:"矢印", dash:"点線矢印"
  };
  return names[t] || t;
}
function renderToolPalette(){
  const isFutsal = (masters.surfaceType || "soccer") === "futsal";
  if(el("toolLabelCenterLine")) el("toolLabelCenterLine").textContent = "センターライン";
  if(el("toolLabelCenterCircle")) el("toolLabelCenterCircle").textContent = "センターサークル";
  if(el("toolLabelCourtArea")) el("toolLabelCourtArea").textContent = isFutsal ? "ゴール前エリア" : "ペナルティエリア";
  if(el("toolLabelGoalFrame")) el("toolLabelGoalFrame").textContent = "ゴール枠";
  if(el("toolName")) el("toolName").textContent = toolLabelName(activeTool);
}
function setTool(t){
  activeTool=t; interaction=null;
  document.querySelectorAll(".tool").forEach(b=>b.classList.toggle("active",b.dataset.tool===t));
  el("toolName").textContent=toolLabelName(t);
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
    obj = {id:uid(), type:"text", x:p.x, y:p.y, text:value, r:currentRotation, s:1};
  }else{
    obj = {id:uid(), type:activeTool, x:p.x, y:p.y, r:currentRotation, s:1};
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
    interaction = {mode:"drawLine", temp:{id:uid(), type:activeTool, x1:p.x, y1:p.y, x2:p.x, y2:p.y, s:1}};
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
    const t = interaction.temp;
    const len = Math.hypot(t.x2 - t.x1, t.y2 - t.y1);
    if(len >= 10){
      currentObjects().push(t);
      selectedObjectId = t.id;
    }else{
      toast("ドラッグして描画してください");
    }
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
  const recent = sessions.slice(0,4);
  el("recentCards").innerHTML = recent.length ? recent.map(s=>cardHtml(s,true)).join("") : `<div class="empty"><h3>まだ指導案がありません</h3><p>新規作成から始めてください。</p></div>`;
  bindCardActions(el("recentCards"));
}

function filteredSessions(){
  const q=el("keyword").value.toLowerCase().trim();
  const pf=el("partFilter").value;
  const cf=el("categoryFilter").value;
  const tf=el("tagFilter").value.toLowerCase().trim();
  return sessions.filter(s=>{
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
async function pushDrive(){saveSyncSetting();if(!syncSetting.gasUrl||!syncSetting.teamKey){toast("URLとチームキーを入力してください");return;}const payload={action:"save",teamKey:syncSetting.teamKey,data:{version:21,updatedAt:new Date().toISOString(),sessions,masters,matches,materials}};try{const res=await fetch(syncSetting.gasUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});const json=await res.json();if(!json.ok)throw new Error(json.error||"保存失敗");toast("Driveへ保存しました");}catch(e){alert("Drive保存に失敗しました。URL、チームキー、Apps Scriptのデプロイ設定を確認してください。\n\n"+e.message);}}
async function pullDrive(){saveSyncSetting();if(!syncSetting.gasUrl||!syncSetting.teamKey){toast("URLとチームキーを入力してください");return;}if(sessions.length&&!confirm("Driveのデータでこの端末のデータを置き換えますか？"))return;try{const url=syncSetting.gasUrl+"?action=load&teamKey="+encodeURIComponent(syncSetting.teamKey);const res=await fetch(url);const json=await res.json();if(!json.ok)throw new Error(json.error||"読み込み失敗");sessions=(json.data&&json.data.sessions)||[];matches=(json.data&&json.data.matches)||[];materials=(json.data&&json.data.materials)||[];masters={...defaultMasters, ...((json.data&&json.data.masters)||masters)};saveAll();saveMatches();saveMaterials();saveMasters();refreshMastersUI();renderAll();toast("Driveから読み込みました");}catch(e){alert("Drive読み込みに失敗しました。URL、チームキー、Apps Scriptのデプロイ設定を確認してください。\n\n"+e.message);}}
function downloadJson(){const blob=new Blob([JSON.stringify({version:21,updatedAt:new Date().toISOString(),sessions,masters,matches,materials},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="TeamBoard-data.json";a.click();URL.revokeObjectURL(a.href);}



function todayISO(){
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function num(id){
  return Math.max(0, Number(el(id).value || 0));
}

let starterSelectionState = {};

function getPlayers(){
  if(!Array.isArray(masters.players)) masters.players = [];
  return masters.players;
}
function playerLabel(p){
  return `#${p.number} ${p.name}`;
}
function renderPlayerMasterList(){
  const list = el("playerMasterList");
  if(!list) return;
  const players = [...getPlayers()].sort((a,b)=>Number(a.number)-Number(b.number));
  list.innerHTML = players.length ? players.map(p => `
    <div class="player-master-item" data-player-id="${p.id}">
      <span class="player-no-pill">#${esc(p.number)}</span>
      <span class="player-name-text">${esc(p.name)}</span>
      <button type="button" class="danger" data-player-del="${p.id}">削除</button>
    </div>
  `).join("") : `<div class="empty"><h3>登録選手がまだいません</h3><p>背番号と名前を入力して選手追加してください。</p></div>`;
  document.querySelectorAll("[data-player-del]").forEach(btn=>{
    btn.onclick=()=>deletePlayerMaster(btn.dataset.playerDel);
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
  saveMasters();
  renderPlayerMasterList();
  renderStarterAssignments();
  el("playerNumberInput").value = "";
  el("playerNameInput").value = "";
  toast("選手を登録しました");
}
function deletePlayerMaster(id){
  if(!confirm("この選手を削除しますか？")) return;
  masters.players = getPlayers().filter(p => p.id !== id);
  Object.keys(starterSelectionState).forEach(k=>{
    if(starterSelectionState[k] === id) starterSelectionState[k] = "";
  });
  saveMasters();
  renderPlayerMasterList();
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
function captureStarterStateFromDOM(){
  const obj = {};
  document.querySelectorAll("[data-starter-slot]").forEach(s=>{
    obj[s.dataset.starterSlot] = s.value || "";
  });
  starterSelectionState = obj;
}
function setStarterStateFromSaved(starters){
  starterSelectionState = {};
  (starters || []).forEach(s=>{
    if(s && s.slotId) starterSelectionState[s.slotId] = s.playerId || "";
  });
}
function renderStarterAssignments(){
  const wrap = el("starterAssignList");
  const preview = el("formationPreview");
  if(!wrap || !preview) return;
  captureStarterStateFromDOM();
  const slots = getFormationSlots(el("formationInput").value);
  const players = [...getPlayers()].sort((a,b)=>Number(a.number)-Number(b.number));

  if(!players.length){
    wrap.innerHTML = `<div class="no-player-note">設定ページで選手登録をすると、ここでスタメンを選択できます。</div>`;
    renderFormationPreview();
    return;
  }

  const options = selected => `<option value="">未選択</option>` + players.map(p => `<option value="${p.id}" ${selected===p.id ? "selected" : ""}>${esc(playerLabel(p))}</option>`).join("");
  wrap.innerHTML = slots.map(slot => `
    <div class="starter-row">
      <span class="slot-label">${esc(slot.label)}</span>
      <select data-starter-slot="${slot.slotId}">
        ${options(starterSelectionState[slot.slotId] || "")}
      </select>
    </div>
  `).join("");

  document.querySelectorAll("[data-starter-slot]").forEach(sel=>{
    sel.onchange = ()=>{
      starterSelectionState[sel.dataset.starterSlot] = sel.value || "";
      renderFormationPreview();
    };
  });

  renderFormationPreview();
}
function buildFormationCoords(formationValue){
  const lines = parseFormation(formationValue);
  const rows = [1, ...lines];
  const totalRows = rows.length;
  const coords = [{slotId:"GK1", label:"GK", x:120, y:320}];
  const roles = formationRoleNames(lines.length);
  lines.forEach((count, i)=>{
    const x = totalRows === 1 ? 500 : 120 + ((i+1) * 760 / (totalRows-1));
    for(let k=0; k<count; k++){
      const y = count === 1 ? 320 : 100 + (k * (440 / (count-1)));
      coords.push({slotId:`${roles[i]}${k+1}`, label:`${roles[i]}${k+1}`, x, y});
    }
  });
  return coords;
}
function getSelectedStarterObjects(){
  const players = getPlayers();
  return buildFormationCoords(el("formationInput").value).map(pos=>{
    const pid = starterSelectionState[pos.slotId] || "";
    const p = players.find(x => x.id === pid);
    return {
      ...pos,
      playerId: pid,
      number: p ? p.number : "",
      name: p ? p.name : ""
    };
  });
}
function renderFormationPreview(){
  const box = el("formationPreview");
  if(!box) return;
  const coords = getSelectedStarterObjects();
  let stripes = "";
  for(let x=0;x<1000;x+=100){
    stripes += `<rect x="${x}" y="0" width="50" height="640" fill="rgba(255,255,255,.05)"/>`;
  }
  const playersSvg = coords.map(p => `
    <g transform="translate(${p.x},${p.y})">
      <circle cx="0" cy="0" r="27" fill="${p.number ? "#ffffff" : "rgba(255,255,255,.22)"}" stroke="#102d1c" stroke-width="3"/>
      <text x="0" y="7" text-anchor="middle" font-size="20" font-weight="900" fill="#102d1c">${esc(p.number || p.label)}</text>
      <text x="0" y="48" text-anchor="middle" font-size="14" font-weight="800" fill="#ffffff">${esc(p.name || "")}</text>
    </g>
  `).join("");
  box.innerHTML = `
    <svg viewBox="0 0 1000 640" aria-label="formation preview">
      <rect x="0" y="0" width="1000" height="640" fill="#11813e"/>
      ${stripes}
      <rect x="24" y="24" width="952" height="592" rx="28" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      <line x1="500" y1="24" x2="500" y2="616" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      <circle cx="500" cy="320" r="80" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      <circle cx="500" cy="320" r="4" fill="#fff"/>
      <rect x="24" y="180" width="156" height="280" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      <rect x="820" y="180" width="156" height="280" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      <rect x="24" y="255" width="54" height="130" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      <rect x="922" y="255" width="54" height="130" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      ${playersSvg}
    </svg>
  `;
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
}
function clearMatchForm(){
  el("matchId").value = "";
  el("matchType").value = "official";
  el("matchName").value = "公式戦";
  el("matchCategory").value = masters.ages[0] || "U-12";
  el("opponentName").value = "";
  el("matchDate").value = todayISO();
  el("videoUrl").value = "";
  el("trmCount").value = "3";
  el("formationInput").value = "4-4-2";
  el("matchMemo").value = "";
  starterSelectionState = {};
  renderScoreInputs({scores:[{label:"前半",own:0,opp:0},{label:"後半",own:0,opp:0}]});
  renderStarterAssignments();
}
function collectStartersFromState(){
  const players = getPlayers();
  return getFormationSlots(el("formationInput").value).map(slot=>{
    const pid = starterSelectionState[slot.slotId] || "";
    const p = players.find(x => x.id === pid);
    return {
      slotId: slot.slotId,
      label: slot.label,
      playerId: pid,
      number: p ? p.number : "",
      name: p ? p.name : ""
    };
  });
}
function readMatchForm(){
  const scores = readDynamicScores();
  const totalOwn = scores.reduce((a,b)=>a+Number(b.own||0),0);
  const totalOpp = scores.reduce((a,b)=>a+Number(b.opp||0),0);
  return {
    id: el("matchId").value || uid(),
    matchType: el("matchType").value || "official",
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
    starters: collectStartersFromState(),
    videoUrl: el("videoUrl").value.trim(),
    memo: el("matchMemo").value.trim(),
    updatedAt: new Date().toISOString()
  };
}
function saveMatch(){
  captureStarterStateFromDOM();
  const item = readMatchForm();
  const i = matches.findIndex(m => m.id === item.id);
  if(i >= 0) matches[i] = item;
  else matches.unshift(item);
  saveMatches();
  renderMatches();
  clearMatchForm();
  clearMaterialForm();
  toast("試合結果を保存しました");
}
function editMatch(id){
  const m = matches.find(x => x.id === id);
  if(!m) return;
  el("matchId").value = m.id;
  el("matchType").value = m.matchType || "official";
  el("matchName").value = m.name || ((m.matchType === "trm") ? "TRM" : "公式戦");
  el("matchCategory").value = m.category || masters.ages[0] || "";
  el("opponentName").value = m.opponent || "";
  el("matchDate").value = m.date || todayISO();
  el("videoUrl").value = m.videoUrl || "";
  el("trmCount").value = String(m.trmCount || 3);
  el("formationInput").value = m.formation || "4-4-2";
  el("matchMemo").value = m.memo || "";
  setStarterStateFromSaved(m.starters || []);
  const scores = m.scores?.length ? m.scores : [
    {label:"前半", own:m.firstOwn ?? 0, opp:m.firstOpp ?? 0},
    {label:"後半", own:m.secondOwn ?? 0, opp:m.secondOpp ?? 0}
  ];
  renderScoreInputs({scores});
  renderStarterAssignments();
  page("resultsPage");
}
function deleteMatch(id){
  if(!confirm("この試合結果を削除しますか？")) return;
  matches = matches.filter(m => m.id !== id);
  saveMatches();
  renderMatches();
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
function miniFormationSVG(match){
  if(!match.formation) return "";
  const coords = buildFormationCoords(match.formation);
  const starters = {};
  (match.starters || []).forEach(s=>{ if(s && s.slotId) starters[s.slotId] = s; });
  let stripes = "";
  for(let x=0;x<1000;x+=100){
    stripes += `<rect x="${x}" y="0" width="50" height="640" fill="rgba(255,255,255,.05)"/>`;
  }
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
      <rect x="0" y="0" width="1000" height="640" fill="#11813e"/>
      ${stripes}
      <rect x="24" y="24" width="952" height="592" rx="28" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      <line x1="500" y1="24" x2="500" y2="616" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      <circle cx="500" cy="320" r="80" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      <circle cx="500" cy="320" r="4" fill="#fff"/>
      <rect x="24" y="180" width="156" height="280" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      <rect x="820" y="180" width="156" height="280" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="4"/>
      ${body}
    </svg></div>`;
}
function starterChips(match){
  const items = (match.starters || []).filter(s => s && s.playerId && s.number && s.name);
  return items.length ? `<div class="lineup-chip-row">${items.map(s => `<span class="lineup-chip">#${esc(s.number)} ${esc(s.name)}</span>`).join("")}</div>` : "";
}
function renderMatches(){
  el("matchCountBadge").textContent = matches.length + "件";
  el("matchList").innerHTML = matches.length ? matches.map(m => `
    <article class="match-card" data-match-id="${m.id}">
      <div class="match-card-head">
        <div>
          <h3>${esc(m.name || "TRM")}${m.opponent ? ` vs ${esc(m.opponent)}` : ""}</h3>
          <div class="badges">
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
      ${(m.formation || "").trim() ? `<div class="match-lineup">
        <div><span class="lineup-formation-badge">${esc(m.formation)}</span></div>
        ${miniFormationSVG(m)}
        ${starterChips(m)}
      </div>` : ""}
      ${m.videoUrl ? `<a class="video-link" href="${esc(m.videoUrl)}" target="_blank" rel="noopener noreferrer">動画を開く</a>` : ""}
      ${m.memo ? `<div class="match-memo">${esc(m.memo)}</div>` : ""}
      <div class="card-actions">
        <button data-match-act="edit">編集</button>
        <button class="danger" data-match-act="delete">削除</button>
      </div>
    </article>
  `).join("") : `<div class="empty"><h3>まだ試合結果がありません</h3><p>試合名・スコア・スタメン・メモを入力して保存してください。</p></div>`;
  document.querySelectorAll("[data-match-act]").forEach(b => {
    b.onclick = () => {
      const id = b.closest("[data-match-id]").dataset.matchId;
      if(b.dataset.matchAct === "edit") editMatch(id);
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
  el("materialCountBadge").textContent = materials.length + "件";
  el("materialList").innerHTML = materials.length ? materials.map(m => `
    <article class="material-card" data-material-id="${m.id}">
      <div class="material-card-head">
        <div>
          <h3>${esc(m.title || "無題の資料")}</h3>
          <div class="badges">
            <span class="badge">対象 ${esc(m.category || "-")}</span>
            <span class="badge">${esc(m.date || "-")}</span>
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

function renderAll(){renderSurface();renderToolPalette();renderLogo();renderRecent();renderSearch();renderTags();renderPlayerMasterList();renderMatches();renderMaterials();updateSyncStatus();}
document.addEventListener("DOMContentLoaded",()=>{
  if(!sessions.length){sessions=[sample()];saveAll();}
  refreshMastersUI();
  document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>page(b.dataset.page));
  el("homeCreateBtn").onclick=newSession; el("goSearchBtn").onclick=()=>page("searchPage"); el("homeSearchBtn").onclick=()=>page("searchPage"); el("homeResultsBtn").onclick=()=>page("resultsPage"); el("homeMaterialsBtn").onclick=()=>page("materialsPage");
  el("settingsOpenBtn").onclick=()=>page("settingsPage"); el("syncOpenBtn").onclick=openSync;
  el("newBlankBtn").onclick=newSession; el("saveBtn").onclick=saveDraft;
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
  el("clearBtn").onclick=()=>{if(confirm("図をクリアしますか？")){draft.parts[activePart].objects=[];selectedObjectId=null;interaction=null;renderBoard();}};
  el("sizeDownBtn").onclick=()=>adjustSelectedSize(0.9);
  el("sizeUpBtn").onclick=()=>adjustSelectedSize(1.1);
  el("duplicateBtn").onclick=duplicateSelectedObject;
  el("deleteSelectedBtn").onclick=deleteSelectedObject;
  el("rotateLeftBtn").onclick=()=>rotateCurrent(-45);
  el("rotateRightBtn").onclick=()=>rotateCurrent(45);
  document.querySelectorAll(".part").forEach(b=>b.onclick=()=>setPart(b.dataset.part));
  document.querySelectorAll(".tool").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
  ["keyword","partFilter","categoryFilter","tagFilter"].forEach(id=>{el(id).oninput=renderSearch;el(id).onchange=renderSearch;});
  el("clearSearchBtn").onclick=()=>{el("keyword").value="";el("partFilter").value="";el("categoryFilter").value="";el("tagFilter").value="";renderSearch();};
  el("saveMastersBtn").onclick=readMastersUI;
  el("surfaceType").onchange=()=>{masters.surfaceType=el("surfaceType").value;saveMasters();renderAll();renderBoard();toast("コート仕様を変更しました");};
  el("addPlayerBtn").onclick=addPlayerMaster;
  el("playerNumberInput").addEventListener("keydown", e=>{ if(e.key==="Enter") addPlayerMaster(); });
  el("playerNameInput").addEventListener("keydown", e=>{ if(e.key==="Enter") addPlayerMaster(); });
  el("newMatchBtn").onclick=clearMatchForm;
  el("saveMatchBtn").onclick=saveMatch;
  el("clearMaterialFormBtn").onclick=clearMaterialForm;
  el("saveMaterialBtn").onclick=saveMaterial;
  el("materialFileInput").onchange=(e)=>handleMaterialFile(e.target.files[0]);
  el("matchType").onchange=()=>{
    if(!el("matchName").value || el("matchName").value==="TRM" || el("matchName").value==="公式戦"){
      el("matchName").value = el("matchType").value==="trm" ? "TRM" : "公式戦";
    }
    renderScoreInputs();
  };
  el("trmCount").onchange=()=>renderScoreInputs();
  el("formationInput").oninput=()=>renderStarterAssignments();
  clearMatchForm();
  el("logoFileInput").onchange=(e)=>setLogoFromFile(e.target.files[0]);
  el("clearLogoBtn").onclick=clearLogo;
  el("saveSyncSettingBtn").onclick=saveSyncSetting; el("pushBtn").onclick=pushDrive; el("pullBtn").onclick=pullDrive; el("downloadBtn").onclick=downloadJson;
  setTool("attack");
  updateRotation();
  renderBoard();
  renderAll();
  renderStarterAssignments();
});
