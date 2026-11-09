/* 簽到表：課程管理 → 簽到表 → 預覽 → 下載 PDF（瀏覽器列印「另存為 PDF」）
   版面：A4 直式、雙欄；每頁最多 30 人（每欄 15 列），超過就分頁並平均分配，例如 50 人 → 2 頁各 25 人。 */
(function(){
  const PER_PAGE = 30;
  const SS = { id:null, sort:"list", blanks:true, unitOnly:true, wonOnly:true, cols:null, panel:false, dirty:false };

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
.ss-head{border:.35mm solid #222;border-bottom:0;padding:3.2mm 3mm 2.6mm;text-align:center}
.ss-head h1{font-size:16pt;line-height:1.3;margin:0;font-weight:700;color:#000;letter-spacing:.02em}
.ss-head .sub{font-size:9.5pt;margin-top:.8mm;color:#555}
.ss-cols{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0;min-height:0;align-content:start}
.ss-cols.one{grid-template-columns:1fr}
.ss-set{flex-basis:100%;border:1px solid var(--line,#d6dae0);border-radius:10px;padding:10px 12px;background:var(--bg,#f6f7f9)}
.ss-set h4{margin:0 0 6px;font-size:14px}
.ss-set table{border-collapse:collapse;width:100%;font-size:13.5px}
.ss-set th,.ss-set td{padding:4px 6px;border-bottom:1px solid var(--line,#e2e5ea);text-align:left;white-space:nowrap}
.ss-set th{font-size:12px;color:var(--muted,#666);font-weight:600}
.ss-set td.c{text-align:center}
.ss-set input[type=text]{font:inherit;font-size:13.5px;padding:3px 6px;width:9em;max-width:100%}
.ss-set .mv{padding:2px 7px;font-size:13px;line-height:1.2;border:1px solid var(--line,#ccc);border-radius:6px;background:var(--surface,#fff);color:inherit;cursor:pointer}
.ss-set .mv:disabled{opacity:.35;cursor:default}
.ss-set .row-add{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;font-size:13.5px}
.ss-set .fixed{color:var(--muted,#888);font-size:12.5px}
.ss-set .tw{overflow-x:auto}
.ss-tbl{width:100%;border-collapse:collapse;table-layout:fixed;align-self:start}
.ss-cols:not(.one) .ss-tbl+.ss-tbl{border-left:.5mm solid #222}
.ss-tbl th,.ss-tbl td{border:.25mm solid #222;padding:0 1.2mm;vertical-align:middle;overflow:hidden;white-space:normal;color:#333;text-align:center;letter-spacing:.02em;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ss-tbl th{height:9mm;font-size:10pt;font-weight:400;background:#5b3f86;color:#fff;text-transform:none}
.ss-tbl tbody tr:nth-child(even) td{background:#f8f9fa}
.ss-tbl td{font-size:11pt}
.ss-tbl td.n,.ss-tbl tbody tr:nth-child(even) td.n{background:#c9daf8;font-size:12.5pt;font-weight:700;color:#222;padding:0}
.ss-tbl td.d{font-size:11pt;line-height:1.25;word-break:break-all}
.ss-tbl td.nm{font-size:12pt;font-weight:500;white-space:nowrap!important}
.ss-tbl td.x{font-size:9pt;line-height:1.25;word-break:break-all}
.ss-tbl td.q{font-size:14pt;font-weight:700;color:#000}
.ss-foot{display:flex;justify-content:space-between;font-size:8.5pt;color:#333;padding-top:2mm}
.st-doc{width:190mm;background:#fff;color:#222;box-shadow:0 2px 10px rgba(0,0,0,.18);box-sizing:border-box;padding:0 .6mm 4mm;font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}
.st-head{border-bottom:.35mm solid #222!important;margin-bottom:4mm}
.st-sec{margin:0 0 5mm;break-inside:avoid}
.st-sec h2{font-size:12pt;margin:0 0 1.5mm;padding-left:2mm;border-left:1.2mm solid #5b3f86;color:#000}
.st-t{border-collapse:collapse;-webkit-print-color-adjust:exact;print-color-adjust:exact;width:auto;min-width:60%}
.st-t th,.st-t td{border:.25mm solid #444;padding:1.6mm 3mm;font-size:11pt;color:#333;vertical-align:top;white-space:normal;text-align:left}
.st-t th{background:#5b3f86;color:#fff;font-weight:400;font-size:10pt;text-align:left;white-space:nowrap}
.st-t tbody tr:nth-child(even) td{background:#f8f9fa}
.st-t td.st-k{white-space:nowrap;min-width:20mm}
.st-t td.st-n{text-align:right;font-weight:700;white-space:nowrap;min-width:12mm;font-variant-numeric:tabular-nums}
.st-t td.st-w{font-size:9.5pt;line-height:1.5;word-break:break-all}
.st-t.wide{width:100%}
.st-t tr.st-blank td{color:#c0392b}
.st-t tr.st-sum td{background:#c9daf8!important;font-weight:700}
.st-none{color:#666;font-size:11pt}
.ss-docs{display:flex;gap:10px;align-items:center;font-size:13.5px}
.ss-statset{flex-basis:100%;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:13.5px}
@page{size:A4 portrait;margin:10mm}
@media print{
  html,body{background:#fff!important}
  body.ss-printing>*:not(#ss){display:none!important}
  body.ss-printing #ss{position:static;overflow:visible;background:none}
  .ss-bar{display:none!important}
  .ss-pages{padding:0;gap:0;display:block;zoom:1!important}
  .ss-page{box-shadow:none;break-after:page;page-break-after:always;margin:0;height:275mm}
  .ss-page:last-child{break-after:auto;page-break-after:auto}
  .st-doc{box-shadow:none;width:auto;break-before:page}
  .ss-pages>.st-doc:first-child{break-before:auto}
}`;
  document.head.appendChild(style);

  const box = document.createElement("div");
  box.id = "ss"; box.hidden = true; box.setAttribute("role","dialog"); box.setAttribute("aria-label","簽到表預覽");
  document.body.appendChild(box);

  const shortAward = t => String(t||"").split(/[：:]/)[0].replace(/（[^）]*）/g,"").replace("星巴克禮券","星巴克").trim();

  function rowsFor(c){
    let list = colRows(c);
    if(isAward(c) && SS.wonOnly) list = list.filter(p=>String(p.award||"").trim()); // 只列有領獎的人
    if(SS.unitOnly && c.listOnly && c.listUnit) list = list.filter(p=>normUnit(p.unit)===normUnit(c.listUnit));
    if(SS.sort==="div") list = [...list].sort((a,b)=>String(a.division||"").localeCompare(String(b.division||""),"zh-Hant")||String(a.name||"").localeCompare(String(b.name||""),"zh-Hant"));
    return list;
  }
  const signOn = c => !(SS.signOff ?? c.signOff);
  const signLab = c => (SS.signLabel ?? c.signLabel) || (isAward(c) ? "簽收" : "簽到");
  const cellText = (p, k) => k==="_q" ? String(p._q) : k==="award" ? shortAward(p.award) : String(colVal(p, k)||"");
  // 依內容長度估欄寬（mm）
  function widthOf(col, rows){
    if(col.k==="division") return Math.min(30, Math.max(18, Math.max(...rows.map(p=>String(p.division||"").length), 3) * 3.9 + 3));
    if(col.k==="name") return 17;
    if(col.k==="_q") return 14;
    const longest = Math.max(col.label.length, ...rows.map(p=>cellText(p,col.k).length));
    const base = col.blank ? Math.max(18, col.label.length*4.2) : Math.min(26, Math.max(13, longest*2.9));
    return base;
  }

  function build(c, o){
    o = o || {};
    const rows = o.rows || rowsFor(c), n = rows.length;
    const cols = o.cols || (SS.cols || colsOf(c)).filter(x=>x.sign);
    // 欄寬：序號 8mm、簽名至少 24mm；放不下就改單欄
    const widths = cols.map(x=>widthOf(x, rows));
    const sg = signOn(c) ? 22 : 0;
    const need = 8 + widths.reduce((a,b)=>a+b,0) + sg;
    const single = need > 93;
    const avail = single ? 189 : 93;
    // 放不下就等比縮；單欄時空間多，資料欄適度放寬（簽名欄至少 50mm）
    const scale = need > avail ? (avail - 8 - sg) / (need - 8 - sg) : single && sg ? Math.max(1, Math.min(1.6, (avail - 8 - 50) / (need - 8 - sg))) : 1;
    const per = single ? 20 : PER_PAGE;
    const pages = Math.max(1, Math.ceil(n / per));
    const perPage = Math.max(1, Math.ceil(n / pages));
    const perCol = single ? Math.max(10, perPage) : Math.max(10, Math.ceil(perPage / 2));
    // 表格區高度約 240mm（扣掉標題、頁尾、表頭）
    const rowH = Math.max(9, Math.min(20, Math.floor((236 / perCol) * 10) / 10));
    const kind = o.kind || (!signOn(c) ? "名單" : isAward(c) ? "領獎簽收表" : "簽到表");
    const dShort = (!isAward(c) && c.date) ? (d=>`${d.getMonth()+1}/${d.getDate()}(${WD[d.getDay()]})`)(new Date(c.date+"T00:00:00")) : "";
    const sub = o.sub != null ? o.sub : [isAward(c) ? "" : c.time, isAward(c) ? "" : c.location].filter(Boolean).join("　");
    // 不印簽到欄時，最後一個資料欄自動撐滿剩下的寬度
    const colgroup = `<col style="width:8mm">${widths.map((w,i)=>!sg && i===widths.length-1 ? "<col>" : `<col style="width:${(w*scale).toFixed(1)}mm">`).join("")}${sg?"<col>":""}`;
    const sgTh = sg ? `<th>${esc(signLab(c))}</th>` : "", sgTd = sg ? "<td></td>" : "";
    const head = `<tr><th></th>${cols.map(x=>`<th>${esc(x.label)}</th>`).join("")}${sgTh}</tr>`;
    const cls = k => k==="division" ? "d" : k==="name" ? "nm" : k==="_q" ? "q" : "x";
    const cell = (r, i) => r
      ? `<tr style="height:${rowH}mm"><td class="n">${i}</td>${cols.map(x=>`<td class="${cls(x.k)}">${esc(cellText(r,x.k))}</td>`).join("")}${sgTd}</tr>`
      : `<tr style="height:${rowH}mm"><td class="n"></td>${cols.map(()=>"<td></td>").join("")}${sgTd}</tr>`;
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
        <div class="ss-head"><h1>${esc([dShort, c.title, kind].filter(Boolean).join(" "))}</h1>${sub?`<div class="sub">${esc(sub)}</div>`:""}</div>
        <div class="ss-cols${single?" one":""}">${col(0)}${single?"":(slots>perCol?col(1):"<div></div>")}</div>
        <div class="ss-foot"><span>共 ${n} 人${SS.unitOnly && c.listOnly && c.listUnit ? `（${esc(c.listUnit)}業務中心）` : ""}</span><span>第 ${p+1} / ${pages} 頁</span></div>
      </section>`;
    }
    return {html, n, pages, single};
  }

  /* ---------- 依獎品分開的簽收表（例如：星巴克咖啡券、一般咖啡券）---------- */
  function prizeParts(award){
    return String(award||"").split(/[：:]/)[0].split(/[＋+]/).map(x=>x.replace(/（[^）]*）|\([^)]*\)/g,"").trim())
      .map(x=>{ const m = x.match(/^(.+?)\s*(\d+)\s*(張|份|個|組|盒|杯)?$/); return m ? {name:m[1].trim(), qty:+m[2], unit:m[3]||"張"} : null; }).filter(Boolean);
  }
  window.prizeParts = prizeParts;
  function prizesOf(c){
    const out = [];
    for(const p of officialFor(c.id)) for(const x of prizeParts(p.award)) if(!out.includes(x.name)) out.push(x.name);
    return out.sort((a,b)=>(/星巴克/.test(b)?1:0)-(/星巴克/.test(a)?1:0));   // 星巴克排前面
  }
  const prizeLabel = nm => /星巴克/.test(nm) ? "星巴克咖啡券" : nm==="咖啡券" ? "一般咖啡券" : nm;
  function buildPrize(c, nm){
    let rows = rowsFor(c).map(p=>{ const x = prizeParts(p.award).find(y=>y.name===nm); return x ? {...p, _q:x.qty, _u:x.unit} : null; }).filter(Boolean);
    if(SS.sort!=="div") rows.sort((a,b)=>b._q-a._q);
    const total = rows.reduce((s,p)=>s+p._q,0), unit = (rows[0]||{})._u || "張";
    return build(c, { rows, kind: prizeLabel(nm)+" 簽收表", sub: `共 ${rows.length} 人・${total} ${unit}`,
      cols: [{k:"division",label:"事業部"},{k:"name",label:"姓名"},{k:"_q",label:unit+"數"}] });
  }

  /* ---------- 統計表 ---------- */
  const docsOf = c => SS.docs || (SS.docs = {...{sign:true, stats:false, names:true, skip:[], prizes:{}}, ...(c.sheetDocs||{})});
  function statFields(c, rows){
    const out = [];
    const add = (k, label, get) => {
      const m = new Map(); const blank = [];
      for(const p of rows){ const v = String(get(p)||"").trim(); if(v){ if(!m.has(v)) m.set(v, []); m.get(v).push(p); } else blank.push(p); }
      if(!m.size || m.size > 12) return;   // 選項太多（例如手機號碼）就不統計
      // 選項都有數字（例如「咖啡券 8 張」）就依數字由多到少；否則依人數由多到少
      const numOf = v => { const x = String(v).match(/\d+(\.\d+)?/); return x ? parseFloat(x[0]) : null; };
      const allNum = [...m.keys()].every(v=>numOf(v)!=null);
      const arr = [...m].sort((a,b)=> allNum ? (numOf(b[0])-numOf(a[0]) || b[1].length-a[1].length) : (b[1].length-a[1].length));
      out.push({k, label, arr, blank});
    };
    const cc = colsOf(c, rows);
    const lab = k => (cc.find(x=>x.k===k)||{}).label;
    if(isMeal(c) || rows.some(p=>p.meal)) add("meal", lab("meal")||mealL(c), p=>p.meal);
    if(isMeal(c) || rows.some(p=>p.drink)) add("drink", lab("drink")||drinkL(c), p=>p.drink);
    if(isAward(c)) add("award", "獎勵", p=>shortAward(p.award));
    add("note", lab("note")||"備註", p=>p.note);
    for(const key of xKeys(rows)) add("x:"+key, lab("x:"+key)||key, p=>(p.extra||{})[key]);
    return out;
  }
  function buildStats(c){
    const rows = rowsFor(c), d = docsOf(c), fs = statFields(c, rows).filter(f=>!d.skip.includes(f.k));
    const dd = c.date ? new Date(c.date+"T00:00:00") : null;
    const dShort = (!isAward(c) && dd) ? `${dd.getMonth()+1}/${dd.getDate()}(${WD[dd.getDay()]})` : "";
    const sub = [isAward(c)?"":c.time, isAward(c)?"":c.location].filter(Boolean).join("　");
    const who = p => `${p.division?esc(p.division)+" ":""}${esc(p.name)}`;
    const tbl = f => `<section class="st-sec"><h2>${esc(f.label)}</h2>
      <table class="st-t${d.names?" wide":""}"><thead><tr><th>選項</th><th>數量</th>${d.names?"<th>名單</th>":""}</tr></thead><tbody>
      ${f.arr.map(([v,ps])=>`<tr><td class="st-k">${esc(v)}</td><td class="st-n">${ps.length}</td>${d.names?`<td class="st-w">${ps.map(who).join("、")}</td>`:""}</tr>`).join("")}
      ${f.blank.length?`<tr class="st-blank"><td class="st-k">（未填）</td><td class="st-n">${f.blank.length}</td>${d.names?`<td class="st-w">${f.blank.map(who).join("、")}</td>`:""}</tr>`:""}
      <tr class="st-sum"><td class="st-k">合計</td><td class="st-n">${rows.length}</td>${d.names?"<td></td>":""}</tr></tbody></table></section>`;
    return { html: `<section class="st-doc">
      <div class="ss-head st-head"><h1>${esc([dShort, c.title, "統計表"].filter(Boolean).join(" "))}</h1>${sub?`<div class="sub">${esc(sub)}</div>`:""}</div>
      ${fs.length ? fs.map(tbl).join("") : `<p class="st-none">這份名單沒有可以統計的欄位（例如午餐、飲料、交通方式）。</p>`}
      <div class="ss-foot"><span>共 ${rows.length} 人</span><span></span></div></section>`, all: statFields(c, rows) };
  }

  function fit(){
    const wrap = box.querySelector(".ss-pages"); if(!wrap) return;
    const pagePx = 190 * 96 / 25.4;
    const s = Math.min(1, (window.innerWidth - 24) / pagePx);
    wrap.style.zoom = s < 1 ? String(s) : "";
  }

  function settingsPanel(c){
    const cols = SS.cols;
    const rows = cols.map((x,i)=>`<tr>
        <td><input type="text" data-col="label" data-i="${i}" value="${esc(x.label)}" maxlength="20" aria-label="欄位名稱"> ${x.blank?'<span class="fixed">空白欄</span>':""}</td>
        <td class="c"><input type="checkbox" data-col="sign" data-i="${i}"${x.sign?" checked":""}${x.k==="name"?" disabled":""} aria-label="印在簽到表"></td>
        <td class="c">${x.blank?'<span class="fixed">—</span>':`<input type="checkbox" data-col="pub" data-i="${i}"${x.pub?" checked":""}${x.k==="name"?" disabled":""} aria-label="網站顯示">`}</td>
        <td><button type="button" class="mv" data-col="up" data-i="${i}"${i===0?" disabled":""} aria-label="上移">↑</button> <button type="button" class="mv" data-col="down" data-i="${i}"${i===cols.length-1?" disabled":""} aria-label="下移">↓</button>${x.blank?` <button type="button" class="mv" data-col="del" data-i="${i}" aria-label="刪除">刪除</button>`:""}</td>
      </tr>`).join("");
    return `<div class="ss-set">
      <h4>欄位設定（這堂課專用；課程管理頁面永遠顯示全部欄位）</h4>
      <div class="tw"><table><thead><tr><th>欄位名稱（可改）</th><th>簽到表</th><th>網站顯示</th><th>順序</th></tr></thead><tbody>
        <tr><td><span class="fixed">#　序號（固定第一欄）</span></td><td class="c">✓</td><td class="c">—</td><td></td></tr>
        ${rows}
        <tr><td><input type="text" data-col="signlabel" value="${esc(signLab(c))}" maxlength="12" aria-label="最後一欄名稱"> <span class="fixed">固定最後一欄</span></td><td class="c"><input type="checkbox" data-col="signon"${signOn(c)?" checked":""} aria-label="印出簽到欄"></td><td class="c">—</td><td></td></tr>
      </tbody></table></div>
      <div class="row-add">新增空白欄（給現場手寫）：<input type="text" id="ss-new" maxlength="20" placeholder="例如：簽到時間"><button type="button" class="btn" data-col="add">新增</button>
        <span style="flex:1"></span><button type="button" class="btn primary" data-col="save"${SS.dirty?"":" disabled"}>儲存設定</button>${SS.dirty?'<span class="fixed">尚未儲存</span>':""}</div>
      <p class="fixed" style="margin:6px 0 0">「網站顯示」＝同事在課程頁的報名名單上看得到；沒勾的欄位不會傳到同事的手機或電腦。</p>
    </div>`;
  }

  function draw(){
    const c = S.courses.find(x=>x.id===SS.id); if(!c){ close(); return; }
    if(!SS.cols) SS.cols = colsOf(c).map(x=>({...x}));
    const d = docsOf(c);
    const {html, n, pages, single} = build(c);
    const st = buildStats(c);
    const prizes = isAward(c) ? prizesOf(c) : [];
    const prizeOn = prizes.length>1 ? prizes.filter(nm=>(d.prizes||{})[nm]) : [];
    const prizeHTML = prizeOn.map(nm=>buildPrize(c, nm).html).join("");
    const anyDoc = d.sign || d.stats || prizeOn.length;
    const hasUnit = !!(c.listOnly && c.listUnit);
    const y = box.scrollTop;
    box.innerHTML = `<div class="ss-bar">
        <b>${!signOn(c)?"名單":isAward(c)?"領獎簽收表":"簽到表"}預覽 · ${n} 人${d.sign?` · ${pages} 頁${single?" · 單欄":""}`:""}</b>
        <span class="ss-docs">產出內容：<label><input type="checkbox" data-ss-doc="sign"${d.sign?" checked":""}> ${!signOn(c)?"名單":isAward(c)?(prizes.length>1?"簽收表（合併）":"簽收表"):"簽到表"}</label>${prizes.length>1?prizes.map(nm=>`<label><input type="checkbox" data-ss-prize="${esc(nm)}"${(d.prizes||{})[nm]?" checked":""}> ${esc(prizeLabel(nm))}簽收表</label>`).join(""):""}<label><input type="checkbox" data-ss-doc="stats"${d.stats?" checked":""}> 統計表</label></span>
        <label>排序 <select data-ss="sort"><option value="list"${SS.sort==="list"?" selected":""}>依名單順序</option><option value="div"${SS.sort==="div"?" selected":""}>依事業部</option></select></label>
        <label><input type="checkbox" data-ss="blanks"${SS.blanks?" checked":""}> 補空白列（現場加簽）</label>
        ${isAward(c) && officialFor(c.id).some(p=>!String(p.award||"").trim())?`<label><input type="checkbox" data-ss="wonOnly"${SS.wonOnly?" checked":""}> 只列有領獎的人</label>`:""}
        ${hasUnit?`<label><input type="checkbox" data-ss="unitOnly"${SS.unitOnly?" checked":""}> 只列${esc(c.listUnit)}業務中心</label>`:""}
        <button type="button" class="btn" data-ss="panel" aria-expanded="${SS.panel}">${SS.panel?"收起欄位設定":"欄位設定"}</button>
        <button type="button" class="btn primary" data-ss="print"${anyDoc?"":" disabled"}>下載 PDF</button>
        <button type="button" class="btn link" data-ss="close">關閉</button>
        ${SS.panel?settingsPanel(c):""}
        ${d.stats?`<span class="ss-statset">統計欄位：${st.all.length?st.all.map(f=>`<label><input type="checkbox" data-ss-stat="${esc(f.k)}"${d.skip.includes(f.k)?"":" checked"}> ${esc(f.label)}</label>`).join(""):'<span class="fixed">（沒有可統計的欄位）</span>'}<label><input type="checkbox" data-ss-doc="names"${d.names?" checked":""}> 附名單</label></span>`:""}
        <span class="ss-hint">按「下載 PDF」後，在列印視窗的目的地選「另存為 PDF」（手機選「儲存為 PDF」或分享 → 列印）。紙張 A4、直式；建議把「頁首和頁尾」關掉。欄位太多時會自動改成單欄。</span>
      </div><div class="ss-pages">${d.sign?html:""}${prizeHTML}${d.stats?st.html:""}${!anyDoc?'<p class="st-none" style="padding:30px">請至少勾選一種產出內容。</p>':""}</div>`;
    fit(); box.scrollTop = y;
  }

  async function saveCols(){
    const c = S.courses.find(x=>x.id===SS.id); if(!c) return;
    const cols = SS.cols.map(x=>({k:x.k, label:x.label, sign:!!x.sign, pub:!!x.pub}));
    try{
      await api("admin/course",{course:{...c, cols, ...(SS.signLabel!=null?{signLabel:SS.signLabel}:{}), ...(SS.signOff!=null?{signOff:SS.signOff}:{})}});
      SS.signLabel = null; SS.signOff = null;
      SS.dirty = false; toast("欄位設定已儲存");
      await refresh(true);
    }catch(e){ toast(errMsg(e)); }
    draw();
  }

  function close(){ box.hidden = true; box.innerHTML = ""; document.body.classList.remove("ss-printing"); document.documentElement.style.overflow = ""; SS.id = null; }

  window.openSignSheet = function(id){
    SS.id = id; SS.unitOnly = true; SS.docs = null; SS.cols = null; SS.panel = false; SS.dirty = false; SS.signLabel = null; SS.signOff = null;
    box.hidden = false; document.documentElement.style.overflow = "hidden"; document.body.classList.add("ss-printing");
    draw(); box.scrollTop = 0;
  };

  box.addEventListener("input", e=>{
    const t = e.target;
    if(t.dataset.col==="signlabel"){ SS.signLabel = t.value.trim(); SS.dirty = true; }
    else if(t.dataset.col==="label"){ SS.cols[+t.dataset.i].label = t.value.trim() || SS.cols[+t.dataset.i].label; SS.dirty = true; }
    else return;
    clearTimeout(SS.tm); SS.tm = setTimeout(()=>{ const f=document.activeElement, i=f&&f.dataset&&f.dataset.i, pos=f&&f.selectionStart; const col=f&&f.dataset&&f.dataset.col; draw(); if(col){ const n=col==="label"?box.querySelector(`[data-col=label][data-i="${i}"]`):box.querySelector(`[data-col=signlabel]`); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch(_){} } } }, 500);
  });
  async function saveDocs(){
    const c = S.courses.find(x=>x.id===SS.id); if(!c || !SS.docs) return;
    try{ await api("admin/course",{course:{...c, sheetDocs:SS.docs}}); c.sheetDocs = {...SS.docs}; }catch(e){ toast(errMsg(e)); }
  }
  box.addEventListener("change", e=>{
    const t = e.target;
    if(t.dataset.ssDoc){ const c=S.courses.find(x=>x.id===SS.id); const d=docsOf(c); d[t.dataset.ssDoc]=t.checked; draw(); saveDocs(); return; }
    if(t.dataset.ssPrize){ const c=S.courses.find(x=>x.id===SS.id); const d=docsOf(c); d.prizes = {...(d.prizes||{}), [t.dataset.ssPrize]: t.checked}; draw(); saveDocs(); return; }
    if(t.dataset.ssStat){ const c=S.courses.find(x=>x.id===SS.id); const d=docsOf(c); const k=t.dataset.ssStat; d.skip = t.checked ? d.skip.filter(x=>x!==k) : [...d.skip, k]; draw(); saveDocs(); return; }
    if(t.dataset.col==="signon"){ SS.signOff = !t.checked; SS.dirty = true; draw(); return; }
    if(t.dataset.col==="sign" || t.dataset.col==="pub"){ SS.cols[+t.dataset.i][t.dataset.col] = t.checked; SS.dirty = true; draw(); return; }
    const k = t.dataset.ss; if(!k) return;
    if(k==="sort") SS.sort = e.target.value; else SS[k] = e.target.checked;
    draw();
  });
  box.addEventListener("click", e=>{
    const cb = e.target.closest("button[data-col]");
    if(cb){
      const i = +cb.dataset.i, a = cb.dataset.col, L = SS.cols;
      if(a==="up" && i>0){ [L[i-1],L[i]]=[L[i],L[i-1]]; SS.dirty=true; }
      else if(a==="down" && i<L.length-1){ [L[i+1],L[i]]=[L[i],L[i+1]]; SS.dirty=true; }
      else if(a==="del"){ L.splice(i,1); SS.dirty=true; }
      else if(a==="add"){ const v=(box.querySelector("#ss-new")?.value||"").trim().slice(0,20); if(!v) return; let k="b:"+v, j=2; while(L.some(x=>x.k===k)) k="b:"+v+(j++); L.push({k,label:v,sign:true,pub:false,blank:true}); SS.dirty=true; }
      else if(a==="save"){ saveCols(); return; }
      draw(); return;
    }
    const b = e.target.closest("[data-ss]"); if(!b || b.tagName==="SELECT" || b.tagName==="INPUT") return;
    if(b.dataset.ss==="panel"){ SS.panel = !SS.panel; draw(); return; }
    if(b.dataset.ss==="close") close();
    if(b.dataset.ss==="print"){
      const c = S.courses.find(x=>x.id===SS.id);
      const old = document.title;
      document.title = (c ? c.title.replace(/[\\/:*?"<>|]/g," ").trim() : "課程") + "_" + (()=>{ const d=SS.docs||{}, names=[];
        if(d.sign) names.push(c&&!signOn(c) ? "名單" : c&&isAward(c) ? "領獎簽收表" : "簽到表");
        if(c&&isAward(c)) for(const nm of prizesOf(c)) if((d.prizes||{})[nm] && prizesOf(c).length>1) names.push(prizeLabel(nm)+"簽收表");
        if(d.stats) names.push("統計表");
        return names.join("＋") || "簽到表"; })();
      const done = ()=>{ document.title = old; window.removeEventListener("afterprint", done); };
      window.addEventListener("afterprint", done);
      setTimeout(()=>window.print(), 50);
    }
  });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !box.hidden) close(); });
  window.addEventListener("resize", ()=>{ if(!box.hidden) fit(); });
})();
