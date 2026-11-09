// 公司課程報名 — API (Cloudflare Pages Functions + D1)
// Bindings: DB (D1)  ·  Secret: ADMIN_PASSWORD

const J = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const now = () => new Date().toISOString();
const rid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const str = (v, n) => String(v ?? "").trim().slice(0, n);

const normName = s => String(s || "").replace(/[\s　·．.\-_()（）]/g, "").toLowerCase();
const normUnit = s => String(s || "").replace(/[\s　]/g, "").toLowerCase();
const keyOf = p => normName(p.name) + "|" + normUnit(p.unit);

function cleanProfile(p) {
  p = p || {};
  return { unit: str(p.unit, 20), division: str(p.division, 30), name: str(p.name, 30), title: str(p.title, 20) };
}
const cleanEntry = p => {
  const o = { ...cleanProfile(p), meal: str(p?.meal, 60), drink: str(p?.drink, 40), award: str(p?.award, 80) };
  const d = parseInt(p?.days, 10);
  if (Number.isFinite(d) && d >= 0 && d < 1000) o.days = d; // 出席天數（全勤王等獎勵用）
  // 名單上的其他欄位（例如：梯次、衣服尺寸、交通方式），以表頭文字為 key
  if (p?.extra && typeof p.extra === "object") {
    const x = {};
    for (const [k, v] of Object.entries(p.extra).slice(0, 15)) {
      const kk = str(k, 20), vv = str(v, 80);
      if (kk && vv) x[kk] = vv;
    }
    if (Object.keys(x).length) o.extra = x;
  }
  return o;
};
const profileOk = p => p.unit && p.division && p.name && p.title;

const COURSE_FIELDS = {
  title: 80, signupUrl: 2000, date: 10, time: 40, location: 60, instructor: 40, status: 10,
  summary: 140, detail: 3000, poster: 40, payQr: 40, payNote: 1000, kind: 10, endDate: 10, mealLabel: 10, drinkLabel: 10, listUnit: 20,
};
function cleanCourse(c) {
  const o = {};
  for (const [k, n] of Object.entries(COURSE_FIELDS)) o[k] = str(c?.[k], n);
  o.hot = c?.hot === true;
  o.listOnly = c?.listOnly === true;
  // 出席天數星星：天數 ≥ starDays 的人加 ⭐，starLabel 是說明文字裡的比較對象
  const sd = parseInt(c?.starDays, 10);
  o.starDays = Number.isFinite(sd) && sd > 0 ? sd : 0;
  o.starLabel = str(c?.starLabel, 20);
  o.asOf = str(c?.asOf, 20);
  o.signLabel = str(c?.signLabel, 12);
  o.signOff = c?.signOff === true;
  // 簽到表要產出哪些文件：sign 簽到表、stats 統計表、names 統計表附名單、skip 不統計的欄位
  if (c?.sheetDocs && typeof c.sheetDocs === "object") {
    const d = c.sheetDocs;
    o.sheetDocs = { sign: d.sign !== false, stats: d.stats === true, names: d.names !== false,
      skip: (Array.isArray(d.skip) ? d.skip : []).slice(0, 30).map(x => str(x, 40)).filter(Boolean),
      prizes: Object.fromEntries(Object.entries(d.prizes && typeof d.prizes === "object" ? d.prizes : {}).slice(0, 10).map(([k, v]) => [str(k, 30), v === true]).filter(([k]) => k)) };
  } // true＝簽到表不印簽到欄（只當名單用） // 簽到表最後一欄的名稱（預設：課程「簽到」、獎勵「簽收」）
  // 欄位設定：k＝欄位代號（division/name/meal/drink/note/award/days/x:表頭/b:空白欄），sign＝印在簽到表，pub＝同事在網站上看得到
  if (Array.isArray(c?.cols)) {
    o.cols = c.cols.slice(0, 24).map(x => ({ k: str(x?.k, 40), label: str(x?.label, 20), sign: x?.sign === true, pub: x?.pub === true })).filter(x => x.k);
  }
  o.capacity = Math.max(0, Math.min(100000, parseInt(c?.capacity, 10) || 0));
  if (o.status !== "closed") o.status = "open";
  if (o.kind !== "meal" && o.kind !== "award") o.kind = "general";
  if (o.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(o.endDate)) o.endDate = "";
  if (o.date && !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) o.date = "";
  if (o.signupUrl && !/^https?:\/\//i.test(o.signupUrl)) o.signupUrl = "";
  return o;
}

// 遮名：湛翰揚 → 湛O揚
function maskName(n) {
  const a = [...String(n || "").trim()];
  if (a.length <= 1 || /^未具名/.test(a.join(""))) return a.join("");
  if (a.length === 2) return a[0] + "O";
  return a[0] + "O".repeat(a.length - 2) + a[a.length - 1];
}
// 和前端相同的核對規則：姓名＋事業部（事業部允許包含關係或留空）
function samePerson(a, b) {
  const na = normName(a.name); if (!na || na !== normName(b.name)) return false;
  const da = normUnit(a.division), db = normUnit(b.division);
  return !da || !db || da === db || da.includes(db) || db.includes(da);
}
// 不可逆的比對代號：讓前端能把「回報」和「官方名單」配對，又看不到全名
async function makeMatcher(secret) {
  const cache = new Map();
  return async name => {
    const k = normName(name);
    if (!cache.has(k)) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret + "|" + k));
      cache.set(k, [...new Uint8Array(buf)].slice(0, 9).map(x => x.toString(16).padStart(2, "0")).join(""));
    }
    return cache.get(k);
  };
}

