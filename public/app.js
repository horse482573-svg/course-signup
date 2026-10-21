/* 公司課程報名 — front end (talks to /api on Cloudflare Pages Functions) */
"use strict";

const ls = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} },
};
const ss = {
  get(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ sessionStorage.setItem(k,v); }catch(e){} },
  del(k){ try{ sessionStorage.removeItem(k); }catch(e){} },
};

const PF = ["unit","division","name","title"];
const PF_LABEL = {unit:"業務單位",division:"事業部名稱",name:"姓名",title:"職稱"};
const profileOf = o => ({unit:o?.unit||"", division:o?.division||"", name:o?.name||"", title:o?.title||""});
const profileDone = o => !!o && PF.every(k=>String(o[k]||"").trim());
const subline = r => [r.unit, r.division, r.title].filter(Boolean).join(" · ");
const normName = s => String(s||"").replace(/[\s　·．.\-_()（）]/g,"").toLowerCase();
const normUnit = s => String(s||"").replace(/[\s　]/g,"").toLowerCase();
const keyOf = p => normName(p.name) + "|" + normUnit(p.unit);

let savedMe = null; try{ savedMe = JSON.parse(ls.get("cs-profile")); }catch(e){}
const S = {
  tab:"shelf", courses:[], signups:[], rosters:{}, loaded:false,
  me: profileDone(savedMe) ? profileOf(savedMe) : null,
  adminKey: ss.get("cs-admin")||"", isOwner:false,
  editing:null, confirmDel:null, pendingJoin:null, busy:false, editProfile:false, loginOpen:false,
  draft:{poster:"",payQr:""}, uploaded:[],
  importing:null, impRows:null, impMode:"replace", impText:"", impBusy:false,
};
const myKey = () => S.me ? keyOf(S.me) : null;
/* 「不再提醒」：只存在這台裝置 */
let skipIds = []; try{ skipIds = JSON.parse(ls.get("cs-skip")||"[]"); }catch(e){}
S.skip = new Set(Array.isArray(skipIds) ? skipIds : []);
const isSkipped = c => S.skip.has(c.id) && !myState(c);
function toggleSkip(id){ if(S.skip.has(id)) S.skip.delete(id); else S.skip.add(id); ls.set("cs-skip", JSON.stringify([...S.skip])); }
/* 本站報名：暫停中。沒有報名連結的課程，名單以舉辦人匯入的官方名單為準。改成 true 即可恢復。 */
const ALLOW_ONSITE = false;

const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const WD = ["日","一","二","三","四","五","六"];
const blob = id => /^(\/|https?:)/.test(id) ? id : "/api/image/" + encodeURIComponent(id);

function toast(msg){ const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast.h); toast.h=setTimeout(()=>t.hidden=true,2600); }
function today(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function fmtTime(iso){ if(!iso) return ""; const d=new Date(iso); if(isNaN(d)) return ""; return (d.getMonth()+1)+"/"+d.getDate()+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }

/* ---------- API ---------- */
async function api(path, body, opts={}){
  const headers = {};
  if(path.startsWith("admin/") || (path.startsWith("state") && S.adminKey)) headers["x-admin-key"] = opts.key ?? S.adminKey;
  let init = {method: body===undefined ? "GET" : "POST", headers};
  if(body instanceof Blob){ init.body = body; headers["content-type"] = body.type; }
  else if(body!==undefined){ init.body = JSON.stringify(body); headers["content-type"] = "application/json"; }
  let r;
  try{ r = await fetch("/api/"+path, init); }catch(e){ throw {error:"network"}; }
  let j = null; try{ j = await r.json(); }catch(e){}
  if(!j || !j.ok) throw (j || {error:"server"});
  return j;
}
const MSG = {
  onsite_closed:"本站報名暫停中，報名方式請洽課程舉辦人", network:"連線失敗，請檢查網路後再試一次", full:"這堂課已額滿", closed:"這堂課已截止報名",
  bad_input:"資料不完整，請檢查後再試", not_found:"找不到這堂課，可能已被刪除",
  bad_key:"管理密碼不對，請重新登入", no_password:"網站還沒設定管理密碼（ADMIN_PASSWORD）",
  too_large:"圖片太大，請換一張小一點的圖片", unsupported_type:"不支援這種圖片格式，請用 JPG 或 PNG",
};
const errMsg = e => MSG[e && e.error] || "操作沒有成功，請稍後再試";

/* 瀏覽統計：每次開啟網頁記一次（課程舉辦人自己不計） */
function logVisit(){
  if(S.isOwner || location.hash==="#admin") return;
  let vid = ls.get("cs-vid");
  if(!vid){ vid = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)+Date.now()).replace(/-/g,"").slice(0,20); ls.set("cs-vid", vid); }
  api("visit", {vid, named: !!S.me}).catch(()=>{});
}
async function loadVisits(){
  if(!S.isOwner) return;
  try{ S.visits = (await api("admin/visits",{})).days; }catch(e){}
}
function visitsBox(){
  const d = S.visits;
  if(!d) return "";
  const td = today();
  const t = d.find(x=>x.day===td) || {views:0,people:0,named:0};
  const last7 = d.filter(x=>x.day > new Date(Date.now()+8*3600e3-7*864e5).toISOString().slice(0,10));
  const sum = k => last7.reduce((a,x)=>a+(+x[k]||0),0);
  const rows = d.slice(0,14);
  const max = Math.max(1,...rows.map(x=>+x.views||0));
  return `<section class="panel visits"><h2>瀏覽統計</h2>
    <div class="vstats">
      <div><span>今天人次</span><b>${t.views}</b></div>
      <div><span>今天人數</span><b>${t.people}</b></div>
      <div><span>近 7 天人次</span><b>${sum("views")}</b></div>
      <div><span>近 7 天人數（每天加總）</span><b>${sum("people")}</b></div>
    </div>
    ${rows.length?`<table class="vtable"><thead><tr><th>日期</th><th>人次</th><th>人數</th><th>已填資料</th><th class="vbar-h" aria-hidden="true"></th></tr></thead><tbody>
      ${rows.map(x=>`<tr><td>${esc(x.day.slice(5).replace("-","/"))}</td><td>${x.views}</td><td>${x.people}</td><td>${x.named}</td><td class="vbar-c" aria-hidden="true"><i style="width:${Math.round((+x.views||0)/max*100)}%"></i></td></tr>`).join("")}
    </tbody></table>`:`<p class="hint">從 10/19 開始記錄，還沒有資料。</p>`}
    <p class="hint">人次＝網頁被開啟的次數；人數＝不同的手機或電腦數；已填資料＝其中有填報名資料的人數。你登入課程管理時的瀏覽不計入。</p>
  </section>`;
}
async function refresh(soft){
  try{
    const q = S.me ? "?"+new URLSearchParams({n:S.me.name||"", d:S.me.division||"", u:S.me.unit||""}) : "";
    const r = await api("state"+q);
    S.courses = r.courses; S.signups = r.signups; S.rosters = r.rosters || {};
    S.loaded = true;
    $("#sync").textContent = "最後更新 " + fmtTime(new Date().toISOString()) + " · 每 20 秒自動更新";
  }catch(e){
    $("#sync").textContent = "連線失敗，稍後會自動重試";
    if(!S.loaded){ $("#view").innerHTML = `<div class="empty"><strong>課程暫時無法載入</strong>請確認網路後重新整理頁面。</div>`; return; }
  }
  render(soft);
}

/* ---------- derived data ---------- */
function rosterFor(cid){ return S.signups.filter(s=>s.course_id===cid).map(s=>({...profileOf(s), pkey:s.pkey, at:s.at, mk:s.mk, me:s.me})); }
function myRec(cid){ const k=myKey(); return k ? S.signups.find(s=>s.course_id===cid && s.pkey===k) : null; }
/* 名單遮名：非本人顯示「湛O揚」（舉辦人登入時顯示全名） */
function maskName(n){
  const a=[...String(n||"").trim()];
  if(a.length<=1 || /^未具名/.test(a.join(""))) return a.join("");
  if(a.length===2) return a[0]+"O";
  return a[0]+"O".repeat(a.length-2)+a[a.length-1];
}
/* 伺服器會把非本人的名字先遮好，並標記 me＝這筆是不是目前這位同事 */
const isMeP = p => !!S.me && (p.me===true || (p.me===undefined && ((p.pkey && p.pkey===myKey()) || sameP(S.me,p))));
const shownName = p => (S.isOwner || isMeP(p)) ? p.name : maskName(p.name);
function sameP(a,b){
  if(a.mk && b.mk){ if(a.mk!==b.mk) return false; }
  else { const na=normName(a.name); if(!na || na!==normName(b.name)) return false; }
  // 核對規則：姓名＋事業部相符即可（不看業務單位、職稱）。事業部允許包含關係，例如「紅包聯」＝「紅包聯事業部」
  const da=normUnit(a.division), db=normUnit(b.division);
  return !da || !db || da===db || da.includes(db) || db.includes(da);
}
const entryOf = o => ({...profileOf(o), meal:o?.meal||"", drink:o?.drink||"", award:o?.award||"", mk:o?.mk, me:o?.me});
const isMeal = c => c && c.kind==="meal";
const isAward = c => c && c.kind==="award";
function myMeal(c){ if(!isMeal(c) || !S.me) return null; return officialFor(c.id).find(isMeP) || null; }
const officialFor = cid => (S.rosters[cid] && S.rosters[cid].entries) || [];
const rosterInfo = cid => S.rosters[cid] || null;
function peopleFor(c){
  const ext = !!c.signupUrl;
  const off = officialFor(c.id).map(e=>({...entryOf(e), used:false}));
  const out = rosterFor(c.id).map(p=>{
    const i = off.findIndex(o=>!o.used && sameP(p,o));
    if(i>=0) off[i].used = true;
    const m = i>=0 ? {meal:off[i].meal, drink:off[i].drink} : {meal:"", drink:""};
    if(!ext) return {...p, ...m, confirmed:true, src:"page"};
    return {...p, ...m, confirmed:i>=0, src:i>=0?"both":"self"};
  });
  for(const o of off) if(!o.used) out.push({...entryOf(o), pkey:null, at:"", confirmed:true, src:ext?"official":"list"});
  return out;
}
const SRC_LABEL = {page:"本頁報名", both:"已確認", self:"待確認", official:"官方名單（未回報）", list:"官方名單"};
/* null | "confirmed" | "pending" | "missing" */
function myState(c){
  const rec = myRec(c.id);
  if(S.me && officialFor(c.id).some(isMeP)) return "confirmed";
  if(!c.signupUrl) return rec ? "confirmed" : null;
  if(!rec) return null;
  const info = rosterInfo(c.id);
  return (info && String(info.importedAt||"") > String(rec.at||"")) ? "missing" : "pending";
}
function isMine(cid){ const c=S.courses.find(x=>x.id===cid); return !!(c && myState(c)); }
const sortedAwards = () => S.courses.filter(isAward).sort((a,b)=>awardRank(a)-awardRank(b) || String(a.endDate||a.date||"").localeCompare(String(b.endDate||b.date||"")));
const sortedCourses = () => [...S.courses].filter(c=>!isAward(c)).sort((a,b)=>String(a.date||"9999").localeCompare(String(b.date||"9999")));

