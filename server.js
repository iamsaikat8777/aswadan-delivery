const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin Security Config
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'payel123';
const ADMIN_TOKEN = 'aswadan-admin-secret-token-700036';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Databases
let orders = [];
let users = {}; 

// Nodemailer Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.OWNER_EMAIL || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  }
});

// Menu Data
const MENU_ITEMS = [
  { id: 1, name: 'রুই মাছ থালি (Rui Fish Thali)', price: 120, desc: 'ভাত, ভাজা, ডাল, সবজি, রুই মাছ (১ টি), পাঁপড়' },
  { id: 2, name: 'কাতলা মাছ থালি (Katla Fish Thali)', price: 140, desc: 'ভাত, ভাজা, ডাল, সবজি, কাতলা (১ টি), পাঁপড়' },
  { id: 3, name: 'ডিম থালি (Egg Thali)', price: 90, desc: 'ভাত, ভাজা, ডাল, সবজি, ডিমের কারি (১ টি), পাঁপড়' },
  { id: 4, name: 'সবজি থালি (Veg Thali)', price: 80, desc: 'ভাত, ভাজা, ডাল, সবজি (২ রকম), পাঁপড়' },
  { id: 5, name: 'চিকেন থালি (Chicken Thali)', price: 120, desc: 'ভাত, ভাজা, ডাল, সবজি, চিকেন (২ পিস ও আলু), পাঁপড়' }
];

// Admin Protection Middleware
const verifyAdmin = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token === `Bearer ${ADMIN_TOKEN}`) {
    next();
  } else {
    res.status(401).json({ success: false, message: 'Unauthorized: Invalid Admin Password' });
  }
};

// --- API ROUTES ---

// 1. Get Menu
app.get('/api/menu', (req, res) => {
  res.json({ success: true, menu: MENU_ITEMS });
});

// 2. Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_TOKEN });
  } else {
    res.status(400).json({ success: false, message: 'ভুল পাসওয়ার্ড! (Incorrect Password)' });
  }
});

// 3. Google Sign-In Route
app.post('/api/auth/google', (req, res) => {
  const { email, name, picture, phone, address, pincode } = req.body;

  if (!phone || phone.length < 10) {
    return res.status(400).json({ success: false, message: 'সঠিক ১০ সংখ্যার মোবাইল নম্বর প্রয়োজন।' });
  }

  if (pincode !== '700036') {
    return res.status(400).json({ success: false, message: 'আমাদের পরিষেবা শুধুমাত্র ৭০০০৩৬ (700036) পিনকোডেই সীমাবদ্ধ।' });
  }

  const userId = email;
  users[userId] = { email, name, picture, phone, address, pincode, type: 'GOOGLE' };

  res.json({ success: true, user: users[userId] });
});

// 4. Place Order (Requires user authentication check)
app.post('/api/orders', (req, res) => {
  const { userEmail, phone, customerName, address, items, totalAmount, utrNumber, deliveryDate } = req.body;

  if (!userEmail || !phone) {
    return res.status(401).json({ success: false, message: 'অর্ডার করতে প্রথমে সাইন-ইন করুন!' });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'কার্ট খালি!' });
  }

  const totalThalis = items.reduce((acc, item) => acc + item.qty, 0);
  if (totalThalis < 2) {
    return res.status(400).json({ success: false, message: 'কমপক্ষে ২ জন এর অর্ডার নেওয়া হবে (Minimum 2 Thalis required).' });
  }

  const newOrder = {
    orderId: 'ASW-' + Math.floor(100000 + Math.random() * 900000),
    userEmail,
    phone,
    customerName,
    address,
    items,
    totalAmount,
    utrNumber: utrNumber || 'N/A',
    deliveryDate: deliveryDate || 'Tomorrow',
    status: 'PENDING',
    createdAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };

  orders.unshift(newOrder);

  // Email Alert
  const mailOptions = {
    from: '"Aswadan Orders" <noreply@aswadan.com>',
    to: process.env.OWNER_EMAIL || 'your-email@gmail.com',
    subject: `🚨 NEW ORDER: #${newOrder.orderId} - ₹${totalAmount}`,
    html: `
      <h2>New Home Delivery Order - ${newOrder.orderId}</h2>
      <p><strong>Customer:</strong> ${customerName}</p>
      <p><strong>Email:</strong> ${userEmail}</p>
      <p><strong>Mobile:</strong> ${phone}</p>
      <p><strong>Address:</strong> ${address}</p>
      <p><strong>Delivery Date:</strong> ${deliveryDate}</p>
      <p><strong>Payment UTR/Txn Ref:</strong> ${utrNumber}</p>
      <hr/>
      <h3>Order Items:</h3>
      <ul>
        ${items.map(i => `<li>${i.name} x ${i.qty} - ₹${i.price * i.qty}</li>`).join('')}
      </ul>
      <h3>Total Amount: ₹${totalAmount}</h3>
    `
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.log('Email Notification Error:', err.message);
    else console.log('Email sent:', info.response);
  });

  res.json({ success: true, message: 'অর্ডার সফলভাবে জমা হয়েছে!', order: newOrder });
});

// 5. Get Orders for User
app.get('/api/orders/user/:email', (req, res) => {
  const userOrders = orders.filter(o => o.userEmail === req.params.email || o.phone === req.params.email);
  res.json({ success: true, orders: userOrders });
});

// 6. Admin Endpoints
app.get('/api/admin/orders', verifyAdmin, (req, res) => {
  res.json({ success: true, orders });
});

app.post('/api/admin/order-status', verifyAdmin, (req, res) => {
  const { orderId, status } = req.body;
  const order = orders.find(o => o.orderId === orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'অর্ডার পাওয়া যায়নি' });
  }

  order.status = status;
  res.json({ success: true, message: `Order status updated to ${status}`, order });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});