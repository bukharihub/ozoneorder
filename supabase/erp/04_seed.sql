begin;

select public.create_company_tables('ozone');

insert into public.sys_companies (
  company_code, company_name, city_country, ntn_strn, bank_details, address, license_expiry_date, is_active
) values (
  'OZONE',
  'OZONE ENTERPRISE',
  'Karachi, Pakistan',
  '3277876123456',
  'BANK AL HABIB | A/C: 1089-0981-005393-01',
  'Karachi, Pakistan',
  date '2028-12-31',
  true
)
on conflict (company_code) do update set
  company_name = excluded.company_name,
  city_country = excluded.city_country,
  ntn_strn = excluded.ntn_strn,
  bank_details = excluded.bank_details,
  address = excluded.address,
  license_expiry_date = excluded.license_expiry_date,
  is_active = true;

insert into public.sys_users (company_code, username, password_hash, full_name, role)
values
  ('OZONE', 'superadmin', extensions.crypt('master123', extensions.gen_salt('bf')), 'Master Owner', 'SUPER_ADMIN'),
  ('OZONE', 'admin', extensions.crypt('admin123', extensions.gen_salt('bf')), 'OZONE Administrator', 'COMPANY_ADMIN'),
  ('OZONE', 'store', extensions.crypt('store123', extensions.gen_salt('bf')), 'Store / FG Department', 'STORE_FG'),
  ('OZONE', 'accounts', extensions.crypt('accounts123', extensions.gen_salt('bf')), 'Accounts Department', 'ACCOUNTS')
on conflict (company_code, username) do nothing;

