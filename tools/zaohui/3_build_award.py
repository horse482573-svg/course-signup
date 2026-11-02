"""用 att.json 產生全勤王名單（含出席天數），輸出 award.json。
用法：python3 -I 3_build_award.py att.json [division_map.json]"""
import json, sys, datetime as dt
A=json.load(open(sys.argv[1])); days=A["days"]
DIV=json.load(open(sys.argv[2])) if len(sys.argv)>2 else {}
EXCLUDE={"陳櫻燕","蘇宜君"}                      # 行政人員，不記入
HOL={"2026-10-09","2026-10-23","2026-10-26"}    # 放假日：全員算出席，不算天數、週三不送
GONG={"2026-10-16":set("方嘉猷 陳彥伯 毛志仁 吳思賢 吳滿 翁淑卿 朱玉琴 丁成義 周啓玲 李依萱 莊人豪 姚採蓮 湛茂瑜 施秀珍 黃昱樺 徐嫚娸".split())}
START=dt.date(2026,10,5); STAR_REF="湛翰揚"
# 計分日：10/2 + 10/5 起每週一三五，到資料最後一天（或放假日）為止
last=max([dt.date.fromisoformat(d) for d in days]+[dt.date.fromisoformat(h) for h in HOL])
sched=[dt.date(2026,10,2)]; d=START
while d<=last:
    if d.weekday() in (0,2,4): sched.append(d)
    d+=dt.timedelta(days=1)
S=lambda x:x.isoformat()
missing=[S(x) for x in sched if S(x) not in days and S(x) not in HOL]
if missing: print("WARNING 缺資料的計分日:",missing)
def att(n,x):  # 算出席
    x=S(x); return x in HOL or n in GONG.get(x,()) or days.get(x,{}).get(n)=="出席"
def real(n,x): x=S(x); return x not in HOL and days.get(x,{}).get(n)=="出席"
def cnt(n): return sum(1 for x in sched if S(x) not in HOL and (days.get(S(x),{}).get(n)=="出席" or n in GONG.get(S(x),())))
weeks=[]; d=START
while d<=last:
    w=[d+dt.timedelta(k) for k in (0,2,4)]
    if all(S(x) in days or S(x) in HOL for x in w): weeks.append(w)
    d+=dt.timedelta(7)
months={}
for x in sched: months.setdefault(x.month,[]).append(x)
done_months=[m for m,xs in months.items() if xs[-1].month==m and (dt.date(2026,m%12+1,1)-dt.timedelta(1)) <= last+dt.timedelta(2)]
out=[]
for n in A["names"]:
    if n in EXCLUDE: continue
    full=[w for w in weeks if all(att(n,x) for x in w)]
    wed=sum(1 for w in weeks if real(n,w[1]))
    mon=[m for m in done_months if all(att(n,x) for x in months[m])]
    coffee=len(full)+wed
    parts=[]
    if full: parts.append(f"整週出席 {len(full)} 週")
    if wed: parts.append(f"週三加碼 {wed} 次")
    head=[f"咖啡券 {coffee} 張"] if coffee else []
    head+= [f"星巴克禮券 2 張（{m} 月全勤）" for m in mon]
    award=("＋".join(head)+("："+"＋".join(parts) if parts else "")) if head else ""
    out.append({"unit":"高雄","division":DIV.get(n,""),"name":n,"title":"","meal":"","drink":"","award":award,"days":cnt(n),"_c":coffee})
out.sort(key=lambda p:(-p["_c"],-p["days"]))
ref=next(p["days"] for p in out if p["name"]==STAR_REF)
for p in out: del p["_c"]
json.dump(out,open("award.json","w"),ensure_ascii=False,separators=(",",":"))
print("weeks:",[S(w[0]) for w in weeks],"months:",done_months,"ref days:",ref,"people:",len(out),"max len:",max(len(p["award"]) for p in out))
