begin;

drop policy if exists company_read on public.sys_companies;
drop policy if exists company_write on public.sys_companies;
drop policy if exists company_insert on public.sys_companies;
drop policy if exists company_update on public.sys_companies;
drop policy if exists company_delete on public.sys_companies;

create policy company_read on public.sys_companies
  for select to anon, authenticated
  using (public.is_super_admin() or company_code = public.current_company_code());

create policy company_insert on public.sys_companies
  for insert to anon, authenticated
  with check (public.is_super_admin());

create policy company_update on public.sys_companies
  for update to anon, authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy company_delete on public.sys_companies
  for delete to anon, authenticated
  using (public.is_super_admin());

create or replace function public.sys_companies_super_admin_write_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if nullif(public.session_token(), '') is not null and not public.is_super_admin() then
    raise exception 'Only SUPER_ADMIN can modify company profile, settings or logo';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists sys_companies_super_admin_write_guard on public.sys_companies;
create trigger sys_companies_super_admin_write_guard
  before insert or update or delete on public.sys_companies
  for each row execute function public.sys_companies_super_admin_write_guard();

grant execute on function public.sys_companies_super_admin_write_guard() to anon, authenticated;

drop policy if exists "company logos admin write" on storage.objects;
create policy "company logos admin write" on storage.objects
  for all to anon, authenticated
  using (
    bucket_id = 'company-logos'
    and public.is_super_admin()
  )
  with check (
    bucket_id = 'company-logos'
    and public.is_super_admin()
  );

commit;