insert into public.ozone_products (
  size_category, product_type, product_name, diapers_per_bag, bags_per_carton,
  opening_stock_ctns, current_stock_ctns, current_stock_pcs, per_diaper_rate, per_carton_rate
) values
  ('NB', 'UNREGISTERED', 'SMALL OZONE SO FIT-NB Bags-50*8', 50, 8, 7956, 7956, 7956 * 50 * 8, 11.65, 0),
  ('S', 'UNREGISTERED', 'SMALL SMART OZONE SO FIT Bags-50*8', 50, 8, 12086, 12086, 12086 * 50 * 8, 11.87, 0),
  ('M', 'UNREGISTERED', 'MEDIUM OZONE SO FIT Bags-50*8', 50, 8, 24916, 24916, 24916 * 50 * 8, 14.64, 0),
  ('L', 'UNREGISTERED', 'LARGE PP OZONE SO FIT Bags-50*8', 50, 8, 30244, 30244, 30244 * 50 * 8, 16.22, 0),
  ('XL', 'UNREGISTERED', 'XL SMART OZONE SO FIT Bags-50*8', 50, 8, 7904, 7904, 7904 * 50 * 8, 17.81, 0),
  ('XXL', 'UNREGISTERED', 'XXL SMART OZONE SO FIT Bags-50*8', 50, 8, 6993, 6993, 6993 * 50 * 8, 19.587, 0),

  ('NB', 'REGISTERED', 'PREMIUM ROYAL NB 40*8', 40, 8, 399, 399, 399 * 40 * 8, 0, 3970),
  ('NB', 'REGISTERED', 'PREMIUM ROYAL NB 50*8', 50, 8, 189, 189, 189 * 50 * 8, 0, 4586),
  ('NB', 'REGISTERED', 'ROCKET MAGIC T-NEW BORN-30*8', 30, 8, 1885, 1885, 1885 * 30 * 8, 0, 2854),
  ('S', 'REGISTERED', 'FLEXY ECONOMY SMALL 50*8', 50, 8, 165, 165, 165 * 50 * 8, 0, 4849),
  ('S', 'REGISTERED', 'JR ROCKET-SMALL-54*8', 54, 8, 560, 560, 560 * 54 * 8, 0, 5880),
  ('S', 'REGISTERED', 'MAGIC H/P-SMALL-48*8', 48, 8, 1454, 1454, 1454 * 48 * 8, 0, 5150),
  ('S', 'REGISTERED', 'MAGIC JUMBO-SMALL-96*4', 96, 4, 1230, 1230, 1230 * 96 * 4, 0, 5150),
  ('S', 'REGISTERED', 'PREMIUM ROYAL SMALL 50*8', 50, 8, 324, 324, 324 * 50 * 8, 0, 4840),
  ('S', 'REGISTERED', 'ROCKET PLUS SMALL 50*8', 50, 8, 324, 324, 324 * 50 * 8, 0, 4840),
  ('S', 'REGISTERED', 'SMALL PREMIUM OZONE SO FIT Bags-50*8', 50, 8, 141, 141, 141 * 50 * 8, 0, 4844),
  ('S', 'REGISTERED', 'SMALL PREMIUM OZONE SO FIT-NB Bags-50*8', 50, 8, 80, 80, 80 * 50 * 8, 0, 4680),
  ('M', 'REGISTERED', 'JR ROCKET-MED-48*8', 48, 8, 1710, 1710, 1710 * 48 * 8, 0, 5880),
  ('M', 'REGISTERED', 'MEDIUM OZONE SO FIT Bags-50*8', 50, 8, 432, 432, 432 * 50 * 8, 0, 5974),
  ('M', 'REGISTERED', 'PREMIUM ROYAL MEDIUM 50*8', 50, 8, 266, 266, 266 * 50 * 8, 0, 5888),
  ('M', 'REGISTERED', 'ROCKET PLUS MED 50*8', 50, 8, 266, 266, 266 * 50 * 8, 0, 5910),
  ('L', 'REGISTERED', 'FLEXY ECONOMY LARGE 50*8', 50, 8, 60, 60, 60 * 50 * 8, 0, 6214),
  ('L', 'REGISTERED', 'JR ROCKET-LARGE-42*8', 42, 8, 1903, 1903, 1903 * 42 * 8, 0, 5880),
  ('L', 'REGISTERED', 'LARGE PREMIUM OZONE SO FIT Bags-50*8', 50, 8, 950, 950, 950 * 50 * 8, 0, 6620),
  ('L', 'REGISTERED', 'MAGIC JUMBO-LARGE-72*4', 72, 4, 876, 876, 876 * 72 * 4, 0, 5150),
  ('L', 'REGISTERED', 'PREMIUM ROYAL LARGE 50*8', 50, 8, 226, 226, 226 * 50 * 8, 0, 6510),
  ('L', 'REGISTERED', 'ROCKET PLUS LARGE 50*8', 50, 8, 214, 214, 214 * 50 * 8, 0, 6510),
  ('XL', 'REGISTERED', 'FLEXY ECONOMY XL 50*8', 50, 8, 113, 113, 113 * 50 * 8, 0, 6811),
  ('XL', 'REGISTERED', 'JR ROCKET-XL-36*8', 36, 8, 1981, 1981, 1981 * 36 * 8, 0, 5880),
  ('XL', 'REGISTERED', 'MAGIC JUMBO-XL-60*4', 60, 4, 1684, 1684, 1684 * 60 * 4, 0, 5150),
  ('XL', 'REGISTERED', 'PREMIUM ROYAL XL 50*8', 50, 8, 210, 210, 210 * 50 * 8, 0, 7116),
  ('XL', 'REGISTERED', 'ROCKET PLUS XL 50*8', 50, 8, 190, 190, 190 * 50 * 8, 0, 7147),
  ('XL', 'REGISTERED', 'XL PREMIUM OZONE SO FIT Bags-50*8', 50, 8, 180, 180, 180 * 50 * 8, 0, 7266),
  ('XXL', 'REGISTERED', 'FLEXY ECONOMY XXL 50*8', 50, 8, 23, 23, 23 * 50 * 8, 0, 7406),
  ('XXL', 'REGISTERED', 'PREMIUM ROYAL XXL 50*8', 50, 8, 24, 24, 24 * 50 * 8, 0, 7783),
  ('XXL', 'REGISTERED', 'XXL PREMIUM SO FIT Bags-50*8', 50, 8, 193, 193, 193 * 50 * 8, 0, 7912);

