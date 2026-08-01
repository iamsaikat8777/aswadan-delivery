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

function createBrandEmail(heading, htmlBody) {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0b10; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #d4af37; max-width: 600px; margin: 0 auto; box-shadow: 0 8px 24px rgba(0,0,0,0.6);">
      <div style="text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.3); padding-bottom: 20px; margin-bottom: 25px;">
        <div style="display: inline-block; background: #000000; border: 2px solid #d4af37; border-radius: 50%; width: 75px; height: 75px; line-height: 75px; text-align: center; margin-bottom: 10px; box-shadow: 0 4px 15px rgba(212,175,55,0.4);">
          <img src="https://aaswadanfoodservices.com/logo.png" alt="Aswadan Logo" style="width: 55px; height: 55px; vertical-align: middle; object-fit: contain;" />
        </div>
        <h1 style="color: #d4af37; margin: 0; font-size: 26px; letter-spacing: 0.5px; font-weight: 800;">আস্বাদন (Aswadan Food Services)</h1>
        <p style="color: #a0a0b0; font-size: 13px; margin: 6px 0 0 0; letter-spacing: 0.5px;">Authentic & Pure Homemade Food Delivery</p>
      </div>
      
      <h2 style="color: #e5c158; font-size: 20px; margin-top: 0; border-left: 4px solid #d4af37; padding-left: 10px;">${heading}</h2>
      
      <div style="font-size: 15px; line-height: 1.7; color: #e0e0e8; background: #181824; padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
        ${htmlBody}
      </div>
      
      <div style="margin-top: 35px; border-top: 1px solid rgba(212, 175, 55, 0.3); padding-top: 20px; text-align: center;">
        <p style="color: #d4af37; font-weight: bold; margin: 0; font-size: 15px;">আন্তরিক ধন্যবাদসহ,</p>
        <p style="color: #ffffff; margin: 6px 0 0 0; font-size: 14px; font-weight: 600;">ম্যানেজমেন্ট টিম, আস্বাদন (Aswadan Admin)</p>
        <p style="color: #777788; font-size: 11px; margin-top: 15px;">এটি একটি স্বয়ংক্রিয় নোটিফিকেশন ইমেল, দয়া করে সরাসরি এই ঠিকানায় রিপ্লাই করবেন না।</p>
      </div>
    </div>
  `;
}

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

app.post('/api/special-request', (req, res) => {
  const { phone, customerName, email, itemName, description, qty } = req.body;
  if (!phone || !itemName || !qty) {
    return res.status(400).json({ success: false, message: 'খাবারের নাম ও পরিমাণ উল্লেখ করুন।' });
  }

  usersDB = loadData(USERS_FILE, []);
  const userRecord = usersDB.find(u => String(u.phone).trim() === String(phone).trim());
  let locationLink = 'লোকেশন দেওয়া হয়নি';
  if (userRecord) {
    if (userRecord.lat && userRecord.lng) {
      locationLink = `https://maps.google.com/?q=${userRecord.lat},${userRecord.lng}`;
    } else if (userRecord.location) {
      locationLink = userRecord.location.startsWith('http') ? userRecord.location : `https://maps.google.com/?q=${userRecord.location}`;
    }
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

  if (email) {
    const userHtml = createBrandEmail(
      `✨ আপনার স্পেশাল ফুড রিকুয়েস্ট জমা হয়েছে: #${reqId}`,
      `<p>নমস্কার <b>${customerName}</b>,</p>
       <p>আপনার কাস্টম / স্পেশাল ফুড রিকুয়েস্ট সফলভাবে আমাদের কাছে পৌঁছেছে। এডমিন এটি যাচাই করে শীঘ্রই মূল্য নির্ধারণ করবেন।</p>
       <p><b>Request ID:</b> <span style="color:#d4af37;">#${reqId}</span><br>
          <b>খাবার:</b> ${itemName} (${qty} প্লেট)<br>
          <b>বিবরণ:</b> ${description || 'N/A'}</p>`
    );
    sendEmail(email, `✨ স্পেশাল ফুড রিকুয়েস্ট সফলভাবে জমা হয়েছে: #${reqId}`, userHtml);
  }

  const adminHtml = createBrandEmail(
    `🌟 নতুন স্পেশাল ফুড রিকুয়েস্ট: #${reqId}`,
    `<p>একজন গ্রাহক নতুন স্পেশাল ফুড রিকুয়েস্ট করেছেন:</p>
     <p><b>Request ID:</b> #${reqId}<br>
        <b>গ্রাহক:</b> ${customerName} (${phone})<br>
        <b>খাবারের নাম:</b> ${itemName} (${qty} প্লেট)<br>
        <b>বিবরণ:</b> ${description || 'N/A'}<br>
        <b>গুগল ম্যাপ লোকেশন:</b> <a href="${locationLink}" target="_blank" style="color:#d4af37;">🗺️ View Location on Map</a></p>`
  );
  sendEmail(OWNER_NOTIFY_EMAIL, `🌟 নতুন স্পেশাল ফুড রিকুয়েস্ট: #${reqId}`, adminHtml);

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

  if (reqItem.email) {
    const userHtml = createBrandEmail(
      `📦 স্পেশাল অর্ডার প্লেস হয়েছে: #${orderId}`,
      `<p>ধন্যবাদ <b>${reqItem.customerName}</b>,</p>
       <p>আপনার স্পেশাল অর্ডারের পেমেন্ট সফলভাবে সম্পন্ন হয়েছে এবং অর্ডারটি নিশ্চিত করা হয়েছে।</p>
       <p><b>Order ID:</b> <span style="color:#d4af37;">#${orderId}</span><br>
          <b>মোট মূল্য:</b> ₹${reqItem.totalAmount}<br>
          <b>ডেলিভারির তারিখ:</b> ${deliveryDate}</p>`
    );
    sendEmail(reqItem.email, `📦 স্পেশাল অর্ডার প্লেস হয়েছে: #${orderId}`, userHtml);
  }

  const adminHtml = createBrandEmail(
    `💰 নতুন স্পেশাল অর্ডার পেমেন্ট প্রাপ্তি: #${orderId}`,
    `<p>একটি স্পেশাল অর্ডারের পেমেন্ট সম্পন্ন হয়ে প্লেস হয়েছে:</p>
     <p><b>Order ID:</b> #${orderId}<br>
        <b>গ্রাহক:</b> ${reqItem.customerName} (${reqItem.phone})<br>
        <b>মোট মূল্য:</b> ₹${reqItem.totalAmount}</p>`
  );
  sendEmail(OWNER_NOTIFY_EMAIL, `💰 নতুন স্পেশাল অর্ডার পেমেন্ট প্রাপ্তি: #${orderId}`, adminHtml);

  res.json({ success: true, message: 'স্পেশাল অর্ডারের পেমেন্ট সফলভাবে জমা হয়েছে!', order: newOrder });
});

