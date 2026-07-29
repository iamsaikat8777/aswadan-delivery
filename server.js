const express = require('express');
const { Resend } = require('resend');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// File Storage Paths
const USERS_FILE = path.join(__dirname, 'users.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const MENU_FILE = path.join(__dirname, 'menu.json');
const OFFER_FILE = path.join(__dirname, 'offer.json');
const ADMIN_FILE = path.join(__dirname, 'admin.json');
const REVIEWS_FILE = path.join(__dirname, 'reviews.json');
const SPECIAL_REQUESTS_FILE = path.join(__dirname, 'special_requests.json');

function loadData(filePath, defaultData = []) {
  try {
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(rawData);
    }
  } catch (err) {
    console.error(`Error loading ${filePath}:`, err.message);
  }
  return defaultData;
}

function saveData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error saving ${filePath}:`, err.message);
  }
}

function syncUsersFromOrders(users, orders) {
  let updated = false;
  orders.forEach(order => {
    if (order.phone) {
      const exists = users.find(u => String(u.phone).trim() === String(order.phone).trim());
      if (!exists) {
        users.push({
          name: order.customerName || 'Customer',
          phone: order.phone,
          email: order.email || '',
          address: order.address || '',
          location: order.location || '',
          pincode: '700036',
          isBlocked: false,
          preferredItems: []
        });
        updated = true;
      }
    }
  });
  if (updated) {
    saveData(USERS_FILE, users);
  }
  return users;
}

const defaultMenu = [
  { id: 1, name: 'রুই মাছের থালি (Rui Fish Thali)', price: 110, desc: 'ভাত, ডাল, ভাজা, রুই মাছের ঝোল ও চাটনি' },
  { id: 2, name: 'কাতলা মাছের থালি (Katla Fish Thali)', price: 140, desc: 'ভাত, ডাল, ভাজা, কাতলা কালিয়া ও চাটনি' },
  { id: 3, name: 'চিকেন থালি (Chicken Thali)', price: 150, desc: 'ভাত, ডাল, ভাজা, কষা মুরগির মাংস ও চাটনি' },
  { id: 4, name: 'ডিম থালি (Egg Thali)', price: 100, desc: 'ভাত, ডাল, ভাজা, ডিমের ঝোল (২টি ডিম) ও চাটনি' },
  { id: 5, name: 'বিশেষ নিরামিষ থালি (Special Veg Thali)', price: 90, desc: 'ভাত, সোনা মুগ ডাল, আলু ভাজা, নিরামিষ তরকারি ও চাটনি' }
];

const defaultOffer = {
  enabled: false,
  title: '🔥 বিশেষ ছাড়ের ধামাকা অফার!',
  desc: 'আজই অর্ডার করুন এবং পান বিশেষ ছাড়। সীমিত সময়ের অফার!',
  image: ''
};

const defaultAdminConfig = {
  password: process.env.ADMIN_PASSWORD || 'payel123',
  email: 'iammadhuchanda@gmail.com'
};

let usersDB = loadData(USERS_FILE, []);
let ordersDB = loadData(ORDERS_FILE, []);
let menuDB = loadData(MENU_FILE, defaultMenu);
let offerDB = loadData(OFFER_FILE, defaultOffer);
let adminConfig = loadData(ADMIN_FILE, defaultAdminConfig);
let reviewsDB = loadData(REVIEWS_FILE, []);
let specialRequestsDB = loadData(SPECIAL_REQUESTS_FILE, []);
const otpStore = {};

if (!fs.existsSync(MENU_FILE)) saveData(MENU_FILE, menuDB);
if (!fs.existsSync(OFFER_FILE)) saveData(OFFER_FILE, offerDB);
if (!fs.existsSync(ADMIN_FILE)) saveData(ADMIN_FILE, adminConfig);
if (!fs.existsSync(REVIEWS_FILE)) saveData(REVIEWS_FILE, reviewsDB);
if (!fs.existsSync(SPECIAL_REQUESTS_FILE)) saveData(SPECIAL_REQUESTS_FILE, specialRequestsDB);

usersDB = syncUsersFromOrders(usersDB, ordersDB);

const resend = new Resend(process.env.EMAIL_PASSWORD || '');
const OWNER_NOTIFY_EMAIL = process.env.OWNER_EMAIL || 'iammadhuchanda@gmail.com';

async function sendEmail(to, subject, htmlContent) {
  if (!to) return;
  try {
    const senderEmail = process.env.VERIFIED_SENDER || 'info@aaswadanfoodservices.com';
    await resend.emails.send({
      from: `আস্বাদন Food Services <${senderEmail}>`,
      to: [to],
      subject: subject,
      html: htmlContent
    });
  } catch (err) {
    console.error('Email failed to:', to, err.message);
  }
}

// --- PUBLIC & USER ROUTES ---
app.get('/api/menu', (req, res) => {
  menuDB = loadData(MENU_FILE, defaultMenu);
  res.json({ success: true, menu: menuDB });
});

app.get('/api/offer', (req, res) => {
  offerDB = loadData(OFFER_FILE, defaultOffer);
  res.json({ success: true, offer: offerDB });
});

app.get('/api/reviews', (req, res) => {
  try {
    reviewsDB = loadData(REVIEWS_FILE, []);
    const totalReviews = reviewsDB.length;
    let avgRating = 5.0;
    if (totalReviews > 0) {
      const sum = reviewsDB.reduce((acc, r) => acc + Number(r.rating), 0);
      avgRating = (sum / totalReviews).toFixed(1);
    }
    res.json({ success: true, reviews: reviewsDB, stats: { totalReviews, avgRating } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error loading reviews' });
  }
});

app.post('/api/reviews', (req, res) => {
  const { name, phone, rating, comment } = req.body;
  if (!name || !phone || !rating || !comment) {
    return res.status(400).json({ success: false, message: 'সব ফিল্ড পূরণ করুন।' });
  }

  usersDB = loadData(USERS_FILE, []);
  const registeredUser = usersDB.find(u => String(u.phone).trim() === String(phone).trim());
  if (!registeredUser) {
    return res.status(403).json({ success: false, message: 'শুধুমাত্র রেজিস্টার্ড ব্যবহারকারীরাই রিভিউ দিতে পারবেন।' });
  }

  reviewsDB = loadData(REVIEWS_FILE, []);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const englishDate = new Date().toLocaleDateString('en-US', options);

  const newReview = { id: Date.now(), name, phone, rating: Number(rating), comment, date: englishDate };
  reviewsDB.unshift(newReview);
  saveData(REVIEWS_FILE, reviewsDB);

  res.json({ success: true, message: 'আপনার মূল্যবান রিভিউটি সফলভাবে জমা হয়েছে!', review: newReview });
});

// 6) Special Request Placed
app.post('/api/special-request', (req, res) => {
  const { phone, customerName, email, itemName, description, qty } = req.body;
  if (!phone || !itemName || !qty) {
    return res.status(400).json({ success: false, message: 'খাবারের নাম ও পরিমাণ উল্লেখ করুন।' });
  }

  specialRequestsDB = loadData(SPECIAL_REQUESTS_FILE, []);
  const reqId = 'SRQ-' + Math.floor(100000 + Math.random() * 900000);

  const newReq = {
    requestId: reqId,
    phone,
    customerName,
    email,
    itemName,
    description: description || '',
    qty: Number(qty),
    status: 'PENDING',
    pricePerPlate: 0,
    totalAmount: 0,
    createdAt: new Date().toLocaleString()
  };

  specialRequestsDB.push(newReq);
  saveData(SPECIAL_REQUESTS_FILE, specialRequestsDB);

  // Send mail to user and admin
  if (email) {
    sendEmail(
      email,
      `✨ আপনার স্পেশাল ফুড রিকুয়েস্ট সফলভাবে জমা হয়েছে: #${reqId}`,
      `<h2>স্বাগতম ${customerName}!</h2><p>আপনার স্পেশাল ফুড রিকুয়েস্ট সফলভাবে গ্রহণ করা হয়েছে।</p><p><b>Request ID:</b> ${reqId}</p><p><b>খাবার:</b> ${itemName} (${qty} প্লেট)</p><p>অ্যাডমিন পর্যালোচনার পর খুব শীঘ্রই আপনাকে মূল্য জানিয়ে দেওয়া হবে।</p>`
    );
  }

  sendEmail(
    OWNER_NOTIFY_EMAIL,
    `🌟 নতুন স্পেশাল ফুড রিকুয়েস্ট: #${reqId}`,
    `<h2>নতুন স্পেশাল আইটেম রিকুয়েস্ট জমা পড়েছে</h2><p><b>Request ID:</b> ${reqId}</p><p><b>গ্রাহক:</b> ${customerName} (${phone})</p><p><b>খাবারের নাম:</b> ${itemName} (${qty} প্লেট)</p>`
  );

  res.json({ success: true, message: 'আপনার স্পেশাল রিকুয়েস্ট পাঠানো হয়েছে!', request: newReq });
});

