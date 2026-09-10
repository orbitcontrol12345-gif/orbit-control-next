/*
  Orbit Control accesses Supabase only from server-side code with a secret
  API key. Browser roles therefore need no access to the public database
  schema or to Storage mutation/listing APIs.

  The manual-products bucket stays public so existing product image URLs keep
  working. Only listing and anonymous uploads are removed.
*/

begin;

/* Block browser roles at both the schema and object privilege layers. */
revoke usage on schema public from public, anon, authenticated;
grant usage on schema public to service_role;

revoke all privileges on all tables in schema public
  from public, anon, authenticated;
grant all privileges on all tables in schema public to service_role;

revoke all privileges on all sequences in schema public
  from public, anon, authenticated;
grant all privileges on all sequences in schema public to service_role;

revoke execute on all functions in schema public
  from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

/* Keep objects created by future postgres-owned migrations server-only. */
alter default privileges in schema public
  revoke all privileges on tables from public, anon, authenticated;
alter default privileges in schema public
  grant all privileges on tables to service_role;

alter default privileges in schema public
  revoke all privileges on sequences from public, anon, authenticated;
alter default privileges in schema public
  grant all privileges on sequences to service_role;

alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public
  grant execute on functions to service_role;

/* Ensure the catalog view cannot bypass underlying table RLS. */
alter view if exists public.products_display_unique
  set (security_invoker = true);

/* Pin function lookup paths to trusted built-in objects. */
do $migration$
begin
  if to_regprocedure('public.clean_product_title(text)') is not null then
    alter function public.clean_product_title(text)
      set search_path = pg_catalog;
  end if;

  if to_regprocedure('public.set_brand_updated_at()') is not null then
    alter function public.set_brand_updated_at()
      set search_path = pg_catalog;
  end if;
end
$migration$;

/*
  Public buckets do not require a SELECT policy for public asset delivery.
  Removing these policies stops anonymous file listing and uploads.
*/
drop policy if exists "Allow public read from manual-products"
  on storage.objects;
drop policy if exists "Allow public upload to manual-products"
  on storage.objects;

/* Mirror the server upload validation at the bucket boundary. */
update storage.buckets
set
  file_size_limit = 8388608,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
where id = 'manual-products';

commit;
