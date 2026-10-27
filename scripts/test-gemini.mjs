// Offline integration tests: provider responses are mocked; no real key is read.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { createSetupServer } from './configure-gemini.mjs';
const directory=path.resolve('work/gemini-check');fs.mkdirSync(directory,{recursive:true});
for(const [source,destination] of [['lib/upload-limits.ts','upload-limits'],['lib/word-file.ts','word-file'],['lib/validate-doc.ts','validate-doc'],['lib/extract-word.ts','extract-word'],['lib/study.ts','study'],['app/api/study/route.ts','study-route']]) {
  const code=fs.readFileSync(source,'utf8').replace("import { env } from 'cloudflare:workers';",'const env = {};').replaceAll(/from ['"](?:@\/lib\/|\.\/)(upload-limits|word-file|validate-doc|extract-word|study)['"]/g,"from './$1.mjs'");
  fs.writeFileSync(path.join(directory,destination+'.mjs'),ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
}
const {GET,POST}=await import('../work/gemini-check/study-route.mjs');
const {MAX_FILE_BYTES,validateFileSize}=await import('../work/gemini-check/upload-limits.mjs');
const {WORD_MIME_TYPES}=await import('../work/gemini-check/word-file.mjs');
const {extractWordText,validateDocxArchive}=await import('../work/gemini-check/extract-word.mjs');
const {validateDocArchive}=await import('../work/gemini-check/validate-doc.mjs');
const {sampleStudy,sampleSource}=await import('../work/gemini-check/study.mjs');
const realFetch=globalThis.fetch,previousKey=process.env.GEMINI_API_KEY;
const request=(body,origin='https://onlab.test')=>new Request('https://onlab.test/api/study',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
const generate={action:'generate',source:sampleSource};
const success=(text=JSON.stringify(sampleStudy))=>Response.json({status:'completed',steps:[{type:'thought',content:[{type:'text',text:'not for user'}]},{type:'model_output',content:[{type:'text',text}]}]});
const word=(format,bytes=fs.readFileSync(new URL(`./fixtures/test01.${format}`,import.meta.url)))=>({format,data:`data:${WORD_MIME_TYPES[format]};base64,${bytes.toString('base64')}`});
let count=0;const test=async(name,callback)=>{await callback();count++;console.log('PASS '+name);};
try {
  delete process.env.GEMINI_API_KEY;
  globalThis.fetch=()=>{throw Error('Unexpected request');};
  await test('missing key is clear and private',async()=>{assert.deepEqual(await(await GET()).json(),{configured:false,provider:'gemini'});assert.equal((await POST(request(generate))).status,503);});
  process.env.GEMINI_API_KEY='offline-test-only';
  let calls=[];
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/interactions');assert.equal(options.headers['x-goog-api-key'],'offline-test-only');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.model,'gemini-3.5-flash-lite');assert.ok(body.system_instruction);calls.push(body);return success();};
  await test('structured study output',async()=>{const response=await POST(request(generate));assert.equal(response.status,200);assert.deepEqual((await response.json()).study,sampleStudy);assert.equal(calls.at(-1).response_format.mime_type,'application/json');});
  await test('PDF sent as inline base64',async()=>{const bytes=Buffer.from('%PDF-1.7 test transport');const response=await POST(request({action:'generate',source:{name:'lesson.pdf',text:'',pdf:`data:application/pdf;base64,${bytes.toString('base64')}`}}));assert.equal(response.status,200);assert.deepEqual(calls.at(-1).input[1],{type:'document',mime_type:'application/pdf',data:bytes.toString('base64')});});
  let extracted=[];
  for(const format of ['doc','docx']) {
    await test(`real ${format} extraction and text-only provider input`,async()=>{
      const text=await extractWordText(word(format));assert.ok(text.includes('Unicode characters'));assert.ok(text.length>80);extracted.push(text);
      const response=await POST(request({action:'generate',source:{name:'lesson.'+format,text:'',word:word(format)}}));assert.equal(response.status,200);assert.equal(JSON.parse(calls.at(-1).input[0].text).sourceText,text);assert.ok(calls.at(-1).input.every(c=>c.type==='text'));
    });
  }
  await test('DOC and DOCX agree',()=>assert.equal(extracted[0],extracted[1]));
  await test('file size exactly 5 MiB accepted',()=>{assert.doesNotThrow(()=>validateFileSize(MAX_FILE_BYTES));assert.throws(()=>validateFileSize(MAX_FILE_BYTES+1));assert.throws(()=>validateFileSize(0));});
  await test('oversized encoded PDF rejected before provider',async()=>{const bytes=Buffer.alloc(MAX_FILE_BYTES+1);bytes.write('%PDF-1.7');const before=calls.length;assert.equal((await POST(request({action:'generate',source:{name:'too-big.pdf',text:'',pdf:'data:application/pdf;base64,'+bytes.toString('base64')}}))).status,400);assert.equal(calls.length,before);});
  await test('cross-origin request rejected',async()=>assert.equal((await POST(request(generate,'https://other.test'))).status,403));
  await test('invalid and conflicting files rejected',async()=>{assert.equal((await POST(request({action:'generate',source:{name:'bad.docx',text:'',word:word('docx',Buffer.from('bad'))}}))).status,400);assert.equal((await POST(request({action:'generate',source:{name:'mixed',text:'',word:word('doc'),pdf:'invalid'}}))).status,400);});
  await test('empty text and missing chat question rejected',async()=>{assert.equal((await POST(request({action:'generate',source:{name:'short',text:'hello'}}))).status,400);assert.equal((await POST(request({action:'chat',source:sampleSource}))).status,400);});
  await test('text longer than former 50k limit supported',async()=>{assert.equal((await POST(request({action:'generate',source:{name:'long.txt',text:'a'.repeat(60000)}}))).status,200);assert.equal(JSON.parse(calls.at(-1).input[0].text).sourceText.length,60000);});
  await test('DOCX expansion budget',()=>{const bytes=fs.readFileSync(new URL('./fixtures/test01.docx',import.meta.url));const signature=Buffer.from([0x50,0x4b,0x01,0x02]);const at=bytes.indexOf(signature);assert.ok(at>0);bytes.writeUInt32LE(40*1024*1024,at+24);assert.throws(()=>validateDocxArchive(bytes));});
  await test('DOC cyclic allocation rejected',()=>{const bytes=fs.readFileSync(new URL('./fixtures/test01.doc',import.meta.url));const sectorSize=2**bytes.readUInt16LE(30),fatAt=(bytes.readInt32LE(76)+1)*sectorSize;bytes.writeInt32LE(1,fatAt);bytes.writeInt32LE(0,fatAt+4);assert.throws(()=>validateDocArchive(bytes));});
  await test('chat history sent and only model text returned',async()=>{globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);assert.equal(body.response_format,undefined);assert.equal(JSON.parse(body.input[0].text).conversation[0].text,'Câu hỏi trước');return success('Đáp án theo tài liệu.');};const response=await POST(request({action:'chat',source:sampleSource,question:'Giải thích?',history:[{role:'user',text:'Câu hỏi trước'}]}));assert.deepEqual(await response.json(),{answer:'Đáp án theo tài liệu.'});});
  for(const [status,code] of [[429,'AI_RATE_LIMIT'],[403,'AI_AUTH_ERROR'],[404,'AI_MODEL_ERROR']])await test(`Gemini ${status} error mapping`,async()=>{globalThis.fetch=async()=>Response.json({error:{status:'FAILED'}},{status});const result=await(await POST(request(generate))).json();assert.equal(result.code,code);assert.ok(!JSON.stringify(result).includes('offline-test-only'));});
  await test('invalid key reported for Google 400',async()=>{globalThis.fetch=async()=>Response.json({error:{details:[{reason:'API_KEY_INVALID'}]}},{status:400});assert.equal((await(await POST(request(generate))).json()).code,'AI_AUTH_ERROR');});
  await test('malformed model JSON is upstream error',async()=>{globalThis.fetch=async()=>success('not JSON');assert.equal((await POST(request(generate))).status,502);});
  await test('incomplete response rejected',async()=>{globalThis.fetch=async()=>Response.json({status:'incomplete',steps:[]});assert.equal((await POST(request(generate))).status,502);});
  await test('network failure handled',async()=>{globalThis.fetch=async()=>{throw Error('network');};assert.equal((await POST(request(generate))).status,502);});
  globalThis.fetch=realFetch;
  await test('local key setup: origin, CSRF, secret storage, no echo',async()=>{
    const root=fs.mkdtempSync(path.join(directory,'setup-'));fs.writeFileSync(path.join(root,'.env'),'PRESERVE_ME=yes\n');
    const server=createSetupServer({root,port:0});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try {
      const base=`http://127.0.0.1:${server.address().port}`;const page=await(await realFetch(base)).text();const token=page.match(/name="token" value="([a-f0-9]+)"/)[1];
      const fakeKey='fake-gemini-offline-test-key';const submit=(origin,csrf=token)=>realFetch(base+'/save',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:csrf,apiKey:fakeKey})});
      assert.equal((await submit('https://evil.test')).status,403);assert.equal((await submit(base,'bad')).status,403);assert.equal(fs.readFileSync(path.join(root,'.env'),'utf8'),'PRESERVE_ME=yes\n');
      const response=await submit(base);assert.equal(response.status,200);assert.ok(!(await response.text()).includes(fakeKey));assert.ok(fs.readFileSync(path.join(root,'.env'),'utf8').includes('GEMINI_API_KEY='+fakeKey));assert.ok(fs.readFileSync(path.join(root,'.env'),'utf8').includes('PRESERVE_ME=yes'));assert.ok(!(await(await realFetch(base)).text()).includes(fakeKey));
    } finally {await new Promise(resolve=>server.close(resolve));}
  });
  console.log(`Passed ${count} offline integration checks. Real Gemini call still requires the user's key.`);
} finally {globalThis.fetch=realFetch;if(previousKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previousKey;}

