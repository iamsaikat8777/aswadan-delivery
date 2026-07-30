// --- GLOBAL AUTO-INJECTED LANGUAGE SWITCHER ---
(function() {
  const style = document.createElement('style');
  style.innerHTML = `
    .auto-lang-container {
      position: fixed;
      top: max(12px, env(safe-area-inset-top, 12px));
      left: 12px;
      z-index: 10000;
    }
    .auto-lang-btn {
      background: rgba(18, 17, 25, 0.92);
      border: 1px solid rgba(212, 175, 55, 0.35);
      color: #e5c158;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 5px 10px;
      border-radius: 20px;
      cursor: pointer;
      backdrop-filter: blur(12px);
      box-shadow: 0 4px 15px rgba(0,0,0,0.6);
      transition: all 0.25s ease;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .auto-lang-btn:hover {
      background: linear-gradient(135deg, #d4af37 0%, #e5c158 50%, #aa820a 100%);
      color: #000;
    }
    @media (max-width: 768px) {
      .top-nav-container {
        justify-content: center !important;
        padding: max(10px, env(safe-area-inset-top, 10px)) 5px 0 !important;
        width: 100vw;
        overflow-x: auto;
      }
      .top-nav-bar {
        padding: 3px 6px !important;
        gap: 2px !important;
        flex-wrap: nowrap !important;
        white-space: nowrap !important;
      }
      .top-nav-link {
        padding: 5px 8px !important;
        font-size: 0.75rem !important;
      }
    }
  `;
  document.head.appendChild(style);

  if (!document.getElementById('global-lang-btn-box')) {
    const langDiv = document.createElement('div');
    langDiv.id = 'global-lang-btn-box';
    langDiv.className = 'auto-lang-container';
    langDiv.innerHTML = `
      <button class="auto-lang-btn" onclick="window.toggleGlobalLanguage()">
        🌐 <span id="global-lang-label">English</span>
      </button>
    `;
    document.body.prepend(langDiv);
  }

  window.currentLang = localStorage.getItem('aswadan_lang') || 'bn';

  window.applyGlobalLanguage = function(lang) {
    window.currentLang = lang;
    localStorage.setItem('aswadan_lang', lang);
    
    const label = document.getElementById('global-lang-label');
    if (label) {
      label.innerText = (lang === 'bn') ? 'English' : 'বাংলা';
    }

    document.querySelectorAll('[data-bn]').forEach(el => {
      const text = el.getAttribute(`data-${lang}`);
      if (text) {
        if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
          el.placeholder = text;
        } else {
          el.innerHTML = text;
        }
      }
    });
  };

  window.toggleGlobalLanguage = function() {
    const newLang = (window.currentLang === 'bn') ? 'en' : 'bn';
    window.applyGlobalLanguage(newLang);
  };

  window.addEventListener('DOMContentLoaded', () => {
    window.applyGlobalLanguage(window.currentLang);
  });
})();

// --- CART & APP CORE LOGIC ---
let cart = JSON.parse(localStorage.getItem('aswadan_cart') || '[]');
let currentUser = JSON.parse(localStorage.getItem('aswadan_user') || localStorage.getItem('currentUser') || 'null');
let paymentScreenshotBase64 = '';
let specPaymentScreenshotBase64 = '';
let mapPickerTargetInput = null;
let leafletMapInstance = null;
let selectedMarker = null;

window.addEventListener('DOMContentLoaded', () => {
  updateCartCount();
  updateAuthNavUI();
  loadHomeSpotlight();
  checkPWAInstallPrompt();
  injectUserDashboardModalIfNeeded();
  injectCartModalIfNeeded();
  checkSpecialRequestNotificationBadge();
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const delDateInput = document.getElementById('delivery-date');
  if (delDateInput) {
    delDateInput.value = tomorrow.toISOString().split('T')[0];
  }
  const specDelDateInput = document.getElementById('spec-delivery-date');
  if (specDelDateInput) {
    specDelDateInput.value = tomorrow.toISOString().split('T')[0];
  }
});

function updateCartCount() {
  const countEl = document.getElementById('cart-count');
  if (countEl) {
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    countEl.innerText = totalQty;
  }
  localStorage.setItem('aswadan_cart', JSON.stringify(cart));
}

