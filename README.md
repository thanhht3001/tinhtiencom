# TinhTienCom — Web kê khai chi tiêu chung

Form web React (Vite), host trên GitHub Pages qua GitHub Actions, gửi dữ liệu vào Google Sheet thông qua Google Apps Script.

## Cấu trúc dữ liệu

Google Sheet gồm các sheet:

- **DanhMucThanhVien** — cột A: `Tên thành viên` (dòng 1 là header)
- **DanhMucNoiDung** — cột A: `Nội dung chi` (dòng 1 là header) — danh sách gợi ý cho ô "Chi cái gì" trên form (không bắt buộc phải có; nếu không có sheet này, ô vẫn nhập tự do được, chỉ là không có gợi ý)
- **ChiTieu** — mỗi khoản chi 1 dòng: `ID | Ngày chi | Nội dung | Số tiền chi | Người chi | Phương thức chia | Thời gian nhập`
- **ChiTietChia** — mỗi người tham gia 1 dòng: `ID | Ngày chi | Người tham gia | Số tiền phải trả`

`ID` dùng để nối 1 khoản chi trong `ChiTieu` với các dòng chia tiền tương ứng trong `ChiTietChia`.

Cách thống kê sau này:
- Số tiền một người **đã chi** trong tháng: `SUMIFS` trên sheet `ChiTieu`, điều kiện `Người chi = tên` và tháng của `Ngày chi`.
- Số tiền một người **phải thanh toán** trong tháng: `SUMIFS` trên sheet `ChiTietChia`, điều kiện `Người tham gia = tên` và tháng của `Ngày chi`.
- Số dư = đã chi − phải thanh toán.

## Bước 1 — Tạo Google Sheet

1. Vào https://sheets.google.com → tạo spreadsheet mới, đặt tên (VD: "TinhTienCom - Dữ liệu").
2. Tạo 4 sheet (tab) với tên **chính xác**: `DanhMucThanhVien`, `DanhMucNoiDung`, `ChiTieu`, `ChiTietChia`.
3. Ở sheet `DanhMucThanhVien`, dòng 1 gõ header `Tên thành viên`, các dòng dưới điền tên từng thành viên.
4. Ở sheet `DanhMucNoiDung`, dòng 1 gõ header `Nội dung chi`, các dòng dưới điền các khoản chi hay gặp (VD: Ăn uống, Xăng xe, Điện nước...).
5. Ở sheet `ChiTieu`, dòng 1 gõ header: `ID`, `Ngày chi`, `Nội dung`, `Số tiền chi`, `Người chi`, `Phương thức chia`, `Thời gian nhập`.
6. Ở sheet `ChiTietChia`, dòng 1 gõ header: `ID`, `Ngày chi`, `Người tham gia`, `Số tiền phải trả`.

## Bước 2 — Gắn Apps Script

1. Trong Google Sheet vừa tạo: menu **Tiện ích mở rộng (Extensions) → Apps Script**.
2. Xoá code mẫu, dán toàn bộ nội dung file [`apps-script/Code.gs`](apps-script/Code.gs) trong repo này vào.
3. Bấm biểu tượng **Lưu** (Ctrl+S).
4. Bấm **Triển khai (Deploy) → Triển khai mới (New deployment)**.
5. Chọn loại **Ứng dụng web (Web app)**.
6. Cấu hình:
   - **Execute as**: Me (email của bạn)
   - **Who has access**: Anyone (để form public gọi được, không cần đăng nhập Google)
7. Bấm **Deploy**. Lần đầu Google sẽ yêu cầu bạn cấp quyền (Authorize access) — chọn tài khoản Google của bạn, bấm "Advanced" → "Go to ... (unsafe)" nếu thấy cảnh báo (bình thường vì đây là script của chính bạn), rồi Allow.
8. Sau khi deploy xong, copy **Web app URL** (dạng `https://script.google.com/macros/s/XXXXXXXX/exec`).

> Nếu sau này bạn sửa code trong Apps Script, phải bấm **Deploy → Manage deployments → sửa (Edit) → New version → Deploy** thì thay đổi mới có hiệu lực trên URL cũ.

## Bước 3 — Gắn URL vào web

Mở file [`src/config.js`](src/config.js), sửa:

```js
export const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
```

Thay bằng URL vừa copy ở Bước 2.

## Bước 4 — Chạy thử local

```bash
npm install
npm run dev
```

Mở URL hiện ra (thường là `http://localhost:5173`). Kiểm tra: danh sách người chi / tham gia có load lên không, gửi thử 1 khoản chi rồi xem dữ liệu có xuất hiện trong Google Sheet không.

## Bước 5 — Đưa lên GitHub Pages

Repo đã có sẵn workflow [`​.github/workflows/deploy.yml`](.github/workflows/deploy.yml): mỗi lần push lên nhánh `main`, GitHub Actions tự `npm run build` rồi deploy thư mục `dist/` lên GitHub Pages.

```bash
git add -A
git commit -m "Update"
git push
```

Trên GitHub: **Settings → Pages → Source: GitHub Actions** (chỉ cần set 1 lần). Theo dõi tiến trình build ở tab **Actions**. Domain tuỳ chỉnh được cấu hình qua file `public/CNAME` (được build vào `dist/CNAME`).

## Lưu ý bảo mật

- URL Apps Script Web App nằm public trong bundle JS (vì host tĩnh trên GitHub Pages) — ai có URL đều có thể gọi và ghi dữ liệu vào Sheet. Chỉ chia sẻ link web trong nhóm tin cậy.
- Không thêm dữ liệu nhạy cảm vào Sheet nếu repo/URL có thể bị lộ.