app.get('/api/special-request/user/:phone', (req, res) => {
  specialRequestsDB = loadData(SPECIAL_REQUESTS_FILE, []);
  const userReqs = specialRequestsDB.filter(r => String(r.phone).trim() === String(req.params.phone).trim());
  res.json({ success: true, requests: userReqs });
});

app.post('/api/special-request/pay', (req, res) => {
  const { requestId, paymentScreenshot, deliveryDate } = req.body;
  specialRequestsDB = loadData(SPECIAL_REQUESTS_FILE, []);
  ordersDB = loadData(ORDERS_FILE, []);

  const reqItem = specialRequestsDB.find(r => r.requestId === requestId);
  if (!reqItem || reqItem.status !== 'PRICED') {
    return res.status(400).json({ success: false, message: 'অনুরোধটি পাওয়া যায়নি বা মূল্য নির্ধারণ করা হয়নি।' });
  }

  reqItem.status = 'ORDERED';
  saveData(SPECIAL_REQUESTS_FILE, specialRequestsDB);

  const orderId = 'ASW-SRQ-' + Math.floor(100000 + Math.random() * 900000);
  const newOrder = {
    orderId,
    phone: reqItem.phone,
    customerName: reqItem.customerName,
    email: reqItem.email,
    address: 'Registered Address',
    location: '',
    items: [{ id: Date.now(), name: `[Special] ${reqItem.itemName} (${reqItem.description})`, price: reqItem.pricePerPlate, qty: reqItem.qty }],
    totalAmount: reqItem.totalAmount,
    paymentScreenshot: paymentScreenshot || '',
    deliveryDate: deliveryDate || new Date().toISOString().split('T')[0],
    status: 'PENDING',
    orderDate: new Date().toISOString().split('T')[0],
    createdAt: new Date().toLocaleString()
  };

  ordersDB.push(newOrder);
  saveData(ORDERS_FILE, ordersDB);

  // Send order placed notification for special order converted to normal order
  if (reqItem.email) {
    sendEmail(
      reqItem.email,
      `📦 স্পেশাল অর্ডার প্লেস হয়েছে: #${orderId}`,
      `<h2>ধন্যবাদ ${reqItem.customerName}!</h2><p>আপনার স্পেশাল অর্ডারের পেমেন্ট সফলভাবে সম্পন্ন হয়েছে।</p><p><b>Order ID:</b> ${orderId}</p><p><b>মোট মূল্য:</b> ₹${reqItem.totalAmount}</p>`
    );
  }
  sendEmail(
    OWNER_NOTIFY_EMAIL,
    `💰 নতুন স্পেশাল অর্ডার পেমেন্ট প্রাপ্তি: #${orderId}`,
    `<h2>স্পেশাল অর্ডার প্লেস হয়েছে</h2><p><b>Order ID:</b> ${orderId}</p><p><b>গ্রাহক:</b> ${reqItem.customerName} (${reqItem.phone})</p><p><b>মূল্য:</b> ₹${reqItem.totalAmount}</p>`
  );

  res.json({ success: true, message: 'স্পেশাল অর্ডারের পেমেন্ট সফলভাবে জমা হয়েছে!', order: newOrder });
});