// --- STRICT LOGIN STATE NAVBAR & DROPDOWN UI FIX ---
function updateAuthNavUI() {
  const btn = document.getElementById('profile-nav-btn');
  const wrapper = document.getElementById('user-nav-wrapper');
  const dropdownMenu = document.getElementById('user-hover-menu');

  if (currentUser && currentUser.phone) {
    if (btn) {
      btn.innerText = `👤 ${currentUser.name ? currentUser.name.split(' ')[0] : 'Account'}`;
      btn.onclick = toggleUserDropdown;
    }
    if (wrapper) wrapper.style.pointerEvents = 'auto';
    if (dropdownMenu) dropdownMenu.style.display = '';
  } else {
    if (btn) {
      btn.innerText = '👤 Sign In';
      btn.onclick = openAuthModal;
    }
    if (wrapper) {
      wrapper.style.pointerEvents = 'none';
      if (btn) btn.style.pointerEvents = 'auto';
    }
    if (dropdownMenu) dropdownMenu.style.display = 'none';
  }
}

function toggleUserDropdown(e) {
  if (!currentUser || !currentUser.phone) {
    openAuthModal();
    return;
  }
  if (e) e.stopPropagation();
  const wrapper = document.getElementById('user-nav-wrapper');
  if (wrapper) wrapper.classList.toggle('active-dropdown');
}

window.addEventListener('click', (e) => {
  const wrapper = document.getElementById('user-nav-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    wrapper.classList.remove('active-dropdown');
  }
});

function showToast(msg) {
  const toast = document.getElementById('toast-msg');
  if (toast) {
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.style.display = 'none';
}

function openAuthModal() {
  const m = document.getElementById('auth-modal');
  if (m) m.style.display = 'flex';
  switchAuthTab('login');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  if (loginForm) loginForm.style.display = (tab === 'login') ? 'block' : 'none';
  if (signupForm) signupForm.style.display = (tab === 'signup') ? 'block' : 'none';
}

async function loginUser() {
  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value.trim();
  if (!identifier || !password) return alert('সমস্ত ফিল্ড পূরণ করুন।');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('aswadan_user', JSON.stringify(currentUser));
      closeModal('auth-modal');
      updateAuthNavUI();
      showToast('সফলভাবে লগইন হয়েছে!');
      location.reload();
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('সার্ভার ত্রুটি!');
  }
}

async function signupUser() {
  const name = document.getElementById('signup-name').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value.trim();
  const address = document.getElementById('signup-address').value.trim();
  const location = document.getElementById('signup-location').value.trim();
  const pincode = document.getElementById('signup-pincode').value.trim();

  if (!name || !phone || !email || !password || !address || !pincode) {
    return alert('সমস্ত প্রয়োজনীয় ফিল্ড পূরণ করুন।');
  }

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password, address, location, pincode })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('aswadan_user', JSON.stringify(currentUser));
      closeModal('auth-modal');
      updateAuthNavUI();
      showToast('সাইন-আপ সফল হয়েছে!');
      location.reload();
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('সার্ভার ত্রুটি!');
  }
}

function logoutUser() {
  localStorage.removeItem('aswadan_user');
  localStorage.removeItem('currentUser');
  currentUser = null;
  updateAuthNavUI();
  location.reload();
}

