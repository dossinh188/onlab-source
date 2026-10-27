"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BookOpen, Plus, FileText, Sparkles, Layers, ListChecks, ArrowUpRight, ArrowUp, Upload, Settings2, ChevronRight, ChevronLeft, Leaf, Lightbulb, PanelLeft, CircleHelp, Check, RotateCcw, CheckCircle2, XCircle, LoaderCircle, Link2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { sampleSource, sampleStudy, type Study, type Source } from '@/lib/study';
import { MAX_TEXT_CHARACTERS, validateFileSize } from '@/lib/upload-limits';
import { WORD_MIME_TYPES, validateWordHeader, type WordFormat } from '@/lib/word-file';

type Tab='summary'|'cards'|'quiz'|'source';
type Lesson={id:string;source:Source;study:Study;sample:boolean};
type Message={role:'user'|'assistant';text:string};
const tabs=[{id:'summary',label:'Tóm tắt',icon:FileText},{id:'cards',label:'Thẻ ghi nhớ',icon:Layers},{id:'quiz',label:'Luyện tập',icon:ListChecks},{id:'source',label:'Tài liệu gốc',icon:BookOpen}] as const;
const example:Lesson={id:'sample',source:sampleSource,study:sampleStudy,sample:true};

async function callAI(body:unknown,signal?:AbortSignal){
  const response=await fetch('/api/study',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal??AbortSignal.timeout(100000)});
  let data:{error?:string;study?:Study;answer?:string};try{data=await response.json() as typeof data;}catch{throw new Error('Chưa nhận được phản hồi. Vui lòng thử lại.');}
  if(!response.ok)throw new Error(data.error||'Có lỗi kết nối. Vui lòng thử lại.');
  return data;
}

