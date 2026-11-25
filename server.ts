import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Initialize Gemini SDK if API key available
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
});

export interface Product {
  id: string;
  code: string;
  description: string;
  packing: string;
  rate: number;
  stock: number;
}

export interface Customer {
  id: string;
  userId: string;
  password: string;
  ntnNumber: string;
  customerName: string;
  businessName: string;
  deliveryDestination: string;
  enrollmentDate: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  ibanNumber: string;
  branchName: string;
  role: 'customer';
  taxStatus?: 'Registered' | 'Unregistered';
}

export interface OrderItem {
  productId: string;
  productDescription: string;
  cartonQty: number;
  rate: number;
  totalValue: number;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  customerUserId: string;
  customerName: string;
  businessName: string;
  ntnNumber: string;
  deliveryDestination: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  ibanNumber: string;
  branchName: string;
  items: OrderItem[];
  totalCartons: number;
  totalAmount: number;
  status: 'Submitted' | 'GDN Issued' | 'Gate Pass Generated' | 'Invoiced' | 'Paid & Settled';
  createdAt: string;
}

export interface GDN {
  id: string;
  gdnNumber: string;
  orderNumber: string;
  date: string;
  customerName: string;
  businessName: string;
  deliveryDestination: string;
  items: OrderItem[];
  totalCartons: number;
  status: 'Issued' | 'Gate Pass Created';
  createdAt: string;
}

export interface GatePass {
  id: string;
  gatePassNumber: string;
  gdnNumber: string;
  orderNumber: string;
  date: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  businessName: string;
  deliveryDestination: string;
  totalCartons: number;
  status: 'Cleared' | 'Invoiced';
  createdAt: string;
}

export interface SalesTaxInvoice {
  id: string;
  invoiceNumber: string;
  gatePassNumber: string;
  gdnNumber: string;
  orderNumber: string;
  date: string;
  businessName: string;
  ntnNumber: string;
  strn: string;
  taxStatus?: 'Registered' | 'Unregistered';
  taxRate?: number;
  items: OrderItem[];
  exclusiveValue: number;
  salesTax: number;
  grandTotal: number;
  status: 'Pending Payment' | 'Paid';
  createdAt: string;
}

export interface BankCashReceipt {
  id: string;
  receiptNumber: string;
  invoiceNumber: string;
  orderNumber: string;
  date: string;
  customerName: string;
  businessName: string;
  paymentMode: 'Bank Transfer' | 'Cheque' | 'Cash' | 'Online Real-time';
  referenceNumber: string;
  amount: number;
  settledAt: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  customerUserId: string;
  customerName: string;
  businessName: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  refDocument?: string;
}

// Initial baseline data
const INITIAL_PRODUCTS: Product[] = [
  { id: 'p1', code: 'DZ-NB-508', description: 'Baby Diaper - New Born (50x8)', packing: '50x8', rate: 3850, stock: 1250 },
  { id: 'p2', code: 'DZ-SM-508', description: 'Baby Diaper - Small Size (50x8)', packing: '50x8', rate: 4200, stock: 980 },
  { id: 'p3', code: 'DZ-MD-508', description: 'Baby Diaper - Medium Size (50x8)', packing: '50x8', rate: 4650, stock: 1450 },
  { id: 'p4', code: 'DZ-LG-508', description: 'Baby Diaper - Large Size (50x8)', packing: '50x8', rate: 5100, stock: 1100 },
  { id: 'p5', code: 'DZ-XL-508', description: 'Baby Diaper - XL Size (50x8)', packing: '50x8', rate: 5550, stock: 850 },
  { id: 'p6', code: 'DZ-XXL-508', description: 'Baby Diaper - XXL Size (50x8)', packing: '50x8', rate: 6000, stock: 420 }
];

