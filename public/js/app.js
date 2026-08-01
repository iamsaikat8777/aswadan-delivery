// --- GLOBAL AUTO-INJECTED LANGUAGE SWITCHER AT THE END OF NAVBAR ---
(function() {
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

    const navBar = document.querySelector('.top-nav-bar');
    if (navBar && !document.getElementById('global-lang-btn-box')) {
      const langBtn = document.createElement('button');
      langBtn.id = 'global-lang-btn-box';
      langBtn.className = 'auto-lang-btn-inline';
      langBtn.innerHTML = `🌐 <span id="global-lang-label">${window.currentLang === 'bn' ? 'English' : 'বাংলা'}</span>`;
      langBtn.onclick = window.toggleGlobalLanguage;
      navBar.appendChild(langBtn);
    }
  });
})();

// --- MOBILE LOADING OVERLAY HELPERS ---
function injectLoadingOverlayIfNeeded() {
  if (!document.getElementById('mobile-loading-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'mobile-loading-overlay';
    overlay.innerHTML = `
      <div class="spinner-box">
        <div class="spinner-ring"></div>
        <p style="color:var(--gold-bright); font-weight:bold; font-size:0.95rem;">অনুগ্রহ করে অপেক্ষা করুন... ⏳</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }
}

function showMobileLoading() {
  if (window.innerWidth <= 768) {
    injectLoadingOverlayIfNeeded();
    const overlay = document.getElementById('mobile-loading-overlay');
    if (overlay) overlay.style.display = 'flex';
  }
}

function hideMobileLoading() {
  const overlay = document.getElementById('mobile-loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

// --- STRICT DD/MM/YYYY FORMATTER ---
function formatDateDDMMYYYY(dateInput) {
  if (!dateInput) return '';
  let str = String(dateInput).split('T')[0].trim();
  if (str.includes('-')) {
    const p = str.split('-');
    if (p.length === 3) {
      return `${p[2]}/${p[1]}/${p[0]}`;
    }
  }
  return dateInput;
}

// --- CART & APP CORE LOGIC ---
let cart = JSON.parse(localStorage.getItem('aswadan_cart') || '[]');
let currentUser = JSON.parse(localStorage.getItem('aswadan_user') || localStorage.getItem('currentUser') || 'null');
let paymentScreenshotBase64 = '';
let specPaymentScreenshotBase64 = '';
let isOrderSubmitting = false;
let userSpecialRequestsCache = [];

window.addEventListener('DOMContentLoaded', () => {
  updateCartCount();
  updateAuthNavUI();
  loadHomeSpotlight();
  checkPWAInstallPrompt();
  injectUserDashboardModalIfNeeded();
  injectCartModalIfNeeded();
  checkSpecialRequestNotificationBadge();
  setupGlobalAuthModalFix();
  injectLeafletDependencies();
});

function injectLeafletDependencies() {
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  if (!document.getElementById('leaflet-js')) {
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    document.head.appendChild(script);
  }
}

function updateCartCount() {
  const countEl = document.getElementById('cart-count');
  if (countEl) {
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    countEl.innerText = totalQty;
  }
  localStorage.setItem('aswadan_cart', JSON.stringify(cart));
}

// --- STRICT LOGIN STATE NAVBAR & FIXED MOBILE DROPDOWN TOGGLE ---
function updateAuthNavUI() {
  const btn = document.getElementById('profile-nav-btn');
  const wrapper = document.getElementById('user-nav-wrapper');
  const dropdownMenu = document.getElementById('user-hover-menu');

  if (currentUser && currentUser.phone) {
    if (btn) {
      btn.innerText = `👤 ${currentUser.name ? currentUser.name.split(' ')[0] : 'Account'}`;
      btn.onclick = toggleUserDropdown;
    }
    if (wrapper) {
      wrapper.style.pointerEvents = 'auto';
      wrapper.style.position = 'relative';
    }
    if (dropdownMenu) {
      dropdownMenu.style.position = 'absolute';
      dropdownMenu.style.right = '0';
      dropdownMenu.style.top = '100%';
    }
    injectUserDashboardModalIfNeeded();
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
  injectUserDashboardModalIfNeeded();
  const wrapper = document.getElementById('user-nav-wrapper');
  if (wrapper) {
    wrapper.classList.toggle('active-dropdown');
  }
}

window.addEventListener('click', (e) => {
  const wrapper = document.getElementById('user-nav-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    wrapper.classList.remove('active-dropdown');
  }
});

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast-msg');
  if (!toast) return;

  toast.innerText = msg;
  toast.style.position = 'fixed';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.classList.add('show');
  
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.style.display = 'none';
}

function openAuthModal() {
  setupGlobalAuthModalFix();
  const m = document.getElementById('auth-modal');
  if (m) {
    m.style.display = 'flex';
    switchAuthTab('login');
  }
}

// --- SVG EYE ICONS FOR PASSWORD TOGGLE ---
const svgEyeOpen = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const svgEyeClosed = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

// --- FULLY RESTORED AUTH MODAL WITH INDEPENDENT GPS & INTERACTIVE LEAFLET MAP ---
function setupGlobalAuthModalFix() {
  let modal = document.getElementById('auth-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 480px;">
      <div class="modal-header">
        <h3 style="color:var(--gold-bright);">🔑 অ্যাকাউন্ট (Account)</h3>
        <button class="close-btn" onclick="closeModal('auth-modal')">&times;</button>
      </div>
      
      <div style="display:flex; gap:10px; margin-bottom:18px;">
        <button type="button" id="tab-btn-login" onclick="switchAuthTab('login')" style="flex:1; padding:10px; border-radius:8px; border:1px solid var(--border-gold); background:var(--gold-gradient); color:#000; font-weight:bold; cursor:pointer;">লগইন</button>
        <button type="button" id="tab-btn-signup" onclick="switchAuthTab('signup')" style="flex:1; padding:10px; border-radius:8px; border:1px solid var(--border-gold); background:#1c1c28; color:var(--text-main); font-weight:bold; cursor:pointer;">নতুন সাইন-আপ</button>
      </div>

      <!-- LOGIN FORM -->
      <div id="login-form">
        <label class="input-label">📱 মোবাইল নম্বর / ইমেল আইডি:</label>
        <input type="text" id="login-identifier" class="input-field" placeholder="Mobile Number or Email ID" style="margin-bottom:12px;">
        
        <label class="input-label">🔑 পাসওয়ার্ড:</label>
        <div style="position:relative; margin-bottom:15px;">
          <input type="password" id="login-password" class="input-field" placeholder="Enter Password" style="padding-right:45px;">
          <span onclick="togglePasswordVisibility('login-password', 'login-eye-icon')" id="login-eye-icon" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); cursor:pointer; color:#a0a0b0; display:flex; align-items:center;">${svgEyeOpen}</span>
        </div>

        <button type="button" class="btn-primary" onclick="loginUser()">লগইন করুন</button>
      </div>

      <!-- SIGNUP FORM -->
      <div id="signup-form" style="display:none;">
        <label class="input-label">👤 নাম:</label>
        <input type="text" id="signup-name" class="input-field" placeholder="Full Name" style="margin-bottom:8px;">
        
        <label class="input-label">📱 মোবাইল নম্বর:</label>
        <input type="tel" id="signup-phone" class="input-field" placeholder="Mobile Number" style="margin-bottom:8px;">
        
        <label class="input-label">📧 ইমেল:</label>
        <input type="email" id="signup-email" class="input-field" placeholder="Email Address" style="margin-bottom:8px;">
        
        <label class="input-label">🔑 পাসওয়ার্ড:</label>
        <div style="position:relative; margin-bottom:8px;">
          <input type="password" id="signup-password" class="input-field" placeholder="Create Password" style="padding-right:45px;">
          <span onclick="togglePasswordVisibility('signup-password', 'signup-eye-icon')" id="signup-eye-icon" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); cursor:pointer; color:#a0a0b0; display:flex; align-items:center;">${svgEyeOpen}</span>
        </div>

        <label class="input-label">🏠 ঠিকানা (নিজের মতো করে লিখুন):</label>
        <textarea id="signup-address" class="input-field" rows="2" placeholder="Type your address here..." style="margin-bottom:8px;"></textarea>

        <!-- INDEPENDENT GPS & INTERACTIVE MAP BUTTONS -->
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <button type="button" onclick="fetchUserCurrentLocationGPS()" style="flex:1; background:rgba(42,157,143,0.2); border:1px solid var(--green-accent); color:#4ade80; padding:8px; border-radius:6px; font-weight:bold; font-size:0.8rem; cursor:pointer;">📍 Get GPS Location</button>
          <button type="button" onclick="openMapLocationPickerModal()" style="flex:1; background:rgba(212,175,55,0.15); border:1px solid var(--border-gold); color:var(--gold-bright); padding:8px; border-radius:6px; font-weight:bold; font-size:0.8rem; cursor:pointer;">🗺️ Set from Map</button>
        </div>
        <div id="location-status-badge" style="font-size:0.8rem; color:#4ade80; margin-bottom:8px; display:none;"></div>
        <input type="hidden" id="signup-location" value="Kolkata">
        <input type="hidden" id="signup-lat" value="">
        <input type="hidden" id="signup-lng" value="">

        <label class="input-label">📍 পিনকোড:</label>
        <input type="text" id="signup-pincode" class="input-field" value="700036" style="margin-bottom:15px;">

        <button type="button" class="btn-primary" onclick="signupUser()">সাইন-আপ সম্পন্ন করুন</button>
      </div>
    </div>
  `;

  // Inject Interactive Leaflet Map Modal Picker
  if (!document.getElementById('map-picker-modal')) {
    const mapModal = document.createElement('div');
    mapModal.id = 'map-picker-modal';
    mapModal.className = 'modal';
    mapModal.innerHTML = `
      <div class="modal-content" style="max-width:480px; text-align:center;">
        <div class="modal-header">
          <h3 style="color:var(--gold-bright);">🗺️ Tap & Drop Pin on Map</h3>
          <button class="close-btn" onclick="closeModal('map-picker-modal')">&times;</button>
        </div>
        <p style="font-size:0.85rem; color:#aaa; margin-bottom:10px;">সঠিক স্থানে পিন বসাতে ম্যাপের যেকোনো জায়গায় ট্যাপ বা ক্লিক করুন (পিনটি ড্র্যাগও করতে পারেন):</p>
        
        <!-- Fully Interactive Leaflet Map Container -->
        <div id="interactive-leaflet-map" style="width:100%; height:260px; border-radius:10px; border:1px solid var(--border-gold); margin-bottom:12px; z-index:1;"></div>

        <input type="text" id="map-selected-coords-desc" class="input-field" placeholder="Selected Pin Coordinates..." readonly style="margin-bottom:12px; background:#181824; font-size:0.85rem !important;">

        <div style="display:flex; gap:10px;">
          <button class="btn-primary" onclick="confirmMapLocationSelection()" style="margin:0; background:var(--green-accent); color:#fff;">লোকেশন নিশ্চিত করুন</button>
          <button onclick="closeModal('map-picker-modal')" style="flex:1; background:#333; border:none; border-radius:8px; color:#fff; cursor:pointer; font-weight:bold;">বাতিল</button>
        </div>
      </div>
    `;
    document.body.appendChild(mapModal);
  }
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const btnLogin = document.getElementById('tab-btn-login');
  const btnSignup = document.getElementById('tab-btn-signup');

  if (loginForm && signupForm && btnLogin && btnSignup) {
    if (tab === 'login') {
      loginForm.style.display = 'block';
      signupForm.style.display = 'none';
      btnLogin.style.background = 'var(--gold-gradient)';
      btnLogin.style.color = '#000';
      btnSignup.style.background = '#1c1c28';
      btnSignup.style.color = 'var(--text-main)';
    } else {
      loginForm.style.display = 'none';
      signupForm.style.display = 'block';
      btnSignup.style.background = 'var(--gold-gradient)';
      btnSignup.style.color = '#000';
      btnLogin.style.background = '#1c1c28';
      btnLogin.style.color = 'var(--text-main)';
    }
  }
}

// --- PASSWORD EYE TOGGLE ---
function togglePasswordVisibility(fieldId, iconId) {
  const field = document.getElementById(fieldId);
  const icon = document.getElementById(iconId);
  if (field && icon) {
    if (field.type === 'password') {
      field.type = 'text';
      icon.innerHTML = svgEyeClosed;
    } else {
      field.type = 'password';
      icon.innerHTML = svgEyeOpen;
    }
  }
}

// --- GPS LOCATION VERIFICATION ---
function fetchUserCurrentLocationGPS() {
  if (navigator.geolocation) {
    showMobileLoading();
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      hideMobileLoading();
      
      document.getElementById('signup-lat').value = lat;
      document.getElementById('signup-lng').value = lon;
      
      const badge = document.getElementById('location-status-badge');
      if (badge) {
        badge.style.display = 'block';
        badge.innerText = `✅ GPS Verified (Lat: ${lat.toFixed(3)}, Lng: ${lon.toFixed(3)})`;
      }
      showToast('GPS লোকেশন সফলভাবে কনফার্ম হয়েছে!');
    }, () => {
      hideMobileLoading();
      alert('লোকেশন পার্মিশন দেওয়া হয়নি।');
    });
  } else {
    alert('আপনার ব্রাউজার জিওলোকেশন সাপোর্ট করে না।');
  }
}

