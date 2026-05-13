// ─────────────────────────────────────────────
// API Service — responsable de los fetch
// ─────────────────────────────────────────────
class ProductService {
  static BASE = 'https://dummyjson.com/products';

  static async getAll(limit, skip) {
    const res = await fetch(`${this.BASE}?limit=${limit}&skip=${skip}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  static async search(query, limit, skip) {
    const res = await fetch(
      `${this.BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}&skip=${skip}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}

// ─────────────────────────────────────────────
// State — estado centralizado de la app
// ─────────────────────────────────────────────
class AppState {
  constructor() {
    this.currentPage = 1;
    this.limit       = 20;
    this.total       = 0;
    this.query       = '';
  }

  get skip() {
    return (this.currentPage - 1) * this.limit;
  }

  get totalPages() {
    return Math.ceil(this.total / this.limit);
  }
}

// ─────────────────────────────────────────────
// ProductCard — genera el HTML de una tarjeta
// ─────────────────────────────────────────────
class ProductCard {
  constructor(product, index) {
    this.p = product;
    this.i = index;
  }

  render() {
    const { p, i } = this;
    return `
      <div class="card" style="animation-delay:${i * 0.04}s">
        <img
          class="card-img"
          src="${p.thumbnail}"
          alt="${p.title}"
          loading="lazy"
          onerror="this.src='https://dummyjson.com/icon/1/150'"
        >
        <div class="card-body">
          <div class="card-category">${p.category}</div>
          <div class="card-title">${p.title}</div>
          <div class="card-footer">
            <span class="price">$${p.price.toFixed(2)}</span>
            <span class="rating"><span>★</span> ${p.rating}</span>
          </div>
        </div>
      </div>`;
  }
}

// ─────────────────────────────────────────────
// Pagination — genera los botones de página
// ─────────────────────────────────────────────
class Pagination {
  /**
   * @param {number} current  - página actual
   * @param {number} total    - total de páginas
   * @param {Function} onPage - callback(page)
   */
  constructor(current, total, onPage) {
    this.current = current;
    this.total   = total;
    this.onPage  = onPage;
  }

  // Devuelve el array de números/elipsis a mostrar
  _pageNumbers() {
    const { current, total } = this;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages = [1];
    if (current > 3) pages.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push('…');
    pages.push(total);
    return pages;
  }

  render() {
    if (this.total <= 1) return '';
    const { current, total } = this;

    const prevBtn = `<button class="page-btn wide" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>← Ant</button>`;
    const nextBtn = `<button class="page-btn wide" data-page="${current + 1}" ${current === total ? 'disabled' : ''}>Sig →</button>`;

    const pageButtons = this._pageNumbers().map(p =>
      p === '…'
        ? `<button class="page-btn" disabled>…</button>`
        : `<button class="page-btn ${p === current ? 'active' : ''}" data-page="${p}">${p}</button>`
    ).join('');

    return prevBtn + pageButtons + nextBtn;
  }
}

// ─────────────────────────────────────────────
// App — orquesta todo
// ─────────────────────────────────────────────
class App {
  constructor() {
    this.state = new AppState();

    // Referencias al DOM
    this.$grid        = document.getElementById('grid');
    this.$pagination  = document.getElementById('pagination');
    this.$infoBar     = document.getElementById('info-bar');
    this.$totalBadge  = document.getElementById('total-badge');
    this.$searchInput = document.getElementById('search-input');
    this.$limitSelect = document.getElementById('limit-select');

    this._debounceTimer = null;

    this._bindEvents();
    this.fetchProducts();
  }

  // ── Eventos ──────────────────────────────────
  _bindEvents() {
    // Search: se lee searchInput.value en el momento de ejecutar (no del evento)
    this.$searchInput.addEventListener('input', () => {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        const q = this.$searchInput.value.trim();
        if (q === this.state.query) return; // sin cambio real, no re-fetches
        this.state.query       = q;
        this.state.currentPage = 1;
        this.fetchProducts();
      }, 400);
    });

    this.$limitSelect.addEventListener('change', () => {
      this.state.limit       = parseInt(this.$limitSelect.value);
      this.state.currentPage = 1;
      this.fetchProducts();
    });

    // Paginación por delegación — un solo listener
    this.$pagination.addEventListener('click', e => {
      const btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      const page = parseInt(btn.dataset.page);
      this._goToPage(page);
    });
  }

  // ── Navegación ───────────────────────────────
  _goToPage(page) {
    if (page < 1 || page > this.state.totalPages) return;
    this.state.currentPage = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.fetchProducts();
  }

  // ── Fetch ────────────────────────────────────
  async fetchProducts() {
    const { query, limit, skip } = this.state;

    this.$grid.innerHTML       = '<div class="loader"><div class="spinner"></div></div>';
    this.$pagination.innerHTML = '';

    try {
      const data = query
        ? await ProductService.search(query, limit, skip)
        : await ProductService.getAll(limit, skip);

      this.state.total = data.total;
      this._renderProducts(data.products);
      this._renderPagination();
      this._renderInfoBar(skip, data.products.length);
      this.$totalBadge.textContent = `${data.total} productos`;

    } catch (err) {
      this.$grid.innerHTML    = `<div class="error-msg">Error al cargar: ${err.message}</div>`;
      this.$infoBar.textContent = 'Error al obtener datos.';
    }
  }

  // ── Renders ──────────────────────────────────
  _renderProducts(products) {
    if (!products.length) {
      this.$grid.innerHTML = '<div class="empty-msg">No se encontraron productos.</div>';
      return;
    }
    this.$grid.innerHTML = products
      .map((p, i) => new ProductCard(p, i).render())
      .join('');
  }

  _renderPagination() {
    const { currentPage, totalPages } = this.state;
    const pg = new Pagination(currentPage, totalPages, page => this._goToPage(page));
    this.$pagination.innerHTML = pg.render();
  }

  _renderInfoBar(skip, count) {
    const from = skip + 1;
    const to   = skip + count;
    this.$infoBar.innerHTML =
      `Mostrando <strong>${from}–${to}</strong> de <strong>${this.state.total}</strong> productos`;
  }
}

// ── Bootstrap ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => new App());