export default function StudyApp(){
  const [lessons,setLessons]=useState<Lesson[]>([example]);
  const [active,setActive]=useState('sample');const [tab,setTab]=useState<Tab>('summary');
  const [uploadOpen,setUploadOpen]=useState(false);const [settingsOpen,setSettingsOpen]=useState(false);
  const [configured,setConfigured]=useState<boolean|null>(null);const [statusError,setStatusError]=useState('');
  const [localSetup,setLocalSetup]=useState(false);
  const [busy,setBusy]=useState(false);const [fileBusy,setFileBusy]=useState(false);const [error,setError]=useState('');
  const [uploadProgress,setUploadProgress]=useState('');
  const generationAbort=useRef<AbortController|null>(null);
  const [draft,setDraft]=useState<Source>({name:'',text:''});const [dragging,setDragging]=useState(false);
  const fileInput=useRef<HTMLInputElement>(null);const lesson=lessons.find(x=>x.id===active)??example;
  const study=lesson.study;
  async function checkAI(){setStatusError('');try{const r=await fetch('/api/study');if(!r.ok)throw Error();const d=await r.json() as {configured:boolean};setConfigured(Boolean(d.configured));}catch{setConfigured(null);setStatusError('Chưa kiểm tra được kết nối. Bạn có thể thử lại.');}}
  useEffect(()=>{void checkAI();setLocalSetup(['127.0.0.1','localhost'].includes(window.location.hostname));const refresh=()=>void checkAI();window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);
  function selectLesson(id:string){setActive(id);setTab('summary');}
  function openUpload(){setError('');setUploadOpen(true);}
  async function readFile(file?:File){
    if(!file||busy||fileBusy)return;setError('');setFileBusy(true);
    try{
      validateFileSize(file.size);
      const name=file.name.slice(0,200);
      if(/\.pdf$/i.test(file.name)){
        const header=await file.slice(0,5).text();if(header!=='%PDF-')throw Error('Tệp này không phải PDF hợp lệ.');
        const pdf=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).replace(/^data:[^;]*;/,'data:application/pdf;'));reader.onerror=()=>reject(Error('Không đọc được tệp.'));reader.readAsDataURL(file);});
        setDraft({name,text:'',pdf,file});
      }else if(/\.(txt|md)$/i.test(file.name)){
        const text=await file.text();
        if(text.length>MAX_TEXT_CHARACTERS)throw Error('Văn bản vượt 1.000.000 ký tự. Hãy chia tài liệu thành các chương.');
        setDraft({name,text,file});
      }else if(/\.(docx|doc)$/i.test(file.name)){
        const format=file.name.toLowerCase().endsWith('.docx')?'docx':'doc';
        validateWordHeader(format,new Uint8Array(await file.slice(0,8).arrayBuffer()));
        const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).replace(/^data:[^;]*;/,`data:${WORD_MIME_TYPES[format as WordFormat]};`));reader.onerror=()=>reject(Error('Không đọc được tệp Word.'));reader.readAsDataURL(file);});
        setDraft({name,text:'',file,word:{format,data}});
      }else throw Error('Hỗ trợ PDF, Word (.docx, .doc), TXT và Markdown (.md).');
    }catch(e){setError(e instanceof Error?e.message:'Không đọc được tệp.');}finally{setFileBusy(false);if(fileInput.current)fileInput.current.value='';}
  }
  async function generate(event:FormEvent){
    event.preventDefault();setError('');
    if(!draft.pdf&&!draft.file&&draft.text.trim().length<80){setError('Hãy nhập ít nhất 80 ký tự để tạo bộ ôn tập.');return;}
    if(lessons.length>=5){setError('Phiên học đã có 5 tài liệu. Hãy hoàn thành phiên này trước khi tạo thêm.');return;}
    setBusy(true);
    const controller=new AbortController();generationAbort.current=controller;
    try{
      const source={...draft,name:draft.name.trim()||'Tài liệu của bạn'};
      setUploadProgress('Đang tạo bộ ôn tập…');
      const result=await callAI({action:'generate',source:{name:source.name,text:source.text,pdf:source.pdf,word:source.word}},AbortSignal.any([controller.signal,AbortSignal.timeout(100000)]));
      if(!result.study)throw Error('Chưa nhận được bộ ôn tập. Vui lòng thử lại.');
      const next={id:crypto.randomUUID(),source,study:result.study,sample:false};setLessons(old=>[...old,next]);setActive(next.id);setTab('summary');setUploadOpen(false);setDraft({name:'',text:''});setConfigured(true);
    }
    catch(e){setError(controller.signal.aborted?'Đã hủy. Tệp vẫn ở đây để bạn thử lại.':e instanceof Error?e.message:'Không thể tạo bộ ôn tập. Vui lòng thử lại.');}finally{setBusy(false);generationAbort.current=null;}
  }
  useEffect(()=>{
    const context=(document as unknown as {modelContext?:{registerTool:(tool:unknown,options:unknown)=>Promise<void>|void}}).modelContext;
    if(!context?.registerTool)return;const lifecycle=new AbortController();
    const tools=[{name:'read_current_study',description:'Read the current study title, source name, and study tab without changing anything.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({title:study.title,source:lesson.source.name,tab})},
      {name:'open_study_tab',description:'Open summary, flashcards, quiz, or source for the selected lesson. Does not answer questions or mark cards learned.',inputSchema:{type:'object',properties:{tab:{type:'string',enum:['summary','cards','quiz','source']}},required:['tab'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input:unknown)=>{const value=(input as {tab?:string})?.tab;if(!tabs.some(t=>t.id===value))throw Error('Invalid study tab');setTab(value as Tab);await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));return {tab:value,title:study.title};}}];
    for(const tool of tools){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    return ()=>lifecycle.abort();
  },[lesson.source.name,study.title,tab]);

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Ônlab — Trang chủ"><span className="brand-mark"><BookOpen size={25}/></span>ônlab<span className="brand-dot">.</span></a>
      <div className="workspace-label">KHÔNG GIAN HỌC TẬP</div>
      <button className="nav-item active" onClick={()=>setTab('summary')}><BookOpen size={19}/> Góc học tập</button>
      <button className="new-doc" onClick={openUpload}><Plus size={18}/> Thêm tài liệu</button>
      <div className="library-heading">TÀI LIỆU CỦA BẠN <span>{String(lessons.length).padStart(2,'0')}</span></div>
      <div className="document-list">{lessons.map(item=><button key={item.id} className={'document-item '+(item.id===active?'current':'')} onClick={()=>selectLesson(item.id)} aria-pressed={item.id===active}><span className="doc-icon"><FileText size={18}/></span><span>{item.sample?'Cơ sở của trí nhớ':item.study.title}<small>{item.sample?'Tài liệu mẫu':'Bộ ôn tập AI'} · {item.study.concepts.length} ý chính</small></span></button>)}</div>
      <div className="sidebar-bottom"><div className="study-tip"><Lightbulb size={20}/><strong>Mỗi ngày một chút.</strong><p>Thử tự nhớ lại trước khi xem đáp án. Bạn sẽ nhớ lâu hơn.</p></div><button className="nav-item" onClick={()=>setSettingsOpen(true)}><Settings2 size={18}/> {configured?'Kết nối AI':'Thiết lập AI'}</button><div className="session"><span className="avatar">B</span><span>Không gian cá nhân<small>Phiên học hiện tại</small></span></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div><PanelLeft size={18}/><span>Góc học tập</span><ChevronRight size={14}/><strong>{lesson.sample?'Tài liệu mẫu':'Tài liệu của bạn'}</strong></div><button className="status-button" onClick={()=>setSettingsOpen(true)}><Link2 size={14}/>{configured?'AI đã thiết lập':'Kết nối AI'}</button></header>
      <main><div className="welcome"><div><span className="eyebrow">HỌC CHỦ ĐỘNG, NHỚ LÂU HƠN</span><h1>Hôm nay, bạn muốn học gì?</h1><p>Biến tài liệu của bạn thành một buổi học hiệu quả.</p></div><span className="welcome-icon"><Sparkles size={30}/></span></div>
        <button className="upload-banner" onClick={openUpload}><span className="upload-icon"><Upload size={23}/></span><span><strong>Bắt đầu từ tài liệu của bạn</strong><small>PDF, Word, TXT, Markdown hoặc nội dung bạn dán vào.</small></span><span className="button lime">Thêm tài liệu <Plus size={17}/></span></button>
        {lessons.length>1&&<div className="mobile-docs"><label htmlFor="mobile-doc">Đang học</label><select id="mobile-doc" value={active} onChange={e=>selectLesson(e.target.value)}>{lessons.map(l=><option key={l.id} value={l.id}>{l.study.title}</option>)}</select></div>}
        <div className="section-label"><span>ĐANG HỌC</span><span>{lesson.sample?'Bài học mẫu để khám phá Ônlab':'Nội dung do AI tạo · Hãy đối chiếu tài liệu gốc'}</span></div>
        <section className="lesson"><div className="lesson-heading"><span className="lesson-icon"><Leaf size={27}/></span><div><div className="lesson-tags"><span>{study.topic.toUpperCase()}</span><span className="sample-tag">{lesson.sample?'Tài liệu mẫu':'Từ tài liệu của bạn'}</span></div><h2>{study.title}</h2><p>{study.concepts.length} ý chính <span>·</span> {study.cards.length} thẻ ghi nhớ <span>·</span> {study.quiz.length} câu hỏi</p></div></div>
          <div className="tabs" role="tablist" aria-label="Chế độ ôn tập">{tabs.map(({id,label,icon:Icon})=><button key={id} id={'tab-'+id} role="tab" aria-selected={tab===id} aria-controls={'panel-'+id} className={tab===id?'selected':''} onClick={()=>setTab(id)}><Icon size={17}/>{label}</button>)}</div>
          <div className="learning-layout"><article className="study-content" role="tabpanel" id={'panel-'+tab} aria-labelledby={'tab-'+tab}>
            {tab==='summary'&&<><div className="content-heading"><h3>Nắm vững những điều cốt lõi</h3><span className="subtle">TỔNG QUAN</span></div><div className="takeaway"><span><Sparkles size={18}/> ĐIỀU CẦN NHỚ</span><p>{study.summary}</p></div>{study.concepts.map((point,i)=><div className="key-point" key={i}><span>{String(i+1).padStart(2,'0')}</span><div><h4>{point.title}</h4><p>{point.explanation}</p><button className="source-link" onClick={()=>setTab('source')}>{point.source} <ArrowUpRight size={12}/></button></div></div>)}<div className="next-step"><div><Layers size={21}/><span>Đã nắm ý chính? Thử nhớ lại nhé.</span></div><button onClick={()=>setTab('cards')}>Học bằng thẻ <ArrowUpRight size={18}/></button></div></>}
            {lessons.map(item=><div key={'cards-'+item.id} hidden={tab!=='cards'||active!==item.id}><Flashcards cards={item.study.cards}/></div>)}
            {lessons.map(item=><div key={'quiz-'+item.id} hidden={tab!=='quiz'||active!==item.id}><Quiz questions={item.study.quiz}/></div>)}
            {tab==='source'&&<SourceView source={lesson.source}/>}
          </article>{lessons.map(item=><ChatPanel key={item.id} hidden={active!==item.id} source={item.source} configured={configured} onSetup={()=>setSettingsOpen(true)}/>)}</div>
        </section><footer><span><BookOpen size={14}/> Ônlab · Học theo cách của bạn.</span><span>Tài liệu và tiến độ chỉ giữ trong phiên này.</span></footer>
      </main>
    </div>
    <Dialog open={uploadOpen} onOpenChange={open=>{if(!busy&&!fileBusy)setUploadOpen(open);}}><DialogContent className="study-modal"><DialogTitle>Thêm tài liệu học tập</DialogTitle><DialogDescription>Chọn một tài liệu hoặc dán nội dung. AI sẽ tạo bộ ôn tập bám sát tài liệu của bạn.</DialogDescription>
      <form onSubmit={generate} className="upload-form">
        <input ref={fileInput} type="file" accept=".pdf,.docx,.doc,.txt,.md" className="sr-only" aria-label="Chọn tài liệu" onChange={e=>void readFile(e.target.files?.[0])}/>
        <button type="button" disabled={busy||fileBusy} className={'dropzone '+(dragging?'dragging':'')} onClick={()=>fileInput.current?.click()} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void readFile(e.dataTransfer.files[0]);}}><Upload size={25}/><strong>{fileBusy?'Đang đọc tài liệu…':draft.pdf||draft.file?'Đã chọn tệp — bấm để đổi':'Chọn tệp hoặc kéo thả vào đây'}</strong><small>PDF, Word (.docx, .doc), TXT, MD · Tối đa 5 MB</small></button>
        <label>Tên tài liệu<input value={draft.name} maxLength={200} disabled={busy||fileBusy} placeholder="Ví dụ: Sinh học — Chương 1" onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
        {draft.pdf||draft.file?<div className="selected-file"><FileText size={18}/><span>{draft.name}{draft.file&&` · ${draft.file.size<1024*1024?Math.max(1,Math.round(draft.file.size/1024)).toLocaleString('vi-VN')+' KB':(draft.file.size/1024/1024).toLocaleString('vi-VN',{maximumFractionDigits:1})+' MB'}`}</span><button type="button" disabled={busy||fileBusy} onClick={()=>setDraft({name:draft.name,text:''})}>Dán văn bản thay thế</button></div>:<label>Nội dung tài liệu<textarea value={draft.text} disabled={busy||fileBusy} maxLength={50000} rows={7} placeholder="Dán nội dung bạn muốn ôn tập vào đây…" onChange={e=>setDraft({...draft,text:e.target.value})}/><small>{draft.text.length.toLocaleString('vi-VN')} / 50.000 ký tự · Tối thiểu 80 ký tự</small></label>}
        <p className="privacy-note">Khi tạo bài hoặc hỏi AI, nội dung tài liệu được gửi đến Google Gemini. Với hạn mức miễn phí, Google có thể dùng dữ liệu để cải thiện sản phẩm. Tài liệu và tiến độ trên Ônlab chỉ giữ trong phiên này.</p>
        {configured===false&&<div className="notice"><CircleHelp size={17}/><span>AI chưa được kết nối. Bạn có thể chuẩn bị tài liệu tại đây và trải nghiệm bài học mẫu.</span></div>}
        {draft.word&&<p className="small-note">AI đọc phần văn bản của tệp Word. Nếu muốn ôn cả hình ảnh và biểu đồ, hãy xuất tài liệu thành PDF.</p>}<p className="small-note">Word, TXT và MD hỗ trợ tối đa 1.000.000 ký tự. Với tài liệu dài hơn, hãy chia theo chương.</p>{busy&&<p role="status" aria-live="polite" className="small-note">{uploadProgress}</p>}{error&&<p role="alert" className="error-message">{error}</p>}
        <button className="button dark full" disabled={busy||fileBusy} type="submit">{busy?<><LoaderCircle className="spin" size={18}/> Đang đọc và tạo bộ ôn tập…</>:<><Sparkles size={18}/> Tạo bộ ôn tập</>}</button>
        {busy&&<button className="button outline full" type="button" onClick={()=>generationAbort.current?.abort()}>Hủy xử lý</button>}
      </form>
    </DialogContent></Dialog>
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="study-modal"><DialogTitle>Kết nối Gemini</DialogTitle><DialogDescription>{configured?'Đã lưu khóa Gemini. Hãy tạo một bài ôn tập để kiểm tra khóa và hạn mức.':'Bạn cần một khóa Gemini để tạo bài từ tài liệu. Bài học mẫu vẫn dùng được ngay.'}</DialogDescription><div className="connection-card"><Sparkles size={27}/><strong>{configured?'Đã thiết lập Gemini':configured===null?'Chưa xác định trạng thái':'Chưa nhập khóa Gemini'}</strong><p>{configured?'AI có thể mắc lỗi. Hãy đối chiếu câu trả lời với tài liệu gốc.':'Mở Google AI Studio, đăng nhập Google và chọn Create API key (Tạo khóa API). Không gửi khóa vào cuộc trò chuyện.'}</p><a className="button outline" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Tạo khóa Gemini <ArrowUpRight size={16}/></a>{localSetup&&<a className="button dark" href="http://127.0.0.1:5174/" target="_blank" rel="noopener noreferrer">Nhập khóa trên máy này <Link2 size={16}/></a>}{!localSetup&&!configured&&<p>Chủ website cần thêm khóa Gemini vào cấu hình máy chủ để bật AI.</p>}</div>{statusError&&<p className="error-message" role="alert">{statusError}</p>}<button className="button outline" onClick={()=>void checkAI()}><RotateCcw size={16}/> Kiểm tra lại cấu hình</button><p className="privacy-note">Gemini có hạn mức sử dụng tùy tài khoản. Tài liệu và tiến độ chỉ được giữ trong phiên hiện tại; tải lại trang sẽ bắt đầu phiên mới.</p></DialogContent></Dialog>
  </div>;
}