// --- INTERACTIVE LEAFLET MAP PICKER LOGIC ---
let activeLeafletMap = null;
let activeLeafletMarker = null;

function openMapLocationPickerModal() {
  const m = document.getElementById('map-picker-modal');
  if (m) {
    m.style.display = 'flex';
    setTimeout(() => {
      let initLat = parseFloat(document.getElementById('signup-lat').value) || 22.5726;
      let initLng = parseFloat(document.getElementById('signup-lng').value) || 88.3639;
      initInteractiveLeafletMap(initLat, initLng);
    }, 250);
  }
}

function initInteractiveLeafletMap(lat, lng) {
  if (!window.L) {
    setTimeout(() => initInteractiveLeafletMap(lat, lng), 300);
    return;
  }

  const container = document.getElementById('interactive-leaflet-map');
  if (!container) return;

  if (!activeLeafletMap) {
    activeLeafletMap = L.map('interactive-leaflet-map').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(activeLeafletMap);

    activeLeafletMarker = L.marker([lat, lng], { draggable: true }).addTo(activeLeafletMap);

    activeLeafletMarker.on('dragend', function(e) {
      const pos = activeLeafletMarker.getLatLng();
      updateMapSelectionCoords(pos.lat, pos.lng);
    });

    activeLeafletMap.on('click', function(e) {
      activeLeafletMarker.setLatLng(e.latlng);
      updateMapSelectionCoords(e.latlng.lat, e.latlng.lng);
    });
  } else {
    activeLeafletMap.setView([lat, lng], 15);
    activeLeafletMarker.setLatLng([lat, lng]);
    setTimeout(() => { activeLeafletMap.invalidateSize(); }, 150);
  }
  updateMapSelectionCoords(lat, lng);
}

