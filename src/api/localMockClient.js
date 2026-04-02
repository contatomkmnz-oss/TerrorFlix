import { buildMockSeed } from '@/data/mockSeed';
import { profileAvatarsSeed } from '@/data/profileAvatars';
import { demoBypassSubscription } from '@/config/demo';
import {
  mockTableKey,
  LS_SUBSCRIPTION_DEMO,
  LS_SERIES_SEED_TOMBSTONES,
  LS_ACTIVE_PROFILE,
} from '@/config/storageKeys';
import { scheduleCatalogSync } from '@/lib/catalogPersistence';
import { compressImageFileForStorage } from '@/lib/imageCompressForStorage';
import {
  stripSeriesImageFieldsForStorage,
  hydrateSeriesImageFields,
  stripEpisodeImageFieldsForStorage,
  hydrateEpisodeImageFields,
  deleteSeriesImagesFromIdb,
  deleteEpisodeImageFromIdb,
} from '@/lib/catalogImageStorage';

/**
 * Persistência: localStorage (cache) + em dev ficheiro `data/catalog-backup.json` via catalogPersistence.
 * Use sempre a mesma origem (ex.: http://localhost:4173) — ver painel «Backup do catálogo».
 */
const LS_SUB = LS_SUBSCRIPTION_DEMO;

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('[TerrorFlix] localStorage.getItem indisponível', key, e);
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.error('[TerrorFlix] localStorage.setItem falhou (quota ou modo privado?)', key, e);
    return false;
  }
}

/**
 * Carrega uma tabela: só grava o seed na primeira vez (chave ausente).
 * JSON inválido: faz backup do ficheiro bruto e devolve o seed só em memória — não grava o seed em cima
 * do localStorage (evitava apagar filmes/linhas criadas pelo utilizador quando o JSON corrompia).
 */