// 1) Signup with Welcome Mail
app.post('/api/auth/signup', (req, res) => {
  const { name, phone, email, password, address, location, pincode } = req.body;
  usersDB = loadData(USERS_FILE, []);
  if (pincode !== '700036') {
    return res.status(400).json({ success: false, message: 'আমাদের পরিষেবা শুধুমাত্র ৭০০০৩৬ পিনকোডে উপলব্ধ।' });
  }
  const newUser = { name, phone, email, password, address, location: location || '', pincode, isBlocked: false, preferredItems: [] };
  usersDB.push(newUser);
  saveData(USERS_FILE, usersDB);

  // Send Welcome Mail
  if (email) {
    sendEmail(
      email,
      `🎉 আস্বাদন (Aswadan) পরিবারে আপনাকে স্বাগতম!`,
      `<h2>নমস্কার ${name}!</h2><p>আস্বাদন ফুড সার্ভিসেস-এ সফলভাবে রেজিস্টার করার জন্য আপনাকে ধন্যবাদ। এখন থেকেই আপনি আমাদের সুস্বাদু হোম ডেলিভারি খাবার অর্ডার করতে পারবেন।</p>`
    );
  }

  res.json({ success: true, user: newUser });
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  usersDB = loadData(USERS_FILE, []);
  let user = usersDB.find(u => (String(u.phone).trim() === String(identifier).trim() || u.email.toLowerCase() === identifier.toLowerCase()) && u.password === password);
  if (!user || user.isBlocked) return res.status(401).json({ success: false, message: 'লগইন তথ্য ভুল অথবা অ্যাকাউন্ট ব্লক করা হয়েছে।' });
  res.json({ success: true, user });
});