insert into public.ozone_customers (
  cnic_ntn, strn, business_name, delivery_destination, registration_status, income_tax_status, tax_rate_236g
) values
  ('1310203665017', '5478763-4', 'Qureshi Plastic Scrap Works', 'House no 242, Gali No 33 Block B, Sher Shah, Karachi West Site Town', 'Unregister', 'Filer', 0.001),
  ('1310203978121', 'K340631-8', 'MUHAMMAD ANAS', 'Plot No M II E 189-189 B, ST-63, Block-C, Jinnah Road, Sher Shah, Karachi South, Karachi South.', 'Unregister', 'Non Filer', 0.02),
  ('1430172093149', 'A675361-1', 'HAFEEZ TRADERS', 'Office No G-12 Ground Floor Mules Mansion, Near W 11 Bus Stop, Keamari, Karachi', 'Unregister', 'Non Filer', 0.02),
  ('1730117168223', 'J811189-1', 'NOOR TRADERS', '(KE 2208) 1726-2136 TIPOO SULTAN RD, 19D BUS-STOP, BALDIA TOWN, Karachi West Baldia Town', 'Unregister', 'Non Filer', 0.02),
  ('3120140637615', '3820903-9', 'HASSAN MAHMOOD', 'DERA NAWAB ROAD, NEAR ABBASIA CHOWK, AHMADPUR EAST, Bahawalpur Ahmadpur East', 'Unregister', 'Non Filer', 0.02),
  ('3130234214075', '4569694-3', 'UMAR TRADERS', 'Kachi Mandi, House No. 32, Mohala Ibrahim Shah, Rahim Yar Khan, Liaqatpur', 'Unregister', 'Filer', 0.001),
  ('3130291011415', 'F828177-6', 'NOUMAN TRADERS', 'BAHAWALPUR', 'Unregister', 'Filer', 0.001),
  ('3320213843805', '1188661-7', 'AWAIS GENERAL STORE', 'ISMAIL MARKET, SHAHEED ROAD, JHANG', 'Unregister', 'Filer', 0.001),
  ('3520215840811', '7200332-8', 'MUHAMMAD RIZWAN HAIDER', '377-PAK BLOCK, ALLAMA IQBAL TOWN, LAHORE', 'Unregister', 'Filer', 0.001),
  ('3520273786180', 'H904927-4', 'Mass Trading Co', 'House No a 42, Muhalah Rangeela Street , Pakki Thatti Samna bad , Lahore', 'Unregister', 'Filer', 0.001),
  ('3610492238923', 'A388340-8', 'MUDASSIR', 'Liaqat, Road, House No 8-7A, Khanewal, Mian Channu.', 'Unregister', 'Filer', 0.001),
  ('3840127099007', '5533974-0', 'MUNAWAR PLASTIC', 'PLOT# M-II-E, 1041, BLOCK-C, SHERSHAH KARACHI, Karachi West Kemari Town', 'Unregister', 'Filer', 0.001),
  ('4130256943293', 'I820042-7', 'AHMED FARAZ', 'Flat no 23, 5th FLOOR MEHRAN Residency, Opp Ghazi Medicare Hospital Heerabad, Hyderabad, Hyderabad City', 'Unregister', 'Filer', 0.001),
  ('4130371096412', 'J473859-0', 'RUBINA ANEES', 'Flat No 23 5th Floor, Mehran Residency, Opposite Ghazi Medicare Hospital, Hirabad, Hyderabad', 'Unregister', 'Filer', 0.001),
  ('4130444468977', '3583579-6', 'M/S CAFE RAEES', '23-E UNIT NO. 5 BLOCK-E', 'Unregister', 'Filer', 0.001),
  ('4200017809695', '5470191-0', 'Hashmi Traders', 'M II E 1289, Block C, Sher Shah, Karachi West Site Town', 'Unregister', 'Filer', 0.001),
  ('4200057152879', 'I309925-1', 'GOHAR ENTERPRISES', 'House No. G-20-3, Clayton Quarter, Jahangir Road, Karachi East, Jamshed Town.', 'Unregister', 'Filer', 0.001),
  ('4210101410629', 'H055791-0', 'SUFIYAN ENTERPRISES', 'C - S - 35 BUKHARI CENTRE 3rd FLOOR, BLOCK 7 AISHA MANZIL, FEDERAL B AREA, Karachi South Lyari Town', 'Unregister', 'Filer', 0.001),
  ('3443113-6', '3443113-6', 'F.Y ENTERPRISES', '11-C-3-10, NAZIMABAD, ., Karachi Central North Nazimabad Tow', 'Register', 'Filer', 0.001),
  ('G369965-2', 'G369965-2', 'STAR TRADER', 'Office No. 7, 1st Floor, Satellite Town Plaza, Commercial Market, Satellite Town, Rawalpindi', 'Register', 'Filer', 0.001),
  ('F733229-8', 'F733229-8', 'T & H ENTERPRISE', 'P-232, 1st floor, Hafiz Center, Opposite Nishat Bakery, Montgomery Bazar, Faisalabad', 'Register', 'Filer', 0.001),
  ('J557234-8', 'J557234-8', 'Merge Line Traders', 'Shop No 24, 2nd Floor, Liberty Mall, Opp. Airport Runway, University Road, Peshawar', 'Register', 'Filer', 0.001);

insert into public.sys_users (
  company_code, username, password_hash, full_name, role, linked_customer_id, hide_rates_and_amounts
)
select
  'OZONE',
  'customer',
  extensions.crypt('customer123', extensions.gen_salt('bf')),
  c.business_name,
  'CUSTOMER',
  c.id,
  true
from public.ozone_customers c
where c.cnic_ntn = '1310203665017'
on conflict (company_code, username) do nothing;

commit;