// --- AUTO-INJECT CART MODAL IF MISSING ON ANY PAGE ---
function injectCartModalIfNeeded() {
  if (!document.getElementById('cart-modal')) {
    const cartModalDiv = document.createElement('div');
    cartModalDiv.id = 'cart-modal';
    cartModalDiv.className = 'modal';
    cartModalDiv.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>🛒 আপনার কার্ট ও পেমেন্ট</h3>
          <button class="close-btn" onclick="closeModal('cart-modal')">&times;</button>
        </div>
        <div id="cart-step-1">
          <div id="cart-items"></div>
          <div class="cart-summary" style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; font-weight:bold; font-size:1.1rem; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">
            <span>মোট মূল্য:</span>
            <span class="total-price" style="color:var(--gold-bright);">₹<span id="cart-total">0</span></span>
          </div>
          <div id="min-order-notice" style="display:none; background:rgba(230,57,70,0.15); border:1px solid var(--red-accent); color:#ff6b6b; padding:10px; border-radius:8px; font-size:0.88rem; text-align:center; margin:12px 0; font-weight:bold;">
            ⚠️ আমাদের সর্বনিম্ন অর্ডার ২ টি থালি / প্লেট। অনুগ্রহ করে আরও আইটেম যোগ করুন।
          </div>
          <button class="btn-primary" onclick="proceedToPaymentStep()" style="margin-top:15px;">পেমেন্ট ও অর্ডার নিশ্চিত করুন ➔</button>
        </div>
        <div id="cart-step-2" style="display: none;">
          <button onclick="backToCartStep()" style="background:none; border:none; color:var(--gold-bright); cursor:pointer; font-weight:bold; margin-bottom:10px;">← কার্ট সংশোধন করুন</button>
          <div class="qr-box" style="background:#ffffff; padding:15px; border-radius:12px; text-align:center; margin-bottom:12px;">
            <p style="font-weight:800; color:#111 !important; margin-bottom:8px;">Scan QR to Pay</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=8017969203@ybl%26pn=Aswadan%20Food%20Services%26cu=INR" alt="Aswadan UPI QR">
            <p style="margin-top:8px; font-weight:800; color:#111 !important;">UPI ID: <span style="color:#d4af37;">8017969203@ybl</span></p>
          </div>
          <label class="input-label">📅 ডেলিভারির তারিখ:</label>
          <input type="date" id="delivery-date" class="input-field" style="margin-bottom:10px;">
          <label class="input-label">🖼️ পেমেন্ট স্ক্রিনশট আপলোড করুন:</label>
          <input type="file" id="payment-screenshot-input" accept="image/*" class="input-field" onchange="handlePaymentScreenshotUpload(event)" style="margin-bottom:8px;">
          <img id="payment-screenshot-preview" src="" alt="Preview" style="max-width:180px; border-radius:8px; display:none; margin:8px auto; border:1px solid var(--border-gold);">
          <button class="btn-primary" onclick="placeOrder()">অর্ডার নিশ্চিত করুন</button>
        </div>
      </div>
    `;
    document.body.appendChild(cartModalDiv);
  }
}

// --- DEDUPLICATED AUTO-INJECT USER DASHBOARD MODAL WITH DELETE HISTORY BUTTON ---
function injectUserDashboardModalIfNeeded() {
  const dropdownMenu = document.getElementById('user-hover-menu');
  if (dropdownMenu) {
    dropdownMenu.querySelectorAll('#dropdown-special-link').forEach(el => el.remove());
    dropdownMenu.querySelectorAll('a[onclick*="openUserDashboard(\'special\')"]').forEach(el => el.remove());

    const specialLink = document.createElement('a');
    specialLink.id = 'dropdown-special-link';
    specialLink.href = 'javascript:void(0)';
    specialLink.onclick = () => openUserDashboard('special');
    specialLink.style.cssText = 'color:var(--gold-bright); font-weight:bold; display:flex; justify-content:space-between; align-items:center;';
    specialLink.innerHTML = `<span>✨ Special Order Request</span> <span id="dropdown-spec-badge" style="background:#e63946; color:#fff; font-size:0.7rem; padding:1px 6px; border-radius:10px; display:none;">!</span>`;
    
    const logoutBtn = dropdownMenu.querySelector('a[onclick*="logoutUser"]');
    if (logoutBtn) {
      dropdownMenu.insertBefore(specialLink, logoutBtn);
    } else {
      dropdownMenu.appendChild(specialLink);
    }
  }

  if (!document.getElementById('user-dashboard-modal')) {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'user-dashboard-modal';
    modalDiv.className = 'modal';
    modalDiv.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h3>👤 ইউজার ড্যাশবোর্ড (User Dashboard)</h3>
          <button class="close-btn" onclick="closeModal('user-dashboard-modal')">&times;</button>
        </div>
        <div class="dashboard-tabs" style="display:flex; gap:6px; margin-bottom:15px; flex-wrap:wrap;">
          <button class="dash-tab-btn active" id="btn-tab-profile" onclick="switchDashboardTab('profile')">👤 Profile</button>
          <button class="dash-tab-btn" id="btn-tab-history" onclick="switchDashboardTab('history')">📦 History</button>
          <button class="dash-tab-btn" id="btn-tab-status" onclick="switchDashboardTab('status')">🚚 Status</button>
          <button class="dash-tab-btn" id="btn-tab-preferred" onclick="switchDashboardTab('preferred')">⭐ Preferred</button>
          <button class="dash-tab-btn" id="btn-tab-special" onclick="switchDashboardTab('special')" style="background:var(--gold-gradient); color:#000; font-weight:bold; position:relative;">✨ Special Request <span id="modal-spec-badge" style="position:absolute; top:-4px; right:-4px; background:#e63946; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:50%; display:none;">!</span></button>
        </div>

        <div id="dash-view-profile">
          <label class="input-label">👤 নাম:</label>
          <input type="text" id="prof-name" class="input-field">
          <label class="input-label">📱 মোবাইল নম্বর:</label>
          <input type="tel" id="prof-phone" class="input-field" readonly style="opacity:0.7;">
          <label class="input-label">📧 ইমেল:</label>
          <input type="email" id="prof-email" class="input-field">
          <label class="input-label">🏠 ঠিকানা:</label>
          <textarea id="prof-address" class="input-field"></textarea>
          <label class="input-label">📍 পিনকোড:</label>
          <input type="text" id="prof-pincode" class="input-field" value="700036">
          <button class="btn-primary" onclick="saveUserProfile()">প্রোফাইল আপডেট করুন</button>
          
          <div style="margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;">
            <button onclick="confirmAndDeleteUserHistory()" style="width: 100%; background: #e63946; color: #fff; font-weight: bold; padding: 12px; border: none; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.92rem; box-shadow: 0 4px 15px rgba(230,57,70,0.4);">
              🗑️ Delete All Data History
            </button>
          </div>
        </div>

        <div id="dash-view-history" style="display:none;"><div id="user-orders-history-list"></div></div>
        <div id="dash-view-status" style="display:none;"><div id="current-orders-status-list"></div></div>
        <div id="dash-view-preferred" style="display:none;"><div id="preferred-selection-list"></div></div>
        
        <div id="dash-view-special" style="display:none;">
          <form id="special-request-form" onsubmit="submitSpecialFoodRequest(event)">
            <h4 style="color:var(--gold-bright); margin-bottom:10px;">✨ কাস্টম / মেনুর বাইরে খাবারের রিকুয়েস্ট করুন</h4>
            <label class="input-label">🍲 খাবারের নাম (Item Name):</label>
            <input type="text" id="spec-item-name" class="input-field" placeholder="e.g. মাটন বিরিয়ানি বা স্পেশাল খিচুড়ি" required>
            
            <label class="input-label">🔢 পরিমাণ (কত প্লেট / জন):</label>
            <input type="number" id="spec-item-qty" class="input-field" value="2" min="1" required>

            <label class="input-label">💬 রান্নার বিবরণ / নির্দেশিকা (Description):</label>
            <textarea id="spec-item-desc" class="input-field" rows="2" placeholder="ঝাল কেমন হবে বা বিশেষ কোনো উপাদান..."></textarea>

            <button type="submit" class="btn-primary" style="margin-top:10px;">রিকুয়েস্ট জমা দিন</button>
          </form>
          <div style="margin-top:20px;">
            <h4 style="color:var(--gold-bright); margin-bottom:8px;">📦 আপনার রিকুয়েস্ট তালিকা ও স্ট্যাটাস</h4>
            <div id="user-special-requests-list"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalDiv);
  }

  if (!document.getElementById('special-payment-modal')) {
    const payModal = document.createElement('div');
    payModal.id = 'special-payment-modal';
    payModal.className = 'modal';
    payModal.innerHTML = `
      <div class="modal-content" style="max-width:420px; text-align:center;">
        <div class="modal-header">
          <h3 style="color:var(--gold-bright);">💳 পেমেন্ট ও অর্ডার কনফার্ম</h3>
          <button class="close-btn" onclick="closeModal('special-payment-modal')">&times;</button>
        </div>
        <p style="margin-bottom:8px;">নির্ধারিত মোট মূল্য: <b style="color:var(--gold-bright); font-size:1.2rem;">₹<span id="spec-pay-amount">0</span></b></p>
        <div class="qr-box" style="background:#fff; padding:10px; border-radius:10px; margin-bottom:10px; display:inline-block;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=8017969203@ybl%26pn=Aswadan%26cu=INR" alt="QR">
          <p style="color:#111; font-weight:bold; margin-top:4px; font-size:0.8rem;">UPI: 8017969203@ybl</p>
        </div>
        
        <label class="input-label" style="text-align:left;">📅 ডেলিভারির তারিখ:</label>
        <input type="date" id="spec-delivery-date" class="input-field" style="margin-bottom:10px;">

        <label class="input-label" style="text-align:left;">🖼️ পেমেন্ট স্ক্রিনশট আপলোড করুন:</label>
        <input type="file" id="spec-payment-screenshot-input" accept="image/*" class="input-field" onchange="handleSpecScreenshotUpload(event)" style="margin-bottom:8px;">
        <img id="spec-screenshot-preview" src="" alt="Preview" style="max-width:140px; border-radius:8px; display:none; margin:0 auto 10px auto; border:1px solid var(--border-gold);">

        <button class="btn-primary" onclick="confirmSpecialPayment()">অর্ডার নিশ্চিত করুন</button>
      </div>
    `;
    document.body.appendChild(payModal);
  }
}

async function confirmAndDeleteUserHistory() {
  if (!currentUser || !currentUser.phone) return;
  
  const userConfirmed = confirm('⚠️ আপনি কি নিশ্চিত যে আপনার সমস্ত অর্ডার হিস্ট্রি এবং স্পেশাল অর্ডার রিকুয়েস্ট স্থায়ীভাবে মুছে ফেলতে চান? এই কাজটি আর ফিরিয়ে আনা যাবে না।');
  if (!userConfirmed) return;

  try {
    const res = await fetch('/api/user/delete-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentUser.phone })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      closeModal('user-dashboard-modal');
    } else {
      alert(data.message || 'ডেটা ডিলিট করতে সমস্যা হয়েছে।');
    }
  } catch (err) {
    console.error(err);
    alert('সার্ভার ত্রুটি!');
  }
}

async function checkSpecialRequestNotificationBadge() {
  if (!currentUser || !currentUser.phone) return;
  try {
    const res = await fetch(`/api/special-request/user/${currentUser.phone}`);
    const data = await res.json();
    if (data.success && data.requests) {
      const seenIds = JSON.parse(localStorage.getItem(`aswadan_seen_specs_${currentUser.phone}`) || '[]');
      const unseenActioned = data.requests.some(r => (r.status === 'PRICED' || r.status === 'REJECTED') && !seenIds.includes(r.requestId));
      
      const dropdownBadge = document.getElementById('dropdown-spec-badge');
      const modalBadge = document.getElementById('modal-spec-badge');
      
      if (dropdownBadge) dropdownBadge.style.display = unseenActioned ? 'inline-block' : 'none';
      if (modalBadge) modalBadge.style.display = unseenActioned ? 'inline-block' : 'none';
    }
  } catch (err) {
    console.error(err);
  }
}

function handleSpecScreenshotUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      specPaymentScreenshotBase64 = e.target.result;
      const preview = document.getElementById('spec-screenshot-preview');
      if (preview) {
        preview.src = specPaymentScreenshotBase64;
        preview.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  }
}

// --- USER DASHBOARD FUNCTIONS ---
function openUserDashboard(tab) {
  const m = document.getElementById('user-dashboard-modal');
  if (m) m.style.display = 'flex';
  switchDashboardTab(tab || 'profile');
  loadUserProfileData();
}

function switchDashboardTab(tab) {
  ['profile', 'history', 'status', 'preferred', 'special'].forEach(t => {
    const view = document.getElementById(`dash-view-${t}`);
    const btn = document.getElementById(`btn-tab-${t}`);
    if (view) view.style.display = (t === tab) ? 'block' : 'none';
    if (btn) {
      if (t === 'special') {
        btn.style.background = (tab === tab) ? 'var(--gold-gradient)' : 'rgba(229,193,88,0.1)';
        btn.style.color = (tab === tab) ? '#000' : 'var(--gold-bright)';
      } else {
        btn.classList.toggle('active', t === tab);
      }
    }
  });

  if (tab === 'history') loadUserOrderHistory();
  if (tab === 'status') loadUserOrderStatus();
  if (tab === 'preferred') loadPreferredMenuSelection();
  if (tab === 'special') loadUserSpecialRequests();
}

function loadUserProfileData() {
  if (!currentUser) return;
  document.getElementById('prof-name').value = currentUser.name || '';
  document.getElementById('prof-phone').value = currentUser.phone || '';
  document.getElementById('prof-email').value = currentUser.email || '';
  document.getElementById('prof-address').value = currentUser.address || '';
  document.getElementById('prof-pincode').value = currentUser.pincode || '700036';
}

async function saveUserProfile() {
  const name = document.getElementById('prof-name').value.trim();
  const email = document.getElementById('prof-email').value.trim();
  const address = document.getElementById('prof-address').value.trim();
  const pincode = document.getElementById('prof-pincode').value.trim();

  try {
    const res = await fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentUser.phone, name, email, address, pincode })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('aswadan_user', JSON.stringify(currentUser));
      showToast('প্রোফাইল আপডেট হয়েছে!');
      updateAuthNavUI();
    }
  } catch (err) { alert('সার্ভার ত্রুটি!'); }
}

async function loadUserOrderHistory() {
  if (!currentUser) return;
  const res = await fetch(`/api/orders/user/${currentUser.phone}`);
  const data = await res.json();
  const container = document.getElementById('user-orders-history-list');
  if (container && data.success) {
    container.innerHTML = data.orders.length === 0 ? '<p style="color:#aaa;">কোনো ইতিহাস নেই।</p>' : data.orders.map(o => `
      <div style="background:#181824; border:1px solid var(--border-gold); padding:10px; border-radius:8px; margin-bottom:8px;">
        <strong>#${o.orderId}</strong> - ${o.status} (₹${o.totalAmount})
      </div>
    `).join('');
  }
}

async function loadUserOrderStatus() {
  if (!currentUser) return;
  const res = await fetch(`/api/orders/user/${currentUser.phone}`);
  const data = await res.json();
  const container = document.getElementById('current-orders-status-list');
  if (container && data.success) {
    const active = data.orders.filter(o => o.status === 'PENDING' || o.status === 'ACCEPTED');
    container.innerHTML = active.length === 0 ? '<p style="color:#aaa;">কোনো সক্রিয় অর্ডার নেই।</p>' : active.map(o => `
      <div style="background:#181824; border:1px solid var(--border-gold); padding:10px; border-radius:8px; margin-bottom:8px;">
        <strong>#${o.orderId}</strong> - <span style="color:#2a9d8f;">${o.status}</span>
      </div>
    `).join('');
  }
}

async function loadPreferredMenuSelection() {
  const container = document.getElementById('preferred-selection-list');
  if (!container) return;
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();
    if (data.success) {
      const pref = currentUser && currentUser.preferredItems ? currentUser.preferredItems : [];
      container.innerHTML = data.menu.map(m => `
        <label style="display:flex; align-items:center; gap:10px; background:#181824; padding:8px 12px; border-radius:8px; margin-bottom:6px; cursor:pointer;">
          <input type="checkbox" value="${m.id}" ${pref.includes(m.id) ? 'checked' : ''} class="pref-chk" style="width:18px; height:18px;">
          <span style="color:#fff; font-size:0.9rem;">${m.name} (₹${m.price})</span>
        </label>
      `).join('') + `<button class="btn-primary" onclick="savePreferredMenu()" style="margin-top:10px;">সেভ প্রেফার্ড মেনু</button>`;
    }
  } catch (err) { console.error(err); }
}

async function savePreferredMenu() {
  if (!currentUser) return;
  const checkboxes = document.querySelectorAll('.pref-chk:checked');
  const preferredItems = Array.from(checkboxes).map(chk => Number(chk.value));
  try {
    const res = await fetch('/api/user/preferred-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentUser.phone, preferredItems })
    });
    const data = await res.json();
    if (data.success) {
      currentUser.preferredItems = data.preferredItems;
      localStorage.setItem('aswadan_user', JSON.stringify(currentUser));
      showToast('প্রেফার্ড মেনু সেভ হয়েছে!');
    }
  } catch (err) { alert('সার্ভার ত্রুটি!'); }
}

async function submitSpecialFoodRequest(e) {
  e.preventDefault();
  if (!currentUser) { openAuthModal(); return; }

  const itemName = document.getElementById('spec-item-name').value.trim();
  const qty = document.getElementById('spec-item-qty').value;
  const description = document.getElementById('spec-item-desc').value.trim();

  try {
    const res = await fetch('/api/special-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentUser.phone, customerName: currentUser.name, email: currentUser.email, itemName, description, qty })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      document.getElementById('special-request-form').reset();
      loadUserSpecialRequests();
    } else {
      alert(data.message);
    }
  } catch (err) { alert('সার্ভার ত্রুটি!'); }
}

async function loadUserSpecialRequests() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/special-request/user/${currentUser.phone}`);
    const data = await res.json();
    const container = document.getElementById('user-special-requests-list');
    if (container && data.success) {
      const actionedRequests = data.requests.filter(r => r.status === 'PRICED' || r.status === 'REJECTED');
      if (actionedRequests.length > 0) {
        const seenIds = JSON.parse(localStorage.getItem(`aswadan_seen_specs_${currentUser.phone}`) || '[]');
        actionedRequests.forEach(r => {
          if (!seenIds.includes(r.requestId)) seenIds.push(r.requestId);
        });
        localStorage.setItem(`aswadan_seen_specs_${currentUser.phone}`, JSON.stringify(seenIds));
        checkSpecialRequestNotificationBadge();
      }

      container.innerHTML = data.requests.length === 0 ? '<p style="color:#aaa; text-align:center;">কোনো রিকুয়েস্ট নেই।</p>' : data.requests.map(r => `
        <div style="background:#181824; border:1px solid var(--border-gold); padding:12px; border-radius:8px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between;">
            <strong style="color:var(--gold-bright);">${r.itemName} (${r.qty} প্লেট)</strong>
            <span style="color:${r.status==='PRICED'?'#2a9d8f':r.status==='REJECTED'?'#e63946':'#ffb703'}; font-weight:bold;">${r.status}</span>
          </div>
          <p style="font-size:0.85rem; color:#ccc; margin-top:4px;">${r.description || ''}</p>
          ${r.status === 'REJECTED' ? `
            <p style="color:#e63946; font-weight:bold; margin-top:5px;">বাতিলের কারণ: ${r.rejectionReason || 'প্রশাসনিক সিদ্ধান্ত'}</p>
          ` : ''}
          ${r.status === 'PRICED' ? `
            <p style="color:var(--gold-bright); font-weight:bold; margin-top:5px;">মূল্য: ₹${r.totalAmount}</p>
            <button onclick="openSpecialPaymentModal('${r.requestId}', ${r.totalAmount})" style="background:var(--green-accent); color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold; margin-top:6px;">💳 পেমেন্ট ও স্ক্রিনশট দিন</button>
          ` : ''}
        </div>
      `).join('');
    }
  } catch (err) { console.error(err); }
}

