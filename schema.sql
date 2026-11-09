CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, data TEXT NOT NULL, date TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS signups (course_id TEXT NOT NULL, pkey TEXT NOT NULL, unit TEXT, division TEXT, name TEXT NOT NULL, title TEXT, via TEXT, at TEXT NOT NULL, PRIMARY KEY (course_id, pkey));
CREATE TABLE IF NOT EXISTS rosters (course_id TEXT PRIMARY KEY, entries TEXT NOT NULL, imported_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS visits (
  day   TEXT NOT NULL,           -- 台灣日期 YYYY-MM-DD
  vid   TEXT NOT NULL,           -- 每台裝置的隨機代號
  n     INTEGER NOT NULL DEFAULT 1,
  named INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, vid)
);

CREATE TABLE IF NOT EXISTS budgets (
  course_id  TEXT PRIMARY KEY,
  data       TEXT NOT NULL,      -- JSON：報名費身分、繳費勾選、贊助、支出、緩衝
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roster_prev (
  course_id   TEXT PRIMARY KEY,
  entries     TEXT NOT NULL,     -- 上一版名單（匯入前自動保存，可復原）
  imported_at TEXT,
  saved_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notice (
  id         TEXT PRIMARY KEY,   -- 'main'
  data       TEXT NOT NULL,      -- JSON：其他事項、隱藏的課程、主持／音控排班
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, body BLOB NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_signups_pkey ON signups(pkey);

-- 管理人員（訓育委員 trainer／經管委員 manager）；登入碼只存雜湊
CREATE TABLE IF NOT EXISTS staff (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, code_hash TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, last_login TEXT);
-- 操作紀錄
CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, course_id TEXT NOT NULL, who TEXT, action TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS logs_course ON logs (course_id, id);
