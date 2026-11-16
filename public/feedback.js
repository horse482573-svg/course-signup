/* 使用回饋：右下角「💬 意見回饋」→ 送出；課程管理「💬 使用回饋」（總管理員、訓育委員）查看與處理 */
(function(){
  const KIND = { idea:"建議", bug:"問題回報", other:"其他" };
  const st = document.createElement("style");
  st.textContent = `
#fbBtn{position:fixed;right:16px;bottom:16px;z-index:150;border:0;border-radius:999px;padding:10px 16px;font:inherit;font-size:14px;font-weight:600;background:#38bdf8;color:#111;border:2px solid #0ea5e9;box-shadow:0 4px 14px rgba(14,165,233,.35);cursor:pointer}
#fbBtn:focus-visible{outline:3px solid #111;outline-offset:2px}
#fbBtn:hover{filter:brightness(1.08)}
body.tab-admin #fbBtn{display:none}
body:not(.tab-admin){padding-bottom:64px}
@media print{#fbBtn{display:none}}
#fbDlg{position:fixed;inset:0;z-index:240;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px}
#fbDlg[hidden]{display:none}
#fbDlg form{background:var(--surface,#fff);color:var(--ink,#111);border-radius:12px;padding:18px;width:min(440px,100%);max-height:92vh;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:12px}
#fbDlg h3{margin:0;font-size:17px}
#fbDlg .kinds{display:flex;flex-wrap:wrap;gap:6px 14px}
#fbDlg label{font-size:14px;color:var(--ink)}
#fbDlg .fl{display:flex;flex-direction:column;gap:4px}
#fbDlg .ck{display:inline-flex;flex-direction:row;align-items:center;gap:6px;width:auto;white-space:nowrap;margin:0}
#fbDlg .ck input{width:auto;margin:0;flex:none}
#fbDlg .kinds .ck{margin-right:4px}
#fbDlg textarea,#fbDlg input[type=text]{font:inherit;font-size:16px;padding:8px 10px;border:1px solid var(--line,#ccc);border-radius:8px;background:var(--surface,#fff);color:var(--ink,#111);width:100%;box-sizing:border-box}
#fbDlg textarea{min-height:110px;resize:vertical}
#fbDlg .row{display:flex;justify-content:flex-end;align-items:center;gap:8px}
#fbDlg .err{margin-right:auto}
#fbDlg .thanks{text-align:center;padding:20px 6px;font-size:16px;line-height:1.7}
#tab-admin .fb-dot{display:inline-block;min-width:18px;height:18px;padding:0 5px;margin-left:6px;border-radius:9px;background:#e5484d;color:#fff;font-size:11.5px;line-height:18px;text-align:center;vertical-align:1px;font-weight:700}
.fbadmin .seg{margin:4px 0 10px}
.fb-list{list-style:none;margin:0;padding:0}
.fb-list li{border-top:1px solid var(--line);padding:12px 2px;display:grid;gap:6px}
.fb-list li.done{opacity:.72}
.fb-list .h{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:13px;color:var(--muted)}
.fb-list .h b{color:var(--ink);font-size:14px}
.fb-list .fb-body{white-space:pre-wrap;line-height:1.6;font-size:15px}
.fb-list .k{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;background:var(--accent-soft);color:var(--accent)}
.fb-list .k.bug{background:#fde8e8;color:#c0362c}
.fb-list .ops{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}
.fb-list .ops input{font:inherit;font-size:14px;padding:5px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);flex:1;min-width:180px}
`;
  document.head.appendChild(st);

  /* ---------- 同事：送出回饋 ---------- */
  const btn = document.createElement("button");
  btn.id = "fbBtn"; btn.type = "button"; btn.textContent = "💬 意見回饋"; btn.setAttribute("aria-haspopup","dialog");
  document.body.appendChild(btn);
  const dlg = document.createElement("div"); dlg.id = "fbDlg"; dlg.hidden = true; dlg.setAttribute("role","dialog"); dlg.setAttribute("aria-label","意見回饋");
  document.body.appendChild(dlg);

  function pageDesc(){
    const tab = { shelf:"課程總覽", all:"全部課程", award:"獎勵總覽", mine:"我的報名", admin:"課程管理" }[S.tab] || S.tab || "";
    const c = (S.awardOpen && S.courses.find(x=>x.id===S.awardOpen)) || (S.open && S.courses.find(x=>x.id===S.open));
    return [tab, c ? c.title : ""].filter(Boolean).join("・").slice(0, 80);
  }
  function open(){
    const nm = (S.me && S.me.name) || "";
    dlg.innerHTML = `<form id="fbForm" autocomplete="off"><h3>💬 意見回饋</h3>
      <div class="kinds" role="radiogroup" aria-label="類型">${Object.entries(KIND).map(([k,l],i)=>`<label class="ck"><input type="radio" name="fbk" value="${k}"${i===0?" checked":""}> ${l}</label>`).join("")}</div>
      <label class="fl">內容<textarea id="fb-body" maxlength="1000" required placeholder="想到什麼都可以說：哪裡不好用、希望多什麼功能、看到錯字…"></textarea></label>
      <label class="ck"><input type="checkbox" id="fb-anon"> 匿名送出（不留姓名）</label>
      <label class="fl" id="fb-namebox">姓名（選填）<input type="text" id="fb-name" maxlength="20" value="${esc(nm)}"></label>
      <label class="ck"><input type="checkbox" id="fb-want"> 希望收到回覆</label>
      <label class="fl" id="fb-cbox" hidden>聯絡方式（LINE ID 或電話）<input type="text" id="fb-contact" maxlength="80"></label>
      <div class="row"><span class="err" id="fb-err"></span><button type="button" class="btn link" data-fb="cancel">取消</button><button type="submit" class="btn primary">送出</button></div></form>`;
    dlg.hidden = false; setTimeout(()=>document.getElementById("fb-body")?.focus(), 0);
  }
  const close = () => { dlg.hidden = true; dlg.innerHTML = ""; btn.focus(); };
  btn.addEventListener("click", open);
  dlg.addEventListener("click", e=>{ if(e.target===dlg || e.target.closest("[data-fb=cancel]")) close(); });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !dlg.hidden) close(); });
  dlg.addEventListener("change", e=>{
    if(e.target.id==="fb-anon"){ const nb=document.getElementById("fb-namebox"); nb.hidden = e.target.checked; }
    if(e.target.id==="fb-want"){ document.getElementById("fb-cbox").hidden = !e.target.checked; if(e.target.checked) document.getElementById("fb-contact").focus(); }
  });
  dlg.addEventListener("submit", async e=>{
    e.preventDefault();
    const er = document.getElementById("fb-err"), body = document.getElementById("fb-body").value.trim();
    if(body.length < 2){ er.textContent = "請寫下內容"; return; }
    let last = 0; try{ last = +localStorage.getItem("cs-fb-at") || 0; }catch(_){}
    if(Date.now() - last < 60000){ er.textContent = "剛剛已經送出過，請 1 分鐘後再試"; return; }
    const anon = document.getElementById("fb-anon").checked, want = document.getElementById("fb-want").checked;
    const b = dlg.querySelector("button[type=submit]"); b.disabled = true; er.textContent = "";
    try{
      await api("feedback", { kind: dlg.querySelector("input[name=fbk]:checked").value, body, anon,
        name: anon ? "" : document.getElementById("fb-name").value.trim(),
        contact: want ? document.getElementById("fb-contact").value.trim() : "", page: pageDesc() });
      try{ localStorage.setItem("cs-fb-at", String(Date.now())); }catch(_){}
      dlg.querySelector("form").innerHTML = `<div class="thanks">謝謝你的回饋！<br>我們會盡快處理 🙏</div><div class="row"><button type="button" class="btn primary" data-fb="cancel">關閉</button></div>`;
    }catch(ex){ er.textContent = ex && ex.error==="too_fast" ? "剛剛已經送出過，請 1 分鐘後再試" : errMsg(ex); b.disabled = false; }
  });

  /* ---------- 課程管理：未處理紅點 ---------- */
  function dot(){
    const t = document.getElementById("tab-admin"); if(!t) return;
    let d = t.querySelector(".fb-dot");
    const n = (typeof canAll==="function" && canAll()) ? (S.fbNew||0) : 0;
    if(n && !d){ d = document.createElement("span"); d.className = "fb-dot"; t.appendChild(d); }
    if(d){ if(n){ d.textContent = n > 99 ? "99+" : n; d.setAttribute("aria-label", `${n} 則未處理回饋`); } else d.remove(); }
  }
  setInterval(dot, 1500); document.addEventListener("click", ()=>setTimeout(dot, 50));

  /* ---------- 課程管理：回饋列表 ---------- */
  const F = { items:null, filter:"new", loading:false };
  async function load(){
    if(F.loading) return; F.loading = true;
    try{ F.items = (await api("admin/feedback/list",{})).items || []; S.fbNew = F.items.filter(x=>x.status==="new").length; }catch(e){ F.items = []; }
    F.loading = false; redraw(); dot();
  }
  const redraw = () => { const el = document.getElementById("fbadmin"); if(el) el.outerHTML = fold("feedback", feedbackAdmin(), feedbackExtra()); };
  window.feedbackExtra = () => (S.fbNew ? `<span class="pill closed">${S.fbNew} 則未處理</span>` : `<span class="who">沒有未處理</span>`);
  window.feedbackAdmin = function(){
    if(F.items==null) setTimeout(load, 0);
    const L = F.items || [], cnt = k => L.filter(x=>k==="all"||x.status===k).length;
    const shown = L.filter(x=>F.filter==="all"||x.status===F.filter);
    return `<section class="panel fbadmin" id="fbadmin"><h2>💬 使用回饋</h2>
      <p class="who">同事從網站右下角「💬 意見回饋」送出的內容。總管理員和訓育委員都看得到。</p>
      <div class="seg seg-tabs">${[["new","未處理"],["done","已處理"],["all","全部"]].map(([k,l])=>`<button type="button" class="btn sm ${F.filter===k?"primary":""}" data-fbf="${k}">${l} ${cnt(k)}</button>`).join("")}<button type="button" class="btn sm link" data-fbr="1">重新整理</button></div>
      ${F.items==null ? `<p class="who">載入中…</p>` : shown.length ? `<ul class="fb-list">${shown.map(x=>`<li class="${x.status}">
          <div class="h"><span>${esc(fmtTime(x.at))}</span><span class="k ${esc(x.kind)}">${esc(KIND[x.kind]||"其他")}</span><b>${x.name?esc(x.name):"匿名"}</b>${x.page?`<span>頁面：${esc(x.page)}</span>`:""}${x.contact?`<span>聯絡：${esc(x.contact)}</span>`:""}</div>
          <div class="fb-body">${esc(x.body)}</div>
          <div class="ops"><input type="text" maxlength="300" placeholder="處理備註（例如：已改好 11/17）" value="${esc(x.note||"")}" data-fbn="${x.id}" aria-label="處理備註">
            ${x.status==="new"?`<button type="button" class="btn sm primary" data-fbd="${x.id}">✓ 已處理</button>`:`<span class="who">${x.done_by?`${esc(x.done_by)} `:""}已處理${x.done_at?` ${esc(fmtTime(x.done_at))}`:""}</span><button type="button" class="btn sm link" data-fbu="${x.id}">改回未處理</button>`}</div></li>`).join("")}</ul>`
        : `<p class="who">${F.filter==="new"?"沒有未處理的回饋 👍":"目前沒有回饋。"}</p>`}
    </section>`;
  };
  async function upd(id, data, msg){
    try{ await api("admin/feedback/update", {id, ...data}); if(msg) toast(msg); }catch(e){ toast(errMsg(e)); }
    await load();
  }
  document.addEventListener("click", e=>{
    const t = e.target.closest("#fbadmin [data-fbf],#fbadmin [data-fbd],#fbadmin [data-fbu],#fbadmin [data-fbr]"); if(!t) return;
    if(t.dataset.fbf){ F.filter = t.dataset.fbf; redraw(); }
    else if(t.dataset.fbr){ F.items = null; redraw(); }
    else if(t.dataset.fbd){ const n = document.querySelector(`#fbadmin [data-fbn="${t.dataset.fbd}"]`); upd(+t.dataset.fbd, {status:"done", note:n?n.value:undefined}, "已標記為已處理"); }
    else if(t.dataset.fbu){ upd(+t.dataset.fbu, {status:"new"}, "已改回未處理"); }
  });
  document.addEventListener("change", e=>{ const t = e.target; if(t.dataset && t.dataset.fbn && t.closest("#fbadmin")) upd(+t.dataset.fbn, {note:t.value}, "備註已儲存"); });
})();