// --- UPDATED SIGNUP ROUTE ---
app.post('/api/auth/signup', (req, res) => {
  const { name, phone, email, password, address, location, lat, lng, pincode } = req.body;
  usersDB = loadData(USERS_FILE, []);
  if (pincode !== '700036') {
    return res.status(400).json({ success: false, message: 'আমাদের পরিষেবা শুধুমাত্র ৭০০০৩৬ পিনকোডে উপলব্ধ।' });
  }
  const existingUser = usersDB.find(u => String(u.phone).trim() === String(phone).trim() || (email && u.email && u.email.toLowerCase() === email.trim().toLowerCase()));
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'এই মোবাইল নম্বর বা ইমেল দিয়ে ইতিমধ্যে অ্যাকাউন্ট রয়েছে।' });
  }
  const newUser = { name, phone, email, password, address, location: location || '', lat: lat || '', lng: lng || '', pincode, isBlocked: false, preferredItems: [] };
  usersDB.push(newUser);
  saveData(USERS_FILE, usersDB);

  if (email) {
    const welcomeHtml = createBrandEmail(
      `🎉 আস্বাদন (Aswadan) পরিবারে আপনাকে স্বাগতম!`,
      `<p>নমস্কার <b>${name}</b>,</p>
       <p>আস্বাদন ফুড সার্ভিসেস-এ সফলভাবে রেজিস্টার করার জন্য আপনাকে অসংখ্য ধন্যবাদ। এখন থেকেই আপনি আমাদের সুস্বাদু এবং বিশুদ্ধ হোম ডেলিভারি খাবার অর্ডার করতে পারবেন।</p>`
    );
    sendEmail(email, `🎉 আস্বাদন পরিবারে আপনাকে স্বাগতম!`, welcomeHtml);
  }

  res.json({ success: true, user: newUser });
});

