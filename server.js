const express = require('express');
const { Resend } = require('resend');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- MONGODB CONNECTION SETUP ---
const MONGO_URI = process.env.MONGO_URI || '';
if (!MONGO_URI) {
  console.warn('⚠️ WARNING: MONGO_URI environment variable is not set! Database operations will fail.');
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('📦 Connected to MongoDB Atlas successfully!'))
    .catch(err => console.error('❌ MongoDB connection error:', err.message));
}

// --- MONGOOSE SCHEMAS & MODELS ---
const userSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  password: { type: String, default: '' },
  address: { type: String, default: '' },
  location: { type: String, default: '' },
  lat: { type: String, default: '' },
  lng: { type: String, default: '' },
  pincode: { type: String, default: '700036' },
  isBlocked: { type: Boolean, default: false },
  preferredItems: { type: [Number], default: [] }
});
const User = mongoose.model('User', userSchema);

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  phone: String,
  customerName: String,
  email: String,
  address: String,
  location: String,
  items: Array,
  totalAmount: Number,
  paymentScreenshot: String,
  deliveryDate: String,
  status: { type: String, default: 'PENDING' },
  orderDate: String,
  createdAt: String,
  rejectionReason: String,
  refundInfo: Object
});
const Order = mongoose.model('Order', orderSchema);

const menuSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: String,
  price: Number,
  desc: String
});
const MenuItem = mongoose.model('MenuItem', menuSchema);

const reviewSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: String,
  phone: String,
  rating: Number,
  comment: String,
  date: String
});
const Review = mongoose.model('Review', reviewSchema);

const specialRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  phone: String,
  customerName: String,
  email: String,
  itemName: String,
  description: String,
  qty: Number,
  status: { type: String, default: 'PENDING' },
  pricePerPlate: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  createdAt: String,
  rejectionReason: String
});
const SpecialRequest = mongoose.model('SpecialRequest', specialRequestSchema);

const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed
});
const Config = mongoose.model('Config', configSchema);

// --- DEFAULT SEEDING DATA ---
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

const defaultPincodes = ['700036'];

async function seedDefaults() {
  try {
    const menuCount = await MenuItem.countDocuments();
    if (menuCount === 0) {
      await MenuItem.insertMany(defaultMenu);
      console.log('🌱 Seeded default menu items.');
    }
    const offerConf = await Config.findOne({ key: 'offer' });
    if (!offerConf) {
      await Config.create({ key: 'offer', value: defaultOffer });
      console.log('🌱 Seeded default offer config.');
    }
    const adminConf = await Config.findOne({ key: 'admin' });
    if (!adminConf) {
      await Config.create({ key: 'admin', value: defaultAdminConfig });
      console.log('🌱 Seeded default admin config.');
    }
    const pincodeConf = await Config.findOne({ key: 'pincodes' });
    if (!pincodeConf) {
      await Config.create({ key: 'pincodes', value: defaultPincodes });
      console.log('🌱 Seeded default pincodes.');
    }
  } catch (err) {
    console.error('Seeding error:', err.message);
  }
}

mongoose.connection.once('open', () => {
  seedDefaults();
});

const otpStore = {};

const resendApiKey = process.env.EMAIL_PASSWORD || '';
const resend = new Resend(resendApiKey);
const OWNER_NOTIFY_EMAIL = process.env.OWNER_EMAIL || 'iammadhuchanda@gmail.com';