function updateMapSelectionCoords(lat, lng) {
  document.getElementById('signup-lat').value = lat;
  document.getElementById('signup-lng').value = lng;
  document.getElementById('map-selected-coords-desc').value = `Pin Coords: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function confirmMapLocationSelection() {
  const lat = document.getElementById('signup-lat').value;
  const lng = document.getElementById('signup-lng').value;
  const badge = document.getElementById('location-status-badge');
  if (badge) {
    badge.style.display = 'block';
    badge.innerText = `✅ Map Pin Confirmed (${Number(lat).toFixed(3)}, ${Number(lng).toFixed(3)})`;
  }
  closeModal('map-picker-modal');
  showToast('ম্যাপ লোকেশন সফলভাবে সেট হয়েছে!');
}

async function loginUser() {
  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value.trim();
  if (!identifier || !password) return alert('সমস্ত ফিল্ড পূরণ করুন।');

  showMobileLoading();
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    hideMobileLoading();
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
    hideMobileLoading();
    alert('সার্ভার ত্রুটি!');
  }
}

async function signupUser() {
  const name = document.getElementById('signup-name').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value.trim();
  const address = document.getElementById('signup-address').value.trim(); // Manually typed address
  const location = document.getElementById('signup-location').value.trim();
  const lat = document.getElementById('signup-lat').value.trim();
  const lng = document.getElementById('signup-lng').value.trim();
  const pincode = document.getElementById('signup-pincode').value.trim();

  if (!name || !phone || !email || !password || !address || !pincode) {
    return alert('সমস্ত প্রয়োজনীয় ফিল্ড পূরণ করুন (ঠিকানা নিজে লিখুন)।');
  }

  showMobileLoading();
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password, address, location, lat, lng, pincode })
    });
    const data = await res.json();
    hideMobileLoading();
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
    hideMobileLoading();
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

// --- AUTO-INJECT CART MODAL WITH DD/MM/YYYY FORMATTER & COD PAYMENT OPTION ---
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
          
          <label class="input-label">📅 ডেলিভারির তারিখ (DD/MM/YYYY):</label>
          <div style="position:relative;">
            <input type="date" id="delivery-date" class="input-field" style="margin-bottom:12px;" onchange="syncDisplayDate('delivery-date', 'delivery-date-display')">
            <input type="text" id="delivery-date-display" class="input-field" readonly style="position:absolute; top:0; left:0; width:100%; background:#1c1c28; pointer-events:none;" placeholder="DD/MM/YYYY">
          </div>

          <div style="margin-bottom: 12px; background: #1c1c28; padding: 12px; border-radius: 10px; border: 1px solid var(--border-gold);">
            <label style="color:var(--gold-bright); font-weight:bold; font-size:0.9rem; display:block; margin-bottom:8px;">পেমেন্ট পদ্ধতি বাছুন:</label>
            <div style="display:flex; gap:15px;">
              <label style="cursor:pointer; display:flex; align-items:center; gap:6px; color:#fff;">
                <input type="radio" name="payment-method" value="online" checked onchange="togglePaymentMethodUI()"> অনলাইন (UPI/QR)
              </label>
              <label style="cursor:pointer; display:flex; align-items:center; gap:6px; color:#fff;">
                <input type="radio" name="payment-method" value="cod" onchange="togglePaymentMethodUI()"> ক্যাশ অন ডেলিভারি (COD)
              </label>
            </div>
          </div>

          <div id="online-payment-section">
            <div class="qr-box" style="background:#ffffff; padding:15px; border-radius:12px; text-align:center; margin-bottom:12px;">
              <p style="font-weight:800; color:#111 !important; margin-bottom:8px;">Scan QR to Pay</p>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=8017969203@ybl%26pn=Aswadan%26cu=INR" alt="Aswadan UPI QR">
              <p style="margin-top:8px; font-weight:800; color:#111 !important;">UPI ID: <span style="color:#d4af37;">8017969203@ybl</span></p>
            </div>
            <label class="input-label">🖼️ পেমেন্ট স্ক্রিনশট আপলোড করুন:</label>
            <input type="file" id="payment-screenshot-input" accept="image/*" class="input-field" onchange="handlePaymentScreenshotUpload(event)" style="margin-bottom:8px;">
            <img id="payment-screenshot-preview" src="" alt="Preview" style="max-width:180px; border-radius:8px; display:none; margin:8px auto; border:1px solid var(--border-gold);">
          </div>

          <div id="cod-payment-section" style="display:none; background:rgba(42,157,143,0.15); border:1px solid var(--green-accent); padding:12px; border-radius:8px; margin-bottom:12px; text-align:center;">
            <p style="color:#4ade80; font-weight:bold; font-size:0.9rem;">💵 আপনি ক্যাশ অন ডেলিভারি (COD) সিলেক্ট করেছেন। স্ক্রিনশট ছাড়াই অর্ডার কনফার্ম করতে পারেন।</p>
          </div>

          <button id="place-order-btn" class="btn-primary" onclick="placeOrder()">অর্ডার নিশ্চিত করুন</button>
        </div>
      </div>
    `;
    document.body.appendChild(cartModalDiv);
  }
}

