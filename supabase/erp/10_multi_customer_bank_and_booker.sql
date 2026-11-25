begin;

alter table public.sys_users
  add column if not exists linked_customer_ids jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'sys_users'
       and column_name = 'linked_customer_ids'
       and data_type = 'ARRAY'
  ) then
    alter table public.sys_users rename column linked_customer_ids to linked_customer_ids_uuid_array;
    alter table public.sys_users add column linked_customer_ids jsonb not null default '[]'::jsonb;
    update public.sys_users
       set linked_customer_ids = to_jsonb(coalesce(linked_customer_ids_uuid_array, '{}'::uuid[]));
    alter table public.sys_users drop column linked_customer_ids_uuid_array;
  end if;
end $$;

create or replace function public.linked_customer_ids_uuid_array(p_ids jsonb)
returns uuid[]
language sql
immutable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(value::uuid), '{}'::uuid[])
    from jsonb_array_elements_text(coalesce(p_ids, '[]'::jsonb))
$$;

create or replace function public.current_linked_customer_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when coalesce(jsonb_array_length(coalesce(u.linked_customer_ids, '[]'::jsonb)), 0) > 0
      then public.linked_customer_ids_uuid_array(u.linked_customer_ids)
    when u.linked_customer_id is not null then array[u.linked_customer_id]::uuid[]
    else '{}'::uuid[]
  end
    from public.session_user() u;
$$;

create or replace function public.booker_for_customer(p_customer_id uuid)
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.full_name
    from public.sys_users u
   where u.role = 'CUSTOMER'
     and (
       u.linked_customer_id = p_customer_id
       or p_customer_id = any(public.linked_customer_ids_uuid_array(u.linked_customer_ids))
     )
   order by u.created_at, u.id;
$$;

