"""用 att.json 產生全勤王名單（含出席天數），輸出 award.json。
用法：python3 -I 3_build_award.py att.json [division_map.json]"""
import json, sys, datetime as dt
A=json.load(open(sys.argv[1])); days=A["days"]
DIV=json.load(open(sys.argv[2])) if len(sys.argv)>2 else {}
EXCLUDE={"陳櫻燕","蘇宜君","陳卜瑄","陳映潔","葉銘巖"}                      # 行政人員，不記入
HOL={"2026-10-09","2026-10-23","2026-10-26"}    # 放假日：全員算出席，不算天數、週三不送
GONG={"2026-10-16":set("方嘉猷 陳彥伯 毛志仁 吳思賢 吳滿 翁淑卿 朱玉琴 丁成義 周啓玲 李依萱 莊人豪 姚採蓮 湛茂瑜 施秀珍 黃昱樺 徐嫚娸 簡素能".split()),
      "2026-10-28":set("鄭志弘 簡素能 朱玉琴 施秀珍 曾銀芝 湛茂瑜".split())}
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
# 每月結算：週獎勵算在「該週週一」的月份；已過的月份標「已頒」，獎品字樣放在「：」後面，簽收表只算本月
CUR=last.month
def month_award(n,m):
    ws=[w for w in weeks if w[0].month==m]
    full=[w for w in ws if all(att(n,x) for x in w)]
    wed=sum(1 for w in ws if real(n,w[1]))
    coffee=len(full)+wed
    head=[f"咖啡券 {coffee} 張"] if coffee else []
    if m in done_months and all(att(n,x) for x in months[m]): head.append("星巴克禮券 2 張")
    parts=[]
    if full: parts.append(f"整週出席 {len(full)} 週")
    if wed: parts.append(f"週三加碼 {wed} 次")
    return coffee,head,parts
out=[]
for n in A["names"]:
    if n in EXCLUDE: continue
    coffee,head,parts=month_award(n,CUR)
    past=[]
    for m in sorted({w[0].month for w in weeks}|set(done_months)):
        if m==CUR: continue
        _,h,_p=month_award(n,m)
        if h: past.append(f"{m} 月已頒 "+"、".join(x.replace(" ","") for x in h))
    award="＋".join(head) if head else ""
    tail=[]
    if parts: tail.append(f"{CUR} 月"+"＋".join(parts))
    tail+=past
    if tail: award=(award+"：" if award else f"{CUR} 月尚無｜") + "｜".join(tail)
    out.append({"unit":"高雄","division":DIV.get(n,""),"name":n,"title":"","meal":"","drink":"","award":award,"days":cnt(n),"_c":coffee})
out=[p for p in out if p["days"]>0 and p["division"]!="GO總公司"]  # 出席 0 天不列；GO總公司＝行政人員
out.sort(key=lambda p:(-p["_c"],-p["days"]))
ref=next(p["days"] for p in out if p["name"]==STAR_REF)
for p in out: del p["_c"]
json.dump(out,open("award.json","w"),ensure_ascii=False,separators=(",",":"))
print("weeks:",[S(w[0]) for w in weeks],"months:",done_months,"ref days:",ref,"people:",len(out),"max len:",max(len(p["award"]) for p in out))