function loadTable(name, seedRows) {
  const key = mockTableKey(name);
  const raw = safeGetItem(key);

  if (raw === null || raw === undefined) {
    const initial = Array.isArray(seedRows) ? [...seedRows] : [];
    safeSetItem(key, JSON.stringify(initial));
    return initial;
  }

  if (raw === '') {
    const initial = Array.isArray(seedRows) ? [...seedRows] : [];
    safeSetItem(key, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    console.warn(`[TerrorFlix] ${key}: conteúdo não é array; backup em ${key}_corrupt_backup`);
    safeSetItem(`${key}_corrupt_backup`, raw);
  } catch (e) {
    console.warn(`[TerrorFlix] ${key}: JSON inválido`, e);
    safeSetItem(`${key}_corrupt_backup`, raw);
  }

  const fallback = Array.isArray(seedRows) ? [...seedRows] : [];
  return fallback;
}

/** Grava tabela; data URLs de capas vão para IndexedDB para não estourar o limite do localStorage. */
async function saveTableAsync(name, rows) {
  let processed = rows;
  if (name === 'Series') {
    processed = await Promise.all(
      rows.map(async (r) => {
        try {
          return await stripSeriesImageFieldsForStorage(r);
        } catch (e) {
          console.warn('[demo] stripSeriesImageFieldsForStorage', r?.id, e);
          return r;
        }
      })
    );
  } else if (name === 'Episode') {
    processed = await Promise.all(
      rows.map(async (r) => {
        try {
          return await stripEpisodeImageFieldsForStorage(r);
        } catch (e) {
          console.warn('[demo] stripEpisodeImageFieldsForStorage', r?.id, e);
          return r;
        }
      })
    );
  }
  const key = mockTableKey(name);
  const payload = JSON.stringify(processed);
  if (!safeSetItem(key, payload)) {
    throw new Error(
      `[TerrorFlix] Não foi possível salvar ${name}. Verifique espaço em disco ou desative modo privado com bloqueio de storage.`
    );
  }
  scheduleCatalogSync();
}

function getSeriesSeedTombstones() {
  try {
    const raw = safeGetItem(LS_SERIES_SEED_TOMBSTONES);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function addSeriesSeedTombstone(id) {
  if (!id) return;
  const s = getSeriesSeedTombstones();
  if (s.has(id)) return;
  s.add(id);
  safeSetItem(LS_SERIES_SEED_TOMBSTONES, JSON.stringify([...s]));
  scheduleCatalogSync();
}

function matches(row, query) {
  if (!query || Object.keys(query).length === 0) return true;
  return Object.entries(query).every(([k, v]) => {
    if (v === undefined) return true;
    /** Títulos antigos sem `published` contam como publicados quando o filtro pede `true`. */
    if (k === 'published' && v === true) {
      return row[k] !== false;
    }
    if (k === 'published' && v === false) {
      return row[k] === false;
    }
    const a = row[k];
    return a == v || String(a) === String(v);
  });
}

function sortRows(rows, sortField) {
  if (!sortField) return [...rows];
  let field = sortField;
  let desc = false;
  if (field.startsWith('-')) {
    desc = true;
    field = field.slice(1);
  }
  return [...rows].sort((a, b) => {
    const va = a[field] ?? 0;
    const vb = b[field] ?? 0;
    if (va === vb) return 0;
    const cmp = va < vb ? -1 : 1;
    return desc ? -cmp : cmp;
  });
}

function makeEntity(table, getSeed) {
  const seed = () => getSeed()[table] || [];

  return {
    async filter(query, sortField, limit) {
      let rows = loadTable(table, seed()).filter((r) => matches(r, query));
      rows = sortRows(rows, sortField);
      if (typeof limit === 'number' && limit > 0) rows = rows.slice(0, limit);
      if (table === 'Series') {
        rows = await Promise.all(
          rows.map(async (r) => {
            try {
              return await hydrateSeriesImageFields(r);
            } catch (e) {
              console.warn('[demo] hydrateSeriesImageFields', r?.id, e);
              return r;
            }
          })
        );
      } else if (table === 'Episode') {
        rows = await Promise.all(
          rows.map(async (r) => {
            try {
              return await hydrateEpisodeImageFields(r);
            } catch (e) {
              console.warn('[demo] hydrateEpisodeImageFields', r?.id, e);
              return r;
            }
          })
        );
      }
      return rows;
    },

    async list(sortField, limit) {
      let rows = loadTable(table, seed());
      rows = sortRows(rows, sortField);
      if (typeof limit === 'number' && limit > 0) rows = rows.slice(0, limit);
      if (table === 'Series') {
        rows = await Promise.all(
          rows.map(async (r) => {
            try {
              return await hydrateSeriesImageFields(r);
            } catch (e) {
              console.warn('[demo] hydrateSeriesImageFields', r?.id, e);
              return r;
            }
          })
        );
      } else if (table === 'Episode') {
        rows = await Promise.all(
          rows.map(async (r) => {
            try {
              return await hydrateEpisodeImageFields(r);
            } catch (e) {
              console.warn('[demo] hydrateEpisodeImageFields', r?.id, e);
              return r;
            }
          })
        );
      }
      return rows;
    },

    async create(data) {
      const rows = loadTable(table, seed());
      const id = data.id || `${table.toLowerCase()}-${crypto.randomUUID()}`;
      const row = {
        ...data,
        id,
        created_date: data.created_date || new Date().toISOString(),
      };
      rows.push(row);
      await saveTableAsync(table, rows);
      const saved = loadTable(table, seed()).find((r) => r.id === id);
      if (table === 'Series') return saved ? hydrateSeriesImageFields(saved) : row;
      if (table === 'Episode') return saved ? hydrateEpisodeImageFields(saved) : row;
      return saved ?? row;
    },

    async update(id, data) {
      const rows = loadTable(table, seed());
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) throw new Error(`${table}.update: not found`);
      rows[i] = {
        ...rows[i],
        ...data,
        updated_date: new Date().toISOString(),
      };
      await saveTableAsync(table, rows);
      const saved = loadTable(table, seed()).find((r) => r.id === id);
      if (table === 'Series') return saved ? hydrateSeriesImageFields(saved) : rows[i];
      if (table === 'Episode') return saved ? hydrateEpisodeImageFields(saved) : rows[i];
      return saved ?? rows[i];
    },

    async delete(id) {
      const rows = loadTable(table, seed()).filter((r) => r.id !== id);
      await saveTableAsync(table, rows);
    },

    subscribe() {
      return () => {};
    },

    async bulkCreate(items) {
      const rows = loadTable(table, seed());
      for (const data of items) {
        const id = data.id || `${table.toLowerCase()}-${crypto.randomUUID()}`;
        rows.push({
          ...data,
          id,
          created_date: data.created_date || new Date().toISOString(),
        });
      }
      await saveTableAsync(table, rows);
      return { created: items.length };
    },
  };
}

let seedCache;
function getSeed() {
  if (!seedCache) seedCache = buildMockSeed();
  return seedCache;
}

const seriesEntity = makeEntity('Series', getSeed);
const episodeEntity = makeEntity('Episode', getSeed);

const entities = {
  Series: {
    ...seriesEntity,
    async delete(id) {
      await deleteSeriesImagesFromIdb(id);
      const rows = loadTable('Series', getSeed()).filter((r) => r.id !== id);
      await saveTableAsync('Series', rows);
      addSeriesSeedTombstone(id);
    },
  },
  Episode: {
    ...episodeEntity,
    async delete(id) {
      await deleteEpisodeImageFromIdb(id);
      const rows = loadTable('Episode', getSeed()).filter((r) => r.id !== id);
      await saveTableAsync('Episode', rows);
    },
  },
  FeaturedBanner: makeEntity('FeaturedBanner', getSeed),
  MyList: makeEntity('MyList', getSeed),
  WatchHistory: makeEntity('WatchHistory', getSeed),
  Profile: makeEntity('Profile', getSeed),
  Avatar: makeEntity('Avatar', getSeed),
  SearchTerm: makeEntity('SearchTerm', getSeed),
  AccessCode: makeEntity('AccessCode', getSeed),
  ContentProposal: makeEntity('ContentProposal', getSeed),
  User: makeEntity('User', getSeed),
  Subscription: makeEntity('Subscription', getSeed),
  Notification: makeEntity('Notification', getSeed),
};

let cachedUser = null;

async function getCurrentUser() {
  if (cachedUser) return cachedUser;
  const users = loadTable('User', getSeed().User);
  cachedUser = users[0] || {
    id: 'user-demo-1',
    email: 'demo@local.dev',
    role: 'admin',
    activated: true,
  };
  return cachedUser;
}

async function persistUser(u) {
  const rows = loadTable('User', getSeed().User);
  const i = rows.findIndex((r) => r.id === u.id);
  if (i >= 0) rows[i] = u;
  else rows.push(u);
      await saveTableAsync('User', rows);
  cachedUser = u;
}

export const localMockClient = {
  auth: {
    async me() {
      return getCurrentUser();
    },
    logout() {
      cachedUser = null;
      console.info('[TerrorFlix demo] logout — sessão local limpa (sem redirect externo).');
    },
    redirectToLogin() {
      console.info('[TerrorFlix demo] redirectToLogin ignorado.');
    },
    async updateMe(patch) {
      const u = await getCurrentUser();
      const next = { ...u, ...patch };
      await persistUser(next);
      return next;
    },
  },

  entities,

  functions: {
    async invoke(name, payload = {}) {
      switch (name) {
        case 'ensureTrialSubscription': {
          if (demoBypassSubscription) {
            return {
              data: {
                isActive: true,
                isTrial: false,
                subscription: null,
              },
            };
          }
          return {
            data: {
              isActive: false,
              isTrial: true,
              subscription: null,
            },
          };
        }
        case 'getMySubscription': {
          try {
            const raw = localStorage.getItem(LS_SUB);
            if (raw) {
              const parsed = JSON.parse(raw);
              return { data: parsed };
            }
          } catch {
            /* fallthrough */
          }
          return {
            data: { subscription: null, isActive: false },
          };
        }
        case 'cancelSubscription': {
          localStorage.removeItem(LS_SUB);
          return { data: { ok: true } };
        }
        case 'createAbacatepayBilling': {
          return {
            data: {
              demo: true,
              billing_url: null,
              message: 'Modo demonstração — cobrança real desativada.',
            },
          };
        }
        case 'deleteMyAccount': {
          await Promise.all(
            ['Profile', 'MyList', 'WatchHistory', 'Subscription', 'Notification'].map((t) =>
              saveTableAsync(t, [])
            )
          );
          try {
            localStorage.removeItem(LS_SERIES_SEED_TOMBSTONES);
          } catch {
            /* ignore */
          }
          localStorage.removeItem(LS_ACTIVE_PROFILE);
          localStorage.removeItem(LS_SUB);
          cachedUser = null;
          scheduleCatalogSync();
          return { data: { ok: true } };
        }
        case 'grantTrialToAllUsers': {
          return { data: { success: true, count: 0, message: 'Demo local' } };
        }
        default:
          console.info(`[demo] functions.invoke('${name}') — sem-op`, payload);
          return { data: { ok: true, demo: true } };
      }
    },
  },

  integrations: {
    Core: {
      /**
       * Data URL (base64) para a URL sobreviver a localStorage + reload.
       * Imagens grandes são comprimidas antes — senão JSON do catálogo estoura quota (~5MB).
       */
      async UploadFile({ file }) {
        let f = file;
        try {
          f = await compressImageFileForStorage(file);
        } catch {
          /* mantém original */
        }
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ file_url: reader.result });
          reader.onerror = () => reject(reader.error ?? new Error('UploadFile: leitura falhou'));
          reader.readAsDataURL(f);
        });
      },
      async InvokeLLM() {
        return {
          episodes: [
            {
              title: 'Episódio gerado (demo)',
              season: 1,
              number: 1,
            },
          ],
        };
      },
    },
  },
};

