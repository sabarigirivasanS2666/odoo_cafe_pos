/* ============================================================
   Odoo Café POS — Admin Dashboard Logic
   ============================================================ */

let currentUser = null;
let allCategories = [];
let allFloors = [];

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkAuth(['admin', 'employee']);
  if (!currentUser) return;

  document.getElementById('userName').textContent = currentUser.name;
  document.getElementById('userAvatar').textContent = getInitials(currentUser.name);

  setupSidebarNav();
  setupModalClosers();

  loadOverview();
  loadCategories();
  loadProducts();
  loadFloors();
  loadCustomers();
  loadCoupons();

  document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logoutUser(); });

  // Search & filters
  document.getElementById('productSearch').addEventListener('input', debounce(loadProducts, 300));
  document.getElementById('productCategoryFilter').addEventListener('change', loadProducts);
  document.getElementById('customerSearch').addEventListener('input', debounce(loadCustomers, 300));

  // Add buttons
  document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
  document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
  document.getElementById('addFloorBtn').addEventListener('click', () => openFloorModal());
  document.getElementById('addTableBtn').addEventListener('click', () => openTableModal());
  document.getElementById('addCustomerBtn').addEventListener('click', () => openCustomerModal());
  document.getElementById('addCouponBtn').addEventListener('click', () => openModal('couponModal'));

  // Forms
  document.getElementById('productForm').addEventListener('submit', submitProductForm);
  document.getElementById('categoryForm').addEventListener('submit', submitCategoryForm);
  document.getElementById('floorForm').addEventListener('submit', submitFloorForm);
  document.getElementById('tableForm').addEventListener('submit', submitTableForm);
  document.getElementById('customerForm').addEventListener('submit', submitCustomerForm);
  document.getElementById('couponForm').addEventListener('submit', submitCouponForm);

  // Duplicate buttons (only meaningful while editing an existing floor/table)
  document.getElementById('duplicateFloorBtn').addEventListener('click', () => {
    const id = document.getElementById('floorId').value;
    if (id) { closeModal('floorModal'); duplicateFloor(parseInt(id)); }
  });
  document.getElementById('duplicateTableBtn').addEventListener('click', () => {
    const id = document.getElementById('tableId').value;
    if (id) { closeModal('tableModal'); duplicateTable(parseInt(id)); }
  });
});

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ---------- Sidebar navigation ----------
function setupSidebarNav() {
  const links = document.querySelectorAll('.side-link[data-section]');
  const titles = {
    overview: 'Dashboard Overview', products: 'Product Management',
    categories: 'Category Management', floors: 'Floor & Table Management',
    customers: 'Customer Management', coupons: 'Coupons & Promotions'
  };
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
      const section = link.dataset.section;
      document.getElementById('section-' + section).style.display = 'block';
      document.getElementById('pageTitle').textContent = titles[section];
    });
  });
}

function setupModalClosers() {
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
  });
}
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

// ---------- Overview ----------
async function loadOverview() {
  try {
    const summary = await api('/api/reports/summary');
    document.getElementById('statOrders').textContent = summary.total_orders;
    document.getElementById('statRevenue').textContent = formatCurrency(summary.total_revenue);
    document.getElementById('statAOV').textContent = formatCurrency(summary.avg_order_value);
    const products = await api('/api/products');
    document.getElementById('statProducts').textContent = products.length;
  } catch (e) { console.error(e); }
}

// ---------- Categories ----------
async function loadCategories() {
  try {
    allCategories = await api('/api/categories');
    renderCategoriesTable();
    populateCategoryDropdowns();
  } catch (e) { showToast(e.message, 'error'); }
}

