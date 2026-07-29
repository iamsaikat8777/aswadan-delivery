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
  { id: 1, name: 'রুই মাছের থালি (Rui Fish Thali)', price: 120, desc: 'ভাত, ডাল, ভাজা, রুই মাছের ঝোল ও চাটনি' },
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
const otpStore = {};

if (!fs.existsSync(MENU_FILE)) saveData(MENU_FILE, menuDB);
if (!fs.existsSync(OFFER_FILE)) saveData(OFFER_FILE, offerDB);
if (!fs.existsSync(ADMIN_FILE)) saveData(ADMIN_FILE, adminConfig);

usersDB = syncUsersFromOrders(usersDB, ordersDB);

// Resend Email Integration
const resend = new Resend(process.env.EMAIL_PASSWORD || '');
const OWNER_NOTIFY_EMAIL = process.env.OWNER_EMAIL || 'iammadhuchanda@gmail.com';

async function sendEmail(to, subject, htmlContent) {
  if (!to) return;
  try {
    const senderEmail = process.env.VERIFIED_SENDER || 'info@aaswadanfoodservices.com';
    const data = await resend.emails.send({
      from: `আস্বাদন Food Services <${senderEmail}>`,
      to: [to],
      subject: subject,
      html: htmlContent
    });
    console.log('Email sent successfully to:', to, data);
  } catch (err) {
    console.error('Email failed to:', to, err.message);
  }
}

// --- PUBLIC ROUTES ---

app.get('/api/menu', (req, res) => {
  menuDB = loadData(MENU_FILE, defaultMenu);
  res.json({ success: true, menu: menuDB });
});

app.get('/api/offer', (req, res) => {
  offerDB = loadData(OFFER_FILE, defaultOffer);
  res.json({ success: true, offer: offerDB });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, phone, email, password, address, location, pincode } = req.body;
  usersDB = loadData(USERS_FILE, []);

  if (pincode !== '700036') {
    return res.status(400).json({ success: false, message: 'আমাদের পরিষেবা শুধুমাত্র ৭০০০৩৬ পিনকোডে উপলব্ধ।' });
  }

  const existingPhone = usersDB.find(u => String(u.phone).trim() === String(phone).trim());
  if (existingPhone) {
    return res.status(400).json({ success: false, message: 'এই নম্বরটি ইতিমধ্যে রেজিস্টার করা হয়েছে।' });
  }

  const existingEmail = usersDB.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingEmail) {
    return res.status(400).json({ success: false, message: 'এই ইমেল আইডিটি ইতিমধ্যে রেজিস্টার করা হয়েছে।' });
  }

  const newUser = { name, phone, email, password, address, location: location || '', pincode, isBlocked: false, preferredItems: [] };
  usersDB.push(newUser);
  saveData(USERS_FILE, usersDB);

  sendEmail(
    email,
    '🎉 স্বাগতম আস্বাদন (Aswadan Food Services)-এ!',
    `<h2>স্বাগতম ${name}!</h2><p>আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।</p><p><b>ডেলিভারি ঠিকানা:</b> ${address} (${pincode})</p>`
  );

  res.json({ success: true, user: { name, phone, email, address, location: location || '', pincode, preferredItems: [] } });
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  usersDB = loadData(USERS_FILE, []);

  let user = usersDB.find(
    u => (String(u.phone).trim() === String(identifier).trim() || u.email.toLowerCase() === identifier.toLowerCase()) && u.password === password
  );

  if (!user) {
    return res.status(401).json({ success: false, message: 'মোবাইল/ইমেল বা পাসওয়ার্ড ভুল হয়েছে।' });
  }

  if (user.isBlocked) {
    return res.status(403).json({ success: false, message: 'আপনার অ্যাকাউন্টটি স্থগিত (Blocked) করা হয়েছে। কর্তৃপক্ষের সাথে যোগাযোগ করুন।' });
  }

  res.json({
    success: true,
    user: { name: user.name, phone: user.phone, email: user.email, address: user.address, location: user.location || '', pincode: user.pincode, preferredItems: user.preferredItems || [] }
  });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  usersDB = loadData(USERS_FILE, []);
  const user = usersDB.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return res.status(404).json({ success: false, message: 'এই ইমেল আইডিটি রেজিস্টার করা নেই।' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email.toLowerCase()] = { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 };

  sendEmail(
    email,
    '🔐 পাসওয়ার্ড রিসেট ভেরিফিকেশন কোড - আস্বাদন',
    `<h3>আপনার পাসওয়ার্ড রিসেট OTP: <b style="color:#e5c158; font-size:24px;">${otp}</b></h3><p>এই কোডটি ১০ মিনিটের জন্য বৈধ।</p>`
  );

  res.json({ success: true, message: 'আপনার ইমেল আইডিতে ভেরিফিকেশন কোড পাঠানো হয়েছে।' });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, otp, newPassword } = req.body;
  usersDB = loadData(USERS_FILE, []);
  const record = otpStore[email.toLowerCase()];

  if (!record || record.code !== otp || Date.now() > record.expiresAt) {
    return res.status(400).json({ success: false, message: 'ভুল বা মেয়াদোত্তীর্ণ OTP কোড।' });
  }

  const user = usersDB.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (user) {
    user.password = newPassword;
    delete otpStore[email.toLowerCase()];
    saveData(USERS_FILE, usersDB);
    res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
  } else {
    res.status(404).json({ success: false, message: 'ব্যবহারকারী পাওয়া যায়নি।' });
  }
});

