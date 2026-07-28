let cart = JSON.parse(localStorage.getItem('aswadan_cart')) || [];
let user = JSON.parse(localStorage.getItem('aswadan_user')) || null;
let menuData = [];
let heroTileIndex = 0;
let paymentScreenshotBase64 = '';
let deferredPWAEvent = null;
let userHistorySelectedDate = new Date().toISOString().split('T')[0];
let userHistoryShowAll = true;

// Map Modal Variables
let activeLocationInputId = null;
let leafletMap = null;
let leafletMarker = null;
let selectedLat = 22.5726; 
let selectedLng = 88.3639;

document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  checkIOSInstallBanner();
  syncLocalUserToServer();
  fetchMenu();
  updateCartUI();
  updateProfileNav();
  checkSpecialOfferPopup();

  const internalLinks = document.querySelectorAll('a[href]');
  internalLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && (href.endsWith('.html') || href === '/' || href.startsWith('/#'))) {
      link.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || link.getAttribute('target') === '_blank') return;
        e.preventDefault();
        window.location.href = href;
      });
    }
  });

  const dateInput = document.getElementById('delivery-date');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.value = tomorrow.toISOString().split('T')[0];
  }
});

/* --- iOS SAFARI APP INSTALL BANNER LOGIC --- */
function checkIOSInstallBanner() {
  if (isIOS() && !isInStandaloneMode()) {
    const iosBanner = document.getElementById('ios-install-banner');
    if (iosBanner && !localStorage.getItem('ios_banner_dismissed')) {
      iosBanner.style.display = 'flex';
    }
  }
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isInStandaloneMode() {
  return ('standalone' in window.navigator) && (window.navigator.standalone);
}

function dismissIOSBanner() {
  const iosBanner = document.getElementById('ios-install-banner');
  if (iosBanner) iosBanner.style.display = 'none';
  localStorage.setItem('ios_banner_dismissed', 'true');
}

function openMapModal(inputId) {
  activeLocationInputId = inputId;
  document.getElementById('map-picker-modal').style.display = 'flex';
  
  setTimeout(() => {
    if (!leafletMap) {
      leafletMap = L.map('leaflet-map').setView([22.5726, 88.3639], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMap);

      leafletMarker = L.marker([22.5726, 88.3639], { draggable: true }).addTo(leafletMap);

      leafletMarker.on('dragend', function (e) {
        const pos = leafletMarker.getLatLng();
        selectedLat = pos.lat;
        selectedLng = pos.lng;
      });

      leafletMap.on('click', function (e) {
        selectedLat = e.latlng.lat;
        selectedLng = e.latlng.lng;
        leafletMarker.setLatLng([selectedLat, selectedLng]);
      });
    } else {
      leafletMap.invalidateSize();
    }
  }, 250);
}

function closeMapModal() {
  document.getElementById('map-picker-modal').style.display = 'none';
}

function confirmMapLocation() {
  if (activeLocationInputId) {
    const locVal = `https://maps.google.com/?q=${selectedLat},${selectedLng}`;
    const inputEl = document.getElementById(activeLocationInputId);
    if (inputEl) {
      inputEl.value = locVal;
    }
    showToast('📍 মানচিত্র থেকে সঠিক লোকেশন কনফার্ম করা হয়েছে!');
  }
  closeMapModal();
}

function getCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const locStr = `https://maps.google.com/?q=${lat},${lng}`;
        document.getElementById('signup-location').value = locStr;
        showToast('📍 জিপিএস লোকেশন লিংক সফলভাবে নেওয়া হয়েছে!');
      },
      (error) => {
        alert('লোকেশন পাওয়া যায়নি। ব্রাউজারের লোকেশন পারমিশন চেক করুন।');
      }
    );
  } else {
    alert('আপনার ব্রাউজার জিপিএস লোকেশন সাপোর্ট করে না।');
  }
}