let activeSpecialReqId = null;
function openSpecialPaymentModal(requestId, totalAmount) {
  activeSpecialReqId = requestId;
  specPaymentScreenshotBase64 = '';
  document.getElementById('spec-pay-amount').innerText = totalAmount;
  document.getElementById('spec-screenshot-preview').style.display = 'none';
  document.getElementById('spec-payment-screenshot-input').value = '';
  document.getElementById('special-payment-modal').style.display = 'flex';
}

async function confirmSpecialPayment() {
  const deliveryDate = document.getElementById('spec-delivery-date').value;
  if (!deliveryDate) return alert('ডেলিভারি তারিখ দিন।');
  if (!specPaymentScreenshotBase64) return alert('পেমেন্ট স্ক্রিনশট আপলোড করুন।');

  try {
    const res = await fetch('/api/special-request/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: activeSpecialReqId,
        paymentScreenshot: specPaymentScreenshotBase64,
        deliveryDate
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      document.getElementById('special-payment-modal').style.display = 'none';
      loadUserSpecialRequests();
    } else {
      alert(data.message);
    }
  } catch (err) { alert('পেমেন্ট সাবমিট করতে ত্রুটি হয়েছে।'); }
}

// --- CART MANAGEMENT ---
function addToCart(id, name, price, desc) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, price, desc, qty: 1 });
  }
  updateCartCount();
  showToast('🛒 কার্টে যোগ করা হয়েছে!');
}