app.get('/api/orders/user/:phone', (req, res) => {
  ordersDB = loadData(ORDERS_FILE, []);
  const userOrders = ordersDB.filter(o => String(o.phone).trim() === String(req.params.phone).trim());
  res.json({ success: true, orders: userOrders });
});

// 2) Order Placed Mail to User and Admin
app.post('/api/orders', (req, res) => {
  const { phone, customerName, email, address, location, items, totalAmount, paymentScreenshot, deliveryDate } = req.body;
  ordersDB = loadData(ORDERS_FILE, []);
  const orderId = 'ASW-' + Math.floor(100000 + Math.random() * 900000);
  const newOrder = { orderId, phone, customerName, email, address, location, items, totalAmount, paymentScreenshot, deliveryDate, status: 'PENDING', orderDate: new Date().toISOString().split('T')[0], createdAt: new Date().toLocaleString() };
  ordersDB.push(newOrder);
  saveData(ORDERS_FILE, ordersDB);

  if (email) {
    sendEmail(
      email,
      `📦 আপনার অর্ডার সফলভাবে জমা হয়েছে: #${orderId}`,
      `<h2>ধন্যবাদ ${customerName}!</h2><p>আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে এবং পর্যালোচনার অপেক্ষায় রয়েছে।</p><p><b>Order ID:</b> ${orderId}</p><p><b>মোট মূল্য:</b> ₹${totalAmount}</p>`
    );
  }

  sendEmail(
    OWNER_NOTIFY_EMAIL,
    `🚨 নতুন অর্ডার এসেছে: #${orderId}`,
    `<h2>নতুন অর্ডার প্লেস হয়েছে</h2><p><b>Order ID:</b> ${orderId}</p><p><b>গ্রাহক:</b> ${customerName} (${phone})</p><p><b>মোট মূল্য:</b> ₹${totalAmount}</p>`
  );

  res.json({ success: true, order: newOrder });
});

