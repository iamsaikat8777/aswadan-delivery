let cart = JSON.parse(localStorage.getItem('aswadan_cart')) || [];
let user = JSON.parse(localStorage.getItem('aswadan_user')) || null;
let menuData = [];
let heroTileIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
  fetchMenu();
  updateCartUI();
  updateProfileNav();

  setTimeout(() => {
    const devBtn = document.getElementById('dev-google-btn');
    if (devBtn) devBtn.style.display = 'block';
  }, 1000);
});

function updateProfileNav() {
  const btn = document.getElementById('profile-nav-btn');
  if (btn && user) {
    btn.innerText = `👤 ${user.name.split(' ')[0]}`;
  }
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

    // Render Tiles Grid on Menu Page
    const tilesContainer = document.getElementById('menu-tiles-container');
    if (tilesContainer) {
      tilesContainer.innerHTML = menuData.map(item => `
        <div class="tile-card">
          <div class="tile-icon-wrapper">${getFoodIcon(item.name)}</div>
          <h3 class="tile-title">${item.name}</h3>
          <p class="tile-desc">${item.desc}</p>
          <div class="tile-bottom">
            <span class="tile-price">₹${item.price}</span>
            <button class="btn-add-tile" onclick="addToCart(${item.id}, '${item.name}', ${item.price})">+ Add</button>
          </div>
        </div>
      `).join('');
    }

    // Render 3-Card Showcase on Home Page
    const homeSpotlight = document.getElementById('home-spotlight-container');
    if (homeSpotlight) {
      const popularItems = menuData.slice(0, 3);
      homeSpotlight.innerHTML = popularItems.map(item => `
        <div class="tile-card">
          <div class="tile-icon-wrapper">${getFoodIcon(item.name)}</div>
          <h3 class="tile-title">${item.name}</h3>
          <p class="tile-desc">${item.desc}</p>
          <div class="tile-bottom">
            <span class="tile-price">₹${item.price}</span>
            <button class="btn-add-tile" onclick="addToCart(${item.id}, '${item.name}', ${item.price})">+ Add</button>
          </div>
        </div>
      `).join('');
    }

    // Initialize Hero Sliding Tile Animation
    if (document.getElementById('hero-sliding-tile')) {
      renderHeroSlidingTile();
      startHeroTileLoop();
    }

  } catch (err) {
    console.error('Menu loading failed', err);
  }
}

/* HERO SINGLE TILE ONE-BY-ONE SLIDING ANIMATION */
function renderHeroSlidingTile() {
  const tile = document.getElementById('hero-sliding-tile');
  if (!tile || menuData.length === 0) return;

  const item = menuData[heroTileIndex];
  
  tile.classList.add('slide-out');

  setTimeout(() => {
    tile.innerHTML = `
      <div class="spotlight-icon">${getFoodIcon(item.name)}</div>
      <h3 style="color: var(--gold-bright); font-size: 1.3rem; margin-bottom: 6px;">${item.name}</h3>
      <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.4; margin-bottom: 12px;">${item.desc}</p>
      <div style="font-size: 1.4rem; color: var(--gold-primary); font-weight: 800; margin-bottom: 12px;">₹${item.price}</div>
      <button class="btn-add-tile" style="width: 100%; padding: 10px;" onclick="addToCart(${item.id}, '${item.name}', ${item.price})">+ Quick Add to Cart</button>
    `;

    tile.classList.remove('slide-out');
    tile.classList.add('slide-in');

    setTimeout(() => {
      tile.classList.remove('slide-in');
    }, 50);
  }, 350);
}

function startHeroTileLoop() {
  setInterval(() => {
    if (document.getElementById('hero-sliding-tile') && menuData.length > 0) {
      heroTileIndex = (heroTileIndex + 1) % menuData.length;
      renderHeroSlidingTile();
    }
  }, 3500); // Transitions to the next item every 3.5 seconds
}

/* ADD TO CART & TOAST */
function addToCart(id, name, price) {
  if (!user) {
    alert('অর্ডার করতে অনুগ্রহ করে গুগল অ্যাকাউন্ট দিয়ে সাইন-ইন করুন।');
    return openAuthModal();
  }

  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, name, price, qty: 1 });
  }

  localStorage.setItem('aswadan_cart', JSON.stringify(cart));
  updateCartUI();
  showToast(`🛒 ${name} কার্টে যোগ করা হয়েছে!`);
}