function openCartModal() {
  injectCartModalIfNeeded();
  const m = document.getElementById('cart-modal');
  if (m) m.style.display = 'flex';
  renderCartItems();
  const step1 = document.getElementById('cart-step-1');
  const step2 = document.getElementById('cart-step-2');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';
}

function renderCartItems() {
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const noticeEl = document.getElementById('min-order-notice');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:#aaa; padding:20px;">আপনার কার্ট খালি আছে।</p>`;
    if (totalEl) totalEl.innerText = '0';
    if (noticeEl) noticeEl.style.display = 'none';
    return;
  }

  let total = 0;
  let totalQty = cart.reduce((sum, i) => sum + i.qty, 0);

  container.innerHTML = cart.map(item => {
    total += item.price * item.qty;
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#1c1c28; padding:10px; border-radius:8px; margin-bottom:8px;">
        <div>
          <strong style="color:var(--gold-bright); font-size:0.9rem;">${item.name}</strong><br>
          <small style="color:#aaa;">₹${item.price} x ${item.qty}</small>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <button onclick="changeQty(${item.id}, -1)" style="background:#333; color:#fff; border:none; width:26px; height:26px; border-radius:4px; cursor:pointer;">-</button>
          <span style="font-weight:bold; width:20px; text-align:center;">${item.qty}</span>
          <button onclick="changeQty(${item.id}, 1)" style="background:var(--gold-gradient); color:#000; border:none; width:26px; height:26px; border-radius:4px; cursor:pointer; font-weight:bold;">+</button>
        </div>
      </div>
    `;
  }).join('');

  if (totalEl) totalEl.innerText = total;
  if (noticeEl) noticeEl.style.display = (totalQty < 2) ? 'block' : 'none';
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  }
  updateCartCount();
  renderCartItems();
}

function proceedToPaymentStep() {
  let totalQty = cart.reduce((sum, i) => sum + i.qty, 0);
  if (totalQty < 2) {
    alert('⚠️ আমাদের সর্বনিম্ন অর্ডার ২ টি থালি / প্লেট।');
    return;
  }
  if (!currentUser || !currentUser.phone) {
    alert('অর্ডার করতে অনুগ্রহ করে লগইন করুন।');
    closeModal('cart-modal');
    openAuthModal();
    return;
  }
  document.getElementById('cart-step-1').style.display = 'none';
  document.getElementById('cart-step-2').style.display = 'block';
}

function backToCartStep() {
  document.getElementById('cart-step-1').style.display = 'block';
  document.getElementById('cart-step-2').style.display = 'none';
}

function handlePaymentScreenshotUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      paymentScreenshotBase64 = e.target.result;
      const preview = document.getElementById('payment-screenshot-preview');
      if (preview) { preview.src = paymentScreenshotBase64; preview.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
  }
}

async function placeOrder() {
  const deliveryDate = document.getElementById('delivery-date').value;
  if (!deliveryDate) return alert('তারিখ সিলেক্ট করুন।');
  
  if (!paymentScreenshotBase64) {
    return alert('⚠️ পেমেন্ট সম্পন্ন করে স্ক্রিনশট আপলোড করা বাধ্যতামূলক!');
  }

  const totalAmount = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: currentUser.phone,
        customerName: currentUser.name,
        email: currentUser.email,
        address: currentUser.address,
        location: currentUser.location || '',
        items: cart,
        totalAmount,
        paymentScreenshot: paymentScreenshotBase64,
        deliveryDate
      })
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 অর্ডার #${data.order.orderId} সফলভাবে জমা হয়েছে!`);
      cart = [];
      paymentScreenshotBase64 = '';
      updateCartCount();
      closeModal('cart-modal');
      location.href = 'index.html';
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('অর্ডার প্লেস করতে সমস্যা হয়েছে।');
  }
}

