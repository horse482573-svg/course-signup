# 早會全勤王計算（award id: z0h1q2w3e4r5t6y7）

1. `python3 -I 1_parse_raw.py <記錄原檔.xlsx>` → att.json（讀「記錄原檔」工作表：每 3 欄一天：日期/姓名/出席狀況）
2. `python3 -I 2_calc_weekly.py <同一份.xlsx>` → res.json（每週完全出席、週三加碼）

規則（使用者 10/30 確認）：
- 計分日每週一三五，週獎勵從 10/5 那週開始
- 算出席：出席、公假、放假日（國定假日、颱風假、連假）；不算：遲到、早退、沒報名
- 當週完全出席 → 咖啡券 1；週三實際「出席」→ 再 1（放假日不送）
- 單月全勤（10 月含 10/2）→ 星巴克禮券 2；10～12 月全勤 → 餐券 2
- 放假日：10/9 國定、10/23 颱風、10/26 連假；10/16 有 16 位公假（名單在 2_calc_weekly.py 的 GONG）
- 行政人員不記入：陳櫻燕、蘇宜君（EXCLUDE）

## 11/2 起的流程（含出席天數、星星）
1. `python3 -I 1_parse_raw.py <記錄原檔.xlsx>` → att.json
2. `python3 -I 3_build_award.py att.json division_map.json` → award.json（列出所有人，含 days；沒獎勵的 award 空白；依咖啡券張數排序）
3. 寫入 D1：rosters(course_id='z0h1q2w3e4r5t6y7') entries=award.json；courses.data 設 starDays＝湛翰揚的出席天數、starLabel＝「訓育主委」、asOf＝資料最後日期
- 出席天數＝實際「出席」＋公假（放假日不算天數）；星星：天數 ≥ 湛翰揚（含等於）
- 出席 0 天的人不列出；事業部「GO總公司」＝行政人員，不計入
