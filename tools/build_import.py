#!/usr/bin/env python3
"""把 attendance_king.py 的結果包成 D1 匯入用的 meta / people JSON 與 SQL。

用法：python3 tools/build_import.py out.json config.json outdir
產生 outdir/meta.json、outdir/people.json、outdir/load.sql
"""
import json, os, sys
from datetime import datetime, timezone

ID = "attendance-king-2026"
HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    outp, cfgp, d = sys.argv[1:4]
    out = json.load(open(outp, encoding="utf-8"))
    cfg = json.load(open(cfgp, encoding="utf-8"))
    course = json.load(open(os.path.join(HERE, "meta_course.json"), encoding="utf-8"))
    meta = {"course": course, "calendar": out["calendar"], "weeks": out["weeks"], "lastRecord": out["lastRecord"], "config": cfg}
    m = json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
    p = json.dumps(out["people"], ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(d, "meta.json"), "w", encoding="utf-8").write(m)
    open(os.path.join(d, "people.json"), "w", encoding="utf-8").write(p)
    q = lambda x: "'" + x.replace("'", "''") + "'"
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    sql = f"INSERT OR REPLACE INTO attendance (id, meta, people, updated_at) VALUES ('{ID}', {q(m)}, {q(p)}, '{ts}');\n"
    open(os.path.join(d, "load.sql"), "w", encoding="utf-8").write(sql)
    print(f"meta {len(m.encode())} bytes, people {len(p.encode())} bytes")


if __name__ == "__main__":
    main()
