begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum (
  'SUPER_ADMIN', 'COMPANY_ADMIN', 'CUSTOMER', 'STORE_FG', 'ACCOUNTS'
);

create type public.product_type as enum ('REGISTERED', 'UNREGISTERED');
create type public.registration_status as enum ('Register', 'Unregister');
create type public.income_tax_status as enum ('Filer', 'Non Filer');
create type public.voucher_type as enum (
  'SALES_ORDER', 'GDN_GATE_PASS', 'SALES_TAX_INVOICE', 'BANK_RECEIPT'
);
create type public.voucher_status as enum (
  'PENDING', 'PARTIAL_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'
);

create table public.sys_companies (
  id uuid primary key default extensions.gen_random_uuid(),
  company_code varchar(20) not null unique,
  company_name text not null,
  city_country text not null default '',
  ntn_strn text not null default '',
  bank_details text not null default '',
  address text not null default '',
  logo_url text not null default '',
  license_expiry_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sys_users (
  id uuid primary key default extensions.gen_random_uuid(),
  company_code varchar(20) not null references public.sys_companies(company_code) on delete cascade,
  username text not null,
  password_hash text not null,
  full_name text not null default '',
  role public.user_role not null,
  linked_customer_id uuid null,
  hide_rates_and_amounts boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_code, username)
);

create table public.sys_sessions (
  token text primary key,
  user_id uuid not null references public.sys_users(id) on delete cascade,
  company_code varchar(20) not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.sys_counters (
  company_code varchar(20) not null,
  doc_key text not null,
  doc_year integer not null,
  last_number bigint not null default 0,
  primary key (company_code, doc_key, doc_year)
);

alter table public.sys_companies enable row level security;
alter table public.sys_users enable row level security;
alter table public.sys_sessions enable row level security;
alter table public.sys_counters enable row level security;

commit;
