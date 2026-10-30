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
const cleanEntry = p => ({ ...cleanProfile(p), meal: str(p?.meal, 60), drink: str(p?.drink, 40), award: str(p?.award, 80) });
const profileOk = p => p.unit && p.division && p.name && p.title;

const COURSE_FIELDS = {
  title: 80, signupUrl: 2000, date: 10, time: 40, location: 60, instructor: 40, status: 10,
  summary: 140, detail: 3000, poster: 40, payQr: 40, payNote: 1000, kind: 10, endDate: 10, mealLabel: 10, drinkLabel: 10, listUnit: 20,
};
function cleanCourse(c) {
  const o = {};
  for (const [k, n] of Object.entries(COURSE_FIELDS)) o[k] = str(c?.[k], n);
  o.hot = c?.hot === true;
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
      const [cs, ss, rs] = await db.batch([
        db.prepare("SELECT id, data FROM courses"),
        db.prepare("SELECT course_id, pkey, unit, division, name, title, via, at FROM signups ORDER BY at"),
        db.prepare("SELECT course_id, entries, imported_at FROM rosters"),
      ]);
      const url = new URL(request.url);
      const viewer = { name: str(url.searchParams.get("n"), 30), division: str(url.searchParams.get("d"), 30), unit: str(url.searchParams.get("u"), 20) };
      const vKey = viewer.name ? keyOf(viewer) : "";
      const isMe = (o, pkey) => !!viewer.name && ((pkey && pkey === vKey) || samePerson(viewer, o));
      const admin = !!env.ADMIN_PASSWORD && safeEqual(request.headers.get("x-admin-key") || "", env.ADMIN_PASSWORD);
      const mk = await makeMatcher(env.ADMIN_PASSWORD || "course-signup");
      const signups = [];
      for (const s of ss.results) {
        const me = isMe(s, s.pkey);
        signups.push(admin || me
          ? { ...s, mk: await mk(s.name), me }
          : { ...s, name: maskName(s.name), pkey: "", mk: await mk(s.name), me });
      }
      const rosters = {};
      for (const r of rs.results) {
        const entries = [];
        for (const e of JSON.parse(r.entries)) {
          const me = isMe(e);
          entries.push({ ...e, name: admin || me ? e.name : maskName(e.name), mk: await mk(e.name), me });
        }
        rosters[r.course_id] = { entries, importedAt: r.imported_at };
      }
      return J({
        ok: true,
        admin,
        courses: cs.results.map(r => ({ id: r.id, ...JSON.parse(r.data) })),
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
    if (path.startsWith("admin/")) {
      if (!env.ADMIN_PASSWORD) return J({ ok: false, error: "no_password" }, 500);
      if (!safeEqual(request.headers.get("x-admin-key") || "", env.ADMIN_PASSWORD)) return J({ ok: false, error: "bad_key" }, 401);
    }

    // image upload is a raw body; everything else is JSON
    if (path === "admin/image") {
      const mime = (request.headers.get("content-type") || "").split(";")[0].trim();
      if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return J({ ok: false, error: "unsupported_type" }, 400);
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
        const r = await db.prepare(
          "SELECT day, SUM(n) AS views, COUNT(*) AS people, SUM(named) AS named FROM visits GROUP BY day ORDER BY day DESC LIMIT 60"
        ).all();
        return J({ ok: true, days: r.results });
      }
      case "admin/check":
        return J({ ok: true });
      case "admin/course": {
        const c = cleanCourse(body.course);
        if (!c.title) return J({ ok: false, error: "bad_input" }, 400);
        const id = str(body.course?.id, 40);
        if (id) {
          const r = await db.prepare("UPDATE courses SET data = ?, date = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(c), c.date, now(), id).run();
          if (!r.meta.changes) return J({ ok: false, error: "not_found" }, 404);
          return J({ ok: true, id });
        }
        const nid = rid();
        await db.prepare("INSERT INTO courses (id, data, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(nid, JSON.stringify(c), c.date, now(), now()).run();
        return J({ ok: true, id: nid });
      }
      case "admin/course/delete": {
        const id = str(body.id, 40);
        const c = await getCourse(db, id);
        const stmts = [
          db.prepare("DELETE FROM courses WHERE id = ?").bind(id),
          db.prepare("DELETE FROM signups WHERE course_id = ?").bind(id),
          db.prepare("DELETE FROM rosters WHERE course_id = ?").bind(id),
        ];
        for (const img of [c?.poster, c?.payQr]) if (img) stmts.push(db.prepare("DELETE FROM images WHERE id = ?").bind(img));
        await db.batch(stmts);
        return J({ ok: true });
      }
      case "admin/roster": {
        const id = str(body.courseId, 40);
        const entries = (Array.isArray(body.entries) ? body.entries : []).slice(0, 3000).map(cleanEntry).filter(p => p.name);
        await db.prepare("INSERT OR REPLACE INTO rosters (course_id, entries, imported_at) VALUES (?, ?, ?)").bind(id, JSON.stringify(entries), now()).run();
        return J({ ok: true, count: entries.length });
      }
      case "admin/roster/delete": {
        await db.prepare("DELETE FROM rosters WHERE course_id = ?").bind(str(body.courseId, 40)).run();
        return J({ ok: true });
      }
      case "admin/image/delete": {
        const ids = (Array.isArray(body.ids) ? body.ids : []).map(x => str(x, 40)).filter(Boolean).slice(0, 10);
        if (ids.length) await db.batch(ids.map(i => db.prepare("DELETE FROM images WHERE id = ?").bind(i)));
        return J({ ok: true });
      }
    }
    return J({ ok: false, error: "not_found" }, 404);
  } catch (e) {
    return J({ ok: false, error: "server", message: String(e && e.message || e) }, 500);
  }
}
