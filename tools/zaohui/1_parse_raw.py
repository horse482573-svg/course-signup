import openpyxl, datetime as dt, collections, json, sys
wb=openpyxl.load_workbook(sys.argv[1],data_only=True)
ws=wb['記錄原檔']
rows=list(ws.iter_rows(values_only=True))
hdr=rows[0]
days={}  # date -> {name: status}
dups=[]
for i in range(0,len(hdr),3):
    d=hdr[i]
    if not isinstance(d,dt.datetime): continue
    rec={}
    for r in rows[1:]:
        n=r[i+1]; s=r[i+2]
        if not n: continue
        n=str(n).strip(); s=str(s or "").strip()
        if n in rec: dups.append((d.date(),n,rec[n],s))
        rec[n]= rec[n] if rec.get(n)=="出席" else s
    days[d.date()]=rec
print("dates:",[str(d) for d in days]); print("dups:",dups)
print("statuses:",collections.Counter(s for r in days.values() for s in r.values()))
names=sorted({n for r in days.values() for n in r})
print(len(names),"people")
json.dump({"days":{str(k):v for k,v in days.items()},"names":names},open("att.json","w"),ensure_ascii=False)