let products: Product[] = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
let customers: Customer[] = [
  {
    id: 'cust-1',
    userId: 'cust_sk',
    password: 'password123',
    ntnNumber: '42603-0342632-9',
    customerName: 'Muneeb Ahmed',
    businessName: 'SK ENTERPRISES',
    deliveryDestination: 'Plot no 1726, Tipu Sultan Road, 19/D Bus Stop, Baldia Town, Karachi',
    enrollmentDate: '2026-10-01',
    bankName: 'BANK AL HABIB LIMITED',
    accountTitle: 'SK ENTERPRISES',
    accountNumber: '1089 0981 0086 2101',
    ibanNumber: 'PK31 BAHL 1089 0981 0086 2101',
    branchName: 'Boulton Branch, Karachi',
    role: 'customer'
  },
  {
    id: 'cust-2',
    userId: 'cust_babar',
    password: 'password123',
    ntnNumber: '42201-1234567-8',
    customerName: 'Babar Hussain',
    businessName: 'Babar Baby Care Emporium',
    deliveryDestination: 'Shop # 14, Main Jodia Bazaar Wholesale Market, Karachi',
    enrollmentDate: '2026-10-02',
    bankName: 'Habib Bank Limited (HBL)',
    accountTitle: 'Babar Baby Care',
    accountNumber: '0042 7901 2345 6701',
    ibanNumber: 'PK64 HABB 0042 7901 2345 6701',
    branchName: 'Jodia Bazaar Branch, Karachi',
    role: 'customer'
  }
];

let salesOrders: SalesOrder[] = [
  {
    id: 'ord-1001',
    orderNumber: 'OE-2026-1001',
    orderDate: '2026-10-01',
    customerUserId: 'cust_sk',
    customerName: 'Muneeb Ahmed',
    businessName: 'SK ENTERPRISES',
    ntnNumber: '42603-0342632-9',
    deliveryDestination: 'Plot no 1726, Tipu Sultan Road, 19/D Bus Stop, Baldia Town, Karachi',
    bankName: 'BANK AL HABIB LIMITED',
    accountTitle: 'SK ENTERPRISES',
    accountNumber: '1089 0981 0086 2101',
    ibanNumber: 'PK31 BAHL 1089 0981 0086 2101',
    branchName: 'Boulton Branch, Karachi',
    items: [
      { productId: 'p3', productDescription: 'Baby Diaper - Medium Size (50x8)', cartonQty: 20, rate: 4650, totalValue: 93000 },
      { productId: 'p4', productDescription: 'Baby Diaper - Large Size (50x8)', cartonQty: 15, rate: 5100, totalValue: 76500 }
    ],
    totalCartons: 35,
    totalAmount: 169500,
    status: 'Submitted',
    createdAt: '2026-10-01T10:00:00Z'
  }
];

let gdns: GDN[] = [];
let gatePasses: GatePass[] = [];
let salesTaxInvoices: SalesTaxInvoice[] = [];
let receipts: BankCashReceipt[] = [];

let customerLedger: LedgerEntry[] = [
  {
    id: 'led-1',
    date: '2026-10-01',
    customerUserId: 'cust_sk',
    customerName: 'Muneeb Ahmed',
    businessName: 'SK ENTERPRISES',
    description: 'Initial Opening Balance / Security Advance',
    debit: 0,
    credit: 25000,
    balance: 25000,
    refDocument: 'OP-001'
  },
  {
    id: 'led-2',
    date: '2026-10-01',
    customerUserId: 'cust_sk',
    customerName: 'Muneeb Ahmed',
    businessName: 'SK ENTERPRISES',
    description: 'Sales Order # OE-2026-1001 Billing (35 Cartons)',
    debit: 169500,
    credit: 0,
    balance: -144500,
    refDocument: 'OE-2026-1001'
  }
];

// API Endpoints

