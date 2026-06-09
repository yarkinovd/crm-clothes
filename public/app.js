/* ═══════════════════════════════════════════════════════════════
   CRM Clothes — Admin Panel (O'zbek tili)
═══════════════════════════════════════════════════════════════ */

// ─── Auth ─────────────────────────────────────────────────────────────────────

const ADMIN_TOKEN_KEY = 'crm_admin_token';
if (!localStorage.getItem(ADMIN_TOKEN_KEY)) {
  window.location.href = '/login.html';
}
const logout = () => {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.location.href = '/login.html';
};

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  leads:   [],
  filters: { timeframe: 'all', status: 'all' },
};

// ─── Status labellari ─────────────────────────────────────────────────────────

const STATUS_LABELS = {
  'New':         'Yangi',
  'In Progress': 'Jarayonda',
  'Won':         'Yutilgan',
  'Lost':        "Yo'qotilgan",
};
const STATUS_ORDER = ['New', 'In Progress', 'Won', 'Lost'];

// ─── Yordamchi funksiyalar ────────────────────────────────────────────────────

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount || 0);

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('uz-UZ', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

const escapeHtml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const statusBadgeHTML = (status) => {
  const cls = {
    'New':         'badge badge-new',
    'In Progress': 'badge badge-in-progress',
    'Won':         'badge badge-won',
    'Lost':        'badge badge-lost',
  }[status] || 'badge badge-new';
  return `<span class="${cls}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
};

const avatarHTML = (name, size = 8) => {
  const initial = String(name || '?').charAt(0).toUpperCase();
  return `<div class="w-${size} h-${size} bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">${initial}</div>`;
};

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer = null;
const showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  const icon  = document.getElementById('toast-icon');
  document.getElementById('toast-message').textContent = message;

  if (type === 'success') {
    icon.className = 'w-4 h-4 flex-shrink-0 text-emerald-400';
    icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>';
  } else {
    icon.className = 'w-4 h-4 flex-shrink-0 text-red-400';
    icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>';
  }

  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
};

// ─── Navigatsiya ──────────────────────────────────────────────────────────────

const PAGE_META = {
  dashboard: { title: 'Boshqaruv paneli',  subtitle: 'Savdo ko\'rsatkichlari va asosiy metrikalar' },
  leads:     { title: 'Mijozlar',           subtitle: 'Barcha mijozlarni boshqarish va kuzatish' },
  pipeline:  { title: 'Savdo yo\'li',       subtitle: 'Kanban board orqali savdo jarayonini kuzating' },
};

const showView = (view) => {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach((l) => {
    l.classList.remove('active', 'bg-indigo-600', 'text-white');
    l.classList.add('text-slate-300', 'hover:bg-slate-800');
  });

  document.getElementById(`view-${view}`).classList.add('active');
  const link = document.querySelector(`[data-view="${view}"]`);
  if (link) {
    link.classList.add('active', 'bg-indigo-600', 'text-white');
    link.classList.remove('text-slate-300', 'hover:bg-slate-800');
  }

  const meta = PAGE_META[view] || {};
  document.getElementById('page-title').textContent    = meta.title || '';
  document.getElementById('page-subtitle').textContent = meta.subtitle || '';

  if (view === 'leads')    loadLeads();
  if (view === 'pipeline') loadPipeline();
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

const applyFilters = () => {
  state.filters.timeframe = document.getElementById('filter-timeframe').value;
  state.filters.status    = document.getElementById('filter-status').value;
  loadDashboard();
};

const resetFilters = () => {
  document.getElementById('filter-timeframe').value = 'all';
  document.getElementById('filter-status').value    = 'all';
  state.filters = { timeframe: 'all', status: 'all' };
  loadDashboard();
};

const loadDashboard = async () => {
  ['stat-total-leads', 'stat-active-deals', 'stat-won-revenue', 'stat-conversion'].forEach((id) => {
    const el = document.getElementById(id);
    el.textContent = '—';
    el.classList.add('stat-loading');
  });

  const { timeframe, status } = state.filters;
  try {
    const res  = await fetch(`/api/dashboard?timeframe=${encodeURIComponent(timeframe)}&status=${encodeURIComponent(status)}`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    const set = (id, val) => {
      const el = document.getElementById(id);
      el.textContent = val;
      el.classList.remove('stat-loading');
    };
    set('stat-total-leads',  data.totalLeads);
    set('stat-active-deals', data.activeDeals);
    set('stat-won-revenue',  formatCurrency(data.wonRevenue));
    set('stat-conversion',   `${data.conversionRate}%`);

    renderRecentActivity(data.recentActivity || []);

    const el = document.getElementById('last-updated');
    el.textContent = `Yangilangan: ${new Date().toLocaleTimeString('uz-UZ')}`;
    el.classList.remove('hidden');
  } catch (err) {
    showToast('Ma\'lumotlarni yuklashda xato', 'error');
  }
};

const renderRecentActivity = (rows) => {
  const tbody = document.getElementById('recent-activity-body');
  if (!rows.length) {
    tbody.innerHTML = `
      <tr><td colspan="5" class="px-6 py-10 text-center text-slate-400 text-sm">
        Tanlangan filtrlar bo'yicha ma'lumot topilmadi
      </td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((lead) => `
    <tr class="hover:bg-slate-50/70 transition-colors">
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          ${avatarHTML(lead.name)}
          <span class="text-sm font-semibold text-slate-800">${escapeHtml(lead.name)}</span>
        </div>
      </td>
      <td class="px-6 py-4 text-sm text-slate-600">${escapeHtml(lead.company)}</td>
      <td class="px-6 py-4">${statusBadgeHTML(lead.status)}</td>
      <td class="px-6 py-4 text-sm font-bold text-slate-800">${formatCurrency(lead.revenue)}</td>
      <td class="px-6 py-4 text-sm text-slate-500">${formatDate(lead.created_at)}</td>
    </tr>`).join('');
};

const refreshData = () => { loadDashboard(); showToast('Yangilandi'); };

// ─── Mijozlar jadvali ─────────────────────────────────────────────────────────

const loadLeads = async () => {
  const tbody = document.getElementById('leads-table-body');
  tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-10 text-center text-slate-400">Yuklanmoqda…</td></tr>`;
  try {
    const res = await fetch('/api/leads');
    if (!res.ok) throw new Error();
    state.leads = await res.json();

    document.getElementById('leads-count').textContent =
      `Jami ${state.leads.length} ta mijoz`;

    if (!state.leads.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-12 text-center text-slate-400">
        Mijozlar yo'q. "Yangi mijoz qo'shish" tugmasini bosing.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = state.leads.map((lead) => `
      <tr class="hover:bg-slate-50/70 transition-colors">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            ${avatarHTML(lead.name, 9)}
            <span class="text-sm font-bold text-slate-800">${escapeHtml(lead.name)}</span>
          </div>
        </td>
        <td class="px-6 py-4 text-sm text-slate-600">${escapeHtml(lead.company)}</td>
        <td class="px-6 py-4 text-sm">
          <a href="mailto:${escapeHtml(lead.email)}"
            class="text-slate-500 hover:text-indigo-600 transition-colors underline underline-offset-2 decoration-slate-300">
            ${escapeHtml(lead.email)}
          </a>
        </td>
        <td class="px-6 py-4 text-sm text-slate-500">${lead.phone ? escapeHtml(lead.phone) : '<span class="text-slate-300">—</span>'}</td>
        <td class="px-6 py-4">${statusBadgeHTML(lead.status)}</td>
        <td class="px-6 py-4">
          <span class="text-sm font-bold ${parseFloat(lead.revenue) > 0 ? 'text-emerald-700' : 'text-slate-400'}">
            ${formatCurrency(lead.revenue)}
          </span>
        </td>
        <td class="px-6 py-4 text-sm text-slate-400">${formatDate(lead.created_at)}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <button onclick="openEditModal(${lead.id})"
              class="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-semibold transition-colors">
              Tahrirlash
            </button>
            <button onclick="deleteLead(${lead.id}, '${escapeHtml(lead.name)}')"
              class="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-semibold transition-colors">
              O'chirish
            </button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    showToast('Mijozlarni yuklashda xato', 'error');
  }
};

// ─── Mijoz qo'shish ───────────────────────────────────────────────────────────

const openAddLeadModal = () => {
  document.getElementById('add-lead-modal').classList.add('open');
  document.getElementById('add-lead-form').reset();
  document.getElementById('form-error').classList.add('hidden');
  document.getElementById('input-name').focus();
};
const closeAddLeadModal = () => {
  document.getElementById('add-lead-modal').classList.remove('open');
};

const submitAddLead = async (e) => {
  e.preventDefault();
  const name    = document.getElementById('input-name').value.trim();
  const company = document.getElementById('input-company').value.trim();
  const email   = document.getElementById('input-email').value.trim();
  const phone   = document.getElementById('input-phone').value.trim();
  const status  = document.getElementById('input-status').value;
  const revenue = parseFloat(document.getElementById('input-revenue').value) || 0;

  const showErr = (msg) => {
    const el = document.getElementById('form-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  };

  if (!name)    return showErr('Ism Familiya kiritish majburiy.');
  if (!company) return showErr('Kompaniya nomi kiritish majburiy.');
  if (!email)   return showErr('Email kiritish majburiy.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('Email noto\'g\'ri formatda.');

  try {
    const res = await fetch('/api/leads', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, company, email, phone, status, revenue }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return showErr(err.error || 'Xato yuz berdi.');
    }
    closeAddLeadModal();
    showToast(`"${name}" muvaffaqiyatli qo'shildi`);
    loadLeads();
    loadDashboard();
  } catch (err) {
    showErr('Tarmoq xatosi. Qayta urinib ko\'ring.');
  }
};

// ─── Mijozni tahrirlash ───────────────────────────────────────────────────────

const openEditModal = (leadId) => {
  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead) return;
  document.getElementById('edit-lead-id').value          = lead.id;
  document.getElementById('edit-lead-subtitle').textContent = `${lead.name} — ${lead.company}`;
  document.getElementById('edit-status').value           = lead.status;
  document.getElementById('edit-revenue').value          = lead.revenue > 0 ? lead.revenue : '';
  document.getElementById('edit-error').classList.add('hidden');
  document.getElementById('edit-lead-modal').classList.add('open');
  document.getElementById('edit-revenue').focus();
};
const closeEditModal = () => {
  document.getElementById('edit-lead-modal').classList.remove('open');
};

const submitEditLead = async () => {
  const id      = parseInt(document.getElementById('edit-lead-id').value, 10);
  const status  = document.getElementById('edit-status').value;
  const revenue = parseFloat(document.getElementById('edit-revenue').value) || 0;

  try {
    const res = await fetch(`/api/leads/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status, revenue }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const el  = document.getElementById('edit-error');
      el.textContent = err.error || 'Xato yuz berdi';
      el.classList.remove('hidden');
      return;
    }
    closeEditModal();
    showToast(`Yangilandi — ${STATUS_LABELS[status]}, ${formatCurrency(revenue)}`);
    loadLeads();
    loadDashboard();
  } catch (err) {
    const el = document.getElementById('edit-error');
    el.textContent = 'Tarmoq xatosi';
    el.classList.remove('hidden');
  }
};

// ─── Mijozni o'chirish ────────────────────────────────────────────────────────

const deleteLead = async (leadId, leadName) => {
  if (!confirm(`"${leadName}" ni o'chirishni tasdiqlaysizmi?\n\nBu amalni qaytarib bo'lmaydi.`)) return;
  try {
    const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    showToast(`"${leadName}" o'chirildi`);
    loadLeads();
    loadDashboard();
  } catch (err) {
    showToast('O\'chirishda xato yuz berdi', 'error');
  }
};

// ─── Pipeline / Kanban ────────────────────────────────────────────────────────

const prevStatus = (current) => {
  const i = STATUS_ORDER.indexOf(current);
  return i > 0 ? STATUS_ORDER[i - 1] : null;
};
const nextStatus = (current) => {
  const i = STATUS_ORDER.indexOf(current);
  return i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : null;
};

const updateLeadStatus = async (id, newStatus) => {
  try {
    const res = await fetch(`/api/leads/${id}/status`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error();
    showToast(`"${STATUS_LABELS[newStatus]}" holatiga ko'chirildi`);
    loadPipeline();
    loadDashboard();
  } catch (err) {
    showToast('Holatni yangilashda xato', 'error');
  }
};

const loadPipeline = async () => {
  const COLS = {
    'New':         document.getElementById('kanban-new'),
    'In Progress': document.getElementById('kanban-in-progress'),
    'Won':         document.getElementById('kanban-won'),
    'Lost':        document.getElementById('kanban-lost'),
  };
  const COUNTS = { 'New': 0, 'In Progress': 0, 'Won': 0, 'Lost': 0 };
  Object.values(COLS).forEach((col) => { col.innerHTML = ''; });

  try {
    const res = await fetch('/api/leads');
    if (!res.ok) throw new Error();
    state.leads = await res.json();

    if (!state.leads.length) {
      Object.values(COLS).forEach((col) => {
        col.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">Mijoz yo'q</p>`;
      });
    }

    state.leads.forEach((lead) => {
      const col = COLS[lead.status];
      if (!col) return;
      COUNTS[lead.status]++;

      const prev = prevStatus(lead.status);
      const next = nextStatus(lead.status);

      const card = document.createElement('div');
      card.className = 'kanban-card bg-slate-50 border border-slate-200 rounded-xl p-4 cursor-default select-none';
      card.innerHTML = `
        <div class="flex items-start gap-2.5 mb-3">
          ${avatarHTML(lead.name, 8)}
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-slate-800 leading-snug truncate">${escapeHtml(lead.name)}</p>
            <p class="text-xs text-slate-500 truncate">${escapeHtml(lead.company)}</p>
          </div>
          <button onclick="openEditModal(${lead.id})" title="Tahrirlash"
            class="p-1 hover:bg-indigo-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600 flex-shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        </div>

        <div class="flex items-center justify-between mb-3.5">
          <span class="text-sm font-extrabold ${parseFloat(lead.revenue) > 0 ? 'text-indigo-600' : 'text-slate-400'}">
            ${formatCurrency(lead.revenue)}
          </span>
          <span class="text-xs text-slate-400">${formatDate(lead.created_at)}</span>
        </div>

        <div class="flex gap-2">
          ${prev
            ? `<button onclick="updateLeadStatus(${lead.id}, '${escapeHtml(prev)}')"
                class="flex-1 text-[11px] border border-slate-200 text-slate-600 px-1.5 py-1.5 rounded-lg hover:bg-white transition-colors flex items-center justify-center gap-0.5 font-medium whitespace-nowrap">
                  <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
                  </svg>
                  ${STATUS_LABELS[prev]}
               </button>`
            : `<div class="flex-1"></div>`}
          ${next
            ? `<button onclick="updateLeadStatus(${lead.id}, '${escapeHtml(next)}')"
                class="flex-1 text-[11px] bg-indigo-600 text-white px-1.5 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-0.5 font-medium whitespace-nowrap">
                  ${STATUS_LABELS[next]}
                  <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/>
                  </svg>
               </button>`
            : `<div class="flex-1"></div>`}
        </div>`;
      col.appendChild(card);
    });

    document.getElementById('kanban-count-new').textContent         = COUNTS['New'];
    document.getElementById('kanban-count-in-progress').textContent = COUNTS['In Progress'];
    document.getElementById('kanban-count-won').textContent         = COUNTS['Won'];
    document.getElementById('kanban-count-lost').textContent        = COUNTS['Lost'];

  } catch (err) {
    showToast('Savdo yo\'lini yuklashda xato', 'error');
  }
};

// ─── Modal yopish ─────────────────────────────────────────────────────────────

document.getElementById('add-lead-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('add-lead-modal')) closeAddLeadModal();
});
document.getElementById('edit-lead-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('edit-lead-modal')) closeEditModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeAddLeadModal(); closeEditModal(); }
});

// ─── Ishga tushirish ──────────────────────────────────────────────────────────

loadDashboard();
