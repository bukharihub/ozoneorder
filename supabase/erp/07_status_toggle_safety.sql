begin;

create or replace function public.session_user()
returns public.sys_users
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select u.*
    from public.sys_users u
    join public.sys_sessions s on s.user_id = u.id
    join public.sys_companies c on c.company_code = u.company_code
   where s.token = public.session_token()
     and s.expires_at > now()
     and u.is_active
     and (
       u.role in ('SUPER_ADMIN', 'COMPANY_ADMIN')
       or (c.is_active and c.license_expiry_date >= current_date and not public.demo_expired(c))
     )
   limit 1;
$$;

create or replace function public.update_company_user(
  p_user_id uuid,
  p_is_active boolean default null,
  p_hide_rates boolean default null,
  p_full_name text default null,
  p_role public.user_role default null,
  p_permissions jsonb default null,
  p_bypass_entry_lock boolean default null,
  p_password text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_target public.sys_users%rowtype;
begin
  select * into v_target from public.sys_users where id = p_user_id;
  if not found then raise exception 'User not found'; end if;

  if public.is_super_admin() then
    null;
  elsif public.is_company_admin() and v_target.company_code = public.current_company_code() and v_target.role <> 'SUPER_ADMIN' then
    null;
  else
    raise exception 'Administrator access required';
  end if;

  if p_role = 'SUPER_ADMIN' and not public.is_super_admin() then
    raise exception 'Only a super admin can assign SUPER_ADMIN role';
  end if;

  if p_is_active = false and v_target.id = public.current_user_id() then
    raise exception 'You cannot deactivate your own account';
  end if;

  update public.sys_users
     set is_active = coalesce(p_is_active, is_active),
         hide_rates_and_amounts = case
           when coalesce(p_role, role) = 'CUSTOMER' then coalesce(p_hide_rates, hide_rates_and_amounts, true)
           else coalesce(p_hide_rates, hide_rates_and_amounts)
         end,
         full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
         role = coalesce(p_role, role),
         permissions = case
           when p_permissions is not null then p_permissions
           when p_role is not null and p_role <> role then public.default_user_permissions(p_role)
           else permissions
         end,
         bypass_entry_lock = coalesce(p_bypass_entry_lock, bypass_entry_lock),
         password_hash = case
           when p_password is not null and btrim(p_password) <> '' then extensions.crypt(p_password, extensions.gen_salt('bf'))
           else password_hash
         end
   where id = p_user_id;
end;
$$;

create or replace function public.update_company_settings(
  p_company_code text,
  p_company_name text default null,
  p_city_country text default null,
  p_ntn_strn text default null,
  p_bank_details text default null,
  p_address text default null,
  p_license_expiry_date date default null,
  p_is_demo_mode boolean default null,
  p_demo_started_at timestamptz default null,
  p_owner_contact_info text default null,
  p_max_users integer default null,
  p_entry_lock_date date default null,
  p_is_active boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company public.sys_companies%rowtype;
  v_code text := upper(btrim(p_company_code));
begin
  if not public.is_super_admin() then
    raise exception 'Only SUPER_ADMIN can update company settings';
  end if;

  if p_is_active = false and v_code = public.current_company_code() then
    raise exception 'You cannot deactivate your own company';
  end if;

  update public.sys_companies
     set company_name = coalesce(p_company_name, company_name),
         city_country = coalesce(p_city_country, city_country),
         ntn_strn = coalesce(p_ntn_strn, ntn_strn),
         bank_details = coalesce(p_bank_details, bank_details),
         address = coalesce(p_address, address),
         license_expiry_date = coalesce(p_license_expiry_date, license_expiry_date),
         is_demo_mode = coalesce(p_is_demo_mode, is_demo_mode),
         demo_started_at = case
           when p_is_demo_mode = true and demo_started_at is null and p_demo_started_at is null then now()
           else coalesce(p_demo_started_at, demo_started_at)
         end,
         owner_contact_info = coalesce(p_owner_contact_info, owner_contact_info),
         max_users = coalesce(p_max_users, max_users),
         entry_lock_date = coalesce(p_entry_lock_date, entry_lock_date),
         is_active = coalesce(p_is_active, is_active)
   where upper(company_code) = v_code
   returning * into v_company;

  if not found then raise exception 'Company not found'; end if;
  return to_jsonb(v_company);
end;
$$;

create or replace function public.app_authenticate(
  p_company_code text,
  p_username text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user public.sys_users%rowtype;
  v_company public.sys_companies%rowtype;
  v_token text;
  v_reason text;
begin
  select u.*
    into v_user
    from public.sys_users u
   where upper(u.company_code) = upper(btrim(p_company_code))
     and lower(u.username) = lower(btrim(p_username))
     and (u.is_active or u.role = 'SUPER_ADMIN')
     and extensions.crypt(p_password, u.password_hash) = u.password_hash;

  if not found then
    raise exception 'Invalid company, username or password';
  end if;

  if not v_user.is_active and v_user.role = 'SUPER_ADMIN' then
    update public.sys_users set is_active = true where id = v_user.id returning * into v_user;
  end if;

  select * into v_company from public.sys_companies c where c.company_code = v_user.company_code;
  v_reason := public.company_lock_reason(v_company);

  if v_user.role <> 'SUPER_ADMIN' and v_reason <> '' then
    raise exception '%', v_reason;
  end if;

  if v_user.permissions is null or v_user.permissions = '{}'::jsonb then
    update public.sys_users
       set permissions = public.default_user_permissions(v_user.role)
     where id = v_user.id
     returning * into v_user;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.sys_sessions (token, user_id, company_code, expires_at)
  values (v_token, v_user.id, v_user.company_code, now() + interval '12 hours');

  return jsonb_build_object(
    'token', v_token,
    'user', jsonb_build_object(
      'id', v_user.id,
      'company_code', v_user.company_code,
      'username', v_user.username,
      'full_name', v_user.full_name,
      'role', v_user.role,
      'linked_customer_id', v_user.linked_customer_id,
      'hide_rates_and_amounts', v_user.hide_rates_and_amounts,
      'permissions', coalesce(v_user.permissions, public.default_user_permissions(v_user.role)),
      'bypass_entry_lock', v_user.bypass_entry_lock
    ),
    'company', jsonb_build_object(
      'id', v_company.id,
      'company_code', v_company.company_code,
      'company_name', v_company.company_name,
      'city_country', v_company.city_country,
      'ntn_strn', v_company.ntn_strn,
      'bank_details', v_company.bank_details,
      'address', v_company.address,
      'logo_url', v_company.logo_url,
      'license_expiry_date', v_company.license_expiry_date,
      'is_active', v_company.is_active,
      'is_demo_mode', v_company.is_demo_mode,
      'demo_started_at', v_company.demo_started_at,
      'owner_contact_info', v_company.owner_contact_info,
      'max_users', v_company.max_users,
      'entry_lock_date', v_company.entry_lock_date
    )
  );
end;
$$;

commit;