// Authentication (Masked password check)
app.post('/api/auth/login', (req, res) => {
  const { username, password, role } = req.body;
  if (role === 'admin') {
    if (username === 'admin' && (password === 'ozone2026!' || password === 'admin123')) {
      return res.json({
        success: true,
        user: { username: 'admin', name: 'Master Administrator', businessName: 'Ozone Enterprise HQ', role: 'admin' }
      });
    }
    return res.status(401).json({ success: false, message: 'Invalid Admin credentials. Use admin / ozone2026!' });
  } else {
    const cust = customers.find(c => c.userId.toLowerCase() === username.trim().toLowerCase() && c.password === password);
    if (cust) {
      return res.json({ success: true, customer: cust, user: { username: cust.userId, name: cust.customerName, businessName: cust.businessName, role: 'customer' } });
    }
    return res.status(401).json({ success: false, message: 'Invalid Customer ID or Password.' });
  }
});

// Admin: Create New Customer
app.post('/api/customers/create', (req, res) => {
  const {
    userId, password, ntnNumber, customerName, businessName,
    deliveryDestination, enrollmentDate, bankName, accountTitle,
    accountNumber, ibanNumber, branchName
  } = req.body;

  if (!userId || !customerName || !businessName) {
    return res.status(400).json({ success: false, message: 'User ID, Customer Name, and Business Name are required.' });
  }

  if (customers.some(c => c.userId.toLowerCase() === userId.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'Customer with this User ID already exists.' });
  }

  const newCustomer: Customer = {
    id: `cust-${Date.now()}`,
    userId: userId.trim(),
    password: password || 'password123',
    ntnNumber: ntnNumber || '42603-0000000-0',
    customerName,
    businessName,
    deliveryDestination: deliveryDestination || 'Karachi, Pakistan',
    enrollmentDate: enrollmentDate || new Date().toISOString().split('T')[0],
    bankName: bankName || 'BANK AL HABIB LIMITED',
    accountTitle: accountTitle || businessName,
    accountNumber: accountNumber || '',
    ibanNumber: ibanNumber || '',
    branchName: branchName || 'Karachi Branch',
    role: 'customer'
  };

  customers.unshift(newCustomer);

  // Initialize customer ledger
  customerLedger.push({
    id: `led-${Date.now()}-open`,
    date: newCustomer.enrollmentDate,
    customerUserId: newCustomer.userId,
    customerName: newCustomer.customerName,
    businessName: newCustomer.businessName,
    description: 'Account Enrollment Initialized',
    debit: 0,
    credit: 0,
    balance: 0,
    refDocument: 'ENROLL'
  });

  res.json({ success: true, customer: newCustomer, message: `Customer ${customerName} enrolled successfully.` });
});

// Admin: Update Customer Profile & Reset Password
app.put('/api/customers/update', (req, res) => {
  const { id, userId, password, ntnNumber, customerName, businessName, deliveryDestination, bankName, accountTitle, accountNumber, ibanNumber, branchName } = req.body;
  const index = customers.findIndex(c => c.id === id || c.userId === userId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Customer not found.' });
  }

  customers[index] = {
    ...customers[index],
    password: password ? password : customers[index].password,
    ntnNumber: ntnNumber ?? customers[index].ntnNumber,
    customerName: customerName ?? customers[index].customerName,
    businessName: businessName ?? customers[index].businessName,
    deliveryDestination: deliveryDestination ?? customers[index].deliveryDestination,
    bankName: bankName ?? customers[index].bankName,
    accountTitle: accountTitle ?? customers[index].accountTitle,
    accountNumber: accountNumber ?? customers[index].accountNumber,
    ibanNumber: ibanNumber ?? customers[index].ibanNumber,
    branchName: branchName ?? customers[index].branchName
  };

  res.json({ success: true, customer: customers[index], message: `Customer ${customers[index].customerName} updated successfully.` });
});

// Admin: Factory Reset (Wipe all transactional data)
app.post('/api/admin/factory-reset', (req, res) => {
  salesOrders = [];
  gdns = [];
  gatePasses = [];
  salesTaxInvoices = [];
  receipts = [];
  customerLedger = [];
  products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));

  res.json({
    success: true,
    message: 'Factory Reset complete. All transactional registers, ledgers, and orders have been wiped clean.'
  });
});

