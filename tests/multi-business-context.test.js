import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const userId = '10000000-0000-4000-8000-000000000001';
const root = '20000000-0000-4000-8000-000000000001';
const child = '20000000-0000-4000-8000-000000000002';
const memberId = '20000000-0000-4000-8000-000000000003';

function load(path, mocks) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require','module','exports',code)(id => id in mocks ? mocks[id] : require(id),module,module.exports);
  return module.exports;
}

function context() {
  const rows = {
    merchants: [
      { id: child, user_id: userId, business_name: 'Academie Express', created_at: '2026-01-01', available_balance: 12, secret_field: 'unit-placeholder' },
      { id: root, user_id: userId, business_name: 'Academie Centrale', created_at: '2020-01-01', available_balance: 20 },
    ],
    merchant_members: [
      { user_id: userId, status: 'active', role: 'developer', created_at: '2020-01-01', merchants: { id: root, user_id: userId } },
      { user_id: userId, status: 'active', role: 'owner', created_at: '2020-01-01', merchants: { id: memberId, user_id: 'someone-else', business_name: 'Atelier Collaborateur' } },
      { user_id: userId, status: 'active', role: 'admin', created_at: '2020-01-01', merchants: null },
    ],
  };
  const client = { from(table) {
    let result = [...rows[table]];
    const q = { select() { return q; }, eq(key,value) { result=result.filter(r=>r[key]===value); return q; },
      order(key) { result.sort((a,b)=>String(a[key]).localeCompare(String(b[key]))); return q; },
      then(resolve) { return Promise.resolve({ data:result,error:null }).then(resolve); } };
    return q;
  } };
  return load('../src/lib/server/merchant-context.ts', { 'server-only': {}, '@/utils/supabase/admin': { createAdminClient:()=>client } });
}

test('business context uses stable owned fallback, honors explicit selection and never falls back from a forged business', async () => {
  const api=context();
  assert.equal((await api.resolveMerchantContext(userId)).merchant.id,root);
  assert.equal((await api.resolveMerchantContext(userId,child)).merchant.id,child);
  assert.equal((await api.resolveMerchantContext(userId,'40000000-0000-4000-8000-000000000001')).merchant,null);
  assert.equal((await api.resolveMerchantContext(userId,memberId,true)).merchant,null);
  const joined=await api.resolveMerchantContext(userId,memberId);
  assert.equal(joined.userRole,'developer');
  assert.equal((await api.getAccessibleMerchants(userId)).filter(m=>m.id===root).length,1);
  assert.equal((await api.resolveMerchantContext(userId,root)).userRole,'owner');
});

test('switcher options never serialize balances, identity evidence or server fields', async () => {
  const api=context();
  const options=api.merchantSwitcherOptions(await api.getAccessibleMerchants(userId));
  assert.equal(options.length,3);
  for(const option of options) { assert.equal('available_balance' in option,false); assert.equal('secret_field' in option,false); assert.equal('user_id' in option,false); }
});

function actions({ role='owner', allowed=true, loggedIn=true }={}) {
  const calls=[]; const selected=[];
  const contextApi = context();
  const api=load('../src/app/dashboard/businesses/actions.ts', {
    '@/auth': { auth:async()=>loggedIn ? { user:{id:userId},authMethod:'password' } : null },
    'next/headers': { cookies:async()=>({get:()=>({value:role==='owner'?root:memberId}),set:(...args)=>selected.push(args)}) },
    '@/utils/supabase/admin': {createAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:child,error:null};}})},
    '@/lib/server/merchant-context': contextApi,
    '@/lib/business-name': load('../src/lib/business-name.ts',{}),
    '@/app/dashboard/settings/sessions-actions': {ensureAccountSessionIsAllowed:async()=>({allowed})},
  });
  return {api,calls,selected};
}

const details={requestId:'30000000-0000-4000-8000-000000000001',business_name:'Academie Express',category:'services',phone:'+50940000000',address:'Adresse fictive',description:'Activite de formation et services numeriques',website:'https://example.invalid'};

test('creation uses authenticated owner and validated fields, never client-provided financial or KYC values', async()=>{
  const h=actions();
  const result=await h.api.createBusinessAction({...details,user_id:'forged',kyc_status:'approved',available_balance:5000,source_merchant_id:memberId});
  assert.equal(result.success,true);
  assert.equal(h.calls[0].name,'create_additional_business');
  assert.equal(h.calls[0].args.p_user_id,userId); assert.equal(h.calls[0].args.p_source_merchant_id,root);
  assert.equal('available_balance' in h.calls[0].args,false); assert.equal('kyc_status' in h.calls[0].args,false);
  assert.equal(h.selected[0][1],child); assert.equal(h.selected[0][2].sameSite,'lax');
});