/* ---------- render ---------- */
function render(soft){
  $("#n-all").textContent = sortedCourses().length;
  $("#n-mine").textContent = sortedCourses().filter(c=>isMine(c.id)).length;
  $("#n-award").textContent = sortedAwards().length;
  $("#tab-admin").hidden = !S.isOwner;
  if(S.tab==="admin" && !S.isOwner) S.tab="shelf";
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-selected", String(b.dataset.tab===S.tab && !S.loginOpen)));
  $("#adminBtn").textContent = S.isOwner ? "登出課程管理" : "舉辦人登入";
  $("#adminBtn").dataset.act = S.isOwner ? "admin-logout" : "admin-login";
  renderWho(); renderProfilePanel();
  if(!S.loaded) return;
  const v = $("#view");
  if(S.loginOpen){ if(!soft) v.innerHTML = loginView(); return; }
  if(S.tab==="admin"){
    if(soft && ((S.editing && $("#courseForm")) || S.importing)) return;
    v.innerHTML = adminView();
  }
  else if(S.tab==="shelf") v.innerHTML = shelfView();
  else if(S.tab==="award") v.innerHTML = awardView();
  else v.innerHTML = listView(S.tab==="mine");
}
function renderWho(){
  $("#who").innerHTML = S.me
    ? `目前身分：<b>${esc(S.me.name)}</b> · ${esc(subline(S.me))}${S.isOwner?" · 課程舉辦人":""} <button class="btn link" data-act="edit-profile" style="padding:0 0 0 6px;font-size:13px">修改</button>`
    : `<button class="btn link" data-act="edit-profile" style="padding:0;font-size:13px">填寫我的報名資料</button>${S.isOwner?" · 課程舉辦人":""}`;
}

/* 課程總覽（書架） */
const STAMP = {confirmed:"已報名", pending:"已報名（待確認）", missing:"請確認報名"};
function shelfItem(c){
  const state = myState(c);
  const past = c.date && c.date < today();
  const cap = Number(c.capacity)||0, n = peopleFor(c).length;
  const tag = past ? "已結束" : c.status==="closed" ? "報名截止" : (cap>0 && n>=cap) ? "額滿" : "";
  const d = c.date ? new Date(c.date+"T00:00:00") : null;
  const when = d ? `${d.getMonth()+1} 月 ${d.getDate()} 日（${WD[d.getDay()]}）${c.time?" · "+esc(c.time):""}` : "日期待定";
  const cover = c.poster
    ? `<img src="${esc(blob(c.poster))}" alt="${esc(c.title)} 課程海報" loading="lazy">`
    : `<span class="ph"><span class="ph-date">${d?`${d.getMonth()+1}/${d.getDate()}`:"TBD"}</span><span class="ph-title">${esc(c.title)}</span><span class="ph-foot">${esc(c.instructor||c.location||"公司課程")}</span></span>`;
  const skipped = isSkipped(c);
  const skipCtl = (!state && !past) ? `<button type="button" class="skip-toggle${skipped?" on":""}" data-act="skip" data-id="${esc(c.id)}" aria-pressed="${skipped}"><span class="switch" aria-hidden="true"></span>不再提醒</button>` : "";
  return `<article class="book${past?" past":""}${skipped?" skipped":""}">
    <button type="button" class="cover" data-act="goto" data-id="${esc(c.id)}" aria-label="查看 ${esc(c.title)}">
      ${cover}
      ${c.hot&&!past?`<span class="hot-badge">近期最火</span>`:""}
      ${state?`<span class="stamp stamp-${state}">${STAMP[state]}</span>`:(skipped?`<span class="stamp stamp-skip">不參加</span>`:"")}
      ${tag?`<span class="tag">${tag}</span>`:""}
    </button>
    <div class="book-meta"><div class="bt">${esc(c.title)}</div><div class="bd">${when}</div>${(()=>{ const m=myMeal(c); return m&&(m.meal||m.drink)?`<div class="bd meal-line">我的餐點：${esc([m.meal,m.drink].filter(Boolean).join(" ＋ "))}</div>`:(isMeal(c)?`<div class="bd">附餐點</div>`:""); })()}</div>
    ${(()=>{ if(isAward(c)) return "";
      if(cap>0){ const pct=Math.min(100,Math.round(n/cap*100)), full=n>=cap;
        return `<div class="prog${full?" full":""}"><div class="prog-top"><span>已報名 <b>${n}</b> / ${cap} 人</span><span>${full?"額滿":"剩 "+(cap-n)+" 位"}</span></div><div class="prog-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${cap}" aria-valuenow="${n}" aria-label="報名人數"><i style="width:${pct}%"></i></div></div>`; }
      return `<div class="prog"><div class="prog-top"><span>已報名 <b>${n}</b> 人</span><span>不限名額</span></div></div>`; })()}
    <button type="button" class="btn ${state||skipped?"":"primary "}block" data-act="goto" data-id="${esc(c.id)}">${state?"查看報名狀態":skipped?"查看課程":"前往報名"}</button>
    ${skipCtl}
  </article>`;
}
function shelfView(){
  const cs = sortedCourses();
  if(!cs.length) return listView(false);
  const up = cs.filter(c=>!(c.date && c.date<today())).sort((a,b)=>((myState(a)||isSkipped(a))?1:0)-((myState(b)||isSkipped(b))?1:0));
  const past = cs.filter(c=>c.date && c.date<today());
  return (up.length?`<div class="shelf">${up.map(shelfItem).join("")}</div>`:`<div class="empty"><strong>目前沒有即將開課的課程</strong>新課程發布後會出現在這裡。</div>`)
    + (past.length?`<h2 class="shelf-h">已結束的課程</h2><div class="shelf">${past.map(shelfItem).join("")}</div>`:"");
}
function gotoCourse(id){
  S.tab="all"; S.loginOpen=false; render();
  try{ history.replaceState(null,"","#c-"+id); }catch(e){}
  const el = document.getElementById("c-"+id); if(!el) return;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({behavior:reduce?"auto":"smooth", block:"start"});
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
}

function extHost(u){ try{ return new URL(u).hostname.replace(/^www\./,""); }catch(e){ return ""; } }
const goLink = (c, primary) => `<a class="btn${primary?" primary":""}" href="${esc(c.signupUrl)}" target="_blank" rel="noopener noreferrer">前往報名 ↗</a>`;
function extActions(c, state, closed){
  if(S.pendingJoin===c.id && S.me){
    return `<span class="who">你已經在報名系統送出報名了嗎？</span>
      <button class="btn primary" data-act="join-yes" data-id="${esc(c.id)}" ${S.busy?"disabled":""}>是，我已完成報名</button>
      <button class="btn link" data-act="join-no">還沒</button>`;
  }
  if(state==="confirmed") return `<span class="note">已在官方報名名單中找到你，報名完成。</span>`;
  if(state==="pending") return `${closed?"":goLink(c,false)}<button class="btn link" data-act="leave" data-id="${esc(c.id)}" ${S.busy?"disabled":""}>撤回回報</button>
      <span class="note">你已回報完成報名，等課程舉辦人核對官方名單後會變成「已確認」。</span>`;
  if(state==="missing") return `${closed?"":goLink(c,true)}<button class="btn link" data-act="leave" data-id="${esc(c.id)}" ${S.busy?"disabled":""}>撤回回報</button>
      <span class="note warn">舉辦人最近核對的官方名單裡找不到你。請確認報名表是否有送出成功，或姓名、業務單位是否填寫一致；確定有送出請聯絡舉辦人。</span>`;
  if(closed) return "";
  return `${goLink(c,true)}<button class="btn" data-act="join" data-id="${esc(c.id)}">我已完成報名</button>
    <span class="note">在 ${esc(extHost(c.signupUrl)||"報名系統")} 送出報名後，回來按「我已完成報名」。</span>`;
}