app.post('/api/user/profile', (req, res) => {
  const { phone, name, email, address, location, pincode } = req.body;
  usersDB = loadData(USERS_FILE, []);
  let user = usersDB.find(u => String(u.phone).trim() === String(phone).trim());

  if (!user) {
    user = { name, phone, email, address, location: location || '', pincode, isBlocked: false, preferredItems: [] };
    usersDB.push(user);
  } else {
    if (name) user.name = name;
    if (email) user.email = email;
    if (address) user.address = address;
    if (location !== undefined) user.location = location;
    if (pincode) user.pincode = pincode;
  }
  saveData(USERS_FILE, usersDB);

  res.json({ success: true, user: { name: user.name, phone: user.phone, email: user.email, address: user.address, location: user.location || '', pincode: user.pincode, preferredItems: user.preferredItems || [] } });
});

app.post('/api/user/preferred-menu', (req, res) => {
  const { phone, preferredItems } = req.body;
  usersDB = loadData(USERS_FILE, []);
  const user = usersDB.find(u => String(u.phone).trim() === String(phone).trim());

  if (!user) return res.status(404).json({ success: false, message: 'ব্যবহারকারী পাওয়া যায়নি।' });

  user.preferredItems = preferredItems;
  saveData(USERS_FILE, usersDB);

  res.json({ success: true, preferredItems: user.preferredItems });
});