function getCurrentLocationForProfile() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const locStr = `https://maps.google.com/?q=${lat},${lng}`;
        document.getElementById('prof-location').value = locStr;
        showToast('📍 জিপিএস লোকেশন আপডেট করা হয়েছে!');
      },
      (error) => {
        alert('লোকেশন পাওয়া যায়নি।');
      }
    );
  } else {
    alert('ব্রাউজার লোকেশন সাপোর্ট করে না।');
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('PWA Service Worker Registered Successfully!'))
      .catch((err) => console.error('Service Worker registration failed:', err));
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPWAEvent = e;
  const pwaBanner = document.getElementById('pwa-install-banner');
  if (pwaBanner) {
    pwaBanner.style.display = 'flex';
  }
});

function triggerPWAInstall() {
  if (deferredPWAEvent) {
    deferredPWAEvent.prompt();
    deferredPWAEvent.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
      }
      deferredPWAEvent = null;
      const pwaBanner = document.getElementById('pwa-install-banner');
      if (pwaBanner) pwaBanner.style.display = 'none';
    });
  }
}

async function syncLocalUserToServer() {
  if (user && user.phone) {
    try {
      await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: user.phone,
          name: user.name || '',
          email: user.email || '',
          address: user.address || '',
          location: user.location || '',
          pincode: user.pincode || '700036'
        })
      });
    } catch (err) {
      console.error('Local user sync error:', err);
    }
  }
}

function handlePaymentScreenshotUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      paymentScreenshotBase64 = e.target.result;
      const preview = document.getElementById('payment-screenshot-preview');
      if (preview) {
        preview.src = paymentScreenshotBase64;
        preview.style.display = 'inline-block';
      }
    };
    reader.readAsDataURL(file);
  }
}

async function checkSpecialOfferPopup() {
  try {
    const res = await fetch('/api/offer');
    const data = await res.json();
    if (data.success && data.offer && data.offer.enabled) {
      const offer = data.offer;
      
      const titleEl = document.getElementById('offer-popup-title');
      const descEl = document.getElementById('offer-popup-desc');
      const imgEl = document.getElementById('offer-popup-image');

      if (titleEl) titleEl.innerText = offer.title;
      if (descEl) descEl.innerText = offer.desc;
      
      if (imgEl && offer.image) {
        imgEl.src = offer.image;
        imgEl.style.display = 'inline-block';
      }

      setTimeout(() => {
        const modal = document.getElementById('special-offer-modal');
        if (modal) modal.style.display = 'flex';
      }, 1000);
    }
  } catch (err) {
    console.error('Failed to load offer banner:', err);
  }
}

function updateProfileNav() {
  const btn = document.getElementById('profile-nav-btn');
  const wrapper = document.getElementById('user-nav-wrapper');
  const hoverMenu = document.getElementById('user-hover-menu');

  if (btn && hoverMenu) {
    if (user) {
      btn.innerText = `👤 ${user.name.split(' ')[0]}`;
      btn.onclick = (e) => {
        e.stopPropagation();
        wrapper.classList.toggle('active-dropdown');
      };
      hoverMenu.style.display = 'block';
    } else {
      btn.innerText = `👤 Sign In`;
      btn.onclick = openAuthModal;
      wrapper.classList.remove('active-dropdown');
      hoverMenu.style.display = 'none';
    }
  }
}

document.addEventListener('click', () => {
  const wrapper = document.getElementById('user-nav-wrapper');
  if (wrapper) {
    wrapper.classList.remove('active-dropdown');
  }
});

function openUserDashboard(tabName) {
  if (!user) return openAuthModal();
  document.getElementById('user-dashboard-modal').style.display = 'flex';
  switchDashboardTab(tabName);
}

function switchDashboardTab(tabName) {
  const views = ['profile', 'history', 'status', 'preferred'];
  
  views.forEach(v => {
    document.getElementById(`dash-view-${v}`).style.display = 'none';
    document.getElementById(`btn-tab-${v}`).classList.remove('active');
  });

  document.getElementById(`dash-view-${tabName}`).style.display = 'block';
  document.getElementById(`btn-tab-${tabName}`).classList.add('active');

  if (tabName === 'profile') loadProfileData();
  else if (tabName === 'history') loadOrderHistory();
  else if (tabName === 'status') loadCurrentStatus();
  else if (tabName === 'preferred') loadPreferredMenuUI();
}