function courseCard(c){
  const people = peopleFor(c);
  const n = people.length, cap = Number(c.capacity)||0;
  const full = cap>0 && n>=cap, ext = !!c.signupUrl;
  const state = myState(c), mine = !!state;
  const past = c.date && c.date < today();
  const closed = c.status==="closed" || past;
  const d = c.date ? new Date(c.date+"T00:00:00") : null;
  const pct = cap>0 ? Math.min(100, Math.round(n/cap*100)) : 0;
  let pills = "";
  if(state==="confirmed") pills += `<span class="pill mine">✓ 已經報名了</span>`;
  else if(state==="pending") pills += `<span class="pill pending">已報名（待確認）</span>`;
  else if(state==="missing") pills += `<span class="pill miss">⚠ 名單中找不到你</span>`;
  if(c.hot && !past) pills += `<span class="pill hot">近期最火</span>`;
  if(isMeal(c)) pills += `<span class="pill closed">附餐點</span>`;
  if(past) pills += `<span class="pill closed">已結束</span>`;
  else if(c.status==="closed") pills += `<span class="pill closed">報名截止</span>`;
  else if(full) pills += `<span class="pill full">額滿</span>`;

  let action = "";
  if(ext) action = extActions(c, state, closed);
  else if(S.pendingJoin===c.id && S.me){
    action = `<span class="who">確認以 <b>${esc(S.me.name)}</b> 報名？</span>
      <button class="btn primary" data-act="join-yes" data-id="${esc(c.id)}" ${S.busy?"disabled":""}>確認報名</button>
      <button class="btn link" data-act="join-no">取消</button>`;
  } else if(mine && !myRec(c.id)){
    action = `<span class="note">已在官方報名名單中找到你，報名完成。</span>`;
  } else if(mine){
    action = closed ? `<span class="who">你已報名這堂課</span>`
      : `<button class="btn" data-act="leave" data-id="${esc(c.id)}" ${S.busy?"disabled":""}>取消報名</button>`;
  } else if(!closed && !full && ALLOW_ONSITE){
    action = `<button class="btn primary" data-act="join" data-id="${esc(c.id)}">我要報名</button>`;
  } else if(!closed){
    action = `<span class="note">報名方式請洽課程舉辦人。舉辦人更新名單後，你的報名狀態會顯示在這裡${S.me?"":"（請先點右上角填寫報名資料，才能比對到你）"}。</span>`;
  }
  const k = myKey();
  return `<article class="course${past?" past":""}" id="c-${esc(c.id)}">
    <div class="date">${d?`<span class="m">${d.getMonth()+1} 月</span><span class="d">${d.getDate()}</span><span class="w">週${WD[d.getDay()]}</span>`:`<span class="m">日期</span><span class="d">—</span><span class="w">待定</span>`}</div>
    <div class="body">
      <div class="title-row"><h3>${esc(c.title)}</h3>${pills}</div>
      <div class="meta">
        ${c.time?`<span>時間 <b>${esc(c.time)}</b></span>`:""}
        ${c.location?`<span>地點 <b>${esc(c.location)}</b></span>`:""}
        ${c.instructor?`<span>講師 <b>${esc(c.instructor)}</b></span>`:""}
      </div>
      ${c.poster?`<button type="button" class="poster" data-act="zoom" data-src="${esc(blob(c.poster))}" aria-label="放大海報"><img src="${esc(blob(c.poster))}" alt="${esc(c.title)} 課程海報" loading="lazy"></button>`:""}
      ${c.summary?`<p class="summary">${esc(c.summary)}</p>`:""}
      ${c.detail?`<details class="more"><summary>課程詳細介紹</summary><p>${esc(c.detail)}</p></details>`:""}
      ${(c.payQr||c.payNote)?`<details class="more pay"${mine?" open":""}><summary>繳費資訊${mine?"（你已報名，請依下方資訊完成繳費）":""}</summary>
        <div class="payrow">${c.payQr?`<img class="qr" src="${esc(blob(c.payQr))}" alt="繳費 QR Code" data-act="zoom" data-src="${esc(blob(c.payQr))}">`:""}${c.payNote?`<p>${esc(c.payNote)}</p>`:""}</div></details>`:""}
      <div class="seats">
        ${cap>0?`<div class="bar${full?" full":""}"><i style="width:${pct}%"></i></div><span>已報名 <span class="num">${n}</span> / <span class="num">${cap}</span> 人</span>`
               :`<span>已報名 <span class="num">${n}</span> 人</span><span class="who">不限名額</span>`}
      </div>
      <div class="actions">${action}</div>
      ${isMeal(c)?mealBox(c, state):""}
      <div class="roster">
        <h4>報名名單${rosterInfo(c.id)?` · 已於 ${fmtTime(rosterInfo(c.id).importedAt)} 核對官方名單`:""}</h4>
        ${n?`<div class="chips">${people.map(r=>`<span class="chip${r.pkey&&r.pkey===k?" me":""}${r.confirmed?"":" pend"}">${esc(shownName(r))}${subline(r)?`<small>${esc(subline(r))}</small>`:""}${r.confirmed?"":`<small>待確認</small>`}</span>`).join("")}</div>`
           :`<span class="who">還沒有人報名，成為第一位吧。</span>`}
      </div>
    </div>
  </article>`;
}
function mealBox(c, state){
  const m = myMeal(c);
  if(m && (m.meal||m.drink)) return `<div class="mealbox"><span class="mealbox-h">你報名時點的餐點</span>
    <div class="mealbox-row">${m.meal?`<span><small>早餐</small><b>${esc(m.meal)}</b></span>`:""}${m.drink?`<span><small>飲料</small><b>${esc(m.drink)}</b></span>`:""}</div></div>`;
  if(!S.me) return `<div class="mealbox"><span class="mealbox-h">這堂課附餐點</span><span class="who">點右上角「填寫我的報名資料」，就能看到你點的早餐和飲料。</span></div>`;
  if(state) return `<div class="mealbox"><span class="mealbox-h">這堂課附餐點</span><span class="who">名單上還沒有你的餐點紀錄，請洽課程舉辦人。</span></div>`;
  return "";
}
function tallyHTML(list){
  const cnt = k => { const m=new Map(); for(const p of list){ const v=(p[k]||"").trim(); if(v) m.set(v,(m.get(v)||0)+1); } return [...m].sort((a,b)=>b[1]-a[1]); };
  const t = (title, arr) => arr.length ? `<div class="tally"><h4>${title}</h4>${arr.map(([k,n])=>`<div class="tally-row"><span>${esc(k)}</span><span class="num">${n}</span></div>`).join("")}<div class="tally-row tally-sum"><span>合計</span><span class="num">${arr.reduce((s,x)=>s+x[1],0)}</span></div></div>` : "";
  const a = t("早餐", cnt("meal")), b = t("飲料", cnt("drink"));
  return a||b ? `<div class="tallies">${a}${b}</div>` : `<p class="hint">匯入含「早餐」「飲料」欄的名單後，這裡會自動統計訂餐數量。</p>`;
}

