# Học Tiếng Anh 1 Năm — GitHub Pages + Google Drive

## 1. Đưa web lên GitHub Pages (miễn phí)
1. Tạo một repository mới trên GitHub (ví dụ: `english-1-year`).
2. Tải lên 2 file `index.html` và `lessons.json` vào thư mục gốc của repository.
3. Vào **Settings -> Pages**, chọn **Source: Deploy from a branch**, nhánh `main` (`/root`) rồi bấm **Save**.
4. Mở URL dạng `https://<ten-github>.github.io/english-1-year/` để học, nghe phát âm, thu âm và làm bài tập.

## 2. Kết nối tự động với Google Drive (tùy chọn)
1. Mở [script.google.com](https://script.google.com/), tạo project mới và dán toàn bộ nội dung file `apps_script_Code.gs`.
2. Chọn **Deploy -> New deployment -> Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
3. Sao chép URL Web App vừa tạo, mở trang web GitHub Pages của bạn, vào tab **Kết nối Drive** và dán URL đó vào rồi bấm **Lưu kết nối**.
4. Từ đó, web sẽ tự động nạp các ngày học mới từ Google Drive và nút **Lưu lên Google Drive** trong tab Ghi âm sẽ đẩy file `.webm` vào đúng thư mục `Ngay XX`.

Web App yêu cầu mỗi người học đăng nhập bằng email và mã khóa cá nhân. Lần đăng nhập đầu tiên sẽ tạo hồ sơ; hệ thống giới hạn tối đa 1000 hồ sơ. Tiến độ, nhật ký thao tác và bản ghi âm được tách theo từng email trong thư mục `users`. Nếu nhập sai mã, người học có thể yêu cầu gửi email cập nhật mã. Khi mã mới được cập nhật, toàn bộ phiên cũ bị thu hồi; các trang khác sẽ phát hiện token không còn hợp lệ, xóa dữ liệu trong trình duyệt và yêu cầu đăng nhập lại. Apps Script cần được cấp quyền gửi email (`MailApp`) khi triển khai lần đầu.

Trang chỉ tải danh sách ngày lúc mở; khi bấm một ngày, nó mới tải `lesson.json` và bản ghi của đúng người học. Các file `.webm` được lưu trong thư mục riêng của người học và được phân loại theo đoạn hội thoại/bài văn; nếu thư mục chưa tồn tại, hệ thống sẽ tự tạo nó. Hệ thống không tự tạo folder bài học ngày. Sau khi thay đổi `apps_script_Code.gs`, cần tạo deployment mới hoặc cập nhật deployment hiện tại để API xác thực, `bootstrap`, `lesson`, lưu tiến độ và danh sách bản ghi hoạt động.
API `lesson` cũng tìm file `.doc` hoặc `.docx` trong folder bài học và hiển thị nút mở file trên trang học nếu tìm thấy.

Mã giao diện được tách trong thư mục `public`: `public/styles` chứa CSS của trang học và trang quản lý; `public/scripts/config.js` chứa cấu hình dùng chung, `utils.js` chứa các tiện ích dùng chung, `progress.js` xử lý tiến độ/thống kê/đồng bộ Drive, `app.js` xử lý trang học và `dashboard.js` xử lý trang quản lý. Danh sách bài chưa học trên trang quản lý có nút `Học ngay` để mở đúng bài trong trang học.

Sau khi dừng ghi âm, web sẽ tự động upload lên Drive nếu đã kết nối Apps Script. Nếu upload lỗi, nút lưu thủ công vẫn còn để thử lại.
