alter table public.legal_documents add column if not exists published_at timestamptz;
create unique index if not exists legal_cgu_published_version
  on public.legal_documents(version) where doc_type = 'cgu' and published_at is not null;

create table public.cgu_notices (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.legal_documents(id),
  email text not null,
  state text not null default 'pending' check (state in ('pending','sending','accepted','review','skipped')),
  unique (document_id, email)
);
alter table public.cgu_notices enable row level security;
revoke all on public.cgu_notices from anon, authenticated;
grant select, insert, update on public.cgu_notices to service_role;
create index cgu_notices_pending on public.cgu_notices(id) where state = 'pending';

create function public.publish_cgu(p_version text, p_title text, p_content text, p_hash text, p_admin uuid)
returns uuid language plpgsql set search_path = '' as $$
declare document uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(6942291);
  if exists (select 1 from public.legal_documents where doc_type = 'cgu' and published_at is not null and content_hash = p_hash) then
    raise exception 'CGU content already published';
  end if;
  insert into public.legal_documents(doc_type, version, title, content, content_hash, uploaded_by, published_at)
    values ('cgu', p_version, p_title, p_content, p_hash, p_admin, clock_timestamp())
    returning id into document;
  insert into public.cgu_notices(document_id, email)
    select distinct document, lower(btrim(email)) from public.merchants
    where email is not null and btrim(email) ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
      and shopify_review_mode is not true;
  return document;
end;
$$;

create function public.claim_cgu_notice()
returns table(id bigint, email text, version text) language sql set search_path = '' as $$
  with claimed as (
    update public.cgu_notices n set state = 'sending'
    where n.id = (select q.id from public.cgu_notices q where q.state = 'pending' order by q.id limit 1 for update skip locked)
    returning n.id, n.email, n.document_id
  )
  select c.id, c.email, d.version from claimed c join public.legal_documents d on d.id = c.document_id;
$$;
revoke execute on function public.publish_cgu(text,text,text,text,uuid), public.claim_cgu_notice() from public, anon, authenticated;
grant execute on function public.publish_cgu(text,text,text,text,uuid), public.claim_cgu_notice() to service_role;