function loadProfileData() {
  document.getElementById('prof-name').value = user.name || '';
  document.getElementById('prof-phone').value = user.phone || '';
  document.getElementById('prof-email').value = user.email || '';
  document.getElementById('prof-address').value = user.address || '';
  document.getElementById('prof-location').value = user.location || '';
  document.getElementById('prof-pincode').value = user.pincode || '700036';
}

async function saveUserProfile() {
  const name = document.getElementById('prof-name').value.trim();
  const email = document.getElementById('prof-email').value.trim();
  const address = document.getElementById('prof-address').value.trim();
  const location = document.getElementById('prof-location').value.trim();
  const pincode = document.getElementById('prof-pincode').value.trim();

  const res = await fetch('/api/user/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: user.phone, name, email, address, location, pincode })
  });
  const data = await res.json();
  if (data.success) {
    user = data.user;
    localStorage.setItem('aswadan_user', JSON.stringify(user));
    alert('প্রোফাইল আপডেট সফল হয়েছে!');
    updateProfileNav();
  }
}

async function requestUserHistoryDeletion() {
  const confirmed = confirm("Are you sure you want to delete all history? (আপনি কি নিশ্চিত সমস্ত ইতিহাস ডিলিট করতে চান?)");
  if (!confirmed) return;

  try {
    const res = await fetch('/api/user/request-delete-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: user.phone })
    });
    const data = await res.json();
    alert(data.message);
    if (data.success) {
      document.getElementById('user-history-otp-box').style.display = 'block';
    }
  } catch (err) {
    console.error(err);
    alert('OTP পাঠাতে সমস্যা হয়েছে।');
  }
}

async function verifyAndExecuteUserDeletion() {
  const otp = document.getElementById('user-history-otp-input').value.trim();
  if (!otp || otp.length !== 6) {
    alert('দয়া করে সঠিক ৬-সংখ্যার OTP কোড লিখুন।');
    return;
  }

  const finalConfirmed = confirm("OTP verified. Are you sure you want to permanently delete all order history?");
  if (!finalConfirmed) return;

  try {
    const res = await fetch('/api/user/verify-delete-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: user.phone, otp })
    });
    const data = await res.json();
    alert(data.message);
    if (data.success) {
      closeModal('user-dashboard-modal');
    }
  } catch (err) {
    console.error(err);
    alert('ইতিহাস ডিলিট করতে সমস্যা হয়েছে।');
  }
}

function logoutUser() {
  user = null;
  localStorage.removeItem('aswadan_user');
  closeModal('user-dashboard-modal');
  updateProfileNav();
  alert('Log Out সফল হয়েছে।');
}

