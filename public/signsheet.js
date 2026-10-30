/* 簽到表：課程管理 → 簽到表 → 預覽 → 下載 PDF（瀏覽器列印「另存為 PDF」）
   版面：A4 直式、雙欄；每頁最多 30 人（每欄 15 列），超過就分頁並平均分配，例如 50 人 → 2 頁各 25 人。 */
(function(){
  const PER_PAGE = 30;
  const SS = { id:null, sort:"list", blanks:true, unitOnly:true, extra:true };

  const style = document.createElement("style");
  style.textContent = `
#ss{position:fixed;inset:0;z-index:200;background:#e7e9ec;overflow:auto;-webkit-overflow-scrolling:touch}
#ss[hidden]{display:none}
.ss-bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 16px;background:var(--surface,#fff);border-bottom:1px solid var(--line,#d6dae0);color:var(--ink,#111)}
.ss-bar b{font-size:15px;margin-right:auto}
.ss-bar label{display:flex!important;flex-direction:row!important;align-items:center;gap:6px;font-size:13.5px;margin:0;color:var(--ink,#111);white-space:nowrap}
.ss-bar input[type=checkbox]{width:auto;margin:0}
.ss-bar select{font:inherit;font-size:13.5px;padding:4px 6px}
.ss-hint{flex-basis:100%;font-size:12.5px;color:var(--muted,#666)}
.ss-pages{padding:18px 0 40px;display:flex;flex-direction:column;align-items:center;gap:18px}
.ss-page{width:190mm;height:277mm;background:#fff;color:#000;box-shadow:0 2px 10px rgba(0,0,0,.18);display:flex;flex-direction:column;padding:0;box-sizing:border-box;padding:0 .6mm;overflow:hidden;font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}
.ss-head{padding:2mm 1mm 3mm;border-bottom:.6mm solid #000;margin-bottom:3mm;display:flex;align-items:flex-end;gap:4mm}
.ss-head .t{flex:1;min-width:0}
.ss-head h1{font-size:19pt;line-height:1.25;margin:0;font-weight:700;color:#000}
.ss-head .sub{font-size:10pt;margin-top:1.2mm;color:#222}
.ss-head .kind{flex:none;font-size:13pt;font-weight:700;border:.4mm solid #000;padding:1mm 3mm;border-radius:1.5mm}
.ss-cols{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:4mm;min-height:0}
.ss-tbl{width:100%;border-collapse:collapse;table-layout:fixed;align-self:start}
.ss-tbl th,.ss-tbl td{border:.3mm solid #000;padding:0 1.4mm;vertical-align:middle;overflow:hidden;white-space:normal;color:#000;text-align:left;letter-spacing:0}
.ss-tbl th{height:8mm;font-size:9.5pt;font-weight:700;background:#f1f1f1;text-align:center;text-transform:none}
.ss-tbl td{font-size:10.5pt}
.ss-tbl td.n{text-align:center;font-size:9pt;color:#333}
.ss-tbl td.d{font-size:9pt;line-height:1.2;word-break:break-all}
.ss-tbl td.nm{font-weight:700;font-size:11pt;white-space:nowrap!important}
.ss-tbl td.x{font-size:8.5pt;line-height:1.2;word-break:break-all}
.ss-foot{display:flex;justify-content:space-between;font-size:8.5pt;color:#333;padding-top:2mm}
@page{size:A4 portrait;margin:10mm}
@media print{
  html,body{background:#fff!important}
  body.ss-printing>*:not(#ss){display:none!important}
  body.ss-printing #ss{position:static;overflow:visible;background:none}
  .ss-bar{display:none!important}
  .ss-pages{padding:0;gap:0;display:block;zoom:1!important}
  .ss-page{box-shadow:none;break-after:page;page-break-after:always;margin:0;height:275mm}
  .ss-page:last-child{break-after:auto;page-break-after:auto}
}`;
  document.head.appendChild(style);

  const box = document.createElement("div");
  box.id = "ss"; box.hidden = true; box.setAttribute("role","dialog"); box.setAttribute("aria-label","簽到表預覽");
  document.body.appendChild(box);

  const shortAward = t => String(t||"").split(/[：:]/)[0].trim();

  function rowsFor(c){
    let list = isAward(c) ? officialFor(c.id).map(o=>({...o})) : peopleFor(c);
    if(SS.unitOnly && c.listOnly && c.listUnit) list = list.filter(p=>normUnit(p.unit)===normUnit(c.listUnit));
    list = list.map(p=>({division:p.division||"", name:p.name||"",
      extra: isAward(c) ? shortAward(p.award) : isMeal(c) ? [p.meal,p.drink].filter(Boolean).join("／") : (p.note||"")}));
    if(SS.sort==="div") list.sort((a,b)=>a.division.localeCompare(b.division,"zh-Hant")||a.name.localeCompare(b.name,"zh-Hant"));
    return list;
  }
  function extraLabel(c, rows){
    if(!SS.extra || !rows.some(r=>r.extra)) return "";
    if(isAward(c)) return "獎勵";
    if(isMeal(c)) return c.drinkLabel||c.mealLabel ? [mealL(c), c.drinkLabel?drinkL(c):""].filter(Boolean).join("／") : "餐點";
    return "備註";
  }

  function build(c){
    const rows = rowsFor(c), n = rows.length;
    const xl = extraLabel(c, rows);
    const pages = Math.max(1, Math.ceil(n / PER_PAGE));
    const perPage = Math.max(1, Math.ceil(n / pages));
    const perCol = Math.max(10, Math.ceil(perPage / 2));
    // 表格區高度約 240mm（扣掉標題、頁尾、表頭）
    const rowH = Math.max(9, Math.min(20, Math.floor((236 / perCol) * 10) / 10));
    const kind = isAward(c) ? "領獎簽收表" : "簽到表";
    const sub = [c.date ? fmtDay(c.date) : "", isAward(c) ? "" : c.time, isAward(c) ? "" : c.location].filter(Boolean).join("　");
    const colgroup = xl
      ? `<col style="width:6.5mm"><col style="width:19mm"><col style="width:16.5mm"><col style="width:22mm"><col>`
      : `<col style="width:7mm"><col style="width:24mm"><col style="width:22mm"><col>`;
    const head = `<tr><th>#</th><th>事業部</th><th>姓名</th>${xl?`<th>${esc(xl)}</th>`:""}<th>簽名</th></tr>`;
    const cell = (r, i) => r
      ? `<tr style="height:${rowH}mm"><td class="n">${i}</td><td class="d">${esc(r.division)}</td><td class="nm">${esc(r.name)}</td>${xl?`<td class="x">${esc(r.extra)}</td>`:""}<td></td></tr>`
      : `<tr style="height:${rowH}mm"><td class="n"></td><td></td><td></td>${xl?"<td></td>":""}<td></td></tr>`;
    let html = "", k = 0;
    for(let p=0; p<pages; p++){
      const chunk = rows.slice(p*perPage, (p+1)*perPage);
      const slots = SS.blanks ? perCol*2 : Math.max(chunk.length, 1);
      const col = side => {
        let out = "";
        for(let j=0; j<perCol; j++){
          const idx = side*perCol + j;
          if(idx >= slots) break;
          out += idx < chunk.length ? cell(chunk[idx], p*perPage + idx + 1) : cell(null);
        }
        return `<table class="ss-tbl"><colgroup>${colgroup}</colgroup><thead>${head}</thead><tbody>${out}</tbody></table>`;
      };
      k += chunk.length;
      html += `<section class="ss-page">
        <div class="ss-head"><div class="t"><h1>${esc(c.title)}</h1>${sub?`<div class="sub">${esc(sub)}</div>`:""}</div><span class="kind">${kind}</span></div>
        <div class="ss-cols">${col(0)}${slots>perCol?col(1):"<div></div>"}</div>
        <div class="ss-foot"><span>共 ${n} 人${SS.unitOnly && c.listOnly && c.listUnit ? `（${esc(c.listUnit)}業務中心）` : ""}</span><span>第 ${p+1} / ${pages} 頁</span></div>
      </section>`;
    }
    return {html, n, pages};
  }

  function fit(){
    const wrap = box.querySelector(".ss-pages"); if(!wrap) return;
    const pagePx = 190 * 96 / 25.4;
    const s = Math.min(1, (window.innerWidth - 24) / pagePx);
    wrap.style.zoom = s < 1 ? String(s) : "";
  }

  function draw(){
    const c = S.courses.find(x=>x.id===SS.id); if(!c){ close(); return; }
    const {html, n, pages} = build(c);
    const hasUnit = !!(c.listOnly && c.listUnit);
    box.innerHTML = `<div class="ss-bar">
        <b>${isAward(c)?"領獎簽收表":"簽到表"}預覽 · ${n} 人 · ${pages} 頁</b>
        <label>排序 <select data-ss="sort"><option value="list"${SS.sort==="list"?" selected":""}>依名單順序</option><option value="div"${SS.sort==="div"?" selected":""}>依事業部</option></select></label>
        <label><input type="checkbox" data-ss="extra"${SS.extra?" checked":""}> 顯示${isAward(c)?"獎勵":isMeal(c)?"餐點":"備註"}欄</label>
        <label><input type="checkbox" data-ss="blanks"${SS.blanks?" checked":""}> 補空白列（現場加簽）</label>
        ${hasUnit?`<label><input type="checkbox" data-ss="unitOnly"${SS.unitOnly?" checked":""}> 只列${esc(c.listUnit)}業務中心</label>`:""}
        <button type="button" class="btn primary" data-ss="print">下載 PDF</button>
        <button type="button" class="btn link" data-ss="close">關閉</button>
        <span class="ss-hint">按「下載 PDF」後，在列印視窗的目的地選「另存為 PDF」（手機選「儲存為 PDF」或分享 → 列印）。紙張 A4、直式；建議把「頁首和頁尾」關掉。</span>
      </div><div class="ss-pages">${html}</div>`;
    fit();
  }

  function close(){ box.hidden = true; box.innerHTML = ""; document.body.classList.remove("ss-printing"); document.documentElement.style.overflow = ""; SS.id = null; }

  window.openSignSheet = function(id){
    SS.id = id; SS.unitOnly = true;
    box.hidden = false; document.documentElement.style.overflow = "hidden"; document.body.classList.add("ss-printing");
    draw(); box.scrollTop = 0;
  };

  box.addEventListener("change", e=>{
    const k = e.target.dataset.ss; if(!k) return;
    if(k==="sort") SS.sort = e.target.value; else SS[k] = e.target.checked;
    draw();
  });
  box.addEventListener("click", e=>{
    const b = e.target.closest("[data-ss]"); if(!b || b.tagName==="SELECT" || b.tagName==="INPUT") return;
    if(b.dataset.ss==="close") close();
    if(b.dataset.ss==="print"){
      const c = S.courses.find(x=>x.id===SS.id);
      const old = document.title;
      document.title = (c ? c.title.replace(/[\\/:*?"<>|]/g," ").trim() : "課程") + (c&&isAward(c) ? "_領獎簽收表" : "_簽到表");
      const done = ()=>{ document.title = old; window.removeEventListener("afterprint", done); };
      window.addEventListener("afterprint", done);
      setTimeout(()=>window.print(), 50);
    }
  });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !box.hidden) close(); });
  window.addEventListener("resize", ()=>{ if(!box.hidden) fit(); });
})();