// --- NEW/FIXED PROFILE UPDATE ROUTE ---
app.post('/api/user/profile', (req, res) => {
  const { phone, name, email, address, location, lat, lng, pincode } = req.body;
  usersDB = loadData(USERS_FILE, []);
  const user = usersDB.find(u => String(u.phone).trim() === String(phone).trim());
  if (!user) {
    return res.status(404).json({ success: false, message: 'ইউজার পাওয়া যায়নি।' });
  }
  if (pincode && pincode !== '700036') {
    return res.status(400).json({ success: false, message: 'আমাদের পরিষেবা শুধুমাত্র ৭০০০৩৬ পিনকোডে উপলব্ধ।' });
  }
  if (name) user.name = name;
  if (email) user.email = email;
  if (address) user.address = address;
  if (location !== undefined) user.location = location;
  if (lat !== undefined) user.lat = lat;
  if (lng !== undefined) user.lng = lng;
  if (pincode) user.pincode = pincode;

  saveData(USERS_FILE, usersDB);
  res.json({ success: true, message: 'প্রোফাইল সফলভাবে আপডেট হয়েছে!', user });
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  usersDB = loadData(USERS_FILE, []);
  let user = usersDB.find(u => (String(u.phone).trim() === String(identifier).trim() || u.email.toLowerCase() === identifier.toLowerCase()) && u.password === password);
  if (!user || user.isBlocked) return res.status(401).json({ success: false, message: 'লগইন তথ্য ভুল অথবা অ্যাকাউন্ট ব্লক করা হয়েছে।' });
  res.json({ success: true, user });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  usersDB = loadData(USERS_FILE, []);
  const user = usersDB.find(u => u.email && u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    return res.status(400).json({ success: false, message: 'এই ইমেল আইডি দিয়ে কোনো অ্যাকাউন্ট রেজিস্টার্ড নেই!' });
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[`user_otp_${user.phone}`] = { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 };
  
  const otpHtml = createBrandEmail(
    `🔑 পাসওয়ার্ড রিসেট OTP কোড`,
    `<p>আপনার পাসওয়ার্ড রিসেট করার জন্য নিচের OTP কোডটি ব্যবহার করুন:</p>
     <div style="text-align: center; margin: 20px 0;">
       <span style="font-size: 28px; font-weight: bold; color: #d4af37; background: #12121a; padding: 10px 20px; border-radius: 8px; border: 1px solid #d4af37; letter-spacing: 3px;">${otp}</span>
     </div>
     <p>এই কোডটি ১০ মিনিট পর্যন্ত কার্যকর থাকবে।</p>`
  );
  sendEmail(user.email, '🔑 আস্বাদন পাসওয়ার্ড রিসেট OTP', otpHtml);
  res.json({ success: true, message: 'আপনার রেজিস্টার্ড ইমেলে OTP পাঠানো হয়েছে।' });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, otp, newPassword } = req.body;
  usersDB = loadData(USERS_FILE, []);
  const user = usersDB.find(u => u.email && u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return res.status(400).json({ success: false, message: 'ইউজার পাওয়া যায়নি।' });

  const record = otpStore[`user_otp_${user.phone}`];
  if (!record || record.code !== otp || Date.now() > record.expiresAt) {
    return res.status(400).json({ success: false, message: 'ভুল বা মেয়াদোত্তীর্ণ OTP কোড।' });
  }

  user.password = newPassword;
  delete otpStore[`user_otp_${user.phone}`];
  saveData(USERS_FILE, usersDB);
  res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
});

app.get('/api/orders/user/:phone', (req, res) => {
  ordersDB = loadData(ORDERS_FILE, []);
  const userOrders = ordersDB.filter(o => String(o.phone).trim() === String(req.params.phone).trim());
  res.json({ success: true, orders: userOrders });
});

app.post('/api/orders/cancel', (req, res) => {
  const { orderId, phone, refundInfo } = req.body;
  ordersDB = loadData(ORDERS_FILE, []);
  const order = ordersDB.find(o => o.orderId === orderId && String(o.phone).trim() === String(phone).trim());

  if (!order) {
    return res.status(404).json({ success: false, message: 'অর্ডারটি পাওয়া যায়নি।' });
  }
  if (order.status !== 'PENDING') {
    return res.status(400).json({ success: false, message: 'এই অর্ডারটি আর ক্যানসেল করা সম্ভব নয়।' });
  }

  let orderDateStr = order.orderDate || new Date().toISOString().split('T')[0];
  let orderDate = new Date(orderDateStr);
  let endOfDay = new Date(orderDate);
  endOfDay.setHours(23, 59, 59, 999);

  if (new Date() > endOfDay) {
    return res.status(400).json({ success: false, message: 'অর্ডার ক্যানসেল করার সময়সীমা পার হয়ে গেছে।' });
  }

  order.status = 'CANCELLED';
  if (refundInfo) {
    order.refundInfo = refundInfo;
  }
  saveData(ORDERS_FILE, ordersDB);

  let refundHtml = '';
  if (refundInfo) {
    if (refundInfo.type === 'UPI') {
      refundHtml = `<p><b>রিফান্ড মাধ্যম:</b> UPI ID<br><b>UPI ID:</b> ${refundInfo.upiId}</p>`;
    } else {
      refundHtml = `<p><b>রিফান্ড মাধ্যম:</b> Bank Account<br><b>Account Name:</b> ${refundInfo.accountName}<br><b>Account Number:</b> ${refundInfo.accountNumber}<br><b>IFSC:</b> ${refundInfo.ifsc}<br><b>Branch:</b> ${refundInfo.branch}</p>`;
    }
  }

  if (order.email) {
    const cancelUserHtml = createBrandEmail(
      `❌ অর্ডার ক্যানসেল করা হয়েছে: #${orderId}`,
      `<p>নমস্কার <b>${order.customerName}</b>,</p>
       <p>আপনার অর্ডারটি (#${orderId}) সফলভাবে ক্যানসেল করা হয়েছে।</p>${refundHtml}`
    );
    sendEmail(order.email, `❌ আপনার অর্ডার ক্যানসেল করা হয়েছে: #${orderId}`, cancelUserHtml);
  }

  const cancelAdminHtml = createBrandEmail(
    `⚠️ গ্রাহক কর্তৃক অর্ডার ক্যানসেল ও রিফান্ড: #${orderId}`,
    `<p>গ্রাহক অর্ডার ক্যানসেল করেছেন:</p>
     <p><b>Order ID:</b> #${orderId}<br>
        <b>গ্রাহক:</b> ${order.customerName} (${order.phone})</p>${refundHtml}`
  );
  sendEmail(OWNER_NOTIFY_EMAIL, `⚠️ গ্রাহক কর্তৃক অর্ডার ক্যানসেল ও রিফান্ড: #${orderId}`, cancelAdminHtml);

  res.json({ success: true, message: 'অর্ডারটি সফলভাবে ক্যানসেল করা হয়েছে।' });
});

app.post('/api/orders', (req, res) => {
  const { phone, customerName, email, address, location, items, totalAmount, paymentScreenshot, deliveryDate } = req.body;
  ordersDB = loadData(ORDERS_FILE, []);
  const orderId = 'ASW-' + Math.floor(100000 + Math.random() * 900000);
  const newOrder = { orderId, phone, customerName, email, address, location, items, totalAmount, paymentScreenshot, deliveryDate, status: 'PENDING', orderDate: new Date().toISOString().split('T')[0], createdAt: new Date().toLocaleString() };
  ordersDB.push(newOrder);
  saveData(ORDERS_FILE, ordersDB);

  const locationLink = location ? (location.startsWith('http') ? location : `https://maps.google.com/?q=${location}`) : 'লোকেশন দেওয়া হয়নি';
  const itemsListStr = (items || []).map(i => `${i.name} x ${i.qty} (₹${i.price * i.qty})`).join('<br>');

  if (email) {
    const userHtml = createBrandEmail(
      `📦 অর্ডার সফলভাবে জমা হয়েছে: #${orderId}`,
      `<p>ধন্যবাদ <b>${customerName}</b>,</p>
       <p>আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে এবং বর্তমানে পর্যালোচনার অপেক্ষায় রয়েছে।</p>
       <p><b>Order ID:</b> <span style="color:#d4af37;">#${orderId}</span><br>
          <b>ডেলিভারির তারিখ:</b> ${deliveryDate}<br>
          <b>খাবারের তালিকা:</b><br>${itemsListStr}<br>
          <b>মোট মূল্য:</b> ₹${totalAmount}</p>`
    );
    sendEmail(email, `📦 অর্ডার সফলভাবে জমা হয়েছে: #${orderId}`, userHtml);
  }

  const adminHtml = createBrandEmail(
    `🚨 নতুন অর্ডার এসেছে: #${orderId}`,
    `<p>একটি নতুন অর্ডার প্লেস হয়েছে:</p>
     <p><b>Order ID:</b> #${orderId}<br>
        <b>গ্রাহক:</b> ${customerName} (${phone})<br>
        <b>ঠিকানা:</b> ${address}<br>
        <b>ডেলিভারি তারিখ:</b> ${deliveryDate}<br>
        <b>খাবারের তালিকা:</b><br>${itemsListStr}<br>
        <b>মোট মূল্য:</b> ₹${totalAmount}<br>
        <b>গুগল ম্যাপ লোকেশন:</b> <a href="${locationLink}" target="_blank" style="color:#d4af37;">🗺️ View Location on Map</a></p>`
  );
  sendEmail(OWNER_NOTIFY_EMAIL, `🚨 নতুন অর্ডার এসেছে: #${orderId}`, adminHtml);

  res.json({ success: true, order: newOrder });
});

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

app.post('/api/admin/forgot-password', (req, res) => {
  const { email } = req.body;
  adminConfig = loadData(ADMIN_FILE, defaultAdminConfig);
  const adminEmail = adminConfig.email || 'iammadhuchanda@gmail.com';
  if (!email || email.trim().toLowerCase() !== adminEmail.toLowerCase()) {
    return res.status(400).json({ success: false, message: 'ভুল এডমিন ইমেল আইডি!' });
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore['admin_otp'] = { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 };
  
  const adminOtpHtml = createBrandEmail(
    `🔑 এডমিন পাসওয়ার্ড রিসেট OTP`,
    `<p>আপনার এডমিন পাসওয়ার্ড রিসেট OTP কোড:</p>
     <div style="text-align: center; margin: 20px 0;">
       <span style="font-size: 28px; font-weight: bold; color: #d4af37; background: #12121a; padding: 10px 20px; border-radius: 8px; border: 1px solid #d4af37; letter-spacing: 3px;">${otp}</span>
     </div>`
  );
  sendEmail(adminEmail, '🔑 এডমিন পাসওয়ার্ড রিসেট OTP', adminOtpHtml);
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
  
  const factoryOtpHtml = createBrandEmail(
    `⚠️ ফ্যাক্টরি সেটিংস OTP`,
    `<p>ফ্যাক্টরি রিসেট বা ডেটা মুছে ফেলার জন্য আপনার OTP কোড:</p>
     <div style="text-align: center; margin: 20px 0;">
       <span style="font-size: 28px; font-weight: bold; color: #e63946; background: #12121a; padding: 10px 20px; border-radius: 8px; border: 1px solid #e63946; letter-spacing: 3px;">${otp}</span>
     </div>`
  );
  sendEmail(adminConfig.email, '⚠️ Factory Settings OTP', factoryOtpHtml);
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

app.post('/api/admin/order-status', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { orderId, status, reason } = req.body;
  ordersDB = loadData(ORDERS_FILE, []);
  const order = ordersDB.find(o => o.orderId === orderId);
  if (order) {
    order.status = status;
    if (reason) order.rejectionReason = reason;
    saveData(ORDERS_FILE, ordersDB);

    if (order.email) {
      if (status === 'ACCEPTED') {
        const acceptHtml = createBrandEmail(
          `✅ আপনার অর্ডার গৃহীত হয়েছে: #${orderId}`,
          `<p>সুসংবাদ <b>${order.customerName}</b>,</p>
           <p>আপনার অর্ডারটি (#${orderId}) সফলভাবে এপ্রুভ করা হয়েছে এবং বর্তমানে আমাদের কিচেনে রান্নার প্রস্তুতি চলছে।</p>`
        );
        sendEmail(order.email, `✅ আপনার অর্ডার গৃহীত হয়েছে: #${orderId}`, acceptHtml);
      } else if (status === 'REJECTED') {
        const rejectHtml = createBrandEmail(
          `❌ আপনার অর্ডার বাতিল করা হয়েছে: #${orderId}`,
          `<p>দুঃখিত <b>${order.customerName}</b>,</p>
           <p>অনাবশ্যক কারণবশত আপনার অর্ডারটি (#${orderId}) বাতিল করা হয়েছে।</p>
           <p style="color: #ff6b6b; font-weight: bold;">বাতিলের কারণ: ${reason || 'প্রশাসনিক সিদ্ধান্ত'}</p>`
        );
        sendEmail(order.email, `❌ আপনার অর্ডার বাতিল করা হয়েছে: #${orderId}`, rejectHtml);
      } else if (status === 'DELIVERED') {
        const deliveredHtml = createBrandEmail(
          `🚚 আপনার অর্ডার সফলভাবে ডেলিভারি হয়েছে: #${orderId}`,
          `<p>ধন্যবাদ <b>${order.customerName}</b>,</p>
           <p>আপনার অর্ডারটি (#${orderId}) সফলভাবে আপনার ঠিকানায় ডেলিভারি করা হয়েছে। আশা করি আপনার খাবার অত্যন্ত সুস্বাদু লেগেছে!</p>
           <p>আমাদের ওয়েবসাইট থেকে আপনার মূল্যবান রিভিউ প্রদান করার অনুরোধ রইল।</p>`
        );
        sendEmail(order.email, `🚚 আপনার অর্ডার ডেলিভারি করা হয়েছে: #${orderId}`, deliveredHtml);
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

    if (reqItem.email) {
      const pricedHtml = createBrandEmail(
        `✨ আপনার স্পেশাল রিকুয়েস্টের মূল্য নির্ধারিত হয়েছে: #${requestId}`,
        `<p>নমস্কার <b>${reqItem.customerName}</b>,</p>
         <p>আপনার "${reqItem.itemName}" (${reqItem.qty} প্লেট) স্পেশাল রিকুয়েস্টটি যাচাই করে মূল্য নির্ধারণ করা হয়েছে।</p>
         <p><b>প্রতি প্লেট মূল্য:</b> ₹${pricePerPlate}<br>
            <b>মোট মূল্য:</b> ₹${reqItem.totalAmount}</p>
         <p>দয়া করে আপনার ইউজার ড্যাশবোর্ডে গিয়ে পেমেন্ট সম্পন্ন করুন এবং অর্ডার কনফার্ম করুন।</p>`
      );
      sendEmail(reqItem.email, `✨ আপনার স্পেশাল রিকুয়েস্টের মূল্য নির্ধারিত হয়েছে: #${requestId}`, pricedHtml);
    }
  } else if (action === 'REJECTED') {
    reqItem.status = 'REJECTED';
    reqItem.rejectionReason = reason ? reason.trim() : 'প্রশাসনিক সিদ্ধান্ত';
    reqItem.reason = reqItem.rejectionReason;

    if (reqItem.email) {
      const rejectSpecHtml = createBrandEmail(
        `❌ আপনার স্পেশাল রিকুয়েস্ট বাতিল করা হয়েছে: #${requestId}`,
        `<p>দুঃখিত <b>${reqItem.customerName}</b>,</p>
         <p>আপনার স্পেশাল রিকুয়েস্টটি (#${requestId}) অপূর্ণাঙ্গ বা অন্যান্য কারণবশত বাতিল করা হয়েছে।</p>
         <p style="color: #ffb703; font-weight: bold;">বাতিলের কারণ: ${reqItem.rejectionReason}</p>`
      );
      sendEmail(reqItem.email, `❌ আপনার স্পেশাল রিকুয়েস্ট বাতিল করা হয়েছে: #${requestId}`, rejectSpecHtml);
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
  const newOffer = req.body;
  const wasDisabled = !offerDB.enabled;
  offerDB = newOffer;
  saveData(OFFER_FILE, offerDB);

  if (offerDB.enabled && (wasDisabled || offerDB.title !== newOffer.title || offerDB.desc !== newOffer.desc)) {
    usersDB = loadData(USERS_FILE, []);
    usersDB.forEach(u => {
      if (u.email && !u.isBlocked) {
        const offerHtml = createBrandEmail(
          `🎉 বিশেষ অফার: ${offerDB.title}`,
          `<p>নমস্কার <b>${u.name}</b>,</p>
           <p>আমাদের পক্ষ থেকে আপনাদের জন্য নিয়ে এসেছি একটি দারুণ স্পেশাল অফার!</p>
           <div style="background: #1c1c2e; padding: 15px; border-radius: 10px; border: 1px solid #d4af37; margin: 15px 0;">
             <h3 style="color: #e5c158; margin-top: 0;">🏷️ অফারের শিরোনাম: ${offerDB.title}</h3>
             <p style="color: #ffffff; margin-bottom: 0;">📝 অফারের বিবরণ: ${offerDB.desc}</p>
           </div>
           <p>আজই আমাদের ওয়েবসাইট ভিজিট করুন এবং উপভোগ করুন সুস্বাদু খাবার!</p>`
        );
        sendEmail(u.email, `🎉 আস্বাদন স্পেশাল অফার: ${offerDB.title}`, offerHtml);
      }
    });
  }

  res.json({ success: true, message: 'অফার সেভ ও ইউজারদের নোটিফিকেশন পাঠানো হয়েছে!' });
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