test('invalid details, team members and revoked sessions cannot create a business or change its context', async()=>{
  for(const options of [{role:'developer'},{allowed:false},{loggedIn:false}]) {
    const h=actions(options); assert.ok((await h.api.createBusinessAction(details)).error); assert.equal(h.calls.length,0); assert.equal(h.selected.length,0);
  }
  const h=actions(); assert.ok((await h.api.createBusinessAction({...details,description:'short'})).error); assert.equal(h.calls.length,0);
  assert.ok((await h.api.switchBusinessAction('invalid')).error);
  assert.ok((await h.api.switchBusinessAction('40000000-0000-4000-8000-000000000001')).error);
  assert.equal(h.selected.length,0);
  assert.equal((await h.api.switchBusinessAction(child)).success,true);
});

test('API-key authentication remains bound to its business independently of the selected dashboard cookie', async()=>{
  const oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://unit.example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY='unit-placeholder-only';
  try {
    const key={id:'unit-key',merchant_id:child,environment:'live',revoked_at:null,created_by_type:'merchant',scopes:['payments:create']};
    const client={from(table){const q={select(){return q;},eq(){return q;},update(){return q;},
      single:async()=>({data:key,error:null}),
      maybeSingle:async()=>({data:{kyc_status:'approved',status:'active',account_access:'active'},error:null}),
      then:resolve=>Promise.resolve({error:null}).then(resolve)};return q;}};
    const api=load('../src/lib/server/auth/api-auth.ts',{
      'next/server':{},'@supabase/ssr':{createServerClient:()=>client},
      '@/lib/server/security/api-keys':{ApiKeySecurity:{hashKey:()=> 'unit-hash'}},
      '@/auth':{auth:()=>{throw new Error('API key must not use browser auth');}},
      'next/headers':{cookies:()=>{throw new Error('API key must not use the selected cookie');}},
      '@/utils/supabase/admin':{},'@/lib/server/merchant-context':{},
    });
    const result=await api.authenticateApiRequest({headers:new Headers({Authorization:'Bearer kbr_sk_unit-placeholder'})},{requiredScope:'payments:create'});
    assert.equal(result.merchantId,child);assert.equal(result.apiKeyId,'unit-key');assert.equal(result.error,null);
  } finally {
    if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
  }
});

test('session revocation is checked at account level and cannot be bypassed by another business selection', async()=>{
  let row={revoked_at:'2026-01-01',status:'revoked',is_active:false};
  let lookupError=null;const filters=[];
  const q={select(){return q;},eq(key,value){filters.push(key);return q;},maybeSingle:async()=>({data:row,error:lookupError})};
  const api=load('../src/app/dashboard/settings/sessions-actions.ts',{
    '@/utils/supabase/auth-helper':{getCurrentUserAndMerchant:()=>{throw new Error('Account check must not depend on selected business');}},
    '@/utils/supabase/admin':{createAdminClient:()=>({from:()=>q})},
    'next/cache':{},'next/headers':{cookies:async()=>({get:name=>name==='next-auth.session-token'?{value:'unit-session-placeholder'}:undefined}),headers:async()=>new Headers()},
    '@/lib/utils/parse-user-agent':{},'@/auth':{auth:async()=>({user:{id:userId}})},
  });
  assert.equal((await api.ensureAccountSessionIsAllowed()).allowed,false);
  assert.equal((await api.ensureCurrentSessionIsAllowed()).allowed,false);
  assert.equal(filters.includes('merchant_id'),false);
  row={status:'active',is_active:true};
  assert.equal((await api.ensureAccountSessionIsAllowed()).allowed,true);
  lookupError={message:'unit-database-error'};
  assert.equal((await api.ensureAccountSessionIsAllowed()).allowed,false);
});

test('a reused browser Supabase client reads the current business for every request and preserves authorization', async()=>{
  const oldDocument=globalThis.document;const oldFetch=globalThis.fetch;const observed=[];
  try {
    globalThis.document={cookie:`kobara_active_merchant=${root}`};
    globalThis.fetch=async(input,init)=>{observed.push(new Headers(init.headers));return new Response('{}');};
    const api=load('../src/utils/supabase/client.ts',{'@supabase/ssr':{createBrowserClient:(url,key,options)=>options}});
    const options=api.createClient();
    await options.global.fetch('https://unit.example.invalid',{headers:{Authorization:'Bearer unit-placeholder'}});
    globalThis.document.cookie=`kobara_active_merchant=${child}`;
    await options.global.fetch('https://unit.example.invalid',{headers:{Authorization:'Bearer unit-placeholder'}});
    assert.equal(observed[0].get('x-kobara-merchant-id'),root);
    assert.equal(observed[1].get('x-kobara-merchant-id'),child);
    assert.equal(observed[1].get('Authorization'),'Bearer unit-placeholder');
  } finally {
    if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
    globalThis.fetch=oldFetch;
  }
});