/** Salva estado de assinatura fictício para testar a página /Subscription */
export function saveDemoSubscriptionState(state) {
  localStorage.setItem(LS_SUB, JSON.stringify(state));
  scheduleCatalogSync();
}

/**
 * Remove o perfil chamado "Arroto" do storage local (dados demo) e referências associadas.
 * Executa uma vez ao carregar o app.
 */
function migrateRemoveProfileArroto() {
  if (typeof window === 'undefined') return;
  try {
    const key = mockTableKey('Profile');
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const rows = JSON.parse(raw);
    const arroto = rows.find((p) => (p.name || '').trim().toLowerCase() === 'arroto');
    if (!arroto) return;
    const next = rows.filter((p) => p.id !== arroto.id);
    localStorage.setItem(key, JSON.stringify(next));
    const activeRaw = localStorage.getItem(LS_ACTIVE_PROFILE);
    if (activeRaw) {
      try {
        const active = JSON.parse(activeRaw);
        if (active?.id === arroto.id) {
          localStorage.removeItem(LS_ACTIVE_PROFILE);
        }
      } catch {
        localStorage.removeItem(LS_ACTIVE_PROFILE);
      }
    }
    ['MyList', 'WatchHistory'].forEach((table) => {
      const k = mockTableKey(table);
      const tr = localStorage.getItem(k);
      if (!tr) return;
      const items = JSON.parse(tr);
      const filtered = items.filter((m) => m.profile_id !== arroto.id);
      if (filtered.length !== items.length) {
        localStorage.setItem(k, JSON.stringify(filtered));
      }
    });
  } catch (e) {
    console.warn('[demo] migrateRemoveProfileArroto', e);
  }
}

