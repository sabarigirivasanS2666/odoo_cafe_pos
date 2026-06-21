/* ============================================================
   Odoo Café POS — Shared Utilities
   ============================================================ */

// ---------- Toast notifications ----------
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------- API wrapper ----------
async function api(endpoint, options = {}) {
  const opts = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin'
  };
  if (options.body) opts.body = JSON.stringify(options.body);

  const res = await fetch(endpoint, opts);
  let data;
  try { data = await res.json(); } catch (e) { data = {}; }

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

// ---------- Currency formatting ----------
function formatCurrency(amount) {
  return '₹' + Number(amount).toFixed(2);
}

// ---------- Mobile nav toggle ----------
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }

  const sideToggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (sideToggle && sidebar) {
    sideToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
});

// ---------- Auth check for protected pages (client side hint) ----------
async function checkAuth(requiredRoles = []) {
  try {
    const data = await api('/api/auth/me');
    if (!data.authenticated) {
      window.location.href = '/login';
      return null;
    }
    if (requiredRoles.length && !requiredRoles.includes(data.user.role)) {
      window.location.href = '/login';
      return null;
    }
    return data.user;
  } catch (e) {
    window.location.href = '/login';
    return null;
  }
}

async function logoutUser() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  } catch (e) {
    window.location.href = '/';
  }
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
