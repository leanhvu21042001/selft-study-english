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

Web App cũng lưu `progress.json` ở thư mục gốc để đồng bộ trạng thái từ đã thuộc. Trang chỉ tải danh sách ngày lúc mở; khi bấm một ngày, nó mới tải `lesson.json` và bản ghi của đúng folder ngày đó. Các file `.webm` sẽ được lưu vào folder `record` bên trong folder bài học ngày và được phân loại theo đoạn hội thoại/bài văn; nếu `record` chưa tồn tại, hệ thống sẽ tự tạo nó. Hệ thống không tự tạo folder bài học ngày. Sau khi thay đổi `apps_script_Code.gs`, cần tạo deployment mới hoặc cập nhật deployment hiện tại để API `bootstrap`, `lesson`, lưu tiến độ và danh sách bản ghi hoạt động.

Sau khi dừng ghi âm, web sẽ tự động upload lên Drive nếu đã kết nối Apps Script. Nếu upload lỗi, nút lưu thủ công vẫn còn để thử lại.
