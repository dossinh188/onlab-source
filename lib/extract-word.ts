import { Buffer } from 'node:buffer';
import WordExtractor from 'word-extractor';
import { MAX_TEXT_CHARACTERS } from './upload-limits';
import type { WordFormat } from './word-file';
import { validateDocArchive } from './validate-doc';

// Check expansion size before allowing the DOCX parser to inflate a ZIP.
export function validateDocxArchive(bytes:Buffer) {
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) {
    if(bytes.readUInt32LE(i)===0x06054b50 && i+22+bytes.readUInt16LE(i+20)===bytes.length) {end=i;break;}
  }
  if(end<0) throw Error('Tệp Word bị hỏng. Hãy mở trong Word và lưu lại thành .docx.');
  const count=bytes.readUInt16LE(end+10);
  const directorySize=bytes.readUInt32LE(end+12);
  let cursor=bytes.readUInt32LE(end+16),total=0;
  if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||count!==bytes.readUInt16LE(end+8)||count>4096||cursor+directorySize!==end) throw Error('Cấu trúc tệp Word không được hỗ trợ. Hãy xuất thành PDF.');
  for(let i=0;i<count;i++) {
    if(cursor+46>end||bytes.readUInt32LE(cursor)!==0x02014b50) throw Error('Tệp Word bị hỏng.');
    if(bytes.readUInt16LE(cursor+8)&1) throw Error('Hãy bỏ mật khẩu của tệp Word trước khi tải lên.');
    total+=bytes.readUInt32LE(cursor+24);
    if(total>32*1024*1024) throw Error('Nội dung Word sau giải nén quá lớn. Hãy chia nhỏ hoặc xuất thành PDF.');
    cursor+=46+bytes.readUInt16LE(cursor+28)+bytes.readUInt16LE(cursor+30)+bytes.readUInt16LE(cursor+32);
  }
  if(cursor!==end) throw Error('Tệp Word bị hỏng.');
}

export async function extractWordText(word:{format:WordFormat;data:string}) {
  const bytes=Buffer.from(word.data.slice(word.data.indexOf(',')+1),'base64');
  if(word.format==='docx') validateDocxArchive(bytes);
  else validateDocArchive(bytes);
  let text:string;
  try {
    const document=await new WordExtractor().extract(bytes);
    text=[document.getBody(),document.getFootnotes(),document.getEndnotes(),document.getTextboxes()].filter(Boolean).join('\n\n').trim();
  } catch { throw Error('Không đọc được tệp Word. Hãy bỏ mật khẩu, lưu lại thành .docx hoặc xuất thành PDF.'); }
  if(text.length>MAX_TEXT_CHARACTERS) throw Error('Văn bản trong Word vượt 1.000.000 ký tự. Hãy chia tài liệu thành các chương.');
  return text;
}
