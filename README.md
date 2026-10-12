# 公司課程報名

公開的課程報名網站：Cloudflare Pages（網頁）＋ Pages Functions（`/api`）＋ D1 資料庫 `course-signup`。

- `public/` 網頁（index.html、app.js）
- `functions/api/[[path]].js` 後端 API
- `schema.sql` 資料表（已在 D1 建好）
- `wrangler.toml` 綁定 D1（變數名稱 `DB`）

## 一次性設定
1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → 選 `course-signup`
2. Build command 留空，Build output directory 填 `public`
3. 部署後到專案 Settings → Variables and Secrets，新增 Secret：`ADMIN_PASSWORD` = 你的管理密碼，然後重新部署
4. 網址加 `#admin` 可直接開啟舉辦人登入
