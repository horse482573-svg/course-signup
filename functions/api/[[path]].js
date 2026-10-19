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
  summary: 140, detail: 3000, poster: 40, payQr: 40, payNote: 1000, kind: 10, endDate: 10,
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
      const rosters = {};
      for (const r of rs.results) rosters[r.course_id] = { entries: JSON.parse(r.entries), importedAt: r.imported_at };
      return J({
        ok: true,
        courses: cs.results.map(r => ({ id: r.id, ...JSON.parse(r.data) })),
        signups: ss.results,
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

      // ---------- organizer ----------
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
