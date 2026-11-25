import { useState, useEffect } from 'react';
import { supabase } from '../../src/utils/supabase';

export default function AdminCustomers() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form States - UPDATED TO MATCH NEW `public.customers` TABLE SCHEMA
  const [customerId, setCustomerId] = useState(''); // NEW: Required by your schema
  const [name, setName] = useState(''); // REPLACED: customerName -> name
  const [companyName, setCompanyName] = useState(''); // REPLACED: businessName -> company_name
  const [username, setUsername] = useState(''); // Existing
  const [password, setPassword] = useState(''); // Existing (for hashing)
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Karachi');
  const [region, setRegion] = useState('Sindh');
  const [customerType, setCustomerType] = useState('Wholesale Distributer'); // REPLACED: customerCategory -> customer_type
  const [isRegistered, setIsRegistered] = useState(true); // REPLACED: taxStatus -> is_registered (boolean)
  const [taxRate, setTaxRate] = useState(18.00);
  const [taxNumber, setTaxNumber] = useState('');
  const [ntnNumber, setNtnNumber] = useState(''); // REPLACED: ntn -> ntn_number
  const [strnNumber, setStrnNumber] = useState(''); // REPLACED: strn -> strn_number
  const [salesTaxRegNo, setSalesTaxRegNo] = useState(''); // NEW: from your schema
  const [creditLimit, setCreditLimit] = useState(500000.00); // Default from schema
  const [balance, setBalance] = useState(0.00); // Default from schema
  const [currentBalance, setCurrentBalance] = useState(0.00); // Default from schema

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Basic client-side validation for NEW REQUIRED fields
    if (!customerId || !name || !companyName || !username || !password) {
      setError('برائے مہربانی تمام ضروری فیلڈز پُر کریں: کسٹمر ID، نام، کمپنی کا نام، یوزرنیم، اور پاس ورڈ۔');
      setLoading(false);
      return;
    }

    try {
      // 1. Hash password using the Supabase RPC function
      const { data: passwordHash, error: hashError } = await supabase
        .rpc('hash_password', { plaintext_password: password });

      if (hashError) {
        console.error('پاس ورڈ ہیشنگ RPC ایرر:', hashError);
        throw new Error(`پاس ورڈ ہیش کرنے میں ناکامی۔ Supabase 'hash_password' فنکشن چیک کریں۔ تفصیل: ${hashError.message}`);
      }

      // 2. Prepare Data for Insertion - MATCHING THE NEW `public.customers` SCHEMA EXACTLY
      const newCustomerData = {
        customer_id: customerId, // NEW REQUIRED FIELD
        username: username,
        password_hash: passwordHash,
        name: name, // MATCHING NEW SCHEMA
        company_name: companyName, // MATCHING NEW SCHEMA
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city,
        region: region,
        customer_type: customerType, // MATCHING NEW SCHEMA
        is_registered: isRegistered, // MATCHING NEW SCHEMA
        tax_rate: parseFloat(taxRate),
        tax_number: taxNumber || null,
        ntn_number: ntnNumber || null, // MATCHING NEW SCHEMA
        strn_number: strnNumber || null, // MATCHING NEW SCHEMA
        sales_tax_reg_no: salesTaxRegNo || null, // MATCHING NEW SCHEMA
        credit_limit: parseFloat(creditLimit),
        balance: parseFloat(balance),
        current_balance: parseFloat(currentBalance),
        // id, created_at, updated_at are handled by DB defaults
      };

      // 3. Insert into Supabase 'customers' table
      const { data, error: insertError } = await supabase
        .from('customers')
        .insert([newCustomerData])
        .select();

      if (insertError) {
        console.error('Supabase داخل کرنے میں ایرر:', insertError);
        throw new Error(`کسٹمر کو سیو کرنے میں ناکامی۔ تفصیل: ${insertError.message}`);
      }

      setSuccess("کسٹمر کامیابی سے Supabase میں محفوظ ہو گیا ہے!");

      // Reset Form Fields
      setCustomerId('');
      setName('');
      setCompanyName('');
      setUsername('');
      setPassword('');
      setPhone('');
      setEmail('');
      setAddress('');
      setCity('Karachi');
      setRegion('Sindh');
      setCustomerType('Wholesale Distributer');
      setIsRegistered(true);
      setTaxRate(18.00);
      setTaxNumber('');
      setNtnNumber('');
      setStrnNumber('');
      setSalesTaxRegNo('');
      setCreditLimit(500000.00);
      setBalance(0.00);
      setCurrentBalance(0.00);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 font-sans bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-blue-800 text-center">اوزون انٹرپرائز - نیا کسٹمر شامل کریں (Updated)</h1>
      
      <form onSubmit={handleAddCustomer} className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-xl border border-blue-200">
        <h2 className="text-xl font-semibold mb-6 text-gray-700">کسٹمر کی تفصیلات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">کسٹمر ID <span className="text-red-500">*</span></label>
            <input type="text" value={customerId} onChange={(e)=>setCustomerId(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نام <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={(e)=>setName(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">کمپنی کا نام <span className="text-red-500">*</span></label>
            <input type="text" value={companyName} onChange={(e)=>setCompanyName(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">یوزرنیم (لاگ ان ID) <span className="text-red-500">*</span></label>
            <input type="text" value={username} onChange={(e)=>setUsername(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">پاس ورڈ <span className="text-red-500">*</span></label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">فون</label>
            <input type="text" value={phone} onChange={(e)=>setPhone(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ای میل</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">ایڈریس</label>
            <textarea value={address} onChange={(e)=>setAddress(e.target.value)} rows="2" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500"></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">شہر</label>
            <input type="text" value={city} onChange={(e)=>setCity(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">علاقہ</label>
            <input type="text" value={region} onChange={(e)=>setRegion(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">کسٹمر کی قسم</label>
            <select value={customerType} onChange={(e)=>setCustomerType(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500">
              <option value="Wholesale Distributer">ہول سیل ڈسٹری بیوٹر</option>
              <option value="Retailer">ریٹیلر</option>
              <option value="Direct Consumer">براہ راست صارف</option>
              {/* Add other customer types if needed */}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رجسٹرڈ ہے؟</label>
            <select value={isRegistered ? 'true' : 'false'} onChange={(e)=>setIsRegistered(e.target.value === 'true')} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500">
              <option value="true">ہاں</option>
              <option value="false">نہیں</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ٹیکس کی شرح (%)</label>
            <input type="number" step="0.01" value={taxRate} onChange={(e)=>setTaxRate(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ٹیکس نمبر</label>
            <input type="text" value={taxNumber} onChange={(e)=>setTaxNumber(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NTN نمبر</label>
            <input type="text" value={ntnNumber} onChange={(e)=>setNtnNumber(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">STRN نمبر</label>
            <input type="text" value={strnNumber} onChange={(e)=>setStrnNumber(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">سیلز ٹیکس رجسٹریشن نمبر</label>
            <input type="text" value={salesTaxRegNo} onChange={(e)=>setSalesTaxRegNo(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">کریڈٹ لمٹ</label>
            <input type="number" step="0.01" value={creditLimit} onChange={(e)=>setCreditLimit(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">بیلنس</label>
            <input type="number" step="0.01" value={balance} onChange={(e)=>setBalance(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">موجودہ بیلنس</label>
            <input type="number" step="0.01" value={currentBalance} onChange={(e)=>setCurrentBalance(e.target.value)} className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>
        
        <button type="submit" disabled={loading} className="mt-6 w-full bg-blue-700 text-white font-bold py-3 rounded-md hover:bg-blue-800 transition duration-300 ease-in-out disabled:opacity-50">
          {loading ? 'ڈیٹا محفوظ کیا جا رہا ہے...' : 'کسٹمر کو تصدیق اور محفوظ کریں'}
        </button>

        {error && <div className="mt-4 p-3 bg-red-100 text-red-700 border border-red-400 rounded-md">{error}</div>}
        {success && <div className="mt-4 p-3 bg-green-100 text-green-700 border border-green-400 rounded-md">{success}</div>}
      </form>
    </div>
  );
}
