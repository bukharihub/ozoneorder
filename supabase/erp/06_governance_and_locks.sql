begin;

alter table public.sys_companies
  add column if not exists is_demo_mode boolean not null default false,
  add column if not exists demo_started_at timestamptz,
  add column if not exists owner_contact_info text not null default '',
  add column if not exists max_users integer,
  add column if not exists entry_lock_date date;

alter table public.sys_users
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists bypass_entry_lock boolean not null default false;

update public.sys_companies
   set demo_started_at = coalesce(demo_started_at, created_at, now())
 where is_demo_mode = true and demo_started_at is null;

create or replace function public.default_user_permissions(p_role public.user_role)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_role
    when 'SUPER_ADMIN' then jsonb_build_object(
      'sales_order', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true, 'print', true),
      'gdn_gate_pass', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true, 'print', true),
      'sales_tax_invoice', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true, 'print', true),
      'bank_receipt', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true, 'print', true),
      'ledger_reports', jsonb_build_object('view', true, 'print', true),
      'products_customers', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true)
    )
    when 'COMPANY_ADMIN' then jsonb_build_object(
      'sales_order', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true, 'print', true),
      'gdn_gate_pass', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true, 'print', true),
      'sales_tax_invoice', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true, 'print', true),
      'bank_receipt', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true, 'print', true),
      'ledger_reports', jsonb_build_object('view', true, 'print', true),
      'products_customers', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true)
    )
    when 'STORE_FG' then jsonb_build_object(
      'sales_order', jsonb_build_object('view', true, 'create', false, 'edit', false, 'delete', false, 'print', true),
      'gdn_gate_pass', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true, 'print', true),
      'sales_tax_invoice', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false, 'print', false),
      'bank_receipt', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false, 'print', false),
      'ledger_reports', jsonb_build_object('view', false, 'print', false),
      'products_customers', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false)
    )
    when 'ACCOUNTS' then jsonb_build_object(
      'sales_order', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false, 'print', false),
      'gdn_gate_pass', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false, 'print', false),
      'sales_tax_invoice', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true, 'print', true),
      'bank_receipt', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true, 'print', true),
      'ledger_reports', jsonb_build_object('view', true, 'print', true),
      'products_customers', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false)
    )
    when 'CUSTOMER' then jsonb_build_object(
      'sales_order', jsonb_build_object('view', true, 'create', true, 'edit', false, 'delete', false, 'print', true),
      'gdn_gate_pass', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false, 'print', false),
      'sales_tax_invoice', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false, 'print', false),
      'bank_receipt', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false, 'print', false),
      'ledger_reports', jsonb_build_object('view', false, 'print', false),
      'products_customers', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false)
    )
    else '{}'::jsonb
  end;
$$;

update public.sys_users
   set permissions = public.default_user_permissions(role)
 where permissions is null or permissions = '{}'::jsonb;

create or replace function public.trg_sys_users_defaults()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.role = 'CUSTOMER' then
    new.hide_rates_and_amounts := true;
  end if;
  if new.permissions is null or new.permissions = '{}'::jsonb then
    new.permissions := public.default_user_permissions(new.role);
  end if;
  return new;
end;
$$;

create or replace function public.demo_expired(p_company public.sys_companies)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(p_company.is_demo_mode, false)
     and coalesce(p_company.demo_started_at, p_company.created_at, now()) + interval '7 days' <= now();
$$;

create or replace function public.company_lock_reason(p_company public.sys_companies)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when not p_company.is_active then 'Company is inactive. Contact the Owner/Administrator.'
    when public.demo_expired(p_company) then 'Demo Period (7 Days) Has Expired — System Auto-Locked. Please contact the Owner to activate your full license.'
    when p_company.license_expiry_date < current_date then 'License Expired – Contact Administrator'
    else ''
  end;
$$;

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
       u.role = 'SUPER_ADMIN'
       or (c.is_active and c.license_expiry_date >= current_date and not public.demo_expired(c))
     )
   limit 1;
$$;