function syncDisplayDate(inputId, displayId) {
  const input = document.getElementById(inputId);
  const display = document.getElementById(displayId);
  if (input && display && input.value) {
    display.value = formatDateDDMMYYYY(input.value);
  }
}

function togglePaymentMethodUI() {
  const method = document.querySelector('input[name="payment-method"]:checked').value;
  const onlineSec = document.getElementById('online-payment-section');
  const codSec = document.getElementById('cod-payment-section');
  if (method === 'cod') {
    onlineSec.style.display = 'none';
    codSec.style.display = 'block';
  } else {
    onlineSec.style.display = 'block';
    codSec.style.display = 'none';
  }
}

// --- PERSISTENT USER DASHBOARD & SPECIAL REQUEST LINK FIX ---
function injectUserDashboardModalIfNeeded() {
  const dropdownMenu = document.getElementById('user-hover-menu');
  if (dropdownMenu) {
    if (!document.getElementById('dropdown-special-link')) {
      const specialLink = document.createElement('a');
      specialLink.id = 'dropdown-special-link';
      specialLink.href = 'javascript:void(0)';
      specialLink.onclick = (e) => { e.preventDefault(); openUserDashboard('special'); };
      specialLink.style.cssText = 'color:var(--gold-bright); font-weight:bold; display:flex; justify-content:space-between; align-items:center; cursor:pointer;';
      specialLink.innerHTML = `<span>✨ Special Order Request</span> <span id="dropdown-spec-badge" style="background:#e63946; color:#fff; font-size:0.7rem; padding:1px 6px; border-radius:10px; display:none;">!</span>`;
      
      const logoutBtn = dropdownMenu.querySelector('a[onclick*="logoutUser"]') || dropdownMenu.querySelector('a:last-child');
      if (logoutBtn) {
        dropdownMenu.insertBefore(specialLink, logoutBtn);
      } else {
        dropdownMenu.appendChild(specialLink);
      }
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

  // Inject Smart Refund Modal for Prepaid Order Cancellations with Memory Notification
  if (!document.getElementById('order-cancel-modal')) {
    const cancelModal = document.createElement('div');
    cancelModal.id = 'order-cancel-modal';
    cancelModal.className = 'modal';
    cancelModal.innerHTML = `
      <div class="modal-content" style="max-width:440px;">
        <div class="modal-header">
          <h3 style="color:var(--gold-bright);">💰 রিফান্ড বিবরণ (Refund Details)</h3>
          <button class="close-btn" onclick="closeModal('order-cancel-modal')">&times;</button>
        </div>
        
        <div id="saved-refund-prompt" style="display:none; background:rgba(212,175,55,0.1); border:1px solid var(--border-gold); padding:12px; border-radius:10px; margin-bottom:12px;">
          <p style="font-size:0.88rem; color:var(--gold-bright); margin-bottom:8px;">✨ আপনার পূর্বের সংরক্ষিত রিফান্ড তথ্য পাওয়া গেছে:</p>
          <p id="saved-refund-desc" style="font-size:0.85rem; color:#fff; margin-bottom:10px;"></p>
          <div style="display:flex; gap:10px;">
            <button class="btn-primary" onclick="useSavedRefundInfo()" style="margin:0; padding:8px 12px; font-size:0.85rem; background:var(--green-accent); color:#fff;">পূর্বেরটি ব্যবহার করুন</button>
            <button class="btn-primary" onclick="useNewRefundInfo()" style="margin:0; padding:8px 12px; font-size:0.85rem; background:#333; color:var(--gold-bright); border:1px solid var(--border-gold);">নতুন তথ্য দিন</button>
          </div>
        </div>

        <div id="new-refund-form-container">
          <p style="font-size:0.9rem; color:#aaa; margin-bottom:12px;">রিফান্ড পাওয়ার জন্য মাধ্যম সিলেক্ট করুন:</p>
          <div style="margin-bottom:12px; display:flex; gap:15px;">
            <label style="cursor:pointer; color:#fff;"><input type="radio" name="refund-mode" value="UPI" checked onchange="toggleRefundModeUI()"> UPI ID</label>
            <label style="cursor:pointer; color:#fff;"><input type="radio" name="refund-mode" value="BANK" onchange="toggleRefundModeUI()"> Bank Account</label>
          </div>

          <div id="refund-upi-box">
            <label class="input-label">UPI ID:</label>
            <input type="text" id="refund-upi-input" class="input-field" placeholder="e.g. username@ybl">
          </div>

          <div id="refund-bank-box" style="display:none;">
            <label class="input-label">Account Name:</label>
            <input type="text" id="refund-acc-name" class="input-field" placeholder="Account Holder Name">
            <label class="input-label">Account Number:</label>
            <input type="text" id="refund-acc-num" class="input-field" placeholder="Account Number">
            <label class="input-label">IFSC Code:</label>
            <input type="text" id="refund-ifsc" class="input-field" placeholder="IFSC Code">
            <label class="input-label">Bank Branch:</label>
            <input type="text" id="refund-branch" class="input-field" placeholder="Bank Branch Name">
          </div>
        </div>

        <button class="btn-primary" onclick="submitOrderCancellationWithRefund()" style="margin-top:15px;">অর্ডার ক্যানসেল নিশ্চিত করুন</button>
      </div>
    `;
    document.body.appendChild(cancelModal);
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
        
        <div style="margin-bottom: 12px; background: #1c1c28; padding: 12px; border-radius: 10px; border: 1px solid var(--border-gold);">
          <label style="color:var(--gold-bright); font-weight:bold; font-size:0.9rem; display:block; margin-bottom:8px;">পেমেন্ট পদ্ধতি বাছুন:</label>
          <div style="display:flex; gap:15px;">
            <label style="cursor:pointer; display:flex; align-items:center; gap:6px; color:#fff;">
              <input type="radio" name="spec-payment-method" value="online" checked onchange="toggleSpecPaymentMethodUI()"> অনলাইন (UPI/QR)
            </label>
            <label style="cursor:pointer; display:flex; align-items:center; gap:6px; color:#fff;">
              <input type="radio" name="spec-payment-method" value="cod" onchange="toggleSpecPaymentMethodUI()"> ক্যাশ অন ডেলিভারি (COD)
            </label>
          </div>
        </div>

        <div id="spec-online-payment-section">
          <div class="qr-box" style="background:#ffffff; padding:15px; border-radius:12px; text-align:center; margin-bottom:12px;">
            <p style="font-weight:800; color:#111 !important; margin-bottom:8px;">Scan QR to Pay</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=8017969203@ybl%26pn=Aswadan%26cu=INR" alt="Aswadan UPI QR">
            <p style="margin-top:8px; font-weight:800; color:#111 !important;">UPI ID: <span style="color:#d4af37;">8017969203@ybl</span></p>
          </div>
          <label class="input-label">🖼️ পেমেন্ট স্ক্রিনশট আপলোড করুন:</label>
          <input type="file" id="spec-payment-screenshot-input" accept="image/*" class="input-field" onchange="handleSpecScreenshotUpload(event)" style="margin-bottom:8px;">
          <img id="spec-screenshot-preview" src="" alt="Preview" style="max-width:180px; border-radius:8px; display:none; margin:8px auto; border:1px solid var(--border-gold);">
        </div>

        <div id="spec-cod-payment-section" style="display:none; background:rgba(42,157,143,0.15); border:1px solid var(--green-accent); padding:12px; border-radius:8px; margin-bottom:12px; text-align:center;">
          <p style="color:#4ade80; font-weight:bold; font-size:0.9rem;">💵 আপনি ক্যাশ অন ডেলিভারি (COD) সিলেক্ট করেছেন। স্ক্রিনশট ছাড়াই অর্ডার কনফার্ম করতে পারেন।</p>
        </div>

        <label class="input-label" style="text-align:left;">📅 ডেলিভারির তারিখ:</label>
        <input type="date" id="spec-delivery-date" class="input-field" style="margin-bottom:10px;">

        <button class="btn-primary" onclick="confirmSpecialPayment()">অর্ডার নিশ্চিত করুন</button>
      </div>
    `;
    document.body.appendChild(payModal);
  }
}

function toggleRefundModeUI() {
  const mode = document.querySelector('input[name="refund-mode"]:checked').value;
  document.getElementById('refund-upi-box').style.display = (mode === 'UPI') ? 'block' : 'none';
  document.getElementById('refund-bank-box').style.display = (mode === 'BANK') ? 'block' : 'none';
}

function toggleSpecPaymentMethodUI() {
  const method = document.querySelector('input[name="spec-payment-method"]:checked').value;
  const onlineSec = document.getElementById('spec-online-payment-section');
  const codSec = document.getElementById('spec-cod-payment-section');
  if (method === 'cod') {
    onlineSec.style.display = 'none';
    codSec.style.display = 'block';
  } else {
    onlineSec.style.display = 'block';
    codSec.style.display = 'none';
  }
}

let orderToCancelId = null;
let useSavedRefund = false;

function promptCancelOrder(orderId, isPrepaid) {
  orderToCancelId = orderId;
  useSavedRefund = false;
  
  if (isPrepaid) {
    const savedRefundStr = localStorage.getItem(`aswadan_last_refund_${currentUser.phone}`);
    const promptBox = document.getElementById('saved-refund-prompt');
    const formContainer = document.getElementById('new-refund-form-container');

    if (savedRefundStr) {
      const savedInfo = JSON.parse(savedRefundStr);
      promptBox.style.display = 'block';
      formContainer.style.display = 'none';
      
      let descText = (savedInfo.type === 'UPI') ? `UPI ID: ${savedInfo.upiId}` : `Bank Account: ${savedInfo.accountName} (${savedInfo.accountNumber})`;
      document.getElementById('saved-refund-desc').innerText = descText;
    } else {
      promptBox.style.display = 'none';
      formContainer.style.display = 'block';
      document.getElementById('refund-upi-input').value = '';
      document.getElementById('refund-acc-name').value = '';
      document.getElementById('refund-acc-num').value = '';
      document.getElementById('refund-ifsc').value = '';
      document.getElementById('refund-branch').value = '';
      document.querySelector('input[name="refund-mode"][value="UPI"]').checked = true;
      toggleRefundModeUI();
    }
    document.getElementById('order-cancel-modal').style.display = 'flex';
  } else {
    if (confirm(`আপনি কি নিশ্চিতভাবে অর্ডার #${orderId} ক্যানসেল করতে চান?`)) {
      executeOrderCancellation(orderId, null);
    }
  }
}

function useSavedRefundInfo() {
  useSavedRefund = true;
  const savedRefundStr = localStorage.getItem(`aswadan_last_refund_${currentUser.phone}`);
  if (savedRefundStr) {
    const savedInfo = JSON.parse(savedRefundStr);
    closeModal('order-cancel-modal');
    executeOrderCancellation(orderToCancelId, savedInfo);
  }
}

function useNewRefundInfo() {
  useSavedRefund = false;
  document.getElementById('saved-refund-prompt').style.display = 'none';
  document.getElementById('new-refund-form-container').style.display = 'block';
  document.getElementById('refund-upi-input').value = '';
  document.getElementById('refund-acc-name').value = '';
  document.getElementById('refund-acc-num').value = '';
  document.getElementById('refund-ifsc').value = '';
  document.getElementById('refund-branch').value = '';
  document.querySelector('input[name="refund-mode"][value="UPI"]').checked = true;
  toggleRefundModeUI();
}

async function submitOrderCancellationWithRefund() {
  const mode = document.querySelector('input[name="refund-mode"]:checked').value;
  let refundInfo = { type: mode };
  if (mode === 'UPI') {
    const upiId = document.getElementById('refund-upi-input').value.trim();
    if (!upiId) return alert('সঠিক UPI ID লিখুন।');
    refundInfo.upiId = upiId;
  } else {
    const accName = document.getElementById('refund-acc-name').value.trim();
    const accNum = document.getElementById('refund-acc-num').value.trim();
    const ifsc = document.getElementById('refund-ifsc').value.trim();
    const branch = document.getElementById('refund-branch').value.trim();
    if (!accName || !accNum || !ifsc || !branch) return alert('ব্যাংক অ্যাকাউন্ট সংক্রান্ত সমস্ত ফিল্ড পূরণ করুন।');
    refundInfo.accountName = accName;
    refundInfo.accountNumber = accNum;
    refundInfo.ifsc = ifsc;
    refundInfo.branch = branch;
  }

  localStorage.setItem(`aswadan_last_refund_${currentUser.phone}`, JSON.stringify(refundInfo));

  closeModal('order-cancel-modal');
  await executeOrderCancellation(orderToCancelId, refundInfo);
}

async function executeOrderCancellation(orderId, refundInfo) {
  showMobileLoading();
  try {
    const res = await fetch('/api/orders/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, phone: currentUser.phone, refundInfo })
    });
    const data = await res.json();
    hideMobileLoading();
    if (data.success) {
      showToast(data.message);
      loadUserOrderHistory();
      loadUserOrderStatus();
    } else {
      alert(data.message);
    }
  } catch (err) {
    hideMobileLoading();
    alert('অর্ডার ক্যানসেল করতে সমস্যা হয়েছে।');
  }
}