// --- USER PROFILE DATA PURGE ROUTE ---
app.post('/api/user/delete-history', (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: 'মোবাইল নম্বর পাওয়া যায়নি।' });
  }

  let orders = loadData(ORDERS_FILE, []);
  let specialReqs = loadData(SPECIAL_REQUESTS_FILE, []);

  const remainingOrders = orders.filter(o => String(o.phone).trim() !== String(phone).trim());
  const remainingSpecialReqs = specialReqs.filter(r => String(r.phone).trim() !== String(phone).trim());

  saveData(ORDERS_FILE, remainingOrders);
  saveData(SPECIAL_REQUESTS_FILE, remainingSpecialReqs);

  res.json({ success: true, message: 'আপনার সমস্ত অর্ডার ও স্পেশাল রিকুয়েস্ট হিস্ট্রি সফলভাবে মুছে ফেলা হয়েছে।' });
});

// --- ADMIN ROUTES ---
function verifyAdminToken(req) {
  return req.headers['authorization'] === 'Bearer aswadan_secret_admin_token';
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  adminConfig = loadData(ADMIN_FILE, defaultAdminConfig);
  if (password === adminConfig.password) res.json({ success: true, token: 'aswadan_secret_admin_token' });
  else res.status(401).json({ success: false, message: 'ভুল পাসওয়ার্ড!' });
});

// Admin Forgot Password OTP
app.post('/api/admin/forgot-password', (req, res) => {
  const { email } = req.body;
  adminConfig = loadData(ADMIN_FILE, defaultAdminConfig);
  const adminEmail = adminConfig.email || 'iammadhuchanda@gmail.com';
  if (!email || email.trim().toLowerCase() !== adminEmail.toLowerCase()) {
    return res.status(400).json({ success: false, message: 'ভুল এডমিন ইমেল আইডি!' });
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore['admin_otp'] = { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 };
  
  // Send OTP to Admin Mail
  sendEmail(adminEmail, '🔑 এডমিন পাসওয়ার্ড রিসেট OTP', `<h3>আপনার এডমিন পাসওয়ার্ড রিসেট OTP কোড হলো: <b>${otp}</b></h3>`);
  res.json({ success: true, message: 'OTP পাঠানো হয়েছে।' });
});

app.post('/api/admin/reset-password', (req, res) => {
  const { otp, newPassword } = req.body;
  const record = otpStore['admin_otp'];
  if (!record || record.code !== otp || Date.now() > record.expiresAt) {
    return res.status(400).json({ success: false, message: 'ভুল বা মেয়াদোত্তীর্ণ OTP কোড।' });
  }
  adminConfig = loadData(ADMIN_FILE, defaultAdminConfig);
  adminConfig.password = newPassword;
  delete otpStore['admin_otp'];
  saveData(ADMIN_FILE, adminConfig);
  res.json({ success: true, message: 'পাসওয়ার্ড পরিবর্তন করা হয়েছে!' });
});

app.post('/api/admin/factory-settings/request-otp', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { optionType } = req.body;
  adminConfig = loadData(ADMIN_FILE, defaultAdminConfig);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[`admin_factory_${optionType}`] = { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 };
  sendEmail(adminConfig.email, '⚠️ Factory Settings OTP', `<h3>OTP: ${otp}</h3>`);
  res.json({ success: true, message: 'OTP পাঠানো হয়েছে।' });
});

app.post('/api/admin/factory-settings/execute', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { optionType, otp } = req.body;
  const record = otpStore[`admin_factory_${optionType}`];
  if (!record || record.code !== otp || Date.now() > record.expiresAt) {
    return res.status(400).json({ success: false, message: 'ভুল বা মেয়াদোত্তীর্ণ OTP কোড।' });
  }
  const optNum = Number(optionType);
  
  if (optNum === 1) { 
    saveData(USERS_FILE, []); 
    saveData(ORDERS_FILE, []); 
    saveData(REVIEWS_FILE, []);
    saveData(SPECIAL_REQUESTS_FILE, []);
  }
  else if (optNum === 2) { 
    saveData(ORDERS_FILE, []); 
    saveData(SPECIAL_REQUESTS_FILE, []);
  }
  else if (optNum === 3) { 
    saveData(USERS_FILE, []); 
  }
  else if (optNum === 4) { 
    saveData(ORDERS_FILE, []); 
  }

  delete otpStore[`admin_factory_${optionType}`];
  res.json({ success: true, message: 'ফ্যাক্টরি রিসেট সফল হয়েছে!' });
});

