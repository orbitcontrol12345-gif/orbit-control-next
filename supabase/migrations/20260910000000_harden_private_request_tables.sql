/*
  Customer request records contain personal and commercial information.
  Orbit Control uses its own signed admin session and server-only Supabase
  credentials, so browser roles must not be able to read or modify them.
*/

begin;

/*
  These tables are optional. The current production project sends form
  submissions by email and does not contain them, while older environments
  may still have them. Keep the migration safe in both cases.
*/
do $migration$
begin
  if to_regclass('public.rfq_requests') is not null then
    alter table public.rfq_requests enable row level security;
    drop policy if exists "Anyone can submit RFQ"
      on public.rfq_requests;
    drop policy if exists "Authenticated users can view RFQ requests"
      on public.rfq_requests;
    drop policy if exists "Authenticated users can update RFQ status"
      on public.rfq_requests;
    revoke all on table public.rfq_requests from anon, authenticated;
    grant select, insert, update on table public.rfq_requests to service_role;
  end if;

  if to_regclass('public.sell_surplus_requests') is not null then
    alter table public.sell_surplus_requests enable row level security;
    drop policy if exists "Anyone can submit surplus offer"
      on public.sell_surplus_requests;
    drop policy if exists "Authenticated users can view surplus requests"
      on public.sell_surplus_requests;
    drop policy if exists "Authenticated users can update surplus status"
      on public.sell_surplus_requests;
    revoke all on table public.sell_surplus_requests from anon, authenticated;
    grant select, insert, update on table public.sell_surplus_requests
      to service_role;
  end if;

  if to_regclass('public.contact_messages') is not null then
    alter table public.contact_messages enable row level security;
    drop policy if exists "Anyone can submit contact message"
      on public.contact_messages;
    drop policy if exists "Authenticated users can view contact messages"
      on public.contact_messages;
    revoke all on table public.contact_messages from anon, authenticated;
    grant select, insert, update on table public.contact_messages
      to service_role;
  end if;
end
$migration$;

commit;
