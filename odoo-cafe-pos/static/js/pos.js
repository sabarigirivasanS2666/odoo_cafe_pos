/* ============================================================
   Odoo Café POS — POS Terminal Logic
   ============================================================ */

let posUser = null;
let posProducts = [];
let posCategories = [];
let posTables = [];
let cart = [];
let selectedTableId = null;
let appliedCoupon = null;
let selectedPaymentMethod = 'cash';
let lastOrder = null;

document.addEventListener('DOMContentLoaded', async () => {
  posUser = await checkAuth(['admin', 'employee']);
  if (!posUser) return;

  document.getElementById('userName').textContent = posUser.name;
  document.getElementById('userAvatar').textContent = getInitials(posUser.name);

  await loadPosCategories();
  await loadPosProducts();
  await loadPosTables();

  document.getElementById('posSearch').addEventListener('input', debounce(loadPosProducts, 300));
  document.getElementById('sendToKitchenBtn').addEventListener('click', () => submitOrder(false));
  document.getElementById('checkoutBtn').addEventListener('click', () => submitOrder(true));
  document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logoutUser(); });
  document.getElementById('couponInput').addEventListener('blur', validateCouponInput);

  document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
  document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('show'); }));

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
  });
});

function debounce(fn, delay) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); }; }
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

// ---------- Load data ----------
async function loadPosCategories() {
  posCategories = await api('/api/categories');
  const pillsContainer = document.getElementById('catPills');
  pillsContainer.innerHTML = '<button class="cat-pill active" data-cat="">All</button>' +
    posCategories.map(c => `<button class="cat-pill" data-cat="${c.id}">${c.name}</button>`).join('');

  pillsContainer.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pillsContainer.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      loadPosProducts();
    });
  });
}

async function loadPosProducts() {
  const search = document.getElementById('posSearch').value;
  const activeCat = document.querySelector('.cat-pill.active')?.dataset.cat || '';
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (activeCat) params.append('category_id', activeCat);
  posProducts = await api('/api/products?' + params.toString());
  renderProductGrid();
}

function renderProductGrid() {
  const grid = document.getElementById('posProductGrid');
  const active = posProducts.filter(p => p.status === 'active');
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

async function loadPosTables() {
  posTables = await api('/api/tables');
  const grid = document.getElementById('tableSelectGrid');
  grid.innerHTML = posTables.map(t => `
    <div class="mini-table ${t.status}" data-id="${t.id}" onclick="selectTable(${t.id})">T${t.number}</div>
  `).join('');
}

function selectTable(id) {
  selectedTableId = id;
  document.querySelectorAll('.mini-table').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.id) === id);
  });
}

// ---------- Cart logic ----------
function addToCart(productId) {
  const product = posProducts.find(p => p.id === productId);
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
  const container = document.getElementById('cartItems');
  const countEl = document.getElementById('cartCount');
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
  const grandTotal = Math.max(subtotal + tax - discount, 0);

  document.getElementById('cartSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('cartTax').textContent = formatCurrency(tax);
  document.getElementById('cartDiscount').textContent = '- ' + formatCurrency(discount);
  document.getElementById('cartGrandTotal').textContent = formatCurrency(grandTotal);
  return { subtotal, tax, discount, grandTotal };
}

async function validateCouponInput() {
  const code = document.getElementById('couponInput').value.trim();
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
  document.getElementById('couponInput').value = '';
  selectedTableId = null;
  document.querySelectorAll('.mini-table').forEach(el => el.classList.remove('selected'));
  renderCart();
  loadPosTables();
}

// ---------- Order submission ----------
async function submitOrder(proceedToPayment) {
  if (!cart.length) { showToast('Cart is empty', 'error'); return; }

  if (!selectedTableId) {
    showToast('Please select a table before sending the order', 'error');
    highlightTableRequired();
    return;
  }

  const payload = {
    table_id: selectedTableId,
    order_type: 'pos',
    items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
    coupon_code: appliedCoupon ? appliedCoupon.code : null
  };

  try {
    const order = await api('/api/orders', { method: 'POST', body: payload });
    lastOrder = order;
    showToast(`Order ${order.order_number} sent to kitchen!`, 'success');

    if (proceedToPayment) {
      document.getElementById('paymentAmount').textContent = formatCurrency(order.grand_total);
      openModal('paymentModal');
    } else {
      resetCart();
    }
  } catch (err) {
    showToast(err.message, 'error');
    if (/table/i.test(err.message)) highlightTableRequired();
  }
}

function highlightTableRequired() {
  const grid = document.getElementById('tableSelectGrid');
  grid.classList.add('required-missing');
  setTimeout(() => grid.classList.remove('required-missing'), 1500);
}

async function confirmPayment() {
  if (!lastOrder) return;
  try {
    const res = await api(`/api/orders/${lastOrder.id}/pay`, { method: 'POST', body: { method: selectedPaymentMethod } });

    if (selectedPaymentMethod === 'upi' && res.upi_qr) {
      document.getElementById('upiQrImg').src = res.upi_qr;
      document.getElementById('upiQrContainer').style.display = 'block';
      showToast('Scan the QR to complete UPI payment', 'info');
      setTimeout(() => finalizeReceipt(res.order, res.payment), 1500);
      return;
    }
    finalizeReceipt(res.order, res.payment);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function finalizeReceipt(order, payment) {
  closeModal('paymentModal');
  renderReceipt(order, payment);
  openModal('receiptModal');
}

function renderReceipt(order, payment) {
  const itemsHtml = order.items.map(i => `
    <div class="r-row"><span>${i.product_name} ×${i.quantity}</span><span>${formatCurrency(i.subtotal)}</span></div>
  `).join('');
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
    <p style="text-align:center; margin-top:16px; font-size:0.8rem; color:var(--text-muted);">Thank you for visiting!</p>
  `;
}