app.get('/api/admin/orders', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  ordersDB = loadData(ORDERS_FILE, []);
  specialRequestsDB = loadData(SPECIAL_REQUESTS_FILE, []);

  const pending = ordersDB.filter(o => o.status === 'PENDING');
  const accepted = ordersDB.filter(o => o.status === 'ACCEPTED');
  const rejected = ordersDB.filter(o => o.status === 'REJECTED');
  const delivered = ordersDB.filter(o => o.status === 'DELIVERED');
  
  const pendingSpecial = specialRequestsDB.filter(s => s.status === 'PENDING');
  const netRevenue = [...accepted, ...delivered].reduce((sum, o) => sum + Number(o.totalAmount), 0);
  
  res.json({
    success: true,
    orders: ordersDB,
    pending,
    accepted,
    rejected,
    delivered,
    specialRequests: specialRequestsDB,
    stats: { 
      totalOrders: ordersDB.length, 
      pendingCount: pending.length, 
      acceptedCount: accepted.length, 
      rejectedCount: rejected.length, 
      specialRequestCount: pendingSpecial.length,
      netRevenue 
    }
  });
});

// 3, 4, 5) Admin Order Status update (Accept, Reject with Reason, Delivered)
app.post('/api/admin/order-status', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { orderId, status, reason } = req.body;
  ordersDB = loadData(ORDERS_FILE, []);
  const order = ordersDB.find(o => o.orderId === orderId);
  if (order) {
    order.status = status;
    if (reason) order.rejectionReason = reason;
    saveData(ORDERS_FILE, ordersDB);

    // Send Mail based on status
    if (order.email) {
      if (status === 'ACCEPTED') {
        sendEmail(order.email, `✅ আপনার অর্ডার গৃহীত হয়েছে: #${orderId}`, `<h2>সুসংবাদ ${order.customerName}!</h2><p>আপনার অর্ডারটি (#${orderId}) সফলভাবে এপ্রুভ করা হয়েছে এবং রান্নার প্রস্তুতি চলছে।</p>`);
      } else if (status === 'REJECTED') {
        sendEmail(order.email, `❌ আপনার অর্ডার বাতিল করা হয়েছে: #${orderId}`, `<h2>দুঃখিত ${order.customerName}</h2><p>আপনার অর্ডারটি (#${orderId}) বাতিল করা হয়েছে।</p><p><b>কারণ:</b> ${reason || 'প্রশাসনিক সিদ্ধান্ত'}</p>`);
      } else if (status === 'DELIVERED') {
        sendEmail(order.email, `🚚 আপনার অর্ডার ডেলিভারি করা হয়েছে: #${orderId}`, `<h2>ধন্যবাদ ${order.customerName}!</h2><p>আপনার অর্ডারটি (#${orderId}) সফলভাবে ডেলিভারি করা হয়েছে। আশা করি আপনার খাবার ভালো লেগেছে!</p>`);
      }
    }

    res.json({ success: true, order });
  } else {
    res.status(404).json({ success: false, message: 'Order not found' });
  }
});

app.get('/api/admin/users', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  usersDB = loadData(USERS_FILE, []);
  ordersDB = loadData(ORDERS_FILE, []);
  usersDB = syncUsersFromOrders(usersDB, ordersDB);
  res.json({ success: true, users: usersDB });
});

app.post('/api/admin/users/toggle-block', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  usersDB = loadData(USERS_FILE, []);
  const user = usersDB.find(u => String(u.phone).trim() === String(req.body.phone).trim());
  if (user) {
    user.isBlocked = !user.isBlocked;
    saveData(USERS_FILE, usersDB);
    res.json({ success: true, isBlocked: user.isBlocked, message: 'ইউজার স্ট্যাটাস পরিবর্তিত হয়েছে।' });
  } else {
    res.status(404).json({ success: false, message: 'ইউজার পাওয়া যায়নি।' });
  }
});