function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function toB64(buf) {
  const bytes = new Uint8Array(buf); let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64); const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function todayTW() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// ---------- 管理人員：總管理員（ADMIN_PASSWORD）、訓育委員（trainer）、經管委員（manager）----------
const ROLES = { trainer: 1, manager: 1 };
const normCode = k => String(k || "").replace(/[\s\-]/g, "").toLowerCase();
async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, "0")).join("");
}
const codeHash = (env, code) => sha((env.ADMIN_PASSWORD || "") + "|staff|" + normCode(code));
function newCode() {
  const A = "abcdefghjkmnpqrstuvwxyz23456789", r = crypto.getRandomValues(new Uint8Array(10));
  const s = [...r].map(x => A[x % A.length]).join("");
  return s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8);
}
async function whoIs(request, env, db) {
  const key = request.headers.get("x-admin-key") || "";
  if (!key || !env.ADMIN_PASSWORD) return null;
  if (safeEqual(key, env.ADMIN_PASSWORD)) {
    let name = "總管理員";
    try { const r = await db.prepare("SELECT data FROM notice WHERE id = 'owner'").first(); if (r) name = JSON.parse(r.data).name || name; } catch (e) {}
    return { role: "owner", id: "", name };
  }
  if (normCode(key).length < 8) return null;
  try {
    const r = await db.prepare("SELECT id, name, role, active FROM staff WHERE code_hash = ?").bind(await codeHash(env, key)).first();
    if (r && r.active && ROLES[r.role]) return { role: r.role, id: r.id, name: r.name };
  } catch (e) {}
  return null;
}
const canAll = w => w && (w.role === "owner" || w.role === "trainer");
const canCourse = (w, c) => canAll(w) || (w && w.role === "manager" && c && c.owner === w.id);
async function addLog(db, w, courseId, action, detail) {
  try {
    await db.prepare("INSERT INTO logs (at, course_id, who, action, detail) VALUES (?, ?, ?, ?, ?)")
      .bind(now(), courseId || "", (w && w.name) || "", str(action, 40), str(detail, 200)).run();
  } catch (e) {}
}

async function getCourse(db, id) {
  const r = await db.prepare("SELECT id, data FROM courses WHERE id = ?").bind(id).first();
  return r ? { id: r.id, ...JSON.parse(r.data) } : null;
}

