/* ============================================================
   Odoo Café POS — Customer Dashboard Logic
   ============================================================ */

let custUser = null;
let custProducts = [];
let custCategories = [];
let cart = [];
let appliedCoupon = null;
let selectedPaymentMethod = 'cash';
let lastOrder = null;
let custLoyaltyPoints = 0;
let usePointsForDiscount = true;

document.addEventListener('DOMContentLoaded', async () => {
  custUser = await checkAuth(['customer']);
  if (!custUser) return;

  document.getElementById('userName').textContent = custUser.name;
  document.getElementById('userAvatar').textContent = getInitials(custUser.name);

  setupSidebarNav();
  setupModalClosers();

  await loadOverview();
  await loadCatPills();
  await loadProducts();

  document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logoutUser(); });
  document.getElementById('startOrderBtn').addEventListener('click', (e) => { e.preventDefault(); goToSection('pos'); });
  document.getElementById('viewOrdersBtn').addEventListener('click', (e) => { e.preventDefault(); goToSection('orders'); });

  document.getElementById('custPosSearch').addEventListener('input', debounce(loadProducts, 300));
  document.getElementById('custCheckoutBtn').addEventListener('click', () => submitOrder());
  document.getElementById('custCouponInput').addEventListener('blur', validateCouponInput);
  document.getElementById('usePointsToggle').addEventListener('change', (e) => {
    usePointsForDiscount = e.target.checked;
    recalcCartTotals();
  });

  document.querySelectorAll('.payment-method-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedPaymentMethod = card.dataset.method;
      document.getElementById('upiQrContainer').style.display = 'none';
    });
  });

  document.getElementById('confirmPaymentBtn').addEventListener('click', confirmPayment);
  document.getElementById('newOrderBtn').addEventListener('click', () => {
    closeModal('receiptModal');
    resetCart();
    loadOverview();
  });
});

function debounce(fn, delay) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); }; }
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function setupModalClosers() {
  document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
  document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('show'); }));
}

// ---------- Sidebar navigation ----------
function setupSidebarNav() {
  const links = document.querySelectorAll('.side-link[data-section]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      goToSection(link.dataset.section);
    });
  });
}

function goToSection(section) {
  const titles = { overview: 'My Dashboard', pos: 'POS Terminal', orders: 'My Orders' };
  document.querySelectorAll('.side-link[data-section]').forEach(l => l.classList.toggle('active', l.dataset.section === section));
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  document.getElementById('section-' + section).style.display = 'block';
  document.getElementById('pageTitle').textContent = titles[section];
  if (section === 'orders') loadMyOrders();
}

// ---------- Overview ----------
async function loadOverview() {
  try {
    const data = await api('/api/customer/me');
    document.getElementById('statTotalOrders').textContent = data.stats.total_orders;
    document.getElementById('statTotalSpent').textContent = formatCurrency(data.stats.total_spent);
    document.getElementById('statPendingOrders').textContent = data.stats.pending_orders;
    custLoyaltyPoints = data.stats.loyalty_points || 0;
    document.getElementById('statLoyaltyPoints').textContent = custLoyaltyPoints;
    document.getElementById('statLoyaltyPointsValue').textContent = `Worth ${formatCurrency(data.stats.points_value || 0)}`;
    renderOrdersTable('recentOrdersBody', data.recent_orders);
  } catch (e) {
    showToast(e.message, 'error');
  }
  loadPointsHistory();
}

async function loadPointsHistory() {
  try {
    const data = await api('/api/customer/points');
    custLoyaltyPoints = data.loyalty_points;
    const tbody = document.getElementById('pointsHistoryBody');
    if (!data.history.length) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="ic">⭐</div>No points activity yet — place an order to start earning!</div></td></tr>`;
      return;
    }
    tbody.innerHTML = data.history.map(h => `
      <tr>
        <td>${new Date(h.created_at).toLocaleDateString()} <span style="color:var(--text-muted); font-size:0.78rem;">${timeAgo(h.created_at)}</span></td>
        <td>${h.reason === 'earned' ? '⭐ Earned from order' : '🎁 Redeemed for discount'}</td>
        <td style="color:${h.change >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">${h.change >= 0 ? '+' : ''}${h.change}</td>
        <td>${h.balance_after}</td>
      </tr>
    `).join('');
  } catch (e) {
    // Non-critical — silently skip if it fails
  }
}

async function loadMyOrders() {
  try {
    const orders = await api('/api/customer/orders');
    renderOrdersTable('myOrdersBody', orders);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function statusBadge(status) {
  const map = { to_cook: 'badge-orange', preparing: 'badge-blue', completed: 'badge-green' };
  const label = { to_cook: 'To Cook', preparing: 'Preparing', completed: 'Completed' };
  return `<span class="badge ${map[status] || 'badge-gray'}">${label[status] || status}</span>`;
}

function paymentBadge(status) {
  return status === 'paid'
    ? `<span class="badge badge-green">Paid</span>`
    : `<span class="badge badge-red">Unpaid</span>`;
}

function renderOrdersTable(tbodyId, orders) {
  const tbody = document.getElementById(tbodyId);
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="ic">🧾</div>No orders yet</div></td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td>${o.order_number}</td>
      <td>${new Date(o.created_at).toLocaleDateString()} <span style="color:var(--text-muted); font-size:0.78rem;">${timeAgo(o.created_at)}</span></td>
      <td>${o.items.reduce((s, i) => s + i.quantity, 0)} item(s)</td>
      <td>${formatCurrency(o.grand_total)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>${paymentBadge(o.payment_status)}</td>
    </tr>
  `).join('');
}

