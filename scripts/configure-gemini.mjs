import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const page=(token,message='',success=false)=>`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kết nối Gemini · Ônlab</title><style>body{font:17px/1.65 system-ui,sans-serif;color:#243325;background:#f5f6f0;margin:0;padding:32px 20px}main{max-width:550px;margin:5vh auto;background:white;padding:32px;border-radius:22px;border:1px solid #dce1d4}h1{font-size:28px;margin:6px 0 14px}p{color:#566151}label{display:block;font-weight:650}input,button{box-sizing:border-box;width:100%;font:inherit;border-radius:10px;padding:14px;margin:10px 0;border:1px solid #a8b59a}button{background:#30462e;color:white;font-weight:650;cursor:pointer}a{color:#3e6236}small{display:block;color:#697362}aside{padding:14px;border-radius:10px;background:${success?'#eaf3e5':'#fff0ed'}}.brand{font-weight:750;color:#536843}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #81914e;outline-offset:3px}</style><main><span class="brand">Ônlab / Thiết lập AI</span><h1>Kết nối Gemini</h1>${message?`<aside role="status">${message}</aside>`:''}<p>1. Mở <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>, đăng nhập và chọn <strong>Create API key</strong> (Tạo khóa API).</p><p>2. Sao chép khóa và dán vào ô bên dưới. Không gửi khóa vào cuộc trò chuyện.</p><form method="post" action="/save" autocomplete="off"><input type="hidden" name="token" value="${token}"><label for="apiKey">Khóa Gemini API</label><input id="apiKey" name="apiKey" type="password" required minlength="20" maxlength="512" autocomplete="new-password" spellcheck="false" placeholder="Dán khóa Gemini của bạn"><button type="submit">Lưu khóa cho Ônlab trên máy này</button></form><small>Khóa được lưu trong tệp .env của website trên máy này. Không đưa vào mã công khai, trình duyệt hoặc tệp tải về. Lưu khóa chưa xác nhận hạn mức của tài khoản.</small><p>3. <a href="http://127.0.0.1:5173/" target="_blank" rel="noopener noreferrer">Trở lại Ônlab</a> và tạo một bộ ôn tập để thử.</p><small>Thiết lập này chỉ áp dụng trên máy bạn. Gemini có hạn mức tùy tài khoản; Google có thể dùng dữ liệu gửi qua hạn mức miễn phí để cải thiện sản phẩm.</small></main></html>`;

export function createSetupServer({root=projectRoot,port=5174}={}) {
  const token=randomBytes(32).toString('hex');
  const server=http.createServer(async(req,res)=>{
    const address=server.address();
    const expectedHost=`127.0.0.1:${typeof address==='object'?address.port:port}`;
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    const reply=(status,message,success=false)=>{res.statusCode=status;res.end(page(token,message,success));};
    if(req.headers.host!==expectedHost) {res.writeHead(403);res.end();return;}
    if(req.method==='GET'&&req.url==='/') {res.end(page(token));return;}
    if(req.method!=='POST'||req.url!=='/save') {res.writeHead(404);res.end();return;}
    if(req.headers.origin!==`http://${expectedHost}`||!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) {reply(403,'Yêu cầu không hợp lệ. Hãy mở lại trang thiết lập.');return;}
    try {
      let size=0; const chunks=[];
      for await(const chunk of req) {size+=chunk.length;if(size>4096){reply(413,'Dữ liệu quá dài.');return;}chunks.push(chunk);}
      const form=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      const provided=Buffer.from(form.get('token')||'');
      const expected=Buffer.from(token);
      if(provided.length!==expected.length||!timingSafeEqual(provided,expected)) {reply(403,'Phiên thiết lập đã thay đổi. Hãy tải lại trang.');return;}
      const apiKey=(form.get('apiKey')||'').trim();
      if(!/^[A-Za-z0-9_.-]{20,512}$/.test(apiKey)) {reply(400,'Khóa không đúng định dạng. Hãy sao chép lại khóa từ Google AI Studio.');return;}
      const envFile=path.join(root,'.env');
      const tempFile=path.join(root,'.env.gemini-tmp');
      for(const file of [envFile,tempFile]) if(fs.existsSync(file)&&!fs.lstatSync(file).isFile()) throw Error('Unsupported file');
      let content=fs.existsSync(envFile)?fs.readFileSync(envFile,'utf8'):'';
      content=content.split(/\r?\n/).filter(line=>!/^\s*(?:export\s+)?GEMINI_API_KEY\s*=/.test(line)).join('\n').trimEnd();
      fs.writeFileSync(tempFile,content+'\nGEMINI_API_KEY='+apiKey+'\n',{mode:0o600,flag:'w'});
      fs.renameSync(tempFile,envFile);
      reply(200,'Đã lưu khóa. Trở lại Ônlab và chọn “Tạo bộ ôn tập” để bắt đầu.',true);
    } catch {reply(500,'Chưa lưu được khóa. Hãy kiểm tra quyền ghi của thư mục website rồi thử lại.');}
  });
  server.requestTimeout=15000;
  return server;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  createSetupServer().listen(5174,'127.0.0.1',()=>console.log('Thiết lập Gemini: http://127.0.0.1:5174/'));
}
