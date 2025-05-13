# 🤖 Stobix Auto Bot

Bot tự động cho nền tảng Stobix, hỗ trợ giới thiệu, thực hiện nhiệm vụ và khai thác.

## ✨ Tính năng

- 🔄 **Tự động giới thiệu**: Tạo ví mới, hoàn thành quy trình giới thiệu và lưu private key vào `refwallet.txt`.
- ✅ **Tự động nhiệm vụ (Chỉ khai thác)**: Bắt đầu khai thác cho tất cả ví trong file `key.txt`.
- ⛏️ **Khai thác qua giới thiệu**: Bắt đầu khai thác cho tất cả ví đã tạo qua giới thiệu (từ `refwallet.txt`).
- 💼 **Hỗ trợ nhiều ví**: Hỗ trợ nhiều ví từ cả `key.txt` và `refwallet.txt`.
- 🌐 **Hỗ trợ Proxy**: Tùy chọn sử dụng proxy để tăng độ ổn định.

## 📋 Yêu cầu

- Node.js (v16 trở lên)
- npm

## 🛠️ Cài đặt

1. **Clone repository:**
   ```bash
   git clone <link-repo-cua-ban>
   cd Stobix-Auto
   ```

2. **Cài đặt các thư viện phụ thuộc:**
   ```bash
   npm install
   ```

3. **Thiết lập các file cấu hình:**
   - Tạo file `code.txt` với mã giới thiệu của bạn (1 dòng, không có khoảng trắng):
     ```
     mã_giới_thiệu_của_bạn
     ```
   - Tạo file `key.txt` với mỗi dòng là một private key:
     ```
     private_key_1
     private_key_2
     ...
     ```
   - (Tùy chọn) Tạo file `proxies.txt` để sử dụng proxy (mỗi dòng 1 proxy, dạng `ip:port` hoặc `http://ip:port`):
     ```
     proxy1:port
     proxy2:port
     ```

## 🚀 Sử dụng

Chạy bot:
```bash
node index.js
```

### Menu chức năng

1. **Tự động nhiệm vụ (Chỉ khai thác):**  
   Bắt đầu khai thác cho tất cả ví trong file `key.txt`.

2. **Tự động giới thiệu (Tạo ví mới):**  
   Tạo ví mới, hoàn thành nhiệm vụ giới thiệu và lưu vào `refwallet.txt`.

3. **Khai thác ví giới thiệu:**  
   Bắt đầu khai thác cho tất cả ví đã lưu trong `refwallet.txt`.

4. **Thoát:**  
   Thoát bot.

## 📁 Cấu trúc file

- `index.js` – Mã nguồn chính của bot
- `code.txt` – Mã giới thiệu
- `key.txt` – Danh sách private key để khai thác
- `proxies.txt` – (Tùy chọn) Danh sách proxy
- `refwallet.txt` – Lưu trữ các ví giới thiệu đã tạo

## ⚠️ Lưu ý quan trọng

- **Không bao giờ chia sẻ private key của bạn.**
- Luôn giữ các file `key.txt`, `refwallet.txt` và `code.txt` an toàn, không chia sẻ công khai.
- Sử dụng proxy để tăng độ ổn định và bảo mật.

## 🔒 Bảo mật

- Các file nhạy cảm đã được thêm vào `.gitignore` để tránh bị đẩy lên git.
- Dữ liệu nhạy cảm không bị ghi log hoặc lộ ra ngoài.

## 📝 Giấy phép

Dự án này được cấp phép theo MIT License.

---

