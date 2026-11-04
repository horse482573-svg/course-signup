/* 公告：課程總覽最上方的橫幅＋進入網站時跳出的視窗
   內容＝近期課程（自動整理：報名中／即將舉辦）＋其他事項（舉辦人自己加）＋未來三週早會主持／音控 */
(function(){
  const DAY = 864e5;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const md = s => { if(!s) return ""; const d=new Date(s+"T00:00:00"); return `${d.getMonth()+1}/${d.getDate()}(${WD[d.getDay()]})`; };
  const mdShort = s => { if(!s) return ""; const d=new Date(s+"T00:00:00"); return `${d.getMonth()+1}/${d.getDate()}`; };
  const data = () => S.notice || {items:[], hidden:[], duty:[]};
  const version = () => (S.notice && S.notice.updatedAt) || "";

  function recentCourses(n){
    const t = today(), hidden = new Set((n||data()).hidden||[]);
    return S.courses.filter(c=>!isAward(c) && !(c.date && c.date<t) && !hidden.has(c.id))
      .sort((a,b)=>String(a.date||"9999").localeCompare(String(b.date||"9999")))
      .map(c=>({c, open: c.status!=="closed" && !!c.signupUrl}));
  }
  const extraItems = n => ((n||data()).items||[]).filter(x=>!x.date || x.date>=today()).sort((a,b)=>String(a.date||"9999").localeCompare(String(b.date||"9999")));
  function dutyWeeks(n){
    const t = today();
    return ((n||data()).duty||[]).filter(w=>(w.end||w.start)>=t).sort((a,b)=>a.start.localeCompare(b.start)).slice(0,3)
      .map(w=>({...w, now: w.start<=t && t<=(w.end||w.start)}));
  }
  const meIs = p => !!(S.me && p && p.name && normName(p.name)===normName(S.me.name));
  const person = p => p && p.name ? `${p.division?`<small>${esc(p.division)}</small> `:""}${esc(p.name)}${meIs(p)?" ⭐":""}` : "—";
  const hasContent = n => recentCourses(n).length || extraItems(n).length || dutyWeeks(n).length;

  function bodyHTML(n){
    const rc = recentCourses(n), open = rc.filter(x=>x.open), soon = rc.filter(x=>!x.open), ex = extraItems(n), dw = dutyWeeks(n);
    const myDuty = dw.find(w=>w.now && (meIs(w.host)||meIs(w.sound)));
    const line = x => `<li><span class="nt-d">${esc(md(x.c.date))||"日期待定"}</span><span class="nt-t">${esc(x.c.title)}</span>${x.open?`<button type="button" class="btn sm primary" data-nt="goto" data-id="${esc(x.c.id)}">前往報名</button>`:`<button type="button" class="btn sm" data-nt="goto" data-id="${esc(x.c.id)}">查看</button>`}</li>`;
    return `${myDuty?`<p class="nt-me">⭐ 本週輪到你${meIs(myDuty.host)?"主持":"音控"}早會，辛苦了！</p>`:""}
      ${rc.length||ex.length?`<h3>近期課程與活動</h3>
        ${open.length?`<p class="nt-tag on">🟢 報名中</p><ul class="nt-list">${open.map(line).join("")}</ul>`:""}
        ${soon.length?`<p class="nt-tag">🔵 即將舉辦</p><ul class="nt-list">${soon.map(line).join("")}</ul>`:""}
        ${ex.length?`<p class="nt-tag">➕ 其他事項</p><ul class="nt-list">${ex.map(x=>`<li><span class="nt-d">${esc(md(x.date))}</span><span class="nt-t">${esc(x.title)}${x.desc?`<small>${esc(x.desc)}</small>`:""}</span>${x.url?`<a class="btn sm" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">開啟 ↗</a>`:""}</li>`).join("")}</ul>`:""}`:""}
      ${dw.length?`<h3>早會主持／音控 <small>（每週一、三、五）</small></h3>
        <table class="nt-duty"><thead><tr><th>週次</th><th>主持</th><th>音控</th></tr></thead><tbody>
        ${dw.map(w=>`<tr class="${w.now?"now":""}${meIs(w.host)||meIs(w.sound)?" me":""}"><td>${w.now?"<b>本週</b> ":""}${esc(mdShort(w.start))}～${esc(mdShort(w.end||w.start))}</td><td>${person(w.host)}</td><td>${person(w.sound)}</td></tr>`).join("")}
        </tbody></table>`:""}
      ${hasContent(n)?"":`<p class="who">目前沒有公告內容。</p>`}`;
  }

  // 課程總覽最上方的橫幅
  window.noticeBanner = function(){
    if(!hasContent()) return "";
    const open = recentCourses().filter(x=>x.open).length, w = dutyWeeks().find(x=>x.now);
    const unseen = version() && ls.get("cs-notice-seen")!==version();
    const v = version() ? new Date(version()) : null;
    const bits = [open?`報名中 ${open} 堂`:"", w&&w.host&&w.host.name?`本週主持 ${meIs(w.host)?"你 ⭐":esc(w.host.name)}`:"", w&&w.sound&&w.sound.name?`音控 ${meIs(w.sound)?"你 ⭐":esc(w.sound.name)}`:""].filter(Boolean).join("・");
    return `<button type="button" class="nt-banner" data-nt="open">${unseen?'<i class="nt-dot" aria-label="有新公告"></i>':""}<b>📢 公告</b>${v?`<small>（${v.getMonth()+1}/${v.getDate()} 更新）</small>`:""}<span>${bits}</span><span class="nt-more">查看 ›</span></button>`;
  };

  // 跳出視窗
  const box = document.createElement("div"); box.id="nt"; box.hidden=true; box.setAttribute("role","dialog"); box.setAttribute("aria-modal","true"); box.setAttribute("aria-label","公告");
  document.body.appendChild(box);
  let previewData = null;
  window.openNotice = function(n){
    previewData = n || null;
    const v = version() ? new Date(version()) : null;
    box.innerHTML = `<div class="nt-card">
      <div class="nt-head"><b>📢 公告</b>${v&&!n?`<small>${v.getMonth()+1}/${v.getDate()} 更新</small>`:n?"<small>預覽</small>":""}<button type="button" class="nt-x" data-nt="close" aria-label="關閉">✕</button></div>
      <div class="nt-body">${bodyHTML(n)}</div>
      <div class="nt-foot">${n?"":`<label class="check"><input type="checkbox" id="nt-skip"> 今天不再提醒</label>`}<button type="button" class="btn primary" data-nt="close">我知道了</button></div>
    </div>`;
    box.hidden = false; document.documentElement.style.overflow="hidden";
    setTimeout(()=>box.querySelector(".nt-foot .btn")?.focus(),0);
  };
  function closeNotice(){
    if(!previewData){
      if(version()) ls.set("cs-notice-seen", version());
      if(box.querySelector("#nt-skip")?.checked) ls.set("cs-notice-skip", today()+"|"+version());
    }
    box.hidden = true; box.innerHTML = ""; document.documentElement.style.overflow=""; previewData=null;
    if(S.tab==="shelf") render(true);
  }
  // 進入網站時：有內容、今天沒按過「不再提醒」（或公告有更新）就跳出
  window.maybeAutoNotice = function(){
    if(!S.notice || !hasContent() || (location.hash||"")==="#admin" || S.isOwner) return;
    if(ls.get("cs-notice-skip")===today()+"|"+version()) return;
    openNotice();
  };
  box.addEventListener("click", e=>{
    if(e.target===box){ closeNotice(); return; }
    const b = e.target.closest("[data-nt]"); if(!b) return;
    if(b.dataset.nt==="close") closeNotice();
    if(b.dataset.nt==="goto"){ const id=b.dataset.id; const wasPreview=!!previewData; closeNotice(); if(!wasPreview) gotoCourse(id); }
  });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !box.hidden) closeNotice(); });
  document.addEventListener("click", e=>{ const b=e.target.closest(".nt-banner[data-nt=open]"); if(b) openNotice(); });

  /* ---------- 公告管理（課程管理內，只有舉辦人）---------- */
  const draft = () => S.ntd || (S.ntd = JSON.parse(JSON.stringify({items:[], hidden:[], duty:[], ...(S.notice||{})})));
  function nameDivision(name){
    const k = normName(name); if(!k) return "";
    for(const cid of Object.keys(S.rosters||{})) for(const e of (S.rosters[cid].entries||[])) if(normName(e.name)===k && e.division) return e.division;
    for(const s of S.signups||[]) if(normName(s.name)===k && s.division) return s.division;
    return "";
  }
  // 貼上排班表：「11/2 ~ 11/6  榮耀 陳慶芳  榮耀 陳昭元」（前兩欄主持、後兩欄音控；只有姓名也可以）
  function parseDuty(text){
    const out = [], bad = [], now = new Date();
    for(const raw of String(text||"").split(/\r?\n/)){
      const line = raw.trim(); if(!line || /主持|音控/.test(line)) continue;
      const ds = [...line.matchAll(/(\d{1,2})\s*[\/月]\s*(\d{1,2})/g)];
      if(!ds.length){ bad.push(line); continue; }
      const mk = m => { let d = new Date(now.getFullYear(), +m[1]-1, +m[2]); if(d < new Date(now - 180*DAY)) d = new Date(now.getFullYear()+1, +m[1]-1, +m[2]); return d; };
      let start = mk(ds[0]);
      const dow = start.getDay(); if(dow!==1){ start = new Date(start - ((dow+6)%7)*DAY); }   // 對到那一週的週一
      const end = ds[1] ? (()=>{ let e=mk(ds[1]); if(e<start) e=new Date(e.getFullYear()+1, e.getMonth(), e.getDate()); return e; })() : new Date(+start + 4*DAY);
      const rest = line.replace(/(\d{1,2})\s*[\/月]\s*(\d{1,2})\s*日?/g," ").replace(/[~～\-–—至到]/g," ").split(/[\t ]+|　/).map(x=>x.trim()).filter(Boolean);
      let host, sound;
      if(rest.length>=4){ host={division:rest[0], name:rest[1]}; sound={division:rest[2], name:rest[3]}; }
      else if(rest.length===2){ host={division:nameDivision(rest[0]), name:rest[0]}; sound={division:nameDivision(rest[1]), name:rest[1]}; }
      else { bad.push(line); continue; }
      out.push({start:iso(start), end:iso(end), host, sound});
    }
    return {out, bad};
  }

  window.noticeAdmin = function(){
    const n = draft(), t = today();
    const courses = S.courses.filter(c=>!isAward(c) && !(c.date && c.date<t)).sort((a,b)=>String(a.date||"9999").localeCompare(String(b.date||"9999")));
    const items = n.items.map((x,i)=>`<tr>
      <td><input type="date" data-ntd="items.${i}.date" value="${esc(x.date)}" aria-label="日期"></td>
      <td><input type="text" data-ntd="items.${i}.title" value="${esc(x.title)}" maxlength="60" placeholder="標題，例如：年末聚餐聯歡會" aria-label="標題"></td>
      <td><input type="text" data-ntd="items.${i}.desc" value="${esc(x.desc)}" maxlength="200" placeholder="說明（選填）" aria-label="說明"></td>
      <td><input type="text" data-ntd="items.${i}.url" value="${esc(x.url)}" maxlength="500" placeholder="連結（選填）https://…" aria-label="連結"></td>
      <td><button type="button" class="x" data-ntd-act="del-item" data-i="${i}" aria-label="刪除">✕</button></td></tr>`).join("");
    const duty = [...n.duty].sort((a,b)=>a.start.localeCompare(b.start)).map(w=>`<tr class="${(w.end||w.start)<t?"old":""}${w.start<=t&&t<=(w.end||w.start)?" now":""}"><td>${esc(mdShort(w.start))}～${esc(mdShort(w.end))}</td><td>${esc(w.host.division)} ${esc(w.host.name)}</td><td>${esc(w.sound.division)} ${esc(w.sound.name)}</td></tr>`).join("");
    return `<section class="panel ntadmin" id="ntadmin"><h2>📢 公告管理</h2>
      <p class="who">同事打開網站時會跳出公告（可勾「今天不再提醒」）；課程總覽最上方也有公告橫幅。儲存後，今天勾過不再提醒的同事也會再看到一次。</p>
      <h3>① 近期課程（自動整理，取消勾選就不放進公告）</h3>
      ${courses.length?`<ul class="nt-pick">${courses.map(c=>`<li><label class="check"><input type="checkbox" data-ntd-act="show" data-id="${esc(c.id)}"${n.hidden.includes(c.id)?"":" checked"}> ${esc(md(c.date)||"日期待定")}　${esc(c.title)}　<small>${c.status!=="closed"&&c.signupUrl?"🟢 報名中":"🔵 即將舉辦"}</small></label></li>`).join("")}</ul>`:`<p class="who">目前沒有即將舉辦的課程。</p>`}
      <h3>② 其他事項</h3>
      ${items?`<div class="tbl"><table class="nt-items"><thead><tr><th>日期</th><th>標題</th><th>說明</th><th>連結</th><th></th></tr></thead><tbody>${items}</tbody></table></div>`:""}
      <button type="button" class="btn sm" data-ntd-act="add-item">＋ 新增事項</button>
      <p class="who">日期過了會自動從公告消失；沒填日期的會一直顯示。</p>
      <h3>③ 早會主持／音控排班 <small>（公告只顯示本週起 3 週）</small></h3>
      ${duty?`<div class="tbl"><table class="nt-dutyadm"><thead><tr><th>週次</th><th>主持</th><th>音控</th></tr></thead><tbody>${duty}</tbody></table></div>`:`<p class="who">還沒有排班資料。</p>`}
      <details${S.ntImpOpen?" open":""} data-ntd-details><summary>匯入排班表（從 Excel 複製貼上，會取代目前的排班）</summary>
        <textarea id="nt-duty-text" rows="6" placeholder="11/2	~	11/6	榮耀	陳慶芳		榮耀	陳昭元&#10;11/9	~	11/13	宇玲	吳佩玲		明臻	陳奕涵&#10;（前兩欄主持、後兩欄音控；只有姓名也可以，事業部會自動補上）"></textarea>
        <div class="actions"><button type="button" class="btn" data-ntd-act="import">辨識並取代排班</button><span class="err" id="nt-duty-err"></span></div>
      </details>
      <div class="actions" style="margin-top:14px"><button type="button" class="btn primary" data-ntd-act="save"${S.ntdDirty?"":" disabled"}>儲存公告</button><button type="button" class="btn" data-ntd-act="preview">預覽公告</button>${S.ntdDirty?'<span class="who">尚未儲存</span>':""}</div>
    </section>`;
  };
  function redrawAdmin(){ const el=$("#ntadmin"); if(el) el.outerHTML = noticeAdmin(); }
  function setPath(o, p, v){ const ks=p.split("."); for(let i=0;i<ks.length-1;i++) o=o[ks[i]]; o[ks[ks.length-1]]=v; }
  document.addEventListener("input", e=>{ const p=e.target.dataset && e.target.dataset.ntd; if(!p) return; setPath(draft(), p, e.target.value); if(!S.ntdDirty){ S.ntdDirty=true; const b=$("#ntadmin [data-ntd-act=save]"); if(b) b.disabled=false; } });
  document.addEventListener("change", e=>{
    const t=e.target;
    if(t.dataset && t.dataset.ntdAct==="show"){ const n=draft(); n.hidden = t.checked ? n.hidden.filter(x=>x!==t.dataset.id) : [...n.hidden, t.dataset.id]; S.ntdDirty=true; redrawAdmin(); }
  });
  document.addEventListener("toggle", e=>{ if(e.target.matches && e.target.matches("[data-ntd-details]")) S.ntImpOpen = e.target.open; }, true);
  document.addEventListener("click", async e=>{
    const b=e.target.closest("button[data-ntd-act]"); if(!b) return;
    const a=b.dataset.ntdAct, n=draft();
    if(a==="add-item"){ n.items.push({date:"", title:"", desc:"", url:""}); S.ntdDirty=true; redrawAdmin(); }
    else if(a==="del-item"){ n.items.splice(+b.dataset.i,1); S.ntdDirty=true; redrawAdmin(); }
    else if(a==="import"){
      const {out, bad} = parseDuty($("#nt-duty-text")?.value);
      if(!out.length){ $("#nt-duty-err").textContent = "看不懂這份排班表：每一列要有日期，以及主持、音控的姓名"; return; }
      n.duty = out; S.ntdDirty=true; S.ntImpOpen=false; redrawAdmin();
      toast(`已辨識 ${out.length} 週排班${bad.length?`，${bad.length} 列看不懂已略過`:""}，記得按「儲存公告」`);
    }
    else if(a==="preview"){ openNotice(n); }
    else if(a==="save"){
      b.disabled=true;
      try{ await api("admin/notice",{notice:{items:n.items.filter(x=>String(x.title||"").trim()), hidden:n.hidden, duty:n.duty}}); S.ntdDirty=false; S.ntd=null; toast("公告已儲存"); await refresh(); }
      catch(err){ toast(errMsg(err)); b.disabled=false; }
    }
  });
})();
