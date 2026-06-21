/* ============================================================
   Odoo Café POS — Customer Self Ordering Logic
   ============================================================ */

let selfProducts = [];
let selfCategories = [];
let selfCart = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadSelfCategories();
  await loadSelfProducts();

  document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
  document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('show'); }));

  document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);
  document.getElementById('closeConfirmBtn').addEventListener('click', () => {
    closeModal('confirmModal');
    selfCart = [];
    renderSelfCart();
  });
});

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function openCartModal() { renderSelfCartModal(); openModal('cartModal'); }

async function loadSelfCategories() {
  selfCategories = await api('/api/categories');
  const pillsContainer = document.getElementById('catPills');
  pillsContainer.innerHTML = '<button class="cat-pill active" data-cat="">All</button>' +
    selfCategories.map(c => `<button class="cat-pill" data-cat="${c.id}">${c.name}</button>`).join('');
  pillsContainer.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pillsContainer.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderMenu();
    });
  });
}

async function loadSelfProducts() {
  selfProducts = await api('/api/products');
  renderMenu();
}

function renderMenu() {
  const activeCat = document.querySelector('.cat-pill.active')?.dataset.cat || '';
  const container = document.getElementById('menuContainer');
  let categoriesToShow = activeCat ? selfCategories.filter(c => String(c.id) === activeCat) : selfCategories;

  container.innerHTML = categoriesToShow.map(cat => {
    const items = selfProducts.filter(p => p.category_id === cat.id && p.status === 'active');
    if (!items.length) return '';
    return `
      <div class="menu-section">
        <h3 style="border-color:${cat.color};">${cat.name}</h3>
        <div class="product-grid">
          ${items.map(p => `
            <div class="product-card glass-card" onclick="addToSelfCart(${p.id})">
              <img class="pimg" src="${p.image}" alt="${p.name}" onerror="this.src='/static/images/placeholder.svg'">
              <h4>${p.name}</h4>
              <div class="pprice">${formatCurrency(p.price)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('') || `<div class="empty-state"><div class="ic">🍽️</div>No items available</div>`;
}

function addToSelfCart(productId) {
  const product = selfProducts.find(p => p.id === productId);
  if (!product) return;
  const existing = selfCart.find(i => i.product_id === productId);
  if (existing) existing.quantity += 1;
  else selfCart.push({ product_id: product.id, name: product.name, price: product.price, tax: product.tax, image: product.image, quantity: 1 });
  renderSelfCart();
  showToast(`${product.name} added to cart`, 'success');
}

function changeSelfQty(productId, delta) {
  const item = selfCart.find(i => i.product_id === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) selfCart = selfCart.filter(i => i.product_id !== productId);
  renderSelfCart();
  renderSelfCartModal();
}

function renderSelfCart() {
  const totalItems = selfCart.reduce((s, i) => s + i.quantity, 0);
  const btn = document.getElementById('floatingCartBtn');
  if (totalItems === 0) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'flex';
  const { grandTotal } = calcSelfTotals();
  document.getElementById('floatingCartCount').textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
  document.getElementById('floatingCartTotal').textContent = formatCurrency(grandTotal);
}

function calcSelfTotals() {
  const subtotal = selfCart.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = selfCart.reduce((s, i) => s + (i.price * i.quantity) * (i.tax / 100), 0);
  const grandTotal = subtotal + tax;
  return { subtotal, tax, grandTotal };
}

function renderSelfCartModal() {
  const container = document.getElementById('selfCartItems');
  if (!selfCart.length) {
    container.innerHTML = `<div class="empty-state"><div class="ic">🛒</div>Cart is empty</div>`;
  } else {
    container.innerHTML = selfCart.map(i => `
      <div class="cart-item">
        <img src="${i.image}" onerror="this.src='/static/images/placeholder.svg'">
        <div class="ci-info">
          <h5>${i.name}</h5>
          <div class="ci-price">${formatCurrency(i.price)} × ${i.quantity}</div>
        </div>
        <div class="qty-control">
          <button onclick="changeSelfQty(${i.product_id}, -1)">−</button>
          <span>${i.quantity}</span>
          <button onclick="changeSelfQty(${i.product_id}, 1)">+</button>
        </div>
      </div>
    `).join('');
  }
  const { subtotal, tax, grandTotal } = calcSelfTotals();
  document.getElementById('selfSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('selfTax').textContent = formatCurrency(tax);
  document.getElementById('selfGrandTotal').textContent = formatCurrency(grandTotal);
}

async function placeOrder() {
  if (!selfCart.length) { showToast('Your cart is empty', 'error'); return; }
  const payload = {
    table_id: TABLE_ID || null,
    order_type: 'self_order',
    items: selfCart.map(i => ({ product_id: i.product_id, quantity: i.quantity }))
  };
  try {
    const order = await api('/api/orders', { method: 'POST', body: payload });
    closeModal('cartModal');
    document.getElementById('confirmOrderNum').textContent = order.order_number;
    openModal('confirmModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
