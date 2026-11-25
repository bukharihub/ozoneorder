import type { FounderPlaybookData } from '../playbookTypes'

export const FOUNDER_PLAYBOOK: FounderPlaybookData = {
  warningEn: 'CONFIDENTIAL — SUPER_ADMIN / MASTER LOGIN ONLY — DO NOT SHARE WITH CLIENTS OR STAFF',
  warningUr: 'خفیہ — صرف سپر ایڈمن / مالک لاگ اِن — کلائنٹس یا عملے کے ساتھ شیئر نہ کریں',
  sections: [
    {
      id: 'identity',
      titleEn: 'A1. Project identity',
      titleUr: 'A1. پروجیکٹ کی شناخت',
      paragraphsEn: [
        'Product: OZONE Enterprise ERP, package ozone-enterprise-erp v1.0.0. Live web URL: https://ozoneso.vercel.app. Vercel project ozoneso in team bukharihubs-projects.',
        'Backend: Supabase Postgres/PostgREST with custom 12-hour token sessions, RLS, RPCs, triggers and the company-logos storage bucket. Frontend: Next.js 16 App Router, React 19, Tailwind 4, TypeScript, lucide-react, XLSX. Desktop: Electron 45 + electron-builder NSIS x64 opening the live web URL with branded offline and expired-license screens and native print.',
        'Brand: Engineered & Developed by Syed Shoaib Ali Shah Bukhari (Bukharihub) · © 2026 All Rights Reserved.'
      ],
      paragraphsUr: [
        'پروڈکٹ: OZONE Enterprise ERP، پیکج ozone-enterprise-erp ورژن 1.0.0۔ لائیو ویب ایڈریس: https://ozoneso.vercel.app۔ Vercel پروجیکٹ ozoneso، ٹیم bukharihubs-projects۔',
        'بیک اینڈ: Supabase Postgres/PostgREST، 12 گھنٹے کسٹم ٹوکن سیشنز، RLS، RPCs، ٹرگرز اور company-logos اسٹوریج bucket۔ فرنٹ اینڈ: Next.js 16، React 19، Tailwind 4، TypeScript، lucide-react، XLSX۔ ڈیسک ٹاپ: Electron 45 + electron-builder NSIS x64، جو لائیو ویب ایڈریس کھولتا ہے۔',
        'برانڈ: سید شوائب علی شاہ بخاری (بخاری ہب) کی جانب سے انجینئرڈ اور تیار کردہ · © 2026 All Rights Reserved۔'
      ]
    },
    {
      id: 'feature-map',
      titleEn: 'A2. Feature map',
      titleUr: 'A2. فیچر نقشہ',
      paragraphsEn: ['Every active module and its owner-facing purpose.'],
      paragraphsUr: ['ہر فعال ماڈیول اور اس کا مالک کے لیے مقصد۔'],
      tableEn: {
        head: ['Area', 'What exists'],
        rows: [
          ['Dashboard', 'KPIs, monthly value chart, customer segments, live system status cards.'],
          ['Orders', 'Stock-validated sales orders, pending cartons, booking user, print, locks.'],
          ['GDN / Gate Pass', 'Dispatch documents; only voucher type that moves FG stock.'],
          ['Invoices', 'Section 23 invoices, 18% tax, 4% further tax, 236G advance tax.'],
          ['Receipts', 'Bank receipts against invoices, shared bank accounts, amount in words.'],
          ['Ledger / Reports', 'Booker-wise ledger, aging buckets, CSV, full Excel export.'],
          ['Admin', 'Users, roles, permissions, company wizard, licence/demo, factory reset, logo.'],
          ['Customer Portal', 'Linked customers, multi-customer queue, tracking, hidden rates.'],
          ['Guides', 'EN/UR master guide and SUPER_ADMIN-only confidential playbook.']
        ]
      },
      tableUr: {
        head: ['شعبہ', 'موجودہ فیچرز'],
        rows: [
          ['ڈیش بورڈ', 'اہم اشاریے، ماہانہ گراف، کسٹمر اقسام، زندہ سسٹم اسٹیٹس۔'],
          ['آرڈرز', 'اسٹاک سے تصدیق شدہ آرڈر، کارٹن، بکنگ صارف، پرنٹ، لاک۔'],
          ['GDN / گیٹ پاس', 'ڈسپیچ دستاویز؛ واحد واؤچر جو FG اسٹاک بدلتا ہے۔'],
          ['انوائس', 'سیکشن 23 انوائس، 18% ٹیکس، 4% اضافی، 236G ایڈوانس ٹیکس۔'],
          ['رسیدیں', 'انوائس کے خلاف بینک رسید، مشترکہ اکاؤنٹ، رقم الفاظ میں۔'],
          ['لیجر / رپورٹس', 'بکر وار لیجر، aging، CSV، مکمل Excel ایکسپورٹ۔'],
          ['ایڈمن', 'صارف، کردار، اجازتیں، کمپنی وِزرڈ، لائسنس/ڈیمو، فیکٹری ری سیٹ، لوگو۔'],
          ['کسٹمر پورٹل', 'منسلک کسٹمرز، کثیر کسٹمر قطار، ٹریکنگ، چھپی قیمتیں۔'],
          ['گائیڈز', 'انگریزی/اردو ماسٹر گائیڈ اور صرف سپر ایڈمن کے لیے خفیہ پلے بک۔']
        ]
      }
    },
    {
      id: 'database',
      titleEn: 'A3. Database cheat-sheet',
      titleUr: 'A3. ڈیٹابیس چیٹ شیٹ',
      paragraphsEn: [
        'Static tables: sys_companies (tenant master, licence/demo/lock), sys_users (role, permissions, linked customers, hidden rates, bypass), sys_sessions (12-hour tokens), sys_counters (company/year voucher sequence).',
        'Per-company dynamic tables: {code}_products, {code}_customers, {code}_master_ledger. The unified ledger stores SALES_ORDER, GDN_GATE_PASS, SALES_TAX_INVOICE and BANK_RECEIPT.'
      ],
      paragraphsUr: [
        'مستقل جدولیں: sys_companies، sys_users، sys_sessions، sys_counters۔',
        'ہر کمپنی کیDynamic جدولیں: {code}_products، {code}_customers، {code}_master_ledger۔ لیجر چاروں واؤچرز رکھتا ہے: آرڈر، GDN، انوائس، رسید۔'
      ],
      bulletsEn: [
        'Core RPCs: app_authenticate, app_logout, session_user, is_super_admin, check_company, next_voucher_no, create_company, create_company_user, update_company_user, list_company_users, create_voucher, insert_master_ledger, sync_sales_order, import_company_data, change_own_password, update_company_settings, extend_company_demo, convert_company_to_full_license, factory_reset_company.',
        'Triggers: product stock init, ledger stock (only GDN moves stock), sales-order sync, ledger insert/mutation guards, company profile super-admin guard, tax-rate defaults, user defaults.',
        'Migration order 02 → 11; later files override earlier functions and policies. 11 is the final ledger guard layer.'
      ],
      bulletsUr: [
        'اہم RPCs: app_authenticate، app_logout، session_user، is_super_admin، check_company، next_voucher_no، create_company، create_company_user، update_company_user، list_company_users، create_voucher، insert_master_ledger، sync_sales_order، import_company_data، change_own_password، update_company_settings، extend_company_demo، convert_company_to_full_license، factory_reset_company۔',
        'ٹرگرز: پروڈکٹ اسٹاک، لیجر اسٹاک (صرف GDN)، آرڈر سنک، لیجر گارڈز، کمپنی پروفائل گارڈ، ٹیکس ریٹ ڈیفالٹ۔',
        'Migration ترتیب 02 سے 11؛ آخری فائل غالب ہوتی ہے۔'
      ]
    },
    {
      id: 'security',
      titleEn: 'A4. Security architecture',
      titleUr: 'A4. سیکیورٹی آرکیٹیکچر',
      bulletsEn: [
        'Custom token in localStorage sent as x-ozone-session; Supabase Auth sessions are disabled.',
        'RLS and SECURITY DEFINER functions enforce tenant isolation and voucher-type permissions; UI checks mirror but do not replace database checks.',
        'Three lock layers: company (inactive/demo/licence), voucher (3-day, cutoff, downstream document), desktop (expired lock file + offline screen).',
        'Confidential playbook is served by /api/founder-playbook after server-side is_super_admin() verification; never bundle it into client JavaScript.',
        'Rotate all seed demo credentials before any real client handover.'
      ],
      bulletsUr: [
        'کسٹم ٹوکن localStorage میں اور x-ozone-session ہیڈر کے ساتھ بھیجا جاتا ہے؛ Supabase Auth سیشنز بند ہیں۔',
        'RLS اور SECURITY DEFINER فنکشنز کمپنی الگ تھلگ اور اجازتیں نافذ کرتے ہیں؛ UI چیک صرف عکس ہے۔',
        'تین لاک لیئرز: کمپنی، واؤچر، ڈیسک ٹاپ۔',
        'خفیہ پلے بک /api/founder-playbook سے صرف سرور پر is_super_admin() چیک کے بعد ملتی ہے۔',
        'حقیقی کلائنٹ حوالگی سے پہلے تمام ڈیمو اسناد تبدیل کریں۔'
      ],
      paragraphsEn: [],
      paragraphsUr: []
    },
    {
      id: 'deploy',
      titleEn: 'A5. Deploy and build commands',
      titleUr: 'A5. ڈیپلائم اور بلڈ کمانڈز',
      bulletsEn: [
        'npm run lint → tsc --noEmit; npm run build → Next production build.',
        'npx vercel --prod --yes → production deploy to ozoneso.vercel.app.',
        'npm run dist → release/OZONE-Enterprise-Setup-1.0.0.exe.',
        'npm run electron:build:company -- --company=CODE --expiry=YYYY-MM-DD --name="Company Name" → company-locked installer.'
      ],
      bulletsUr: [
        'npm run lint اور npm run build → تصدیق۔',
        'npx vercel --prod --yes → پروڈکشن ڈیپلائم۔',
        'npm run dist → release/OZONE-Enterprise-Setup-1.0.0.exe۔',
        'npm run electron:build:company → کمپنی لاک انسٹالر۔'
      ],
      paragraphsEn: [],
      paragraphsUr: []
    },
    {
      id: 'icp',
      titleEn: 'B1. Who needs this software',
      titleUr: 'B1. اس سافٹ ویئر کو کس کی ضرورت ہے',
      bulletsEn: [
        'Core ICP: diaper, baby-care and FMCG distributors/wholesalers managing cartons, pieces, bookers and tax invoices.',
        'Cities: Karachi first (SITE, Korangi, North Karachi), then Lahore, Faisalabad, Islamabad/Rawalpindi, Multan, Peshawar; then GCC, UK and US small distributors.',
        'Buyers: owner/founder, company admin, store manager, accounts manager, distributor booker.',
        'Triggers: paper registers, GST/Section 23 mistakes, stock mismatch, 30+ day receivables, competitor demo expiry.'
      ],
      bulletsUr: [
        'بنیادی ہدف: ڈائپر، بے بی کیئر اور FMCG ڈسٹری بیوٹرز جو کارٹن، پی سیز، بکرز اور ٹیکس انوائس سنبھالتے ہیں۔',
        'شہر: پہلے کراچی (SITE، کورنگی، نارتھ کراچی)، پھر لاہور، فیصل آباد، اسلام آباد/راولپنڈی، ملتان، پشاور؛ بعد میں GCC، UK اور امریکہ۔',
        'خریدار: مالک، کمپنی ایڈمن، اسٹور منیجر، اکاؤنٹس منیجر، ڈسٹری بیوٹر بکر۔',
        'محرک: کاغذی رجسٹر، ٹیکس غلطیاں، اسٹاک عدم توازن، 30 دن سے اوپر بقایا۔'
      ],
      paragraphsEn: [],
      paragraphsUr: []
    },
    {
      id: 'value',
      titleEn: 'B2. Value proposition',
      titleUr: 'B2. ویلیو پروپوزیشن',
      bulletsEn: [
        'One controlled order-to-cash chain with automatic voucher numbers and tax.',
        'Role separation: store cannot invoice, accounts cannot dispatch, customer sees only own orders and no rates.',
        'Owner controls licences, demo days, suspension and factory reset without code changes.',
        'Cloud web plus Windows desktop installer for branch usage; fast CSV onboarding.'
      ],
      bulletsUr: [
        'آرڈر سے ادائیگی تک ایک کنٹرول شدہ سلسلہ، خودکار نمبر اور ٹیکس۔',
        'کردار الگ: اسٹور انوائس نہیں بنا سکتا، اکاؤنٹس ڈسپیچ نہیں، کسٹمر صرف اپنے آرڈر دیکھتا ہے۔',
        'مالک لائسنس، ڈیمو، معطلی اور فیکٹری ری سیٹ بغیر کوڈ تبدیل کیے کنٹرول کرتا ہے۔',
        'کلاؤڈ ویب اور ونڈوز انسٹالر؛ CSV سے تیز آن بورڈنگ۔'
      ],
      paragraphsEn: [],
      paragraphsUr: []
    },
    {
      id: 'leads',
      titleEn: 'B3. Lead generation blueprint',
      titleUr: 'B3. لیڈ جنریشن بلیو پرنٹ',
      bulletsEn: [
        'Facebook/LinkedIn: 45-second order → GDN → invoice → receipt clips with WhatsApp demo CTA.',
        'WhatsApp free trial: collect company/product/customer lists, create demo, send credentials + guide, day-3 check-in, day-6 conversion call.',
        'Industrial area targeting: Karachi SITE/Korangi and Lahore/Faisalabad wholesale markets with a 20-minute stock-and-ledger audit.',
        'Referral loop: one peer introduction in exchange for extra demo days.',
        'Bukharihub advisory cross-sell: ERP setup + process design + staff training + tax workflow advisory + custom branding.',
        'Retention: weekly aging review, monthly licence/backup check, quarterly feature review.'
      ],
      bulletsUr: [
        'Facebook/LinkedIn: 45 سیکنڈ کی آرڈر→GDN→انوائس→رسید ویڈیوز اور WhatsApp ڈیمو CTA۔',
        'WhatsApp مفت ٹرائل: کمپنی/پروڈکٹ/کسٹمر کی فہرست لیں، ڈیمو بنائیں، اسناد + گائیڈ بھیجیں، تیسرے دن فالو اپ، چھٹے دن کنورژن کال۔',
        'انڈسٹریل ایریا: کراچی SITE/کورنگی اور لاہور/فیصل آباد میں 20 منٹ کا اسٹاک و لیجر آڈٹ۔',
        'ریفرل: ایک ہم پیشہ کلائنٹ کے تعارف کے بدلے اضافی ڈیمو دن۔',
        'بخاری ہب ایڈوائزری: ERP سیٹ اپ + عمل ڈیزائن + عملہ تربیت + ٹیکس ورک فلو + کسٹم برانڈنگ۔',
        'برقراری: ہفتہ وارaging، ماہانہ لائسنس/بیک اپ، سہ ماہی فیچر ریویو۔'
      ],
      paragraphsEn: [],
      paragraphsUr: []
    },
    {
      id: 'pricing',
      titleEn: 'B4. Suggested 3-tier pricing',
      titleUr: 'B4. تین درجے کی تجویز کردہ قیمتیں',
      paragraphsEn: ['Prices are founder guidance and should be adjusted by city, seat count and support level.'],
      paragraphsUr: ['یہ مالک کے لیے رہنما قیمتیں ہیں؛ شہر، صارفین کی تعداد اور سپورٹ کے مطابق ایڈجسٹ کریں۔'],
      tableEn: {
        head: ['Tier', 'Price', 'Includes'],
        rows: [
          ['Free Demo Trial', 'PKR 0 for 7 days', 'One company, sample data, core modules, owner contact support.'],
          ['Monthly / Annual Cloud', 'PKR 8,000/mo or 80,000/yr; Growth 15,000/mo or 150,000/yr', 'Hosted app, seats, updates, WhatsApp support, guides, backups.'],
          ['Custom White-Label', 'One-time PKR 350,000+ with annual support', 'Branding, locked installer, import, training, priority support, custom reports.']
        ]
      },
      tableUr: {
        head: ['درجہ', 'قیمت', 'شامل'],
        rows: [
          ['مفت ڈیمو', '7 دن کے لیے 0 روپے', 'ایک کمپنی، نمونہ ڈیٹا، بنیادی ماڈیولز، مالک سپورٹ۔'],
          ['ماہانہ/سالانہ کلاؤڈ', '8,000 روپے ماہانہ یا 80,000 سالانہ؛ گروتھ 15,000/150,000', 'میزبانی، سیٹس، اپ ڈیٹس، WhatsApp سپورٹ، گائیڈز، بیک اپ۔'],
          ['کسٹم وائیٹ لیبل', 'یکبارگی 350,000 روپے سے اوپر + سالانہ سپورٹ', 'برانڈنگ، لاک انسٹالر، امپورٹ، تربیت، ترجیحی سپورٹ، کسٹم رپورٹس۔']
        ]
      }
    },
    {
      id: 'handover',
      titleEn: 'B5. Client deployment / handover checklist',
      titleUr: 'B5. کلائنٹ ڈیپلائم / حوالگی چیک لسٹ',
      bulletsEn: [
        'Create company via wizard; set code, name, expiry, owner contact and max users.',
        'Import products/customers CSV; verify opening stock and tax/filer flags.',
        'Create Company Admin, Store/FG, Accounts and linked Customer logins; rotate seed credentials.',
        'Set logo, bank details, NTN/STRN, address and entry lock date.',
        'Run one full test: SO → GDN → Invoice → Receipt → Ledger → Aging → Print.',
        'Share EN/UR guide; demonstrate Change Password and sign-out hygiene.',
        'Decide cloud vs desktop; if desktop, build company-locked setup.exe and test launch, print and offline retry.',
        'Record licence renewal date and WhatsApp support contact.'
      ],
      bulletsUr: [
        'وِزرڈ سے کمپنی بنائیں؛ کوڈ، نام، Expiry، مالک رابطہ اور زیادہ سے زیادہ صارف مقرر کریں۔',
        'پروڈکٹ/کسٹمر CSV امپورٹ کریں؛ ابتدائی اسٹاک اور ٹیکس/فائلر چیک کریں۔',
        'کمپنی ایڈمن، اسٹور، اکاؤنٹس اور کسٹمر لاگ اِن بنائیں؛ ڈیمو اسناد تبدیل کریں۔',
        'لوگو، بینک، NTN/STRN، ایڈریس اور انٹری لاک تاریخ سیٹ کریں۔',
        'مکمل ٹیسٹ چلائیں: آرڈر → GDN → انوائس → رسید → لیجر → Aging → پرنٹ۔',
        'انگریزی/اردو گائیڈ شیئر کریں؛ پاس ورڈ تبدیلی اور سائن آؤٹ سکھائیں۔',
        'کلاؤڈ یا ڈیسک ٹاپ طے کریں؛ ڈیسک ٹاپ پر لاک انسٹالر بنا کر لانچ، پرنٹ اور آف لائن ریٹری ٹیسٹ کریں۔',
        'لائسنس کی تجدید تاریخ اور WhatsApp سپورٹ رابطہ ریکارڈ کریں۔'
      ],
      paragraphsEn: [],
      paragraphsUr: []
    }
  ]
}
