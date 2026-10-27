import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
const file=fileURLToPath(new URL('../.env',import.meta.url));
// Only the local Node preview uses this module. Never bundled into the client.
export const env=new Proxy({}, {get(_target,name) {
  if(typeof name!=='string') return undefined;
  if(name==='GEMINI_API_KEY'||name==='GEMINI_MODEL') {
    try { return parseEnv(fs.readFileSync(file,'utf8'))[name] || process.env[name]; }
    catch { return process.env[name]; }
  }
  return process.env[name];
}});