function Flashcards({cards}:{cards:Study['cards']}){
  const [index,setIndex]=useState(0);const [flipped,setFlipped]=useState(false);const [known,setKnown]=useState<number[]>([]);
  const card=cards[index];const move=(direction:number)=>{setIndex(i=>(i+direction+cards.length)%cards.length);setFlipped(false);};
  function rate(remembered:boolean){setKnown(old=>remembered?Array.from(new Set([...old,index])):old.filter(i=>i!==index));move(1);}
  return <div className="flashcards"><div className="content-heading"><h3>Nhớ lại trước khi lật thẻ</h3><span className="subtle">{index+1} / {cards.length}</span></div><div className="progress-meta"><span>{known.length} / {cards.length} thẻ đã nhớ</span><button onClick={()=>{setIndex(0);setKnown([]);setFlipped(false);}}><RotateCcw size={14}/> Bắt đầu lại</button></div><div className="progress-track"><span style={{width:`${known.length/cards.length*100}%`}}/></div><button className={'flashcard '+(flipped?'flipped':'')} onClick={()=>setFlipped(v=>!v)} aria-label={flipped?'Lật về câu hỏi':'Lật thẻ xem đáp án'} aria-pressed={flipped}><span className="subtle">{flipped?'ĐÁP ÁN':'CÂU HỎI'}</span><span className="flashcard-text">{flipped?card.answer:card.question}</span><span className="flash-hint">{flipped?card.source:'Bấm vào thẻ để xem đáp án'}</span><RotateCcw size={18}/></button><div className="card-navigation"><button className="round-button" onClick={()=>move(-1)} aria-label="Thẻ trước"><ChevronLeft size={19}/></button><span>{index+1} trên {cards.length} thẻ</span><button className="round-button" onClick={()=>move(1)} aria-label="Thẻ tiếp theo"><ChevronRight size={19}/></button></div><div className="rating-buttons"><button className="button outline" disabled={!flipped} onClick={()=>rate(false)}><RotateCcw size={17}/> Cần ôn lại</button><button className="button lime" disabled={!flipped} onClick={()=>rate(true)}><Check size={17}/> Đã nhớ</button></div>{known.length===cards.length&&<div className="success-message" role="status"><CheckCircle2 size={18}/> Bạn đã nhớ hết bộ thẻ! Hãy thử phần Luyện tập.</div>}<p className="small-note">Lật thẻ để tự đánh giá. Quay lại những thẻ chưa nhớ vào buổi học tiếp theo.</p></div>;
}

