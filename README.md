# Ônlab — Website ôn tập từ tài liệu

Website tiếng Việt gồm tóm tắt, thẻ ghi nhớ, trắc nghiệm có giải thích và hỏi đáp theo tài liệu, sử dụng Google Gemini.

## Chạy trên máy và kết nối Gemini

Dùng Node.js 24 trở lên và npm.

1. Chạy `npm ci`, rồi `npm run build`.
2. Chạy `npm run configure:ai`. Mở http://127.0.0.1:5174/ để xem hướng dẫn tạo khóa trong Google AI Studio và dán khóa vào ô được che. Khóa chỉ được lưu trong `.env` trên máy; không gửi vào cuộc trò chuyện.
3. Trong cửa sổ khác, chạy `npm run start:local`, rồi mở http://127.0.0.1:5173/.
4. Chọn tài liệu và tạo bộ ôn tập để kiểm tra khóa và hạn mức. Bản chạy trên máy tự đọc cấu hình Gemini mới, không cần khởi động lại sau khi lưu khóa.

Có thể cấu hình thủ công bằng cách sao chép `.env.example` thành `.env` và điền `GEMINI_API_KEY`. `GEMINI_MODEL` mặc định là `gemini-3.5-flash-lite`; chủ website có thể đổi sang mô hình hỗ trợ tài liệu PDF và JSON có cấu trúc, khả dụng với tài khoản. Không đặt khóa vào mã trình duyệt, biến có tiền tố `NEXT_PUBLIC_` hoặc Git.

Bài học mẫu dùng được không cần khóa. “Đã thiết lập Gemini” chỉ xác nhận có cấu hình, không xác nhận khóa hợp lệ hoặc còn hạn mức. AI thật chưa được xác minh khi chưa có khóa của người dùng.

## Tính năng và giới hạn

- PDF, Word `.docx`/`.doc`, TXT và MD: tối đa 5 MiB mỗi tệp, kiểm tra cả ở trình duyệt và máy chủ.
- Dán văn bản tối đa 50.000 ký tự; văn bản trong Word/TXT/MD tối đa 1.000.000 ký tự. Nội dung quá dài được báo lỗi, không âm thầm cắt bớt.
- Word được đọc trên máy chủ, rồi gửi phần văn bản sang Gemini. Hỗ trợ nội dung chính, chú thích chân trang/cuối tài liệu và hộp văn bản; không phân tích hình ảnh, biểu đồ, nhận xét hoặc thay đổi đã xóa. Xuất sang PDF nếu cần học từ hình ảnh.
- Kiểm tra cấu trúc Word trước khi đọc, gồm giới hạn giải nén DOCX 32 MiB và vòng lặp trong bảng phân bổ/thư mục DOC.
- PDF được gửi trực tiếp dạng nội dung đính kèm. Giới hạn trang, dung lượng ngữ cảnh và hạn mức của Gemini vẫn áp dụng; có thể cần chia tài liệu theo chương.
- Tóm tắt, thẻ ghi nhớ, trắc nghiệm và hỏi đáp dùng Gemini Interactions API. Câu trả lời có cấu trúc được kiểm tra trước khi hiển thị.
- Tài liệu, hội thoại và tiến độ chỉ giữ trong phiên trang hiện tại. Tải lại trang bắt đầu phiên mới.
- Ứng dụng gửi nội dung tới Google khi tạo bài hoặc hỏi đáp, với `store: false`; không dùng kho tệp hoặc File Search. Điều này không thay thế chính sách dữ liệu của Google. Với hạn mức miễn phí, Google có thể dùng dữ liệu để cải thiện sản phẩm.

## Kiểm tra

- `npx tsc --noEmit`
- `node scripts/test-gemini.mjs`: kiểm tra ngoại tuyến việc đọc DOC/DOCX thật, giới hạn dung lượng, PDF, tạo bài, hỏi đáp, lỗi Gemini, cùng bảo vệ khóa trong trang thiết lập. Phản hồi Gemini được mô phỏng, không tiêu thụ hạn mức AI.
- `npm run build`: tạo Cloudflare Worker trong `dist/server` và tài nguyên trong `dist/client`.

## Xuất bản với Sites

Tái sử dụng project_id trong `.openai/hosting.json`. Cấu hình `GEMINI_API_KEY` dưới dạng secret của Sites và xuất bản lại để bật AI trên bản trực tuyến. Khóa lưu qua trang thiết lập trên máy không tự chuyển lên Sites. Không xuất bản `.env`, thư mục `work`, hoặc dữ liệu phiên học.

## Tài liệu nhà cung cấp

- [Tạo khóa Gemini](https://aistudio.google.com/apikey)
- [Interactions API](https://ai.google.dev/api/interactions-api)
- [Mô hình Gemini](https://ai.google.dev/gemini-api/docs/models)
- [Hạn mức và giá](https://ai.google.dev/gemini-api/docs/pricing)