// Get Customers List (Admin)
app.get('/api/customers', (req, res) => {
  res.json({ success: true, customers });
});

// Get Products Catalog
app.get('/api/inventory', (req, res) => {
  res.json({ success: true, products });
});

// Get Sales Orders (Master Register)
app.get('/api/orders', (req, res) => {
  res.json({ success: true, orders: salesOrders });
});

// Post Sales Order (Customer)
app.post('/api/orders/post', (req, res) => {
  const { customerUserId, orderDate, items } = req.body;
  const customer = customers.find(c => c.userId === customerUserId);
  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer account not found.' });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Please select at least one diaper carton.' });
  }

  let totalAmount = 0;
  let totalCartons = 0;

  const processedItems: OrderItem[] = items.map((i: any) => {
    const prod = products.find(p => p.id === i.productId);
    const rate = prod ? prod.rate : i.rate;
    const qty = Number(i.cartonQty) || 0;
    const val = qty * rate;
    totalAmount += val;
    totalCartons += qty;

    if (prod) {
      prod.stock = Math.max(0, prod.stock - qty);
    }

    return {
      productId: i.productId,
      productDescription: prod ? prod.description : i.productDescription,
      cartonQty: qty,
      rate,
      totalValue: val
    };
  });

  const orderNumSeq = 1000 + salesOrders.length + 1;
  const orderNumber = `OE-2026-${orderNumSeq}`;

  const newOrder: SalesOrder = {
    id: `ord-${Date.now()}`,
    orderNumber,
    orderDate: orderDate || new Date().toISOString().split('T')[0],
    customerUserId: customer.userId,
    customerName: customer.customerName,
    businessName: customer.businessName,
    ntnNumber: customer.ntnNumber,
    deliveryDestination: customer.deliveryDestination,
    bankName: customer.bankName,
    accountTitle: customer.accountTitle,
    accountNumber: customer.accountNumber,
    ibanNumber: customer.ibanNumber,
    branchName: customer.branchName,
    items: processedItems,
    totalCartons,
    totalAmount,
    status: 'Submitted',
    createdAt: new Date().toISOString()
  };

  salesOrders.unshift(newOrder);

  // Update customer ledger with debit entry
  const userEntries = customerLedger.filter(l => l.customerUserId === customer.userId);
  const currentBal = userEntries.length > 0 ? userEntries[userEntries.length - 1].balance : 0;
  const newBal = currentBal - totalAmount;

  customerLedger.push({
    id: `led-${Date.now()}`,
    date: newOrder.orderDate,
    customerUserId: customer.userId,
    customerName: customer.customerName,
    businessName: customer.businessName,
    description: `Sales Order #${orderNumber} Billing (${totalCartons} Cartons)`,
    debit: totalAmount,
    credit: 0,
    balance: newBal,
    refDocument: orderNumber
  });

  res.json({
    success: true,
    message: `Sales Order ${orderNumber} posted successfully to Master Register.`,
    order: newOrder
  });
});

// Step 1 -> 2: Generate GDN (Goods Delivery Note)
app.post('/api/workflow/gdn/create', (req, res) => {
  const { orderId } = req.body;
  const order = salesOrders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Sales Order not found.' });

  const gdnNumber = `GDN-2026-${100 + gdns.length + 1}`;
  const newGDN: GDN = {
    id: `gdn-${Date.now()}`,
    gdnNumber,
    orderNumber: order.orderNumber,
    date: new Date().toISOString().split('T')[0],
    customerName: order.customerName,
    businessName: order.businessName,
    deliveryDestination: order.deliveryDestination,
    items: order.items,
    totalCartons: order.totalCartons,
    status: 'Issued',
    createdAt: new Date().toISOString()
  };

  gdns.unshift(newGDN);
  order.status = 'GDN Issued';

  res.json({ success: true, gdn: newGDN, message: `Goods Delivery Note ${gdnNumber} issued for Order ${order.orderNumber}.` });
});

app.get('/api/workflow/gdn', (req, res) => {
  res.json({ success: true, gdns });
});