function renderCategoriesTable() {
  const tbody = document.getElementById('categoriesTableBody');
  if (!allCategories.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="ic">🏷️</div>No categories yet</div></td></tr>`;
    return;
  }
  tbody.innerHTML = allCategories.map(c => `
    <tr>
      <td>${c.name}</td>
      <td><span class="badge" style="background:${c.color}22; color:${c.color};">${c.color}</span></td>
      <td>—</td>
      <td class="table-actions">
        <button class="icon-btn" onclick="openCategoryModal(${c.id})">✏️</button>
        <button class="icon-btn danger" onclick="deleteCategory(${c.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function populateCategoryDropdowns() {
  const filterSel = document.getElementById('productCategoryFilter');
  const formSel = document.getElementById('productCategory');
  const opts = allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  filterSel.innerHTML = '<option value="">All Categories</option>' + opts;
  formSel.innerHTML = opts;
}

function openCategoryModal(id = null) {
  const form = document.getElementById('categoryForm');
  form.reset();
  document.getElementById('categoryId').value = '';
  document.getElementById('categoryModalTitle').textContent = id ? 'Edit Category' : 'Add Category';
  if (id) {
    const cat = allCategories.find(c => c.id === id);
    document.getElementById('categoryId').value = cat.id;
    document.getElementById('categoryName').value = cat.name;
    document.getElementById('categoryColor').value = cat.color;
  }
  openModal('categoryModal');
}

async function submitCategoryForm(e) {
  e.preventDefault();
  const id = document.getElementById('categoryId').value;
  const payload = { name: document.getElementById('categoryName').value, color: document.getElementById('categoryColor').value };
  try {
    if (id) await api(`/api/categories/${id}`, { method: 'PUT', body: payload });
    else await api('/api/categories', { method: 'POST', body: payload });
    showToast('Category saved', 'success');
    closeModal('categoryModal');
    loadCategories();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  try {
    await api(`/api/categories/${id}`, { method: 'DELETE' });
    showToast('Category deleted', 'success');
    loadCategories();
    loadProducts();
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------- Products ----------
async function loadProducts() {
  const search = document.getElementById('productSearch').value;
  const categoryId = document.getElementById('productCategoryFilter').value;
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (categoryId) params.append('category_id', categoryId);
  try {
    const products = await api('/api/products?' + params.toString());
    renderProductsTable(products);
  } catch (e) { showToast(e.message, 'error'); }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('productsTableBody');
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="ic">🍔</div>No products found</div></td></tr>`;
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><strong>${p.name}</strong><br><span style="color:var(--text-muted); font-size:0.78rem;">${p.description || ''}</span></td>
      <td>${p.category_name ? `<span class="badge" style="background:${p.category_color}22; color:${p.category_color};">${p.category_name}</span>` : '—'}</td>
      <td>${formatCurrency(p.price)} / ${p.unit}</td>
      <td>${p.tax}%</td>
      <td><span class="badge ${p.status === 'active' ? 'badge-green' : 'badge-gray'}">${p.status}</span></td>
      <td class="table-actions">
        <button class="icon-btn" onclick='openProductModal(${p.id})'>✏️</button>
        <button class="icon-btn danger" onclick="deleteProduct(${p.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function openProductModal(id = null) {
  const form = document.getElementById('productForm');
  form.reset();
  document.getElementById('productId').value = '';
  document.getElementById('productModalTitle').textContent = id ? 'Edit Product' : 'Add Product';
  document.getElementById('productTax').value = 5;
  document.getElementById('productUnit').value = 'pcs';
  if (id) {
    api(`/api/products/${id}`).then(p => {
      document.getElementById('productId').value = p.id;
      document.getElementById('productName').value = p.name;
      document.getElementById('productCategory').value = p.category_id || '';
      document.getElementById('productPrice').value = p.price;
      document.getElementById('productTax').value = p.tax;
      document.getElementById('productUnit').value = p.unit;
      document.getElementById('productStatus').value = p.status;
      document.getElementById('productImage').value = p.image;
      document.getElementById('productDescription').value = p.description || '';
    });
  }
  openModal('productModal');
}

async function submitProductForm(e) {
  e.preventDefault();
  const id = document.getElementById('productId').value;
  const payload = {
    name: document.getElementById('productName').value,
    category_id: document.getElementById('productCategory').value || null,
    price: document.getElementById('productPrice').value,
    tax: document.getElementById('productTax').value,
    unit: document.getElementById('productUnit').value,
    status: document.getElementById('productStatus').value,
    image: document.getElementById('productImage').value,
    description: document.getElementById('productDescription').value
  };
  try {
    if (id) await api(`/api/products/${id}`, { method: 'PUT', body: payload });
    else await api('/api/products', { method: 'POST', body: payload });
    showToast('Product saved', 'success');
    closeModal('productModal');
    loadProducts();
    loadOverview();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await api(`/api/products/${id}`, { method: 'DELETE' });
    showToast('Product deleted', 'success');
    loadProducts();
    loadOverview();
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------- Floors & Tables ----------
async function loadFloors() {
  try {
    allFloors = await api('/api/floors');
    renderFloors();
    populateFloorDropdown();
  } catch (e) { showToast(e.message, 'error'); }
}

function renderFloors() {
  const container = document.getElementById('floorsContainer');
  if (!allFloors.length) {
    container.innerHTML = `<div class="empty-state"><div class="ic">🪑</div>No floors yet</div>`;
    return;
  }
  container.innerHTML = allFloors.map(floor => `
    <div style="margin-bottom:24px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h4 style="color:var(--accent-light); margin:0;">${floor.name}</h4>
        <div class="table-actions">
          <button class="icon-btn" onclick="openFloorModal(${floor.id})" title="Edit Floor">✏️</button>
          <button class="icon-btn" onclick="duplicateFloor(${floor.id})" title="Duplicate Floor">📋</button>
          <button class="icon-btn danger" onclick="deleteFloor(${floor.id})" title="Delete Floor">🗑️</button>
        </div>
      </div>
      <div class="floor-tables-grid">
        ${floor.tables.map(t => `
          <div class="floor-table-card glass-card">
            <div class="ftc-number">Table ${t.number}</div>
            <div class="ftc-seats">${t.seats} seats</div>
            <div><span class="status-dot ${t.status === 'available' ? 'green' : 'red'}"></span>${t.status}</div>
            <div class="table-actions" style="justify-content:center; margin-top:10px;">
              <button class="icon-btn" onclick="openTableModal(${t.id})" title="Edit Table">✏️</button>
              <button class="icon-btn" onclick="duplicateTable(${t.id})" title="Duplicate Table">📋</button>
              <button class="icon-btn danger" onclick="deleteTable(${t.id})" title="Delete Table">🗑️</button>
            </div>
          </div>
        `).join('') || '<p style="color:var(--text-muted); font-size:0.85rem;">No tables on this floor</p>'}
      </div>
    </div>
  `).join('');
}

function populateFloorDropdown() {
  document.getElementById('tableFloor').innerHTML = allFloors.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
}

function openFloorModal(id = null) {
  const form = document.getElementById('floorForm');
  form.reset();
  document.getElementById('floorId').value = '';
  document.getElementById('floorModalTitle').textContent = id ? 'Edit Floor' : 'Add Floor';
  document.getElementById('duplicateFloorBtn').style.display = id ? 'block' : 'none';
  if (id) {
    const floor = allFloors.find(f => f.id === id);
    if (floor) {
      document.getElementById('floorId').value = floor.id;
      document.getElementById('floorName').value = floor.name;
    }
  }
  openModal('floorModal');
}

async function submitFloorForm(e) {
  e.preventDefault();
  const id = document.getElementById('floorId').value;
  const payload = { name: document.getElementById('floorName').value };
  try {
    if (id) await api(`/api/floors/${id}`, { method: 'PUT', body: payload });
    else await api('/api/floors', { method: 'POST', body: payload });
    showToast(id ? 'Floor updated' : 'Floor added', 'success');
    closeModal('floorModal');
    e.target.reset();
    loadFloors();
  } catch (err) { showToast(err.message, 'error'); }
}

async function duplicateFloor(id) {
  if (!confirm('Duplicate this floor along with all of its tables?')) return;
  try {
    await api(`/api/floors/${id}/duplicate`, { method: 'POST' });
    showToast('Floor duplicated', 'success');
    loadFloors();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteFloor(id) {
  if (!confirm('Delete this floor?')) return;
  try {
    await api(`/api/floors/${id}`, { method: 'DELETE' });
    showToast('Floor deleted', 'success');
    loadFloors();
  } catch (err) { showToast(err.message, 'error'); }
}

function openTableModal(id = null) {
  const form = document.getElementById('tableForm');
  form.reset();
  document.getElementById('tableId').value = '';
  document.getElementById('tableModalTitle').textContent = id ? 'Edit Table' : 'Add Table';
  document.getElementById('tableSeats').value = 4;
  document.getElementById('duplicateTableBtn').style.display = id ? 'block' : 'none';
  if (id) {
    const allTables = allFloors.flatMap(f => f.tables);
    const t = allTables.find(t => t.id === id);
    if (t) {
      document.getElementById('tableId').value = t.id;
      document.getElementById('tableNumber').value = t.number;
      document.getElementById('tableFloor').value = t.floor_id;
      document.getElementById('tableSeats').value = t.seats;
      document.getElementById('tableStatus').value = t.status;
    }
  }
  openModal('tableModal');
}

async function submitTableForm(e) {
  e.preventDefault();
  const id = document.getElementById('tableId').value;
  const payload = {
    number: document.getElementById('tableNumber').value,
    floor_id: document.getElementById('tableFloor').value,
    seats: document.getElementById('tableSeats').value,
    status: document.getElementById('tableStatus').value
  };
  try {
    if (id) await api(`/api/tables/${id}`, { method: 'PUT', body: payload });
    else await api('/api/tables', { method: 'POST', body: payload });
    showToast('Table saved', 'success');
    closeModal('tableModal');
    loadFloors();
  } catch (err) { showToast(err.message, 'error'); }
}

async function duplicateTable(id) {
  try {
    await api(`/api/tables/${id}/duplicate`, { method: 'POST' });
    showToast('Table duplicated', 'success');
    loadFloors();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteTable(id) {
  if (!confirm('Delete this table?')) return;
  try {
    await api(`/api/tables/${id}`, { method: 'DELETE' });
    showToast('Table deleted', 'success');
    loadFloors();
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------- Customers ----------
async function loadCustomers() {
  const search = document.getElementById('customerSearch').value;
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  try {
    const customers = await api('/api/customers?' + params.toString());
    renderCustomersTable(customers);
  } catch (e) { showToast(e.message, 'error'); }
}

function renderCustomersTable(customers) {
  const tbody = document.getElementById('customersTableBody');
  if (!customers.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="ic">👥</div>No customers found</div></td></tr>`;
    return;
  }
  tbody.innerHTML = customers.map(c => `
    <tr>
      <td>${c.name}</td><td>${c.email || '—'}</td><td>${c.phone || '—'}</td><td>${c.address || '—'}</td>
      <td class="table-actions">
        <button class="icon-btn" onclick='openCustomerModal(${c.id})'>✏️</button>
        <button class="icon-btn danger" onclick="deleteCustomer(${c.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

let customersCache = [];
async function openCustomerModal(id = null) {
  const form = document.getElementById('customerForm');
  form.reset();
  document.getElementById('customerId').value = '';
  document.getElementById('customerModalTitle').textContent = id ? 'Edit Customer' : 'Add Customer';
  if (id) {
    if (!customersCache.length) customersCache = await api('/api/customers');
    const c = customersCache.find(c => c.id === id) || await api(`/api/customers/${id}`).catch(() => null);
    if (c) {
      document.getElementById('customerId').value = c.id;
      document.getElementById('customerName').value = c.name;
      document.getElementById('customerEmail').value = c.email || '';
      document.getElementById('customerPhone').value = c.phone || '';
      document.getElementById('customerAddress').value = c.address || '';
    }
  }
  openModal('customerModal');
}

async function submitCustomerForm(e) {
  e.preventDefault();
  const id = document.getElementById('customerId').value;
  const payload = {
    name: document.getElementById('customerName').value,
    email: document.getElementById('customerEmail').value,
    phone: document.getElementById('customerPhone').value,
    address: document.getElementById('customerAddress').value
  };
  try {
    if (id) await api(`/api/customers/${id}`, { method: 'PUT', body: payload });
    else await api('/api/customers', { method: 'POST', body: payload });
    showToast('Customer saved', 'success');
    closeModal('customerModal');
    customersCache = [];
    loadCustomers();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteCustomer(id) {
  if (!confirm('Delete this customer?')) return;
  try {
    await api(`/api/customers/${id}`, { method: 'DELETE' });
    showToast('Customer deleted', 'success');
    loadCustomers();
  } catch (err) { showToast(err.message, 'error'); }
}

// ---------- Coupons ----------
async function loadCoupons() {
  try {
    const coupons = await api('/api/coupons');
    renderCouponsTable(coupons);
  } catch (e) { showToast(e.message, 'error'); }
}

function renderCouponsTable(coupons) {
  const tbody = document.getElementById('couponsTableBody');
  if (!coupons.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="ic">🎟️</div>No coupons yet</div></td></tr>`;
    return;
  }
  tbody.innerHTML = coupons.map(c => {
    const expired = c.is_expired;
    const statusLabel = !c.active ? 'Inactive' : (expired ? 'Expired' : 'Active');
    const statusClass = !c.active ? 'badge-gray' : (expired ? 'badge-red' : 'badge-green');
    const expiresText = c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : '—';
    return `
    <tr>
      <td><strong>${c.code}</strong></td>
      <td>${c.discount_type === 'percentage' ? 'Percentage' : 'Fixed'}</td>
      <td>${c.discount_type === 'percentage' ? c.discount_value + '%' : formatCurrency(c.discount_value)}</td>
      <td>${expiresText}</td>
      <td><span class="badge ${statusClass}">${statusLabel}</span></td>
    </tr>
  `;
  }).join('');
}

async function submitCouponForm(e) {
  e.preventDefault();
  const payload = {
    code: document.getElementById('couponCode').value,
    discount_type: document.getElementById('couponType').value,
    discount_value: document.getElementById('couponValue').value
  };
  try {
    await api('/api/coupons', { method: 'POST', body: payload });
    showToast('Coupon created', 'success');
    closeModal('couponModal');
    e.target.reset();
    loadCoupons();
  } catch (err) { showToast(err.message, 'error'); }
}