/**
 * Substitui caminhos antigos para PNGs que não existiam no repo por SVGs em public/images/banners/.
 */
function migrateSeriesLegacyBannerFiles() {
  if (typeof window === 'undefined') return;
  try {
    const key = mockTableKey('Series');
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const rows = JSON.parse(raw);
    const REPLACEMENTS = {
      '/images/banners/banner-it-pennywise.png': '/images/banners/poster-movie.svg',
      '/images/banners/banner-jack-in-the-box.png': '/images/banners/poster-movie.svg',
    };
    let changed = false;
    const out = rows.map((row) => {
      const r = { ...row };
      if (REPLACEMENTS[r.cover_url]) {
        r.cover_url = REPLACEMENTS[r.cover_url];
        changed = true;
      }
      if (REPLACEMENTS[r.banner_url]) {
        r.banner_url = REPLACEMENTS[r.banner_url];
        changed = true;
      }
      if (
        r.id === 'series-3' &&
        typeof r.cover_url === 'string' &&
        r.cover_url.includes('unsplash.com')
      ) {
        r.cover_url = '/images/banners/poster-comedy.svg';
        changed = true;
      }
      return r;
    });
    if (changed) localStorage.setItem(key, JSON.stringify(out));
  } catch (e) {
    console.warn('[demo] migrateSeriesLegacyBannerFiles', e);
  }
}