function showToast(msg) {
  const toast = document.getElementById('toast-msg');
  if (toast) {
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
}

function updateCartUI() {
  const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById('cart-count');
  if (badge) badge.innerText = totalCount;
}

function openCartModal() {
  if (!user) {
    alert('অর্ডার করার জন্য প্রথমে গুগল সাইন-ইন সম্পন্ন করুন।');
    return openAuthModal();
  }
  
  const cartContainer = document.getElementById('cart-items');
  let total = 0;
  
  if (cart.length === 0) {
    cartContainer.innerHTML = '<p style="color:#aaa; text-align:center; padding:15px;">আপনার কার্ট খালি!</p>';
  } else {
    cartContainer.innerHTML = cart.map(item => {
      total += item.price * item.qty;
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #222;">
          <div>
            <strong style="color:var(--gold-bright);">${item.name}</strong>
            <br><small style="color:#aaa;">₹${item.price} x ${item.qty}</small>
          </div>
          <span style="color:var(--gold-primary); font-weight:bold;">₹${item.price * item.qty}</span>
        </div>
      `;
    }).join('');
  }

  const cartTotal = document.getElementById('cart-total');
  if (cartTotal) cartTotal.innerText = total;
  
  document.getElementById('cart-modal').style.display = 'flex';
}

function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(window.atob(base64));
}

async function handleGoogleLogin(response) {
  const payload = parseJwt(response.credential);
  processUserLogin(payload.email, payload.name, payload.picture);
}

function simulateGoogleLogin() {
  const mockEmail = "customer@gmail.com";
  const mockName = "Test Customer";
  processUserLogin(mockEmail, mockName, "");
}

async function processUserLogin(email, name, picture) {
  const phone = document.getElementById('google-user-phone').value.trim();
  const address = document.getElementById('google-user-address').value.trim();
  const pincode = document.getElementById('google-user-pincode').value.trim();

  if (!phone || phone.length < 10) {
    return alert('অনুগ্রহ করে সঠিক ১০ সংখ্যার মোবাইল নম্বর পূরণ করুন।');
  }

  if (!address) {
    return alert('অনুগ্রহ করে ডেলিভারি ঠিকানা দিন।');
  }

  if (pincode !== '700036') {
    return alert('আমাদের হোম ডেলিভারি পরিষেবা শুধুমাত্র ৭০০০৩৬ (700036) পিনকোডেই সীমাবদ্ধ।');
  }

  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, picture, phone, address, pincode })
  });

  const data = await res.json();
  if (data.success) {
    user = data.user;
    localStorage.setItem('aswadan_user', JSON.stringify(user));
    closeModal('auth-modal');
    updateProfileNav();
    alert(`🎉 স্বাগতম ${user.name}! গুগল সাইন-ইন সফল হয়েছে।`);
  } else {
    alert(data.message);
  }
}

async function placeOrder() {
  if (!user) {
    alert('অর্ডার জমা দিতে গুগল সাইন-ইন প্রয়োজন।');
    return openAuthModal();
  }

  const utrNumber = document.getElementById('utr-number').value.trim();
  const deliveryDate = document.getElementById('delivery-date').value;

  if (cart.length === 0) return alert('আপনার কার্ট খালি!');
  if (!utrNumber) return alert('পেমেন্ট করার পর UTR / Txn Reference নম্বরটি দিন।');

  const totalAmount = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEmail: user.email,
      phone: user.phone,
      customerName: user.name,
      address: `${user.address} (Pincode: ${user.pincode})`,
      items: cart,
      totalAmount,
      utrNumber,
      deliveryDate
    })
  });

  const data = await res.json();
  if (data.success) {
    alert('🎉 আপনার অর্ডার সফল হয়েছে! Order ID: ' + data.order.orderId);
    cart = [];
    localStorage.removeItem('aswadan_cart');
    updateCartUI();
    closeModal('cart-modal');
  } else {
    alert(data.message);
  }
}

async function openOrdersModal() {
  if (!user) return openAuthModal();

  const res = await fetch(`/api/orders/user/${user.email}`);
  const data = await res.json();

  const list = document.getElementById('user-orders-list');
  if (data.orders.length === 0) {
    list.innerHTML = '<p style="color:#aaa; text-align:center; padding:15px;">কোনো পূর্ববর্তী অর্ডার পাওয়া যায়নি।</p>';
  } else {
    list.innerHTML = data.orders.map(o => `
      <div style="background:#1c1c28; border:1px solid var(--border-gold); padding:12px; margin-bottom:10px; border-radius:10px;">
        <div style="display:flex; justify-content:space-between;">
          <strong>ID: ${o.orderId}</strong>
          <span style="color:var(--gold-primary); font-weight:bold;">${o.status}</span>
        </div>
        <small style="color:#aaa;">তারিখ: ${o.deliveryDate} | মূল্য: ₹${o.totalAmount}</small>
      </div>
    `).join('');
  }

  document.getElementById('orders-modal').style.display = 'flex';
}

function openAuthModal() { 
  if (user) {
    document.getElementById('google-user-phone').value = user.phone || '';
    document.getElementById('google-user-address').value = user.address || '';
    document.getElementById('google-user-pincode').value = user.pincode || '700036';
  }
  document.getElementById('auth-modal').style.display = 'flex'; 
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }