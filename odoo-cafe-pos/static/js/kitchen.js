/* ============================================================
   Odoo Café POS — Kitchen Display System Logic
   ============================================================ */

let kdsOrders = [];
let kdsSearchTerm = '';
let pollInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth(['admin', 'employee']);
  if (!user) return;

  document.getElementById('userName').textContent = user.name;
  document.getElementById('userAvatar').textContent = getInitials(user.name);
  document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logoutUser(); });
  document.getElementById('kdsSearch').addEventListener('input', (e) => {
    kdsSearchTerm = e.target.value.toLowerCase();
    renderColumns();
  });

  await loadOrders();
  // Poll every 5 seconds for "real-time" updates
  pollInterval = setInterval(loadOrders, 5000);
});

async function loadOrders() {
  try {
    kdsOrders = await api('/api/orders');
    renderColumns();
  } catch (e) { console.error(e); }
}

function renderColumns() {
  const filtered = kdsSearchTerm
    ? kdsOrders.filter(o => o.order_number.toLowerCase().includes(kdsSearchTerm))
    : kdsOrders;

  const toCook = filtered.filter(o => o.status === 'to_cook');
  const preparing = filtered.filter(o => o.status === 'preparing');
  const completed = filtered.filter(o => o.status === 'completed').slice(0, 100000);

  document.getElementById('countToCook').textContent = toCook.length;
  document.getElementById('countPreparing').textContent = preparing.length;
  document.getElementById('countCompleted').textContent = completed.length;

  document.getElementById('colToCook').innerHTML = toCook.length ? toCook.map(o => renderCard(o, 'to_cook')).join('') : emptyMsg();
  document.getElementById('colPreparing').innerHTML = preparing.length ? preparing.map(o => renderCard(o, 'preparing')).join('') : emptyMsg();
  document.getElementById('colCompleted').innerHTML = completed.length ? completed.map(o => renderCard(o, 'completed')).join('') : emptyMsg();
}

function emptyMsg() {
  return `<div class="empty-state"><div class="ic">📭</div>No orders</div>`;
}

function renderCard(order, status) {
  const itemsHtml = order.items.map(i => `<li>${i.quantity}× ${i.product_name}</li>`).join('');
  let actionsHtml = '';
  if (status === 'to_cook') {
    actionsHtml = `<button class="btn btn-primary btn-sm btn-block" onclick="updateStatus(${order.id}, 'preparing')">Start Preparing</button>`;
  } else if (status === 'preparing') {
    actionsHtml = `<button class="btn btn-success btn-sm btn-block" onclick="updateStatus(${order.id}, 'completed')">Mark Completed</button>`;
  } else {
    actionsHtml = `<span class="badge badge-green">✓ Done</span>`;
  }

  const tableLabel = order.table_number ? `Table ${order.table_number}` : (order.order_type === 'self_order' ? 'Self Order' : 'Counter');

  return `
    <div class="kds-card glass-card">
      <div class="kds-card-head">
        <span class="kds-order-num">${order.order_number}</span>
        <span class="kds-time">${timeAgo(order.created_at)}</span>
      </div>
      <div style="font-size:0.78rem; color:var(--text-secondary);">📍 ${tableLabel}</div>
      <ul>${itemsHtml}</ul>
      <div class="kds-actions">${actionsHtml}</div>
    </div>
  `;
}

async function updateStatus(orderId, newStatus) {
  try {
    await api(`/api/orders/${orderId}/status`, { method: 'PUT', body: { status: newStatus } });
    showToast(`Order moved to ${newStatus.replace('_', ' ')}`, 'success');
    loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
