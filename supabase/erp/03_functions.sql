begin;

create or replace function public.session_token()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'x-ozone-session',
    nullif(current_setting('request.headers', true), '')::json ->> 'x-ozone-session-token',
    ''
  );
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
   where s.token = public.session_token()
     and s.expires_at > now()
     and u.is_active
     and exists (
       select 1
         from public.sys_companies c
        where c.company_code = u.company_code
          and (u.role = 'SUPER_ADMIN' or (c.is_active and c.license_expiry_date >= current_date))
     )
   limit 1;
$$;

create or replace function public.current_company_code()
returns varchar
language sql
stable
set search_path = public, pg_temp
as $$
  select company_code from public.session_user();
$$;

create or replace function public.current_user_id()
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select id from public.session_user();
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select role::text from public.session_user();
$$;

create or replace function public.current_linked_customer_id()
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select linked_customer_id from public.session_user();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select public.current_user_role() = 'SUPER_ADMIN';
$$;

create or replace function public.is_company_admin()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select public.current_user_role() in ('SUPER_ADMIN', 'COMPANY_ADMIN');
$$;

create or replace function public.is_customer_user()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select public.current_user_role() = 'CUSTOMER';
$$;

create or replace function public.allowed_company(p_company_code text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select public.is_super_admin()
      or upper(coalesce(public.current_company_code(), '')) = upper(coalesce(p_company_code, ''));
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

  if v_user.role <> 'SUPER_ADMIN'
     and (not v_company.is_active or v_company.license_expiry_date < current_date) then
    raise exception 'License Expired – Contact Administrator';
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
      'hide_rates_and_amounts', v_user.hide_rates_and_amounts
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
      'is_active', v_company.is_active
    )
  );
end;
$$;

create or replace function public.app_logout()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.sys_sessions where token = public.session_token();
end;
$$;