/* ---------- 公司獎勵總覽 ---------- */
function awardStatus(a){
  const t = today(), s = a.date||"", e = a.endDate||"";
  if(s && t < s) return {key:"soon", label:"即將開始"};
  if(e && t > e) return {key:"ended", label:"已結束"};
  return {key:"on", label:"進行中"};
}
function awardRank(a){ return {on:0, soon:1, ended:2}[awardStatus(a).key]; }
function fmtDay(d){ if(!d) return ""; const x=new Date(d+"T00:00:00"); return `${x.getFullYear()}/${x.getMonth()+1}/${x.getDate()}（${WD[x.getDay()]}）`; }
function daysLeft(e){ if(!e) return null; const a=new Date(today()+"T00:00:00"), b=new Date(e+"T00:00:00"); return Math.round((b-a)/86400000); }
function myAwards(a){ if(!S.me) return []; return officialFor(a.id).filter(isMeP); }
function awardCard(a){
  const st = awardStatus(a), list = officialFor(a.id), info = rosterInfo(a.id), mine = myAwards(a), k = S.me ? S.me : null;
  const left = daysLeft(a.endDate);
  const period = (a.date||a.endDate) ? `${fmtDay(a.date)||"即日起"} – ${fmtDay(a.endDate)||"另行公告"}` : "請見注意事項";
  const counts = new Map(); for(const p of list){ const v=(p.award||"").trim(); if(v) counts.set(v,(counts.get(v)||0)+1); }
  let me = "";
  if(mine.length) me = `<div class="mealbox award-me"><span class="mealbox-h">恭喜你已達成</span><div class="award-me-list">${mine.map(m=>`<b>${esc(m.award||"本獎勵")}</b>`).join("")}</div></div>`;
  else if(!S.me) me = `<div class="mealbox"><span class="who">點右上角「填寫我的報名資料」，就能看到你是否已達成這個獎勵。</span></div>`;
  else if(info && st.key!=="soon") me = `<div class="mealbox"><span class="who">目前名單上還沒有你${st.key==="on"?"，繼續加油！":"。"}</span></div>`;
  return `<article class="award${st.key==="ended"?" past":""}" id="a-${esc(a.id)}">
    ${a.poster?`<button type="button" class="award-poster" data-act="zoom" data-src="${esc(blob(a.poster))}" aria-label="放大獎勵海報"><img src="${esc(blob(a.poster))}" alt="${esc(a.title)} 海報" loading="lazy"></button>`
      :`<div class="award-poster ph-award"><span>${esc(a.title)}</span></div>`}
    <div class="award-body">
      <div class="title-row"><h3>${esc(a.title)}</h3><span class="pill ${st.key==="on"?"mine":st.key==="soon"?"pending":"closed"}">${st.label}</span></div>
      <div class="award-period"><small>獎勵期間</small><b>${esc(period)}</b>${st.key==="on"&&left!==null&&left>=0?`<span class="who">${left===0?"今天截止":`還有 ${left} 天`}</span>`:""}</div>
      ${a.summary?`<p class="summary">${esc(a.summary)}</p>`:""}
      ${me}
      ${a.detail?`<div class="award-notes"><h4>獎勵注意事項</h4><p>${esc(a.detail)}</p></div>`:""}
      <div class="roster">
        <h4>目前達成名單 · ${list.length} 人${info?` · ${fmtTime(info.importedAt)} 更新`:""}</h4>
        ${counts.size>1?`<div class="chips" style="margin-bottom:8px">${[...counts].map(([n,c])=>`<span class="chip">${esc(n)}<small>${c} 人</small></span>`).join("")}</div>`:""}
        ${list.length?`<div class="tbl"><table><thead><tr><th>#</th><th>事業部</th><th>姓名</th><th>達成獎勵</th></tr></thead><tbody>
          ${list.map((p,i)=>`<tr class="${isMeP(p)?"row-me":""}"><td class="t">${i+1}</td><td>${esc(p.division||"—")}</td><td>${esc(shownName(p))}</td><td>${esc(p.award||"—")}</td></tr>`).join("")}
        </tbody></table></div>`:`<span class="who">${st.key==="soon"?"獎勵尚未開始。":"名單整理中，公布後會顯示在這裡。"}</span>`}
      </div>
    </div>
  </article>`;
}
function awardShelfItem(a){
  const st = awardStatus(a), mine = myAwards(a), n = officialFor(a.id).length;
  const period = `${a.date?fmtDay(a.date).replace(/^\d{4}\//,""):"即日起"} – ${a.endDate?fmtDay(a.endDate).replace(/^\d{4}\//,""):"另行公告"}`;
  const cover = a.poster
    ? `<img src="${esc(blob(a.poster))}" alt="${esc(a.title)} 海報" loading="lazy">`
    : `<span class="ph ph-gold"><span class="ph-date">獎勵</span><span class="ph-title">${esc(a.title)}</span><span class="ph-foot">${esc(period)}</span></span>`;
  return `<article class="book${st.key==="ended"?" past":""}">
    <button type="button" class="cover" data-act="goto-award" data-id="${esc(a.id)}" aria-label="查看 ${esc(a.title)}">
      ${cover}
      ${mine.length?`<span class="stamp stamp-confirmed">已達成</span>`:""}
      <span class="tag">${st.label}</span>
    </button>
    <div class="book-meta"><div class="bt">${esc(a.title)}</div><div class="bd">${esc(period)}</div>
      ${mine.length?`<div class="bd meal-line">我的獎勵：${esc(mine.map(m=>m.award||"已達成").join("、"))}</div>`:(n?`<div class="bd">已達成 ${n} 人</div>`:"")}</div>
    <button type="button" class="btn ${mine.length?"":"primary "}block" data-act="goto-award" data-id="${esc(a.id)}">查看獎勵內容</button>
  </article>`;
}
function awardView(){
  const as = sortedAwards();
  const open = S.awardOpen && as.find(a=>a.id===S.awardOpen);
  if(open) return `<div class="award-back"><button type="button" class="btn link" data-act="award-back">← 回到獎勵總覽</button></div><div class="list">${awardCard(open)}</div>`;
  const head = `<div class="award-head"><h2>公司獎勵總覽</h2><span class="who">點海報查看獎勵期間、注意事項與達成名單</span></div>`;
  if(!as.length) return head + `<div class="empty"><strong>目前沒有公布中的獎勵</strong>${S.isOwner?"到「課程管理」按「新增獎勵」建立第一個。":"公司獎勵公布後會出現在這裡。"}</div>`;
  const live = as.filter(a=>awardStatus(a).key!=="ended"), ended = as.filter(a=>awardStatus(a).key==="ended");
  return head + (live.length?`<div class="shelf">${live.map(awardShelfItem).join("")}</div>`:`<div class="empty"><strong>目前沒有進行中的獎勵</strong>新獎勵公布後會出現在這裡。</div>`)
    + (ended.length?`<h2 class="shelf-h">已結束的獎勵</h2><div class="shelf">${ended.map(awardShelfItem).join("")}</div>`:"");
}
function gotoAward(id){
  S.tab="award"; S.awardOpen=id; S.loginOpen=false; render();
  try{ history.replaceState(null,"","#a-"+id); }catch(e){}
  window.scrollTo({top:0});
}

function listView(onlyMine){
  let cs = sortedCourses();
  if(onlyMine) cs = cs.filter(c=>isMine(c.id));
  if(!cs.length){
    if(onlyMine) return `<div class="empty"><strong>你還沒有報名任何課程</strong>${S.me?"到「課程總覽」挑一堂吧。":"如果你在別台裝置報名過，點右上角「填寫我的報名資料」，填一樣的業務單位和姓名就會顯示。"}</div>`;
    return S.isOwner
      ? `<div class="empty"><strong>還沒有課程</strong>到「課程管理」新增第一堂課，同事就能在這裡看到並報名。<div style="margin-top:14px"><button class="btn primary" data-act="goto-new">新增課程</button></div></div>`
      : `<div class="empty"><strong>目前沒有開放的課程</strong>課程舉辦人新增課程後，會自動出現在這裡。</div>`;
  }
  const upcoming = cs.filter(c=>!(c.date && c.date<today()));
  const past = cs.filter(c=>c.date && c.date<today());
  return `<div class="list">${upcoming.map(courseCard).join("")}</div>`
    + (past.length?`<h2 class="shelf-h">已結束的課程</h2><div class="list">${past.map(courseCard).join("")}</div>`:"");
}