/**
 * Garante URLs de banner/capa nas séries demo quando faltam.
 * FeaturedBanner não é mais preenchido pelo seed (hero = `heroBanners.js`).
 */
function ensureDemoHeroBanners() {
  if (typeof window === 'undefined') return;
  try {
    const seed = buildMockSeed();
    const keyS = mockTableKey('Series');
    const keyFB = mockTableKey('FeaturedBanner');
    const rawS = safeGetItem(keyS);
    if (!rawS) return;
    const series = JSON.parse(rawS);
    const s1 = series.find((s) => s.id === 'movie-o-exorcista-1974');
    const rawFB = safeGetItem(keyFB);

    const needsSeriesMerge =
      !s1?.banner_url ||
      !series.some((s) => s.id === 'movie-halloween-1978' && s.banner_url);

    if (needsSeriesMerge) {
      const seedIds = new Set(seed.Series.map((s) => s.id));
      const tombstones = getSeriesSeedTombstones();
      const mergedSeries = seed.Series.map((seedRow) => {
        const existing = series.find((r) => r.id === seedRow.id);
        if (!existing) {
          if (tombstones.has(seedRow.id)) return null;
          return { ...seedRow };
        }
        return {
          ...existing,
          banner_url: existing.banner_url ?? seedRow.banner_url,
          cover_url: existing.cover_url ?? seedRow.cover_url,
          banner_object_position:
            existing.banner_object_position ?? seedRow.banner_object_position,
        };
      }).filter(Boolean);
      series.forEach((r) => {
        if (!seedIds.has(r.id)) mergedSeries.push(r);
      });
      safeSetItem(keyS, JSON.stringify(mergedSeries));
    }

    if (rawFB === null) {
      safeSetItem(
        keyFB,
        JSON.stringify(seed.FeaturedBanner.map((x) => ({ ...x })))
      );
    }
  } catch (e) {
    console.warn('[demo] ensureDemoHeroBanners', e);
  }
}

migrateRemoveProfileArroto();
migrateSeriesLegacyBannerFiles();
ensureDemoHeroBanners();

/** Preenche só `content_type` em registos antigos sem tipo — não sobrescreve categorias nem seções escolhidas no admin. */
function ensureSeriesContentTypes() {
  if (typeof window === 'undefined') return;
  try {
    const seed = buildMockSeed().Series;
    const key = mockTableKey('Series');
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const rows = JSON.parse(raw);
    const demoById = Object.fromEntries(seed.map((s) => [s.id, s]));
    let changed = false;
    const out = rows.map((row) => {
      if (!row.content_type) {
        changed = true;
        const s = demoById[row.id];
        return { ...row, content_type: s?.content_type || 'series' };
      }
      return row;
    });
    if (changed) localStorage.setItem(key, JSON.stringify(out));
  } catch (e) {
    console.warn('[demo] ensureSeriesContentTypes', e);
  }
}

ensureSeriesContentTypes();

/**
 * Sincroniza com o seed: acrescenta novos IDs do catálogo; preserva edições; não reinsere linhas
 * apagadas no admin (lista em `desenhosflix_series_seed_tombstones`). Preenche `highlighted_home_section` vazio.
 */
