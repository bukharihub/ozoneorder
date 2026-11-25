begin;

alter type public.voucher_status add value if not exists 'PARTIAL_PAID';

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "company logos public read" on storage.objects;
create policy "company logos public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'company-logos');

drop policy if exists "company logos admin write" on storage.objects;
create policy "company logos admin write" on storage.objects
  for all to anon, authenticated
  using (
    bucket_id = 'company-logos'
    and (public.is_super_admin() or public.is_company_admin())
    and (
      public.is_super_admin()
      or upper((storage.foldername(name))[1]) = upper(coalesce(public.current_company_code(), ''))
    )
  )
  with check (
    bucket_id = 'company-logos'
    and (public.is_super_admin() or public.is_company_admin())
    and (
      public.is_super_admin()
      or upper((storage.foldername(name))[1]) = upper(coalesce(public.current_company_code(), ''))
    )
  );

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
    return jsonb_build_object('exists', false, 'locked', false, 'company_name', '', 'message', 'Company code not found', 'logo_url', '');
  end if;

  if not v_company.is_active or v_company.license_expiry_date < current_date then
    return jsonb_build_object(
      'exists', true,
      'locked', true,
      'company_name', v_company.company_name,
      'message', 'License Expired – Contact Administrator',
      'logo_url', v_company.logo_url
    );
  end if;

  return jsonb_build_object(
    'exists', true,
    'locked', false,
    'company_name', v_company.company_name,
    'message', '',
    'logo_url', v_company.logo_url
  );
end;
$$;

commit;