export async function onRequest({ request, env, params }) {
  const path = (params.path || []).join("/");
  const method = request.method;
  const db = env.DB;
  if (!db) return J({ ok: false, error: "no_db" }, 500);

  try {
    // ---------- public reads ----------
    if (method === "GET" && path === "state") {
      const [cs, ss, rs, ns, cal] = await db.batch([
        db.prepare("SELECT id, data FROM courses"),
        db.prepare("SELECT course_id, pkey, unit, division, name, title, via, at FROM signups ORDER BY at"),
        db.prepare("SELECT course_id, entries, imported_at FROM rosters"),
        db.prepare("SELECT data, updated_at FROM notice WHERE id = 'main'"),
        db.prepare("SELECT data FROM notice WHERE id = 'cal'"),
      ]);
      let calendars = [];
      try { const x = cal.results[0]; if (x) calendars = JSON.parse(x.data).items || []; } catch (e) {}
      let notice = null;
      try { const n = ns.results[0]; if (n) notice = { ...JSON.parse(n.data), updatedAt: n.updated_at }; } catch (e) {}
      const url = new URL(request.url);
      const viewer = { name: str(url.searchParams.get("n"), 30), division: str(url.searchParams.get("d"), 30), unit: str(url.searchParams.get("u"), 20) };
      const vKey = viewer.name ? keyOf(viewer) : "";
      const isMe = (o, pkey) => !!viewer.name && ((pkey && pkey === vKey) || samePerson(viewer, o));
      const who = await whoIs(request, env, db);
      const admin = !!who;
      const mk = await makeMatcher(env.ADMIN_PASSWORD || "course-signup");
      const courses = cs.results.map(r => ({ id: r.id, ...JSON.parse(r.data) }));
      const full = {};   // 這個登入者看得到全名與所有欄位的課程
      for (const c of courses) full[c.id] = canCourse(who, c);
      const signups = [];
      for (const s of ss.results) {
        const me = isMe(s, s.pkey);
        signups.push(full[s.course_id] || me
          ? { ...s, mk: await mk(s.name), me }
          : { ...s, name: maskName(s.name), pkey: "", mk: await mk(s.name), me });
      }
      // 非舉辦人只拿得到勾選「網站顯示」的其他欄位
      const pubExtra = {};
      for (const c of courses) pubExtra[c.id] = new Set((c.cols || []).filter(x => x.pub && x.k.startsWith("x:")).map(x => x.k.slice(2)));
      const rosters = {};
      for (const r of rs.results) {
        const entries = [];
        for (const e0 of JSON.parse(r.entries)) {
          const me = isMe(e0);
          const e = { ...e0 };
          if (!full[r.course_id] && e.extra) {
            const keep = pubExtra[r.course_id] || new Set(), x = {};
            for (const [k, v] of Object.entries(e.extra)) if (keep.has(k)) x[k] = v;
            if (Object.keys(x).length) e.extra = x; else delete e.extra;
          }
          entries.push({ ...e, name: full[r.course_id] || me ? e.name : maskName(e.name), mk: await mk(e.name), me });
        }
        rosters[r.course_id] = { entries, importedAt: r.imported_at };
      }
      return J({
        ok: true,
        admin,
        role: who ? who.role : "",
        courses,
        notice,
        calendars,
        signups,
        rosters,
      });
    }
    if (method === "GET" && path.startsWith("image/")) {
      const id = path.slice(6);
      const r = await db.prepare("SELECT mime, body FROM images WHERE id = ?").bind(id).first();
      if (!r) return new Response("Not found", { status: 404 });
      return new Response(fromB64(r.body), {
        headers: { "content-type": r.mime, "cache-control": "public, max-age=31536000, immutable" },
      });
    }
    if (method !== "POST") return J({ ok: false, error: "not_found" }, 404);

    // ---------- admin guard ----------
    let who = null;
    if (path.startsWith("admin/")) {
      if (!env.ADMIN_PASSWORD) return J({ ok: false, error: "no_password" }, 500);
      who = await whoIs(request, env, db);
      if (!who) return J({ ok: false, error: "bad_key" }, 401);
    }
    const deny = () => J({ ok: false, error: "forbidden" }, 403);
    // 依課程 id 檢查權限（經管委員只能動自己設立的）
    const own = async id => { const c = await getCourse(db, id); return c && canCourse(who, c) ? c : null; };

    // image upload is a raw body; everything else is JSON
    if (path === "admin/image") {
      const mime = (request.headers.get("content-type") || "").split(";")[0].trim();
      if (!/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(mime)) return J({ ok: false, error: "unsupported_type" }, 400);
      const buf = await request.arrayBuffer();
      if (!buf.byteLength) return J({ ok: false, error: "empty" }, 400);
      if (buf.byteLength > 1400 * 1024) return J({ ok: false, error: "too_large" }, 413);
      const id = rid();
      await db.prepare("INSERT INTO images (id, mime, body, created_at) VALUES (?, ?, ?, ?)").bind(id, mime, toB64(buf), now()).run();
      return J({ ok: true, id });
    }

    let body = {};
    try { body = await request.json(); } catch (e) { return J({ ok: false, error: "bad_json" }, 400); }

    switch (path) {
      // ---------- colleagues ----------
      case "signup": {
        const p = cleanProfile(body.profile);
        if (!profileOk(p)) return J({ ok: false, error: "bad_input" }, 400);
        const c = await getCourse(db, str(body.courseId, 40));
        if (!c) return J({ ok: false, error: "not_found" }, 404);
        if (c.status === "closed" || (c.date && c.date < todayTW())) return J({ ok: false, error: "closed" }, 409);
        const ext = !!c.signupUrl;
        if (!ext) return J({ ok: false, error: "onsite_closed" }, 403); // 本站報名暫停中
        const pkey = keyOf(p);
        if (!ext && c.capacity > 0) {
          const n = await db.prepare("SELECT COUNT(*) AS n FROM signups WHERE course_id = ? AND pkey != ?").bind(c.id, pkey).first();
          if (n.n >= c.capacity) return J({ ok: false, error: "full" }, 409);
        }
        await db.prepare(
          `INSERT INTO signups (course_id, pkey, unit, division, name, title, via, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(course_id, pkey) DO UPDATE SET unit=excluded.unit, division=excluded.division, name=excluded.name, title=excluded.title`
        ).bind(c.id, pkey, p.unit, p.division, p.name, p.title, ext ? "self" : "page", now()).run();
        return J({ ok: true, pkey });
      }
      case "unsignup": {
        await db.prepare("DELETE FROM signups WHERE course_id = ? AND pkey = ?").bind(str(body.courseId, 40), str(body.pkey, 80)).run();
        return J({ ok: true });
      }
      case "profile": {
        const p = cleanProfile(body.profile);
        if (!profileOk(p)) return J({ ok: false, error: "bad_input" }, 400);
        const oldKey = str(body.oldKey, 80);
        if (oldKey) {
          await db.prepare("UPDATE OR REPLACE signups SET pkey = ?, unit = ?, division = ?, name = ?, title = ? WHERE pkey = ?")
            .bind(keyOf(p), p.unit, p.division, p.name, p.title, oldKey).run();
        }
        return J({ ok: true, pkey: keyOf(p) });
      }

      case "visit": {
        const vid = str(body.vid, 40).replace(/[^\w-]/g, "");
        if (!vid) return J({ ok: false, error: "bad_input" }, 400);
        await db.prepare(
          `INSERT INTO visits (day, vid, n, named) VALUES (?, ?, 1, ?)
           ON CONFLICT(day, vid) DO UPDATE SET n = n + 1, named = MAX(named, excluded.named)`
        ).bind(todayTW(), vid, body.named ? 1 : 0).run();
        return J({ ok: true });
      }

      // ---------- organizer ----------
      case "admin/visits": {
        if (who.role !== "owner") return deny();
        const r = await db.prepare(
          "SELECT day, SUM(n) AS views, COUNT(*) AS people, SUM(named) AS named FROM visits GROUP BY day ORDER BY day DESC LIMIT 60"
        ).all();
        return J({ ok: true, days: r.results });
      }
      // ---------- 自辦課程預算（只有舉辦人看得到）----------
      case "admin/budgets": {
        const r = await db.prepare("SELECT course_id, data FROM budgets").all();
        const out = {};
        const mine = canAll(who) ? null : new Set((await db.prepare("SELECT id, data FROM courses").all()).results.filter(x => { try { return JSON.parse(x.data).owner === who.id; } catch (e) { return false; } }).map(x => x.id));
        for (const x of r.results) { if (mine && !mine.has(x.course_id)) continue; try { out[x.course_id] = JSON.parse(x.data); } catch (e) {} }
        return J({ ok: true, budgets: out });
      }
      case "admin/budget": {
        const id = str(body.courseId, 40);
        const text = JSON.stringify(body.budget ?? null);
        if (!id || !body.budget || typeof body.budget !== "object") return J({ ok: false, error: "bad_input" }, 400);
        if (text.length > 60000) return J({ ok: false, error: "too_large" }, 413);
        if (!(await own(id))) return deny();
        await db.prepare("INSERT OR REPLACE INTO budgets (course_id, data, updated_at) VALUES (?, ?, ?)").bind(id, text, now()).run();
        await addLog(db, who, id, "儲存預算", body.budget.enabled ? "" : "停用預算");
        return J({ ok: true });
      }
      // ---------- 公告（大家都看得到）----------
      case "admin/notice": {
        if (!canAll(who)) return deny();
        const n = body.notice || {};
        const clean = {
          items: (Array.isArray(n.items) ? n.items : []).slice(0, 30).map(x => ({ date: str(x?.date, 10), title: str(x?.title, 60), desc: str(x?.desc, 200), url: /^https?:\/\//i.test(str(x?.url, 500)) ? str(x?.url, 500) : "" })).filter(x => x.title),
          hidden: (Array.isArray(n.hidden) ? n.hidden : []).slice(0, 100).map(x => str(x, 40)).filter(Boolean),
          duty: (Array.isArray(n.duty) ? n.duty : []).slice(0, 60).map(x => ({ start: str(x?.start, 10), end: str(x?.end, 10),
            host: { division: str(x?.host?.division, 30), name: str(x?.host?.name, 30) }, sound: { division: str(x?.sound?.division, 30), name: str(x?.sound?.name, 30) } }))
            .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.start)),
        };
        await db.prepare("INSERT OR REPLACE INTO notice (id, data, updated_at) VALUES ('main', ?, ?)").bind(JSON.stringify(clean), now()).run();
        return J({ ok: true });
      }
      // ---------- 行事曆（大家都看得到；可放多個月份）----------
      case "admin/calendar": {
        if (!canAll(who)) return deny();
        const items = (Array.isArray(body.items) ? body.items : []).slice(0, 36).map(x => ({
          month: str(x?.month, 7), img: str(x?.img, 40), pdf: str(x?.pdf, 40), name: str(x?.name, 80),
          w: Math.max(0, Math.round(+x?.w || 0)), h: Math.max(0, Math.round(+x?.h || 0)), at: str(x?.at, 30),
        })).filter(x => /^\d{4}-\d{2}$/.test(x.month) && x.img);
        await db.prepare("INSERT OR REPLACE INTO notice (id, data, updated_at) VALUES ('cal', ?, ?)").bind(JSON.stringify({ items }), now()).run();
        return J({ ok: true });
      }
      case "admin/check": {
        if (who.id) { try { await db.prepare("UPDATE staff SET last_login = ? WHERE id = ?").bind(now(), who.id).run(); } catch (e) {} }
        let staff = [];
        if (canAll(who)) { try { staff = (await db.prepare("SELECT id, name, role, active FROM staff ORDER BY created_at").all()).results; } catch (e) {} }
        return J({ ok: true, role: who.role, id: who.id, name: who.name, staff });
      }
      // ---------- 管理人員（只有總管理員）----------
      case "admin/staff/list": {
        if (who.role !== "owner") return deny();
        const r = await db.prepare("SELECT id, name, role, active, created_at, last_login FROM staff ORDER BY created_at").all();
        return J({ ok: true, staff: r.results, ownerName: who.name });
      }
      case "admin/staff/add": {
        if (who.role !== "owner") return deny();
        const name = str(body.name, 20), role = str(body.role, 10);
        if (!name || !ROLES[role]) return J({ ok: false, error: "bad_input" }, 400);
        const id = rid(), code = newCode();
        await db.prepare("INSERT INTO staff (id, name, role, code_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)").bind(id, name, role, await codeHash(env, code), now()).run();
        return J({ ok: true, id, code });
      }
      case "admin/staff/update": {
        if (who.role !== "owner") return deny();
        const id = str(body.id, 40), r = await db.prepare("SELECT id, name, role, active FROM staff WHERE id = ?").bind(id).first();
        if (!r) return J({ ok: false, error: "not_found" }, 404);
        const name = body.name != null ? str(body.name, 20) || r.name : r.name;
        const role = body.role != null && ROLES[body.role] ? body.role : r.role;
        const active = body.active != null ? (body.active ? 1 : 0) : r.active;
        await db.prepare("UPDATE staff SET name = ?, role = ?, active = ? WHERE id = ?").bind(name, role, active, id).run();
        return J({ ok: true });
      }
      case "admin/staff/reset": {
        if (who.role !== "owner") return deny();
        const id = str(body.id, 40), code = newCode();
        const r = await db.prepare("UPDATE staff SET code_hash = ?, active = 1 WHERE id = ?").bind(await codeHash(env, code), id).run();
        if (!r.meta.changes) return J({ ok: false, error: "not_found" }, 404);
        return J({ ok: true, code });
      }
      // 訓育委員、經管委員自己改登入碼
      case "admin/staff/self-code": {
        if (!who.id) return deny();
        const cur = String(body.current || ""), next = String(body.next || "");
        const me = await db.prepare("SELECT code_hash FROM staff WHERE id = ?").bind(who.id).first();
        if (!me || me.code_hash !== await codeHash(env, cur)) return J({ ok: false, error: "bad_current" }, 400);
        const n = normCode(next);
        if (n.length < 8 || n.length > 40 || !/[a-z]/.test(n) || !/\d/.test(n)) return J({ ok: false, error: "weak_code" }, 400);
        if (safeEqual(next, env.ADMIN_PASSWORD) || n === normCode(env.ADMIN_PASSWORD)) return J({ ok: false, error: "code_taken" }, 409);
        const h = await codeHash(env, next);
        const dup = await db.prepare("SELECT id FROM staff WHERE code_hash = ? AND id != ?").bind(h, who.id).first();
        if (dup) return J({ ok: false, error: "code_taken" }, 409);
        await db.prepare("UPDATE staff SET code_hash = ? WHERE id = ?").bind(h, who.id).run();
        return J({ ok: true });
      }
      case "admin/staff/owner-name": {
        if (who.role !== "owner") return deny();
        const name = str(body.name, 20) || "總管理員";
        await db.prepare("INSERT OR REPLACE INTO notice (id, data, updated_at) VALUES ('owner', ?, ?)").bind(JSON.stringify({ name }), now()).run();
        return J({ ok: true });
      }
      case "admin/logs": {
        const id = str(body.courseId, 40);
        if (!(await own(id))) return deny();
        const r = await db.prepare("SELECT at, who, action, detail FROM logs WHERE course_id = ? ORDER BY id DESC LIMIT 50").bind(id).all();
        return J({ ok: true, logs: r.results });
      }
      case "admin/course/owner": {
        if (!canAll(who)) return deny();
        const c = await getCourse(db, str(body.id, 40));
        if (!c) return J({ ok: false, error: "not_found" }, 404);
        const sid = str(body.owner, 40);
        let ownerName = "";
        if (sid) { const r = await db.prepare("SELECT name FROM staff WHERE id = ?").bind(sid).first(); if (!r) return J({ ok: false, error: "not_found" }, 404); ownerName = r.name; }
        const { id: _i, ...data } = c; data.owner = sid; data.ownerName = ownerName;
        await db.prepare("UPDATE courses SET data = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(data), now(), c.id).run();
        await addLog(db, who, c.id, "變更負責人", ownerName || "（無）");
        return J({ ok: true });
      }
      case "admin/course": {
        const c = cleanCourse(body.course);
        if (!c.title) return J({ ok: false, error: "bad_input" }, 400);
        const id = str(body.course?.id, 40);
        if (id) {
          const old = await getCourse(db, id);
          if (!old) return J({ ok: false, error: "not_found" }, 404);
          if (!canCourse(who, old)) return deny();
          c.owner = old.owner || ""; c.ownerName = old.ownerName || "";      // 負責人不由表單決定
          if (!canAll(who)) c.hot = !!old.hot;                                // 「近期最火」只有總管理員、訓育委員能設
          await db.prepare("UPDATE courses SET data = ?, date = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(c), c.date, now(), id).run();
          const what = body.what ? str(body.what, 40) : (old.status !== c.status ? (c.status === "closed" ? "截止報名" : "重新開放報名") : old.hot !== c.hot ? (c.hot ? "設為近期最火" : "取消近期最火") : "編輯內容");
          if (what !== "-") await addLog(db, who, id, what, "");
          return J({ ok: true, id });
        }
        if (!canAll(who)) c.hot = false;
        c.owner = who.id || ""; c.ownerName = who.id ? who.name : "";
        const nid = rid();
        await db.prepare("INSERT INTO courses (id, data, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(nid, JSON.stringify(c), c.date, now(), now()).run();
        await addLog(db, who, nid, c.kind === "award" ? "建立獎勵" : "建立課程", c.title);
        return J({ ok: true, id: nid });
      }
      case "admin/course/delete": {
        const id = str(body.id, 40);
        const c = await getCourse(db, id);
        if (c && !canCourse(who, c)) return deny();
        await addLog(db, who, id, "刪除", c ? c.title : "");
        const stmts = [
          db.prepare("DELETE FROM courses WHERE id = ?").bind(id),
          db.prepare("DELETE FROM signups WHERE course_id = ?").bind(id),
          db.prepare("DELETE FROM rosters WHERE course_id = ?").bind(id),
          db.prepare("DELETE FROM budgets WHERE course_id = ?").bind(id),
          db.prepare("DELETE FROM roster_prev WHERE course_id = ?").bind(id),
        ];
        for (const img of [c?.poster, c?.payQr]) if (img) stmts.push(db.prepare("DELETE FROM images WHERE id = ?").bind(img));
        await db.batch(stmts);
        return J({ ok: true });
      }
      case "admin/roster": {
        const id = str(body.courseId, 40);
        if (!(await own(id))) return deny();
        const entries = (Array.isArray(body.entries) ? body.entries : []).slice(0, 3000).map(cleanEntry).filter(p => p.name);
        // 先把目前名單存成「上一版」，匯入錯了可以復原
        await db.batch([
          db.prepare("INSERT OR REPLACE INTO roster_prev (course_id, entries, imported_at, saved_at) SELECT course_id, entries, imported_at, ? FROM rosters WHERE course_id = ?").bind(now(), id),
          db.prepare("INSERT OR REPLACE INTO rosters (course_id, entries, imported_at) VALUES (?, ?, ?)").bind(id, JSON.stringify(entries), now()),
        ]);
        await addLog(db, who, id, "匯入名單", `${entries.length} 人${body.mode === "merge" ? "（合併）" : body.mode === "replace" ? "（取代）" : ""}`);
        return J({ ok: true, count: entries.length });
      }
      case "admin/roster/delete": {
        const id = str(body.courseId, 40);
        if (!(await own(id))) return deny();
        await addLog(db, who, id, "清除名單", "");
        await db.batch([
          db.prepare("INSERT OR REPLACE INTO roster_prev (course_id, entries, imported_at, saved_at) SELECT course_id, entries, imported_at, ? FROM rosters WHERE course_id = ?").bind(now(), id),
          db.prepare("DELETE FROM rosters WHERE course_id = ?").bind(id),
        ]);
        return J({ ok: true });
      }
      case "admin/roster/undo": {
        // 目前名單和上一版互換（所以再按一次可以換回來）
        const id = str(body.courseId, 40);
        if (!(await own(id))) return deny();
        const prev = await db.prepare("SELECT entries, imported_at FROM roster_prev WHERE course_id = ?").bind(id).first();
        if (!prev) return J({ ok: false, error: "no_prev" }, 404);
        const cur = await db.prepare("SELECT entries, imported_at FROM rosters WHERE course_id = ?").bind(id).first();
        const stmts = [db.prepare("INSERT OR REPLACE INTO rosters (course_id, entries, imported_at) VALUES (?, ?, ?)").bind(id, prev.entries, prev.imported_at)];
        stmts.push(cur
          ? db.prepare("INSERT OR REPLACE INTO roster_prev (course_id, entries, imported_at, saved_at) VALUES (?, ?, ?, ?)").bind(id, cur.entries, cur.imported_at, now())
          : db.prepare("DELETE FROM roster_prev WHERE course_id = ?").bind(id));
        await db.batch(stmts);
        let n = 0; try { n = JSON.parse(prev.entries).length; } catch (e) {}
        await addLog(db, who, id, "復原上一版名單", `${n} 人`);
        return J({ ok: true });
      }
      case "admin/roster/prev": {
        const r = await db.prepare("SELECT course_id, entries, imported_at, saved_at FROM roster_prev").all();
        const out = {};
        const ok = canAll(who) ? null : new Set((await db.prepare("SELECT id, data FROM courses").all()).results.filter(x => { try { return JSON.parse(x.data).owner === who.id; } catch (e) { return false; } }).map(x => x.id));
        for (const x of r.results) { if (ok && !ok.has(x.course_id)) continue; let n = 0; try { n = JSON.parse(x.entries).length; } catch (e) {} out[x.course_id] = { n, importedAt: x.imported_at, savedAt: x.saved_at }; }
        return J({ ok: true, prev: out });
      }
      case "admin/image/delete": {
        let ids = (Array.isArray(body.ids) ? body.ids : []).map(x => str(x, 40)).filter(Boolean).slice(0, 10);
        if (!canAll(who) && ids.length) {
          // 經管委員：不能刪別人課程的圖片或行事曆
          const used = new Set();
          for (const x of (await db.prepare("SELECT data FROM courses").all()).results) { try { const c = JSON.parse(x.data); if (c.owner !== who.id) { used.add(c.poster); used.add(c.payQr); } } catch (e) {} }
          try { const r = await db.prepare("SELECT data FROM notice WHERE id = 'cal'").first(); for (const it of (r ? JSON.parse(r.data).items : [])) { used.add(it.img); used.add(it.pdf); } } catch (e) {}
          ids = ids.filter(i => !used.has(i));
        }
        if (ids.length) await db.batch(ids.map(i => db.prepare("DELETE FROM images WHERE id = ?").bind(i)));
        return J({ ok: true });
      }
    }
    return J({ ok: false, error: "not_found" }, 404);
  } catch (e) {
    return J({ ok: false, error: "server", message: String(e && e.message || e) }, 500);
  }
}
