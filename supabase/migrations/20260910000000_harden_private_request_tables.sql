/*
  Customer request records contain personal and commercial information.
  Orbit Control uses its own signed admin session and server-only Supabase
  credentials, so browser roles must not be able to read or modify them.
*/

begin;

alter table public.rfq_requests enable row level security;
alter table public.sell_surplus_requests enable row level security;
alter table public.contact_messages enable row level security;

drop policy if exists "Anyone can submit RFQ"
  on public.rfq_requests;
drop policy if exists "Authenticated users can view RFQ requests"
  on public.rfq_requests;
drop policy if exists "Authenticated users can update RFQ status"
  on public.rfq_requests;

drop policy if exists "Anyone can submit surplus offer"
  on public.sell_surplus_requests;
drop policy if exists "Authenticated users can view surplus requests"
  on public.sell_surplus_requests;
drop policy if exists "Authenticated users can update surplus status"
  on public.sell_surplus_requests;

drop policy if exists "Anyone can submit contact message"
  on public.contact_messages;
drop policy if exists "Authenticated users can view contact messages"
  on public.contact_messages;

revoke all on table public.rfq_requests from anon, authenticated;
revoke all on table public.sell_surplus_requests from anon, authenticated;
revoke all on table public.contact_messages from anon, authenticated;

grant select, insert, update on table public.rfq_requests to service_role;
grant select, insert, update on table public.sell_surplus_requests to service_role;
grant select, insert, update on table public.contact_messages to service_role;

commit;
