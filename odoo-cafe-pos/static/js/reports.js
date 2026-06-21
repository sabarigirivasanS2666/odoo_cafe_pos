/* ============================================================
   Odoo Café POS — Reports Dashboard Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth(['admin']);
  if (!user) return;

  document.getElementById('userName').textContent = user.name;
  document.getElementById('userAvatar').textContent = getInitials(user.name);
  document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logoutUser(); });

  await loadReports();
});

const chartColors = ['#ff7a00', '#3b82f6', '#22c55e', '#ec4899', '#eab308', '#a855f7'];

Chart.defaults.color = '#5a5f6e';
Chart.defaults.borderColor = 'rgba(15,17,21,0.08)';
Chart.defaults.font.family = "'Segoe UI', sans-serif";

async function loadReports() {
  try {
    const summary = await api('/api/reports/summary');

    document.getElementById('rOrders').textContent = summary.total_orders;
    document.getElementById('rRevenue').textContent = formatCurrency(summary.total_revenue);
    document.getElementById('rAOV').textContent = formatCurrency(summary.avg_order_value);

    renderMonthlySalesChart(summary.monthly_sales);
    renderTopProductsChart(summary.top_products);
    renderTopCategoriesChart(summary.top_categories);
    renderOverviewChart(summary);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function renderMonthlySalesChart(data) {
  const ctx = document.getElementById('monthlySalesChart');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.month),
      datasets: [{
        label: 'Revenue (₹)',
        data: data.map(d => d.revenue),
        borderColor: '#ff7a00',
        backgroundColor: 'rgba(255,122,0,0.15)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#ff7a00'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { grid: { color: 'rgba(15,17,21,0.06)' } }, x: { grid: { display: false } } }
    }
  });
}

function renderTopProductsChart(data) {
  const ctx = document.getElementById('topProductsChart');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        label: 'Quantity Sold',
        data: data.map(d => d.quantity),
        backgroundColor: chartColors,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: 'rgba(15,17,21,0.06)' } }, y: { grid: { display: false } } }
    }
  });
}

function renderTopCategoriesChart(data) {
  const ctx = document.getElementById('topCategoriesChart');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        data: data.map(d => d.revenue),
        backgroundColor: chartColors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderOverviewChart(summary) {
  const ctx = document.getElementById('overviewChart');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Total Orders', 'Avg Order Value (₹)'],
      datasets: [{
        label: 'Value',
        data: [summary.total_orders, summary.avg_order_value],
        backgroundColor: ['#3b82f6', '#22c55e'],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { grid: { color: 'rgba(15,17,21,0.06)' } }, x: { grid: { display: false } } }
    }
  });
}