create or replace function public.ensure_customer_order_permissions(p_role public.user_role, p_permissions jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_role <> 'CUSTOMER' then coalesce(p_permissions, '{}'::jsonb)
    else coalesce(p_permissions, public.default_user_permissions('CUSTOMER'))
         || jsonb_build_object(
              'sales_order',
              coalesce(p_permissions -> 'sales_order', '{}'::jsonb)
                || jsonb_build_object('view', true, 'create', true)
            )
  end;
$$;

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
  new.permissions := public.ensure_customer_order_permissions(new.role, new.permissions);
  if coalesce(jsonb_array_length(coalesce(new.linked_customer_ids, '[]'::jsonb)), 0) = 0 and new.linked_customer_id is not null then
    new.linked_customer_ids := to_jsonb(array[new.linked_customer_id]::uuid[]);
  end if;
  if coalesce(jsonb_array_length(coalesce(new.linked_customer_ids, '[]'::jsonb)), 0) > 0 and new.linked_customer_id is null then
    new.linked_customer_id := (new.linked_customer_ids ->> 0)::uuid;
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
  v_customers text;
  v_ledger text;
begin
  for r in select lower(company_code) as code from public.sys_companies loop
    v_customers := r.code || '_customers';
    v_ledger := r.code || '_master_ledger';

    if to_regclass('public.' || v_customers) is not null then
      execute format('alter table public.%I add column if not exists bank_account_no text', v_customers);
      execute format('alter table public.%I add column if not exists bank_branch_name text', v_customers);
      execute format('alter table public.%I alter column bank_account_no drop not null', v_customers);
      execute format('alter table public.%I alter column bank_branch_name drop not null', v_customers);
      execute format('alter table public.%I alter column bank_account_no drop default', v_customers);
      execute format('alter table public.%I alter column bank_branch_name drop default', v_customers);
    end if;

    if to_regclass('public.' || v_ledger) is not null then
      execute format('alter table public.%I add column if not exists booked_by_user_id uuid', v_ledger);
      execute format('alter table public.%I add column if not exists booked_by_name text', v_ledger);
      execute format('alter table public.%I add column if not exists bank_account_no text', v_ledger);
      execute format('alter table public.%I add column if not exists bank_branch_name text', v_ledger);
      execute format('alter table public.%I alter column booked_by_name drop not null', v_ledger);
      execute format('alter table public.%I alter column bank_account_no drop not null', v_ledger);
      execute format('alter table public.%I alter column bank_branch_name drop not null', v_ledger);
      execute format('alter table public.%I alter column booked_by_name drop default', v_ledger);
      execute format('alter table public.%I alter column bank_account_no drop default', v_ledger);
      execute format('alter table public.%I alter column bank_branch_name drop default', v_ledger);
      execute format('create index if not exists %I on public.%I (booked_by_user_id)', v_ledger || '_booker_idx', v_ledger);
      execute format('create index if not exists %I on public.%I (bank_account_no)', v_ledger || '_bank_account_idx', v_ledger);
    end if;
  end loop;
end $$;

create or replace function public.ledger_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.sys_users%rowtype;
  v_permissions jsonb;
  v_module text;
  v_linked uuid[];
  v_booker_id uuid;
  v_booker_name text;
begin
  select * into v_user from public.session_user();
  if v_user.id is null then raise exception 'Session expired'; end if;

  v_permissions := public.ensure_customer_order_permissions(v_user.role, v_user.permissions);

  if new.customer_id is not null then
    if v_user.role = 'CUSTOMER' then
      new.booked_by_user_id := v_user.id;
      new.booked_by_name := coalesce(nullif(btrim(v_user.full_name), ''), v_user.username);
    else
      select b.id, b.full_name
        into v_booker_id, v_booker_name
        from public.booker_for_customer(new.customer_id) b
       limit 1;
      if v_booker_id is not null then
        new.booked_by_user_id := v_booker_id;
        new.booked_by_name := coalesce(nullif(btrim(v_booker_name), ''), new.booked_by_name);
      end if;
    end if;
  end if;

  if new.booked_by_user_id is null then
    new.booked_by_user_id := v_user.id;
  end if;
  if nullif(btrim(coalesce(new.booked_by_name, '')), '') is null then
    new.booked_by_name := coalesce(nullif(btrim(v_user.full_name), ''), v_user.username);
  end if;

  v_module := case new.voucher_type
    when 'SALES_ORDER' then 'sales_order'
    when 'GDN_GATE_PASS' then 'gdn_gate_pass'
    when 'SALES_TAX_INVOICE' then 'sales_tax_invoice'
    when 'BANK_RECEIPT' then 'bank_receipt'
    else null
  end;

  if v_user.role = 'CUSTOMER' then
    if new.voucher_type <> 'SALES_ORDER' then
      raise exception 'CUSTOMER accounts can only submit sales orders';
    end if;
    v_linked := public.current_linked_customer_ids();
    if new.customer_id is null or not (new.customer_id = any(coalesce(v_linked, '{}'::uuid[]))) then
      raise exception 'Your login is not linked to this customer';
    end if;
  end if;

  if v_user.role <> 'SUPER_ADMIN' and v_module is not null then
    if not coalesce((v_permissions -> v_module ->> 'create')::boolean, false) then
      raise exception 'Permission denied: create %', v_module;
    end if;
    if v_user.role = 'CUSTOMER' and v_module = 'sales_order'
       and not coalesce((v_permissions -> 'sales_order' ->> 'view')::boolean, false) then
      raise exception 'Permission denied: view sales_order';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regprocedure('public.create_company_tables(text)') is not null
     and to_regprocedure('public.create_company_tables_base(text)') is null then
    alter function public.create_company_tables(text) rename to create_company_tables_base;
  end if;
end $$;

create or replace function public.create_company_tables(p_company_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := lower(btrim(p_company_code));
  v_customers text;
  v_ledger text;
begin
  perform public.create_company_tables_base(p_company_code);

  if v_code !~ '^[a-z][a-z0-9_]{0,19}$' then
    raise exception 'Company code must be 1-20 lowercase letters, numbers or underscores';
  end if;
  v_customers := v_code || '_customers';
  v_ledger := v_code || '_master_ledger';

  execute format('alter table public.%I add column if not exists bank_account_no text', v_customers);
  execute format('alter table public.%I add column if not exists bank_branch_name text', v_customers);

  execute format('alter table public.%I add column if not exists booked_by_user_id uuid', v_ledger);
  execute format('alter table public.%I add column if not exists booked_by_name text', v_ledger);
  execute format('alter table public.%I add column if not exists bank_account_no text', v_ledger);
  execute format('alter table public.%I add column if not exists bank_branch_name text', v_ledger);
  execute format('create index if not exists %I on public.%I (booked_by_user_id)', v_ledger || '_booker_idx', v_ledger);
  execute format('create index if not exists %I on public.%I (bank_account_no)', v_ledger || '_bank_account_idx', v_ledger);

  execute format('drop policy if exists tenant_read on public.%I', v_customers);
  execute format(
    'create policy tenant_read on public.%I for select to anon, authenticated using (public.allowed_company(%L) and (not public.is_customer_user() or id = any(public.current_linked_customer_ids())))',
    v_customers, v_code
  );

  execute format('drop policy if exists tenant_read on public.%I', v_ledger);
  execute format(
    'create policy tenant_read on public.%I for select to anon, authenticated using (public.allowed_company(%L) and (not public.is_customer_user() or customer_id = any(public.current_linked_customer_ids()) or booked_by_user_id = public.current_user_id()))',
    v_ledger, v_code
  );

  execute format('drop policy if exists tenant_insert on public.%I', v_ledger);
  execute format($policy$
    create policy tenant_insert on public.%I for insert to anon, authenticated
    with check (
      public.allowed_company(%L)
      and public.current_user_role() in ('CUSTOMER', 'STORE_FG', 'ACCOUNTS', 'COMPANY_ADMIN', 'SUPER_ADMIN')
      and (
        (voucher_type = 'SALES_ORDER' and (
          public.current_user_role() in ('COMPANY_ADMIN', 'SUPER_ADMIN')
          or (public.current_user_role() = 'CUSTOMER' and customer_id = any(public.current_linked_customer_ids()))
        ))
        or (voucher_type = 'GDN_GATE_PASS' and public.current_user_role() in ('STORE_FG', 'COMPANY_ADMIN', 'SUPER_ADMIN'))
        or (voucher_type in ('SALES_TAX_INVOICE', 'BANK_RECEIPT') and public.current_user_role() in ('ACCOUNTS', 'COMPANY_ADMIN', 'SUPER_ADMIN'))
      )
    )
  $policy$, v_ledger, v_code);
end;
$$;

do $$
declare
  r record;
  v_customers text;
  v_ledger text;
begin
  for r in select lower(company_code) as code from public.sys_companies loop
    v_customers := r.code || '_customers';
    v_ledger := r.code || '_master_ledger';
    if to_regclass('public.' || v_customers) is not null then
      execute format('drop policy if exists tenant_read on public.%I', v_customers);
      execute format(
        'create policy tenant_read on public.%I for select to anon, authenticated using (public.allowed_company(%L) and (not public.is_customer_user() or id = any(public.current_linked_customer_ids())))',
        v_customers, r.code
      );
    end if;
    if to_regclass('public.' || v_ledger) is not null then
      execute format('drop policy if exists tenant_read on public.%I', v_ledger);
      execute format(
        'create policy tenant_read on public.%I for select to anon, authenticated using (public.allowed_company(%L) and (not public.is_customer_user() or customer_id = any(public.current_linked_customer_ids()) or booked_by_user_id = public.current_user_id()))',
        v_ledger, r.code
      );
      execute format('drop policy if exists tenant_insert on public.%I', v_ledger);
      execute format($policy$
        create policy tenant_insert on public.%I for insert to anon, authenticated
        with check (
          public.allowed_company(%L)
          and public.current_user_role() in ('CUSTOMER', 'STORE_FG', 'ACCOUNTS', 'COMPANY_ADMIN', 'SUPER_ADMIN')
          and (
            (voucher_type = 'SALES_ORDER' and (
              public.current_user_role() in ('COMPANY_ADMIN', 'SUPER_ADMIN')
              or (public.current_user_role() = 'CUSTOMER' and customer_id = any(public.current_linked_customer_ids()))
            ))
            or (voucher_type = 'GDN_GATE_PASS' and public.current_user_role() in ('STORE_FG', 'COMPANY_ADMIN', 'SUPER_ADMIN'))
            or (voucher_type in ('SALES_TAX_INVOICE', 'BANK_RECEIPT') and public.current_user_role() in ('ACCOUNTS', 'COMPANY_ADMIN', 'SUPER_ADMIN'))
          )
        )
      $policy$, v_ledger, r.code);

      execute format('drop trigger if exists %I on public.%I', v_ledger || '_insert_guard', v_ledger);
      execute format('create trigger %I before insert on public.%I for each row execute function public.ledger_insert_guard()', v_ledger || '_insert_guard', v_ledger);
    end if;
  end loop;
end $$;

create or replace function public.insert_master_ledger(p_company_code text, p_voucher jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := lower(btrim(p_company_code));
  v_table text;
  v_cols text;
  v_defs text;
  v_vals text;
  v_row jsonb;
begin
  v_table := v_code || '_master_ledger';
  if to_regclass('public.' || v_table) is null then
    raise exception 'Ledger table does not exist for company %', v_code;
  end if;
  if not public.allowed_company(v_code) then
    raise exception 'Company access denied';
  end if;

  select
    string_agg(format('%I', a.attname), ', ' order by a.attnum),
    string_agg(format('%I text', a.attname), ', ' order by a.attnum),
    string_agg(format('r.%I::%s', a.attname, format_type(a.atttypid, a.atttypmod)), ', ' order by a.attnum)
  into v_cols, v_defs, v_vals
  from pg_attribute a
  where a.attrelid = to_regclass('public.' || v_table)
    and a.attnum > 0
    and not a.attisdropped
    and a.attname in (select jsonb_object_keys(coalesce(p_voucher, '{}'::jsonb)));

  if v_cols is null then
    raise exception 'No matching ledger columns supplied';
  end if;

  execute format(
    'with inserted as (insert into public.%I (%s) select %s from jsonb_to_record($1) as r(%s) returning *) select to_jsonb(inserted) from inserted',
    v_table, v_cols, v_vals, v_defs
  ) into v_row using coalesce(p_voucher, '{}'::jsonb);
  return v_row;
end;
$$;

create or replace function public.create_voucher(p_company_code text, p_voucher jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  return public.insert_master_ledger(p_company_code, p_voucher);
end;
$$;

create or replace function public.import_company_data(
  p_company_code text,
  p_products jsonb,
  p_customers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := lower(btrim(p_company_code));
  v_products text := v_code || '_products';
  v_customers text := v_code || '_customers';
  v_item jsonb;
  v_count integer := 0;
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required';
  end if;

  if to_regclass('public.' || v_products) is null then
    raise exception 'Company tables do not exist';
  end if;

  if p_products is not null and jsonb_typeof(p_products) = 'array' then
    for v_item in select value from jsonb_array_elements(p_products) loop
      execute format($sql$
        insert into public.%I (
          size_category, product_type, product_name, hs_code, diapers_per_bag, bags_per_carton,
          opening_stock_ctns, current_stock_ctns, current_stock_pcs, per_diaper_rate, per_carton_rate
        )
        select r.size_category, r.product_type, r.product_name, r.hs_code, r.diapers_per_bag, r.bags_per_carton,
               r.opening_stock_ctns, r.opening_stock_ctns,
               r.opening_stock_ctns * r.diapers_per_bag * r.bags_per_carton,
               r.per_diaper_rate, r.per_carton_rate
          from jsonb_populate_record(null::public.%I, $1) r
      $sql$, v_products, v_products) using v_item;
      v_count := v_count + 1;
    end loop;
  end if;

  if p_customers is not null and jsonb_typeof(p_customers) = 'array' then
    for v_item in select value from jsonb_array_elements(p_customers) loop
      execute format($sql$
        insert into public.%I (
          cnic_ntn, strn, business_name, delivery_destination, registration_status,
          income_tax_status, tax_rate_236g, opening_balance, bank_account_no, bank_branch_name
        )
        select r.cnic_ntn, r.strn, r.business_name, r.delivery_destination, r.registration_status,
               r.income_tax_status,
               case when r.income_tax_status = 'Filer' then 0.001 else 0.02 end,
               coalesce(r.opening_balance, 0),
               nullif(btrim(coalesce(r.bank_account_no, '')), ''),
               nullif(btrim(coalesce(r.bank_branch_name, '')), '')
          from jsonb_populate_record(null::public.%I, $1) r
      $sql$, v_customers, v_customers) using v_item;
      v_count := v_count + 1;
    end loop;
  end if;

  return jsonb_build_object('imported', v_count);
end;
$$;

drop function if exists public.create_company_user(text, text, text, text, public.user_role, uuid, boolean, jsonb, boolean);
drop function if exists public.create_company_user(text, text, text, text, public.user_role, uuid, boolean, jsonb, boolean, uuid[]);
create or replace function public.create_company_user(
  p_company_code text,
  p_username text,
  p_password text,
  p_full_name text,
  p_role public.user_role,
  p_linked_customer_id uuid default null,
  p_hide_rates boolean default false,
  p_permissions jsonb default null,
  p_bypass_entry_lock boolean default false,
  p_linked_customer_ids jsonb default null
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
  v_ids jsonb := coalesce(
    p_linked_customer_ids,
    case when p_linked_customer_id is not null then to_jsonb(array[p_linked_customer_id]::uuid[]) else '[]'::jsonb end
  );
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

  v_perms := public.ensure_customer_order_permissions(p_role, coalesce(p_permissions, public.default_user_permissions(p_role)));
  if coalesce(jsonb_array_length(coalesce(v_ids, '[]'::jsonb)), 0) = 0 and p_linked_customer_id is not null then
    v_ids := to_jsonb(array[p_linked_customer_id]::uuid[]);
  end if;

  insert into public.sys_users (
    company_code, username, password_hash, full_name, role, linked_customer_id, linked_customer_ids,
    hide_rates_and_amounts, permissions, bypass_entry_lock
  ) values (
    v_code, btrim(p_username),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    btrim(p_full_name), p_role, coalesce((v_ids ->> 0)::uuid, p_linked_customer_id), coalesce(v_ids, '[]'::jsonb),
    case when p_role = 'CUSTOMER' then true else p_hide_rates end,
    v_perms, coalesce(p_bypass_entry_lock, false)
  )
  returning id into v_id;

  return v_id;
end;
$$;

drop function if exists public.update_company_user(uuid, boolean, boolean, text, public.user_role, jsonb, boolean, text);
drop function if exists public.update_company_user(uuid, boolean, boolean, text, public.user_role, jsonb, boolean, text, uuid, uuid[]);
create or replace function public.update_company_user(
  p_user_id uuid,
  p_is_active boolean default null,
  p_hide_rates boolean default null,
  p_full_name text default null,
  p_role public.user_role default null,
  p_permissions jsonb default null,
  p_bypass_entry_lock boolean default null,
  p_password text default null,
  p_linked_customer_id uuid default null,
  p_linked_customer_ids jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_target public.sys_users%rowtype;
  v_ids jsonb;
  v_role public.user_role;
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

  v_role := coalesce(p_role, v_target.role);

  if p_linked_customer_ids is not null then
    v_ids := p_linked_customer_ids;
  elsif p_linked_customer_id is not null then
    v_ids := to_jsonb(array[p_linked_customer_id]::uuid[]);
  else
    v_ids := v_target.linked_customer_ids;
  end if;
  if coalesce(jsonb_array_length(coalesce(v_ids, '[]'::jsonb)), 0) = 0 and p_linked_customer_id is not null then
    v_ids := to_jsonb(array[p_linked_customer_id]::uuid[]);
  end if;

  update public.sys_users
     set is_active = coalesce(p_is_active, is_active),
         hide_rates_and_amounts = case
           when v_role = 'CUSTOMER' then coalesce(p_hide_rates, hide_rates_and_amounts, true)
           else coalesce(p_hide_rates, hide_rates_and_amounts)
         end,
         full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
         role = v_role,
         permissions = case
           when p_permissions is not null then public.ensure_customer_order_permissions(v_role, p_permissions)
           when p_role is not null and p_role <> v_target.role then public.ensure_customer_order_permissions(v_role, public.default_user_permissions(v_role))
           else public.ensure_customer_order_permissions(v_role, v_target.permissions)
         end,
         bypass_entry_lock = coalesce(p_bypass_entry_lock, bypass_entry_lock),
         password_hash = case
           when p_password is not null and btrim(p_password) <> '' then extensions.crypt(p_password, extensions.gen_salt('bf'))
           else password_hash
         end,
         linked_customer_ids = coalesce(v_ids, '[]'::jsonb),
         linked_customer_id = coalesce((v_ids ->> 0)::uuid, p_linked_customer_id, linked_customer_id)
   where id = p_user_id;
end;
$$;

drop function if exists public.list_company_bookers();
create or replace function public.list_company_bookers()
returns table (id uuid, username text, full_name text, linked_customer_ids jsonb)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user public.sys_users%rowtype;
begin
  select * into v_user from public.session_user();
  if v_user.id is null then raise exception 'Session expired'; end if;

  return query
    select u.id,
           u.username,
           u.full_name,
           case
             when coalesce(jsonb_array_length(coalesce(u.linked_customer_ids, '[]'::jsonb)), 0) > 0 then u.linked_customer_ids
             when u.linked_customer_id is not null then to_jsonb(array[u.linked_customer_id]::uuid[])
             else '[]'::jsonb
           end
       from public.sys_users u
      where (public.is_super_admin() or u.company_code = v_user.company_code)
        and (coalesce(jsonb_array_length(coalesce(u.linked_customer_ids, '[]'::jsonb)), 0) > 0 or u.linked_customer_id is not null)
        and (public.is_super_admin() or public.is_company_admin() or public.is_customer_user() or u.id = v_user.id)
      order by u.full_name, u.username;
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
  v_ids jsonb;
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
  else
    update public.sys_users
       set permissions = public.ensure_customer_order_permissions(v_user.role, v_user.permissions)
     where id = v_user.id
     returning * into v_user;
  end if;

  v_ids := case
    when coalesce(jsonb_array_length(coalesce(v_user.linked_customer_ids, '[]'::jsonb)), 0) > 0 then v_user.linked_customer_ids
    when v_user.linked_customer_id is not null then to_jsonb(array[v_user.linked_customer_id]::uuid[])
    else '[]'::jsonb
  end;

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
      'linked_customer_ids', v_ids,
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

grant execute on all functions in schema public to anon, authenticated;

commit;
