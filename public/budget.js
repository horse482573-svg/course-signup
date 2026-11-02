/* 自辦課程預算（只有舉辦人看得到）
   收入＝各身分報名費 × 人數（已收／預計）＋ 贊助；支出＝固定 ＋ 每人 × 人數，再加緩衝 %。
   損益平衡人數＝（固定 × (1+緩衝) − 贊助）÷（平均報名費 − 每人支出 × (1+緩衝)） */
(function(){
  const money = n => "NT$ " + Math.round(Number(n)||0).toLocaleString("zh-TW");
  const num = v => { const x = parseFloat(String(v).replace(/[,\s]/g,"")); return Number.isFinite(x) && x >= 0 ? x : 0; };
  const keyOfP = p => normName(p.name);
  const uid = () => Math.random().toString(36).slice(2, 8);

  function defaults(c){
    const fee = (String(c.payNote||"").match(/(\d[\d,]*)\s*元/) || [])[1];
    return { enabled:true, tiers:[{id:uid(), name:"一般夥伴", fee: fee ? num(fee) : 0}], manual:false, paid:{}, tierOf:{},
      sponsors:[], costs:[{name:"餐點", kind:"per", amount:0},{name:"講師費", kind:"fixed", amount:0},{name:"場地費", kind:"fixed", amount:0}], buffer:0 };
  }
  const draft = id => (S.bd && S.bd.id===id) ? S.bd.data : (S.budgets && S.budgets[id]) || null;

  function fieldsText(p){ return [p.note, p.title, ...Object.values(p.extra||{})].filter(Boolean).join(" "); }
  function tierFor(b, p){
    const k = keyOfP(p);
    if(b.tierOf[k] && b.tiers.some(t=>t.id===b.tierOf[k])) return b.tiers.find(t=>t.id===b.tierOf[k]);
    const vals = [p.note, p.title, ...Object.values(p.extra||{})].map(v=>String(v||"").trim());
    const hit = b.tiers.find(t=>t.name && vals.includes(t.name));
    return hit || b.tiers[0] || {id:"", name:"", fee:0};
  }
  function isPaid(b, p){
    if(b.manual) return !!b.paid[keyOfP(p)];
    return !/待繳|未繳|尚未繳/.test(fieldsText(p));
  }

  function calc(c, b){
    const people = peopleFor(c), N = people.length, f = 1 + num(b.buffer)/100;
    const rows = people.map(p=>({p, tier:tierFor(b,p), paid:isPaid(b,p)}));
    const expected = rows.reduce((s,r)=>s+num(r.tier.fee),0);
    const received = rows.filter(r=>r.paid).reduce((s,r)=>s+num(r.tier.fee),0);
    const sponsor = b.sponsors.reduce((s,x)=>s+num(x.amount),0);
    const per = b.costs.filter(x=>x.kind==="per").reduce((s,x)=>s+num(x.amount),0);
    const fixed = b.costs.filter(x=>x.kind!=="per").reduce((s,x)=>s+num(x.amount),0);
    const costAt = n => (fixed + per*n) * f;
    const avgFee = N ? expected/N : num((b.tiers[0]||{}).fee);
    const denom = avgFee - per*f;
    const need = denom > 0 ? Math.max(0, Math.ceil((fixed*f - sponsor) / denom - 1e-9)) : null;
    const trialN = b.trial === "" || b.trial == null ? null : Math.max(0, Math.round(num(b.trial)));
    return { rows, N, f, expected, received, sponsor, per, fixed, cost:costAt(N), avgFee, need, denom,
      remainExp: expected + sponsor - costAt(N), remainNow: received + sponsor - costAt(N),
      paidN: rows.filter(r=>r.paid).length,
      trialN, trial: trialN==null ? null : avgFee*trialN + sponsor - costAt(trialN) };
  }

  // 課程總表「預算」欄
  window.budgetBadge = function(c){
    const b = (S.budgets||{})[c.id];
    if(!b || !b.enabled) return `<span class="who">—</span>`;
    const r = calc(c, b);
    return r.remainExp >= 0 ? `<span class="bg-ok">✅ 剩 ${Math.round(r.remainExp).toLocaleString("zh-TW")}</span>`
      : `<span class="bg-bad">⚠️ 差 ${Math.round(-r.remainExp).toLocaleString("zh-TW")}${r.need!=null?`（需 ${r.need} 人）`:""}</span>`;
  };
  window.budgetEnabled = c => !!((S.budgets||{})[c.id]||{}).enabled;

  function resultHTML(c, b){
    const r = calc(c, b), sign = v => v >= 0 ? `<b class="bg-ok">✅ ${money(v)}</b>` : `<b class="bg-bad">⚠️ −${money(-v).replace("NT$ ","NT$ ")}</b>`;
    const needLine = r.need == null
      ? `<p class="bg-bad">平均報名費（${money(r.avgFee)}）不夠支付每人支出（${money(r.per*r.f)}），人數越多越虧，請調整報名費或每人支出。</p>`
      : `<p>損益平衡：至少需要 <b>${r.need}</b> 人報名${r.N?`（目前 ${r.N} 人 ${r.N>=r.need?`✅ 多 ${r.N-r.need} 人`:`⚠️ 還差 ${r.need-r.N} 人`}）`:""}</p>
         <p class="who">計算：（固定支出 ${money(r.fixed*r.f)} − 贊助 ${money(r.sponsor)}）÷（平均報名費 ${money(r.avgFee)} − 每人支出 ${money(r.per*r.f)}）${num(b.buffer)?`，支出已含緩衝 ${num(b.buffer)}%`:""}</p>`;
    return `<table class="bg-res"><thead><tr><th></th><th>已收</th><th>預計（全部繳齊）</th></tr></thead><tbody>
        <tr><td>報名費</td><td>${money(r.received)}<small>（${r.paidN} 人）</small></td><td>${money(r.expected)}<small>（${r.N} 人）</small></td></tr>
        <tr><td>＋ 贊助</td><td>${money(r.sponsor)}</td><td>${money(r.sponsor)}</td></tr>
        <tr><td>− 支出${num(b.buffer)?`（含緩衝 ${num(b.buffer)}%）`:""}</td><td>${money(r.cost)}</td><td>${money(r.cost)}</td></tr>
        <tr class="sum"><td>＝ 剩餘</td><td>${sign(r.remainNow)}</td><td>${sign(r.remainExp)}</td></tr>
      </tbody></table>
      ${needLine}
      <p class="bg-trial">試算：如果有 <input type="number" min="0" step="1" inputmode="numeric" data-bg="trial" value="${b.trial??""}" placeholder="${r.N}" aria-label="試算人數"> 人報名
        ${r.trial==null?"":r.trial>=0?`→ <b class="bg-ok">剩 ${money(r.trial)} ✅</b>`:`→ <b class="bg-bad">差 ${money(-r.trial)} ⚠️</b>`}</p>`;
  }

  window.budgetSection = function(c){
    const saved = (S.budgets||{})[c.id];
    if(!(S.bd && S.bd.id===c.id)) S.bd = {id:c.id, data: saved ? JSON.parse(JSON.stringify(saved)) : null, dirty:false};
    const b = S.bd.data;
    if(!b || !b.enabled){
      return `<div id="bgbox" class="bgbox"><h4>💰 預算</h4>
        <label class="check"><input type="checkbox" data-bg="enable"> 這是自辦課程（啟用預算計算）</label>
        <p class="who">啟用後可以設定報名費、贊助和支出，系統會算出剩餘預算和至少需要幾人報名。只有你看得到。</p>
        ${saved && !saved.enabled && S.bd.dirty?`<div class="actions"><button class="btn primary" data-bg="save">儲存</button></div>`:""}</div>`;
    }
    const r = calc(c, b);
    const tierCount = t => r.rows.filter(x=>x.tier.id===t.id).length;
    const tiers = b.tiers.map((t,i)=>`<tr>
        <td><input type="text" data-bg="tiers.${i}.name" value="${esc(t.name)}" maxlength="20" aria-label="身分名稱"></td>
        <td>NT$ <input type="number" min="0" step="1" inputmode="numeric" data-bg="tiers.${i}.fee" value="${t.fee}" aria-label="報名費"></td>
        <td class="t">${tierCount(t)} 人</td><td class="t">${money(num(t.fee)*tierCount(t))}</td>
        <td>${b.tiers.length>1?`<button type="button" class="x" data-bg="del:tiers.${i}" aria-label="刪除">✕</button>`:""}</td></tr>`).join("");
    const people = r.rows.map(x=>{ const k=keyOfP(x.p); return `<tr>
        <td>${esc(x.p.division||"—")}</td><td>${esc(x.p.name)}</td>
        <td>${b.tiers.length>1?`<select data-bg="tierOf" data-k="${esc(k)}">${b.tiers.map(t=>`<option value="${esc(t.id)}"${t.id===x.tier.id?" selected":""}>${esc(t.name||"（未命名）")}</option>`).join("")}</select>`:esc(x.tier.name)}</td>
        <td class="c">${b.manual?`<input type="checkbox" data-bg="paid" data-k="${esc(k)}"${x.paid?" checked":""} aria-label="已繳">`:(x.paid?"已繳":`<span class="bg-bad">待繳</span>`)}</td></tr>`; }).join("");
    const sponsors = b.sponsors.map((s,i)=>`<tr>
        <td><input type="text" data-bg="sponsors.${i}.name" value="${esc(s.name)}" maxlength="30" placeholder="贊助單位" aria-label="贊助單位"></td>
        <td>NT$ <input type="number" min="0" step="1" inputmode="numeric" data-bg="sponsors.${i}.amount" value="${s.amount}" aria-label="金額"></td>
        <td><button type="button" class="x" data-bg="del:sponsors.${i}" aria-label="刪除">✕</button></td></tr>`).join("");
    const costs = b.costs.map((x,i)=>`<tr>
        <td><input type="text" data-bg="costs.${i}.name" value="${esc(x.name)}" maxlength="20" aria-label="項目"></td>
        <td><select data-bg="costs.${i}.kind"><option value="per"${x.kind==="per"?" selected":""}>每人</option><option value="fixed"${x.kind!=="per"?" selected":""}>固定</option></select></td>
        <td>NT$ <input type="number" min="0" step="1" inputmode="numeric" data-bg="costs.${i}.amount" value="${x.amount}" aria-label="金額"></td>
        <td class="t">${x.kind==="per"?`× ${r.N} = ${money(num(x.amount)*r.N)}`:money(num(x.amount))}</td>
        <td><button type="button" class="x" data-bg="del:costs.${i}" aria-label="刪除">✕</button></td></tr>`).join("");
    return `<div id="bgbox" class="bgbox"><h4>💰 預算｜${esc(c.title)}</h4>
      <label class="check"><input type="checkbox" data-bg="enable" checked> 這是自辦課程（啟用預算計算）</label>
      <section><h5>① 報名費</h5><div class="tbl"><table class="bg-t"><thead><tr><th>身分</th><th>報名費</th><th>人數</th><th>小計</th><th></th></tr></thead><tbody>${tiers}</tbody></table></div>
        <button type="button" class="btn sm" data-bg="add:tiers">＋ 新增身分</button>
        ${b.tiers.length>1?`<p class="who">名單裡有欄位寫著身分名稱的人會自動對應；其他人預設為「${esc(b.tiers[0].name)}」，可以在下方名單改。</p>`:""}</section>
      <section><h5>② 繳費狀況　<small>已繳 ${r.paidN} / ${r.N} 人</small></h5>
        <label class="check"><input type="checkbox" data-bg="manual"${b.manual?" checked":""}> 人工對帳（關閉＝依匯入名單的「待繳費」判斷）</label>
        <details${S.bdOpen?" open":""} data-bg-details><summary>名單（${r.N} 人）</summary>
          <div class="tbl"><table class="bg-t"><thead><tr><th>事業部</th><th>姓名</th><th>身分</th><th>已繳</th></tr></thead><tbody>${people||`<tr><td colspan="4" class="who">還沒有名單</td></tr>`}</tbody></table></div>
          ${b.manual?`<div class="actions"><button type="button" class="btn sm" data-bg="paidall">全部勾選</button><button type="button" class="btn sm link" data-bg="paidnone">全部取消</button></div>`:""}
        </details></section>
      <section><h5>③ 贊助</h5>${sponsors?`<div class="tbl"><table class="bg-t"><tbody>${sponsors}</tbody></table></div>`:""}
        <button type="button" class="btn sm" data-bg="add:sponsors">＋ 新增贊助</button></section>
      <section><h5>④ 支出</h5><div class="tbl"><table class="bg-t"><thead><tr><th>項目</th><th>計算方式</th><th>金額</th><th>小計</th><th></th></tr></thead><tbody>${costs}</tbody></table></div>
        <button type="button" class="btn sm" data-bg="add:costs">＋ 新增項目</button>
        <p class="bg-buf">預留緩衝 <input type="number" min="0" max="100" step="1" inputmode="numeric" data-bg="buffer" value="${b.buffer||0}" aria-label="緩衝百分比"> %（支出多抓一點，以防臨時開銷）</p></section>
      <section><h5>⑤ 結果</h5><div id="bgres">${resultHTML(c, b)}</div></section>
      <div class="actions"><button type="button" class="btn primary" data-bg="save"${S.bd.dirty?"":" disabled"}>儲存</button>${S.bd.dirty?`<span class="who">尚未儲存</span>`:saved?`<span class="who">已儲存</span>`:""}</div>
    </div>`;
  };

  function course(){ return S.courses.find(x=>x.id===(S.bd&&S.bd.id)); }
  function redraw(){ const c=course(), el=$("#bgbox"); if(c && el) el.outerHTML = budgetSection(c); }
  function setPath(obj, path, val){ const ks=path.split("."); let o=obj; for(let i=0;i<ks.length-1;i++) o=o[ks[i]]; o[ks[ks.length-1]]=val; }
  const NUMERIC = /(\.fee|\.amount)$|^buffer$/;

  document.addEventListener("input", e=>{
    const t = e.target, p = t.dataset && t.dataset.bg; if(!p || !S.bd || !S.bd.data || t.type==="checkbox" || t.tagName==="SELECT") return;
    if(p==="trial"){ S.bd.data.trial = t.value; }
    else { setPath(S.bd.data, p, NUMERIC.test(p) ? num(t.value) : t.value); S.bd.dirty = true; }
    const c = course(); const res = $("#bgres");
    if(c && res){ // 只更新結果區，輸入框保持游標位置
      const focusTrial = p==="trial", pos = t.selectionStart;
      res.innerHTML = resultHTML(c, S.bd.data);
      if(focusTrial){ const n=res.querySelector("[data-bg=trial]"); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch(_){} } }
      const sv = $("#bgbox [data-bg=save]"); if(sv && p!=="trial"){ sv.disabled=false; }
    }
  });
  document.addEventListener("change", e=>{
    const t = e.target, p = t.dataset && t.dataset.bg; if(!p || !S.bd) return;
    const c = course(); if(!c) return;
    if(p==="enable"){ if(t.checked){ S.bd.data = S.bd.data ? {...S.bd.data, enabled:true} : defaults(c); } else if(S.bd.data){ S.bd.data.enabled=false; } S.bd.dirty=true; redraw(); return; }
    const b = S.bd.data; if(!b) return;
    if(p==="manual"){ b.manual = t.checked; if(t.checked && !Object.keys(b.paid).length){ for(const p0 of peopleFor(c)) if(!/待繳|未繳|尚未繳/.test(fieldsText(p0))) b.paid[keyOfP(p0)] = true; } }
    else if(p==="paid"){ if(t.checked) b.paid[t.dataset.k]=true; else delete b.paid[t.dataset.k]; }
    else if(p==="tierOf"){ b.tierOf[t.dataset.k] = t.value; }
    else if(/^costs\.\d+\.kind$/.test(p)){ setPath(b, p, t.value); }
    else return;
    S.bd.dirty = true; redraw();
  });
  document.addEventListener("toggle", e=>{ if(e.target.matches && e.target.matches("[data-bg-details]")) S.bdOpen = e.target.open; }, true);
  document.addEventListener("click", async e=>{
    const t = e.target.closest("[data-bg]"); if(!t || t.tagName==="INPUT" || t.tagName==="SELECT" || !S.bd) return;
    const a = t.dataset.bg, c = course(); if(!c) return; const b = S.bd.data;
    if(a==="save"){
      t.disabled = true;
      try{ await api("admin/budget", {courseId:c.id, budget:b}); S.budgets = S.budgets||{}; S.budgets[c.id] = JSON.parse(JSON.stringify(b)); S.bd.dirty=false; toast("預算已儲存"); }
      catch(err){ toast(errMsg(err)); t.disabled=false; return; }
      render(true); return;
    }
    if(!b) return;
    if(a==="add:tiers") b.tiers.push({id:uid(), name:"", fee:0});
    else if(a==="add:sponsors") b.sponsors.push({name:"", amount:0});
    else if(a==="add:costs") b.costs.push({name:"", kind:"fixed", amount:0});
    else if(a.startsWith("del:")){ const [list,i]=a.slice(4).split("."); b[list].splice(+i,1); }
    else if(a==="paidall"){ for(const p0 of peopleFor(c)) b.paid[keyOfP(p0)] = true; }
    else if(a==="paidnone"){ b.paid = {}; }
    else return;
    S.bd.dirty = true; redraw();
  });
})();