// --- HOME SPOTLIGHT WITH HORIZONTAL SIDE-BY-SIDE SLIDING ANIMATION ---
async function loadHomeSpotlight() {
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();
    if (data.success && data.menu.length > 0) {
      const menu = data.menu;
      let currentIndex = 0;
      const slidingCard = document.getElementById('hero-sliding-tile');
      
      function getFoodIcon(name) {
        let n = name.toLowerCase();
        if (n.includes('fish') || n.includes('রুই') || n.includes('কাতলা')) return '🐟';
        if (n.includes('chicken') || n.includes('চিকেন')) return '🍗';
        if (n.includes('egg') || n.includes('ডিম')) return '🥚';
        return '🍲';
      }

      function renderSpotlight(idx) {
        if (!slidingCard) return;
        const item = menu[idx];
        const icon = getFoodIcon(item.name);
        
        slidingCard.classList.remove('slide-in-right');
        slidingCard.classList.add('slide-out-left');

        setTimeout(() => {
          slidingCard.innerHTML = `
            <div style="font-size:2.2rem; margin-bottom:6px;">${icon}</div>
            <h3 class="tile-title">${item.name}</h3>
            <p class="tile-desc">${item.desc}</p>
            <div class="tile-bottom">
              <span class="tile-price">₹${item.price}</span>
              <button class="btn-add-tile" onclick="addToCart(${item.id}, '${item.name}', ${item.price}, '${item.desc}')">+ Add to Cart</button>
            </div>
          `;
          slidingCard.classList.remove('slide-out-left');
          slidingCard.classList.add('slide-in-right');
        }, 350);
      }

      renderSpotlight(currentIndex);
      setInterval(() => {
        if (slidingCard) {
          currentIndex = (currentIndex + 1) % menu.length;
          renderSpotlight(currentIndex);
        }
      }, 4500);

      const gridContainer = document.getElementById('home-spotlight-container');
      if (gridContainer) {
        gridContainer.innerHTML = menu.slice(0, 4).map(item => `
          <div class="tile-card">
            <div>
              <div style="font-size:1.8rem; margin-bottom:4px;">${getFoodIcon(item.name)}</div>
              <h3 class="tile-title">${item.name}</h3>
              <p class="tile-desc">${item.desc}</p>
            </div>
            <div class="tile-bottom">
              <span class="tile-price">₹${item.price}</span>
              <button class="btn-add-tile" onclick="addToCart(${item.id}, '${item.name}', ${item.price}, '${item.desc}')">+ Add</button>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) { console.error(err); }
}

// --- PWA INSTALL PROMPT FIX FOR MOBILE DEVICES ---
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.style.display = 'flex';
  }
});

function triggerPWAInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      deferredPrompt = null;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'none';
    });
  } else {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      alert('আইওএস (iOS) ব্রাউজারে অ্যাপ ইন্সটল করতে সাফারি মেনু থেকে শেয়ার (Share) আইকনে ক্লিক করে "Add to Home Screen" সিলেক্ট করুন।');
    } else {
      alert('আপনার ব্রাউজার মেনু (তিনটি ডট) থেকে "Add to Home Screen" বা "Install App" অপশনটি সিলেক্ট করুন।');
    }
  }
}

window.addEventListener('appinstalled', (evt) => {
  console.log('Aswadan PWA was installed successfully');
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
});