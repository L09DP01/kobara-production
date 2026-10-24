import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(file,mocks={}) {
  const code=ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',code)(id=>id in mocks?mocks[id]:require(id),module,module.exports);
  return module.exports;
}
const pending={id:'business-unit',user_id:'owner-unit',identity_owner_merchant_id:'identity-unit',business_verification_status:'pending',kyc_status:'in_review',current_environment:'test',role:'owner'};

test('automatic activation only accepts a positive database decision and reloads the same owned business',async()=>{
  const calls=[];const filters=[];
  let result={data:false,error:null};let reads=0;
  const q={select(){return q;},eq(key,value){filters.push([key,value]);return q;},maybeSingle:async()=>{reads++;return{data:{...pending,kyc_status:'approved',business_verification_status:'approved',current_environment:'live'},error:null};}};
  const db={rpc:async(name,args)=>{calls.push({name,args});return result;},from:()=>q};
  const api=load('../src/lib/server/business-activation.ts',{'server-only':{},'@/utils/supabase/admin':{createAdminClient:()=>db}});
  assert.equal(await api.maybeActivateAdditionalBusiness(pending),pending);
  assert.equal(reads,0);
  result={data:'true',error:null};assert.equal(await api.maybeActivateAdditionalBusiness(pending),pending);
  result={data:true,error:null};
  const active=await api.maybeActivateAdditionalBusiness(pending);
  assert.equal(active.kyc_status,'approved');assert.equal(active.current_environment,'live');assert.equal(active.role,'owner');
  assert.deepEqual(calls[0],{name:'auto_activate_additional_business',args:{p_merchant_id:pending.id,p_user_id:pending.user_id}});
  assert.deepEqual(filters,[['id',pending.id],['user_id',pending.user_id]]);
  const prior=calls.length;
  for(const merchant of [{...pending,identity_owner_merchant_id:null},{...pending,shopify_review_mode:true},{...pending,business_verification_status:'rejected'},{...pending,kyc_status:'suspended'},active]) {
    assert.equal(await api.maybeActivateAdditionalBusiness(merchant),merchant);
  }
  assert.equal(calls.length,prior);
});

test('database failure leaves pending status unchanged and cannot grant production access',async()=>{
  const prior=console.error;console.error=()=>{};
  try {
    for(const rpc of [async()=>({data:null,error:{code:'PGRST202'}}),async()=>{throw new Error('unit-unavailable');}]) {
      const api=load('../src/lib/server/business-activation.ts',{'server-only':{},'@/utils/supabase/admin':{createAdminClient:()=>({rpc})}});
      assert.equal(await api.maybeActivateAdditionalBusiness(pending),pending);
    }
  } finally {console.error=prior;}
});

test('only the Shopify demonstration account is labelled Test',()=>{
  const {businessEnvironmentLabel:label}=load('../src/lib/business-status.ts');
  assert.equal(label(pending),'En validation');
  assert.equal(label({...pending,current_environment:'live'}),'En validation');
  assert.equal(label({...pending,current_environment:'live',kyc_status:'approved'}),'Production');
  assert.equal(label({...pending,shopify_review_mode:true,kyc_status:'approved'}),'Test');
});

test('payment-link updates stay server-only and scoped after an RLS ownership lookup',async()=>{
  const filters=[];let updates=0;let linkMerchant='another-business';
  const ownedQuery={select(){return ownedQuery;},eq(){return ownedQuery;},single:async()=>({data:{merchant_id:linkMerchant}})};
  const updateQuery={update(){updates++;return updateQuery;},eq(key,value){filters.push([key,value]);return updateQuery;},then(resolve){return Promise.resolve({error:null}).then(resolve);}};
  const api=load('../src/app/dashboard/payment-links/actions.ts',{
    '@/utils/supabase/auth-helper':{getCurrentUserAndMerchant:async()=>({merchant:{id:pending.id},supabase:{from:()=>ownedQuery}})},
    '@/utils/supabase/admin':{createAdminClient:()=>({from:()=>updateQuery})},
    'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:()=>{throw new Error('unit-redirect');}},
  });
  const form=new FormData();form.set('id','link-unit');form.set('title','Produit fictif');form.set('amount','100');
  await assert.rejects(api.updatePaymentLink(form),/accès refusé/);assert.equal(updates,0);
  linkMerchant=pending.id;
  await assert.rejects(api.updatePaymentLink(form),/unit-redirect/);
  assert.deepEqual(filters,[['id','link-unit'],['merchant_id',pending.id],['environment','live']]);
  assert.equal(updates,1);
});
