# 國泰整批付款轉檔測試說明（`/api/bank-convert`）

## 功能摘要

- **輸入**：`multipart/form-data`，欄位名 `file`
  - **`.xlsx` / `.xls`**：Commeet「付款資料」工作表（表頭需含必要欄位）；僅 **`付款方式` = `匯款`** 的列會輸出
- **輸出**：`text/plain; charset=big5` 之下載檔（固定寬度每行 361 bytes，行尾 CRLF）

## 網頁測試

1. 啟動開發伺服器：

   ```bash
   yarn dev
   ```

2. 瀏覽器開啟財務頁（例如 `http://localhost:3000/finance`，依專案路由而定），找到 **網銀付款轉檔** 區塊。
3. 選擇或拖放 **`.xlsx` 或 `.xls`**，按 **轉換檔案**。
4. 預期：瀏覽器下載 `commeet整批付款_MMDDHHmm.txt`（檔名以伺服器產生為準）。
5. 失敗時：前端 Toast 顯示錯誤；後端若為檔案類型不符或 Excel 欄位缺漏，應回傳 **400** 與中文錯誤訊息。

## 終端機測試（curl）

在專案根目錄、dev 伺服器跑在 `http://localhost:3000` 時：

```bash
# Excel 範例（請換成你的檔案路徑）
curl -sS -X POST "http://localhost:3000/api/bank-convert" \
  -F "file=@/path/to/Payment_20260101-20260326.xlsx" \
  -o /tmp/bank-out.txt

# 檢查輸出非空、且每行長度（需安裝 gawk 或自行用 wc）
gawk '{ print length($0) }' RS='\r\n' /tmp/bank-out.txt | head
```

預期：HTTP 200、`/tmp/bank-out.txt` 為二進位 Big5 文字檔（不要當 UTF-8 開啟驗證內容）；每筆匯款一列、行尾為 `\r\n`。

## Excel 測試資料注意事項

- 表頭第一列須包含：`表單編號`、`付款對象名稱`、`銀行代碼`、`帳戶號碼`、`付款金額（本幣）`、`付款方式`。
- **僅匯款**列會轉出；`現金`、`卡片` 等會略過。
- `帳戶號碼` 若為 Excel **數字**儲存格，前導零可能無法還原；建議會計匯出時維持文字格式或與實務帳號長度一致。
- 手續費 13/15：依 **`付款對象名稱`** 與 `HandlingFeeService` 特例名單比對（與 Commeet txt 最後 6 碼無關）。