function Quiz({questions}:{questions:Study['quiz']}){
  const [index,setIndex]=useState(0);const [answers,setAnswers]=useState<number[]>([]);const [finished,setFinished]=useState(false);
  const current=questions[index];const selected=answers[index];const hasAnswer=selected!==undefined;
  const score=answers.reduce((total,answer,i)=>total+(answer===questions[i].correct?1:0),0);
  function reset(){setIndex(0);setAnswers([]);setFinished(false);}
  if(finished)return <div className="quiz-results"><span className="result-icon"><CheckCircle2 size={35}/></span><span className="eyebrow">HOÀN THÀNH BÀI LUYỆN TẬP</span><h3>{score===questions.length?'Bạn đã nắm bài rất tốt!':'Mỗi lần thử là một lần nhớ hơn.'}</h3><div className="score">{score}<span> / {questions.length}</span></div><p>{score===questions.length?'Hãy quay lại ôn sau một khoảng thời gian để củng cố kiến thức.':'Xem lại lời giải bên dưới và thử lại khi bạn sẵn sàng.'}</p><button className="button dark" onClick={reset}><RotateCcw size={16}/> Làm lại bài luyện tập</button><div className="answer-review">{questions.map((q,i)=><details key={i}><summary>{answers[i]===q.correct?<CheckCircle2 size={17}/>:<XCircle size={17}/>} Câu {i+1}: {q.question}</summary><p><strong>Bạn chọn:</strong> {q.options[answers[i]]}</p><p><strong>Đáp án đúng:</strong> {q.options[q.correct]}</p><p>{q.explanation}</p><small>{q.source}</small></details>)}</div></div>;
  return <div className="quiz"><div className="content-heading"><h3>Kiểm tra điều bạn đã hiểu</h3><span className="subtle">Câu {index+1} / {questions.length}</span></div><div className="progress-track quiz-progress"><span style={{width:`${answers.length/questions.length*100}%`}}/></div><p className="quiz-question">{current.question}</p><div className="quiz-options">{current.options.map((option,i)=><button key={i} disabled={hasAnswer} className={(hasAnswer&&i===current.correct?'correct ':hasAnswer&&i===selected?'incorrect ':'')+(selected===i?'chosen':'')} onClick={()=>setAnswers(a=>[...a,i])}><span>{String.fromCharCode(65+i)}</span>{option}{hasAnswer&&i===current.correct&&<CheckCircle2 size={18}/>}</button>)}</div>{hasAnswer&&<div className={'quiz-feedback '+(selected===current.correct?'right':'wrong')} role="status"><strong>{selected===current.correct?'Chính xác!':'Chưa đúng — cùng xem lại nhé.'}</strong><p>{current.explanation}</p><small>{current.source}</small></div>}<div className="quiz-actions"><span>{hasAnswer?`${score} câu đúng`:'Chọn một đáp án để xem giải thích.'}</span><button className="button dark" disabled={!hasAnswer} onClick={()=>index===questions.length-1?setFinished(true):setIndex(i=>i+1)}>{index===questions.length-1?'Xem kết quả':'Câu tiếp theo'}<ChevronRight size={16}/></button></div></div>;
}

