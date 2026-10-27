import { Buffer } from 'node:buffer';

// Bound allocation and directory traversal before the legacy DOC parser runs.
export function validateDocArchive(data:Buffer) {
  const fail=():never=>{throw Error('Tệp Word .doc bị hỏng hoặc có cấu trúc không được hỗ trợ. Hãy lưu lại thành .docx.');};
  if(data.length<512)fail();
  const major=data.readUInt16LE(26),shift=data.readUInt16LE(30);
  if(data.readUInt16LE(28)!==0xfffe||!((major===3&&shift===9)||(major===4&&shift===12))||data.readUInt16LE(32)!==6||data.readInt32LE(56)!==4096)fail();
  const size=2**shift,count=data.length/size-1,words=size/4;
  if(!Number.isInteger(count)||count<1)fail();
  const offset=(id:number)=>{if(id<0||id>=count)fail();return(id+1)*size;};
  const readCount=(at:number)=>{const n=data.readInt32LE(at);if(n<0||n>count)fail();return n;};
  const fatCount=readCount(44),miniCount=readCount(64),difatCount=readCount(72);
  if(!fatCount)fail();
  const fatIds:number[]=[],seen=new Set<number>();
  const addFat=(id:number)=>{offset(id);if(seen.has(id))fail();seen.add(id);fatIds.push(id);};
  for(let i=0;i<Math.min(fatCount,109);i++)addFat(data.readInt32LE(76+i*4));
  let difat=data.readInt32LE(68);
  for(let i=0;i<difatCount;i++) {
    const start=offset(difat);if(seen.has(difat))fail();seen.add(difat);
    for(let j=0;j<words-1&&fatIds.length<fatCount;j++)addFat(data.readInt32LE(start+j*4));
    difat=data.readInt32LE(start+size-4);
  }
  if(fatIds.length!==fatCount||(difatCount&&difat!==-1&&difat!==-2))fail();
  const table=(ids:number[])=>{const result=new Int32Array(ids.length*words);ids.forEach((id,i)=>{const start=offset(id);for(let j=0;j<words;j++)result[i*words+j]=data.readInt32LE(start+j*4);});return result;};
  const acyclic=(values:Int32Array,limit:number)=>{
    const state=new Uint8Array(values.length);
    for(let start=0;start<values.length;start++) {
      if(state[start])continue;
      let id=start;
      while(id>=0&&!state[id]) {state[id]=1;const next=values[id];if(next< -4||next>=limit)fail();id=next;}
      if(id>=0&&state[id]===1)fail();
      id=start;while(id>=0&&state[id]===1){state[id]=2;id=values[id];}
    }
  };
  const fat=table(fatIds);if(fat.length<count)fail();acyclic(fat,count);
  const chain=(start:number)=>{const result:number[]=[];let id=start;while(id>=0){offset(id);if(result.length>=count)fail();result.push(id);id=fat[id];}if(id!==-1&&id!==-2)fail();return result;};
  const miniIds=chain(data.readInt32LE(60));if(miniIds.length!==miniCount)fail();
  const mini=table(miniIds);acyclic(mini,Math.min(mini.length,count*size/64));
  const dirs=chain(data.readInt32LE(48));if(!dirs.length)fail();
  const directory=Buffer.concat(dirs.map(id=>data.subarray(offset(id),offset(id)+size)));
  const entries=Array.from({length:directory.length/128},(_,i)=>{
    const at=i*128,type=directory[at+66];
    return {type,refs:[directory.readInt32LE(at+68),directory.readInt32LE(at+72),...([1,5].includes(type)?[directory.readInt32LE(at+76)]:[])],start:directory.readInt32LE(at+116),size:directory.readInt32LE(at+120)};
  });
  if(entries.filter(e=>e.type===5).length!==1)fail();
  const incoming=new Uint8Array(entries.length);
  for(const entry of entries) {
    if(!entry.type)continue;
    if(![1,2,5].includes(entry.type)||entry.size<0||entry.size>data.length)fail();
    for(const ref of entry.refs){if(ref===-1)continue;if(ref<0||ref>=entries.length||!entries[ref].type||++incoming[ref]>1)fail();}
    if([2,5].includes(entry.type)&&entry.size>0){const limit=entry.type===2&&entry.size<4096?mini.length:count;if(entry.start<0||entry.start>=limit)fail();}
  }
  const state=new Uint8Array(entries.length);
  for(let start=0;start<entries.length;start++) {
    if(!entries[start].type||state[start])continue;
    const stack:[number,boolean,number][]=[[start,false,0]];
    while(stack.length) {
      const [id,exit,depth]=stack.pop()!;
      if(exit){state[id]=2;continue;}
      if(state[id]===1||depth>256)fail();if(state[id]===2)continue;
      state[id]=1;stack.push([id,true,depth]);
      for(const next of entries[id].refs)if(next!==-1)stack.push([next,false,depth+1]);
    }
  }
}
