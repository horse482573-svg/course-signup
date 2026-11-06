/* 行事曆：課程總覽頂端「📅 本月行事曆」→ 跳出可放大縮小的行事曆圖；可存多個月份
   舉辦人在課程管理上傳 PDF 或圖片；PDF 會在瀏覽器轉成清晰圖片（很多手機無法在網頁裡開 PDF），並保留原檔供下載 */
(function(){
  const list = () => (S.calendars||[]).slice().sort((a,b)=>b.month.localeCompare(a.month));
  const ym = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  const label = m => { const [y,mo] = m.split("-"); return `${y}年${+mo}月`; };
  function defaultMonth(){
    const L = list(), cur = ym(); if(!L.length) return "";
    if(L.some(x=>x.month===cur)) return cur;
    const past = L.find(x=>x.month<cur); return (past||L[L.length-1]).month;
  }

  /* ---------- 課程總覽頂端的按鈕 ---------- */
  window.calendarButton = function(){
    if(!list().length) return "";
    const has = list().some(x=>x.month===ym());
    return `<div class="cal-row"><button type="button" class="btn sm cal-btn" data-cal="open">📅 ${has?"本月行事曆":"行事曆"}</button></div>`;
  };

  /* ---------- 檢視視窗 ---------- */
  const V = { month:"", z:1 };
  const box = document.createElement("div"); box.id="calv"; box.hidden=true; box.setAttribute("role","dialog"); box.setAttribute("aria-label","行事曆");
  document.body.appendChild(box);
  const st = document.createElement("style");
  st.textContent = `
.cal-row{display:flex;justify-content:flex-end;margin:0 0 10px}
.cal-btn{font-size:14px}
#calv{position:fixed;inset:0;z-index:220;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px}
#calv[hidden]{display:none}
#calv .cv-card{background:var(--surface,#fff);color:var(--ink,#111);border-radius:12px;width:min(980px,100%);height:min(94vh,100%);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.35)}
#calv .cv-head{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line,#ddd)}
#calv .cv-head b{font-size:16px;white-space:nowrap}
#calv .cv-head select{font:inherit;font-size:15px;padding:4px 8px;border-radius:8px;border:1px solid var(--line,#ccc);background:var(--surface,#fff);color:inherit;min-width:0}
#calv .cv-x{margin-left:auto;border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:inherit;padding:4px 8px}
#calv .cv-view{flex:1;overflow:auto;background:#e7e9ec;touch-action:pan-x pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
#calv .cv-view img{display:block;margin:0 auto;max-width:none;background:#fff;user-select:none;-webkit-user-drag:none}
#calv .cv-foot{display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 12px;border-top:1px solid var(--line,#ddd);flex-wrap:wrap}
#calv .cv-foot .z{min-width:56px;text-align:center;font-variant-numeric:tabular-nums;font-size:14px}
#calv .cv-foot .sp{flex:1}
#calv .cv-tip{font-size:12px;color:var(--muted,#666)}
@media (max-width:600px){ #calv{padding:0} #calv .cv-card{border-radius:0;height:100%} #calv .cv-tip{display:none} }
.cal-admin ul{list-style:none;padding:0;margin:8px 0 0}
.cal-admin li{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;padding:8px 0;border-top:1px solid var(--line)}
.cal-admin li b{min-width:7em}
.cal-admin .up{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.cal-admin .up label:not(.btn){flex-direction:row;align-items:center;gap:6px;color:var(--ink);font-size:14px}
.cal-admin input[type=month]{font:inherit;padding:4px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}
`;
  document.head.appendChild(st);

  const item = () => list().find(x=>x.month===V.month);
  function draw(){
    const it = item(); if(!it){ close(); return; }
    box.innerHTML = `<div class="cv-card">
      <div class="cv-head"><b>📅 行事曆</b>
        <select data-cal="month" aria-label="選擇月份">${list().map(x=>`<option value="${esc(x.month)}"${x.month===V.month?" selected":""}>${esc(label(x.month))}</option>`).join("")}</select>
        <button type="button" class="cv-x" data-cal="close" aria-label="關閉">✕</button></div>
      <div class="cv-view"><img src="${esc(blob(it.img))}" alt="${esc(label(it.month))}行事曆" draggable="false"></div>
      <div class="cv-foot"><button type="button" class="btn sm" data-cal="out" aria-label="縮小">－</button><span class="z"></span><button type="button" class="btn sm" data-cal="in" aria-label="放大">＋</button>
        <button type="button" class="btn sm link" data-cal="fit">符合畫面</button>
        <span class="cv-tip">雙指或 Ctrl＋滾輪可放大縮小，雙擊切換</span>
        ${it.pdf?`<a class="btn sm" href="${esc(blob(it.pdf))}" target="_blank" rel="noopener">⬇ 下載原檔</a>`:""}</div></div>`;
    const img = box.querySelector("img");
    const apply = () => setZoom(1, null);
    if(img.complete && img.naturalWidth) apply(); else img.onload = apply;
  }
  function fitW(){ const v = box.querySelector(".cv-view"); return v ? v.clientWidth : 800; }
  function setZoom(z, at){ // at = {x,y}：以這個點為中心縮放
    const v = box.querySelector(".cv-view"), img = v && v.querySelector("img"); if(!img) return;
    const old = V.z; V.z = Math.max(1, Math.min(5, z));
    const ax = at ? at.x : v.clientWidth/2, ay = at ? at.y : v.clientHeight/2;
    const cx = (v.scrollLeft + ax) / (img.offsetWidth||1), cy = (v.scrollTop + ay) / (img.offsetHeight||1);
    img.style.width = Math.round(fitW()*V.z) + "px";
    if(old !== V.z || at){ v.scrollLeft = cx*img.offsetWidth - ax; v.scrollTop = cy*img.offsetHeight - ay; }
    const zl = box.querySelector(".z"); if(zl) zl.textContent = Math.round(V.z*100) + "%";
  }
  function open(m){ V.month = m || defaultMonth(); V.z = 1; if(!V.month) return; box.hidden=false; document.documentElement.style.overflow="hidden"; draw(); }
  function close(){ box.hidden=true; box.innerHTML=""; document.documentElement.style.overflow=""; }
  window.openCalendar = open;

  box.addEventListener("click", e=>{
    if(e.target===box){ close(); return; }
    const t = e.target.closest("[data-cal]"); if(!t || t.tagName==="SELECT") return;
    const a = t.dataset.cal;
    if(a==="close") close();
    else if(a==="in") setZoom(V.z*1.25);
    else if(a==="out") setZoom(V.z/1.25);
    else if(a==="fit") setZoom(1);
  });
  box.addEventListener("change", e=>{ if(e.target.dataset.cal==="month"){ V.month=e.target.value; V.z=1; draw(); } });
  box.addEventListener("dblclick", e=>{ const v=e.target.closest(".cv-view"); if(!v) return; const r=v.getBoundingClientRect(); setZoom(V.z>1.05?1:2.5, {x:e.clientX-r.left, y:e.clientY-r.top}); });
  box.addEventListener("wheel", e=>{ const v=e.target.closest(".cv-view"); if(!v || !(e.ctrlKey||e.metaKey)) return; e.preventDefault(); const r=v.getBoundingClientRect(); setZoom(V.z*(e.deltaY<0?1.15:1/1.15), {x:e.clientX-r.left, y:e.clientY-r.top}); }, {passive:false});
  // 雙指縮放（自己處理，避免整個網頁被放大）
  let pinch = null, lastTap = 0;
  box.addEventListener("touchstart", e=>{
    const v = e.target.closest(".cv-view"); if(!v) return;
    if(e.touches.length===2){ const [a,b]=e.touches, r=v.getBoundingClientRect(); pinch = {d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY), z:V.z, at:{x:(a.clientX+b.clientX)/2-r.left, y:(a.clientY+b.clientY)/2-r.top}}; e.preventDefault(); }
    else if(e.touches.length===1){ const now=Date.now(); if(now-lastTap<300){ const r=v.getBoundingClientRect(), t=e.touches[0]; setZoom(V.z>1.05?1:2.5, {x:t.clientX-r.left, y:t.clientY-r.top}); e.preventDefault(); lastTap=0; } else lastTap=now; }
  }, {passive:false});
  box.addEventListener("touchmove", e=>{
    if(!pinch || e.touches.length!==2) return; e.preventDefault();
    const [a,b]=e.touches, d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    setZoom(pinch.z*d/pinch.d, pinch.at);
  }, {passive:false});
  box.addEventListener("touchend", e=>{ if(e.touches.length<2) pinch=null; });
  window.addEventListener("resize", ()=>{ if(!box.hidden) setZoom(V.z); });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !box.hidden) close(); });
  document.addEventListener("click", e=>{ if(e.target.closest(".cal-btn[data-cal=open]")) open(); });

  /* ---------- 課程管理：上傳／取代／刪除 ---------- */
  const A = { month:"", busy:"", file:null };
  function guessMonth(name){
    const m = String(name||"").match(/(20\d{2})\D{0,3}(1[0-2]|0?[1-9])(?!\d)/);
    return m ? `${m[1]}-${String(+m[2]).padStart(2,"0")}` : "";
  }
  window.calendarAdmin = function(){
    const L = list();
    return `<section class="panel cal-admin" id="caladmin"><h2>📅 行事曆管理</h2>
      <p class="who">上傳後，課程總覽頂端會出現「📅 本月行事曆」按鈕。可以上傳 PDF 或圖片；同一個月份再上傳會取代舊的。</p>
      <div class="up">
        <label class="btn">${A.file?"重新選擇":"選擇 PDF 或圖片"}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" data-cal="file" hidden></label>
        ${A.file?`<span>${esc(A.file.name)}</span>`:""}
        <label>月份 <input type="month" data-cal="amonth" value="${esc(A.month||ym())}"></label>
        <button type="button" class="btn primary" data-cal="upload"${A.file&&!A.busy?"":" disabled"}>上傳</button>
        <span class="err" id="cal-st">${esc(A.busy)}</span>
      </div>
      ${L.length?`<ul>${L.map(x=>`<li><b>${esc(label(x.month))}</b><span class="who">上傳於 ${esc(fmtTime(x.at))}${x.pdf?"・PDF":""}</span>
        <button type="button" class="btn sm" data-cal="view" data-m="${esc(x.month)}">查看</button>
        <label class="btn sm">取代<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" data-cal="replace" data-m="${esc(x.month)}" hidden></label>
        <button type="button" class="btn sm link" data-cal="del" data-m="${esc(x.month)}" style="color:var(--danger)">刪除</button></li>`).join("")}</ul>`:`<p class="who">還沒有上傳行事曆。</p>`}
    </section>`;
  };
  const redrawAdmin = () => { const el=$("#caladmin"); if(el) el.outerHTML = calendarAdmin(); };
  const status = t => { A.busy = t; const el=$("#cal-st"); if(el) el.textContent = t; };

  let pdfjsP = null;
  function loadPdfjs(){
    if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return pdfjsP || (pdfjsP = new Promise((ok, no)=>{
      const s = document.createElement("script"); s.src = "/vendor/pdfjs/pdf.js";
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.js"; ok(window.pdfjsLib); };
      s.onerror = () => { pdfjsP = null; no({error:"pdfjs"}); };
      document.head.appendChild(s);
    }));
  }
  async function toJpeg(cv){
    for(const q of [0.88,0.8,0.7,0.6]){
      const b = await new Promise(r=>cv.toBlob(r,"image/jpeg",q));
      if(b && b.size <= 1300*1024) return b;
    }
    throw {error:"too_large"};
  }
  // PDF → 一張圖（多頁會由上而下接在一起）
  async function pdfToImage(file){
    const lib = await loadPdfjs();
    const doc = await lib.getDocument({data: await file.arrayBuffer(), cMapUrl:"/vendor/pdfjs/cmaps/", cMapPacked:true, standardFontDataUrl:"/vendor/pdfjs/standard_fonts/"}).promise;
    const n = Math.min(doc.numPages, 6), pages = [];
    for(let i=1;i<=n;i++) pages.push(await doc.getPage(i));
    const W = 2000, vps = pages.map(p=>{ const v0=p.getViewport({scale:1}); return p.getViewport({scale: W/v0.width}); });
    let H = vps.reduce((s,v)=>s+Math.ceil(v.height),0);
    const k = H > 8000 ? 8000/H : 1;
    const cv = document.createElement("canvas"); cv.width = Math.round(W*k); cv.height = Math.round(H*k);
    const ctx = cv.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height);
    let y = 0;
    for(let i=0;i<pages.length;i++){
      const vp = k<1 ? pages[i].getViewport({scale: vps[i].scale*k}) : vps[i];
      const pc = document.createElement("canvas"); pc.width = Math.ceil(vp.width); pc.height = Math.ceil(vp.height);
      const pctx = pc.getContext("2d"); pctx.fillStyle="#fff"; pctx.fillRect(0,0,pc.width,pc.height);
      await pages[i].render({canvasContext:pctx, viewport:vp}).promise;
      ctx.drawImage(pc, 0, y); y += pc.height;
    }
    return {blob: await toJpeg(cv), w: cv.width, h: cv.height};
  }
  async function imgToImage(file){
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 2400/Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width=Math.round(bmp.width*s); cv.height=Math.round(bmp.height*s);
    const ctx = cv.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height); ctx.drawImage(bmp,0,0,cv.width,cv.height);
    return {blob: await toJpeg(cv), w: cv.width, h: cv.height};
  }
  async function upload(file, month){
    if(!/^\d{4}-\d{2}$/.test(month||"")){ status("請選擇月份"); return; }
    const isPdf = file.type==="application/pdf" || /\.pdf$/i.test(file.name);
    if(!isPdf && !/^image\//.test(file.type)){ status("請選 PDF 或 JPG、PNG 圖片"); return; }
    if(isPdf && file.size > 1300*1024){ status("PDF 檔案太大（上限約 1.3MB）"); return; }
    status(isPdf ? "正在把 PDF 轉成圖片…" : "處理圖片中…");
    try{
      const im = isPdf ? await pdfToImage(file) : await imgToImage(file);
      status("上傳中…");
      const img = (await api("admin/image", im.blob)).id;
      const pdf = isPdf ? (await api("admin/image", new Blob([await file.arrayBuffer()], {type:"application/pdf"}))).id : "";
      const old = (S.calendars||[]).find(x=>x.month===month);
      const items = (S.calendars||[]).filter(x=>x.month!==month).concat([{month, img, pdf, name:file.name.slice(0,80), w:im.w, h:im.h, at:new Date().toISOString()}]);
      await api("admin/calendar", {items});
      S.calendars = items;
      if(old) dropImages([old.img, old.pdf]);
      A.file = null; A.month = ""; A.busy = "";
      toast(`${label(month)}行事曆已${old?"更新":"上傳"}`);
      render(true);
    }catch(e){ status(e && e.error==="pdfjs" ? "PDF 轉換工具載入失敗，請重新整理再試" : e && e.error ? errMsg(e) : "PDF 無法讀取，請改上傳圖片"); A.busy=""; const b=$("#caladmin [data-cal=upload]"); if(b) b.disabled=!A.file; }
  }

  document.addEventListener("change", e=>{
    const t = e.target, a = t.dataset && t.dataset.cal; if(!a || !t.closest("#caladmin")) return;
    if(a==="amonth"){ A.month = t.value; return; }
    const f = t.files && t.files[0]; if(!f) return;
    if(a==="file"){ A.file = f; A.month = guessMonth(f.name) || A.month || ym(); A.busy=""; redrawAdmin(); }
    else if(a==="replace"){ upload(f, t.dataset.m); }
  });
  document.addEventListener("click", async e=>{
    const t = e.target.closest("#caladmin [data-cal]"); if(!t || t.tagName==="INPUT" || t.tagName==="LABEL") return;
    const a = t.dataset.cal;
    if(a==="upload" && A.file){ t.disabled = true; upload(A.file, A.month || ym()); }
    else if(a==="view") open(t.dataset.m);
    else if(a==="del"){
      const m = t.dataset.m, it = (S.calendars||[]).find(x=>x.month===m); if(!it) return;
      if(!confirm(`確定刪除 ${label(m)} 的行事曆？`)) return;
      const items = S.calendars.filter(x=>x.month!==m);
      try{ await api("admin/calendar", {items}); S.calendars = items; dropImages([it.img, it.pdf]); toast("已刪除"); render(true); }
      catch(err){ toast(errMsg(err)); }
    }
  });
})();
