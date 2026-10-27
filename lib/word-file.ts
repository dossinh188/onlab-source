export const WORD_MIME_TYPES={doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'} as const;
export type WordFormat=keyof typeof WORD_MIME_TYPES;

export function validateWordHeader(format:WordFormat,bytes:Uint8Array){
  const expected=format==='docx'?[0x50,0x4b,0x03,0x04]:[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1];
  if(!expected.every((value,index)=>bytes[index]===value))throw Error('Tệp Word không đúng định dạng. Hãy mở bằng Word và lưu lại thành .docx, hoặc xuất thành PDF.');
}

export function decodeFileData(data:string,mime:string,maxBytes:number){
  const prefix=`data:${mime};base64,`;
  if(!data.startsWith(prefix))throw Error('Định dạng tệp không hợp lệ.');
  const encoded=data.slice(prefix.length);
  // Validate in small checks before decoding; no regex over the whole file.
  if(!encoded.length||encoded.length%4!==0||/[^A-Za-z0-9+/=]/.test(encoded)||/=/.test(encoded.slice(0,-2))||!/^[A-Za-z0-9+/]{2}(?:[A-Za-z0-9+/]{2}|[A-Za-z0-9+/]=|==)$/.test(encoded.slice(-4)))throw Error('Dữ liệu tệp không hợp lệ.');
  const padding=encoded.endsWith('==')?2:encoded.endsWith('=')?1:0;
  if(encoded.length/4*3-padding>maxBytes)throw Error('Tệp vượt quá 5 MB. Vui lòng chọn tệp nhỏ hơn.');
  return Uint8Array.from(atob(encoded.slice(0,12)),c=>c.charCodeAt(0));
}
