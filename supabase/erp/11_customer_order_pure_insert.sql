begin;

do $$
begin
  if to_regprocedure('public.current_linked_customer_ids()') is null then
    raise exception 'Run 10_multi_customer_bank_and_booker.sql before this migration';
  end if;
end $$;

update public.sys_users
   set permissions = public.ensure_customer_order_permissions(role, coalesce(permissions, public.default_user_permissions(role)))
 where role = 'CUSTOMER';

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
  v_prev_sync text := coalesce(current_setting('ozone.internal_ledger_sync', true), '');
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

  perform set_config('ozone.internal_ledger_sync', 'on', true);
  begin
    execute format(
      'update public.%I set line_items = $1, total_cartons = $2, status = $3 where id = $4',
      v_ledger
    ) using v_new_items, v_ordered, v_status, v_so_id;
  exception when others then
    perform set_config('ozone.internal_ledger_sync', v_prev_sync, true);
    raise;
  end;
  perform set_config('ozone.internal_ledger_sync', v_prev_sync, true);
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
  if TG_OP = 'INSERT' and new.voucher_type = 'SALES_ORDER' then
    return null;
  end if;

  if TG_OP <> 'INSERT' and old.voucher_type <> 'GDN_GATE_PASS' then
    return null;
  end if;

  if TG_OP = 'INSERT' and new.voucher_type <> 'GDN_GATE_PASS' then
    return null;
  end if;

  if TG_OP <> 'INSERT' then
    perform public.sync_sales_order(v_code, old.linked_so_no);
  end if;

  if TG_OP <> 'DELETE' then
    perform public.sync_sales_order(v_code, new.linked_so_no);
  end if;

  return null;
end;
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
  v_permissions jsonb;
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
  if coalesce(current_setting('ozone.internal_ledger_sync', true), '') = 'on' then
    if TG_OP = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select * into v_user from public.session_user();
  if v_user.id is null then raise exception 'Session expired'; end if;

  v_permissions := public.ensure_customer_order_permissions(v_user.role, v_user.permissions);

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
    if not coalesce((v_permissions -> v_module ->> v_action)::boolean, false) then
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

do $$
begin
  if to_regprocedure('public.ledger_update_guard()') is not null then
    execute $guard$
      create or replace function public.ledger_update_guard()
      returns trigger
      language plpgsql
      security definer
      set search_path = public, pg_temp
      as $body$
      declare
        v_code text := upper(regexp_replace(TG_TABLE_NAME, '_master_ledger$', ''));
        v_user public.sys_users%rowtype;
        v_permissions jsonb;
        v_company public.sys_companies%rowtype;
        v_module text;
        v_age_locked boolean;
        v_cutoff_locked boolean;
        v_ledger text := TG_TABLE_NAME;
      begin
        if coalesce(current_setting('ozone.internal_ledger_sync', true), '') = 'on' then
          return new;
        end if;

        select * into v_user from public.session_user();
        if v_user.id is null then raise exception 'Session expired'; end if;
        v_permissions := public.ensure_customer_order_permissions(v_user.role, v_user.permissions);

        select * into v_company from public.sys_companies where upper(company_code) = v_code;
        if v_user.role <> 'SUPER_ADMIN' and v_company.id is not null then
          if not v_company.is_active or public.demo_expired(v_company) or v_company.license_expiry_date < current_date then
            raise exception 'Company is locked';
          end if;
        end if;

        v_module := case old.voucher_type
          when 'SALES_ORDER' then 'sales_order'
          when 'GDN_GATE_PASS' then 'gdn_gate_pass'
          when 'SALES_TAX_INVOICE' then 'sales_tax_invoice'
          when 'BANK_RECEIPT' then 'bank_receipt'
          else null
        end;
        if v_user.role <> 'SUPER_ADMIN' and v_module is not null then
          if not coalesce((v_permissions -> v_module ->> 'edit')::boolean, false) then
            raise exception 'Permission denied: edit %', v_module;
          end if;
        end if;

        v_age_locked := (current_date - old.voucher_date > 3) or (now() - old.created_at > interval '3 days');
        v_cutoff_locked := v_company.entry_lock_date is not null and old.voucher_date <= v_company.entry_lock_date;
        if (v_age_locked or v_cutoff_locked) and not (v_user.role in ('SUPER_ADMIN', 'COMPANY_ADMIN') or coalesce(v_user.bypass_entry_lock, false)) then
          if v_cutoff_locked then raise exception 'Locked: Entry cutoff date has passed'; end if;
          raise exception 'Auto-Locked (>3 Days): only SUPER_ADMIN/COMPANY_ADMIN or bypass user can modify this record';
        end if;

        return new;
      end;
      $body$
    $guard$;
  end if;
end $$;

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
    end if;
  end loop;
end $$;

grant execute on all functions in schema public to anon, authenticated;

commit;
