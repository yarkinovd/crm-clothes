/* ═══════════════════════════════════════════════
   ClothesHub — Customer Storefront JS
═══════════════════════════════════════════════ */

// ─── Helpers ──────────────────────────────────

const escHtml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatPrice = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

// ─── Toast ────────────────────────────────────

let toastTimer = null;
const showToast = (msg) => {
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
};

// ─── Products ─────────────────────────────────

const CATEGORY_COLORS = {
  'Erkaklar': { bg: '#dbeafe', text: '#1d4ed8' },
  'Ayollar':  { bg: '#fce7f3', text: '#9d174d' },
  'Sport':    { bg: '#d1fae5', text: '#065f46' },
  'Qishki':   { bg: '#fef3c7', text: '#92400e' },
  'Uniseks':  { bg: '#e0e7ff', text: '#3730a3' },
  'Asosiy':   { bg: '#f1f5f9', text: '#334155' },
};

const loadProducts = async () => {
  const grid = document.getElementById('products-grid');

  try {
    const res      = await fetch('/api/products');
    const products = await res.json();

    if (!products.length) {
      grid.innerHTML = `<p class="col-span-full text-center text-slate-400 py-12">Mahsulotlar topilmadi</p>`;
      return;
    }

    grid.innerHTML = products.map((p) => {
      const catStyle = CATEGORY_COLORS[p.category] || { bg: '#e0e7ff', text: '#3730a3' };
      const visual = p.image_url
        ? `<div class="h-52 overflow-hidden bg-slate-100">
             <img src="${escHtml(p.image_url)}" alt="${escHtml(p.name)}"
               class="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
               loading="lazy" />
           </div>`
        : `<div class="h-52 flex items-center justify-center text-7xl"
             style="background: linear-gradient(135deg, ${p.color}22 0%, ${p.color}44 100%);">
             ${escHtml(p.emoji)}
           </div>`;
      return `
        <div class="product-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">

          ${visual}

          <div class="p-5">
            <!-- Category badge -->
            <span class="badge-category mb-3"
              style="background:${catStyle.bg}; color:${catStyle.text};">
              ${escHtml(p.category)}
            </span>

            <h3 class="font-bold text-slate-800 text-base mb-1 leading-snug">${escHtml(p.name)}</h3>
            <p class="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">${escHtml(p.description)}</p>

            <div class="flex items-end justify-between mb-4">
              <div>
                <p class="text-2xl font-black text-slate-900">${formatPrice(p.price)}<span class="text-sm font-normal text-slate-400">/dona</span></p>
                <p class="text-xs text-slate-400 mt-0.5">Minimal buyurtma: <strong class="text-slate-600">${p.min_order} dona</strong></p>
              </div>
            </div>

            <button
              onclick="openModal('${escHtml(p.name)}')"
              class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Buyurtma berish
            </button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('[loadProducts]', err);
    grid.innerHTML = `<p class="col-span-full text-center text-red-400 py-12">Mahsulotlarni yuklashda xato yuz berdi</p>`;
  }
};

// ─── Modal ────────────────────────────────────

const openModal = (productName = '') => {
  document.getElementById('register-modal').classList.add('open');
  document.getElementById('register-form').classList.remove('hidden');
  document.getElementById('success-state').classList.add('hidden');
  document.getElementById('reg-error').classList.add('hidden');
  document.getElementById('register-form').reset();

  if (productName) {
    const sel = document.getElementById('reg-product');
    for (const opt of sel.options) {
      if (opt.value === productName) { opt.selected = true; break; }
    }
  }

  document.getElementById('reg-name').focus();
};

const closeModal = () => {
  document.getElementById('register-modal').classList.remove('open');
};

// ─── Submit Register ──────────────────────────

const submitRegister = async (e) => {
  e.preventDefault();

  const name             = document.getElementById('reg-name').value.trim();
  const company          = document.getElementById('reg-company').value.trim();
  const email            = document.getElementById('reg-email').value.trim();
  const phone            = document.getElementById('reg-phone').value.trim();
  const product_interest = document.getElementById('reg-product').value;

  const showError = (msg) => {
    const el = document.getElementById('reg-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  };

  if (!name)  return showError('Ism Familiya kiritish majburiy.');
  if (!email) return showError('Email kiritish majburiy.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return showError('Email noto\'g\'ri formatda.');

  const btn = document.getElementById('submit-btn');
  btn.textContent = 'Yuborilmoqda…';
  btn.disabled    = true;

  try {
    const res = await fetch('/api/customers/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, company, email, phone, product_interest }),
    });

    const data = await res.json();

    if (!res.ok) {
      btn.textContent = 'Ariza yuborish';
      btn.disabled    = false;
      return showError(data.error || 'Xato yuz berdi, qayta urinib ko\'ring.');
    }

    // Show success
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('success-state').classList.remove('hidden');

  } catch (err) {
    console.error('[submitRegister]', err);
    btn.textContent = 'Ariza yuborish';
    btn.disabled    = false;
    showError('Tarmoq xatosi. Internet aloqangizni tekshiring.');
  }
};

// ─── Event Listeners ──────────────────────────

document.getElementById('register-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('register-modal')) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ─── Init ─────────────────────────────────────

loadProducts();