function ensureSeedSeriesRowsAndHighlights() {
  if (typeof window === 'undefined') return;
  try {
    const seed = buildMockSeed().Series;
    const key = mockTableKey('Series');
    const raw = safeGetItem(key);
    if (!raw) return;
    const rows = JSON.parse(raw);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    const seedIds = new Set(seed.map((s) => s.id));
    const tombstones = getSeriesSeedTombstones();
    let changed = false;

    const merged = seed
      .map((s) => {
        const ex = byId[s.id];
        if (!ex) {
          if (tombstones.has(s.id)) return null;
          changed = true;
          return { ...s };
        }
        const hl = ex.highlighted_home_section;
        const hlEmpty = hl == null || String(hl).trim() === '';
        if (hlEmpty && s.highlighted_home_section) {
          changed = true;
          return { ...ex, highlighted_home_section: s.highlighted_home_section };
        }
        return ex;
      })
      .filter(Boolean);

    rows.forEach((r) => {
      if (!seedIds.has(r.id)) merged.push(r);
    });

    if (changed) safeSetItem(key, JSON.stringify(merged));
  } catch (e) {
    console.warn('[demo] ensureSeedSeriesRowsAndHighlights', e);
  }
}

ensureSeedSeriesRowsAndHighlights();

/** Corrige nomes antigos (Goku, Avatar N…) e SVG data-URL quebrados; não substitui Imgur válido. */
function migrateAvatarsTerrorTheme() {
  if (typeof window === 'undefined') return;
  try {
    const key = mockTableKey('Avatar');
    const seed = profileAvatarsSeed.map((a) => ({ ...a }));
    const seedIds = new Set(seed.map((s) => s.id));
    const legacyNames = new Set(['goku', 'mickey', 'tom', 'scooby']);
    const shouldResync = (row) => {
      const url = row.image_url || '';
      if (url.startsWith('data:image/svg+xml')) return true;
      const n = (row.name || '').trim().toLowerCase();
      if (legacyNames.has(n)) return true;
      if (/^avatar\s*\d+$/i.test((row.name || '').trim())) return true;
      return false;
    };
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(seed));
      return;
    }
    const rows = JSON.parse(raw);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    const merged = seed.map((s) => {
      const ex = byId[s.id];
      if (!ex) return { ...s };
      if (shouldResync(ex)) return { ...ex, name: s.name, image_url: s.image_url };
      return ex;
    });
    rows.forEach((r) => {
      if (!seedIds.has(r.id)) merged.push(r);
    });
    localStorage.setItem(key, JSON.stringify(merged));
  } catch (e) {
    console.warn('[demo] migrateAvatarsTerrorTheme', e);
  }
}

migrateAvatarsTerrorTheme();

/**
 * Migração única: data URLs gigantes ainda no JSON do localStorage → IndexedDB.
 */
function migrateInlineDataImagesToIdb() {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return;
  void (async () => {
    try {
      const keyS = mockTableKey('Series');
      const rawS = safeGetItem(keyS);
      if (rawS) {
        const rows = JSON.parse(rawS);
        const next = await Promise.all(
          rows.map(async (r) => {
            try {
              return await stripSeriesImageFieldsForStorage(r);
            } catch (err) {
              console.warn('[demo] migrate strip Series', r?.id, err);
              return r;
            }
          })
        );
        if (JSON.stringify(rows) !== JSON.stringify(next) && safeSetItem(keyS, JSON.stringify(next))) {
          scheduleCatalogSync();
        }
      }
    } catch (e) {
      console.warn('[demo] migrateInlineDataImagesToIdb Series', e);
    }
    try {
      const keyE = mockTableKey('Episode');
      const rawE = safeGetItem(keyE);
      if (rawE) {
        const rows = JSON.parse(rawE);
        const next = await Promise.all(
          rows.map(async (r) => {
            try {
              return await stripEpisodeImageFieldsForStorage(r);
            } catch (err) {
              console.warn('[demo] migrate strip Episode', r?.id, err);
              return r;
            }
          })
        );
        if (JSON.stringify(rows) !== JSON.stringify(next) && safeSetItem(keyE, JSON.stringify(next))) {
          scheduleCatalogSync();
        }
      }
    } catch (e) {
      console.warn('[demo] migrateInlineDataImagesToIdb Episode', e);
    }
  })();
}

migrateInlineDataImagesToIdb();

if (typeof window !== 'undefined') {
  scheduleCatalogSync();
}