async function loadOrderHistory() {
  const res = await fetch(`/api/orders/user/${user.phone}`);
  const data = await res.json();
  const container = document.getElementById('user-orders-history-list');

  const filteredOrders = userHistoryShowAll 
    ? data.orders 
    : data.orders.filter(o => {
        let rawDate = o.orderDate || o.createdAt || '';
        let normalizedDate = '';
        if (rawDate.includes('T')) {
          normalizedDate = rawDate.split('T')[0];
        } else if (rawDate.includes('/')) {
          const datePart = rawDate.split(',')[0].trim();
          const parts = datePart.split('/');
          if (parts.length === 3) {
            let m = parts[0].padStart(2, '0');
            let d = parts[1].padStart(2, '0');
            let y = parts[2];
            normalizedDate = `${y}-${m}-${d}`;
          }
        } else {
          normalizedDate = rawDate.substring(0, 10);
        }
        return normalizedDate === userHistorySelectedDate;
      });

  let htmlContent = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px; background:#181824; padding:10px; border-radius:10px; border:1px solid var(--border-gold);">
      <div style="display:flex; align-items:center; gap:6px;">
        <label style="font-size:0.85rem; color:var(--gold-bright); font-weight:bold;">অর্ডার করার তারিখ:</label>
        <input type="date" id="user-history-date" class="input-field" value="${userHistorySelectedDate}" ${userHistoryShowAll ? 'disabled' : ''} onchange="updateUserHistoryDate(this.value)" style="max-width:150px; padding:4px 8px;">
      </div>
      <button onclick="toggleUserHistoryShowAll()" style="background:${userHistoryShowAll ? 'var(--gold-gradient)' : 'rgba(229,193,88,0.1)'}; color:${userHistoryShowAll ? '#000' : 'var(--gold-bright)'}; border:1px solid var(--border-gold); padding:5px 10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.78rem;">
        ${userHistoryShowAll ? '📅 অর্ডার তারিখ ফিল্টার' : '♾️ Show All Data'}
      </button>
    </div>
  `;

  if (filteredOrders.length === 0) {
    htmlContent += '<p style="color:#aaa; text-align:center; padding:15px;">কোনো অর্ডারের ইতিহাস নেই।</p>';
  } else {
    htmlContent += filteredOrders.map(o => `
      <div style="background:#1c1c28; border:1px solid var(--border-gold); padding:12px; margin-bottom:10px; border-radius:10px;">
        <div style="display:flex; justify-content:space-between;">
          <strong style="color:var(--gold-bright);">ID: ${o.orderId}</strong>
          <span style="color:var(--gold-primary); font-weight:bold;">${o.status}</span>
        </div>
        <small style="color:#aaa;">অর্ডার তারিখ: ${o.orderDate || o.createdAt} | ডেলিভারি তারিখ: ${o.deliveryDate} | মোট: ₹${o.totalAmount}</small>
        ${o.rejectionReason ? `<p style="color:#e63946; font-size:0.82rem; margin-top:4px;"><b>বাতিলের কারণ:</b> ${o.rejectionReason}</p>` : ''}
      </div>
    `).join('');
  }

  container.innerHTML = htmlContent;
}

function updateUserHistoryDate(dateVal) {
  userHistorySelectedDate = dateVal;
  loadOrderHistory();
}

function toggleUserHistoryShowAll() {
  userHistoryShowAll = !userHistoryShowAll;
  loadOrderHistory();
}

async function loadCurrentStatus() {
  const res = await fetch(`/api/orders/user/${user.phone}`);
  const data = await res.json();
  const container = document.getElementById('current-orders-status-list');
  const activeOrders = data.orders.filter(o => o.status === 'PENDING' || o.status === 'ACCEPTED');

  if (activeOrders.length === 0) {
    container.innerHTML = '<p style="color:#aaa; text-align:center; padding:15px;">বর্তমানে কোনো সক্রিয় অর্ডার নেই।</p>';
  } else {
    container.innerHTML = activeOrders.map(o => `
      <div style="background:#181824; border:1px solid var(--gold-primary); padding:15px; margin-bottom:12px; border-radius:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="color:var(--gold-bright);">#${o.orderId}</h4>
          <span style="background:var(--gold-primary); color:#000; padding:2px 10px; border-radius:10px; font-weight:bold;">${o.status}</span>
        </div>
        <p style="margin:6px 0; font-size:0.9rem;"><b>ডেলিভারি তারিখ:</b> ${o.deliveryDate}</p>
        <p style="font-size:0.88rem; color:#aaa;">বিবরণ: ${o.items.map(i => i.name + ' x ' + i.qty).join(', ')}</p>
      </div>
    `).join('');
  }
}

function loadPreferredMenuUI() {
  const container = document.getElementById('preferred-selection-list');
  const prefIds = (user.preferredItems || []).map(i => i.id);

  container.innerHTML = menuData.map(item => {
    const isChecked = prefIds.includes(item.id) ? 'checked' : '';
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #222;">
        <div>
          <strong style="color:var(--gold-bright);">${item.name}</strong>
          <br><small style="color:#aaa;">₹${item.price}</small>
        </div>
        <input type="checkbox" id="pref-check-${item.id}" value="${item.id}" ${isChecked} style="width:20px; height:20px; accent-color:var(--gold-primary);">
      </div>
    `;
  }).join('');
}