// Step 2 -> 3: Generate Gate Pass
app.post('/api/workflow/gatepass/create', (req, res) => {
  const { gdnId, vehicleNumber, driverName, driverPhone } = req.body;
  const gdn = gdns.find(g => g.id === gdnId);
  if (!gdn) return res.status(404).json({ success: false, message: 'GDN not found.' });

  const gpNumber = `GP-2026-${100 + gatePasses.length + 1}`;
  const newGatePass: GatePass = {
    id: `gp-${Date.now()}`,
    gatePassNumber: gpNumber,
    gdnNumber: gdn.gdnNumber,
    orderNumber: gdn.orderNumber,
    date: new Date().toISOString().split('T')[0],
    vehicleNumber: vehicleNumber || 'KHI-7892 (Mazda Titan)',
    driverName: driverName || 'Muhammad Rashid',
    driverPhone: driverPhone || '0312-9876543',
    businessName: gdn.businessName,
    deliveryDestination: gdn.deliveryDestination,
    totalCartons: gdn.totalCartons,
    status: 'Cleared',
    createdAt: new Date().toISOString()
  };

  gatePasses.unshift(newGatePass);
  gdn.status = 'Gate Pass Created';

  const order = salesOrders.find(o => o.orderNumber === gdn.orderNumber);
  if (order) order.status = 'Gate Pass Generated';

  res.json({ success: true, gatePass: newGatePass, message: `Gate Pass ${gpNumber} issued for GDN ${gdn.gdnNumber}.` });
});

app.get('/api/workflow/gatepass', (req, res) => {
  res.json({ success: true, gatePasses });
});

// Step 3 -> 4: Issue Sales Tax Invoice
app.post('/api/workflow/tax-invoice/create', (req, res) => {
  const { gatePassId } = req.body;
  const gatePass = gatePasses.find(gp => gp.id === gatePassId);
  if (!gatePass) return res.status(404).json({ success: false, message: 'Gate Pass not found.' });

  const order = salesOrders.find(o => o.orderNumber === gatePass.orderNumber);
  const total = order ? order.totalAmount : 0;
  const customer = customers.find(c => c.businessName === gatePass.businessName || (order && c.userId === order.customerUserId));
  const isReg = customer?.taxStatus === 'Registered';
  const taxRate = isReg ? 18 : 22;
  const divisor = isReg ? 1.18 : 1.22;
  const exclusiveValue = Math.round(total / divisor);
  const salesTax = total - exclusiveValue;
  const grandTotal = total; // Perfectly reconciles with original sales order total

  const invNumber = `STI-2026-${500 + salesTaxInvoices.length + 1}`;
  const newInvoice: SalesTaxInvoice = {
    id: `inv-${Date.now()}`,
    invoiceNumber: invNumber,
    gatePassNumber: gatePass.gatePassNumber,
    gdnNumber: gatePass.gdnNumber,
    orderNumber: gatePass.orderNumber,
    date: new Date().toISOString().split('T')[0],
    businessName: gatePass.businessName,
    ntnNumber: order ? order.ntnNumber : '42603-0342632-9',
    strn: isReg ? '3277876123475' : 'Unregistered Party (Non-STRN)',
    taxStatus: isReg ? 'Registered' : 'Unregistered',
    taxRate,
    items: order ? order.items : [],
    exclusiveValue,
    salesTax,
    grandTotal,
    status: 'Pending Payment',
    createdAt: new Date().toISOString()
  };

  salesTaxInvoices.unshift(newInvoice);
  gatePass.status = 'Invoiced';
  if (order) order.status = 'Invoiced';

  res.json({ success: true, invoice: newInvoice, message: `Sales Tax Invoice ${invNumber} generated.` });
});

app.get('/api/workflow/tax-invoice', (req, res) => {
  res.json({ success: true, invoices: salesTaxInvoices });
});

