/* 管理人員（只有總管理員看得到）：新增訓育委員／經管委員、產生登入碼、改權限、停用 */
(function(){
  const T = { list:null, ownerName:"", code:null, busy:false, loading:false };
  const ROLE_DESC = {
    trainer: "訓育委員：管理所有課程與獎勵（名單、預算、簽到表），以及公告、行事曆",
    manager: "經管委員：只能管理自己設立的課程與獎勵（含預算、簽到表、匯入名單）",
  };
  async function load(){
    if(T.loading) return; T.loading = true;
    try{ const r = await api("admin/staff/list",{}); T.list = r.staff||[]; T.ownerName = r.ownerName||""; S.staffList = T.list.map(({id,name,role,active})=>({id,name,role,active})); }
    catch(e){ T.list = []; }
    T.loading = false; redraw();
  }
  const redraw = () => { const el = document.getElementById("stadmin"); if(el) el.outerHTML = typeof fold==="function" ? fold("staff", staffAdmin()) : staffAdmin(); };
  const roleSel = (v, attrs) => `<select ${attrs}>${["trainer","manager"].map(k=>`<option value="${k}"${v===k?" selected":""}>${ROLE_LABEL[k]}</option>`).join("")}</select>`;
  const site = () => location.origin + location.pathname + "#admin";

  window.staffAdmin = function(){
    if(T.list==null) setTimeout(load, 0);
    const L = T.list || [];
    const codeBox = T.code ? `<div class="st-code" role="status">
        <p><b>${esc(T.code.name)}</b> 的登入碼（只會顯示這一次，請現在複製傳給他）：</p>
        <p class="st-big">${esc(T.code.code)}</p>
        <textarea readonly rows="4" data-st="msg">${esc(`${T.code.name} 您好，已為您開通課程管理（${ROLE_LABEL[T.code.role]}）。\n網址：${site()}\n登入碼：${T.code.code}\n請勿外流；若遺失請找我重設。`)}</textarea>
        <div class="actions"><button type="button" class="btn primary" data-st="copy">複製訊息</button><button type="button" class="btn link" data-st="hide">我已經傳給他了</button></div></div>` : "";
    return `<section class="panel stadmin" id="stadmin"><h2>👥 管理人員</h2>
      <p class="who">每位管理人員有自己的登入碼；停用後那組碼立刻失效，不影響其他人。</p>
      <ul class="st-roles"><li>👑 總管理員（你）：全部功能，包含管理人員、瀏覽統計</li><li>${ROLE_DESC.trainer}</li><li>${ROLE_DESC.manager}</li></ul>
      <div class="st-owner"><label>總管理員顯示名稱 <input type="text" maxlength="20" data-st="ownerName" value="${esc(T.ownerName||S.adminName||"")}"></label><button type="button" class="btn sm" data-st="saveOwner">儲存</button></div>
      ${codeBox}
      ${T.list==null ? `<p class="who">載入中…</p>` : L.length ? `<div class="tbl"><table class="st-t"><thead><tr><th>姓名</th><th>權限</th><th>狀態</th><th>最後登入</th><th>操作</th></tr></thead><tbody>
        ${L.map(x=>`<tr class="${x.active?"":"off"}"><td>${esc(x.name)}</td>
          <td>${roleSel(x.role, `data-st="role" data-id="${esc(x.id)}" aria-label="權限"`)}</td>
          <td>${x.active?`<span class="pill mine">使用中</span>`:`<span class="pill closed">已停用</span>`}</td>
          <td class="t">${esc(fmtTime(x.last_login)||"—")}</td>
          <td><div class="ops"><button type="button" class="btn sm" data-st="reset" data-id="${esc(x.id)}">重設登入碼</button>
            <button type="button" class="btn sm ${x.active?"danger":""}" data-st="${x.active?"off":"on"}" data-id="${esc(x.id)}">${x.active?"停用":"重新啟用"}</button></div></td></tr>`).join("")}
        </tbody></table></div>` : `<p class="who">還沒有其他管理人員。</p>`}
      <div class="st-add"><label>姓名 <input type="text" maxlength="20" data-st="newName" placeholder="例如：高抒雅"></label>
        <label>權限 ${roleSel("manager", `data-st="newRole"`)}</label>
        <button type="button" class="btn primary" data-st="add"${T.busy?" disabled":""}>＋ 新增管理人員</button><span class="err" id="st-err"></span></div>
    </section>`;
  };

  const st = document.createElement("style");
  st.textContent = `
.stadmin .st-roles{margin:6px 0 12px;padding-left:1.2em;font-size:13.5px;color:var(--muted);line-height:1.7}
.stadmin label{flex-direction:row;align-items:center;gap:6px;color:var(--ink);font-size:14px;white-space:nowrap}
.stadmin select{width:auto}
.stadmin input[type=text],.stadmin select{font:inherit;font-size:14px;padding:5px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}
.stadmin .st-owner,.stadmin .st-add{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:10px 0}
.stadmin .st-add{margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)}
.stadmin .st-t tr.off td{color:var(--muted)}
.stadmin .ops{display:flex;flex-wrap:wrap;gap:6px}
.st-code{border:2px solid var(--accent);background:var(--accent-soft);border-radius:10px;padding:12px 14px;margin:10px 0}
.st-code p{margin:0 0 6px}
.st-code .st-big{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:22px;font-weight:700;letter-spacing:1px;user-select:all}
.st-code textarea{width:100%;font:inherit;font-size:13px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);resize:vertical}
`;
  document.head.appendChild(st);

  const err = t => { const e = document.getElementById("st-err"); if(e) e.textContent = t||""; };
  async function after(msg){ toast(msg); await load(); }
  document.addEventListener("click", async e=>{
    const t = e.target.closest("#stadmin [data-st]"); if(!t || t.tagName==="INPUT" || t.tagName==="SELECT" || t.tagName==="TEXTAREA") return;
    const a = t.dataset.st, id = t.dataset.id;
    try{
      if(a==="add"){
        const name = document.querySelector("#stadmin [data-st=newName]").value.trim(), role = document.querySelector("#stadmin [data-st=newRole]").value;
        if(!name){ err("請填姓名"); return; }
        T.busy = true; t.disabled = true;
        const r = await api("admin/staff/add",{name, role});
        T.code = {name, role, code:r.code}; T.busy = false; await after(`已新增 ${name}`);
      }
      else if(a==="reset"){
        const x = (T.list||[]).find(y=>y.id===id); if(!x || !confirm(`重設 ${x.name} 的登入碼？舊的登入碼會立刻失效。`)) return;
        const r = await api("admin/staff/reset",{id}); T.code = {name:x.name, role:x.role, code:r.code}; await after("已產生新的登入碼");
      }
      else if(a==="off" || a==="on"){
        const x = (T.list||[]).find(y=>y.id===id); if(!x) return;
        if(a==="off" && !confirm(`停用 ${x.name}？他的登入碼會立刻失效（他設立的課程會保留）。`)) return;
        await api("admin/staff/update",{id, active:a==="on"}); await after(a==="on"?`已重新啟用 ${x.name}`:`已停用 ${x.name}`);
      }
      else if(a==="saveOwner"){
        const name = document.querySelector("#stadmin [data-st=ownerName]").value.trim();
        await api("admin/staff/owner-name",{name}); S.adminName = name || "總管理員"; T.ownerName = S.adminName; toast("已儲存"); render(true);
      }
      else if(a==="copy"){
        const ta = document.querySelector("#stadmin [data-st=msg]");
        try{ await navigator.clipboard.writeText(ta.value); toast("已複製，可以貼到 LINE 傳給他"); }catch(_){ ta.select(); document.execCommand && document.execCommand("copy"); toast("已選取訊息，請按複製"); }
      }
      else if(a==="hide"){ T.code = null; redraw(); }
    }catch(ex){ T.busy = false; err(errMsg(ex)); toast(errMsg(ex)); redraw(); }
  });
  document.addEventListener("change", async e=>{
    const t = e.target; if(!t.closest || !t.closest("#stadmin") || t.dataset.st!=="role") return;
    try{ await api("admin/staff/update",{id:t.dataset.id, role:t.value}); await after("已變更權限"); }catch(ex){ toast(errMsg(ex)); }
  });

  /* ---------- 訓育委員／經管委員：自己改登入碼 ---------- */
  const dlg = document.createElement("div"); dlg.id="mycode"; dlg.hidden=true; dlg.setAttribute("role","dialog"); dlg.setAttribute("aria-label","修改我的登入碼");
  document.body.appendChild(dlg);
  const st2 = document.createElement("style");
  st2.textContent = `
#mycode{position:fixed;inset:0;z-index:230;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px}
#mycode[hidden]{display:none}
#mycode form{background:var(--surface,#fff);color:var(--ink,#111);border-radius:12px;padding:18px 18px 14px;width:min(400px,100%);box-shadow:0 8px 30px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:10px}
#mycode h3{margin:0 0 4px;font-size:17px}
#mycode label{display:flex;flex-direction:column;gap:4px;font-size:13.5px;color:var(--muted)}
#mycode input{font:inherit;font-size:16px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}
#mycode ul{margin:0;padding-left:1.2em;font-size:12.5px;color:var(--muted)}
#mycode .row{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:4px}
#mycode .err{margin-right:auto}
`;
  document.head.appendChild(st2);
  function openMyCode(){
    dlg.innerHTML = `<form id="mycodeForm" autocomplete="off"><h3>🔑 修改我的登入碼</h3>
      <label>目前的登入碼<input type="password" id="mc-cur" autocomplete="current-password" required></label>
      <label>新的登入碼<input type="password" id="mc-new" autocomplete="new-password" required></label>
      <label>再輸入一次<input type="password" id="mc-new2" autocomplete="new-password" required></label>
      <ul><li>至少 8 個字，要有英文和數字（大小寫、空格、「-」不影響）</li><li>不能和別人的登入碼相同</li><li>忘記的話，請找總管理員重設</li></ul>
      <div class="row"><span class="err" id="mc-err"></span><button type="button" class="btn link" data-mc="cancel">取消</button><button type="submit" class="btn primary">確定修改</button></div></form>`;
    dlg.hidden = false; setTimeout(()=>document.getElementById("mc-cur")?.focus(), 0);
  }
  const closeMyCode = () => { dlg.hidden = true; dlg.innerHTML = ""; };
  dlg.addEventListener("click", e=>{ if(e.target===dlg || e.target.closest("[data-mc=cancel]")) closeMyCode(); });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !dlg.hidden) closeMyCode(); });
  dlg.addEventListener("submit", async e=>{
    e.preventDefault();
    const cur = document.getElementById("mc-cur").value, nx = document.getElementById("mc-new").value, nx2 = document.getElementById("mc-new2").value;
    const er = document.getElementById("mc-err"), norm = v => v.replace(/[\s-]/g,"").toLowerCase();
    if(norm(nx)!==norm(nx2)){ er.textContent = "兩次輸入的新登入碼不一樣"; return; }
    const n = norm(nx);
    if(n.length<8 || !/[a-z]/.test(n) || !/\d/.test(n)){ er.textContent = "至少 8 個字，要有英文和數字"; return; }
    const btn = dlg.querySelector("button[type=submit]"); btn.disabled = true; er.textContent = "";
    try{
      await api("admin/staff/self-code", {current:cur, next:nx});
      S.adminKey = nx; try{ ss.set("cs-admin", nx); }catch(_){}
      closeMyCode(); toast("登入碼已修改，下次請用新的登入碼登入");
    }catch(ex){ er.textContent = errMsg(ex); btn.disabled = false; }
  });
  document.addEventListener("click", e=>{ if(e.target.closest("[data-act=my-code]")){ e.stopPropagation(); openMyCode(); } }, true);
})();