async function confirmAndDeleteUserHistory() {
  if (!currentUser || !currentUser.phone) return;
  
  const userConfirmed = confirm('⚠️ আপনি কি নিশ্চিত যে আপনার সমস্ত অর্ডার হিস্ট্রি এবং স্পেশাল অর্ডার রিকুয়েস্ট স্থায়ীভাবে মুছে ফেলতে চান? এই কাজটি আর ফিরিয়ে আনা যাবে না।');
  if (!userConfirmed) return;

  showMobileLoading();
  try {
    const res = await fetch('/api/user/delete-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentUser.phone })
    });
    const data = await res.json();
    hideMobileLoading();
    if (data.success) {
      showToast(data.message);
      closeModal('user-dashboard-modal');
    } else {
      alert(data.message || 'ডেটা ডিলিট করতে সমস্যা হয়েছে।');
    }
  } catch (err) {
    hideMobileLoading();
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

// --- USER DASHBOARD FUNCTIONS WITH WORKING DROPDOWN OPTIONS ---
function openUserDashboard(tab) {
  const wrapper = document.getElementById('user-nav-wrapper');
  if (wrapper) wrapper.classList.remove('active-dropdown');

  injectUserDashboardModalIfNeeded();
  const m = document.getElementById('user-dashboard-modal');
  if (m) {
    m.style.display = 'flex';
    switchDashboardTab(tab || 'profile');
    loadUserProfileData();
  }
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

  showMobileLoading();
  try {
    const res = await fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentUser.phone, name, email, address, pincode })
    });
    const data = await res.json();
    hideMobileLoading();
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('aswadan_user', JSON.stringify(currentUser));
      showToast('প্রোফাইল আপডেট হয়েছে!');
      updateAuthNavUI();
    }
  } catch (err) {
    hideMobileLoading();
    alert('সার্ভার ত্রুটি!');
  }
}

