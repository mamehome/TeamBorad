
const DATA_KEY = "teamboard-v5-data";
const MASTER_KEY = "teamboard-v5-masters";
const MATCH_KEY = "teamboard-v9-matches";
const SYNC_KEY = "teamboard-v5-sync";
const PARTS = [["wup","W-up"],["tr1","TR1"],["tr2","TR2"],["game","Game"]];

const defaultMasters = {
  tags: ["攻撃","守備","前進","少人数","ポゼッション","フィニッシュ","ビルドアップ","トランジション","雨の日"],
  times: ["60分","75分","90分","W-up 10 / TR1 20 / TR2 20 / Game 10","W-up 15 / TR1 20 / TR2 25 / Game 20"],
  categories: ["攻撃","守備","ポゼッション","フィニッシュ","ビルドアップ","トランジション","ウォーミングアップ","ゲーム"],
  ages: ["U-8","U-10","U-12","U-15","U-18","一般"],
  logoData: "teamboard-logo.png",
  surfaceType: "soccer"
};

let sessions = loadLocal(DATA_KEY, []);
let matches = loadLocal(MATCH_KEY, []);
let masters = loadLocal(MASTER_KEY, defaultMasters);
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
  fillSelect("matchCategory", masters.categories);
  el("masterTags").value = masters.tags.join("\n");
  el("masterTimes").value = masters.times.join("\n");
  el("masterCategories").value = masters.categories.join("\n");
  el("masterAges").value = masters.ages.join("\n");
  el("surfaceType").value = masters.surfaceType || "soccer";
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

function player(x,y,color,label,text="#fff"){return `<g><circle cx="${x}" cy="${y}" r="24" fill="${color}" stroke="#fff" stroke-width="5"/><text x="${x}" y="${y+7}" text-anchor="middle" font-size="20" font-weight="900" fill="${text}">${label}</text></g>`;}
function cone(x,y){return `<g><path d="M${x} ${y-28} L${x-24} ${y+24} L${x+24} ${y+24} Z" fill="#ff7a00" stroke="#fff" stroke-width="4"/><line x1="${x-13}" y1="${y}" x2="${x+13}" y2="${y}" stroke="#fff" stroke-width="4"/></g>`;}
function marker(x,y){return `<circle cx="${x}" cy="${y}" r="15" fill="#ffea00" stroke="#17351f" stroke-width="4"/>`;}
function centerLineObj(x,y,r=0){
  return `<g transform="rotate(${r} ${x} ${y})">
    <line x1="${x}" y1="${y-260}" x2="${x}" y2="${y+260}" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
  </g>`;
}
function centerCircleObj(x,y,r=0){
  return `<g transform="rotate(${r} ${x} ${y})">
    <circle cx="${x}" cy="${y}" r="76" fill="none" stroke="#fff" stroke-width="7"/>
    <circle cx="${x}" cy="${y}" r="6" fill="#fff"/>
  </g>`;
}
function goalFrameObj(x,y,r=0){
  return `<g transform="rotate(${r} ${x} ${y})">
    <rect x="${x-54}" y="${y-24}" width="108" height="48" rx="6" fill="none" stroke="#fff" stroke-width="7"/>
    <line x1="${x-42}" y1="${y-10}" x2="${x+42}" y2="${y-10}" stroke="#fff" stroke-width="3" opacity=".65"/>
    <line x1="${x-42}" y1="${y+10}" x2="${x+42}" y2="${y+10}" stroke="#fff" stroke-width="3" opacity=".65"/>
    <line x1="${x-18}" y1="${y-22}" x2="${x-18}" y2="${y+22}" stroke="#fff" stroke-width="3" opacity=".65"/>
    <line x1="${x+18}" y1="${y-22}" x2="${x+18}" y2="${y+22}" stroke="#fff" stroke-width="3" opacity=".65"/>
  </g>`;
}
function soccerPenaltyObj(x,y,r=0){
  return `<g transform="rotate(${r} ${x} ${y})">
    <rect x="${x-90}" y="${y-130}" width="180" height="260" fill="none" stroke="#fff" stroke-width="7"/>
    <rect x="${x-90}" y="${y-66}" width="62" height="132" fill="none" stroke="#fff" stroke-width="5"/>
    <path d="M ${x+34} ${y-52} A 70 70 0 0 1 ${x+34} ${y+52}" fill="none" stroke="#fff" stroke-width="5"/>
    <circle cx="${x}" cy="${y}" r="6" fill="#fff"/>
  </g>`;
}
function futsalGoalAreaObj(x,y,r=0){
  return `<g transform="rotate(${r} ${x} ${y})">
    <line x1="${x-4}" y1="${y-120}" x2="${x-4}" y2="${y+120}" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
    <path d="M ${x-4} ${y-120} A 120 120 0 0 1 ${x-4} ${y+120}" fill="none" stroke="#fff" stroke-width="7"/>
    <rect x="${x-8}" y="${y-48}" width="36" height="96" fill="none" stroke="#fff" stroke-width="5"/>
    <circle cx="${x+88}" cy="${y}" r="5" fill="#fff"/>
  </g>`;
}
function courtAreaObj(x,y,r=0){
  const type = masters.surfaceType || "soccer";
  return type === "futsal" ? futsalGoalAreaObj(x,y,r) : soccerPenaltyObj(x,y,r);
}
function goalObj(x,y,r=0){ return goalFrameObj(x,y,r); }
function penaltyObj(x,y,r=0){ return courtAreaObj(x,y,r); }