async function savePreferredMenu() {
  const selected = [];
  menuData.forEach(item => {
    const chk = document.getElementById(`pref-check-${item.id}`);
    if (chk && chk.checked) {
      selected.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
    }
  });

  const res = await fetch('/api/user/preferred-menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: user.phone, preferredItems: selected })
  });
  const data = await res.json();
  if (data.success) {
    user.preferredItems = selected;
    localStorage.setItem('aswadan_user', JSON.stringify(user));
    alert('⭐ আপনার ডেইলি প্রেফার্ড মেনু সফলভাবে সেভ করা হয়েছে!');
  }
}

function quickOrderPreferred() {
  if (!user.preferredItems || user.preferredItems.length === 0) {
    return alert('আগে আপনার পছন্দসই মেনু চেক করে সেভ বাটনে ক্লিক করুন।');
  }
  cart = [...user.preferredItems];
  localStorage.setItem('aswadan_cart', JSON.stringify(cart));
  updateCartUI();
  closeModal('user-dashboard-modal');
  openCartModal();
}

function getFoodIcon(name) {
  if (name.includes('মাছ')) return '🐟';
  if (name.includes('ডিম')) return '🥚';
  if (name.includes('সবজি')) return '🥦';
  if (name.includes('চিকেন')) return '🍗';
  return '🍛';
}

async function fetchMenu() {
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();
    menuData = data.menu;

    const menuTilesContainer = document.getElementById('menu-tiles-container');
    if (menuTilesContainer) {
      menuTilesContainer.innerHTML = menuData.map(item => `
        <div class="tile-card">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">${getFoodIcon(item.name)}</div>
          <h3 class="tile-title">${item.name}</h3>
          <p class="tile-desc">${item.desc}</p>
          <div class="tile-bottom">
            <span class="tile-price">₹${item.price}</span>
            <button class="btn-add-tile" onclick="addToCart(${item.id}, '${item.name}', ${item.price})">+ Add</button>
          </div>
        </div>
      `).join('');
    }

    const homeSpotlight = document.getElementById('home-spotlight-container');
    if (homeSpotlight) {
      const popularItems = menuData.slice(0, 3);
      homeSpotlight.innerHTML = popularItems.map(item => `
        <div class="tile-card">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">${getFoodIcon(item.name)}</div>
          <h3 class="tile-title">${item.name}</h3>
          <p class="tile-desc">${item.desc}</p>
          <div class="tile-bottom">
            <span class="tile-price">₹${item.price}</span>
            <button class="btn-add-tile" onclick="addToCart(${item.id}, '${item.name}', ${item.price})">+ Add</button>
          </div>
        </div>
      `).join('');
    }

    if (document.getElementById('hero-sliding-tile')) {
      renderHeroSlidingTile();
      startHeroTileLoop();
    }
  } catch (err) {
    console.error('Menu loading failed', err);
  }
}

function renderHeroSlidingTile() {
  const tile = document.getElementById('hero-sliding-tile');
  if (!tile || menuData.length === 0) return;

  const item = menuData[heroTileIndex];
  tile.classList.add('slide-out');

  setTimeout(() => {
    tile.innerHTML = `
      <div style="font-size: 2.8rem; margin-bottom: 8px;">${getFoodIcon(item.name)}</div>
      <h3 style="color: var(--gold-bright); font-size: 1.35rem; margin-bottom: 6px;">${item.name}</h3>
      <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.4; margin-bottom: 14px;">${item.desc}</p>
      <div style="font-size: 1.45rem; color: var(--gold-primary); font-weight: 800; margin-bottom: 14px;">₹${item.price}</div>
      <button class="btn-add-tile" style="width: 100%; padding: 10px;" onclick="addToCart(${item.id}, '${item.name}', ${item.price})">+ Quick Add to Cart</button>
    `;

    tile.classList.remove('slide-out');
    tile.classList.add('slide-in');

    void tile.offsetWidth;
    tile.classList.remove('slide-in');
  }, 400);
}