function canCancelOrder(order) {
  if (order.status !== 'PENDING') return false;
  let orderDateStr = order.orderDate || new Date().toISOString().split('T')[0];
  let orderDate = new Date(orderDateStr);
  let endOfDay = new Date(orderDate);
  endOfDay.setHours(23, 59, 59, 999);
  return new Date() <= endOfDay;
}

function getRemainingCancelSeconds(orderDateStr) {
  let orderDate = new Date(orderDateStr || new Date().toISOString().split('T')[0]);
  let endOfDay = new Date(orderDate);
  endOfDay.setHours(23, 59, 59, 999);
  let diff = endOfDay - new Date();
  return Math.max(0, Math.floor(diff / 1000));
}

async function loadUserOrderHistory() {
  if (!currentUser) return;
  const res = await fetch(`/api/orders/user/${currentUser.phone}`);
  const data = await res.json();
  const container = document.getElementById('user-orders-history-list');
  if (container && data.success) {
    container.innerHTML = data.orders.length === 0 ? '<p style="color:#aaa;">কোনো ইতিহাস নেই।</p>' : data.orders.map(o => {
      const formattedOrderDate = formatDateDDMMYYYY(o.orderDate || o.createdAt);
      const formattedDelDate = formatDateDDMMYYYY(o.deliveryDate);
      const showCancel = canCancelOrder(o);
      const remSec = getRemainingCancelSeconds(o.orderDate);
      const isPrepaid = o.paymentScreenshot && o.paymentScreenshot !== 'CASH ON DELIVERY';
      
      return `
        <div style="background:#181824; border:1px solid var(--border-gold); padding:12px; border-radius:10px; margin-bottom:10px; position:relative;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:var(--gold-bright);">#${o.orderId}</strong>
            <span style="color:${o.status==='CANCELLED'?'#e63946':o.status==='DELIVERED'?'#2a9d8f':'var(--gold-primary)'}; font-weight:bold;">${o.status}</span>
          </div>
          <p style="font-size:0.85rem; color:#aaa; margin-top:4px;">অর্ডার তারিখ: ${formattedOrderDate} | ডেলিভারি তারিখ: ${formattedDelDate}</p>
          <p style="font-size:0.9rem; margin-top:4px;">মোট মূল্য: <b>₹${o.totalAmount}</b></p>
          
          ${o.status === 'REJECTED' && (o.rejectionReason || o.reason) ? `<p style="color:#e63946; margin-top:6px;"><b>বাতিলের কারণ:</b> ${o.rejectionReason || o.reason}</p>` : ''}

          ${showCancel ? `
            <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; background:rgba(230,57,70,0.1); border:1px solid var(--red-accent); padding:8px 12px; border-radius:8px;">
              <span style="font-size:0.80rem; color:#ffb703;" id="countdown-${o.orderId}" data-seconds="${remSec}">⏳ ক্যানসেল করার সময় বাকি: গণনা হচ্ছে...</span>
              <button onclick="promptCancelOrder('${o.orderId}', ${isPrepaid})" style="background:var(--red-accent); color:#fff; border:none; padding:5px 12px; border-radius:6px; font-weight:bold; font-size:0.8rem; cursor:pointer;">অর্ডার ক্যানসেল করুন</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    startLiveCountdowns();
  }
}

let countdownInterval = null;
function startLiveCountdowns() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    document.querySelectorAll('[id^="countdown-"]').forEach(el => {
      let sec = parseInt(el.getAttribute('data-seconds'), 10);
      if (isNaN(sec) || sec <= 0) {
        el.innerText = '⚠️ ক্যানসেল করার সময় শেষ';
        return;
      }
      sec--;
      el.setAttribute('data-seconds', sec);
      let h = Math.floor(sec / 3600);
      let m = Math.floor((sec % 3600) / 60);
      let s = sec % 60;
      el.innerText = `⏳ ক্যানসেল করার সময় বাকি: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    });
  }, 1000);
}

async function loadUserOrderStatus() {
  if (!currentUser) return;
  const res = await fetch(`/api/orders/user/${currentUser.phone}`);
  const data = await res.json();
  const container = document.getElementById('current-orders-status-list');
  if (container && data.success) {
    const active = data.orders.filter(o => o.status === 'PENDING' || o.status === 'ACCEPTED' || o.status === 'REJECTED');
    container.innerHTML = active.length === 0 ? '<p style="color:#aaa;">কোনো সক্রিয় অর্ডার নেই।</p>' : active.map(o => {
      const formattedOrderDate = formatDateDDMMYYYY(o.orderDate || o.createdAt);
      const formattedDelDate = formatDateDDMMYYYY(o.deliveryDate);
      const showCancel = canCancelOrder(o);
      const remSec = getRemainingCancelSeconds(o.orderDate);
      const isPrepaid = o.paymentScreenshot && o.paymentScreenshot !== 'CASH ON DELIVERY';

      return `
        <div style="background:#181824; border:1px solid var(--border-gold); padding:12px; border-radius:10px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:var(--gold-bright);">#${o.orderId}</strong>
            <span style="color:${o.status==='REJECTED'?'#e63946':o.status==='DELIVERED'?'#2a9d8f':'var(--gold-primary)'}; font-weight:bold;">${o.status}</span>
          </div>
          <p style="font-size:0.85rem; color:#aaa; margin-top:4px;">অর্ডার তারিখ: ${formattedOrderDate} | ডেলিভারি তারিখ: ${formattedDelDate}</p>
          <p style="font-size:0.9rem; margin-top:4px;">মোট মূল্য: <b>₹${o.totalAmount}</b></p>

          ${o.status === 'REJECTED' && (o.rejectionReason || o.reason) ? `<p style="color:#e63946; margin-top:6px;"><b>বাতিলের কারণ:</b> ${o.rejectionReason || o.reason}</p>` : ''}

          ${showCancel ? `
            <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; background:rgba(230,57,70,0.1); border:1px solid var(--red-accent); padding:8px 12px; border-radius:8px;">
              <span style="font-size:0.80rem; color:#ffb703;" id="countdown-status-${o.orderId}" data-seconds="${remSec}">⏳ সময় বাকি: গণনা হচ্ছে...</span>
              <button onclick="promptCancelOrder('${o.orderId}', ${isPrepaid})" style="background:var(--red-accent); color:#fff; border:none; padding:5px 12px; border-radius:6px; font-weight:bold; font-size:0.8rem; cursor:pointer;">অর্ডার ক্যানসেল করুন</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
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
  showMobileLoading();
  try {
    const res = await fetch('/api/user/preferred-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentUser.phone, preferredItems })
    });
    const data = await res.json();
    hideMobileLoading();
    if (data.success) {
      currentUser.preferredItems = data.preferredItems;
      localStorage.setItem('aswadan_user', JSON.stringify(currentUser));
      showToast('প্রেফার্ড মেনু সেভ হয়েছে!');
    }
  } catch (err) {
    hideMobileLoading();
    alert('সার্ভার ত্রুটি!');
  }
}

async function submitSpecialFoodRequest(e) {
  e.preventDefault();
  if (!currentUser) { openAuthModal(); return; }

  const itemName = document.getElementById('spec-item-name').value.trim();
  const qty = document.getElementById('spec-item-qty').value;
  const description = document.getElementById('spec-item-desc').value.trim();

  showMobileLoading();
  try {
    const res = await fetch('/api/special-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentUser.phone, customerName: currentUser.name, email: currentUser.email, itemName, description, qty })
    });
    const data = await res.json();
    hideMobileLoading();
    if (data.success) {
      showToast(data.message);
      document.getElementById('special-request-form').reset();
      loadUserSpecialRequests();
    } else {
      alert(data.message);
    }
  } catch (err) {
    hideMobileLoading();
    alert('সার্ভার ত্রুটি!');
  }
}

async function loadUserSpecialRequests() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/special-request/user/${currentUser.phone}`);
    const data = await res.json();
    const container = document.getElementById('user-special-requests-list');
    if (container && data.success) {
      userSpecialRequestsCache = data.requests || [];
      const actionedRequests = userSpecialRequestsCache.filter(r => r.status === 'PRICED' || r.status === 'REJECTED');
      if (actionedRequests.length > 0) {
        const seenIds = JSON.parse(localStorage.getItem(`aswadan_seen_specs_${currentUser.phone}`) || '[]');
        actionedRequests.forEach(r => {
          if (!seenIds.includes(r.requestId)) seenIds.push(r.requestId);
        });
        localStorage.setItem(`aswadan_seen_specs_${currentUser.phone}`, JSON.stringify(seenIds));
        checkSpecialRequestNotificationBadge();
      }

      container.innerHTML = userSpecialRequestsCache.length === 0 ? '<p style="color:#aaa; text-align:center;">কোনো রিকুয়েস্ট নেই।</p>' : userSpecialRequestsCache.map(r => `
        <div style="background:#181824; border:1px solid var(--border-gold); padding:12px; border-radius:8px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between;">
            <strong style="color:var(--gold-bright);">${r.itemName} (${r.qty} প্লেট)</strong>
            <span style="color:${r.status==='PRICED'?'#2a9d8f':r.status==='REJECTED'?'#e63946':'#ffb703'}; font-weight:bold;">${r.status}</span>
          </div>
          <p style="font-size:0.85rem; color:#ccc; margin-top:4px;">${r.description || ''}</p>
          
          ${r.status === 'REJECTED' ? `
            <p style="color:#e63946; font-weight:bold; margin-top:5px;">বাতিলের কারণ: ${r.rejectionReason || r.reason || 'প্রশাসনিক সিদ্ধান্ত'}</p>
          ` : ''}
          ${r.status === 'PRICED' ? `
            <p style="color:var(--gold-bright); font-weight:bold; margin-top:5px;">মূল্য: ₹${r.totalAmount}</p>
            <button onclick="openSpecialPaymentModal('${r.requestId}')" style="background:var(--green-accent); color:#fff; border:none; padding:7px 14px; border-radius:6px; cursor:pointer; font-weight:bold; margin-top:6px;">💳 পেমেন্ট ও অর্ডার কনফার্ম করুন</button>
          ` : ''}
        </div>
      `).join('');
    }
  } catch (err) { console.error(err); }
}

let activeSpecialReqId = null;

function openSpecialPaymentModal(requestId) {
  activeSpecialReqId = requestId;
  const req = userSpecialRequestsCache.find(r => r.requestId === requestId);
  
  specPaymentScreenshotBase64 = '';
  const totalAmount = req ? req.totalAmount : 0;
  document.getElementById('spec-pay-amount').innerText = totalAmount;
  
  const onlineRadio = document.querySelector('input[name="spec-payment-method"][value="online"]');
  if (onlineRadio) onlineRadio.checked = true;
  toggleSpecPaymentMethodUI();
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const specDelDateInput = document.getElementById('spec-delivery-date');
  if (specDelDateInput) specDelDateInput.value = tomorrow.toISOString().split('T')[0];

  document.getElementById('special-payment-modal').style.display = 'flex';
}

async function confirmSpecialPayment() {
  const deliveryDate = document.getElementById('spec-delivery-date').value;
  if (!deliveryDate) return alert('ডেলিভারি তারিখ দিন।');

  const method = document.querySelector('input[name="spec-payment-method"]:checked');
  const val = method ? method.value : 'online';

  let finalScreenshot = '';
  if (val === 'cod') {
    finalScreenshot = 'CASH ON DELIVERY';
  } else {
    if (!specPaymentScreenshotBase64) return alert('পেমেন্ট স্ক্রিনশট আপলোড করুন।');
    finalScreenshot = specPaymentScreenshotBase64;
  }

  showMobileLoading();
  try {
    const res = await fetch('/api/special-request/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: activeSpecialReqId,
        paymentScreenshot: finalScreenshot,
        deliveryDate
      })
    });
    const data = await res.json();
    hideMobileLoading();
    if (data.success) {
      showToast(data.message);
      document.getElementById('special-payment-modal').style.display = 'none';
      loadUserSpecialRequests();
    } else {
      alert(data.message);
    }
  } catch (err) {
    hideMobileLoading();
    alert('পেমেন্ট সাবমিট করতে ত্রুটি হয়েছে।');
  }
}

