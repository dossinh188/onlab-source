import { registerHooks } from 'node:module';
const localEnvironment=new URL('./local-env.mjs',import.meta.url).href;
registerHooks({resolve(specifier,context,nextResolve) {
  if(specifier==='cloudflare:workers') return {url:localEnvironment,shortCircuit:true};
  return nextResolve(specifier,context);
}});