function createBrandEmail(heading, htmlBody) {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0b10; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #d4af37; max-width: 600px; margin: 0 auto; box-shadow: 0 8px 24px rgba(0,0,0,0.6);">
      <div style="text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.3); padding-bottom: 20px; margin-bottom: 25px;">
        <div style="display: inline-block; background: #000000; border: 2px solid #d4af37; border-radius: 50%; width: 75px; height: 75px; line-height: 75px; text-align: center; margin-bottom: 10px; box-shadow: 0 4px 15px rgba(212,175,55,0.4);">
          <img src="https://aaswadanfoodservices.com/logo.png" alt="Aswadan Logo" style="width: 55px; height: 55px; vertical-align: middle; object-fit: contain;" />
        </div>
        <h1 style="color: #d4af37; margin: 0; font-size: 26px; letter-spacing: 0.5px; font-weight: 800;">আস্বাদন (Aaswadan Food Services)</h1>
        <p style="color: #a0a0b0; font-size: 13px; margin: 6px 0 0 0; letter-spacing: 0.5px;">Authentic & Pure Homemade Food Delivery</p>
      </div>
      
      <h2 style="color: #e5c158; font-size: 20px; margin-top: 0; border-left: 4px solid #d4af37; padding-left: 10px;">${heading}</h2>
      
      <div style="font-size: 15px; line-height: 1.7; color: #e0e0e8; background: #181824; padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
        ${htmlBody}
      </div>
      
      <div style="margin-top: 35px; border-top: 1px solid rgba(212, 175, 55, 0.3); padding-top: 20px; text-align: center;">
        <p style="color: #d4af37; font-weight: bold; margin: 0; font-size: 15px;">আন্তরিক ধন্যবাদসহ,</p>
        <p style="color: #ffffff; margin: 6px 0 0 0; font-size: 14px; font-weight: 600;">ম্যানেজমেন্ট টিম, আস্বাদন (Aaswadan Admin)</p>
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

async function syncUserFromOrder(order) {
  if (!order || !order.phone) return;
  try {
    const phone = String(order.phone).trim();
    let user = await User.findOne({ phone });
    if (!user) {
      await User.create({
        name: order.customerName || 'Customer',
        phone: phone,
        email: order.email || '',
        address: order.address || '',
        location: order.location || '',
        pincode: '700036',
        isBlocked: false,
        preferredItems: []
      });
    }
  } catch (err) {
    console.error('syncUserFromOrder error:', err.message);
  }
}

// --- PUBLIC & USER ROUTES ---
app.get('/api/menu', async (req, res) => {
  try {
    const menuDB = await MenuItem.find({}).lean();
    res.json({ success: true, menu: menuDB });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error loading menu' });
  }
});

app.get('/api/offer', async (req, res) => {
  try {
    const conf = await Config.findOne({ key: 'offer' });
    res.json({ success: true, offer: conf ? conf.value : defaultOffer });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error loading offer' });
  }
});

app.get('/api/pincodes', async (req, res) => {
  try {
    const conf = await Config.findOne({ key: 'pincodes' });
    res.json({ success: true, pincodes: conf ? conf.value : defaultPincodes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error loading pincodes' });
  }
});

app.get('/api/reviews', async (req, res) => {
  try {
    const reviewsDB = await Review.find({}).sort({ _id: -1 }).lean();
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

app.post('/api/reviews', async (req, res) => {
  try {
    const { name, phone, rating, comment } = req.body;
    if (!name || !phone || !rating || !comment) {
      return res.status(400).json({ success: false, message: 'সব ফিল্ড পূরণ করুন।' });
    }

    const registeredUser = await User.findOne({ phone: String(phone).trim() });
    if (!registeredUser) {
      return res.status(403).json({ success: false, message: 'শুধুমাত্র রেজিস্টার্ড ব্যবহারকারীরাই রিভিউ দিতে পারবেন।' });
    }

    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const englishDate = new Date().toLocaleDateString('en-US', options);

    const newReview = await Review.create({
      id: Date.now(),
      name,
      phone,
      rating: Number(rating),
      comment,
      date: englishDate
    });

    res.json({ success: true, message: 'আপনার মূল্যবান রিভিউটি সফলভাবে জমা হয়েছে!', review: newReview });
  } catch (err) {
    console.error('Review post error:', err.message);
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

app.post('/api/special-request', async (req, res) => {
  try {
    const { phone, customerName, email, itemName, description, qty } = req.body;
    if (!phone || !itemName || !qty) {
      return res.status(400).json({ success: false, message: 'খাবারের নাম ও পরিমাণ উল্লেখ করুন।' });
    }

    const userRecord = await User.findOne({ phone: String(phone).trim() });
    let locationLink = 'লোকেশন দেওয়া হয়নি';
    if (userRecord) {
      if (userRecord.lat && userRecord.lng) {
        locationLink = `https://maps.google.com/?q=${userRecord.lat},${userRecord.lng}`;
      } else if (userRecord.location) {
        locationLink = userRecord.location.startsWith('http') ? userRecord.location : `https://maps.google.com/?q=${userRecord.location}`;
      }
    }

    const reqId = 'SRQ-' + Math.floor(100000 + Math.random() * 900000);

    const newReq = await SpecialRequest.create({
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
    });

    if (email) {
      const userHtml = createBrandEmail(
        `✨ আপনার স্পেশাল ফুড রিকুয়েস্ট জমা হয়েছে: #${reqId}`,
        `<p>নমস্কার <b>${customerName}</b>,</p>
         <p>আপনার কাস্টম / স্পেশাল ফুড রিকুয়েস্ট সফলভাবে আমাদের কাছে পৌঁছেছে। এডমিন এটি যাচাই করে শীঘ্রই মূল্য নির্ধারণ করবেন।</p>
         <p><b>Request ID:</b> <span style="color:#d4af37;">#${reqId}</span><br>
            <b>খাবার:</b> ${itemName} (${qty} প্লেট)<br>
            <b>বিবরণ:</b> ${description || 'N/A'}</p>`
      );
      sendEmail(email, `✨ আপনার স্পেশাল ফুড রিকুয়েস্ট জমা হয়েছে: #${reqId}`, userHtml);
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
  } catch (err) {
    console.error('Special request error:', err.message);
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

app.get('/api/special-request/user/:phone', async (req, res) => {
  try {
    const userReqs = await SpecialRequest.find({ phone: String(req.params.phone).trim() }).lean();
    res.json({ success: true, requests: userReqs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error loading special requests' });
  }
});

app.post('/api/special-request/pay', async (req, res) => {
  try {
    const { requestId, paymentScreenshot, deliveryDate } = req.body;
    const reqItem = await SpecialRequest.findOne({ requestId });
    if (!reqItem || reqItem.status !== 'PRICED') {
      return res.status(400).json({ success: false, message: 'অনুরোধটি পাওয়া যায়নি বা মূল্য নির্ধারণ করা হয়নি।' });
    }

    reqItem.status = 'ORDERED';
    await reqItem.save();

    const orderId = 'ASW-SRQ-' + Math.floor(100000 + Math.random() * 900000);
    const newOrder = await Order.create({
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
    });

    await syncUserFromOrder(newOrder);

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
  } catch (err) {
    console.error('Special payment error:', err.message);
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

// --- SIGNUP ROUTE WITH DYNAMIC PINCODE CHECK ---
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, phone, email, password, address, location, lat, lng, pincode } = req.body;
    const pincodeConf = await Config.findOne({ key: 'pincodes' });
    const allowedPincodes = pincodeConf ? pincodeConf.value : defaultPincodes;
    
    if (!allowedPincodes.includes(pincode.trim())) {
      return res.status(400).json({ success: false, message: `আমাদের পরিষেবা শুধুমাত্র নির্ধারিত পিনকোডসমূহে (${allowedPincodes.join(', ')}) উপলব্ধ।` });
    }

    const existingUser = await User.findOne({
      $or: [
        { phone: String(phone).trim() },
        ...(email ? [{ email: email.trim().toLowerCase() }] : [])
      ]
    });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'এই মোবাইল নম্বর বা ইমেল দিয়ে ইতিমধ্যে অ্যাকাউন্ট রয়েছে।' });
    }

    const newUser = await User.create({
      name,
      phone,
      email,
      password,
      address,
      location: location || '',
      lat: lat || '',
      lng: lng || '',
      pincode,
      isBlocked: false,
      preferredItems: []
    });

    if (email) {
      const welcomeHtml = createBrandEmail(
        `🎉 আস্বাদন (Aaswadan) পরিবারে আপনাকে স্বাগতম!`,
        `<p>নমস্কার <b>${name}</b>,</p>
         <p>আস্বাদন ফুড সার্ভিসেস-এ সফলভাবে রেজিস্টার করার জন্য আপনাকে অসংখ্য ধন্যবাদ। এখন থেকেই আপনি আমাদের সুস্বাদু এবং বিশুদ্ধ হোম ডেলিভারি খাবার অর্ডার করতে পারবেন।</p>`
      );
      sendEmail(email, `🎉 আস্বাদন পরিবারে আপনাকে স্বাগতম!`, welcomeHtml);
    }

    res.json({ success: true, user: newUser });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

// --- PROFILE UPDATE ROUTE WITH DYNAMIC PINCODE CHECK ---
app.post('/api/user/profile', async (req, res) => {
  try {
    const { phone, name, email, address, location, lat, lng, pincode } = req.body;
    const pincodeConf = await Config.findOne({ key: 'pincodes' });
    const allowedPincodes = pincodeConf ? pincodeConf.value : defaultPincodes;

    if (pincode && !allowedPincodes.includes(pincode.trim())) {
      return res.status(400).json({ success: false, message: `আমাদের পরিষেবা শুধুমাত্র নির্ধারিত পিনকোডসমূহে (${allowedPincodes.join(', ')}) উপলব্ধ।` });
    }

    const user = await User.findOne({ phone: String(phone).trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'ইউজার পাওয়া যায়নি।' });
    }
    if (name) user.name = name;
    if (email) user.email = email;
    if (address) user.address = address;
    if (location !== undefined) user.location = location;
    if (lat !== undefined) user.lat = lat;
    if (lng !== undefined) user.lng = lng;
    if (pincode) user.pincode = pincode;

    await user.save();
    res.json({ success: true, message: 'প্রোফাইল সফলভাবে আপডেট হয়েছে!', user });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({
      $or: [
        { phone: String(identifier).trim() },
        { email: String(identifier).trim().toLowerCase() }
      ],
      password: password
    }).lean();

    if (!user || user.isBlocked) {
      return res.status(401).json({ success: false, message: 'লগইন তথ্য ভুল অথবা অ্যাকাউন্ট ব্লক করা হয়েছে।' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
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
  } catch (err) {
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) return res.status(400).json({ success: false, message: 'ইউজার পাওয়া যায়নি।' });

    const record = otpStore[`user_otp_${user.phone}`];
    if (!record || record.code !== otp || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'ভুল বা মেয়াদোত্তীর্ণ OTP কোড।' });
    }

    user.password = newPassword;
    delete otpStore[`user_otp_${user.phone}`];
    await user.save();
    res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

app.get('/api/orders/user/:phone', async (req, res) => {
  try {
    const userOrders = await Order.find({ phone: String(req.params.phone).trim() }).lean();
    res.json({ success: true, orders: userOrders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error loading orders' });
  }
});

app.post('/api/orders/cancel', async (req, res) => {
  try {
    const { orderId, phone, refundInfo } = req.body;
    const order = await Order.findOne({ orderId, phone: String(phone).trim() });

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
    await order.save();

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
  } catch (err) {
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

// --- PREFERRED MENU SAVE ROUTE ---
app.post('/api/user/preferred-menu', async (req, res) => {
  try {
    const { phone, preferredItems } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'মোবাইল নম্বর পাওয়া যায়নি।' });
    }

    const user = await User.findOne({ phone: String(phone).trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'ইউজার পাওয়া যায়নি।' });
    }

    user.preferredItems = Array.isArray(preferredItems) ? preferredItems.map(Number) : [];
    await user.save();

    res.json({ success: true, message: 'প্রেফার্ড মেনু সফলভাবে সেভ হয়েছে!', preferredItems: user.preferredItems });
  } catch (err) {
    console.error('Preferred menu save error:', err.message);
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

// --- ORDER PLACEMENT ROUTE WITH LATEST USER PROFILE LOCATION SYNC ---
app.post('/api/orders', async (req, res) => {
  try {
    const { phone, customerName, email, address, location, items, totalAmount, paymentScreenshot, deliveryDate } = req.body;
    
    const latestUser = await User.findOne({ phone: String(phone).trim() });
    
    const finalAddress = latestUser && latestUser.address ? latestUser.address : address;
    let finalLocation = location;
    if (latestUser && latestUser.lat && latestUser.lng) {
      finalLocation = `${latestUser.lat}, ${latestUser.lng}`;
    } else if (latestUser && latestUser.location) {
      finalLocation = latestUser.location;
    }

    const orderId = 'ASW-' + Math.floor(100000 + Math.random() * 900000);
    const newOrder = await Order.create({ 
      orderId, 
      phone, 
      customerName, 
      email, 
      address: finalAddress, 
      location: finalLocation, 
      items, 
      totalAmount, 
      paymentScreenshot, 
      deliveryDate, 
      status: 'PENDING', 
      orderDate: new Date().toISOString().split('T')[0], 
      createdAt: new Date().toLocaleString() 
    });

    await syncUserFromOrder(newOrder);

    const locationLink = finalLocation ? (finalLocation.startsWith('http') ? finalLocation : `https://maps.google.com/?q=${finalLocation}`) : 'লোকেশন দেওয়া হয়নি';
    const itemsListStr = (items || []).map(i => `${i.name} x ${i.qty} (₹${i.price * i.qty})`).join('<br>');

    if (email) {
      const userHtml = createBrandEmail(
        `📦 অর্ডার সফলভাবে জমা হয়েছে: #${orderId}`,
        `<p>ধন্যবাদ <b>${customerName}</b>,</p>
         <p>আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে এবং বর্তমানে অনুমোদনের অপেক্ষায় রয়েছে।</p>
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
          <b>ঠিকানা:</b> ${finalAddress}<br>
          <b>ডেলিভারি তারিখ:</b> ${deliveryDate}<br>
          <b>খাবারের তালিকা:</b><br>${itemsListStr}<br>
          <b>মোট মূল্য:</b> ₹${totalAmount}<br>
          <b>গুগল ম্যাপ লোকেশন:</b> <a href="${locationLink}" target="_blank" style="color:#d4af37;">🗺️ View Location on Map</a></p>`
    );
    sendEmail(OWNER_NOTIFY_EMAIL, `🚨 নতুন অর্ডার এসেছে: #${orderId}`, adminHtml);

    res.json({ success: true, order: newOrder });
  } catch (err) {
    console.error('Order post error:', err.message);
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

app.post('/api/user/delete-history', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'মোবাইল নম্বর পাওয়া যায়নি।' });
    }

    const cleanPhone = String(phone).trim();
    await Order.deleteMany({ phone: cleanPhone });
    await SpecialRequest.deleteMany({ phone: cleanPhone });

    res.json({ success: true, message: 'আপনার সমস্ত অর্ডার ও স্পেশাল রিকুয়েস্ট হিস্ট্রি সফলভাবে মুছে ফেলা হয়েছে।' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

// --- ADMIN ROUTES ---
function verifyAdminToken(req) {
  return req.headers['authorization'] === 'Bearer aswadan_secret_admin_token';
}

app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body;
    const conf = await Config.findOne({ key: 'admin' });
    const adminConf = conf ? conf.value : defaultAdminConfig;
    if (password === adminConf.password) res.json({ success: true, token: 'aswadan_secret_admin_token' });
    else res.status(401).json({ success: false, message: 'ভুল পাসওয়ার্ড!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/admin/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const conf = await Config.findOne({ key: 'admin' });
    const adminConf = conf ? conf.value : defaultAdminConfig;
    const adminEmail = adminConf.email || 'iammadhuchanda@gmail.com';
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
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/admin/reset-password', async (req, res) => {
  try {
    const { otp, newPassword } = req.body;
    const record = otpStore['admin_otp'];
    if (!record || record.code !== otp || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'ভুল বা মেয়াদোত্তীর্ণ OTP কোড।' });
    }
    let conf = await Config.findOne({ key: 'admin' });
    if (!conf) {
      conf = await Config.create({ key: 'admin', value: defaultAdminConfig });
    }
    conf.value.password = newPassword;
    conf.markModified('value');
    await conf.save();
    delete otpStore['admin_otp'];
    res.json({ success: true, message: 'পাসওয়ার্ড পরিবর্তন করা হয়েছে!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/admin/factory-settings/request-otp', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const { optionType } = req.body;
    const conf = await Config.findOne({ key: 'admin' });
    const adminConf = conf ? conf.value : defaultAdminConfig;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[`admin_factory_${optionType}`] = { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 };
    
    const factoryOtpHtml = createBrandEmail(
      `⚠️ ফ্যাক্টরি সেটিংস OTP`,
      `<p>ফ্যাক্টরি রিসেট বা ডেটা মুছে ফেলার জন্য আপনার OTP কোড:</p>
       <div style="text-align: center; margin: 20px 0;">
         <span style="font-size: 28px; font-weight: bold; color: #e63946; background: #12121a; padding: 10px 20px; border-radius: 8px; border: 1px solid #e63946; letter-spacing: 3px;">${otp}</span>
       </div>`
    );
    sendEmail(adminConf.email, '⚠️ Factory Settings OTP', factoryOtpHtml);
    res.json({ success: true, message: 'OTP পাঠানো হয়েছে।' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/admin/factory-settings/execute', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const { optionType, otp } = req.body;
    const record = otpStore[`admin_factory_${optionType}`];
    if (!record || record.code !== otp || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'ভুল বা মেয়াদোত্তীর্ণ OTP কোড।' });
    }
    const optNum = Number(optionType);
    
    if (optNum === 1) { 
      await User.deleteMany({}); 
      await Order.deleteMany({}); 
      await Review.deleteMany({});
      await SpecialRequest.deleteMany({});
    }
    else if (optNum === 2) { 
      await Order.deleteMany({}); 
      await SpecialRequest.deleteMany({});
    }
    else if (optNum === 3) { 
      await User.deleteMany({}); 
    }
    else if (optNum === 4) { 
      await Order.deleteMany({}); 
    }

    delete otpStore[`admin_factory_${optionType}`];
    res.json({ success: true, message: 'ফ্যাক্টরি রিসেট সফল হয়েছে!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const ordersDB = await Order.find({}).lean();
    const specialRequestsDB = await SpecialRequest.find({}).lean();

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
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/admin/order-status', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const { orderId, status, reason } = req.body;
    const order = await Order.findOne({ orderId });
    if (order) {
      order.status = status;
      if (reason) order.rejectionReason = reason;
      await order.save();

      if (order.email) {
        if (status === 'ACCEPTED') {
          const acceptHtml = createBrandEmail(
            `✅ আপনার অর্ডার গৃহীত হয়েছে: #${orderId}`,
            `<p>সুসংবাদ <b>${order.customerName}</b>,</p>
             <p>আপনার অর্ডারটি (#${orderId}) সফলভাবে এপ্রুভ করা হয়েছে এবং নির্ধারিত সময় অনুযায়ী ডেলিভারির প্রস্তুতি চলছে।</p>`
          );
          sendEmail(order.email, `✅ আপনার অর্ডার গৃহীত হয়েছে: #${orderId}`, acceptHtml);
        } else if (status === 'REJECTED') {
          const rejectHtml = createBrandEmail(
            `❌ আপনার অর্ডার বাতিল করা হয়েছে: #${orderId}`,
            `<p>দুঃখিত <b>${order.customerName}</b>,</p>
             <p>অনাবশ্যক কারণবশত আপনার অর্ডারটি (#${orderId}) বাতিল করা হয়েছে।</p>
             <p style="color: #ffb703; font-weight: bold;">বাতিলের কারণ: ${reason || 'প্রশাসনিক সিদ্ধান্ত'}</p>`
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
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const usersDB = await User.find({}).lean();
    res.json({ success: true, users: usersDB });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/admin/users/toggle-block', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const user = await User.findOne({ phone: String(req.body.phone).trim() });
    if (user) {
      user.isBlocked = !user.isBlocked;
      await user.save();
      res.json({ success: true, isBlocked: user.isBlocked, message: 'ইউজার স্ট্যাটাস পরিবর্তিত হয়েছে।' });
    } else {
      res.status(404).json({ success: false, message: 'ইউজার পাওয়া যায়নি।' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/admin/users/delete', async (req, res) => {
  try {
    const targetPhone = req.body.phone ? String(req.body.phone).trim() : null;
    const targetEmail = req.body.email ? String(req.body.email).trim().toLowerCase() : null;

    let query = {};
    if (targetPhone && targetEmail) {
      query = { $or: [{ phone: targetPhone }, { email: targetEmail }] };
    } else if (targetPhone) {
      query = { phone: targetPhone };
    } else if (targetEmail) {
      query = { email: targetEmail };
    }

    if (targetPhone) {
      await Order.deleteMany({ phone: targetPhone });
      await SpecialRequest.deleteMany({ phone: targetPhone });
    }

    await User.deleteMany(query);

    return res.json({ success: true, message: 'ইউজার সফলভাবে মুছে ফেলা হয়েছে।' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি!' });
  }
});

app.post('/api/admin/pincodes/save', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const { pincodes } = req.body;
    if (Array.isArray(pincodes)) {
      let conf = await Config.findOne({ key: 'pincodes' });
      if (!conf) {
        conf = await Config.create({ key: 'pincodes', value: defaultPincodes });
      }
      conf.value = pincodes;
      conf.markModified('value');
      await conf.save();
      return res.json({ success: true, message: 'ডেলিভারি পিনকোড তালিকা সফলভাবে আপডেট হয়েছে!' });
    }
    res.status(400).json({ success: false, message: 'অবৈধ পিনকোড ডেটা।' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/admin/special-requests', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const specialRequestsDB = await SpecialRequest.find({}).lean();
    res.json({ success: true, requests: specialRequestsDB });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/admin/special-request/action', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const { requestId, action, pricePerPlate, reason } = req.body;
    const reqItem = await SpecialRequest.findOne({ requestId });
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
    
    await reqItem.save();
    res.json({ success: true, message: 'রিকুয়েস্ট আপডেট হয়েছে!', request: reqItem });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/admin/menu/save', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const newMenu = req.body.menu;
    if (Array.isArray(newMenu)) {
      await MenuItem.deleteMany({});
      await MenuItem.insertMany(newMenu);
      return res.json({ success: true, message: 'মেনু আপডেট হয়েছে!' });
    }
    res.status(400).json({ success: false, message: 'Invalid menu data' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/admin/offer/save', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const newOffer = req.body;
    let conf = await Config.findOne({ key: 'offer' });
    const wasDisabled = !conf || !conf.value.enabled;
    
    if (!conf) {
      conf = await Config.create({ key: 'offer', value: newOffer });
    } else {
      conf.value = newOffer;
      conf.markModified('value');
      await conf.save();
    }

    if (newOffer.enabled && (wasDisabled || conf.value.title !== newOffer.title || conf.value.desc !== newOffer.desc)) {
      const usersDB = await User.find({ isBlocked: false, email: { $exists: true, $ne: '' } }).lean();
      usersDB.forEach(u => {
        if (u.email) {
          const offerHtml = createBrandEmail(
            `🎉 বিশেষ অফার: ${newOffer.title}`,
            `<p>নমস্কার <b>${u.name}</b>,</p>
             <p>আমাদের পক্ষ থেকে আপনাদের জন্য নিয়ে এসেছি একটি দারুণ স্পেশাল অফার!</p>
             <div style="background: #1c1c2e; padding: 15px; border-radius: 10px; border: 1px solid #d4af37; margin: 15px 0;">
               <h3 style="color: #e5c158; margin-top: 0;">🏷️ অফারের শিরোনাম: ${newOffer.title}</h3>
               <p style="color: #ffffff; margin-bottom: 0;">📝 অফারের বিবরণ: ${newOffer.desc}</p>
             </div>
             <p>আজই আমাদের ওয়েবসাইট ভিজিট করুন এবং উপভোগ করুন সুস্বাদু খাবার!</p>`
          );
          sendEmail(u.email, `🎉 আস্বাদন স্পেশাল অফার: ${newOffer.title}`, offerHtml);
        }
      });
    }

    res.json({ success: true, message: 'অফার সেভ ও ইউজারদের নোটিফিকেশন পাঠানো হয়েছে!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/admin/reviews/delete', async (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    await Review.deleteOne({ id: Number(req.body.id) });
    res.json({ success: true, message: 'রিভিউ ডিলিট হয়েছে।' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 আস্বাদন Server running on http://localhost:${PORT}`);
});