/* ---------- 舉辦人 ---------- */
function loginView(){
  return `<section class="panel"><h2>舉辦人登入</h2>
    <form id="loginForm"><label>管理密碼<input id="l-key" type="password" autocomplete="current-password"></label>
    <div class="form-foot"><span class="err" id="lErr"></span><button type="button" class="btn link" data-act="login-cancel">取消</button><button type="submit" class="btn primary">登入</button></div></form></section>`;
}
function awardForm(c, e){
  return `<section class="panel">
    <h2>${e==="new"?"新增公司獎勵":"編輯公司獎勵"}</h2>
    <form id="courseForm">
      <div class="grid">
        <label class="full">獎勵名稱 *<input id="f-title" required maxlength="80" value="${esc(c.title)}" placeholder="例如：2026 第四季業績衝刺獎勵"></label>
        <label>獎勵期間（開始）<input id="f-date" type="date" value="${esc(c.date)}"></label>
        <label>獎勵期間（結束）<input id="f-end" type="date" value="${esc(c.endDate)}"></label>
        <label class="full">一句話簡介<input id="f-summary" maxlength="140" value="${esc(c.summary)}" placeholder="例如：期間內 FYC 達 30 萬即可獲得海外旅遊"></label>
        <label class="full">獎勵注意事項<textarea id="f-detail" maxlength="3000" rows="8" placeholder="獎勵辦法、計算方式、發放時間、資格限制…">${esc(c.detail)}</textarea></label>
        <div class="full upl"><span>獎勵海報（JPG、PNG、WebP；大圖會自動壓縮）</span><div class="upl-row" id="slot-poster">${uploadSlot("poster")}</div></div>
      </div>
      <div class="form-foot"><span class="err" id="formErr"></span>
        <button type="button" class="btn link" data-act="cancel-edit">取消</button>
        <button type="submit" class="btn primary" ${S.busy?"disabled":""}>${e==="new"?"發布獎勵":"儲存變更"}</button>
      </div>
    </form></section>`;
}
function awardAdminRow(a){
  const list = officialFor(a.id), info = rosterInfo(a.id), st = awardStatus(a);
  const del = S.confirmDel===a.id ? `<div class="confirm">刪除「${esc(a.title)}」？達成名單會一起刪除，無法復原。
      <button class="btn danger" data-act="del-yes" data-id="${esc(a.id)}">確定刪除</button><button class="btn link" data-act="del-no">取消</button></div>` : "";
  return `<section class="panel">
    <div class="title-row" style="justify-content:space-between">
      <div class="title-row"><h3 style="font-size:17px">${esc(a.title)}</h3><span class="pill ${st.key==="on"?"mine":st.key==="soon"?"pending":"closed"}">${st.label}</span></div>
      <span class="seats"><span>已達成 <span class="num">${list.length}</span> 人</span></span>
    </div>
    <div class="meta" style="margin:4px 0 12px">獎勵期間：${esc(fmtDay(a.date)||"即日起")} – ${esc(fmtDay(a.endDate)||"另行公告")}${info?` · 名單 ${fmtTime(info.importedAt)} 匯入`:" · 尚未匯入達成名單"}</div>
    ${list.length?`<div class="tbl"><table><thead><tr><th>#</th><th>事業部</th><th>姓名</th><th>達成獎勵</th></tr></thead><tbody>
      ${list.map((p,i)=>`<tr><td class="t">${i+1}</td><td>${esc(p.division||"—")}</td><td>${esc(p.name)}</td><td>${esc(p.award||"—")}</td></tr>`).join("")}
    </tbody></table></div>`:""}
    ${S.importing===a.id?importBox(a):""}
    <div class="actions" style="margin-top:12px">
      ${S.importing!==a.id?`<button class="btn primary" data-act="imp-open" data-id="${esc(a.id)}">${info?"更新達成名單":"匯入達成名單"}</button>`:""}
      <button class="btn" data-act="edit" data-id="${esc(a.id)}">編輯</button>
      ${list.length?`<button class="btn" data-act="csv" data-id="${esc(a.id)}">下載名單 CSV</button>`:""}
      <button class="btn link" data-act="goto-award" data-id="${esc(a.id)}">查看同事看到的畫面</button>
      <button class="btn danger" data-act="del" data-id="${esc(a.id)}">刪除</button>
    </div>${del}
  </section>`;
}
function adminView(){
  const e = S.editing;
  const c = e && e!=="new" ? (S.courses.find(x=>x.id===e)||{}) : {};
  const form = e && S.editKind==="award" ? awardForm(c, e) : e ? `<section class="panel">
    <h2>${e==="new"?"新增課程":"編輯課程"}</h2>
    <form id="courseForm">
      <div class="grid">
        <label class="full">課程名稱 *<input id="f-title" required maxlength="80" value="${esc(c.title)}" placeholder="例如：Excel 樞紐分析實戰"></label>
        <label class="full">課程類型<select id="f-kind"><option value="general"${c.kind!=="meal"?" selected":""}>一般專班</option><option value="meal"${c.kind==="meal"?" selected":""}>有餐點的專班（名單可匯入早餐、飲料，同事看得到自己點的餐）</option></select></label>
        <label class="full check"><input type="checkbox" id="f-hot" ${c.hot?"checked":""}> 標示為「近期最火」（課程總覽的海報會出現火紅標籤）</label>
        <label class="full">報名連結（選填）<input id="f-url" type="text" inputmode="url" autocomplete="off" maxlength="2000" value="${esc(c.signupUrl)}" placeholder="貼上 Google 表單或其他報名系統的網址，例如 https://forms.gle/…">
          <span class="hint">留空：卡片不顯示報名按鈕，名單以你匯入的官方名單為準。填入網址：卡片會出現「前往報名」按鈕，同事報完名回來按「我已完成報名」，你再匯入官方名單核對。</span></label>
        <label>日期<input id="f-date" type="date" value="${esc(c.date)}"></label>
        <label>時間<input id="f-time" maxlength="40" value="${esc(c.time)}" placeholder="14:00–16:00"></label>
        <label>地點<input id="f-location" maxlength="60" value="${esc(c.location)}" placeholder="3F 大會議室 / 線上"></label>
        <label>講師<input id="f-instructor" maxlength="40" value="${esc(c.instructor)}"></label>
        <label>名額（0 = 不限）<input id="f-capacity" type="number" min="0" step="1" value="${esc(c.capacity??0)}"></label>
        <label>報名狀態<select id="f-status"><option value="open"${c.status!=="closed"?" selected":""}>開放報名</option><option value="closed"${c.status==="closed"?" selected":""}>截止報名</option></select></label>
        <label class="full">一句話簡介<input id="f-summary" maxlength="140" value="${esc(c.summary)}" placeholder="這堂課能帶走什麼"></label>
        <label class="full">詳細介紹<textarea id="f-detail" maxlength="3000" placeholder="課程大綱、適合對象、需攜帶物品…">${esc(c.detail)}</textarea></label>
        <div class="full upl"><span>課程海報（JPG、PNG、WebP；大圖會自動壓縮）</span><div class="upl-row" id="slot-poster">${uploadSlot("poster")}</div></div>
        <fieldset class="full pay"><legend>繳費資訊</legend>
          <div class="upl"><span>繳費 QR Code 圖片</span><div class="upl-row" id="slot-payQr">${uploadSlot("payQr")}</div></div>
          <label>繳費說明<textarea id="f-paynote" maxlength="1000" placeholder="例如：費用 NT$500，請於 10/20 前轉帳，備註填寫姓名。&#10;銀行代碼 / 帳號、LINE Pay 或聯絡窗口…">${esc(c.payNote)}</textarea></label>
        </fieldset>
      </div>
      <div class="form-foot"><span class="err" id="formErr"></span>
        <button type="button" class="btn link" data-act="cancel-edit">取消</button>
        <button type="submit" class="btn primary" ${S.busy?"disabled":""}>${e==="new"?"發布課程":"儲存變更"}</button>
      </div>
    </form></section>`
    : `<div class="actions" style="margin-bottom:16px"><button class="btn primary" data-act="new">＋ 新增課程</button><button class="btn primary" data-act="new-award">＋ 新增獎勵</button>${S.courses.length?`<button class="btn" data-act="csv-all">下載全部報名名單 CSV</button>`:""}</div>`;

  return form + visitsBox() + adminTable();
}
function courseAdminRow(c){
    const r = peopleFor(c), cap=Number(c.capacity)||0, ext=!!c.signupUrl, info=rosterInfo(c.id);
    const nPend = r.filter(p=>!p.confirmed).length;
    const del = S.confirmDel===c.id ? `<div class="confirm">刪除「${esc(c.title)}」？這堂課的 ${r.length} 筆報名紀錄、官方名單和圖片會一起刪除，無法復原。
        <button class="btn danger" data-act="del-yes" data-id="${esc(c.id)}">確定刪除</button><button class="btn link" data-act="del-no">取消</button></div>` : "";
    return `<section class="panel">
      <div class="title-row" style="justify-content:space-between">
        <div class="title-row"><h3 style="font-size:17px">${esc(c.title)}</h3>${c.status==="closed"?`<span class="pill closed">報名截止</span>`:""}</div>
        <span class="seats"><span>已報名 <span class="num">${r.length}</span>${cap?` / <span class="num">${cap}</span>`:""} 人</span></span>
      </div>
      <div class="meta" style="margin:4px 0">${esc(c.date||"日期待定")} ${esc(c.time||"")} ${c.location?"· "+esc(c.location):""}</div>
      ${ext?`<div class="ext" style="margin-bottom:4px">外部報名：<a href="${esc(c.signupUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.signupUrl)}</a></div>
        <div class="hint" style="margin-bottom:12px">${info?`官方名單 ${officialFor(c.id).length} 人，${fmtTime(info.importedAt)} 匯入`:"尚未匯入官方名單"}${nPend?` · <b style="color:var(--warn)">${nPend} 人自行回報、尚未在官方名單中找到</b>`:""}</div>`
        :`<div class="hint" style="margin-bottom:12px">本站報名暫停中 · ${info?`官方名單 ${officialFor(c.id).length} 人，${fmtTime(info.importedAt)} 匯入`:"尚未匯入官方名單"}</div>`}
      ${r.length?`<div class="tbl"><table><thead><tr><th>#</th><th>業務單位</th><th>事業部</th><th>姓名</th><th>職稱</th>${isMeal(c)?"<th>早餐</th><th>飲料</th>":""}<th>狀態</th><th>回報時間</th></tr></thead><tbody>
        ${r.map((p,i)=>`<tr><td class="t">${i+1}</td><td>${esc(p.unit||"—")}</td><td>${esc(p.division||"—")}</td><td>${esc(p.name)}</td><td>${esc(p.title||"—")}</td>${isMeal(c)?`<td>${esc(p.meal||"—")}</td><td>${esc(p.drink||"—")}</td>`:""}<td><span class="pill ${p.src==="self"?"pending":"mine"}">${SRC_LABEL[p.src]}</span></td><td class="t">${fmtTime(p.at)||"—"}</td></tr>`).join("")}
      </tbody></table></div>`:`<p class="who" style="margin:0">尚無人報名</p>`}
      ${isMeal(c)?tallyHTML(officialFor(c.id)):""}
      ${S.importing===c.id?importBox(c):""}
      <div class="actions" style="margin-top:12px">
        ${S.importing!==c.id?`<button class="btn primary" data-act="imp-open" data-id="${esc(c.id)}">${info?"重新匯入官方名單":"匯入官方名單"}</button>`:""}
        <button class="btn" data-act="edit" data-id="${esc(c.id)}">編輯</button>
        <button class="btn" data-act="toggle" data-id="${esc(c.id)}">${c.status==="closed"?"重新開放報名":"截止報名"}</button>
        ${r.length?`<button class="btn" data-act="csv" data-id="${esc(c.id)}">下載名單 CSV</button>`:""}
        <button class="btn danger" data-act="del" data-id="${esc(c.id)}">刪除</button>
      </div>${del}
    </section>`;
}
function adminStatus(c){
  if(isAward(c)){ const st=awardStatus(c); return {label:st.label, cls:st.key==="on"?"mine":st.key==="soon"?"pending":"closed"}; }
  if(c.date && c.date < today()) return {label:"已結束", cls:"closed"};
  if(c.status==="closed") return {label:"報名截止", cls:"closed"};
  return {label:"開放中", cls:"mine"};
}
function adminTable(){
  const all = [...sortedCourses(), ...sortedAwards()];
  if(!all.length) return S.editing ? "" : `<div class="empty"><strong>還沒有課程</strong>按「新增課程」建立第一堂，發布後同事立刻看得到。</div>`;
  const f = S.adminFilter || "active";
  const shown = all.filter(c=>{
    const ended = isAward(c) ? awardStatus(c).key==="ended" : (c.date && c.date < today());
    return f==="all" ? true : f==="ended" ? ended : !ended;
  });
  const kind = c => (isAward(c) ? `<span class="pill closed">獎勵</span>` : isMeal(c) ? `<span class="pill closed">附餐點</span>` : `<span class="who">一般</span>`) + (c.hot&&!isAward(c)?` <span class="pill hot">最火</span>`:"");
  const cnt = (c,k) => ([...sortedCourses(), ...sortedAwards()].filter(x=>{ const e=isAward(x)?awardStatus(x).key==="ended":(x.date&&x.date<today()); return k==="all"?true:k==="ended"?e:!e; }).length);
  const rowsHTML = shown.map(c=>{
    const n = isAward(c) ? officialFor(c.id).length : peopleFor(c).length;
    const info = rosterInfo(c.id), st = adminStatus(c), open = S.adminOpen===c.id;
    const when = isAward(c) ? `${c.date||"—"}<br><span class="who">至 ${c.endDate||"—"}</span>` : (c.date||"待定");
    return `<tr class="${open?"row-open":""}">
      <td class="t">${when}</td>
      <td class="name-cell"><button type="button" class="linkish" data-act="admin-open" data-id="${esc(c.id)}">${esc(c.title)}</button></td>
      <td>${kind(c)}</td>
      <td><span class="pill ${st.cls}">${st.label}</span></td>
      <td class="t">${n} 人</td>
      <td class="t">${info?fmtTime(info.importedAt):"—"}</td>
      <td><div class="ops"><button type="button" class="btn ${open?"":"primary "}sm" data-act="admin-open" data-id="${esc(c.id)}">${open?"收合":"管理"}</button><button type="button" class="btn sm" data-act="edit" data-id="${esc(c.id)}">編輯</button>${isAward(c)?"":`<button type="button" class="btn sm ${c.hot?"hot-on":""}" data-act="toggle-hot" data-id="${esc(c.id)}" title="${c.hot?"取消近期最火":"設為近期最火"}">${c.hot?"取消最火":"設為最火"}</button>`}</div></td>
    </tr>`;
  }).join("");
  const open = S.adminOpen && all.find(x=>x.id===S.adminOpen);
  return `<section class="panel admin-list">
      <div class="title-row" style="justify-content:space-between;margin-bottom:10px">
        <h2 style="margin:0">課程與獎勵總表</h2>
        <div class="seg seg-tabs">${[["active","進行中／即將開始"],["ended","已結束"],["all","全部"]].map(([k,l])=>`<button type="button" class="btn sm ${f===k?"primary":""}" data-act="admin-filter" data-k="${k}">${l} ${cnt(null,k)}</button>`).join("")}</div>
      </div>
      ${shown.length?`<div class="tbl"><table class="admin-table"><thead><tr><th>日期</th><th>名稱</th><th>類型</th><th>狀態</th><th>人數</th><th>名單更新</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div>`:`<p class="who" style="margin:0">這個分類目前沒有項目。</p>`}
    </section>
    <div id="adminDetail">${open ? (isAward(open) ? awardAdminRow(open) : courseAdminRow(open)) : `<p class="hint" style="text-align:center">點表格中的「管理」或名稱，可以查看名單、匯入名單、下載 CSV、截止或刪除。</p>`}</div>`;
}

