/* 自辦課程預算（只有舉辦人看得到）
   收入＝各身分報名費 × 人數（已收／預計）＋ 贊助；支出＝固定 ＋ 每人 × 人數，再加緩衝 %。
   損益平衡人數＝（固定 × (1+緩衝) − 贊助）÷（平均報名費 − 每人支出 × (1+緩衝)） */
(function(){
  const money = n => "NT$ " + Math.round(Number(n)||0).toLocaleString("zh-TW");
  const num = v => { const x = parseFloat(String(v).replace(/[,\s]/g,"")); return Number.isFinite(x) && x >= 0 ? x : 0; };
  const keyOfP = p => normName(p.name);
  const uid = () => Math.random().toString(36).slice(2, 8);

  const TRIAL_ID = "__trial";
  const modeOf = c => c && c.__trial ? "trial" : isAward(c) ? "award" : "course";
  window.trialCourse = { id:TRIAL_ID, title:"預算試算", __trial:true };
  // 獎勵：各獎品總張數（從達成名單的「咖啡券 3 張＋星巴克 1 張」解析）
  function prizeTotals(c){
    const out = {}, pp = window.prizeParts || (()=>[]);
    for(const p of officialFor(c.id)) for(const x of pp(p.award)) out[x.name] = (out[x.name]||0) + x.qty;
    return out;
  }
  const prizeLbl = nm => /星巴克/.test(nm) ? "星巴克咖啡券" : nm==="咖啡券" ? "一般咖啡券" : nm;

  function defaults(c){
    const m = modeOf(c);
    if(m==="award"){
      const pt = prizeTotals(c), names = Object.keys(pt).sort((a,b)=>(/星巴克/.test(b)?1:0)-(/星巴克/.test(a)?1:0));
      return { enabled:true, tiers:[], manual:false, paid:{}, tierOf:{}, sponsors:[], guest:{answer:"no", n:0}, buffer:0,
        costs: names.length ? names.map(nm=>({name:prizeLbl(nm), kind:"each", prize:nm, amount:0, q:""})) : [{name:"獎品", kind:"per", amount:0}] };
    }
    if(m==="trial") return { enabled:true, tiers:[{id:uid(), name:"一般夥伴", fee:0, n:30}], manual:false, paid:{}, tierOf:{}, sponsors:[], guest:{answer:"yes", n:0}, buffer:0,
      costs:[{name:"餐點", kind:"per", amount:0, guest:true},{name:"講師費", kind:"fixed", amount:0},{name:"場地費", kind:"fixed", amount:0}] };
    const fee = (String(c.payNote||"").match(/(\d[\d,]*)\s*元/) || [])[1];
    return { enabled:true, tiers:[{id:uid(), name:"一般夥伴", fee: fee ? num(fee) : 0}], manual:false, paid:{}, tierOf:{},
      sponsors:[], guest:{answer:null, n:0}, costs:[{name:"餐點", kind:"per", amount:0, guest:true},{name:"講師費", kind:"fixed", amount:0},{name:"場地費", kind:"fixed", amount:0}], buffer:0 };
  }

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

  const MEALISH = /餐|便當|飲|點心|茶|咖啡|水果|午|早|晚/;
  const guestFlag = x => x.guest===undefined ? MEALISH.test(x.name||"") : !!x.guest; // 這個「每人」項目要不要算講師／嘉賓
  function calc(c, b){
    const mode = modeOf(c), f = 1 + num(b.buffer)/100;
    const sponFixed = b.sponsors.filter(x=>x.kind!=="per").reduce((s,x)=>s+num(x.amount),0);
    const sponPer = b.sponsors.filter(x=>x.kind==="per").reduce((s,x)=>s+num(x.amount),0);
    const sponAt = n => sponFixed + sponPer*n;
    if(mode==="award"){
      const N = officialFor(c.id).length, pt = prizeTotals(c);
      const autoQ = x => pt[x.prize]||0;
      const qty = x => x.kind==="each" ? (x.q===""||x.q==null ? autoQ(x) : Math.round(num(x.q))) : x.kind==="per" ? N : 1;
      const base = b.costs.reduce((s,x)=>s+num(x.amount)*qty(x),0), cost = base*f, sponsor = sponAt(N);
      return { mode, N, f, qty, autoQ, pt, base, cost, sponsor, sponFixed, sponPer, answered:true, remainExp: sponsor - cost, burden: cost - sponsor };
    }
    let rows = [], N, staffN, expected, received = 0, paidN = 0, partFee;
    if(mode==="trial"){
      const cnt = t => Math.max(0, Math.round(num(t.n)));
      N = b.tiers.filter(t=>!t.staff).reduce((s,t)=>s+cnt(t),0);
      staffN = b.tiers.filter(t=>t.staff).reduce((s,t)=>s+cnt(t),0);
      expected = b.tiers.reduce((s,t)=>s+num(t.fee)*cnt(t),0);
      partFee = b.tiers.filter(t=>!t.staff).reduce((s,t)=>s+num(t.fee)*cnt(t),0);
    } else {
      rows = peopleFor(c).map(p=>{ const tier=tierFor(b,p); return {p, tier, staff:!!tier.staff, paid:!tier.staff && isPaid(b,p)}; });
      const part = rows.filter(r=>!r.staff); N = part.length; staffN = rows.length - N;
      expected = rows.reduce((s,r)=>s+num(r.tier.fee),0);
      received = rows.filter(r=>r.paid).reduce((s,r)=>s+num(r.tier.fee),0);
      paidN = part.filter(r=>r.paid).length;
      partFee = part.reduce((s,r)=>s+num(r.tier.fee),0);
    }
    const g = mode==="trial" ? Math.max(0, Math.round(num((b.guest||{}).n)))
      : (b.guest && b.guest.answer==="yes") ? Math.max(0, Math.round(num(b.guest.n))) : 0;
    const extra = staffN + g;                        // 講師／工作人員＋名單外嘉賓
    const sponsor = sponAt(N);
    const perItems = b.costs.filter(x=>x.kind==="per");
    const per = perItems.reduce((s,x)=>s+num(x.amount),0);
    const perGuest = perItems.filter(guestFlag).reduce((s,x)=>s+num(x.amount),0);
    const fixed = b.costs.filter(x=>x.kind!=="per").reduce((s,x)=>s+num(x.amount),0);
    const fixedEff = fixed + perGuest*extra;         // 講師／嘉賓的餐點視為固定支出
    const qty = x => x.kind==="per" ? N + (guestFlag(x) ? extra : 0) : 1;
    const costAt = n => (fixedEff + per*n) * f;
    const firstFee = num(((b.tiers.find(t=>!t.staff))||b.tiers[0]||{}).fee);
    const avgFee = N ? partFee/N : firstFee;
    const denom = avgFee + sponPer - per*f;
    const need = denom > 0 ? Math.max(0, Math.ceil((fixedEff*f - sponFixed) / denom - 1e-9)) : null;
    const at = n => avgFee*n + sponAt(n) - costAt(n);
    const trialN = b.trial === "" || b.trial == null ? null : Math.max(0, Math.round(num(b.trial)));
    const answered = mode==="trial" || !!(b.guest && (b.guest.answer==="yes" || b.guest.answer==="no"));
    return { mode, rows, N, staffN, g, extra, answered, f, expected, received, sponsor, sponFixed, sponPer, per, fixed, fixedEff, qty, cost:costAt(N), avgFee, need, denom, at,
      remainExp: expected + sponsor - costAt(N), remainNow: received + sponsor - costAt(N), paidN,
      trialN, trial: trialN==null ? null : at(trialN) };
  }
  window.budgetCalc = calc;

  // 總表「預算」欄
  window.budgetBadge = function(c){
    const b = (S.budgets||{})[c.id];
    if(!b || !b.enabled) return `<span class="who">—</span>`;
    const r = calc(c, b);
    if(r.mode==="award") return `<span class="${r.burden>0?"":"bg-ok"}">${r.burden>0?`公司負擔 ${Math.round(r.burden).toLocaleString("zh-TW")}`:`✅ 贊助足夠`}</span>`;
    if(!r.answered) return `<span class="bg-bad">⚠️ 待確認講師用餐</span>`;
    return r.remainExp >= 0 ? `<span class="bg-ok">✅ 剩 ${Math.round(r.remainExp).toLocaleString("zh-TW")}</span>`
      : `<span class="bg-bad">⚠️ 差 ${Math.round(-r.remainExp).toLocaleString("zh-TW")}${r.need!=null?`（需 ${r.need} 人）`:""}</span>`;
  };
  window.budgetEnabled = c => !!((S.budgets||{})[c.id]||{}).enabled;

  const sign = v => v >= 0 ? `<b class="bg-ok">✅ ${money(v)}</b>` : `<b class="bg-bad">⚠️ −${money(-v)}</b>`;
  // 試算人數對照：目前人數前後各幾檔＋損益平衡人數
  function compareNs(r){
    const base = Math.max(10, Math.round((r.N||30)/10)*10), step = base >= 50 ? 10 : 5;
    const set = new Set([base-2*step, base-step, base, base+step, base+2*step].filter(n=>n>0));
    if(r.need) set.add(r.need); if(r.N) set.add(r.N);
    return [...set].sort((a,b)=>a-b);
  }
  function needLine(r, b){
    if(r.need == null) return `<p class="bg-bad">平均報名費（${money(r.avgFee)}）不夠支付每人支出（${money(r.per*r.f)}），人數越多越虧，請調整報名費或每人支出。</p>`;
    if(r.need===0) return `<p>損益平衡：贊助已經足夠支付固定支出，只要每位報名者的報名費高於每人支出，就不會虧 ✅</p>`;
    return `<p>損益平衡：至少需要 <b>${r.need}</b> 人報名${r.N?`（${r.mode==="trial"?"預計":"目前"} ${r.N} 人 ${r.N>=r.need?`✅ 多 ${r.N-r.need} 人`:`⚠️ 還差 ${r.need-r.N} 人`}）`:""}</p>
       <p class="who">計算：（固定支出 ${money(r.fixedEff*r.f)}${r.extra?`，含講師／嘉賓 ${r.extra} 位的餐點`:""} − 固定贊助 ${money(r.sponFixed)}）÷（平均報名費 ${money(r.avgFee)}${r.sponPer?` ＋ 每人贊助 ${money(r.sponPer)}`:""} − 每人支出 ${money(r.per*r.f)}）${num(b.buffer)?`，支出已含緩衝 ${num(b.buffer)}%`:""}</p>`;
  }
  function resultHTML(c, b){
    const r = calc(c, b);
    if(r.mode==="award") return `<table class="bg-res"><tbody>
        <tr><td>支出${num(b.buffer)?`（含緩衝 ${num(b.buffer)}%）`:""}</td><td>${money(r.cost)}</td></tr>
        <tr><td>− 贊助</td><td>${money(r.sponsor)}</td></tr>
        <tr class="sum"><td>＝ 公司負擔</td><td>${r.burden>0?`<b>${money(r.burden)}</b>`:`<b class="bg-ok">✅ 0（贊助還多 ${money(-r.burden)}）</b>`}</td></tr>
      </tbody></table><p class="who">得獎 ${r.N} 人${Object.keys(r.pt).length?"・"+Object.entries(r.pt).map(([k,v])=>`${esc(prizeLbl(k))} ${v} 張`).join("、"):""}</p>`;
    if(r.mode==="trial") return `<table class="bg-res"><tbody>
        <tr><td>報名費</td><td>${money(r.expected)}<small>（${r.N} 人${r.staffN?`＋講師／工作人員 ${r.staffN}`:""}）</small></td></tr>
        <tr><td>＋ 贊助</td><td>${money(r.sponsor)}</td></tr>
        <tr><td>− 支出${num(b.buffer)?`（含緩衝 ${num(b.buffer)}%）`:""}</td><td>${money(r.cost)}</td></tr>
        <tr class="sum"><td>＝ 剩餘</td><td>${sign(r.remainExp)}</td></tr>
      </tbody></table>
      ${needLine(r, b)}
      <div class="tbl"><table class="bg-t bg-cmp"><thead><tr><th>人數</th>${compareNs(r).map(n=>`<th${n===r.N?' class="cur"':""}>${n} 人${n===r.need?"<br><small>損益平衡</small>":""}</th>`).join("")}</tr></thead>
        <tbody><tr><td>剩餘</td>${compareNs(r).map(n=>{ const v=r.at(n); return `<td class="${v>=0?"bg-ok":"bg-bad"}${n===r.N?" cur":""}">${v>=0?"":"−"}${Math.round(Math.abs(v)).toLocaleString("zh-TW")}</td>`; }).join("")}</tr></tbody></table></div>
      <p class="who">人數對照以平均報名費計算；講師／嘉賓人數固定不變。</p>`;
    return `<table class="bg-res"><thead><tr><th></th><th>已收</th><th>預計（全部繳齊）</th></tr></thead><tbody>
        <tr><td>報名費</td><td>${money(r.received)}<small>（${r.paidN} 人）</small></td><td>${money(r.expected)}<small>（${r.N} 人${r.staffN?`＋講師／工作人員 ${r.staffN}`:""}）</small></td></tr>
        <tr><td>＋ 贊助</td><td>${money(r.sponsor)}</td><td>${money(r.sponsor)}</td></tr>
        <tr><td>− 支出${num(b.buffer)?`（含緩衝 ${num(b.buffer)}%）`:""}</td><td>${money(r.cost)}</td><td>${money(r.cost)}</td></tr>
        <tr class="sum"><td>＝ 剩餘</td><td>${sign(r.remainNow)}</td><td>${sign(r.remainExp)}</td></tr>
      </tbody></table>
      ${needLine(r, b)}
      <p class="bg-trial">試算：如果有 <input type="number" min="0" step="1" inputmode="numeric" data-bg="trial" value="${b.trial??""}" placeholder="${r.N}" aria-label="試算人數"> 人報名
        ${r.trial==null?"":r.trial>=0?`→ <b class="bg-ok">剩 ${money(r.trial)} ✅</b>`:`→ <b class="bg-bad">差 ${money(-r.trial)} ⚠️</b>`}</p>`;
  }

  // 各列小計（輸入時即時更新）
  function subText(c, b, r, list, i){
    const x = b[list][i];
    if(list==="tiers"){ const n = r.mode==="trial" ? Math.max(0,Math.round(num(x.n))) : r.rows.filter(y=>y.tier.id===x.id).length; return money(num(x.fee)*n); }
    if(list==="sponsors") return x.kind==="per" ? `× ${r.N} = ${money(num(x.amount)*r.N)}` : money(num(x.amount));
    const q = r.qty(x); return x.kind==="fixed" ? money(num(x.amount)) : `× ${q} = ${money(num(x.amount)*q)}`;
  }
  const subTd = (c,b,r,list,i) => `<td class="t" data-sub="${list}.${i}">${subText(c,b,r,list,i)}</td>`;

  function sponsorsHTML(c, b, r){
    const rows = b.sponsors.map((s,i)=>`<tr>
        <td><input type="text" data-bg="sponsors.${i}.name" value="${esc(s.name)}" maxlength="30" placeholder="贊助單位" aria-label="贊助單位"></td>
        <td><select data-bg="sponsors.${i}.kind"><option value="fixed"${s.kind!=="per"?" selected":""}>固定</option><option value="per"${s.kind==="per"?" selected":""}>每人</option></select></td>
        <td>NT$ <input type="number" min="0" step="1" inputmode="numeric" data-bg="sponsors.${i}.amount" value="${num(s.amount)||""}" placeholder="0" aria-label="金額"></td>
        ${subTd(c,b,r,"sponsors",i)}
        <td><button type="button" class="x" data-bg="del:sponsors.${i}" aria-label="刪除">✕</button></td></tr>
      <tr class="bg-inv"><td colspan="5"><span>是否需要統編？</span>
        <label class="check sm"><input type="radio" name="bg-inv-${i}" data-bg="inv-yes" data-i="${i}"${s.inv?" checked":""}> 需要</label>
        <label class="check sm"><input type="radio" name="bg-inv-${i}" data-bg="inv-no" data-i="${i}"${s.inv?"":" checked"}> 不需要</label>
        ${s.inv?`<label>統編：<input type="text" inputmode="numeric" maxlength="8" pattern="\\d{8}" data-bg="sponsors.${i}.taxId" value="${esc(s.taxId||"")}" placeholder="8 位數字" aria-label="統一編號" class="bg-tax"></label>
        <label>抬頭：<input type="text" maxlength="60" data-bg="sponsors.${i}.invTitle" value="${esc(s.invTitle||"")}" placeholder="公司名稱" aria-label="抬頭" class="bg-ttl"></label>`:""}</td></tr>`).join("");
    return `${rows?`<div class="tbl"><table class="bg-t"><thead><tr><th>贊助單位</th><th>計算方式</th><th>金額</th><th>小計</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:""}
        <button type="button" class="btn sm" data-bg="add:sponsors">＋ 新增贊助</button>`;
  }
  function costsHTML(c, b, r){
    const award = r.mode==="award", prizes = award ? Object.keys(r.pt) : [];
    const rows = b.costs.map((x,i)=>`<tr>
        <td><input type="text" data-bg="costs.${i}.name" value="${esc(x.name)}" maxlength="20" aria-label="項目"></td>
        <td><select data-bg="costs.${i}.kind">${award?`<option value="each"${x.kind==="each"?" selected":""}>每張</option>`:""}<option value="per"${x.kind==="per"?" selected":""}>每人</option><option value="fixed"${x.kind==="fixed"||!x.kind?" selected":""}>固定</option></select></td>
        <td>NT$ <input type="number" min="0" step="1" inputmode="numeric" data-bg="costs.${i}.amount" value="${num(x.amount)||""}" placeholder="0" aria-label="單價"></td>
        <td class="qty">${award && x.kind==="each" ? `<select class="bg-prize" data-bg="costs.${i}.prize" aria-label="對應獎品"><option value="">（選獎品）</option>${prizes.map(nm=>`<option value="${esc(nm)}"${nm===x.prize?" selected":""}>${esc(prizeLbl(nm))}</option>`).join("")}</select>
            <input type="number" min="0" step="1" inputmode="numeric" class="bg-q" data-bg="costs.${i}.q" value="${x.q===""||x.q==null?"":num(x.q)}" placeholder="${r.autoQ(x)}" aria-label="張數（空白＝自動）" title="空白＝自動帶入獎品張數"> 張`
          : award && x.kind==="per" ? `<span class="who">得獎 ${r.N} 人</span>`
          : !award && x.kind==="per" ? `<label class="check sm"><input type="checkbox" data-bg="cguest" data-i="${i}"${guestFlag(x)?" checked":""}> 含講師／嘉賓</label>` : ""}</td>
        ${subTd(c,b,r,"costs",i)}
        <td><button type="button" class="x" data-bg="del:costs.${i}" aria-label="刪除">✕</button></td></tr>`).join("");
    return `<div class="tbl"><table class="bg-t"><thead><tr><th>項目</th><th>計算方式</th><th>單價</th><th>${award?"數量":""}</th><th>小計</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        <button type="button" class="btn sm" data-bg="add:costs">＋ 新增項目</button>
        ${award && prizes.length?`<p class="who">「每張」的張數空白時，自動帶入達成名單的獎品張數；要改可以直接填。</p>`:""}
        <p class="bg-buf">預留緩衝 <input type="number" min="0" max="100" step="1" inputmode="numeric" data-bg="buffer" value="${num(b.buffer)||""}" placeholder="0" aria-label="緩衝百分比"> %（支出多抓一點，以防臨時開銷）</p>`;
  }

  window.budgetSection = function(c){
    const mode = modeOf(c);
    const saved = mode==="trial" ? S.trialData : (S.budgets||{})[c.id];
    if(!(S.bd && S.bd.id===c.id)) S.bd = {id:c.id, data: saved ? JSON.parse(JSON.stringify(saved)) : (mode==="trial" ? defaults(c) : null), dirty:false};
    const b = S.bd.data;
    if(mode==="trial") S.trialData = b;
    if(!b || !b.enabled){
      return `<div id="bgbox" class="bgbox"><h4>💰 預算｜${esc(c.title)}</h4>
        <label class="check"><input type="checkbox" data-bg="enable"> ${mode==="award"?"啟用預算計算（獎品支出、贊助、公司負擔）":"這是自辦課程（啟用預算計算）"}</label>
        <p class="who">${mode==="award"?"啟用後可以設定獎品單價和贊助，系統會依達成名單的獎品張數算出公司要負擔多少。":"啟用後可以設定報名費、贊助和支出，系統會算出剩餘預算和至少需要幾人報名。"}只有你看得到。</p>
        ${saved && !saved.enabled && S.bd.dirty?`<div class="actions"><button class="btn primary" data-bg="save">儲存</button></div>`:""}</div>`;
    }
    const r = calc(c, b);
    b.guest = b.guest || {answer:null, n:0};
    const actions = mode==="trial"
      ? `<div class="actions"><button type="button" class="btn primary" data-bg="pdf">📄 匯出試算 PDF</button><button type="button" class="btn link" data-bg="reset">清空重來</button><span class="who">試算不會儲存；需要留存請匯出 PDF。</span></div>`
      : `<div class="actions"><button type="button" class="btn primary" data-bg="save"${S.bd.dirty?"":" disabled"}>儲存</button><button type="button" class="btn" data-bg="pdf">📄 匯出帳目 PDF</button>${S.bd.dirty?`<span class="who">尚未儲存</span>`:saved?`<span class="who">已儲存</span>`:""}</div>`;

    if(mode==="award") return `<div id="bgbox" class="bgbox"><h4>💰 預算｜${esc(c.title)}</h4>
      <label class="check"><input type="checkbox" data-bg="enable" checked> 啟用預算計算</label>
      <section><h5>① 獎品與支出</h5>${costsHTML(c,b,r)}</section>
      <section><h5>② 贊助</h5>${sponsorsHTML(c,b,r)}</section>
      <section><h5>③ 結果</h5><div id="bgres">${resultHTML(c, b)}</div></section>
      ${actions}</div>`;

    const tierCount = t => mode==="trial" ? Math.max(0,Math.round(num(t.n))) : r.rows.filter(x=>x.tier.id===t.id).length;
    const tiers = b.tiers.map((t,i)=>`<tr>
        <td><input type="text" data-bg="tiers.${i}.name" value="${esc(t.name)}" maxlength="20" aria-label="身分名稱"></td>
        <td>NT$ <input type="number" min="0" step="1" inputmode="numeric" data-bg="tiers.${i}.fee" value="${num(t.fee)||""}" placeholder="0" aria-label="報名費"></td>
        <td class="c"><input type="checkbox" data-bg="staff" data-i="${i}"${t.staff?" checked":""} aria-label="不算報名者"></td>
        <td class="t">${mode==="trial"?`<input type="number" min="0" step="1" inputmode="numeric" class="bg-n" data-bg="tiers.${i}.n" value="${num(t.n)||""}" placeholder="0" aria-label="人數"> 人`:`${tierCount(t)} 人`}</td>${subTd(c,b,r,"tiers",i)}
        <td>${b.tiers.length>1?`<button type="button" class="x" data-bg="del:tiers.${i}" aria-label="刪除">✕</button>`:""}</td></tr>`).join("");
    const tierSec = `<h5>① 報名費${mode==="trial"?"與預計人數":""}</h5><div class="tbl"><table class="bg-t"><thead><tr><th>身分</th><th>報名費</th><th title="講師、主辦人、工作人員：只算餐點，不算報名人數和平均報名費">不算報名者</th><th>人數</th><th>小計</th><th></th></tr></thead><tbody>${tiers}</tbody></table></div>
        <button type="button" class="btn sm" data-bg="add:tiers">＋ 新增身分</button>`;

    if(mode==="trial") return `<div id="bgbox" class="bgbox bg-trialbox"><h4>🧮 預算試算</h4>
      <p class="who">不綁任何課程，自由輸入人數和金額，數字隨打隨算。</p>
      <section>${tierSec}</section>
      <section><h5>② 贊助</h5>${sponsorsHTML(c,b,r)}</section>
      <section><h5>③ 支出</h5>${costsHTML(c,b,r)}
        <p class="bg-buf">另有名單外講師／嘉賓 <input type="number" min="0" step="1" inputmode="numeric" data-bg="guest.n" value="${num(b.guest.n)||""}" placeholder="0" aria-label="講師嘉賓人數"> 位（算入有勾「含講師／嘉賓」的項目）</p></section>
      <section><h5>④ 結果</h5><div id="bgres">${resultHTML(c, b)}</div></section>
      ${actions}</div>`;

    const people = r.rows.map(x=>{ const k=keyOfP(x.p); return `<tr>
        <td>${esc(x.p.division||"—")}</td><td>${esc(x.p.name)}</td>
        <td>${b.tiers.length>1?`<select data-bg="tierOf" data-k="${esc(k)}">${b.tiers.map(t=>`<option value="${esc(t.id)}"${t.id===x.tier.id?" selected":""}>${esc(t.name||"（未命名）")}</option>`).join("")}</select>`:esc(x.tier.name)}</td>
        <td class="c">${x.staff?`<span class="who">—</span>`:b.manual?`<input type="checkbox" data-bg="paid" data-k="${esc(k)}"${x.paid?" checked":""} aria-label="已繳">`:(x.paid?"已繳":`<span class="bg-bad">待繳</span>`)}</td></tr>`; }).join("");
    return `<div id="bgbox" class="bgbox"><h4>💰 預算｜${esc(c.title)}</h4>
      <label class="check"><input type="checkbox" data-bg="enable" checked> 這是自辦課程（啟用預算計算）</label>
      <section>${tierSec}
        ${b.tiers.length>1?`<p class="who">名單裡有欄位寫著身分名稱的人會自動對應；其他人預設為「${esc(b.tiers[0].name)}」，可以在下方名單改。</p>`:""}</section>
      <section><h5>② 繳費狀況　<small>已繳 ${r.paidN} / ${r.N} 人${r.staffN?`（講師／工作人員 ${r.staffN} 位不用繳）`:""}</small></h5>
        <label class="check"><input type="checkbox" data-bg="manual"${b.manual?" checked":""}> 人工對帳（關閉＝依匯入名單的「待繳費」判斷）</label>
        <details${S.bdOpen?" open":""} data-bg-details><summary>名單（${r.N} 人）</summary>
          <div class="tbl"><table class="bg-t"><thead><tr><th>事業部</th><th>姓名</th><th>身分</th><th>已繳</th></tr></thead><tbody>${people||`<tr><td colspan="4" class="who">還沒有名單</td></tr>`}</tbody></table></div>
          ${b.manual?`<div class="actions"><button type="button" class="btn sm" data-bg="paidall">全部勾選</button><button type="button" class="btn sm link" data-bg="paidnone">全部取消</button></div>`:""}
        </details></section>
      <section><h5>③ 贊助</h5>${sponsorsHTML(c,b,r)}</section>
      <section class="${r.answered?"":"bg-need"}"><h5>④ 確認事項</h5>
        <p><b>講師／嘉賓是否用餐？</b><span class="bg-bad">（必填）</span></p>
        <label class="check"><input type="radio" name="bg-guest" data-bg="guest-yes"${b.guest.answer==="yes"?" checked":""}> 是　→ 名單外另有
          <input type="number" min="0" step="1" inputmode="numeric" data-bg="guest.n" value="${num(b.guest.n)||""}" placeholder="0" aria-label="名單外用餐人數"${b.guest.answer==="yes"?"":" disabled"}> 位講師／嘉賓用餐</label>
        <label class="check"><input type="radio" name="bg-guest" data-bg="guest-no"${b.guest.answer==="no"?" checked":""}> 否</label>
        ${r.staffN?`<p class="who">名單中已有講師／工作人員 ${r.staffN} 位，已算入有勾「含講師／嘉賓」的項目；上面只要填名單外的人數。</p>`:""}
        ${r.answered?"":`<p class="bg-bad">⚠️ 尚未確認：課程總表會顯示「待確認」，PDF 也會標示「講師用餐未確認」。</p>`}
      </section>
      <section><h5>⑤ 支出</h5>${costsHTML(c,b,r)}</section>
      <section><h5>⑥ 結果</h5><div id="bgres">${resultHTML(c, b)}</div></section>
      ${actions}
    </div>`;
  };

  /* ---------- 帳目 PDF（A4 直式；列印→另存為 PDF）---------- */
  const PS = { roster:true, sign:true };
  const pbox = document.createElement("div"); pbox.id="bp"; pbox.hidden=true; pbox.setAttribute("role","dialog"); pbox.setAttribute("aria-label","預算帳目預覽");
  document.body.appendChild(pbox);
  const pst = document.createElement("style");
  pst.textContent = `
#bp{position:fixed;inset:0;z-index:210;background:#e7e9ec;overflow:auto}
#bp[hidden]{display:none}
#bp .bp-bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 16px;background:var(--surface,#fff);border-bottom:1px solid var(--line,#d6dae0);color:var(--ink,#111)}
#bp .bp-bar b{margin-right:auto;font-size:15px}
#bp .bp-bar label{display:flex;align-items:center;gap:6px;font-size:13.5px;white-space:nowrap}
#bp .bp-hint{flex-basis:100%;font-size:12.5px;color:var(--muted,#666)}
.bp-doc{width:190mm;margin:18px auto 40px;background:#fff;color:#222;box-shadow:0 2px 10px rgba(0,0,0,.18);padding:8mm 7mm;box-sizing:border-box;font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;font-size:10.5pt;line-height:1.45}
.bp-doc h1{font-size:16pt;margin:0;text-align:center;color:#000}
.bp-doc .bp-sub{text-align:center;color:#555;font-size:9.5pt;margin-top:1mm}
.bp-doc .bp-meta{display:flex;justify-content:space-between;font-size:9pt;color:#555;margin:3mm 0 4mm;border-bottom:.5mm solid #5b3f86;padding-bottom:2mm}
.bp-doc h2{font-size:11.5pt;margin:5mm 0 2mm;padding-left:2mm;border-left:1.2mm solid #5b3f86;color:#000}
.bp-doc table{width:100%;border-collapse:collapse;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bp-doc th,.bp-doc td{border:.25mm solid #444;padding:1.4mm 2mm;text-align:center;font-variant-numeric:tabular-nums}
.bp-doc th{background:#5b3f86;color:#fff;font-weight:400;font-size:9.5pt}
.bp-doc tbody tr:nth-child(even) td{background:#f8f9fa}
.bp-doc td.l{text-align:left}.bp-doc td.r{text-align:right}
.bp-doc tr.tot td{font-weight:700;background:#c9daf8!important}
.bp-doc .ok{color:#1b7a43;font-weight:700}.bp-doc .bad{color:#c0392b;font-weight:700}
.bp-doc .note{font-size:9pt;color:#555;margin:1.5mm 0 0}
.bp-doc .warn{border:.4mm solid #c0392b;color:#c0392b;padding:2mm 3mm;margin:3mm 0;font-weight:700}
.bp-doc .signs{display:flex;justify-content:space-around;margin-top:12mm;font-size:11pt}
.bp-doc .signs span{display:inline-block;min-width:55mm;border-bottom:.3mm solid #222;padding-bottom:1mm}
.bp-doc thead{display:table-header-group}.bp-doc tr{break-inside:avoid}
@media print{
  body.bp-printing>*:not(#bp){display:none!important}
  body.bp-printing #bp{position:static;overflow:visible;background:none}
  #bp .bp-bar{display:none!important}
  .bp-doc{margin:0;box-shadow:none;width:auto;padding:0}
}`;
  document.head.appendChild(pst);

  function pdfHTML(c, b){
    const r = calc(c, b), M = v => Math.round(Number(v)||0).toLocaleString("zh-TW");
    if(r.mode!=="course") return pdfOther(c, b, r, M);
    const d = c.date ? new Date(c.date+"T00:00:00") : null;
    const sub = [d?`${d.getMonth()+1}/${d.getDate()}(${WD[d.getDay()]})`:"", c.time, c.location].filter(Boolean).join("　");
    const t = new Date(), today = `${t.getFullYear()}/${t.getMonth()+1}/${t.getDate()}`;
    const sg = v => v>=0 ? `<span class="ok">✅ ${M(v)}</span>` : `<span class="bad">⚠️ −${M(-v)}</span>`;
    const tierRows = b.tiers.map(x=>{ const n=r.rows.filter(y=>y.tier.id===x.id).length; return `<tr><td class="l">${esc(x.name||"（未命名）")}${x.staff?"（不算報名者）":""}</td><td class="r">${M(x.fee)}</td><td>${n}</td><td class="r">${M(num(x.fee)*n)}</td></tr>`; }).join("");
    const spRows = b.sponsors.map(x=>x.kind==="per"
      ? `<tr><td class="l">贊助：${esc(x.name||"（未命名）")}（每人）</td><td class="r">${M(x.amount)}</td><td>${r.N}</td><td class="r">${M(num(x.amount)*r.N)}</td></tr>`
      : `<tr><td class="l">贊助：${esc(x.name||"（未命名）")}</td><td></td><td></td><td class="r">${M(x.amount)}</td></tr>`).join("");
    const invs = b.sponsors.filter(x=>x.inv);
    const invTbl = invs.length ? `<h2>贊助單位統編</h2>
      <table><thead><tr><th>贊助單位</th><th>統一編號</th><th>抬頭（公司名稱）</th><th>金額</th></tr></thead><tbody>
      ${invs.map(x=>`<tr><td class="l">${esc(x.name||"（未命名）")}</td><td>${esc(x.taxId||"")||`<span class="bad">未填</span>`}</td><td class="l">${esc(x.invTitle||"")}</td><td class="r">${M(x.kind==="per"?num(x.amount)*r.N:x.amount)}</td></tr>`).join("")}
      </tbody></table>` : "";
    const costRows = b.costs.map(x=>{ const q=r.qty(x); return `<tr><td class="l">${esc(x.name||"（未命名）")}</td><td>${x.kind==="per"?"每人":"固定"}</td><td class="r">${M(x.amount)}</td><td>${x.kind==="per"?q:"—"}</td><td class="r">${M(num(x.amount)*q)}</td></tr>`; }).join("");
    const base = b.costs.reduce((s,x)=>s+num(x.amount)*r.qty(x),0);
    const bufAmt = base*(r.f-1);
    const guestTxt = !r.answered ? `<span class="bad">⚠️ 講師用餐未確認</span>`
      : b.guest.answer==="yes" ? `是，名單外 ${r.g} 位${r.staffN?`＋名單中講師／工作人員 ${r.staffN} 位`:""}（已算入有勾「含講師／嘉賓」的項目）`
      : `否${r.staffN?`（名單中講師／工作人員 ${r.staffN} 位已算入餐點）`:""}`;
    const roster = PS.roster ? `<h2>繳費名單（${r.rows.length} 人）</h2>
      <table><thead><tr><th>#</th><th>事業部</th><th>姓名</th><th>身分</th><th>金額</th><th>繳費</th></tr></thead><tbody>
      ${r.rows.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.p.division||"—")}</td><td>${esc(x.p.name)}</td><td>${esc(x.tier.name||"")}</td><td class="r">${M(x.tier.fee)}</td><td>${x.staff?"—":x.paid?"✔ 已繳":`<span class="bad">待繳</span>`}</td></tr>`).join("")}
      </tbody></table>` : "";
    return `<div class="bp-doc">
      <h1>${esc(c.title)}　預算帳目表</h1>${sub?`<div class="bp-sub">${esc(sub)}</div>`:""}
      <div class="bp-meta"><span>製表日期：${today}</span><span>製表人：${esc((S.me&&S.me.name)||"＿＿＿＿")}</span></div>
      ${r.answered?"":`<div class="warn">⚠️ 講師／嘉賓用餐尚未確認，以下支出可能不完整。</div>`}
      <h2>總覽</h2>
      <table><thead><tr><th></th><th>已收</th><th>預計（全部繳齊）</th></tr></thead><tbody>
        <tr><td class="l">報名費</td><td class="r">${M(r.received)}（${r.paidN} 人）</td><td class="r">${M(r.expected)}（${r.N} 人）</td></tr>
        <tr><td class="l">＋ 贊助</td><td class="r">${M(r.sponsor)}</td><td class="r">${M(r.sponsor)}</td></tr>
        <tr><td class="l">− 支出${num(b.buffer)?`（含緩衝 ${num(b.buffer)}%）`:""}</td><td class="r">${M(r.cost)}</td><td class="r">${M(r.cost)}</td></tr>
        <tr class="tot"><td class="l">＝ 剩餘</td><td class="r">${sg(r.remainNow)}</td><td class="r">${sg(r.remainExp)}</td></tr>
      </tbody></table>
      <p class="note">${r.need==null?"平均報名費不夠支付每人支出，人數越多越虧。":r.need===0?"損益平衡：贊助已足夠支付固定支出。":`損益平衡：至少需要 ${r.need} 人報名（目前 ${r.N} 人）。`}</p>
      <h2>收入明細</h2>
      <table><thead><tr><th>項目</th><th>單價</th><th>人數</th><th>小計</th></tr></thead><tbody>${tierRows}${spRows}
        <tr class="tot"><td class="l">收入合計（預計）</td><td></td><td></td><td class="r">${M(r.expected + r.sponsor)}</td></tr></tbody></table>
      ${invTbl}
      <h2>支出明細</h2>
      <table><thead><tr><th>項目</th><th>方式</th><th>單價</th><th>數量</th><th>小計</th></tr></thead><tbody>${costRows}
        ${num(b.buffer)?`<tr><td class="l">緩衝 ${num(b.buffer)}%</td><td></td><td></td><td></td><td class="r">${M(bufAmt)}</td></tr>`:""}
        <tr class="tot"><td class="l">支出合計</td><td></td><td></td><td></td><td class="r">${M(r.cost)}</td></tr></tbody></table>
      <h2>確認事項</h2><p>講師／嘉賓是否用餐：${guestTxt}</p>
      ${roster}
      ${PS.sign?`<div class="signs"><div>承辦人：<span></span></div><div>主管核章：<span></span></div></div>`:""}
    </div>`;
  }
  function invTable(b, r, M){
    const invs = b.sponsors.filter(x=>x.inv);
    return invs.length ? `<h2>贊助單位統編</h2>
      <table><thead><tr><th>贊助單位</th><th>統一編號</th><th>抬頭（公司名稱）</th><th>金額</th></tr></thead><tbody>
      ${invs.map(x=>`<tr><td class="l">${esc(x.name||"（未命名）")}</td><td>${esc(x.taxId||"")||`<span class="bad">未填</span>`}</td><td class="l">${esc(x.invTitle||"")}</td><td class="r">${M(x.kind==="per"?num(x.amount)*r.N:x.amount)}</td></tr>`).join("")}
      </tbody></table>` : "";
  }
  // 獎勵／自由試算的 PDF
  function pdfOther(c, b, r, M){
    const t = new Date(), today = `${t.getFullYear()}/${t.getMonth()+1}/${t.getDate()}`;
    const sg = v => v>=0 ? `<span class="ok">✅ ${M(v)}</span>` : `<span class="bad">⚠️ −${M(-v)}</span>`;
    const award = r.mode==="award";
    const title = award ? `${esc(c.title)}　預算帳目表` : "預算試算表";
    const sub = award ? `獎勵期間：${esc(fmtDay(c.date)||"即日起")} – ${esc(fmtDay(c.endDate)||"另行公告")}・得獎 ${r.N} 人` : `預計 ${r.N} 人報名${r.staffN||r.g?`・講師／嘉賓 ${r.staffN+r.g} 位`:""}`;
    const spRows = b.sponsors.map(x=>x.kind==="per"
      ? `<tr><td class="l">${esc(x.name||"（未命名）")}（每人）</td><td class="r">${M(x.amount)}</td><td>${r.N}</td><td class="r">${M(num(x.amount)*r.N)}</td></tr>`
      : `<tr><td class="l">${esc(x.name||"（未命名）")}</td><td></td><td></td><td class="r">${M(x.amount)}</td></tr>`).join("");
    const kindL = x => x.kind==="each" ? "每張" : x.kind==="per" ? "每人" : "固定";
    const costRows = b.costs.map(x=>{ const q=r.qty(x); return `<tr><td class="l">${esc(x.name||"（未命名）")}</td><td>${kindL(x)}</td><td class="r">${M(x.amount)}</td><td>${x.kind==="fixed"?"—":q}</td><td class="r">${M(num(x.amount)*q)}</td></tr>`; }).join("");
    const base = b.costs.reduce((s,x)=>s+num(x.amount)*r.qty(x),0), bufAmt = base*(r.f-1);
    const costTbl = `<h2>${award?"獎品與支出明細":"支出明細"}</h2>
      <table><thead><tr><th>項目</th><th>方式</th><th>單價</th><th>數量</th><th>小計</th></tr></thead><tbody>${costRows}
        ${num(b.buffer)?`<tr><td class="l">緩衝 ${num(b.buffer)}%</td><td></td><td></td><td></td><td class="r">${M(bufAmt)}</td></tr>`:""}
        <tr class="tot"><td class="l">支出合計</td><td></td><td></td><td></td><td class="r">${M(r.cost)}</td></tr></tbody></table>`;
    const spTbl = spRows ? `<h2>贊助明細</h2><table><thead><tr><th>贊助單位</th><th>單價</th><th>人數</th><th>小計</th></tr></thead><tbody>${spRows}
        <tr class="tot"><td class="l">贊助合計</td><td></td><td></td><td class="r">${M(r.sponsor)}</td></tr></tbody></table>${invTable(b, r, M)}` : "";
    let body;
    if(award){
      body = `<h2>總覽</h2><table><tbody>
        <tr><td class="l">支出${num(b.buffer)?`（含緩衝 ${num(b.buffer)}%）`:""}</td><td class="r">${M(r.cost)}</td></tr>
        <tr><td class="l">− 贊助</td><td class="r">${M(r.sponsor)}</td></tr>
        <tr class="tot"><td class="l">＝ 公司負擔</td><td class="r">${r.burden>0?M(r.burden):`<span class="ok">0（贊助還多 ${M(-r.burden)}）</span>`}</td></tr></tbody></table>
        ${costTbl}${spTbl}`;
    } else {
      const tierRows = b.tiers.map(x=>{ const n=Math.max(0,Math.round(num(x.n))); return `<tr><td class="l">${esc(x.name||"（未命名）")}${x.staff?"（不算報名者）":""}</td><td class="r">${M(x.fee)}</td><td>${n}</td><td class="r">${M(num(x.fee)*n)}</td></tr>`; }).join("");
      const ns = compareNs(r);
      body = `<h2>總覽</h2><table><tbody>
        <tr><td class="l">報名費（${r.N} 人）</td><td class="r">${M(r.expected)}</td></tr>
        <tr><td class="l">＋ 贊助</td><td class="r">${M(r.sponsor)}</td></tr>
        <tr><td class="l">− 支出${num(b.buffer)?`（含緩衝 ${num(b.buffer)}%）`:""}</td><td class="r">${M(r.cost)}</td></tr>
        <tr class="tot"><td class="l">＝ 剩餘</td><td class="r">${sg(r.remainExp)}</td></tr></tbody></table>
        <p class="note">${r.need==null?"平均報名費不夠支付每人支出，人數越多越虧。":r.need===0?"損益平衡：贊助已足夠支付固定支出。":`損益平衡：至少需要 ${r.need} 人報名。`}</p>
        <h2>人數對照</h2><table><thead><tr><th>人數</th>${ns.map(n=>`<th>${n} 人${n===r.need?"（損益平衡）":""}</th>`).join("")}</tr></thead>
          <tbody><tr><td class="l">剩餘</td>${ns.map(n=>`<td class="r">${sg(r.at(n))}</td>`).join("")}</tr></tbody></table>
        <h2>收入明細</h2><table><thead><tr><th>身分</th><th>報名費</th><th>人數</th><th>小計</th></tr></thead><tbody>${tierRows}
          <tr class="tot"><td class="l">報名費合計</td><td></td><td></td><td class="r">${M(r.expected)}</td></tr></tbody></table>
        ${spTbl}${costTbl}`;
    }
    return `<div class="bp-doc">
      <h1>${title}</h1><div class="bp-sub">${sub}</div>
      <div class="bp-meta"><span>製表日期：${today}</span><span>製表人：${esc((S.me&&S.me.name)||"＿＿＿＿")}</span></div>
      ${body}
      ${PS.sign?`<div class="signs"><div>承辦人：<span></span></div><div>主管核章：<span></span></div></div>`:""}
    </div>`;
  }
  function drawPdf(){
    const c = course(); if(!c || !S.bd || !S.bd.data){ closePdf(); return; }
    pbox.innerHTML = `<div class="bp-bar"><b>預算帳目預覽</b>
      ${modeOf(c)==="course"?`<label><input type="checkbox" data-bp="roster"${PS.roster?" checked":""}> 附繳費名單</label>`:""}
      <label><input type="checkbox" data-bp="sign"${PS.sign?" checked":""}> 簽核欄</label>
      <button type="button" class="btn primary" data-bp="print">下載 PDF</button><button type="button" class="btn link" data-bp="close">關閉</button>
      <span class="bp-hint">在列印視窗選「另存為 PDF」；建議關掉「頁首和頁尾」、勾選「背景圖形」。${S.bd.dirty&&S.bd.id!==TRIAL_ID?"（預覽用的是目前畫面上的數字，記得也按「儲存」）":""}</span></div>${pdfHTML(c, S.bd.data)}`;
    const doc = pbox.querySelector(".bp-doc"), s = Math.min(1, (window.innerWidth-24)/(190*96/25.4)); if(doc) doc.style.zoom = s<1 ? String(s) : "";
  }
  function closePdf(){ pbox.hidden=true; pbox.innerHTML=""; document.body.classList.remove("bp-printing"); document.documentElement.style.overflow=""; }
  window.openBudgetPdf = function(){ pbox.hidden=false; document.body.classList.add("bp-printing"); document.documentElement.style.overflow="hidden"; drawPdf(); pbox.scrollTop=0; };
  pbox.addEventListener("change", e=>{ const k=e.target.dataset.bp; if(k){ PS[k]=e.target.checked; drawPdf(); } });
  pbox.addEventListener("click", e=>{
    const t=e.target.closest("[data-bp]"); if(!t || t.tagName==="INPUT") return;
    if(t.dataset.bp==="close") closePdf();
    if(t.dataset.bp==="print"){ const c=course(), old=document.title; document.title=(c?(c.__trial?"預算試算":c.title).replace(/[\\/:*?"<>|]/g," ").trim():"課程")+(c&&c.__trial?"":"_預算帳目"); const done=()=>{ document.title=old; window.removeEventListener("afterprint",done); }; window.addEventListener("afterprint",done); setTimeout(()=>window.print(),50); }
  });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !pbox.hidden) closePdf(); });

  function course(){ const id = S.bd && S.bd.id; return id===TRIAL_ID ? window.trialCourse : S.courses.find(x=>x.id===id); }
  function redraw(){ const c=course(), el=$("#bgbox"); if(c && el) el.outerHTML = budgetSection(c); }
  function setPathGet(obj, path){ const ks=path.split("."); let o=obj; for(let i=0;i<ks.length-1;i++) o=o[ks[i]]; return o; }
  function setPath(obj, path, val){ const ks=path.split("."); let o=obj; for(let i=0;i<ks.length-1;i++) o=o[ks[i]]; o[ks[ks.length-1]]=val; }
  const NUMERIC = /(\.fee|\.amount|\.n)$|^buffer$|^guest\.n$/;

  document.addEventListener("input", e=>{
    const t = e.target, p = t.dataset && t.dataset.bg; if(!p || !S.bd || !S.bd.data || t.type==="checkbox" || t.type==="radio" || t.tagName==="SELECT") return;
    if(p==="trial"){ S.bd.data.trial = t.value; }
    else if(/\.q$/.test(p)){ setPath(S.bd.data, p, t.value==="" ? "" : num(t.value)); S.bd.dirty = true; }
    else { setPath(S.bd.data, p, NUMERIC.test(p) ? num(t.value) : t.value); S.bd.dirty = true; }
    const c = course(); const res = $("#bgres");
    if(c && res){ // 只更新結果區和各列小計，輸入框保持游標位置
      const focusTrial = p==="trial", pos = t.selectionStart;
      res.innerHTML = resultHTML(c, S.bd.data);
      const b = S.bd.data, r = calc(c, b);
      document.querySelectorAll("#bgbox [data-sub]").forEach(td=>{ const [list,i]=td.dataset.sub.split("."); if(b[list] && b[list][+i]) td.textContent = subText(c,b,r,list,+i); });
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
    else if(p==="staff"){ b.tiers[+t.dataset.i].staff = t.checked; }
    else if(p==="cguest"){ b.costs[+t.dataset.i].guest = t.checked; }
    else if(p==="inv-yes" || p==="inv-no"){ b.sponsors[+t.dataset.i].inv = p==="inv-yes"; }
    else if(p==="guest-yes" || p==="guest-no"){ b.guest = {...(b.guest||{n:0}), answer: p==="guest-yes" ? "yes" : "no"}; }
    else if(/^(costs|sponsors)\.\d+\.(kind|prize)$/.test(p)){ setPath(b, p, t.value); if(/costs\.\d+\.kind$/.test(p) && t.value==="each"){ const x=setPathGet(b,p); if(x && !x.prize){ const nm=Object.keys(prizeTotals(c))[0]; if(nm) x.prize=nm; } } }
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
    if(a==="reset"){ if(!confirm("清空目前的試算？")) return; S.trialData = null; S.bd = null; render(true); return; }
    if(a==="add:tiers") b.tiers.push(c.__trial ? {id:uid(), name:"", fee:0, n:0} : {id:uid(), name:"", fee:0});
    else if(a==="add:sponsors") b.sponsors.push({name:"", kind:"fixed", amount:0});
    else if(a==="add:costs") b.costs.push({name:"", kind:"fixed", amount:0});
    else if(a==="pdf"){ openBudgetPdf(c, b); return; }
    else if(a.startsWith("del:")){ const [list,i]=a.slice(4).split("."); b[list].splice(+i,1); }
    else if(a==="paidall"){ for(const p0 of peopleFor(c)) b.paid[keyOfP(p0)] = true; }
    else if(a==="paidnone"){ b.paid = {}; }
    else return;
    S.bd.dirty = true; redraw();
  });
})();