app.post('/api/admin/users/delete', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  let users = loadData(USERS_FILE, []);
  const initialLen = users.length;
  users = users.filter(u => String(u.phone).trim() !== String(req.body.phone).trim());
  if (users.length < initialLen) {
    usersDB = users;
    saveData(USERS_FILE, usersDB);
    res.json({ success: true, message: 'ইউজার মুছে ফেলা হয়েছে।' });
  } else {
    res.status(404).json({ success: false, message: 'ইউজার পাওয়া যায়নি।' });
  }
});

app.get('/api/admin/special-requests', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  specialRequestsDB = loadData(SPECIAL_REQUESTS_FILE, []);
  res.json({ success: true, requests: specialRequestsDB });
});

// 7, 8, 9) Admin Special Request Action (Priced, Rejected with Reason)
app.post('/api/admin/special-request/action', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { requestId, action, pricePerPlate, reason } = req.body;
  specialRequestsDB = loadData(SPECIAL_REQUESTS_FILE, []);
  const reqItem = specialRequestsDB.find(r => r.requestId === requestId);
  if (!reqItem) return res.status(404).json({ success: false, message: 'রিকুয়েস্ট পাওয়া যায়নি।' });

  if (action === 'PRICED') {
    reqItem.status = 'PRICED';
    reqItem.pricePerPlate = Number(pricePerPlate);
    reqItem.totalAmount = Number(pricePerPlate) * reqItem.qty;

    // 7) Mail to user with price to pay
    if (reqItem.email) {
      sendEmail(
        reqItem.email,
        `✨ আপনার স্পেশাল রিকুয়েস্টের মূল্য নির্ধারিত হয়েছে: #${requestId}`,
        `<h2>নমস্কার ${reqItem.customerName}!</h2><p>আপনার "${reqItem.itemName}" রিকুয়েস্টের মূল্য নির্ধারণ করা হয়েছে।</p><p><b>প্রতি প্লেট:</b> ₹${pricePerPlate}</p><p><b>মোট মূল্য:</b> ₹${reqItem.totalAmount}</p><p>দয়া করে আপনার ড্যাশবোর্ড থেকে পেমেন্ট সম্পন্ন করুন।</p>`
      );
    }
  } else if (action === 'REJECTED') {
    reqItem.status = 'REJECTED';
    if (reason) reqItem.rejectionReason = reason;

    // 9) Special Order Rejection Mail
    if (reqItem.email) {
      sendEmail(
        reqItem.email,
        `❌ আপনার স্পেশাল রিকুয়েস্ট বাতিল করা হয়েছে: #${requestId}`,
        `<h2>দুঃখিত ${reqItem.customerName}</h2><p>আপনার স্পেশাল রিকুয়েস্টটি (#${requestId}) বাতিল করা হয়েছে।</p><p><b>কারণ:</b> ${reason || 'প্রশাসনিক সিদ্ধান্ত'}</p>`
      );
    }
  }
  
  saveData(SPECIAL_REQUESTS_FILE, specialRequestsDB);
  res.json({ success: true, message: 'রিকুয়েস্ট আপডেট হয়েছে!', request: reqItem });
});

app.post('/api/admin/menu/save', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  menuDB = req.body.menu;
  saveData(MENU_FILE, menuDB);
  res.json({ success: true, message: 'মেনু আপডেট হয়েছে!' });
});

app.post('/api/admin/offer/save', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  offerDB = req.body;
  saveData(OFFER_FILE, offerDB);
  res.json({ success: true, message: 'অফার সেভ হয়েছে!' });
});

app.post('/api/admin/reviews/delete', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  reviewsDB = loadData(REVIEWS_FILE, []);
  reviewsDB = reviewsDB.filter(r => Number(r.id) !== Number(req.body.id));
  saveData(REVIEWS_FILE, reviewsDB);
  res.json({ success: true, message: 'রিভিউ ডিলিট হয়েছে।' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 আস্বাদন Server running on http://localhost:${PORT}`);
});