create or replace function public.check_company(p_company_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company public.sys_companies%rowtype;
  v_reason text;
begin
  select * into v_company
    from public.sys_companies
   where upper(company_code) = upper(btrim(p_company_code));

  if not found then
    return jsonb_build_object(
      'exists', false,
      'locked', false,
      'company_name', '',
      'message', 'Company code not found',
      'logo_url', '',
      'is_demo_mode', false,
      'demo_started_at', null,
      'owner_contact_info', '',
      'demo_expired', false
    );
  end if;

  v_reason := public.company_lock_reason(v_company);

  return jsonb_build_object(
    'exists', true,
    'locked', v_reason <> '',
    'company_name', v_company.company_name,
    'message', v_reason,
    'logo_url', v_company.logo_url,
    'is_demo_mode', v_company.is_demo_mode,
    'demo_started_at', v_company.demo_started_at,
    'owner_contact_info', v_company.owner_contact_info,
    'demo_expired', public.demo_expired(v_company)
  );
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
     and u.is_active
     and extensions.crypt(p_password, u.password_hash) = u.password_hash;

  if not found then
    raise exception 'Invalid company, username or password';
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

create or replace function public.factory_reset_company(p_company_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := upper(btrim(p_company_code));
  v_company public.sys_companies%rowtype;
  v_products text := lower(v_code) || '_products';
  v_ledger text := lower(v_code) || '_master_ledger';
  v_deleted bigint := 0;
  v_counters bigint := 0;
begin

  if not public.is_super_admin() then
    raise exception 'Only SUPER_ADMIN can factory reset company data';
  end if;

  select * into v_company
    from public.sys_companies
   where upper(company_code) = v_code;

  if not found then
    raise exception 'Company not found';
  end if;

  if to_regclass('public.' || v_ledger) is null or to_regclass('public.' || v_products) is null then
    raise exception 'Company tables do not exist';
  end if;

  execute format('delete from public.%I', v_ledger);
  get diagnostics v_deleted = row_count;

  execute format(
    'update public.%I
        set current_stock_ctns = opening_stock_ctns,
            current_stock_pcs = opening_stock_ctns * greatest(pcs_per_carton, 1)',
    v_products
  );

  update public.sys_counters
     set last_number = 0
   where upper(company_code) = v_code;
  get diagnostics v_counters = row_count;

  return jsonb_build_object(
    'company_code', v_code,
    'deleted_ledger_rows', v_deleted,
    'reset_counters', v_counters,
    'status', 'ok'
  );

end;
$$;

create or replace function public.extend_company_demo(p_company_code text, p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company public.sys_companies%rowtype;
  v_base timestamptz;
begin
  if not public.is_super_admin() then
    raise exception 'Only SUPER_ADMIN can manage demo licenses';
  end if;

  select * into v_company from public.sys_companies where upper(company_code) = upper(btrim(p_company_code));
  if not found then raise exception 'Company not found'; end if;

  v_base := greatest(coalesce(v_company.demo_started_at, v_company.created_at, now()), now());
  update public.sys_companies
     set is_demo_mode = true,
         demo_started_at = v_base + make_interval(days => greatest(coalesce(p_days, 7), 1)),
         is_active = true
   where id = v_company.id
   returning * into v_company;

  return to_jsonb(v_company);
end;
$$;

create or replace function public.convert_company_to_full_license(p_company_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company public.sys_companies%rowtype;
begin
  if not public.is_super_admin() then
    raise exception 'Only SUPER_ADMIN can manage demo licenses';
  end if;

  update public.sys_companies
     set is_demo_mode = false,
         is_active = true
   where upper(company_code) = upper(btrim(p_company_code))
   returning * into v_company;

  if not found then raise exception 'Company not found'; end if;
  return to_jsonb(v_company);
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

create or replace function public.create_company(
  p_company_code text,
  p_company_name text,
  p_city_country text default '',
  p_ntn_strn text default '',
  p_bank_details text default '',
  p_address text default '',
  p_license_expiry_date date default (current_date + interval '1 year')::date,
  p_admin_password text default 'admin123',
  p_is_demo_mode boolean default false,
  p_demo_started_at timestamptz default null,
  p_owner_contact_info text default '',
  p_max_users integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := upper(btrim(p_company_code));
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required';
  end if;

  if v_code !~ '^[A-Z][A-Z0-9_]{0,19}$' then
    raise exception 'Company code must be 1-20 uppercase letters, numbers or underscores';
  end if;

  if to_regclass('public.' || lower(v_code) || '_products') is not null then
    raise exception 'Tables for this company already exist';
  end if;

  insert into public.sys_companies (
    company_code, company_name, city_country, ntn_strn, bank_details, address,
    license_expiry_date, is_active, is_demo_mode, demo_started_at, owner_contact_info, max_users
  ) values (
    v_code, p_company_name, p_city_country, p_ntn_strn, p_bank_details, p_address,
    p_license_expiry_date, true, coalesce(p_is_demo_mode, false),
    case when coalesce(p_is_demo_mode, false) then coalesce(p_demo_started_at, now()) else p_demo_started_at end,
    coalesce(p_owner_contact_info, ''), p_max_users
  );

  perform public.create_company_tables(v_code);

  insert into public.sys_users (company_code, username, password_hash, full_name, role, is_active, permissions, bypass_entry_lock)
  values (
    v_code, 'admin',
    extensions.crypt(p_admin_password, extensions.gen_salt('bf')),
    'Company Administrator', 'COMPANY_ADMIN', true,
    public.default_user_permissions('COMPANY_ADMIN'), false
  );

  return jsonb_build_object('company_code', v_code, 'company_name', p_company_name);
end;
$$;

create or replace function public.create_company_user(
  p_company_code text,
  p_username text,
  p_password text,
  p_full_name text,
  p_role public.user_role,
  p_linked_customer_id uuid default null,
  p_hide_rates boolean default false,
  p_permissions jsonb default null,
  p_bypass_entry_lock boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := upper(btrim(p_company_code));
  v_id uuid;
  v_max integer;
  v_count integer;
  v_perms jsonb;
begin
  if not (public.is_super_admin() or (public.is_company_admin() and v_code = public.current_company_code())) then
    raise exception 'Administrator access required';
  end if;

  if p_role = 'SUPER_ADMIN' and not public.is_super_admin() then
    raise exception 'Only a super admin can create super admins';
  end if;

  if public.is_company_admin() and not public.is_super_admin() and v_code <> public.current_company_code() then
    raise exception 'Cannot manage users outside your company';
  end if;

  select max_users into v_max from public.sys_companies where upper(company_code) = v_code;
  if v_max is not null then
    select count(*) into v_count from public.sys_users where upper(company_code) = v_code and is_active;
    if v_count >= v_max then
      raise exception 'Company user limit reached (%). Contact SUPER_ADMIN.', v_max;
    end if;
  end if;

  v_perms := coalesce(p_permissions, public.default_user_permissions(p_role));

  insert into public.sys_users (
    company_code, username, password_hash, full_name, role, linked_customer_id,
    hide_rates_and_amounts, permissions, bypass_entry_lock
  ) values (
    v_code, btrim(p_username),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    btrim(p_full_name), p_role, p_linked_customer_id,
    case when p_role = 'CUSTOMER' then true else p_hide_rates end,
    v_perms, coalesce(p_bypass_entry_lock, false)
  )
  returning id into v_id;

  return v_id;
end;
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

create or replace function public.change_own_password(
  p_current_password text,
  p_new_password text
)
returns void
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

  if extensions.crypt(p_current_password, v_user.password_hash) <> v_user.password_hash then
    raise exception 'Current password is incorrect';
  end if;

  if length(btrim(coalesce(p_new_password, ''))) < 6 then
    raise exception 'New password must be at least 6 characters';
  end if;

  update public.sys_users
     set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf'))
   where id = v_user.id;
end;
$$;

create or replace function public.user_has_permission(p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.is_super_admin() then true
    else coalesce((select (u.permissions -> p_module ->> p_action)::boolean from public.session_user() u), false)
  end;
$$;

create or replace function public.can_bypass_entry_lock()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.session_user() u
     where u.role in ('SUPER_ADMIN', 'COMPANY_ADMIN')
        or coalesce(u.bypass_entry_lock, false)
  );
$$;

create or replace function public.ledger_mutation_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := upper(regexp_replace(TG_TABLE_NAME, '_master_ledger$', ''));
  v_user public.sys_users%rowtype;
  v_company public.sys_companies%rowtype;
  v_row_voucher_type public.voucher_type;
  v_row_voucher_no text;
  v_row_voucher_date date;
  v_row_created_at timestamptz;
  v_age_locked boolean;
  v_cutoff_locked boolean;
  v_linked_gdn_count integer;
  v_invoice_count integer;
  v_receipt_count integer;
  v_ledger text := TG_TABLE_NAME;
  v_module text;
  v_action text;
begin
  select * into v_user from public.session_user();
  if v_user.id is null then raise exception 'Session expired'; end if;

  select * into v_company from public.sys_companies where upper(company_code) = v_code;
  if v_user.role <> 'SUPER_ADMIN' and v_company.id is not null then
    if not v_company.is_active or public.demo_expired(v_company) or v_company.license_expiry_date < current_date then
      raise exception 'Company is locked';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    v_row_voucher_type := old.voucher_type; v_row_voucher_no := old.voucher_no; v_row_voucher_date := old.voucher_date; v_row_created_at := old.created_at;
  else
    v_row_voucher_type := old.voucher_type; v_row_voucher_no := old.voucher_no; v_row_voucher_date := old.voucher_date; v_row_created_at := old.created_at;
  end if;

  v_module := case v_row_voucher_type
    when 'SALES_ORDER' then 'sales_order'
    when 'GDN_GATE_PASS' then 'gdn_gate_pass'
    when 'SALES_TAX_INVOICE' then 'sales_tax_invoice'
    when 'BANK_RECEIPT' then 'bank_receipt'
    else null
  end;
  v_action := case when TG_OP = 'DELETE' then 'delete' else 'edit' end;
  if v_user.role <> 'SUPER_ADMIN' and v_module is not null then
    if not coalesce((v_user.permissions -> v_module ->> v_action)::boolean, false) then
      raise exception 'Permission denied: % %', v_action, v_module;
    end if;
  end if;

  v_age_locked := (current_date - v_row_voucher_date > 3) or (now() - v_row_created_at > interval '3 days');
  v_cutoff_locked := v_company.entry_lock_date is not null and v_row_voucher_date <= v_company.entry_lock_date;
  if (v_age_locked or v_cutoff_locked) and not (v_user.role in ('SUPER_ADMIN', 'COMPANY_ADMIN') or coalesce(v_user.bypass_entry_lock, false)) then
    if v_cutoff_locked then raise exception 'Locked: Entry cutoff date has passed'; end if;
    raise exception 'Auto-Locked (>3 Days): only SUPER_ADMIN/COMPANY_ADMIN or bypass user can modify this record';
  end if;

  if v_row_voucher_type = 'SALES_ORDER' then
    execute format('select count(*) from public.%I where voucher_type = ''GDN_GATE_PASS'' and linked_so_no = $1', v_ledger) into v_linked_gdn_count using v_row_voucher_no;
    if coalesce(v_linked_gdn_count, 0) > 0 then raise exception 'Locked: Delivery/GDN already processed'; end if;
  elsif v_row_voucher_type = 'GDN_GATE_PASS' then
    execute format('select count(*) from public.%I where voucher_type = ''SALES_TAX_INVOICE'' and linked_gdn_no = $1', v_ledger) into v_invoice_count using v_row_voucher_no;
    if coalesce(v_invoice_count, 0) > 0 then raise exception 'Locked: Sales Tax Invoice already generated'; end if;
  elsif v_row_voucher_type = 'SALES_TAX_INVOICE' then
    execute format('select count(*) from public.%I where voucher_type = ''BANK_RECEIPT'' and linked_gdn_no = $1', v_ledger) into v_receipt_count using v_row_voucher_no;
    if coalesce(v_receipt_count, 0) > 0 then raise exception 'Locked: Bank Receipt already posted'; end if;
  end if;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
create or replace function public.ledger_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.sys_users%rowtype;
  v_module text;
begin
  select * into v_user from public.session_user();
  if v_user.id is null then raise exception 'Session expired'; end if;
  v_module := case new.voucher_type
    when 'SALES_ORDER' then 'sales_order'
    when 'GDN_GATE_PASS' then 'gdn_gate_pass'
    when 'SALES_TAX_INVOICE' then 'sales_tax_invoice'
    when 'BANK_RECEIPT' then 'bank_receipt'
    else null
  end;
  if v_user.role <> 'SUPER_ADMIN' and v_module is not null then
    if not coalesce((v_user.permissions -> v_module ->> 'create')::boolean, false) then
      raise exception 'Permission denied: create %', v_module;
    end if;
  end if;
  return new;
end;
$$;
create or replace function public.create_company_tables(p_company_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := lower(btrim(p_company_code));
  v_products text;
  v_customers text;
  v_ledger text;
begin
  if v_code !~ '^[a-z][a-z0-9_]{0,19}$' then
    raise exception 'Company code must be 1-20 lowercase letters, numbers or underscores';
  end if;

  v_products := v_code || '_products';
  v_customers := v_code || '_customers';
  v_ledger := v_code || '_master_ledger';

  execute format('drop table if exists public.%I cascade', v_ledger);
  execute format('drop table if exists public.%I cascade', v_products);
  execute format('drop table if exists public.%I cascade', v_customers);

  execute format($ddl$
    create table public.%I (
      id uuid primary key default extensions.gen_random_uuid(),
      size_category text not null check (size_category in ('NB', 'S', 'M', 'L', 'XL', 'XXL')),
      product_type public.product_type not null,
      product_name text not null,
      hs_code text not null default '9619.0090',
      diapers_per_bag integer not null check (diapers_per_bag > 0),
      bags_per_carton integer not null check (bags_per_carton > 0),
      pcs_per_carton integer generated always as (diapers_per_bag * bags_per_carton) stored,
      opening_stock_ctns numeric(14,3) not null default 0,
      current_stock_ctns numeric(14,3) not null default 0,
      current_stock_pcs numeric(14,3) not null default 0,
      per_diaper_rate numeric(16,6) not null default 0,
      per_carton_rate numeric(16,2) not null default 0,
      created_at timestamptz not null default now()
    )
  $ddl$, v_products);

  execute format($ddl$
    create table public.%I (
      id uuid primary key default extensions.gen_random_uuid(),
      cnic_ntn text not null default '',
      strn text not null default '',
      business_name text not null,
      delivery_destination text not null default '',
      registration_status public.registration_status not null,
      income_tax_status public.income_tax_status not null,
      tax_rate_236g numeric(8,5) not null default 0.001,
      opening_balance numeric(14,2) not null default 0,
      created_at timestamptz not null default now()
    )
  $ddl$, v_customers);

  execute format($ddl$
    create table public.%I (
      id uuid primary key default extensions.gen_random_uuid(),
      voucher_type public.voucher_type not null,
      voucher_no text not null,
      linked_so_no text not null default '',
      linked_gdn_no text not null default '',
      voucher_date date not null default current_date,
      customer_id uuid,
      customer_name text not null default '',
      ship_to_name text not null default '',
      ship_to_address text not null default '',
      cnic_ntn text not null default '',
      strn text not null default '',
      filer_status text not null default '',
      registration_status text not null default 'Unregister',
      vehicle_1 text not null default '',
      driver_1 text not null default '',
      remarks_1 text not null default '',
      vehicle_2 text not null default '',
      driver_2 text not null default '',
      remarks_2 text not null default '',
      outward_time text not null default '',
      line_items jsonb not null default '[]'::jsonb,
      total_cartons numeric(14,3) not null default 0,
      total_pcs numeric(14,3) not null default 0,
      total_exclusive_value numeric(16,2) not null default 0,
      sales_tax_18 numeric(16,2) not null default 0,
      further_tax_4 numeric(16,2) not null default 0,
      amount_before_236g numeric(16,2) not null default 0,
      advance_tax_236g numeric(16,2) not null default 0,
      net_invoice_total numeric(16,2) not null default 0,
      bank_receipt_amount numeric(16,2) not null default 0,
      bank_reference text not null default '',
      amount_in_words text not null default '',
      status public.voucher_status not null default 'PENDING',
      created_by text not null default '',
      created_at timestamptz not null default now()
    )
  $ddl$, v_ledger);

  execute format('create index %I on public.%I (voucher_type, voucher_no)', v_ledger || '_type_no_idx', v_ledger);
  execute format('create index %I on public.%I (linked_so_no)', v_ledger || '_so_idx', v_ledger);
  execute format('create index %I on public.%I (customer_id, voucher_date)', v_ledger || '_customer_idx', v_ledger);
  execute format('create index %I on public.%I (product_type, product_name)', v_products || '_type_name_idx', v_products);

  execute format('create trigger %I after insert on public.%I for each row execute function public.trg_products_stock_init()', v_products || '_stock_init', v_products);
  execute format('create trigger %I before insert or update of income_tax_status on public.%I for each row execute function public.trg_customers_tax_rate()', v_customers || '_tax_rate', v_customers);
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.trg_master_ledger_stock()', v_ledger || '_stock', v_ledger);
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.trg_ledger_sync_order()', v_ledger || '_sync_order', v_ledger);
  execute format('create trigger %I before update or delete on public.%I for each row execute function public.ledger_mutation_guard()', v_ledger || '_mutation_guard', v_ledger);
  execute format('create trigger %I before insert on public.%I for each row execute function public.ledger_insert_guard()', v_ledger || '_insert_guard', v_ledger);

  execute format('alter table public.%I enable row level security', v_products);
  execute format('alter table public.%I enable row level security', v_customers);
  execute format('alter table public.%I enable row level security', v_ledger);

  execute format('drop policy if exists tenant_read on public.%I', v_products);
  execute format('create policy tenant_read on public.%I for select to anon, authenticated using (public.allowed_company(%L))', v_products, v_code);
  execute format('drop policy if exists tenant_write on public.%I', v_products);
  execute format('create policy tenant_write on public.%I for all to anon, authenticated using (public.allowed_company(%L) and not public.is_customer_user()) with check (public.allowed_company(%L) and not public.is_customer_user())', v_products, v_code, v_code);

  execute format('drop policy if exists tenant_read on public.%I', v_customers);
  execute format('create policy tenant_read on public.%I for select to anon, authenticated using (public.allowed_company(%L))', v_customers, v_code);
  execute format('drop policy if exists tenant_write on public.%I', v_customers);
  execute format('create policy tenant_write on public.%I for all to anon, authenticated using (public.allowed_company(%L) and not public.is_customer_user()) with check (public.allowed_company(%L) and not public.is_customer_user())', v_customers, v_code, v_code);

  execute format('drop policy if exists tenant_read on public.%I', v_ledger);
  execute format('create policy tenant_read on public.%I for select to anon, authenticated using (public.allowed_company(%L) and (not public.is_customer_user() or customer_id = public.current_linked_customer_id()))', v_ledger, v_code);
  execute format('drop policy if exists tenant_insert on public.%I', v_ledger);
  execute format($policy$
    create policy tenant_insert on public.%I for insert to anon, authenticated
    with check (
      public.allowed_company(%L)
      and public.current_user_role() in ('CUSTOMER', 'STORE_FG', 'ACCOUNTS', 'COMPANY_ADMIN', 'SUPER_ADMIN')
      and (
        (voucher_type = 'SALES_ORDER' and public.current_user_role() in ('CUSTOMER', 'COMPANY_ADMIN', 'SUPER_ADMIN'))
        or (voucher_type = 'GDN_GATE_PASS' and public.current_user_role() in ('STORE_FG', 'COMPANY_ADMIN', 'SUPER_ADMIN'))
        or (voucher_type in ('SALES_TAX_INVOICE', 'BANK_RECEIPT') and public.current_user_role() in ('ACCOUNTS', 'COMPANY_ADMIN', 'SUPER_ADMIN'))
      )
    )
  $policy$, v_ledger, v_code);
  execute format('drop policy if exists tenant_write on public.%I', v_ledger);
  execute format('drop policy if exists tenant_update on public.%I', v_ledger);
  execute format('create policy tenant_update on public.%I for update to anon, authenticated using (public.allowed_company(%L) and not public.is_customer_user()) with check (public.allowed_company(%L) and not public.is_customer_user())', v_ledger, v_code, v_code);
  execute format('drop policy if exists tenant_delete on public.%I', v_ledger);
  execute format('create policy tenant_delete on public.%I for delete to anon, authenticated using (public.allowed_company(%L) and not public.is_customer_user())', v_ledger, v_code);

  execute format('grant select, insert, update, delete on public.%I to anon, authenticated', v_products);
  execute format('grant select, insert, update, delete on public.%I to anon, authenticated', v_customers);
  execute format('grant select, insert, update, delete on public.%I to anon, authenticated', v_ledger);
end;
$$;

do $$
declare
  r record;
  v_ledger text;
begin
  for r in
    select lower(company_code) as code
      from public.sys_companies
  loop
    v_ledger := r.code || '_master_ledger';
    if to_regclass('public.' || v_ledger) is not null then
      execute format('drop trigger if exists %I on public.%I', v_ledger || '_mutation_guard', v_ledger);
      execute format('create trigger %I before update or delete on public.%I for each row execute function public.ledger_mutation_guard()', v_ledger || '_mutation_guard', v_ledger);
      execute format('drop trigger if exists %I on public.%I', v_ledger || '_insert_guard', v_ledger);
      execute format('create trigger %I before insert on public.%I for each row execute function public.ledger_insert_guard()', v_ledger || '_insert_guard', v_ledger);
      execute format('drop policy if exists tenant_write on public.%I', v_ledger);
      execute format('drop policy if exists tenant_update on public.%I', v_ledger);
      execute format('drop policy if exists tenant_delete on public.%I', v_ledger);
      execute format('create policy tenant_update on public.%I for update to anon, authenticated using (public.allowed_company(%L) and not public.is_customer_user()) with check (public.allowed_company(%L) and not public.is_customer_user())', v_ledger, r.code, r.code);
      execute format('create policy tenant_delete on public.%I for delete to anon, authenticated using (public.allowed_company(%L) and not public.is_customer_user())', v_ledger, r.code);
    end if;
  end loop;
end $$;

grant execute on all functions in schema public to anon, authenticated;

commit;