function startHeroTileLoop() {
  setInterval(() => {
    if (document.getElementById('hero-sliding-tile') && menuData.length > 0) {
      heroTileIndex = (heroTileIndex + 1) % menuData.length;
      renderHeroSlidingTile();
    }
  }, 3800);
}

function addToCart(id, name, price) {
  if (!user) return openAuthModal();
  const exist = cart.find(i => i.id === id);
  if (exist) exist.qty++;
  else cart.push({ id, name, price, qty: 1 });

  localStorage.setItem('aswadan_cart', JSON.stringify(cart));
  updateCartUI();
  showToast(`🛒 ${name} যোগ করা হয়েছে!`);
}

function updateCartQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      removeFromCart(id);
      return;
    }
    localStorage.setItem('aswadan_cart', JSON.stringify(cart));
    updateCartUI();
    openCartModal();
  }
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  localStorage.setItem('aswadan_cart', JSON.stringify(cart));
  updateCartUI();
  openCartModal();
  showToast('❌ কার্ট থেকে সরানো হয়েছে!');
}

function updateCartUI() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cart-count');
  if (badge) badge.innerText = count;
}

function openCartModal() {
  if (!user) return openAuthModal();

  document.getElementById('cart-step-1').style.display = 'block';
  document.getElementById('cart-step-2').style.display = 'none';

  const container = document.getElementById('cart-items');
  const noticeEl = document.getElementById('min-order-notice');
  let total = 0;
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  if (cart.length === 0) {
    container.innerHTML = '<p style="text-align:center; padding:15px; color:#aaa;">কার্ট খালি!</p>';
  } else {
    container.innerHTML = cart.map(i => {
      total += i.price * i.qty;
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #333;">
          <div style="flex:1;">
            <strong style="color:var(--gold-bright); font-size:0.95rem;">${i.name}</strong><br>
            <small style="color:#aaa;">₹${i.price} × ${i.qty} = ₹${i.price * i.qty}</small>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="display:flex; align-items:center; background:#181824; border:1px solid var(--border-gold); border-radius:6px; padding:2px 6px;">
              <button onclick="updateCartQty(${i.id}, -1)" style="background:none; border:none; color:var(--gold-bright); font-weight:bold; font-size:1.1rem; cursor:pointer; padding:0 6px;">-</button>
              <span style="font-weight:bold; min-width:20px; text-align:center;">${i.qty}</span>
              <button onclick="updateCartQty(${i.id}, 1)" style="background:none; border:none; color:var(--gold-bright); font-weight:bold; font-size:1.1rem; cursor:pointer; padding:0 6px;">+</button>
            </div>
            <button onclick="removeFromCart(${i.id})" style="background:none; border:none; color:var(--red-accent); cursor:pointer; font-size:1.1rem; padding:4px;" title="Remove">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  if (noticeEl) {
    noticeEl.style.display = (totalQty > 0 && totalQty < 2) ? 'block' : 'none';
  }

  document.getElementById('cart-total').innerText = total;
  document.getElementById('cart-modal').style.display = 'flex';
}

function proceedToPaymentStep() {
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  if (cart.length === 0) {
    return alert('আপনার কার্ট খালি!');
  }

  if (totalQty < 2) {
    const noticeEl = document.getElementById('min-order-notice');
    if (noticeEl) noticeEl.style.display = 'block';
    return alert('⚠️ আমাদের সর্বনিম্ন অর্ডার ২ টি থালি / প্লেট। অনুগ্রহ করে কার্টে আরও খাবার যোগ করুন।');
  }

  document.getElementById('cart-step-1').style.display = 'none';
  document.getElementById('cart-step-2').style.display = 'block';
}

function backToCartStep() {
  document.getElementById('cart-step-1').style.display = 'block';
  document.getElementById('cart-step-2').style.display = 'none';
}

async function placeOrder() {
  const date = document.getElementById('delivery-date').value;

  if (cart.length === 0) return alert('কার্ট খালি!');
  if (!paymentScreenshotBase64) return alert('অনুগ্রহ করে পেমেন্টের স্ক্রিনশট আপলোড করুন।');

  const totalAmount = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: user.phone,
      customerName: user.name,
      email: user.email,
      address: user.address,
      location: user.location || '',
      items: cart,
      totalAmount,
      paymentScreenshot: paymentScreenshotBase64,
      deliveryDate: date
    })
  });
  const data = await res.json();
  if (data.success) {
    alert(`🎉 অর্ডার সফল হয়েছে! Order ID: ${data.order.orderId}`);
    cart = [];
    paymentScreenshotBase64 = '';
    const screenshotInput = document.getElementById('payment-screenshot-input');
    if (screenshotInput) screenshotInput.value = '';
    const preview = document.getElementById('payment-screenshot-preview');
    if (preview) preview.style.display = 'none';

    localStorage.removeItem('aswadan_cart');
    updateCartUI();
    closeModal('cart-modal');
  } else {
    alert(data.message || 'অর্ডার করতে সমস্যা হয়েছে।');
  }
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const forgotForm = document.getElementById('forgot-form');
  const resetForm = document.getElementById('reset-form');
  const tabBar = document.getElementById('auth-tab-bar');
  const title = document.getElementById('auth-modal-title');

  loginForm.style.display = 'none';
  signupForm.style.display = 'none';
  forgotForm.style.display = 'none';
  resetForm.style.display = 'none';
  tabBar.style.display = 'flex';

  if (tab === 'login') {
    loginForm.style.display = 'block';
    title.innerText = '🔑 লগইন (Login)';
  } else if (tab === 'signup') {
    signupForm.style.display = 'block';
    title.innerText = '📝 নতুন সাইন-আপ';
  } else if (tab === 'forgot') {
    forgotForm.style.display = 'block';
    tabBar.style.display = 'none';
    title.innerText = '🔐 পাসওয়ার্ড রিসেট (OTP)';
  } else if (tab === 'reset') {
    resetForm.style.display = 'block';
    tabBar.style.display = 'none';
    title.innerText = '🔢 OTP যাচাই ও পাসওয়ার্ড পরিবর্তন';
  }
}

