// D1 database layer for Cloudflare. Replaces lib/db.js (Prisma/Postgres).
// API mirrors the Prisma call shapes used across the app so route diffs stay small.
// Conventions: DateTime <-> ISO TEXT, Json <-> TEXT, Boolean <-> INTEGER 0/1.
import { getCloudflareContext } from '@opennextjs/cloudflare';

/** D1Database binding for the current request. */
export function getD1() {
  const { env } = getCloudflareContext();
  if (!env.DB) throw new Error('[d1] D1 binding "DB" not configured');
  return env.DB;
}

// ---------------------------------------------------------------------------
// Model metadata
// ---------------------------------------------------------------------------
const MODELS = {
  VideoCache:   { json: ['data'], dates: ['cachedAt', 'expiresAt'] },
  FeedCache:    { json: ['data'], dates: ['cachedAt', 'expiresAt'] },
  Favorite:     { dates: ['createdAt'], uniques: { userId_vkey: ['userId', 'vkey'] } },
  WatchHistory: { dates: ['updatedAt'], uniques: { userId_vkey: ['userId', 'vkey'] } },
  VideoStat:    { dates: ['updatedAt'] },
  SearchLog:    { dates: ['updatedAt'] },
  Playlist:     { bools: ['isPublic'], dates: ['createdAt'] },
  PlaylistItem: { dates: ['addedAt'], uniques: { playlistId_vkey: ['playlistId', 'vkey'] } },
  Report:       { dates: ['createdAt'] },
  User:         { dates: ['createdAt'] },
  Session:      { dates: ['expiresAt', 'createdAt'] },
};

// Fields with @default(now()) / @updatedAt that the helper auto-fills.
const AUTO_NOW = {
  VideoCache: ['cachedAt'], FeedCache: ['cachedAt'], Favorite: ['createdAt'],
  WatchHistory: ['updatedAt'], VideoStat: ['updatedAt'], SearchLog: ['updatedAt'],
  Playlist: ['createdAt'], PlaylistItem: ['addedAt'], Report: ['createdAt'],
  User: ['createdAt'], Session: ['createdAt'],
};

function newId() {
  // cuid-compatible opaque id
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

const nowIso = () => new Date().toISOString();

function serialize(meta, data) {
  const out = { ...data };
  for (const k of meta.json || []) {
    if (out[k] !== undefined && out[k] !== null && typeof out[k] !== 'string') {
      out[k] = JSON.stringify(out[k]);
    }
  }
  for (const k of meta.bools || []) {
    if (out[k] !== undefined && out[k] !== null) out[k] = out[k] ? 1 : 0;
  }
  for (const k of meta.dates || []) {
    if (out[k] instanceof Date) out[k] = out[k].toISOString();
  }
  return out;
}

function deserialize(meta, row) {
  if (!row) return row;
  const out = { ...row };
  for (const k of meta.json || []) {
    if (typeof out[k] === 'string') {
      try { out[k] = JSON.parse(out[k]); } catch { /* leave as-is */ }
    }
  }
  for (const k of meta.bools || []) {
    if (out[k] !== undefined && out[k] !== null) out[k] = Boolean(out[k]);
  }
  for (const k of meta.dates || []) {
    if (typeof out[k] === 'string' && out[k]) out[k] = new Date(out[k]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// WHERE builder — supports the shapes used in the app:
// equality, { in: [] }, { lt|lte|gt|gte }, { contains, mode }, AND/OR/NOT,
// compound unique keys ({ userId_vkey: { userId, vkey } }).
// ---------------------------------------------------------------------------
function buildCondition(meta, where, params) {
  if (!where || typeof where !== 'object') return '1=1';
  const parts = [];
  for (const [key, val] of Object.entries(where)) {
    if (key === 'AND' && Array.isArray(val)) {
      parts.push('(' + val.map((w) => buildCondition(meta, w, params)).join(' AND ') + ')');
    } else if (key === 'OR' && Array.isArray(val)) {
      parts.push('(' + val.map((w) => buildCondition(meta, w, params)).join(' OR ') + ')');
    } else if (key === 'NOT') {
      parts.push('NOT (' + buildCondition(meta, val, params) + ')');
    } else if (meta.uniques && meta.uniques[key] && val && typeof val === 'object') {
      // compound unique: { userId_vkey: { userId, vkey } } -> userId=? AND vkey=?
      const sub = meta.uniques[key]
        .map((col) => { params.push(val[col]); return `"${col}" = ?`; })
        .join(' AND ');
      parts.push(`(${sub})`);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      const ops = [];
      for (const [op, v] of Object.entries(val)) {
        if (op === 'in' && Array.isArray(v)) {
          if (v.length === 0) { ops.push('1=0'); continue; }
          ops.push(`"${key}" IN (${v.map(() => '?').join(',')})`);
          params.push(...v);
        } else if (op === 'lt' || op === 'lte' || op === 'gt' || op === 'gte') {
          const sym = { lt: '<', lte: '<=', gt: '>', gte: '>=' }[op];
          let vv = v instanceof Date ? v.toISOString() : v;
          ops.push(`"${key}" ${sym} ?`);
          params.push(vv);
        } else if (op === 'contains') {
          const mode = val.mode;
          if (mode === 'insensitive') {
            ops.push(`LOWER("${key}") LIKE '%' || LOWER(?) || '%'`);
          } else {
            ops.push(`"${key}" LIKE '%' || ? || '%'`);
          }
          params.push(String(v));
        } else if (op === 'startsWith') {
          ops.push(`"${key}" LIKE ? || '%'`);
          params.push(String(v));
        } else if (op === 'endsWith') {
          ops.push(`"${key}" LIKE '%' || ?`);
          params.push(String(v));
        }
      }
      if (ops.length) parts.push('(' + ops.join(' AND ') + ')');
    } else {
      let v = val instanceof Date ? val.toISOString() : val;
      if (typeof v === 'boolean') v = v ? 1 : 0;
      if (v === null || v === undefined) {
        parts.push(`"${key}" IS NULL`);
      } else {
        parts.push(`"${key}" = ?`);
        params.push(v);
      }
    }
  }
  return parts.length ? parts.join(' AND ') : '1=1';
}

function buildOrderBy(orderBy) {
  if (!orderBy) return '';
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];
  const cols = [];
  for (const ob of list) {
    for (const [k, v] of Object.entries(ob)) {
      cols.push(`"${k}" ${String(v).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`);
    }
  }
  return cols.length ? 'ORDER BY ' + cols.join(', ') : '';
}

// Prisma model name (camelCase) -> D1 model meta key (PascalCase)
const MODEL_ALIASES = {
  user: 'User', session: 'Session', videoCache: 'VideoCache', feedCache: 'FeedCache',
  favorite: 'Favorite', watchHistory: 'WatchHistory', videoStat: 'VideoStat',
  searchLog: 'SearchLog', playlist: 'Playlist', playlistItem: 'PlaylistItem',
  report: 'Report',
};

// Relations for `include` support: { relationKey: { model, fk, singular } }
// fk = column on the RELATED table pointing back; singular = one object not array.
const RELATIONS = {
  Session:  { user:     { model: 'User',         fk: 'userId',     singular: true } },
  User:     { sessions: { model: 'Session',      fk: 'userId',     singular: false } },
  Playlist: { items:    { model: 'PlaylistItem', fk: 'playlistId', singular: false } },
};

async function applyInclude(modelName, rows, include) {
  if (!include || !rows) return rows;
  const rels = RELATIONS[modelName] || {};
  const isArray = Array.isArray(rows);
  const list = isArray ? rows : [rows];
  if (!list.length) return rows;

  for (const [key, spec] of Object.entries(include)) {
    if (key === '_count') {
      const select = (spec && spec.select) || {};
      for (const row of list) {
        row._count = row._count || {};
        for (const [relKey, want] of Object.entries(select)) {
          if (!want) continue;
          const rel = rels[relKey];
          if (!rel) continue;
          row._count[relKey] = await model(rel.model).count({ where: { [rel.fk]: row.id } });
        }
      }
      continue;
    }
    const rel = rels[key];
    if (!rel) continue;
    const relModel = model(rel.model);
    const args = spec === true ? {} : (spec || {});
    for (const row of list) {
      const items = await relModel.findMany({
        where: { [rel.fk]: row.id, ...(args.where || {}) },
        orderBy: args.orderBy,
        take: args.take,
        skip: args.skip,
      });
      row[key] = rel.singular ? (items[0] || null) : items;
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Generic model API (Prisma-like)
// ---------------------------------------------------------------------------
function model(name) {
  const meta = MODELS[name];
  if (!meta) throw new Error(`[d1] unknown model ${name}`);

  async function run(sql, params) {
    const db = getD1();
    return db.prepare(sql).bind(...params);
  }

  return {
    async findUnique(args = {}) {
      const params = [];
      const where = buildCondition(meta, args.where, params);
      let select = '*';
      if (args.select) {
        const keys = Object.keys(args.select).filter((k) => args.select[k]);
        if (keys.length) select = keys.map((k) => `"${k}"`).join(', ');
      }
      const stmt = await run(`SELECT ${select} FROM "${name}" WHERE ${where} LIMIT 1`, params);
      const row = await stmt.first();
      const out = deserialize(meta, row) || null;
      if (out && args.include) await applyInclude(name, out, args.include);
      return out;
    },

    async findMany(args = {}) {
      const params = [];
      const where = buildCondition(meta, args.where, params);
      let select = '*';
      if (args.select) {
        const keys = Object.keys(args.select).filter((k) => args.select[k]);
        if (keys.length) select = keys.map((k) => `"${k}"`).join(', ');
      }
      let sql = `SELECT ${select} FROM "${name}" WHERE ${where}`;
      const ob = buildOrderBy(args.orderBy);
      if (ob) sql += ' ' + ob;
      if (args.take !== undefined) {
        sql += ` LIMIT ?`;
        params.push(args.take);
        if (args.skip !== undefined) { sql += ` OFFSET ?`; params.push(args.skip); }
      } else if (args.skip !== undefined) {
        sql += ` LIMIT -1 OFFSET ?`;
        params.push(args.skip);
      }
      const stmt = await run(sql, params);
      const { results } = await stmt.all();
      const out = (results || []).map((r) => deserialize(meta, r));
      if (out.length && args.include) await applyInclude(name, out, args.include);
      return out;
    },

    async create(args = {}) {
      const data = serialize(meta, { ...(args.data || {}) });
      // auto-fill defaults Prisma would apply
      if (!('id' in data) && ['Favorite', 'WatchHistory', 'Playlist', 'PlaylistItem', 'Report', 'User', 'Session'].includes(name)) {
        data.id = newId();
      }
      for (const k of AUTO_NOW[name] || []) {
        if (!(k in data) || data[k] === undefined) data[k] = nowIso();
      }
      const cols = Object.keys(data);
      const placeholders = cols.map(() => '?').join(', ');
      const stmt = await run(
        `INSERT INTO "${name}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
        cols.map((c) => data[c] ?? null)
      );
      await stmt.run();
      return deserialize(meta, data);
    },

    async update(args = {}) {
      const params = [];
      const where = buildCondition(meta, args.where, params);
      const data = serialize(meta, { ...(args.data || {}) });
      // @updatedAt fields
      for (const k of ['updatedAt']) {
        if ((MODELS[name].dates || []).includes(k) && !(k in data)) data[k] = nowIso();
      }
      const cols = Object.keys(data);
      if (!cols.length) return this.findUnique({ where: args.where });
      const setSql = cols.map((c) => `"${c}" = ?`).join(', ');
      const stmt = await run(`UPDATE "${name}" SET ${setSql} WHERE ${where}`, [...cols.map((c) => data[c] ?? null), ...params]);
      await stmt.run();
      return this.findUnique({ where: args.where });
    },

    async upsert(args = {}) {
      const where = args.where || {};
      const existing = await this.findUnique({ where });
      if (existing) {
        return this.update({ where, data: args.update || {} });
      }
      const data = { ...(args.create || {}) };
      // merge where-clause equality fields into create data (Prisma does this)
      for (const [k, v] of Object.entries(where)) {
        if (v !== null && typeof v !== 'object' && !(k in data)) data[k] = v;
        if (meta.uniques && meta.uniques[k] && v && typeof v === 'object') {
          for (const col of meta.uniques[k]) {
            if (!(col in data)) data[col] = v[col];
          }
        }
      }
      return this.create({ data });
    },

    async delete(args = {}) {
      const row = await this.findUnique({ where: args.where });
      if (!row) return null;
      const params = [];
      const where = buildCondition(meta, args.where, params);
      const stmt = await run(`DELETE FROM "${name}" WHERE ${where}`, params);
      await stmt.run();
      return row;
    },

    async deleteMany(args = {}) {
      const params = [];
      const where = buildCondition(meta, args.where, params);
      const stmt = await run(`DELETE FROM "${name}" WHERE ${where}`, params);
      const res = await stmt.run();
      return { count: res.meta?.changes ?? 0 };
    },

    async count(args = {}) {
      const params = [];
      const where = buildCondition(meta, args.where, params);
      const stmt = await run(`SELECT COUNT(*) AS c FROM "${name}" WHERE ${where}`, params);
      const row = await stmt.first();
      return row ? row.c : 0;
    },
  };
}

// Prisma-style namespace: db.user.findUnique(...) etc.
// getDb() returns a Proxy that maps camelCase model names (prisma.user)
// to D1 models and resolves the binding lazily per request.
export function getDb() {
  return new Proxy(
    {},
    {
      get(_, m) {
        if (typeof m !== 'string') return undefined;
        const name = MODEL_ALIASES[m];
        if (!name) return undefined;
        return model(name);
      },
    }
  );
}

// Drop-in-ish export name used across routes (they import { prisma } today;
// those imports will be updated to { getDb } + const prisma = getDb()).
export default getDb;
