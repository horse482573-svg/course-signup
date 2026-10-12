CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, data TEXT NOT NULL, date TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS signups (course_id TEXT NOT NULL, pkey TEXT NOT NULL, unit TEXT, division TEXT, name TEXT NOT NULL, title TEXT, via TEXT, at TEXT NOT NULL, PRIMARY KEY (course_id, pkey));
CREATE TABLE IF NOT EXISTS rosters (course_id TEXT PRIMARY KEY, entries TEXT NOT NULL, imported_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, body BLOB NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_signups_pkey ON signups(pkey);