function ball(x,y){return `<g><circle cx="${x}" cy="${y}" r="15" fill="#fff" stroke="#111" stroke-width="4"/><circle cx="${x}" cy="${y}" r="4" fill="#111"/></g>`;}
function textObj(x,y,text){
  const safe = esc(text);
  return `<g>
    <rect x="${x-8}" y="${y-30}" width="${Math.max(60, safe.length*18+16)}" height="38" rx="10" fill="rgba(0,0,0,.42)" stroke="#fff" stroke-width="2"/>
    <text x="${x}" y="${y-5}" font-size="26" font-weight="900" fill="#fff">${safe}</text>
  </g>`;
}
function objectsSvg(list){return (list||[]).map(o=>{
  if(o.type==="attack")return player(o.x,o.y,"#e53935","A");
  if(o.type==="defense")return player(o.x,o.y,"#1e88e5","D");
  if(o.type==="free")return player(o.x,o.y,"#fdd835","F","#17211b");
  if(o.type==="cone")return cone(o.x,o.y);
  if(o.type==="marker")return marker(o.x,o.y);
  if(o.type==="centerLine")return centerLineObj(o.x,o.y,o.r||0);
  if(o.type==="centerCircle")return centerCircleObj(o.x,o.y,o.r||0);
  if(o.type==="courtArea" || o.type==="penalty")return courtAreaObj(o.x,o.y,o.r||0);
  if(o.type==="goalFrame" || o.type==="goal")return goalFrameObj(o.x,o.y,o.r||0);
  if(o.type==="ball")return ball(o.x,o.y);
  if(o.type==="text")return textObj(o.x,o.y,o.text||"テキスト");
  if(o.type==="line")return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`;
  if(o.type==="arrow")return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#fff" stroke-width="8" stroke-linecap="round" marker-end="url(#arrowHead)"/>`;
  if(o.type==="dash")return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#fff" stroke-width="7" stroke-dasharray="18 16" stroke-linecap="round" marker-end="url(#arrowHead)"/>`;
  return "";
}).join("");}

