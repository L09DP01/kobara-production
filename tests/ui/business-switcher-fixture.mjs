// Isolated UI fixture: actual components, fictitious businesses, no auth or provider calls.
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const stubs = {
  'next/link': `import React from 'react'; export default function Link({children,...props}) { return <a {...props}>{children}</a>; }`,
  'next/navigation': `export const useRouter=()=>({push(){},refresh(){}});`,
  '@/lib/utils/logout-client': `export const performFullLogout=async()=>{};`,
  '@/app/dashboard/businesses/actions': `export const switchBusinessAction=async()=>({error:'Changement simulé pour le test visuel.'}); export const createBusinessAction=async()=>({error:'Activité transmise à la conformité (test local).'});`,
  './actions': `export const markNotificationAsReadAction=async()=>{}; export const markAllNotificationsAsReadAction=async()=>{};`,
  './merchant-referral-dialog': `export const MerchantReferralDialog=()=>null;`,
};
const bundled = await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import TopNav from './src/components/dashboard/top-nav';
    const businesses=[{id:'a',business_name:'Academie Centrale',role:'owner',kyc_status:'approved',current_environment:'live'},
      {id:'b',business_name:'Academie Express',role:'owner',kyc_status:'approved',current_environment:'live'},
      {id:'c',business_name:'Atelier des Creatifs et Services Numeriques',role:'owner',kyc_status:'in_review',current_environment:'test'}];
    createRoot(document.getElementById('root')).render(<div className="kobara-dashboard-shell min-h-screen bg-[#07101D] text-white"><TopNav onToggleSidebar={()=>{}} merchant={businesses[0]} accessibleMerchants={businesses}/><main className="p-8"><h1 className="text-2xl font-bold">Academie Centrale</h1></main></div>);`, resolveDir: root, loader: 'tsx' },
  bundle:true, write:false, platform:'browser', format:'iife', jsx:'automatic', tsconfig:path.join(root,'tsconfig.json'),
  define: {'process.env':'{}'}, plugins:[{name:'fixture-only-stubs',setup(builder) {
    builder.onResolve({filter:/.*/},args=>args.path in stubs ? {path:args.path,namespace:'fixture-stub'} : undefined);
    builder.onLoad({filter:/.*/,namespace:'fixture-stub'},args=>({contents:stubs[args.path],loader:'tsx',resolveDir:root}));
  }}],
});
const css = await postcss([tailwind()]).process(await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'), {from:path.join(root,'src/app/globals.css')});
const assets = {
  '/app.js': ['text/javascript',bundled.outputFiles[0].contents],
  '/app.css': ['text/css',css.css],
  '/logo.png': ['image/png',await fs.readFile(path.join(root,'public/logo.png'))],
};
const server=http.createServer((request,response)=>{
  const asset=assets[request.url];
  if(asset) {response.writeHead(200,{'Content-Type':asset[0]});response.end(asset[1]);return;}
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{margin:0;font-family:Arial,sans-serif}.material-symbols-outlined{display:none}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
});
server.listen(3029,'127.0.0.1',()=>console.log('UI fixture ready at http://127.0.0.1:3029'));
