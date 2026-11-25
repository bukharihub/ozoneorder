begin;

drop policy if exists users_read on public.sys_users;
create policy users_read on public.sys_users
  for select to anon, authenticated
  using (
    public.is_super_admin()
    or (
      role <> 'SUPER_ADMIN'::public.user_role
      and company_code = public.current_company_code()
      and (not public.is_customer_user() or id = public.current_user_id())
    )
  );

drop policy if exists users_write on public.sys_users;
create policy users_write on public.sys_users
  for all to anon, authenticated
  using (
    public.is_super_admin()
    or (
      public.is_company_admin()
      and company_code = public.current_company_code()
      and role <> 'SUPER_ADMIN'::public.user_role
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.is_company_admin()
      and company_code = public.current_company_code()
      and role <> 'SUPER_ADMIN'::public.user_role
    )
  );

create or replace function public.list_company_users()
returns setof public.sys_users
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user public.sys_users%rowtype;
begin
  select * into v_user from public.session_user();
  if v_user.id is null then
    raise exception 'Session expired';
  end if;

  if v_user.role = 'SUPER_ADMIN' then
    return query
      select * from public.sys_users
       order by company_code, username;
  elsif v_user.role = 'COMPANY_ADMIN' then
    return query
      select * from public.sys_users
       where company_code = v_user.company_code
         and role <> 'SUPER_ADMIN'::public.user_role
       order by username;
  else
    raise exception 'Administrator access required';
  end if;
end;
$$;

commit;
