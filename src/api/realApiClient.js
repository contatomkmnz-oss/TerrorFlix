/**
 * Cliente HTTP para API real (Neon + Prisma). Mantém o formato das entidades do mock onde possível.
 * MyList, WatchHistory, Profile, User, etc. continuam em localStorage (delegado ao mock).
 */
import { localMockClient } from '@/api/localMockClient';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function apiUrl(path) {
  if (path.startsWith('http')) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

async function apiJson(path, options = {}) {
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error || data?.raw || text || res.statusText;
    throw new Error(typeof msg === 'string' ? msg : 'Pedido falhou');
  }
  return data;
}

function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

function sortEpisodes(rows, sortField) {
  let field = sortField || '-season';
  let desc = false;
  if (field.startsWith('-')) {
    desc = true;
    field = field.slice(1);
  }
  const key = field === 'season' ? 'season' : field;
  return [...rows].sort((a, b) => {
    const va = a[key] ?? 0;
    const vb = b[key] ?? 0;
    if (va === vb) return 0;
    const cmp = va < vb ? -1 : 1;
    return desc ? -cmp : cmp;
  });
}

const seriesEntity = {
  async filter(query, sortField, limit) {
    const q = {};
    if (query?.id) q.id = query.id;
    if (query?.published !== undefined) q.published = query.published;
    if (query?.content_type) q.content_type = query.content_type;
    if (sortField) q.sort = sortField;
    if (limit) q.limit = limit;
    const rows = await apiJson(`/api/catalog/series${qs(q)}`);
    return Array.isArray(rows) ? rows : [];
  },

  async list(sortField, limit) {
    const q = {};
    if (sortField) q.sort = sortField;
    if (limit) q.limit = limit;
    const rows = await apiJson(`/api/catalog/series${qs(q)}`);
    return Array.isArray(rows) ? rows : [];
  },

  async create(data) {
    return apiJson('/api/admin/series', { method: 'POST', body: JSON.stringify(data) });
  },

  async update(id, data) {
    return apiJson(`/api/admin/series/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id) {
    await apiJson(`/api/admin/series/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  subscribe() {
    return () => {};
  },

  async bulkCreate() {
    throw new Error('bulkCreate não disponível na API');
  },
};

const episodeEntity = {
  async filter(query) {
    const seriesId = query?.series_id;
    const rows = await apiJson(`/api/catalog/episodes${qs(seriesId ? { series_id: seriesId } : {})}`);
    return Array.isArray(rows) ? rows : [];
  },

  async list(sortField, limit) {
    let rows = await apiJson('/api/catalog/episodes');
    rows = sortEpisodes(rows, sortField);
    if (typeof limit === 'number' && limit > 0) rows = rows.slice(0, limit);
    return rows;
  },

  async create(data) {
    return apiJson('/api/admin/episodes', { method: 'POST', body: JSON.stringify(data) });
  },

  async update(id, data) {
    return apiJson(`/api/admin/episodes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id) {
    await apiJson(`/api/admin/episodes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  subscribe() {
    return () => {};
  },

  async bulkCreate() {
    throw new Error('bulkCreate não disponível na API');
  },
};

const featuredBannerEntity = {
  async filter(query, sortField) {
    const active = query?.active;
    const q = active !== undefined ? { active: String(active) } : {};
    let rows = await apiJson(`/api/catalog/banners${qs(q)}`);
    if (!Array.isArray(rows)) rows = [];
    if (sortField === 'order' || sortField === '-order') {
      rows = [...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return rows;
  },

  async list(sortField, limit) {
    let rows = await apiJson('/api/catalog/banners');
    if (!Array.isArray(rows)) rows = [];
    if (sortField === 'order' || sortField === '-order') {
      rows = [...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    if (typeof limit === 'number' && limit > 0) rows = rows.slice(0, limit);
    return rows;
  },

  async create(data) {
    return apiJson('/api/admin/hero-banners', { method: 'POST', body: JSON.stringify(data) });
  },

  async update(id, data) {
    return apiJson(`/api/admin/hero-banners/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id) {
    await apiJson(`/api/admin/hero-banners/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  subscribe() {
    return () => {};
  },

  async bulkCreate() {
    throw new Error('bulkCreate não disponível na API');
  },
};

export const realApiClient = {
  auth: {
    async me() {
      try {
        return await apiJson('/api/auth/me');
      } catch {
        return { id: 'guest-viewer', email: null, role: 'user', activated: true };
      }
    },
    logout() {
      fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' }).catch(() => {});
    },
    redirectToLogin() {
      if (typeof window !== 'undefined') window.location.href = '/AdminLogin';
    },
    async updateMe(patch) {
      const me = await this.me();
      return { ...me, ...patch };
    },
  },

  entities: {
    ...localMockClient.entities,
    Series: seriesEntity,
    Episode: episodeEntity,
    FeaturedBanner: featuredBannerEntity,
  },

  functions: localMockClient.functions,
  integrations: localMockClient.integrations,
};