create or replace function public.check_company(p_company_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company public.sys_companies%rowtype;
begin
  select * into v_company
    from public.sys_companies
   where upper(company_code) = upper(btrim(p_company_code));

  if not found then
    return jsonb_build_object('exists', false, 'locked', false, 'company_name', '', 'message', 'Company code not found');
  end if;

  if not v_company.is_active or v_company.license_expiry_date < current_date then
    return jsonb_build_object(
      'exists', true,
      'locked', true,
      'company_name', v_company.company_name,
      'message', 'License Expired – Contact Administrator'
    );
  end if;

  return jsonb_build_object(
    'exists', true,
    'locked', false,
    'company_name', v_company.company_name,
    'message', ''
  );
end;
$$;

create or replace function public.next_voucher_no(
  p_company_code text,
  p_prefix text,
  p_digits integer default 4
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seq bigint;
  v_year integer := extract(year from current_date)::integer;
begin
  insert into public.sys_counters (company_code, doc_key, doc_year, last_number)
  values (upper(p_company_code), p_prefix, v_year, 1)
  on conflict (company_code, doc_key, doc_year)
  do update set last_number = public.sys_counters.last_number + 1
  returning last_number into v_seq;

  return replace(
    replace(p_prefix, '{YYYY}', v_year::text),
    '{SEQ}', lpad(v_seq::text, greatest(p_digits, 1), '0')
  );
end;
$$;

create or replace function public.trg_customers_tax_rate()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.tax_rate_236g is null or new.tax_rate_236g = 0 then
    new.tax_rate_236g := case when new.income_tax_status = 'Filer' then 0.001 else 0.02 end;
  end if;
  return new;
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
  return new;
end;
$$;

create trigger trg_sys_users_defaults
before insert on public.sys_users
for each row execute function public.trg_sys_users_defaults();

create or replace function public.trg_products_stock_init()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.current_stock_ctns, 0) = 0 and coalesce(new.opening_stock_ctns, 0) <> 0 then
    execute format('update public.%I set current_stock_ctns = $1, current_stock_pcs = $2 where id = $3', TG_TABLE_NAME)
      using new.opening_stock_ctns, new.opening_stock_ctns * new.pcs_per_carton, new.id;
  end if;
  return null;
end;
$$;

create or replace function public.apply_ledger_stock(
  p_products_table text,
  p_items jsonb,
  p_sign numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_product_id uuid;
  v_cartons numeric;
  v_pcs_per_carton numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_cartons := coalesce((v_item ->> 'delivered_ctns')::numeric, 0);

    if v_product_id is null or v_cartons = 0 then
      continue;
    end if;

    execute format('select pcs_per_carton from public.%I where id = $1', p_products_table)
      into v_pcs_per_carton
      using v_product_id;

    if not found then
      continue;
    end if;

    execute format(
      'update public.%I set current_stock_ctns = current_stock_ctns + $1, current_stock_pcs = current_stock_pcs + $2 where id = $3',
      p_products_table
    ) using p_sign * v_cartons, p_sign * v_cartons * v_pcs_per_carton, v_product_id;
  end loop;
end;
$$;

create or replace function public.trg_master_ledger_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := regexp_replace(TG_TABLE_NAME, '_master_ledger$', '');
  v_products text := v_code || '_products';
begin
  if TG_OP in ('UPDATE', 'DELETE') and old.voucher_type = 'GDN_GATE_PASS' then
    perform public.apply_ledger_stock(v_products, old.line_items, -1);
  end if;

  if TG_OP in ('UPDATE', 'INSERT') and new.voucher_type = 'GDN_GATE_PASS' then
    perform public.apply_ledger_stock(v_products, new.line_items, 1);
  end if;

  return null;
end;
$$;

create or replace function public.sync_sales_order(p_company_code text, p_so_no text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ledger text := lower(p_company_code) || '_master_ledger';
  v_so_id uuid;
  v_items jsonb;
  v_new_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_delivered_for_product numeric;
  v_ordered numeric := 0;
  v_delivered numeric := 0;
  v_status public.voucher_status;
begin
  if p_so_no is null or btrim(p_so_no) = '' then
    return;
  end if;

  execute format(
    'select id, line_items from public.%I where voucher_type = ''SALES_ORDER'' and voucher_no = $1 limit 1',
    v_ledger
  ) into v_so_id, v_items using p_so_no;

  if v_so_id is null then
    return;
  end if;

  if v_items is not null and jsonb_typeof(v_items) = 'array' then
    for v_item in select value from jsonb_array_elements(v_items) loop
      v_ordered := v_ordered + coalesce((v_item ->> 'ordered_ctns')::numeric, 0);

      execute format(
        'select coalesce(sum(coalesce((d ->> ''delivered_ctns'')::numeric, 0)), 0)
           from public.%I l, jsonb_array_elements(l.line_items) d
          where l.voucher_type = ''GDN_GATE_PASS''
            and l.linked_so_no = $1
            and d ->> ''product_id'' = $2',
        v_ledger
      ) into v_delivered_for_product using p_so_no, v_item ->> 'product_id';

      v_new_items := v_new_items || jsonb_set(
        v_item,
        '{pending_ctns}',
        to_jsonb(greatest(coalesce((v_item ->> 'ordered_ctns')::numeric, 0) - v_delivered_for_product, 0))
      );
    end loop;
  end if;

  execute format(
    'select coalesce(sum(coalesce((d ->> ''delivered_ctns'')::numeric, 0)), 0)
       from public.%I l, jsonb_array_elements(l.line_items) d
      where l.voucher_type = ''GDN_GATE_PASS'' and l.linked_so_no = $1',
    v_ledger
  ) into v_delivered using p_so_no;

  v_status := case
    when v_delivered <= 0 then 'PENDING'::public.voucher_status
    when v_delivered >= v_ordered then 'DELIVERED'::public.voucher_status
    else 'PARTIAL_DELIVERED'::public.voucher_status
  end;

  execute format(
    'update public.%I set line_items = $1, total_cartons = $2, status = $3 where id = $4',
    v_ledger
  ) using v_new_items, v_ordered, v_status, v_so_id;
end;
$$;

create or replace function public.trg_ledger_sync_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := regexp_replace(TG_TABLE_NAME, '_master_ledger$', '');
begin
  if TG_OP <> 'INSERT' and old.voucher_type <> 'GDN_GATE_PASS' then
    return null;
  end if;

  if TG_OP = 'INSERT' and new.voucher_type not in ('SALES_ORDER', 'GDN_GATE_PASS') then
    return null;
  end if;

  if TG_OP <> 'INSERT' then
    perform public.sync_sales_order(v_code, old.linked_so_no);
  end if;

  if TG_OP <> 'DELETE' then
    if new.voucher_type = 'SALES_ORDER' then
      perform public.sync_sales_order(v_code, new.voucher_no);
    else
      perform public.sync_sales_order(v_code, new.linked_so_no);
    end if;
  end if;

  return null;
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

  execute format(
    'create trigger %I after insert on public.%I for each row execute function public.trg_products_stock_init()',
    v_products || '_stock_init', v_products
  );
  execute format(
    'create trigger %I before insert or update of income_tax_status on public.%I for each row execute function public.trg_customers_tax_rate()',
    v_customers || '_tax_rate', v_customers
  );
  execute format(
    'create trigger %I after insert or update or delete on public.%I for each row execute function public.trg_master_ledger_stock()',
    v_ledger || '_stock', v_ledger
  );
  execute format(
    'create trigger %I after insert or update or delete on public.%I for each row execute function public.trg_ledger_sync_order()',
    v_ledger || '_sync_order', v_ledger
  );

  execute format('alter table public.%I enable row level security', v_products);
  execute format('alter table public.%I enable row level security', v_customers);
  execute format('alter table public.%I enable row level security', v_ledger);

  execute format('drop policy if exists tenant_read on public.%I', v_products);
  execute format(
    'create policy tenant_read on public.%I for select to anon, authenticated using (public.allowed_company(%L))',
    v_products, v_code
  );
  execute format('drop policy if exists tenant_write on public.%I', v_products);
  execute format(
    'create policy tenant_write on public.%I for all to anon, authenticated using (public.allowed_company(%L) and not public.is_customer_user()) with check (public.allowed_company(%L) and not public.is_customer_user())',
    v_products, v_code, v_code
  );

  execute format('drop policy if exists tenant_read on public.%I', v_customers);
  execute format(
    'create policy tenant_read on public.%I for select to anon, authenticated using (public.allowed_company(%L))',
    v_customers, v_code
  );
  execute format('drop policy if exists tenant_write on public.%I', v_customers);
  execute format(
    'create policy tenant_write on public.%I for all to anon, authenticated using (public.allowed_company(%L) and not public.is_customer_user()) with check (public.allowed_company(%L) and not public.is_customer_user())',
    v_customers, v_code, v_code
  );

  execute format('drop policy if exists tenant_read on public.%I', v_ledger);
  execute format(
    'create policy tenant_read on public.%I for select to anon, authenticated using (public.allowed_company(%L) and (not public.is_customer_user() or customer_id = public.current_linked_customer_id()))',
    v_ledger, v_code
  );
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
  execute format(
    'create policy tenant_write on public.%I for all to anon, authenticated using (public.allowed_company(%L) and not public.is_customer_user()) with check (public.allowed_company(%L) and not public.is_customer_user())',
    v_ledger, v_code, v_code
  );

  execute format('grant select, insert, update, delete on public.%I to anon, authenticated', v_products);
  execute format('grant select, insert, update, delete on public.%I to anon, authenticated', v_customers);
  execute format('grant select, insert, update, delete on public.%I to anon, authenticated', v_ledger);
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
  p_admin_password text default 'admin123'
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
    company_code, company_name, city_country, ntn_strn, bank_details, address, license_expiry_date, is_active
  ) values (
    v_code, p_company_name, p_city_country, p_ntn_strn, p_bank_details, p_address, p_license_expiry_date, true
  );

  perform public.create_company_tables(v_code);

  insert into public.sys_users (company_code, username, password_hash, full_name, role, is_active)
  values (
    v_code, 'admin',
    extensions.crypt(p_admin_password, extensions.gen_salt('bf')),
    'Company Administrator', 'COMPANY_ADMIN', true
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
  p_hide_rates boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := upper(btrim(p_company_code));
  v_id uuid;
begin
  if not (public.is_super_admin() or (public.is_company_admin() and v_code = public.current_company_code())) then
    raise exception 'Administrator access required';
  end if;

  if p_role = 'SUPER_ADMIN' and not public.is_super_admin() then
    raise exception 'Only a super admin can create super admins';
  end if;

  insert into public.sys_users (
    company_code, username, password_hash, full_name, role, linked_customer_id, hide_rates_and_amounts
  ) values (
    v_code, btrim(p_username),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    btrim(p_full_name), p_role, p_linked_customer_id,
    case when p_role = 'CUSTOMER' then true else p_hide_rates end
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_company_user(
  p_user_id uuid,
  p_is_active boolean,
  p_hide_rates boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_super_admin() or (public.is_company_admin() and exists (
    select 1 from public.sys_users u
     where u.id = p_user_id and u.company_code = public.current_company_code()
  ))) then
    raise exception 'Administrator access required';
  end if;

  update public.sys_users
     set is_active = p_is_active,
         hide_rates_and_amounts = case when role = 'CUSTOMER' then p_hide_rates else hide_rates_and_amounts end
   where id = p_user_id;
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
          income_tax_status, tax_rate_236g, opening_balance
        )
        select r.cnic_ntn, r.strn, r.business_name, r.delivery_destination, r.registration_status,
               r.income_tax_status,
               case when r.income_tax_status = 'Filer' then 0.001 else 0.02 end,
               coalesce(r.opening_balance, 0)
          from jsonb_populate_record(null::public.%I, $1) r
      $sql$, v_customers, v_customers) using v_item;
      v_count := v_count + 1;
    end loop;
  end if;

  return jsonb_build_object('imported', v_count);
end;
$$;

create policy company_read on public.sys_companies
  for select to anon, authenticated
  using (public.is_super_admin() or company_code = public.current_company_code());

create policy company_write on public.sys_companies
  for all to anon, authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy users_read on public.sys_users
  for select to anon, authenticated
  using (
    public.is_super_admin()
    or (company_code = public.current_company_code()
        and (not public.is_customer_user() or id = public.current_user_id()))
  );

create policy users_write on public.sys_users
  for all to anon, authenticated
  using (public.is_super_admin() or (public.is_company_admin() and company_code = public.current_company_code()))
  with check (public.is_super_admin() or (public.is_company_admin() and company_code = public.current_company_code()));

create policy counters_access on public.sys_counters
  for all to anon, authenticated
  using (public.is_super_admin() or company_code = public.current_company_code())
  with check (public.is_super_admin() or company_code = public.current_company_code());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.sys_companies, public.sys_users, public.sys_counters to anon, authenticated;
grant select, delete on public.sys_sessions to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

commit;