// Step 4 -> 5: Bank/Cash Receipt & Netting off
app.post('/api/workflow/receipt/create', (req, res) => {
  const { invoiceId, paymentMode, referenceNumber, amount } = req.body;
  const invoice = salesTaxInvoices.find(inv => inv.id === invoiceId);
  if (!invoice) return res.status(404).json({ success: false, message: 'Sales Tax Invoice not found.' });

  const payAmt = Number(amount) || invoice.grandTotal;
  const rcpNumber = `RCP-2026-${300 + receipts.length + 1}`;

  const newReceipt: BankCashReceipt = {
    id: `rcp-${Date.now()}`,
    receiptNumber: rcpNumber,
    invoiceNumber: invoice.invoiceNumber,
    orderNumber: invoice.orderNumber,
    date: new Date().toISOString().split('T')[0],
    customerName: invoice.businessName,
    businessName: invoice.businessName,
    paymentMode: paymentMode || 'Bank Transfer',
    referenceNumber: referenceNumber || `FT-${Date.now().toString().slice(-6)}`,
    amount: payAmt,
    settledAt: new Date().toISOString()
  };

  receipts.unshift(newReceipt);
  invoice.status = 'Paid';

  const order = salesOrders.find(o => o.orderNumber === invoice.orderNumber);
  if (order) order.status = 'Paid & Settled';

  // Credit Customer Ledger & Net off balance
  const userEntries = customerLedger.filter(l => l.businessName === invoice.businessName);
  const currentBal = userEntries.length > 0 ? userEntries[userEntries.length - 1].balance : 0;
  const newBal = currentBal + payAmt;

  customerLedger.push({
    id: `led-${Date.now()}-rcp`,
    date: newReceipt.date,
    customerUserId: order ? order.customerUserId : 'cust_sk',
    customerName: order ? order.customerName : invoice.businessName,
    businessName: invoice.businessName,
    description: `Receipt #${rcpNumber} via ${newReceipt.paymentMode} (Ref: ${newReceipt.referenceNumber}) for Inv ${invoice.invoiceNumber}`,
    debit: 0,
    credit: payAmt,
    balance: newBal,
    refDocument: rcpNumber
  });

  res.json({ success: true, receipt: newReceipt, message: `Receipt ${rcpNumber} recorded. PKR ${payAmt.toLocaleString()} credited & balance netted off.` });
});

app.get('/api/workflow/receipt', (req, res) => {
  res.json({ success: true, receipts });
});

// Customer Ledger
app.get('/api/ledger', (req, res) => {
  res.json({ success: true, ledger: customerLedger });
});

// Gemini AI Insights
app.post('/api/ai/insights', async (req, res) => {
  try {
    const totalRev = salesOrders.reduce((s, o) => s + o.totalAmount, 0);
    const lowStock = products.filter(p => p.stock < 500);

    const prompt = `You are the executive financial and operational analyst for "OZONE ENTERPRISE" based at Plot No ST-2, Sector 18, Korangi Industrial Area, Karachi (NTN: 7217629-7 | STRN: 3277876123475).
    Diaper packaging: 50x8.
    
    Status Overview:
    - Registered Customers: ${customers.length}
    - Total Sales Orders: ${salesOrders.length}
    - Total GDNs Issued: ${gdns.length}
    - Total Gate Passes: ${gatePasses.length}
    - Sales Tax Invoices: ${salesTaxInvoices.length}
    - Receipts Settled: ${receipts.length}
    - Total Gross Revenue: PKR ${totalRev.toLocaleString()}
    - Products with stock below 500 cartons: ${JSON.stringify(lowStock, null, 2)}
    
    Provide an actionable 3-point business intelligence summary covering:
    1. Operational throughput (GDN -> Gate Pass -> Tax Invoice -> Cash Receipt).
    2. Warehouse stock reorder recommendations for Karachi.
    3. Customer balance reconciliation insights.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    res.json({ success: true, insights: response.text });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'AI insights unavailable' });
  }
});

// Vite middleware / Static file serving
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Ozone Enterprise Server running on port ${PORT}`);
  });
}

export default app;