app.post('/api/user/request-delete-history', (req, res) => {
  const { phone } = req.body;
  usersDB = loadData(USERS_FILE, []);
  const user = usersDB.find(u => String(u.phone).trim() === String(phone).trim());

  if (!user || !user.email) {
    return res.status(404).json({ success: false, message: 'ইউজার বা রেজিস্টার্ড ইমেল পাওয়া যায়নি।' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[`user_del_${phone}`] = { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 };

  sendEmail(
    user.email,
    '🗑️ অর্ডার ইতিহাস ডিলিট কনফার্মেশন OTP - আস্বাদন',
    `<h3>প্রিয় ${user.name},</h3>
     <p>আপনার সমস্ত অর্ডার ইতিহাস ডিলিট করার জন্য অনুরোধ করা হয়েছে।</p>
     <h3>আপনার ভেরিফিকেশন OTP: <b style="color:#e5c158; font-size:24px;">${otp}</b></h3>
     <p>কোডটি ১০ মিনিটের জন্য বৈধ।</p>`
  );

  res.json({ success: true, message: 'আপনার রেজিস্টার্ড ইমেল আইডিতে কনফার্মেশন OTP পাঠানো হয়েছে।' });
});

app.post('/api/user/verify-delete-history', (req, res) => {
  const { phone, otp } = req.body;
  const record = otpStore[`user_del_${phone}`];

  if (!record || record.code !== otp || Date.now() > record.expiresAt) {
    return res.status(400).json({ success: false, message: 'ভুল বা মেয়াদোত্তীর্ণ OTP কোড।' });
  }

  ordersDB = loadData(ORDERS_FILE, []);
  ordersDB = ordersDB.filter(o => String(o.phone).trim() !== String(phone).trim());
  saveData(ORDERS_FILE, ordersDB);

  delete otpStore[`user_del_${phone}`];

  res.json({ success: true, message: 'আপনার সমস্ত অর্ডার ইতিহাস সফলভাবে মুছে ফেলা হয়েছে!' });
});

app.post('/api/orders', (req, res) => {
  const { phone, customerName, email, address, location, items, totalAmount, paymentScreenshot, deliveryDate } = req.body;
  usersDB = loadData(USERS_FILE, []);
  ordersDB = loadData(ORDERS_FILE, []);

  let user = usersDB.find(u => String(u.phone).trim() === String(phone).trim());
  if (user && user.isBlocked) {
    return res.status(403).json({ success: false, message: 'আপনার অ্যাকাউন্টটি স্থগিত (Blocked)। অর্ডার নেওয়া সম্ভব নয়।' });
  }

  if (!user && phone) {
    user = { name: customerName, phone, email: email || '', address, location: location || '', pincode: '700036', isBlocked: false, preferredItems: [] };
    usersDB.push(user);
    saveData(USERS_FILE, usersDB);
  }

  const orderId = 'ASW-' + Math.floor(100000 + Math.random() * 900000);
  const userEmail = email || (user ? user.email : '');
  const userLocation = location || (user ? user.location : '');
  
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const orderDateStr = `${year}-${month}-${day}`;

  const newOrder = {
    orderId,
    phone,
    customerName,
    email: userEmail,
    address,
    location: userLocation,
    items,
    totalAmount,
    paymentScreenshot: paymentScreenshot || '',
    deliveryDate,
    status: 'PENDING',
    orderDate: orderDateStr,
    createdAt: new Date().toLocaleString()
  };

  ordersDB.push(newOrder);
  saveData(ORDERS_FILE, ordersDB);

  const itemsList = items.map(i => `• ${i.name} x ${i.qty} = ₹${i.price * i.qty}`).join('<br>');
  const mapsLink = userLocation ? (userLocation.startsWith('http') ? userLocation.split(' ')[0] : `https://maps.google.com/?q=${userLocation}`) : '';
  
  sendEmail(
    OWNER_NOTIFY_EMAIL,
    `🚨 NEW ORDER: #${orderId} - ₹${totalAmount}`,
    `<h2>নতুন অনলাইন অর্ডার জমা পড়েছে!</h2>
     <p><b>Order ID:</b> ${orderId}</p>
     <p><b>গ্রাহকের নাম:</b> ${customerName}</p>
     <p><b>মোবাইল:</b> ${phone}</p>
     <p><b>ইমেল:</b> ${userEmail}</p>
     <p><b>ঠিকানা:</b> ${address}</p>
     ${userLocation ? `<p><b>গুগল ম্যাপ লোকেশন:</b> <a href="${mapsLink}" target="_blank">View on Google Maps</a> (${userLocation})</p>` : ''}
     <p><b>অর্ডার করার তারিখ:</b> ${orderDateStr}</p>
     <p><b>ডেলিভারি তারিখ:</b> ${deliveryDate}</p>
     <hr>
     <h3>অর্ডারের তালিকা:</h3>
     ${itemsList}
     <hr>
     <p><b>মোট অর্থ:</b> ₹${totalAmount}</p>`
  );

  if (userEmail) {
    sendEmail(
      userEmail,
      `📋 অর্ডার নিশ্চিতকরণ: #${orderId} - আস্বাদন`,
      `<h2>প্রিয় ${customerName}, আপনার অর্ডার জমা নেওয়া হয়েছে!</h2>
       <p><b>Order ID:</b> ${orderId}</p>
       <p><b>ডেলিভারি তারিখ:</b> ${deliveryDate}</p>
       <hr>
       <h3>অর্ডারের বিবরণ:</h3>
       ${itemsList}
       <hr>
       <p><b>মোট মূল্য:</b> ₹${totalAmount}</p>
       <p>আমাদের প্রতিনিধি খুব শীঘ্রই আপনার পেমেন্ট যাচাই করবেন। ধন্যবাদ!</p>`
    );
  }

  res.json({ success: true, order: newOrder });
});

app.get('/api/orders/user/:phone', (req, res) => {
  ordersDB = loadData(ORDERS_FILE, []);
  const userOrders = ordersDB.filter(o => String(o.phone).trim() === String(req.params.phone).trim());
  res.json({ success: true, orders: userOrders });
});

// --- ADMIN ROUTES ---

function verifyAdminToken(req) {
  const authHeader = req.headers['authorization'];
  return authHeader === 'Bearer aswadan_secret_admin_token';
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  adminConfig = loadData(ADMIN_FILE, defaultAdminConfig);

  if (password === adminConfig.password) {
    res.json({ success: true, token: 'aswadan_secret_admin_token' });
  } else {
    res.status(401).json({ success: false, message: 'ভুল এডমিন পাসওয়ার্ড!' });
  }
});

app.post('/api/admin/forgot-password', (req, res) => {
  const { email } = req.body;
  adminConfig = loadData(ADMIN_FILE, defaultAdminConfig);
  const adminEmail = adminConfig.email || 'iammadhuchanda@gmail.com';

  if (!email || email.trim().toLowerCase() !== adminEmail.toLowerCase()) {
    return res.status(400).json({ success: false, message: 'ভুল এডমিন ইমেল আইডি! অনুগ্রহ করে সঠিক ইমেল দিন।' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore['admin_otp'] = { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 };

  sendEmail(
    adminEmail,
    '🔑 এডমিন পাসওয়ার্ড রিসেট OTP - আস্বাদন Admin',
    `<h2>আস্বাদন এডমিন প্যানেল পাসওয়ার্ড রিসেট</h2>
     <h3>আপনার ৬-সংখ্যার OTP কোড: <b style="color:#e5c158; font-size:26px;">${otp}</b></h3>
     <p>এই কোডটি ১০ মিনিটের জন্য বৈধ।</p>`
  );

  res.json({ success: true, message: 'সঠিক এডমিন ইমেল! ওনার ইমেলে OTP কোড পাঠানো হয়েছে।' });
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

  res.json({ success: true, message: 'এডমিন পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
});

app.post('/api/admin/factory-settings/request-otp', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const { optionType } = req.body;
  adminConfig = loadData(ADMIN_FILE, defaultAdminConfig);
  const adminEmail = adminConfig.email || 'iammadhuchanda@gmail.com';

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[`admin_factory_${optionType}`] = { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 };

  let optionName = '';
  const optNum = Number(optionType);
  if (optNum === 1) optionName = 'Delete All Data History (User, Order, Revenue, Pending, Accepted, Rejected)';
  else if (optNum === 2) optionName = 'Delete All Order History (Order data, Pending, Accepted, Rejected)';
  else if (optNum === 3) optionName = 'Delete All User Data';
  else if (optNum === 4) optionName = 'Delete All Revenue Data';

  sendEmail(
    adminEmail,
    `⚠️ Factory Settings OTP [Option ${optionType}] - আস্বাদন Admin`,
    `<h2>এডমিন ফ্যাক্টরি সেটিংস ডিলিট কনফার্মেশন</h2>
     <p>নির্বাচিত অপশন: <b>${optionName}</b></p>
     <h3>আপনার ভেরিফিকেশন OTP: <b style="color:#e5c158; font-size:24px;">${otp}</b></h3>
     <p>কোডটি ১০ মিনিটের জন্য বৈধ।</p>`
  );

  res.json({ success: true, message: 'এডমিন ইমেলে ফ্যাক্টরি সেটিংস OTP পাঠানো হয়েছে।' });
});

app.post('/api/admin/factory-settings/execute', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const { optionType, otp } = req.body;
  const record = otpStore[`admin_factory_${optionType}`];

  if (!record || record.code !== otp || Date.now() > record.expiresAt) {
    return res.status(400).json({ success: false, message: 'ভুল বা মেয়াদোত্তীর্ণ OTP কোড।' });
  }

  let msg = '';
  const optNum = Number(optionType);

  if (optNum === 1) {
    saveData(USERS_FILE, []);
    saveData(ORDERS_FILE, []);
    msg = 'ফ্যাক্টরি রিসেট সফল: সমস্ত ইউজার ডেটা, অর্ডার ইতিহাস ও রেভিনিউ ডেটা মুছে ফেলা হয়েছে!';
  } else if (optNum === 2) {
    saveData(ORDERS_FILE, []);
    msg = 'ফ্যাক্টরি রিসেট সফল: সমস্ত অর্ডার ইতিহাস ও কারেন্ট অর্ডার মুছে ফেলা হয়েছে!';
  } else if (optNum === 3) {
    saveData(USERS_FILE, []);
    msg = 'ফ্যাক্টরি রিসেট সফল: সমস্ত ইউজার ডেটা মুছে ফেলা হয়েছে!';
  } else if (optNum === 4) {
    saveData(ORDERS_FILE, []);
    msg = 'ফ্যাক্টরি রিসেট সফল: সমস্ত রেভিনিউ ডেটা মুছে ফেলা হয়েছে!';
  } else {
    return res.status(400).json({ success: false, message: 'অবৈধ অপশন সিলেক্ট করা হয়েছে।' });
  }

  delete otpStore[`admin_factory_${optionType}`];
  res.json({ success: true, message: msg });
});

app.get('/api/admin/orders', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });

  ordersDB = loadData(ORDERS_FILE, []);
  
  let modified = false;
  ordersDB.forEach(o => {
    if (!o.orderDate || o.orderDate.includes(',')) {
      const d = o.createdAt ? new Date(o.createdAt) : new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      o.orderDate = `${y}-${m}-${day}`;
      modified = true;
    }
  });
  if (modified) saveData(ORDERS_FILE, ordersDB);

  const pending = ordersDB.filter(o => o.status === 'PENDING');
  const accepted = ordersDB.filter(o => o.status === 'ACCEPTED');
  const rejected = ordersDB.filter(o => o.status === 'REJECTED');
  const delivered = ordersDB.filter(o => o.status === 'DELIVERED');

  const netRevenue = [...accepted, ...delivered].reduce((sum, o) => sum + Number(o.totalAmount), 0);

  res.json({
    success: true,
    orders: ordersDB,
    pending,
    accepted,
    rejected,
    delivered,
    stats: {
      totalOrders: ordersDB.length,
      pendingCount: pending.length,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      deliveredCount: delivered.length,
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
        sendEmail(
          order.email,
          `✅ আপনার অর্ডার গ্রহণ করা হয়েছে: #${order.orderId}`,
          `<h2>শুভ সংবাদ ${order.customerName}!</h2>
           <p>আপনার অর্ডার <b>#${order.orderId}</b> রান্নাঘর থেকে অনুমোদন করা হয়েছে।</p>
           <p><b>ডেলিভারির তারিখ:</b> ${order.deliveryDate}</p>
           <p>তাজা ও সুস্বাদু খাবার যথাসময়ে আপনার দরজায় পৌঁছে যাবে।</p>`
        );
      } else if (status === 'REJECTED') {
        sendEmail(
          order.email,
          `❌ অর্ডার স্ট্যাটাস আপডেট: #${order.orderId}`,
          `<h2>প্রিয় ${order.customerName},</h2>
           <p>দুঃখিত! আপনার অর্ডার <b>#${order.orderId}</b> টি বাতিল করা হয়েছে।</p>
           <p style="color:#e63946;"><b>বাতিলের কারণ:</b> ${reason || 'অনাকাঙ্ক্ষিত কারণবশত'}</p>
           <p>যেকোনো জিজ্ঞাসায় যোগাযোগ করুন: 8017960203</p>`
        );
      } else if (status === 'DELIVERED') {
        sendEmail(
          order.email,
          `🍛 খাবার ডেলিভারি সম্পন্ন: #${order.orderId}`,
          `<h2>আপনার খাবার ডেলিভারি করা হয়েছে!</h2>
           <p>আশা করি আস্বাদনের ঘরোয়া রান্না আপনার ভালো লেগেছে। আবার অর্ডার করতে ভিজিট করুন আমাদের ওয়েবসাইটে!</p>`
        );
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
  res.json({ success: true, users: usersDB });
});

app.post('/api/admin/users/toggle-block', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const { phone } = req.body;
  usersDB = loadData(USERS_FILE, []);
  const user = usersDB.find(u => String(u.phone).trim() === String(phone).trim());

  if (user) {
    user.isBlocked = !user.isBlocked;
    saveData(USERS_FILE, usersDB);
    res.json({ success: true, isBlocked: user.isBlocked, message: `ইউজার স্ট্যাটাস পরিবর্তন করা হয়েছে: ${user.isBlocked ? 'Blocked' : 'Active'}` });
  } else {
    res.status(404).json({ success: false, message: 'User not found' });
  }
});

app.post('/api/admin/users/delete', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const { phone } = req.body;
  let users = loadData(USERS_FILE, []);

  const initialLength = users.length;
  users = users.filter(u => String(u.phone).trim() !== String(phone).trim());

  if (users.length < initialLength) {
    usersDB = users;
    saveData(USERS_FILE, usersDB);
    res.json({ success: true, message: 'ইউজার স্থায়ীভাবে মুছে ফেলা হয়েছে (User deleted successfully)' });
  } else {
    res.status(404).json({ success: false, message: 'ইউজার পাওয়া যায়নি (User not found)।' });
  }
});

app.post('/api/admin/menu/save', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const { menu } = req.body;
  if (!Array.isArray(menu)) return res.status(400).json({ success: false, message: 'Invalid menu data' });

  menuDB = menu;
  saveData(MENU_FILE, menuDB);
  res.json({ success: true, message: 'মেনু তালিকা সফলভাবে আপডেট করা হয়েছে!' });
});

app.post('/api/admin/offer/save', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const { enabled, title, desc, image } = req.body;
  offerDB = { enabled: Boolean(enabled), title, desc, image: image || offerDB.image };

  saveData(OFFER_FILE, offerDB);
  res.json({ success: true, message: 'স্পেশাল অফার ব্যানার সফলভাবে সেভ করা হয়েছে!' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 আস্বাদন Server running on http://localhost:${PORT}`);
});