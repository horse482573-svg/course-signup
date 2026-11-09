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
})();