async function loginUser() {
  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!identifier) return alert('মোবাইল নম্বর বা ইমেল আইডি লিখুন।');
  if (!password) return alert('পাসওয়ার্ড লিখুন।');

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password })
  });
  const data = await res.json();
  if (data.success) {
    user = data.user;
    localStorage.setItem('aswadan_user', JSON.stringify(user));
    closeModal('auth-modal');
    updateProfileNav();
    syncLocalUserToServer();
    alert(`🎉 স্বাগতম ${user.name}!`);
  } else alert(data.message);
}

async function signupUser() {
  const name = document.getElementById('signup-name').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value.trim();
  const address = document.getElementById('signup-address').value.trim();
  const location = document.getElementById('signup-location').value.trim();
  const pincode = document.getElementById('signup-pincode').value.trim();

  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, email, password, address, location, pincode })
  });
  const data = await res.json();
  if (data.success) {
    user = data.user;
    localStorage.setItem('aswadan_user', JSON.stringify(user));
    closeModal('auth-modal');
    updateProfileNav();
    syncLocalUserToServer();
    alert(`🎉 রেজিস্ট্রেশন সফল হয়েছে!`);
  } else alert(data.message);
}

let activeForgotEmail = '';

async function sendResetOTP() {
  const email = document.getElementById('forgot-email').value.trim();
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  if (data.success) {
    activeForgotEmail = email;
    alert(data.message);
    switchAuthTab('reset');
  } else alert(data.message);
}

async function submitNewPassword() {
  const otp = document.getElementById('reset-otp').value.trim();
  const newPassword = document.getElementById('reset-new-password').value.trim();

  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: activeForgotEmail, otp, newPassword })
  });
  const data = await res.json();
  if (data.success) {
    alert(data.message);
    switchAuthTab('login');
  } else alert(data.message);
}

function showToast(msg) {
  const toast = document.getElementById('toast-msg');
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function openAuthModal() { switchAuthTab('login'); document.getElementById('auth-modal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }