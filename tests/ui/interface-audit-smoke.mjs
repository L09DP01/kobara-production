// Real shared UI, fictional data, no authentication or financial operations.
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('C:/Users/owner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd();
const stubs={
 'next/link':`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`,
 'next/navigation':`export const usePathname=()=>'/dashboard';export const useRouter=()=>({push(path){window.auditNavigation=path},refresh(){}});`,
 '@/lib/utils/logout-client':`export const performFullLogout=async()=>{};`,
 '@/app/dashboard/businesses/actions':`export const switchBusinessAction=async()=>({error:'Simulation'});export const createBusinessAction=async()=>({error:'Simulation'});`,
 './actions':`export const markNotificationAsReadAction=async()=>{};export const markAllNotificationsAsReadAction=async()=>{};`,
 './merchant-referral-dialog':`export const MerchantReferralDialog=()=>null;`,
 './new-business-dialog':`export const NewBusinessDialog=()=>null;`,
 '@/components/admin/AdminSessionManager':`export default function AdminSessionManager({children}){return children;}`,
};
const bundle=await build({stdin:{loader:'tsx',resolveDir:root,contents:`
 import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
 import TopNav from './src/components/dashboard/top-nav';import {MobileSidebar,MobileBottomNav} from './src/components/dashboard/sidebar';
 import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogBody,DialogTrigger} from './src/components/ui/dialog';
 import {Input} from './src/components/ui/input';import {Button} from './src/components/ui/button';
 import {ModalFrame} from './src/components/ui/modal-frame';
 import SystemCoreLogin from './src/app/system-core/login/page';
 import {AdminShell} from './src/app/system-core/(protected)/admin-shell';
 import {DocsClient} from './src/app/docs/docs-client';
 function App(){const[open,setOpen]=useState(false);const[legacy,setLegacy]=useState(false);
 if(window.auditView==='admin')return <SystemCoreLogin/>;
 if(window.auditView==='admin-shell')return <AdminShell><h1>Administration test</h1></AdminShell>;
 if(window.auditView==='docs')return <DocsClient isAuthenticated={false} markdownContent={'# Guide de test'} />;
 return <div className="min-h-screen bg-[#07101D] text-white">
 <TopNav sidebarOpen={open} onToggleSidebar={()=>setOpen(!open)} merchant={{id:'demo',business_name:'Boutique Demonstration'}} referralSummary={{}} accessibleMerchants={[{id:'demo',business_name:'Boutique Demonstration',kyc_status:'approved',current_environment:'live'}]} initialNotifications={[{id:'demo',type:'payment_received',title:'Paiement de demonstration',message:'Notification fictive pour le test.',created_at:'2026-10-26T12:00:00Z'}]} />
 <MobileSidebar isOpen={open} onClose={()=>setOpen(false)} kycApproved />
 <main id="dashboard-content" tabIndex={-1} className="p-4 pb-32"><h1>Audit interface</h1><label htmlFor="audit-name">Nom</label><Input id="audit-name" />
 <Button id="legacy-trigger" onClick={()=>setLegacy(true)}>Ouvrir une modale metier</Button>
 {legacy&&<ModalFrame title="Modale metier" onClose={()=>setLegacy(false)}><div className="w-full max-w-md bg-[#131B2C] p-6 text-white overflow-hidden"><h2>Retrait de demonstration</h2>{Array.from({length:25},(_,i)=><p key={i}>Detail {i}</p>)}<Button onClick={()=>setLegacy(false)}>Annuler</Button></div></ModalFrame>}
 <Button variant="secondary">Action secondaire</Button><Button size="sm">Un libelle volontairement tres long qui doit rester entierement lisible sur un petit ecran</Button>
 <Dialog><DialogTrigger asChild><Button>Ouvrir un formulaire long</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Formulaire de demonstration</DialogTitle></DialogHeader><DialogBody>{Array.from({length:25},(_,i)=><p key={i}>Section {i+1} du formulaire</p>)}<Button>Terminer</Button></DialogBody></DialogContent></Dialog>
 </main><MobileBottomNav onOpenMore={()=>setOpen(true)} kycApproved /></div>}
 createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',tsconfig:path.join(root,'tsconfig.json'),define:{'process.env':'{}'},plugins:[{name:'audit-stubs',setup(builder){
 builder.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'audit-stub'}:undefined);
 builder.onLoad({filter:/.*/,namespace:'audit-stub'},args=>({contents:stubs[args.path],loader:'tsx',resolveDir:root}));}}]});
const css=await postcss([tailwind()]).process(await fs.readFile('src/app/globals.css','utf8'),{from:path.join(root,'src/app/globals.css')});
let script=new TextDecoder().decode(bundle.outputFiles[0].contents);
for(const file of ['logo.png','logo2.png','Icone.png']){
 const data=`data:image/png;base64,${(await fs.readFile(path.join(root,'public',file))).toString('base64')}`;
 script=script.replaceAll(JSON.stringify('/'+file),JSON.stringify(data));
}
const browser=await chromium.launch({headless:true,channel:'chrome'});
const folder=process.env.INTERFACE_SCREENSHOT_DIR;if(folder)await fs.mkdir(folder,{recursive:true});
let checks=0;
try{for(const width of [320,390,768,1440]){
 const page=await browser.newPage({viewport:{width,height:740},hasTouch:width<1024,isMobile:width<1024});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://fixture.invalid/**',async route=>{
  const file=path.basename(new URL(route.request().url()).pathname);
  if(['logo.png','logo2.png','Icone.png'].includes(file))await route.fulfill({contentType:'image/png',body:await fs.readFile(path.join(root,'public',file))});else await route.abort();
 });
 await page.setContent(`<html><head><base href="https://fixture.invalid/"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style><style>.material-symbols-outlined{display:none}body{margin:0;font-family:Arial,sans-serif}</style></head><body><div id="root"></div><script>${script.replaceAll('</script','<\\/script')}</script></body></html>`);
 await page.getByRole('heading',{name:'Audit interface'}).waitFor();
 await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0),null,{timeout:5000}).catch(async()=>{throw Error(JSON.stringify(await page.evaluate(()=>[...document.images].map(image=>({src:image.src,complete:image.complete,width:image.naturalWidth})))))});
 await page.locator('#audit-name').fill('Camille Demonstration');
 assert.notEqual(await page.locator('#audit-name').evaluate(el=>getComputedStyle(el).color),await page.locator('#audit-name').evaluate(el=>getComputedStyle(el).backgroundColor));checks++;
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks++;
 await page.getByRole('button',{name:'Ouvrir une modale metier'}).click();
 const legacy=page.getByRole('dialog',{name:'Modale metier'});await legacy.waitFor();
 const legacyBox=await legacy.boundingBox();assert.ok(legacyBox.x>=0&&legacyBox.y>=0&&legacyBox.x+legacyBox.width<=width&&legacyBox.y+legacyBox.height<=741);checks++;
 await page.keyboard.press('Shift+Tab');assert.equal(await legacy.evaluate(el=>el.contains(document.activeElement)),true);checks++;
 await page.keyboard.press('Escape');await legacy.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement.id==='legacy-trigger');checks++;
 const mediaSession=await page.context().newCDPSession(page);
 await mediaSession.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-contrast',value:'more'}]});
 assert.equal(await page.evaluate(()=>matchMedia('(prefers-contrast: more)').matches),true);
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('header[data-navigation-material]')).backgroundColor==='rgb(7, 16, 29)');
 assert.equal(await page.locator('header[data-navigation-material]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(7, 16, 29)');checks++;
 await mediaSession.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
 assert.equal(await page.locator('header[data-navigation-material]').evaluate(el=>getComputedStyle(el).backdropFilter),'none');checks++;
 await mediaSession.send('Emulation.setEmulatedMedia',{features:[]});await mediaSession.detach();
 if(folder)await page.screenshot({path:path.join(folder,`dashboard-${width}.png`)});
 await page.getByRole('button',{name:'Notifications',exact:true}).click();
 const bounds=await page.getByRole('region',{name:'Notifications'}).boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);checks++;
 if(folder)await page.screenshot({path:path.join(folder,`notifications-${width}.png`)});
 const notification=page.getByRole('button',{name:/Paiement de demonstration Notification/});await notification.focus();await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>window.auditNavigation),'/payments');checks++;
 if(width<1024){
  const trigger=page.getByRole('button',{name:'Ouvrir le menu',exact:true});await trigger.click();
  const menu=page.getByRole('dialog',{name:'Menu du dashboard'});await menu.waitFor();await page.keyboard.press('Shift+Tab');
  await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
  if(folder)await page.screenshot({path:path.join(folder,`menu-${width}.png`)});
  assert.equal(await menu.evaluate(el=>el.contains(document.activeElement)),true);checks++;
  await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.id==='dashboard-menu-trigger');checks++;
  assert.equal(await page.locator('#audit-name').evaluate(el=>getComputedStyle(el).fontSize),'16px');checks++;
 }
 await page.getByRole('button',{name:'Ouvrir un formulaire long'}).click();
 const dialog=page.getByRole('dialog',{name:'Formulaire de demonstration'});const box=await dialog.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=741);checks++;
 assert.equal(await dialog.evaluate(el=>el.scrollHeight>el.clientHeight&&getComputedStyle(el).overflowY==='auto'),true);checks++;
 await page.getByRole('button',{name:'Terminer',exact:true}).scrollIntoViewIfNeeded();if(folder)await page.screenshot({path:path.join(folder,`dialog-${width}.png`)});
 await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.getByRole('button',{name:'Ouvrir un formulaire long'}).evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration)<.001),true);checks++;
 assert.deepEqual(errors,[]);await page.close();
}
 for(const view of ['admin','docs','admin-shell']){
 const page=await browser.newPage({viewport:{width:390,height:440},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style></head><body><div id="root"></div><script>window.auditView=${JSON.stringify(view)};${script.replaceAll('</script','<\\/script')}</script></body></html>`);
 if(view==='admin'){
 await page.getByRole('textbox',{name:'Email administrateur'}).fill('admin@example.invalid');checks++;
 const button=page.getByRole('button',{name:'Continuer'});await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=441);checks++;
 }else{
 const label=view==='docs'?'Ouvrir le menu de la documentation':'Ouvrir le menu';
 const name=view==='docs'?'Menu de la documentation':'Menu System Core';
 await page.getByRole('button',{name:label,exact:true}).click();const dialog=page.getByRole('dialog',{name});await dialog.waitFor();
 await page.keyboard.press('Shift+Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);checks++;
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:label,exact:true}).evaluate(el=>el===document.activeElement),true);checks++;
 if(view==='docs'){
 for(const w of [390,820,1024,1440]){
 await page.setViewportSize({width:w,height:600});
 const rects=await page.locator('header > div').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right}}));
 assert.ok(rects[0].right<=rects[1].left);checks++;
 }
 await page.setViewportSize({width:820,height:600});
 await page.getByRole('button',{name:"Ouvrir l'assistant documentation"}).click();
 const assistant=page.getByRole('dialog',{name:'Assistant documentation Kobara'});await assistant.waitFor();
 assert.equal(await page.getByRole('button',{name:"Fermer l'assistant"}).isVisible(),true);checks++;
 await page.keyboard.press('Tab');assert.equal(await assistant.evaluate(el=>el.contains(document.activeElement)),true);checks++;
 await page.keyboard.press('Escape');await assistant.waitFor({state:'hidden'});checks++;
 }
 }
 if(folder)await page.screenshot({path:path.join(folder,`${view}.png`)});
 await page.close();
 }
 console.log(`${checks} interface checks passed; real components, no auth or financial calls.`)}finally{await browser.close()}