// --- CART MANAGEMENT WITH BUTTON-ANCHORED FLOATING TOAST POPUP ---
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

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const delDateInput = document.getElementById('delivery-date');
  if (delDateInput) {
    delDateInput.value = tomorrow.toISOString().split('T')[0];
    syncDisplayDate('delivery-date', 'delivery-date-display');
  }
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

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const delDateInput = document.getElementById('delivery-date');
  if (delDateInput) {
    delDateInput.value = tomorrow.toISOString().split('T')[0];
    syncDisplayDate('delivery-date', 'delivery-date-display');
  }
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
  if (isOrderSubmitting) return;

  const deliveryDate = document.getElementById('delivery-date').value;
  if (!deliveryDate) return alert('তারিখ সিলেক্ট করুন।');
  
  const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
  if (paymentMethod === 'online' && !paymentScreenshotBase64) {
    return alert('⚠️ অনলাইন পেমেন্টের জন্য স্ক্রিনশট আপলোড করা বাধ্যতামূলক!');
  }

  isOrderSubmitting = true;
  const orderBtn = document.getElementById('place-order-btn');
  if (orderBtn) {
    orderBtn.disabled = true;
    orderBtn.innerText = 'অর্ডার প্রসেসিং হচ্ছে... ⏳';
  }

  const totalAmount = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const finalScreenshot = (paymentMethod === 'cod') ? 'CASH ON DELIVERY' : paymentScreenshotBase64;

  showMobileLoading();
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
        paymentScreenshot: finalScreenshot,
        deliveryDate
      })
    });
    const data = await res.json();
    hideMobileLoading();
    if (data.success) {
      alert(`🎉 অর্ডার #${data.order.orderId} সফলভাবে জমা হয়েছে!`);
      cart = [];
      paymentScreenshotBase64 = '';
      updateCartCount();
      closeModal('cart-modal');
      location.href = 'index.html';
    } else {
      alert(data.message);
      isOrderSubmitting = false;
      if (orderBtn) {
        orderBtn.disabled = false;
        orderBtn.innerText = 'অর্ডার নিশ্চিত করুন';
      }
    }
  } catch (err) {
    hideMobileLoading();
    alert('অর্ডার প্লেস করতে সমস্যা হয়েছে।');
    isOrderSubmitting = false;
    if (orderBtn) {
      orderBtn.disabled = false;
      orderBtn.innerText = 'অর্ডার নিশ্চিত করুন';
    }
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