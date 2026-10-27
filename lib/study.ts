import { z } from 'zod';

export const studySchema = z.object({
  title: z.string().min(1).max(200), topic: z.string().max(80), summary: z.string().min(1).max(4000),
  concepts: z.array(z.object({ title:z.string(), explanation:z.string(), source:z.string() })).min(1).max(8),
  cards: z.array(z.object({ question:z.string(), answer:z.string(), source:z.string() })).min(1).max(12),
  quiz: z.array(z.object({ question:z.string(), options:z.array(z.string()).length(4), correct:z.number().int().min(0).max(3), explanation:z.string(), source:z.string() })).min(1).max(10)
});
export type Study = z.infer<typeof studySchema>;
export type Source = { name:string; text:string; pdf?:string; word?:{format:'doc'|'docx';data:string}; file?:File };
const str = { type:'string' };
const obj = (properties:Record<string,unknown>) => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const arr = (items:unknown) => ({type:'array',items});
export const studyJsonSchema = obj({title:str,topic:str,summary:str,
  concepts:arr(obj({title:str,explanation:str,source:str})),
  cards:arr(obj({question:str,answer:str,source:str})),
  quiz:arr(obj({question:str,options:arr(str),correct:{type:'integer'},explanation:str,source:str}))});

export const sampleSource:Source = {name:'Cơ sở của trí nhớ — Bài học mẫu',text:`CƠ SỞ CỦA TRÍ NHỚ & CÁCH HỌC HIỆU QUẢ
Tài liệu mẫu do Ônlab biên soạn để trải nghiệm các tính năng.

Phần 1 · Quá trình ghi nhớ
Trí nhớ gồm ba quá trình: mã hóa, lưu trữ và truy hồi. Mã hóa là chuyển thông tin tiếp nhận thành dạng có thể ghi nhớ. Lưu trữ là duy trì thông tin theo thời gian. Truy hồi là lấy lại thông tin đã lưu khi cần dùng. Hiểu ý nghĩa và liên kết kiến thức mới với kiến thức sẵn có hỗ trợ việc ghi nhớ.

Phần 2 · Gợi nhớ chủ động
Gợi nhớ chủ động (active recall) là tự cố gắng nhớ lại kiến thức mà không nhìn tài liệu. Ví dụ: sau khi đọc một đoạn, đóng sách rồi tự giải thích ý chính bằng lời của mình. Sau đó mở tài liệu để đối chiếu và sửa những phần còn thiếu. Cách này giúp nhận ra lỗ hổng kiến thức. Chỉ đọc lại và thấy nội dung quen thuộc không đồng nghĩa với khả năng tự nhớ lại.

Phần 3 · Ôn tập ngắt quãng
Ôn tập ngắt quãng (spaced repetition) là phân bố các lần ôn theo thời gian thay vì dồn vào một buổi. Có thể bắt đầu ôn sau một ngày, vài ngày và một tuần rồi điều chỉnh tùy mức độ ghi nhớ. Kiến thức khó nhớ cần được ôn sớm hơn. Lịch ôn không cố định cho mọi người.

Phần 4 · Kết hợp hai phương pháp
Gợi nhớ chủ động trả lời câu hỏi “Ôn bằng cách nào?”, còn ôn tập ngắt quãng trả lời “Ôn vào lúc nào?”. Có thể kết hợp: tự trả lời thẻ ghi nhớ, kiểm tra đáp án, đánh dấu phần chưa nhớ và quay lại ôn vào buổi sau. Nghỉ ngơi và ngủ đầy đủ cũng hỗ trợ việc học. Học hiệu quả cần luyện tập đều đặn, không chỉ đọc lại tài liệu.`};
export const sampleStudy:Study = {
  title:'Cơ sở của trí nhớ & cách học hiệu quả',topic:'Kỹ năng học tập',
  summary:'Học hiệu quả không nằm ở việc đọc đi đọc lại, mà ở việc chủ động gợi nhớ và ôn tập đúng lúc. Tự kiểm tra giúp bạn nhận ra điều chưa hiểu; phân bố các lần ôn giúp củng cố kiến thức theo thời gian.',
  concepts:[
    {title:'Trí nhớ hoạt động như thế nào?',explanation:'Thông tin đi qua ba quá trình: mã hóa, lưu trữ và truy hồi. Hiểu ý nghĩa và liên kết kiến thức mới giúp việc ghi nhớ bền vững hơn.',source:'Phần 1 · Quá trình ghi nhớ'},
    {title:'Chủ động gợi nhớ (Active recall)',explanation:'Đóng tài liệu và tự trả lời câu hỏi. Việc cố gắng nhớ lại giúp bạn nhận ra lỗ hổng kiến thức và củng cố điều đã học.',source:'Phần 2 · Gợi nhớ chủ động'},
    {title:'Ôn ít hơn mỗi lần, nhưng đều đặn hơn',explanation:'Chia việc ôn tập thành nhiều buổi. Quay lại sớm hơn với kiến thức khó nhớ và giãn khoảng cách khi bạn đã nhớ tốt hơn.',source:'Phần 3 · Ôn tập ngắt quãng'},
    {title:'Kết hợp cách học và thời điểm học',explanation:'Dùng thẻ ghi nhớ để tự kiểm tra, rồi ôn lại sau một khoảng thời gian. Kiểm tra đáp án và sửa sai là một phần của quá trình học.',source:'Phần 4 · Kết hợp hai phương pháp'}],
  cards:[
    {question:'Ba quá trình chính của trí nhớ là gì?',answer:'Mã hóa → lưu trữ → truy hồi. Đây là quá trình tiếp nhận, duy trì và lấy lại thông tin.',source:'Phần 1'},
    {question:'Gợi nhớ chủ động là gì?',answer:'Tự cố gắng nhớ lại kiến thức mà không nhìn tài liệu, sau đó đối chiếu và sửa những phần còn thiếu.',source:'Phần 2'},
    {question:'Vì sao đọc thấy quen chưa chắc đã nhớ?',answer:'Nhận ra nội dung khi đọc khác với tự truy hồi thông tin khi không có tài liệu trước mắt.',source:'Phần 2'},
    {question:'Ôn tập ngắt quãng khác học dồn ở điểm nào?',answer:'Ôn tập ngắt quãng phân bố các lần ôn theo thời gian; học dồn tập trung vào một buổi.',source:'Phần 3'},
    {question:'Làm thế nào kết hợp hai phương pháp?',answer:'Tự trả lời thẻ ghi nhớ, kiểm tra đáp án, đánh dấu phần chưa nhớ và quay lại ôn trong những buổi tiếp theo.',source:'Phần 4'}],
  quiz:[
    {question:'Thao tác nào là gợi nhớ chủ động?',options:['Đọc lại một đoạn nhiều lần','Đóng sách và tự giải thích ý chính','Tô màu tất cả các dòng','Chép nguyên văn tài liệu'],correct:1,explanation:'Tự giải thích khi không nhìn sách buộc bạn truy hồi kiến thức. Sau đó cần đối chiếu để sửa sai.',source:'Phần 2'},
    {question:'Truy hồi là quá trình nào?',options:['Lấy lại thông tin đã lưu','Ngủ sau khi học','Tiếp nhận âm thanh','Sao chép một bài học'],correct:0,explanation:'Truy hồi là lấy lại thông tin đã lưu khi bạn cần sử dụng.',source:'Phần 1'},
    {question:'Nếu thường quên một khái niệm, bạn nên làm gì?',options:['Bỏ qua khái niệm đó','Chờ một tháng rồi ôn','Chỉ đọc thêm bài mới','Ôn lại sớm hơn và kiểm tra cách hiểu'],correct:3,explanation:'Khoảng cách ôn cần điều chỉnh theo mức độ ghi nhớ; nội dung khó nhớ nên được ôn sớm hơn.',source:'Phần 3'},
    {question:'Ôn tập ngắt quãng chủ yếu trả lời câu hỏi nào?',options:['Dùng màu gì để ghi chú?','Học ở đâu?','Ôn vào lúc nào?','Viết dài bao nhiêu?'],correct:2,explanation:'Gợi nhớ chủ động nói về cách ôn; ôn tập ngắt quãng nói về thời điểm và phân bố các lần ôn.',source:'Phần 4'},
    {question:'Sau khi trả lời sai một thẻ ghi nhớ, bước phù hợp là gì?',options:['Đánh dấu là đã thuộc','Kiểm tra đáp án, sửa sai và ôn lại','Chỉ xem điểm số','Xóa thẻ khỏi bộ học'],correct:1,explanation:'Đối chiếu, sửa sai và quay lại phần chưa nhớ giúp bạn học từ lỗi của mình.',source:'Phần 4'}]
};
