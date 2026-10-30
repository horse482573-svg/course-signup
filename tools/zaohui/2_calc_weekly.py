import json, openpyxl, sys
A=json.load(open("att.json")); days=A["days"]
GONG={"10/16":"方嘉猷 陳彥伯 毛志仁 吳思賢 吳滿 翁淑卿 朱玉琴 丁成義 周啓玲 李依萱 莊人豪 姚採蓮 湛茂瑜 施秀珍 黃昱樺 徐嫚娸".split()}
HOL={"2026-10-09","2026-10-23","2026-10-26"}
WEEKS=[("10/5 週",["2026-10-05","2026-10-07","2026-10-09"]),("10/12 週",["2026-10-12","2026-10-14","2026-10-16"]),("10/19 週",["2026-10-19","2026-10-21","2026-10-23"])]
def ok(n,d):
    if d in HOL: return True
    if d=="2026-10-16" and n in GONG["10/16"]: return True
    return days.get(d,{}).get(n)=="出席"
def real(n,d): return d not in HOL and days.get(d,{}).get(n)=="出席"
EXCLUDE={"陳櫻燕","蘇宜君"}  # 行政人員，不記入
names=[n for n in A["names"] if n not in EXCLUDE]; res={}
for n in names:
    w=[]; 
    for lab,ds in WEEKS:
        full=all(ok(n,d) for d in ds); wed=real(n,ds[1])
        w.append((lab,int(full),int(wed)))
    res[n]=w
# compare with sheet wk1/wk2
wb=openpyxl.load_workbook(sys.argv[1],data_only=True); ws=wb['全勤王']
diff=[]
for r in ws.iter_rows(min_row=4,values_only=True):
    n=r[2]
    if not n: continue
    s1=r[7] or 0; s2=r[11] or 0
    m=res.get(n)
    if not m: diff.append((n,"not in raw")); continue
    if (m[0][1]+m[0][2],m[1][1]+m[1][2])!=(s1,s2): diff.append((n,"sheet",s1,s2,"mine",m[0][1]+m[0][2],m[1][1]+m[1][2], [days.get(d,{}).get(n) for d in ["2026-10-05","2026-10-07","2026-10-12","2026-10-14","2026-10-16"]]))
print("diffs:",diff)
print("in raw not sheet:",[n for n in names if n not in [r[2] for r in ws.iter_rows(min_row=4,values_only=True)]])
json.dump(res,open("res.json","w"),ensure_ascii=False)
tot={n:sum(a+b for _,a,b in w) for n,w in res.items()}
print(sorted(tot.items(),key=lambda x:-x[1]))