function SourceView({source}:{source:Source}){
  const [url,setUrl]=useState('');
  useEffect(()=>{
    let blob:Blob|undefined=source.file;
    if(!blob&&source.pdf){const raw=atob(source.pdf.split(',')[1]);blob=new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:'application/pdf'});}
    if(!blob){setUrl('');return;}
    if(source.file&&/\.pdf$/i.test(source.file.name))blob=source.file.slice(0,source.file.size,'application/pdf');
    const value=URL.createObjectURL(blob);setUrl(value);return()=>URL.revokeObjectURL(value);
  },[source.pdf,source.file]);
  const isPdf=Boolean(source.pdf||source.file&&/\.pdf$/i.test(source.file.name));
  return <div className="source-view"><div className="content-heading"><h3>Tài liệu gốc</h3><FileText size={18}/></div><p className="small-note">{source.name}</p>{isPdf?<><p className="small-note">Nếu trình duyệt không hiển thị PDF, <a href={url} target="_blank" rel="noreferrer">mở tài liệu trong tab mới</a>.</p>{url&&<iframe src={url} title="Tài liệu PDF gốc"/>}</>:<>{source.file&&<p className="small-note"><a href={url} download={source.file.name}>Tải lại tài liệu gốc</a></p>}{source.text&&<div className="source-text">{source.text}</div>}{source.word&&<p className="small-note">Tệp Word được dùng để tạo bài và hỏi đáp. Bạn có thể tải lại bản gốc để mở trong Word.</p>}</>}</div>;
}