function renderBoard(){el("board").innerHTML = pitchBase() + objectsSvg(draft.parts[activePart].objects);}
function saveNotes(){draft.parts[activePart].organize=el("organize").value;draft.parts[activePart].rules=el("rules").value;draft.parts[activePart].coaching=el("coaching").value;}
function loadNotes(){const p=draft.parts[activePart];el("organize").value=p.organize||"";el("rules").value=p.rules||"";el("coaching").value=p.coaching||"";el("noteTitle").textContent=partName(activePart)+"の内容";el("partName").textContent=partName(activePart);}
function setPart(k){saveNotes();activePart=k;pending=null;document.querySelectorAll(".part").forEach(b=>b.classList.toggle("active",b.dataset.part===k));loadNotes();renderBoard();}
function toolLabelName(t){
  const isFutsal = (masters.surfaceType || "soccer") === "futsal";
  const names = {
    attack:"攻撃",
    defense:"守備",
    free:"フリー",
    cone:"コーン",
    marker:"マーカー",
    centerLine:"センターライン",
    centerCircle:"センターサークル",
    courtArea: isFutsal ? "ゴール前エリア" : "ペナルティエリア",
    goalFrame:"ゴール枠",
    goal:"ゴール枠",
    penalty: isFutsal ? "ゴール前エリア" : "ペナルティエリア",
    ball:"ボール",
    text:"テキスト",
    line:"白線",
    arrow:"矢印",
    dash:"点線矢印"
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
  activeTool=t;pending=null;
  document.querySelectorAll(".tool").forEach(b=>b.classList.toggle("active",b.dataset.tool===t));
  el("toolName").textContent=toolLabelName(t);
}

function updateRotation(){
  currentRotation = ((currentRotation % 360) + 360) % 360;
  el("rotationValue").textContent = currentRotation + "°";
}
function rotateCurrent(delta){
  currentRotation += delta;
  updateRotation();
}
function boardPoint(evt){const r=el("board").getBoundingClientRect();return {x:Math.round((evt.clientX-r.left)/r.width*1000),y:Math.round((evt.clientY-r.top)/r.height*640)};}
function addToBoard(evt){const p=boardPoint(evt);const arr=draft.parts[activePart].objects;if(["line","arrow","dash"].includes(activeTool)){if(!pending){pending=p;toast("終点をタップ");return;}arr.push({id:uid(),type:activeTool,x1:pending.x,y1:pending.y,x2:p.x,y2:p.y});pending=null;}else{
    if(activeTool==="text"){
      const value = prompt("挿入するテキストを入力してください", "ポイント");
      if(!value) return;
      arr.push({id:uid(),type:activeTool,x:p.x,y:p.y,text:value,r:currentRotation});
    }else{
      arr.push({id:uid(),type:activeTool,x:p.x,y:p.y,r:currentRotation});
    }
  }renderBoard();}

function readMeta(){draft.title=el("planTitle").value.trim();draft.age=el("age").value;draft.category=el("category").value;draft.timePlan=el("timePlan").value;draft.tags=el("tags").value.trim();draft.updatedAt=new Date().toISOString();}
function fillMeta(){el("planTitle").value=draft.title||"";el("age").value=draft.age||masters.ages[0];el("category").value=draft.category||masters.categories[0];el("timePlan").value=draft.timePlan||masters.times[0];el("tags").value=draft.tags||"";}
function newSession(){draft=emptySession();activePart="wup";fillMeta();setPart("wup");el("editorMode").textContent="指導案作成ページ";page("createPage");}
function editSession(id){const s=sessions.find(x=>x.id===id);if(!s)return;draft=clone(s);activePart="wup";fillMeta();setPart("wup");el("editorMode").textContent="指導案編集ページ";page("createPage");}
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
async function pushDrive(){saveSyncSetting();if(!syncSetting.gasUrl||!syncSetting.teamKey){toast("URLとチームキーを入力してください");return;}const payload={action:"save",teamKey:syncSetting.teamKey,data:{version:9,updatedAt:new Date().toISOString(),sessions,masters,matches}};try{const res=await fetch(syncSetting.gasUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});const json=await res.json();if(!json.ok)throw new Error(json.error||"保存失敗");toast("Driveへ保存しました");}catch(e){alert("Drive保存に失敗しました。URL、チームキー、Apps Scriptのデプロイ設定を確認してください。\n\n"+e.message);}}
async function pullDrive(){saveSyncSetting();if(!syncSetting.gasUrl||!syncSetting.teamKey){toast("URLとチームキーを入力してください");return;}if(sessions.length&&!confirm("Driveのデータでこの端末のデータを置き換えますか？"))return;try{const url=syncSetting.gasUrl+"?action=load&teamKey="+encodeURIComponent(syncSetting.teamKey);const res=await fetch(url);const json=await res.json();if(!json.ok)throw new Error(json.error||"読み込み失敗");sessions=(json.data&&json.data.sessions)||[];matches=(json.data&&json.data.matches)||[];masters={...defaultMasters, ...((json.data&&json.data.masters)||masters)};saveAll();saveMatches();saveMasters();refreshMastersUI();renderAll();toast("Driveから読み込みました");}catch(e){alert("Drive読み込みに失敗しました。URL、チームキー、Apps Scriptのデプロイ設定を確認してください。\n\n"+e.message);}}
function downloadJson(){const blob=new Blob([JSON.stringify({version:9,updatedAt:new Date().toISOString(),sessions,masters,matches},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="TeamBoard-data.json";a.click();URL.revokeObjectURL(a.href);}


function todayISO(){
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function num(id){
  return Math.max(0, Number(el(id).value || 0));
}
function updateMatchTotal(){
  const own = num("firstOwn") + num("secondOwn");
  const opp = num("firstOpp") + num("secondOpp");
  el("totalScore").textContent = `${own} - ${opp}`;
  el("resultLabel").textContent = own > opp ? "WIN" : own < opp ? "LOSE" : "DRAW";
}
function clearMatchForm(){
  el("matchId").value = "";
  el("matchName").value = "TRM";
  el("matchCategory").value = masters.categories[0] || "攻撃";
  el("matchDate").value = todayISO();
  el("firstOwn").value = 0;
  el("firstOpp").value = 0;
  el("secondOwn").value = 0;
  el("secondOpp").value = 0;
  el("matchMemo").value = "";
  updateMatchTotal();
}
function readMatchForm(){
  const firstOwn = num("firstOwn");
  const firstOpp = num("firstOpp");
  const secondOwn = num("secondOwn");
  const secondOpp = num("secondOpp");
  return {
    id: el("matchId").value || uid(),
    name: el("matchName").value.trim() || "TRM",
    category: el("matchCategory").value || "",
    date: el("matchDate").value || todayISO(),
    firstOwn,
    firstOpp,
    secondOwn,
    secondOpp,
    totalOwn: firstOwn + secondOwn,
    totalOpp: firstOpp + secondOpp,
    memo: el("matchMemo").value.trim(),
    updatedAt: new Date().toISOString()
  };
}
function saveMatch(){
  const item = readMatchForm();
  const i = matches.findIndex(m => m.id === item.id);
  if(i >= 0) matches[i] = item;
  else matches.unshift(item);
  saveMatches();
  renderMatches();
  clearMatchForm();
  toast("試合結果を保存しました");
}
function editMatch(id){
  const m = matches.find(x => x.id === id);
  if(!m) return;
  el("matchId").value = m.id;
  el("matchName").value = m.name || "TRM";
  el("matchCategory").value = m.category || masters.categories[0] || "";
  el("matchDate").value = m.date || todayISO();
  el("firstOwn").value = m.firstOwn ?? 0;
  el("firstOpp").value = m.firstOpp ?? 0;
  el("secondOwn").value = m.secondOwn ?? 0;
  el("secondOpp").value = m.secondOpp ?? 0;
  el("matchMemo").value = m.memo || "";
  updateMatchTotal();
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
function renderMatches(){
  el("matchCountBadge").textContent = matches.length + "件";
  el("matchList").innerHTML = matches.length ? matches.map(m => `
    <article class="match-card" data-match-id="${m.id}">
      <div class="match-card-head">
        <div>
          <h3>${esc(m.name || "TRM")}</h3>
          <div class="badges">
            <span class="badge">${esc(m.category || "-")}</span>
            <span class="badge">${esc(m.date || "-")}</span>
            <span class="badge">${resultText(m)}</span>
          </div>
        </div>
        <div class="match-score">${m.totalOwn} - ${m.totalOpp}</div>
      </div>
      <div class="match-breakdown">
        <span class="badge">前半 ${m.firstOwn} - ${m.firstOpp}</span>
        <span class="badge">後半 ${m.secondOwn} - ${m.secondOpp}</span>
        <span class="badge">合計 ${m.totalOwn} - ${m.totalOpp}</span>
      </div>
      ${m.memo ? `<div class="match-memo">${esc(m.memo)}</div>` : ""}
      <div class="card-actions">
        <button data-match-act="edit">編集</button>
        <button class="danger" data-match-act="delete">削除</button>
      </div>
    </article>
  `).join("") : `<div class="empty"><h3>まだ試合結果がありません</h3><p>試合名・スコア・メモを入力して保存してください。</p></div>`;
  document.querySelectorAll("[data-match-act]").forEach(b => {
    b.onclick = () => {
      const id = b.closest("[data-match-id]").dataset.matchId;
      if(b.dataset.matchAct === "edit") editMatch(id);
      if(b.dataset.matchAct === "delete") deleteMatch(id);
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

function renderAll(){renderSurface();renderToolPalette();renderLogo();renderRecent();renderSearch();renderTags();renderMatches();updateSyncStatus();}
document.addEventListener("DOMContentLoaded",()=>{
  if(!sessions.length){sessions=[sample()];saveAll();}
  refreshMastersUI();
  document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>page(b.dataset.page));
  el("homeCreateBtn").onclick=newSession; el("goSearchBtn").onclick=()=>page("searchPage"); el("homeSearchBtn").onclick=()=>page("searchPage"); el("homeResultsBtn").onclick=()=>page("resultsPage");
  el("settingsOpenBtn").onclick=()=>page("settingsPage"); el("syncOpenBtn").onclick=openSync;
  el("newBlankBtn").onclick=newSession; el("saveBtn").onclick=saveDraft;
  el("board").onclick=addToBoard; el("undoBtn").onclick=()=>{draft.parts[activePart].objects.pop();renderBoard();}; el("clearBtn").onclick=()=>{if(confirm("図をクリアしますか？")){draft.parts[activePart].objects=[];renderBoard();}};
  el("rotateLeftBtn").onclick=()=>rotateCurrent(-45);
  el("rotateRightBtn").onclick=()=>rotateCurrent(45);
  document.querySelectorAll(".part").forEach(b=>b.onclick=()=>setPart(b.dataset.part)); document.querySelectorAll(".tool").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
  ["keyword","partFilter","categoryFilter","tagFilter"].forEach(id=>{el(id).oninput=renderSearch;el(id).onchange=renderSearch;});
  el("clearSearchBtn").onclick=()=>{el("keyword").value="";el("partFilter").value="";el("categoryFilter").value="";el("tagFilter").value="";renderSearch();};
  el("saveMastersBtn").onclick=readMastersUI;
  el("surfaceType").onchange=()=>{masters.surfaceType=el("surfaceType").value;saveMasters();renderAll();renderBoard();toast("コート仕様を変更しました");};
  el("newMatchBtn").onclick=clearMatchForm;
  el("saveMatchBtn").onclick=saveMatch;
  ["firstOwn","firstOpp","secondOwn","secondOpp"].forEach(id=>{el(id).oninput=updateMatchTotal;});
  clearMatchForm();
  el("logoFileInput").onchange=(e)=>setLogoFromFile(e.target.files[0]);
  el("clearLogoBtn").onclick=clearLogo;
  el("saveSyncSettingBtn").onclick=saveSyncSetting; el("pushBtn").onclick=pushDrive; el("pullBtn").onclick=pullDrive; el("downloadBtn").onclick=downloadJson;
  setTool("attack"); updateRotation(); renderBoard(); renderAll();
});