/* 圖片上傳 */
function uploadSlot(kind){
  const id = S.draft[kind];
  return (id?`<img src="${esc(blob(id))}" alt="">`:"")
    + `<label class="btn">${id?"更換圖片":"上傳圖片"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-kind="${kind}" hidden></label>`
    + (id?`<button type="button" class="btn link" data-act="up-remove" data-kind="${kind}">移除</button>`:"")
    + `<span class="err" id="st-${kind}"></span>`;
}
function startEdit(id, kind){
  const c = id==="new" ? {} : (S.courses.find(x=>x.id===id)||{});
  S.editKind = id==="new" ? (kind||"course") : (isAward(c) ? "award" : "course");
  S.editing=id; S.draft={poster:c.poster||"", payQr:c.payQr||""}; S.uploaded=[];
}
function dropImages(ids){ ids=[...new Set(ids.filter(Boolean))]; if(ids.length) api("admin/image/delete",{ids}).catch(()=>{}); }
async function shrink(file){
  if(file.size <= 900*1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);
  const max = 1600, scale = Math.min(1, max/Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(bmp.width*scale); cv.height = Math.round(bmp.height*scale);
  const ctx = cv.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.drawImage(bmp,0,0,cv.width,cv.height);
  for(const q of [0.85,0.75,0.6]){
    const b = await new Promise(r=>cv.toBlob(r,"image/jpeg",q));
    if(b && b.size <= 1300*1024) return b;
  }
  throw {error:"too_large"};
}
async function uploadImg(kind, file){
  const st = () => $("#st-"+kind);
  if(!file) return;
  if(!/^image\//.test(file.type)){ st().textContent="請選 JPG、PNG 或 WebP 圖片"; return; }
  st().textContent="上傳中…";
  try{
    const b = await shrink(file);
    const r = await api("admin/image", b);
    S.uploaded.push(r.id); S.draft[kind]=r.id;
    $("#slot-"+kind).innerHTML = uploadSlot(kind);
  }catch(e){ const el=st(); if(el) el.textContent = errMsg(e); }
}

/* 官方名單匯入（文字 / CSV） */
function importBox(c){
  const rows = S.impRows;
  let preview = "";
  if(rows){
    const self = rosterFor(c.id);
    const hit = self.filter(p=>rows.some(o=>sameP(p,o))).length;
    if(isAward(c)) preview = `<div><b>辨識結果：${rows.length} 人</b></div>
      ${rows.length?`<div class="tbl"><table><thead><tr><th>#</th><th>事業部</th><th>姓名</th><th>達成獎勵</th><th></th></tr></thead><tbody>
      ${rows.map((p,i)=>`<tr><td class="t">${i+1}</td><td>${esc(p.division||"—")}</td><td>${esc(p.name)}</td><td>${esc(p.award||"—")}</td><td><button type="button" class="x" data-act="imp-del" data-i="${i}" aria-label="刪除這一列">×</button></td></tr>`).join("")}
      </tbody></table></div>`:""}`;
    else preview = `<div><b>辨識結果：${rows.length} 人</b>　<span class="who">與自行回報相符 ${hit} 人 · 自行回報但不在這份名單 ${self.length-hit} 人</span></div>
      ${rows.length?`<div class="tbl"><table><thead><tr><th>#</th><th>業務單位</th><th>事業部</th><th>姓名</th><th>職稱</th>${isMeal(c)?"<th>早餐</th><th>飲料</th>":""}<th></th></tr></thead><tbody>
      ${rows.map((p,i)=>`<tr><td class="t">${i+1}</td><td>${esc(p.unit||"—")}</td><td>${esc(p.division||"—")}</td><td>${esc(p.name)}</td><td>${esc(p.title||"—")}</td>${isMeal(c)?`<td>${esc(p.meal||"—")}</td><td>${esc(p.drink||"—")}</td>`:""}<td><button type="button" class="x" data-act="imp-del" data-i="${i}" aria-label="刪除這一列">×</button></td></tr>`).join("")}
      </tbody></table></div>`:""}
      ${isMeal(c)?tallyHTML(rows):""}`;
    preview += `
      <p class="hint">請檢查結果，有誤的列可以按 × 刪除，或按「重新貼上」修改來源文字。</p>
      ${rosterInfo(c.id)?`<div class="seg"><label><input type="radio" name="impMode" value="replace" ${S.impMode==="replace"?"checked":""}> 取代目前的${isAward(c)?"達成":"官方"}名單</label><label><input type="radio" name="impMode" value="merge" ${S.impMode==="merge"?"checked":""}> 加入目前的${isAward(c)?"達成":"官方"}名單（合併、去除重複）</label></div>`:""}
      <div class="actions"><button class="btn primary" data-act="imp-save" data-id="${esc(c.id)}" ${S.impBusy||!rows.length?"disabled":""}>${isAward(c)?"儲存名單":"儲存並核對"}</button><button class="btn link" data-act="imp-reset">重新貼上</button><button class="btn link" data-act="imp-close">取消</button>
      ${rosterInfo(c.id)?`<button class="btn link" data-act="imp-clear" data-id="${esc(c.id)}" style="color:var(--danger)">清除目前的${isAward(c)?"達成":"官方"}名單</button>`:""}</div>`;
  }
  return `<div class="importbox" id="importBox">
    <h4>匯入「${esc(c.title)}」的${isAward(c)?"達成名單":"官方報名名單"}</h4>
    ${rows?"":`<p class="hint">${isAward(c)?"從 Excel 或 Email 複製達成名單貼在下面，第一列要是表頭：「事業部」「姓名」「達成獎勵」，也可以上傳 CSV 檔。":`從 Google 表單回覆試算表、Excel 或 Email 複製名單貼在下面，第一列要是表頭（需有「姓名」欄，可另有業務單位、事業部、職稱${isMeal(c)?"，以及「早餐」「飲料」欄":""}），也可以上傳 CSV 檔。`}<br>手上只有截圖或照片：傳給 Claude，請它轉成文字後貼上。</p>
    <label>名單文字<textarea id="imp-text" rows="7" placeholder="${isAward(c)?"事業部	姓名	達成獎勵&#10;財富管理事業部	王小明	海外旅遊（雙人）":isMeal(c)?"事業部	姓名	早餐選項	飲料選項&#10;財富管理事業部	王小明	摩絲炸蝦堡	拿鐵中杯(無糖)":"業務單位	事業部	姓名	職稱&#10;高雄	財富管理事業部	王小明	襄理"}">${esc(S.impText)}</textarea></label>
    <div class="upl-row"><label class="btn">上傳 CSV / TXT<input type="file" id="imp-file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden></label></div>
    <div class="actions"><button class="btn primary" data-act="imp-run" data-id="${esc(c.id)}">辨識名單</button><button class="btn link" data-act="imp-close">取消</button><span class="err" id="imp-err"></span></div>`}
    ${preview}
  </div>`;
}
function cleanRows(arr){
  const out=[]; let anon=0;
  for(const r of (Array.isArray(arr)?arr:[])){
    const p = entryOf({unit:String(r?.unit??"").trim().slice(0,20), division:String(r?.division??"").trim().slice(0,30), name:String(r?.name??"").trim().slice(0,30), title:String(r?.title??"").trim().slice(0,20),
      meal:String(r?.meal??"").trim().slice(0,60), drink:String(r?.drink??"").trim().slice(0,40), award:String(r?.award??"").trim().slice(0,80)});
    if(!p.name && (p.meal||p.drink)){ anon++; p.name="未具名"+anon; }
    if(p.name && !out.some(o=>sameP(o,p) && normUnit(o.division)===normUnit(p.division))) out.push(p);
  }
  return out;
}
function splitLine(l){
  if(l.includes("\t")) return l.split("\t").map(s=>s.trim());
  const out=[]; let cur="", q=false;
  for(let i=0;i<l.length;i++){ const ch=l[i];
    if(ch==='"'){ if(q && l[i+1]==='"'){ cur+='"'; i++; } else q=!q; }
    else if(ch===',' && !q){ out.push(cur.trim()); cur=""; } else cur+=ch; }
  out.push(cur.trim()); return out;
}
function localParse(text){
  const lines = text.replace(/^﻿/,"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return null;
  const head = splitLine(lines[0]);
  const col = re => head.findIndex(h=>re.test(h));
  const ix = {name:col(/姓名|名字|^name$/i), unit:col(/業務單位|單位|據點|地區|分公司/), division:col(/事業部|部門/), title:col(/職稱|職位|職級/), meal:col(/早餐|餐點|主餐/), drink:col(/飲料|飲品/), award:col(/達成|獎勵|獎項/)};
  if(ix.name>=0){
    return lines.slice(1).map(l=>{ const f=splitLine(l); const g=k=>ix[k]>=0?(f[ix[k]]||""):""; return {unit:g("unit"),division:g("division"),name:g("name"),title:g("title"),meal:g("meal"),drink:g("drink"),award:g("award")}; });
  }
  // 沒有表頭：4 欄當作 業務單位/事業部/姓名/職稱，1 欄當作姓名
  const rows = lines.map(l=>l.includes("\t")||l.includes(",") ? splitLine(l) : l.split(/\s+/));
  if(rows.every(f=>f.length===4)) return rows.map(f=>({unit:f[0],division:f[1],name:f[2],title:f[3]}));
  if(rows.every(f=>f.length===1)) return rows.map(f=>({name:f[0]}));
  return null;
}

/* ---------- 報名資料 ---------- */
function renderProfilePanel(){
  const p=$("#profilePanel");
  const need = S.pendingJoin && !S.me;
  if(!need && !S.editProfile){ p.hidden=true; p.innerHTML=""; p.dataset.open=""; return; }
  if(p.dataset.open==="1") return;
  p.dataset.open="1"; p.hidden=false;
  const me = S.me || {};
  const units = [...new Set(["高雄","北高",...S.signups.map(s=>s.unit).filter(Boolean)])];
  const divs = [...new Set(S.signups.map(s=>s.division).filter(Boolean))];
  p.innerHTML = `<section class="panel"><h2>我的報名資料</h2>
    <p class="who" style="margin:0 0 12px">填一次就會記在這台裝置，之後報名自動帶入。換手機或電腦時，填一樣的業務單位和姓名就能看到自己的報名紀錄。名單會公開給同事看。</p>
    <form id="profileForm"><div class="grid">
      <label>業務單位 *<input id="p-unit" required maxlength="20" list="unitList" value="${esc(me.unit)}" placeholder="例如：高雄、北高"></label>
      <label>事業部名稱 *<input id="p-division" required maxlength="30" list="divList" value="${esc(me.division)}"></label>
      <label>姓名 *<input id="p-name" required maxlength="30" value="${esc(me.name)}"></label>
      <label>職稱 *<input id="p-title" required maxlength="20" value="${esc(me.title)}" placeholder="例如：業務經理"></label>
    </div>
    <datalist id="unitList">${units.map(u=>`<option value="${esc(u)}">`).join("")}</datalist>
    <datalist id="divList">${divs.map(u=>`<option value="${esc(u)}">`).join("")}</datalist>
    <div class="form-foot"><span class="err" id="pErr"></span>
      <button type="button" class="btn link" data-act="profile-cancel">取消</button>
      <button type="submit" class="btn primary">${S.pendingJoin?"儲存並報名":"儲存"}</button></div></form></section>`;
  setTimeout(()=>{ $("#p-unit")?.focus(); p.scrollIntoView({behavior:"smooth",block:"start"}); },0);
}
function closeProfile(){ S.editProfile=false; const p=$("#profilePanel"); p.dataset.open=""; }

/* ---------- 動作 ---------- */
async function join(cid){
  const c = S.courses.find(x=>x.id===cid); if(!c || !S.me) return;
  S.busy=true; render();
  try{ await api("signup",{courseId:cid, profile:S.me}); toast((c.signupUrl?"已回報完成報名：":"報名成功：")+c.title); S.pendingJoin=null; }
  catch(e){ toast(errMsg(e)); }
  S.busy=false; await refresh();
}
async function leave(cid){
  const c = S.courses.find(x=>x.id===cid);
  S.busy=true; render();
  try{ await api("unsignup",{courseId:cid, pkey:myKey()}); toast(c&&c.signupUrl?"已撤回回報":"已取消報名"); }
  catch(e){ toast(errMsg(e)); }
  S.busy=false; await refresh();
}
async function saveCourse(){
  const v = id => $("#"+id).value.trim();
  const title = v("f-title");
  if(S.editKind==="award") return saveAward(v, title);
  if(!title){ $("#formErr").textContent="請填寫課程名稱"; return; }
  let signupUrl = v("f-url");
  if(signupUrl){
    if(!/^https?:\/\//i.test(signupUrl)) signupUrl = "https://" + signupUrl;
    let ok=false; try{ const u=new URL(signupUrl); ok = /^https?:$/.test(u.protocol) && u.hostname.includes("."); }catch(e){}
    if(!ok){ $("#formErr").textContent="報名連結看起來不是網址，請直接從瀏覽器網址列複製貼上"; $("#f-url").focus(); return; }
  }
  const course = { title, signupUrl, kind:$("#f-kind").value, hot:$("#f-hot").checked, date:v("f-date"), time:v("f-time"), location:v("f-location"), instructor:v("f-instructor"),
    capacity:Math.max(0, parseInt(v("f-capacity")||"0",10)||0), status:$("#f-status").value, summary:v("f-summary"),
    detail:$("#f-detail").value.trim(), poster:S.draft.poster||"", payQr:S.draft.payQr||"", payNote:$("#f-paynote").value.trim() };
  const old = S.editing==="new" ? {} : (S.courses.find(x=>x.id===S.editing)||{});
  if(S.editing!=="new") course.id = S.editing;
  const btn=$("#courseForm button[type=submit]"); if(btn) btn.disabled=true;
  try{
    await api("admin/course",{course});
    toast(S.editing==="new"?"課程已發布":"已儲存");
    const keep = new Set([course.poster, course.payQr]);
    dropImages([old.poster, old.payQr, ...S.uploaded].filter(id=>id && !keep.has(id)));
    S.editing=null; S.uploaded=[];
  }catch(e){ $("#formErr").textContent = errMsg(e); if(btn) btn.disabled=false; if(e.error==="bad_key") adminLogout(); return; }
  await refresh();
}
async function saveAward(v, title){
  if(!title){ $("#formErr").textContent="請填寫獎勵名稱"; return; }
  const date=v("f-date"), endDate=v("f-end");
  if(date && endDate && endDate<date){ $("#formErr").textContent="結束日期不能早於開始日期"; return; }
  const course = { title, kind:"award", date, endDate, summary:v("f-summary"), detail:$("#f-detail").value.trim(), poster:S.draft.poster||"", status:"open" };
  const old = S.editing==="new" ? {} : (S.courses.find(x=>x.id===S.editing)||{});
  if(S.editing!=="new") course.id = S.editing;
  const btn=$("#courseForm button[type=submit]"); if(btn) btn.disabled=true;
  try{
    await api("admin/course",{course});
    toast(S.editing==="new"?"獎勵已發布":"已儲存");
    dropImages([old.poster, ...S.uploaded].filter(id=>id && id!==course.poster));
    S.editing=null; S.uploaded=[];
  }catch(e){ $("#formErr").textContent = errMsg(e); if(btn) btn.disabled=false; if(e.error==="bad_key") adminLogout(); return; }
  await refresh();
}
function csv(courses){
  const q=s=>`"${String(s??"").replace(/"/g,'""')}"`;
  const lines=[["課程","日期","業務單位","事業部名稱","姓名","職稱","早餐","飲料","達成獎勵","狀態","回報時間"].map(q).join(",")];
  for(const c of courses) for(const r of peopleFor(c)) lines.push([c.title,c.date,r.unit,r.division,r.name,r.title,r.meal||"",r.drink||"",r.award||"",SRC_LABEL[r.src],fmtTime(r.at)].map(q).join(","));
  const url=URL.createObjectURL(new Blob(["﻿"+lines.join("\r\n")],{type:"text/csv"}));
  const a=document.createElement("a"); a.href=url; a.download=(courses.length===1?courses[0].title:"全部課程")+"-報名名單.csv";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function closeImport(){ S.importing=null; S.impRows=null; S.impText=""; S.impMode="replace"; }
function adminLogout(){ S.adminKey=""; ss.del("cs-admin"); S.isOwner=false; S.editing=null; closeImport(); if(S.tab==="admin") S.tab="shelf"; render(); refresh(true); }

document.addEventListener("click", async ev=>{
  const tab = ev.target.closest("nav.tabs button");
  if(tab){ S.tab=tab.dataset.tab; S.loginOpen=false; if(S.tab==="award") S.awardOpen=null; render(); return; }
  const b = ev.target.closest("[data-act]"); if(!b) return;
  const id=b.dataset.id, act=b.dataset.act;
  if(act==="goto") gotoCourse(id);
  else if(act==="skip"){ toggleSkip(id); render(); toast(S.skip.has(id)?"已設為不再提醒，課程移到後面":"已恢復提醒"); }
  else if(act==="join"){ S.pendingJoin=id; if(!S.me) closeProfile(); render(); }
  else if(act==="join-yes") join(id);
  else if(act==="join-no"){ S.pendingJoin=null; render(); }
  else if(act==="leave") leave(id);
  else if(act==="edit-profile"){ closeProfile(); S.editProfile=true; render(); }
  else if(act==="profile-cancel"){ S.pendingJoin=null; closeProfile(); render(); }
  else if(act==="admin-login"){ S.loginOpen=true; render(); setTimeout(()=>$("#l-key")?.focus(),0); window.scrollTo({top:0,behavior:"smooth"}); }
  else if(act==="login-cancel"){ S.loginOpen=false; render(); }
  else if(act==="admin-logout") adminLogout();
  else if(act==="goto-new"){ S.tab="admin"; startEdit("new"); render(); }
  else if(act==="new-award"){ startEdit("new","award"); render(); setTimeout(()=>$("#f-title")?.focus(),0); }
  else if(act==="goto-award") gotoAward(id);
  else if(act==="award-back"){ S.awardOpen=null; try{ history.replaceState(null,"","#awards"); }catch(e){} render(); window.scrollTo({top:0}); }
  else if(act==="admin-open"){ S.adminOpen = S.adminOpen===id ? null : id; if(S.importing && S.importing!==S.adminOpen) closeImport(); S.confirmDel=null; render(); if(S.adminOpen) setTimeout(()=>$("#adminDetail")?.scrollIntoView({behavior:"smooth",block:"start"}),0); }
  else if(act==="toggle-hot"){ const c=S.courses.find(x=>x.id===id); if(c){ try{ await api("admin/course",{course:{...c, hot:!c.hot}}); toast(c.hot?"已取消「近期最火」":"已設為「近期最火」"); }catch(e){ toast(errMsg(e)); } await refresh(); } }
  else if(act==="admin-filter"){ S.adminFilter=b.dataset.k; render(); }
  else if(act==="new"){ startEdit("new"); render(); setTimeout(()=>$("#f-title")?.focus(),0); }
  else if(act==="edit"){ startEdit(id); render(); window.scrollTo({top:0,behavior:"smooth"}); }
  else if(act==="cancel-edit"){ dropImages(S.uploaded); S.uploaded=[]; S.editing=null; render(); }
  else if(act==="up-remove"){ const k=b.dataset.kind; S.draft[k]=""; $("#slot-"+k).innerHTML=uploadSlot(k); }
  else if(act==="zoom"){ $("#lightboxImg").src=b.dataset.src; $("#lightbox").hidden=false; }
  else if(act==="zoom-close"){ $("#lightbox").hidden=true; $("#lightboxImg").removeAttribute("src"); }
  else if(act==="del"){ S.confirmDel=id; render(); }
  else if(act==="del-no"){ S.confirmDel=null; render(); }
  else if(act==="del-yes"){ S.confirmDel=null; try{ await api("admin/course/delete",{id}); toast("課程已刪除"); }catch(e){ toast(errMsg(e)); } await refresh(); }
  else if(act==="toggle"){ const c=S.courses.find(x=>x.id===id); if(c){ try{ await api("admin/course",{course:{...c, status:c.status==="closed"?"open":"closed"}}); toast(c.status==="closed"?"已重新開放報名":"已截止報名"); }catch(e){ toast(errMsg(e)); } await refresh(); } }
  else if(act==="csv") csv([S.courses.find(x=>x.id===id)]);
  else if(act==="csv-all") csv(sortedCourses());
  else if(act==="imp-open"){ closeImport(); S.importing=id; render(); setTimeout(()=>{ $("#importBox")?.scrollIntoView({behavior:"smooth",block:"center"}); $("#imp-text")?.focus(); },0); }
  else if(act==="imp-close"){ closeImport(); render(); }
  else if(act==="imp-run"){
    S.impText = $("#imp-text")?.value || "";
    const rows = localParse(S.impText);
    if(!rows){ $("#imp-err").textContent = S.impText.trim() ? "看不懂這份名單：請確認第一列是表頭，而且有「姓名」欄" : "請先貼上名單文字或上傳 CSV"; return; }
    S.impRows = cleanRows(rows);
    if(!S.impRows.length){ S.impRows=null; $("#imp-err").textContent="沒有找到任何姓名"; return; }
    render();
  }
  else if(act==="imp-del"){ S.impRows.splice(Number(b.dataset.i),1); render(); }
  else if(act==="imp-reset"){ S.impRows=null; render(); }
  else if(act==="imp-save"){
    const c=S.courses.find(x=>x.id===id); if(!c || S.impBusy) return;
    let entries = S.impRows||[];
    if(S.impMode==="merge" && rosterInfo(id)) entries = cleanRows([...officialFor(id), ...entries]);
    S.impBusy=true; render();
    try{
      await api("admin/roster",{courseId:id, entries});
      const hit = rosterFor(id).filter(p=>entries.some(o=>sameP(p,o))).length;
      toast(`已匯入 ${entries.length} 人，與自行回報相符 ${hit} 人`); closeImport();
    }catch(e){ toast(errMsg(e)); }
    S.impBusy=false; await refresh();
  }
  else if(act==="imp-clear"){ try{ await api("admin/roster/delete",{courseId:id}); toast("已清除官方名單"); closeImport(); }catch(e){ toast(errMsg(e)); } await refresh(); }
});
document.addEventListener("change", ev=>{
  const inp = ev.target.closest("input[type=file][data-kind]");
  if(inp){ uploadImg(inp.dataset.kind, inp.files && inp.files[0]); inp.value=""; return; }
  if(ev.target.name==="impMode"){ S.impMode=ev.target.value; return; }
  if(ev.target.id==="imp-file"){
    const f=ev.target.files && ev.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{ const ta=$("#imp-text"); const t=String(r.result||"").replace(/^﻿/,""); if(ta) ta.value = ta.value.trim() ? ta.value.trim()+"\n"+t : t; };
    r.onerror=()=>toast("讀不到這個檔案；Excel 檔請先另存成 CSV");
    r.readAsText(f); ev.target.value="";
  }
});
document.addEventListener("keydown", ev=>{ if(ev.key==="Escape" && !$("#lightbox").hidden) $("#lightbox").hidden=true; });
document.addEventListener("submit", async ev=>{
  ev.preventDefault();
  const f = ev.target;
  if(f.id==="courseForm") return saveCourse();
  if(f.id==="loginForm"){
    const key = $("#l-key").value;
    try{ await api("admin/check",{}, {key}); S.adminKey=key; ss.set("cs-admin",key); S.isOwner=true; S.loginOpen=false; S.tab="admin"; render(); toast("已登入課程管理"); await loadVisits(); await refresh(); }
    catch(e){ $("#lErr").textContent = e.error==="bad_key" ? "密碼不對" : errMsg(e); }
    return;
  }
  if(f.id==="profileForm"){
    const pf={}; for(const k of PF) pf[k]=$("#p-"+k).value.trim();
    const miss=PF.find(k=>!pf[k]);
    if(miss){ $("#pErr").textContent="請填寫"+PF_LABEL[miss]; $("#p-"+miss).focus(); return; }
    const oldKey = myKey();
    const hadAny = oldKey && S.signups.some(s=>s.pkey===oldKey);
    S.me = profileOf(pf); ls.set("cs-profile", JSON.stringify(S.me));
    const pending = S.pendingJoin;
    closeProfile();
    if(hadAny){ try{ await api("profile",{oldKey, profile:S.me}); }catch(e){} }
    if(pending){ S.pendingJoin=pending; await join(pending); }
    else { toast("已儲存報名資料"); await refresh(); }
  }
});

/* ---------- 啟動 ---------- */
(async()=>{
  render();
  if(S.adminKey){ try{ await api("admin/check",{}); S.isOwner=true; }catch(e){ S.adminKey=""; ss.del("cs-admin"); } }
  await refresh();
  logVisit(); await loadVisits(); if(S.visits) render(true);
  const h = (location.hash||"").slice(1);
  if(h==="admin" && !S.isOwner){ S.loginOpen=true; render(); }
  else if(h==="awards"){ S.tab="award"; render(); }
  else if(h.startsWith("a-") && S.courses.some(c=>"a-"+c.id===h)) setTimeout(()=>gotoAward(h.slice(2)),50);
  else if(h.startsWith("c-") && S.courses.some(c=>"c-"+c.id===h)) setTimeout(()=>gotoCourse(h.slice(2)),50);
  setInterval(()=>{ if(document.visibilityState==="visible" && !S.busy) refresh(true); }, 20000);
  document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible" && S.loaded) refresh(true); });
})();