function ChatPanel({source,configured,onSetup,hidden}:{source:Source;configured:boolean|null;onSetup:()=>void;hidden:boolean}){
  const [question,setQuestion]=useState('');const [messages,setMessages]=useState<Message[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const abort=useRef<AbortController|null>(null);const feed=useRef<HTMLDivElement>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  useEffect(()=>{if(!hidden&&feed.current)feed.current.scrollTop=feed.current.scrollHeight;},[messages,busy,hidden]);
  async function send(text:string){
    const clean=text.trim();if(!clean||busy)return;if(!configured){onSetup();return;}
    setError('');setBusy(true);const history=messages.slice(-8);setMessages(old=>[...old,{role:'user',text:clean}]);setQuestion('');
    const controller=new AbortController();abort.current=controller;const timeout=setTimeout(()=>controller.abort(),100000);
    try{const data=await callAI({action:'chat',source:{name:source.name,text:source.text,pdf:source.pdf,word:source.word},question:clean,history},controller.signal);const answer=data.answer;if(!answer)throw Error('Chưa nhận được câu trả lời. Vui lòng thử lại.');setMessages(old=>[...old,{role:'assistant',text:answer}]);}
    catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Chưa gửi được câu hỏi.');setQuestion(clean);setMessages(old=>old.slice(0,-1));}else{setError('Phản hồi quá lâu. Vui lòng thử lại.');setQuestion(clean);setMessages(old=>old.slice(0,-1));}}
    finally{clearTimeout(timeout);setBusy(false);}
  }
  return <aside className="assistant-panel" hidden={hidden}><div className="assistant-heading"><span className="ai-symbol"><Sparkles size={19}/></span><div><h3>Bạn học AI</h3><small>Cùng bạn hiểu sâu hơn</small></div><span className="beta-tag">AI</span></div><div className="assistant-body" ref={feed}>{messages.length===0?<><span className="assistant-orbit"><Sparkles size={26}/></span><h4>Chỗ nào còn khó hiểu?</h4><p>Hỏi về tài liệu, nhờ giải thích đơn giản hoặc cùng tìm ví dụ.</p>{['Giải thích ý chính thật đơn giản','Cho mình một ví dụ thực tế','Những điều nào dễ nhầm lẫn?'].map(q=><button key={q} onClick={()=>void send(q)}>{q}<ArrowUpRight size={16}/></button>)}</>:messages.map((m,i)=><div className={'message '+m.role} key={i}><strong>{m.role==='user'?'Bạn':'Ônlab AI'}</strong><p>{m.text}</p></div>)}{busy&&<p className="thinking" role="status"><LoaderCircle size={15} className="spin"/> Đang đọc lại tài liệu…</p>}{error&&<p className="error-message" role="alert">{error}</p>}</div><div className="chat-bottom"><form className="chat-input" onSubmit={e=>{e.preventDefault();void send(question);}}><input value={question} onChange={e=>setQuestion(e.target.value)} maxLength={2000} placeholder="Hỏi về tài liệu này…" aria-label="Câu hỏi cho AI" disabled={busy}/><button disabled={busy||!question.trim()} aria-label="Gửi câu hỏi"><ArrowUp size={18}/></button></form><small><CircleHelp size={12}/> {configured?'AI có thể sai. Hãy kiểm tra nguồn.':'Kết nối AI để bắt đầu trò chuyện'}</small></div></aside>;
}