// ---------- POS Terminal (self-checkout) ----------
async function loadCatPills() {
  custCategories = await api('/api/categories');
  const pillsContainer = document.getElementById('custCatPills');
  pillsContainer.innerHTML = '<button class="cat-pill active" data-cat="">All</button>' +
    custCategories.map(c => `<button class="cat-pill" data-cat="${c.id}">${c.name}</button>`).join('');

  pillsContainer.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pillsContainer.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      loadProducts();
    });
  });
}

async function loadProducts() {
  const search = document.getElementById('custPosSearch').value;
  const activeCat = document.querySelector('#custCatPills .cat-pill.active')?.dataset.cat || '';
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (activeCat) params.append('category_id', activeCat);
  custProducts = await api('/api/products?' + params.toString());
  renderProductGrid();
}

function renderProductGrid() {
  const grid = document.getElementById('custProductGrid');
  const active = custProducts.filter(p => p.status === 'active');
  if (!active.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="ic">🍽️</div>No products found</div>`;
    return;
  }
  grid.innerHTML = active.map(p => `
    <div class="product-card glass-card" onclick="addToCart(${p.id})">
      ${p.category_name ? `<span class="pcat-tag" style="background:${p.category_color}33; color:${p.category_color};">${p.category_name}</span>` : ''}
      <img class="pimg" src="${p.image}" alt="${p.name}" onerror="this.src='/static/images/placeholder.svg'">
      <h4>${p.name}</h4>
      <div class="pprice">${formatCurrency(p.price)}</div>
    </div>
  `).join('');
}

function addToCart(productId) {
  const product = custProducts.find(p => p.id === productId);
  if (!product) return;
  const existing = cart.find(i => i.product_id === productId);
  if (existing) existing.quantity += 1;
  else cart.push({ product_id: product.id, name: product.name, price: product.price, tax: product.tax, image: product.image, quantity: 1 });
  renderCart();
}

function changeQty(productId, delta) {
  const item = cart.find(i => i.product_id === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(i => i.product_id !== productId);
  renderCart();
}

function renderCart() {
  const container = document.getElementById('custCartItems');
  const countEl = document.getElementById('custCartCount');
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  countEl.textContent = `(${totalItems} item${totalItems !== 1 ? 's' : ''})`;

  if (!cart.length) {
    container.innerHTML = `<div class="empty-state"><div class="ic">🛒</div>Cart is empty</div>`;
  } else {
    container.innerHTML = cart.map(i => `
      <div class="cart-item">
        <img src="${i.image}" onerror="this.src='/static/images/placeholder.svg'">
        <div class="ci-info">
          <h5>${i.name}</h5>
          <div class="ci-price">${formatCurrency(i.price)} × ${i.quantity}</div>
        </div>
        <div class="qty-control">
          <button onclick="changeQty(${i.product_id}, -1)">−</button>
          <span>${i.quantity}</span>
          <button onclick="changeQty(${i.product_id}, 1)">+</button>
        </div>
      </div>
    `).join('');
  }
  recalcCartTotals();
}

function recalcCartTotals() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = cart.reduce((s, i) => s + (i.price * i.quantity) * (i.tax / 100), 0);
  let discount = 0;
  if (appliedCoupon) {
    discount = appliedCoupon.discount_type === 'percentage'
      ? subtotal * (appliedCoupon.discount_value / 100)
      : appliedCoupon.discount_value;
  }
  const payableBeforePoints = Math.max(subtotal + tax - discount, 0);

  // Preview how many points would be auto-applied (mirrors backend logic):
  // capped by available balance and by the remaining payable amount (1 pt = ₹1).
  let pointsDiscount = 0;
  const pointsRow = document.getElementById('custPointsDiscountRow');
  if (usePointsForDiscount && custLoyaltyPoints > 0) {
    const usablePoints = Math.min(custLoyaltyPoints, Math.floor(payableBeforePoints));
    pointsDiscount = usablePoints;
    if (usablePoints > 0) {
      pointsRow.style.display = 'flex';
      document.getElementById('custCartPointsDiscount').textContent = '- ' + formatCurrency(pointsDiscount) + ` (${usablePoints} pts)`;
    } else {
      pointsRow.style.display = 'none';
    }
  } else {
    pointsRow.style.display = 'none';
  }

  const grandTotal = Math.max(payableBeforePoints - pointsDiscount, 0);

  document.getElementById('custCartSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('custCartTax').textContent = formatCurrency(tax);
  document.getElementById('custCartDiscount').textContent = '- ' + formatCurrency(discount);
  document.getElementById('custCartGrandTotal').textContent = formatCurrency(grandTotal);
  return { subtotal, tax, discount, pointsDiscount, grandTotal };
}

async function validateCouponInput() {
  const code = document.getElementById('custCouponInput').value.trim();
  if (!code) { appliedCoupon = null; recalcCartTotals(); return; }
  try {
    const res = await api(`/api/coupons/validate/${code}`);
    appliedCoupon = res.coupon;
    showToast(`Coupon "${code}" applied!`, 'success');
  } catch (e) {
    appliedCoupon = null;
    showToast('Invalid coupon code', 'error');
  }
  recalcCartTotals();
}

function resetCart() {
  cart = [];
  appliedCoupon = null;
  document.getElementById('custCouponInput').value = '';
  renderCart();
}

// ---------- Order submission (self-checkout: place + pay in one flow) ----------
async function submitOrder() {
  if (!cart.length) { showToast('Cart is empty', 'error'); return; }

  const payload = {
    order_type: 'self_order',
    items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
    coupon_code: appliedCoupon ? appliedCoupon.code : null,
    use_points: usePointsForDiscount
  };

  try {
    const order = await api('/api/orders', { method: 'POST', body: payload });
    lastOrder = order;
    showToast(`Order ${order.order_number} placed!`, 'success');
    document.getElementById('paymentAmount').textContent = formatCurrency(order.grand_total);
    openModal('paymentModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function confirmPayment() {
  if (!lastOrder) return;
  try {
    const res = await api(`/api/orders/${lastOrder.id}/pay`, { method: 'POST', body: { method: selectedPaymentMethod } });

    if (selectedPaymentMethod === 'upi' && res.upi_qr) {
      document.getElementById('upiQrImg').src = res.upi_qr;
      document.getElementById('upiQrContainer').style.display = 'block';
      showToast('Scan the QR to complete UPI payment', 'info');
      setTimeout(() => finalizeReceipt(res.order, res.payment, res.points_earned), 1500);
      return;
    }
    finalizeReceipt(res.order, res.payment, res.points_earned);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function finalizeReceipt(order, payment, pointsEarned) {
  closeModal('paymentModal');
  renderReceipt(order, payment, pointsEarned);
  openModal('receiptModal');
  loadOverview(); // refresh points balance + stats now that this order is paid
}

function renderReceipt(order, payment, pointsEarned) {
  const itemsHtml = order.items.map(i => `
    <div class="r-row"><span>${i.product_name} ×${i.quantity}</span><span>${formatCurrency(i.subtotal)}</span></div>
  `).join('');
  const pointsRedeemedHtml = order.points_redeemed > 0
    ? `<div class="r-row"><span>⭐ Points Redeemed</span><span>-${order.points_redeemed} pts (-${formatCurrency(order.points_discount)})</span></div>`
    : '';
  const pointsEarnedHtml = pointsEarned > 0
    ? `<div class="r-row"><span>⭐ Points Earned</span><span>+${pointsEarned} pts</span></div>`
    : '';
  document.getElementById('receiptContent').innerHTML = `
    <div class="r-head">
      <h3>☕ Odoo Café</h3>
      <p style="font-size:0.78rem; color:var(--text-muted);">${new Date(order.created_at).toLocaleString()}</p>
      <p style="font-size:0.78rem;">Order #${order.order_number}</p>
    </div>
    ${itemsHtml}
    <div class="r-divider"></div>
    <div class="r-row"><span>Subtotal</span><span>${formatCurrency(order.subtotal)}</span></div>
    <div class="r-row"><span>Tax</span><span>${formatCurrency(order.tax_amount)}</span></div>
    <div class="r-row"><span>Discount</span><span>- ${formatCurrency(order.discount)}</span></div>
    <div class="r-divider"></div>
    <div class="r-row r-total"><span>TOTAL</span><span>${formatCurrency(order.grand_total)}</span></div>
    <div class="r-divider"></div>
    <div class="r-row"><span>Payment Method</span><span>${payment.method.toUpperCase()}</span></div>
    <div class="r-row"><span>Transaction Ref</span><span style="font-size:0.7rem;">${payment.transaction_ref}</span></div>
    ${(pointsRedeemedHtml || pointsEarnedHtml) ? '<div class="r-divider"></div>' : ''}
    ${pointsRedeemedHtml}
    ${pointsEarnedHtml}
    <p style="text-align:center; margin-top:16px; font-size:0.8rem; color:var(--text-muted);">Thank you for visiting!</p>
  `;
}
