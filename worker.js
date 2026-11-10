// SeeBase: API, tiempo real y almacenamiento sobre Cloudflare Workers + Durable Objects.
import { DurableObject } from 'cloudflare:workers';

const BOARD_ID = /^[a-z0-9]{6,32}$/;
const ASSET_ID = /^[a-z0-9]{6,32}$/;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const COOKIE = 'seebase_team';
const MAX_ASSET_BYTES = 1_950_000;
const MAX_ELEMENT_CHARS = 1_900_000;
const RELAYED = new Set(['cur', 'sel', 'live', 'view', 'present']);

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(init.headers || {}) },
  });

const notFound = () => json({ error: 'not_found' }, { status: 404 });

const clean = (value, max) => String(value ?? '').slice(0, max);

async function teamToken(code) {
  const bytes = new TextEncoder().encode(`seebase:${code}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(req, name) {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

function randomId() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return [...crypto.getRandomValues(new Uint8Array(14))].map((b) => alphabet[b % 36]).join('');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    const code = env.TEAM_CODE || '';
    const token = code ? await teamToken(code) : '';
    const authed = !code || readCookie(req, COOKIE) === token;
    const parts = url.pathname.split('/').filter(Boolean).slice(1);

    if (parts[0] === 'health') return json({ app: 'seebase', protected: !!code, authed });

    if (parts[0] === 'login' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (!code) return json({ ok: true });
      if (String(body.code || '') !== code) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return json({ error: 'wrong_code' }, { status: 403 });
      }
      const secure = url.protocol === 'https:' ? '; Secure' : '';
      return json(
        { ok: true },
        { headers: { 'set-cookie': `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}` } },
      );
    }

    if (!authed) return json({ error: 'team_code_required' }, { status: 401 });
    if (parts[0] !== 'boards') return notFound();

    const index = env.INDEX.get(env.INDEX.idFromName('main'));

    if (parts.length === 1) {
      if (req.method === 'GET') return json({ boards: await index.list() });
      if (req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        return json(await index.create(body));
      }
      return json({ error: 'method' }, { status: 405 });
    }

    const boardId = parts[1];
    if (!BOARD_ID.test(boardId)) return notFound();
    const room = env.ROOMS.get(env.ROOMS.idFromName(boardId));

    if (parts.length === 2) {
      if (req.method === 'GET') {
        const board = await index.get(boardId);
        if (!board) return notFound();
        const snap = await room.snapshot();
        return new Response(`{"board":${JSON.stringify(board)},"clock":${snap.clock},"elements":${snap.elements}}`, {
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
        });
      }
      if (req.method === 'PATCH') {
        const body = await req.json().catch(() => ({}));
        const board = await index.update(boardId, body);
        return board ? json(board) : notFound();
      }
      if (req.method === 'DELETE') {
        await index.remove(boardId);
        await room.wipe();
        return json({ ok: true });
      }
      return json({ error: 'method' }, { status: 405 });
    }

    if (parts[2] === 'ops' && req.method === 'POST') {
      if (!(await index.get(boardId))) return notFound();
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body.ops)) await room.seed(body.ops);
      return json({ ok: true });
    }

    if (parts[2] === 'ws') {
      if (!(await index.get(boardId))) return notFound();
      return room.fetch(req);
    }

    if (parts[2] === 'assets') {
      if (parts.length === 3 && req.method === 'POST') {
        const mime = (req.headers.get('content-type') || '').split(';')[0];
        if (!IMAGE_TYPES.has(mime)) return json({ error: 'unsupported_image' }, { status: 415 });
        const data = await req.arrayBuffer();
        if (data.byteLength > MAX_ASSET_BYTES) return json({ error: 'too_large' }, { status: 413 });
        return json({ id: await room.putAsset(mime, data) });
      }
      if (parts.length === 4 && req.method === 'GET' && ASSET_ID.test(parts[3])) {
        const asset = await room.getAsset(parts[3]);
        if (!asset) return notFound();
        return new Response(asset.data, {
          headers: {
            'content-type': asset.mime,
            'cache-control': 'private, max-age=31536000, immutable',
            'x-content-type-options': 'nosniff',
          },
        });
      }
    }
    return notFound();
  },
};

// Lista de tableros del equipo.
export class BoardIndex extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS boards(
      id TEXT PRIMARY KEY, name TEXT NOT NULL, thumb TEXT, owner TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL)`);
  }

  list() {
    return this.sql.exec('SELECT id, name, thumb, owner, created, updated FROM boards ORDER BY updated DESC').toArray();
  }

  get(id) {
    return this.sql.exec('SELECT id, name, thumb, owner, created, updated FROM boards WHERE id = ?', id).toArray()[0] || null;
  }

  create(body) {
    const id = BOARD_ID.test(body.id || '') ? body.id : randomId();
    const now = Date.now();
    const name = clean(body.name, 120) || 'Tablero sin título';
    this.sql.exec(
      'INSERT OR IGNORE INTO boards(id, name, thumb, owner, created, updated) VALUES(?, ?, NULL, ?, ?, ?)',
      id, name, clean(body.owner, 60), now, now,
    );
    return this.get(id);
  }

  update(id, patch) {
    const current = this.get(id);
    if (!current) return null;
    const name = patch.name != null ? clean(patch.name, 120) || current.name : current.name;
    let thumb = current.thumb;
    if (typeof patch.thumb === 'string' && patch.thumb.startsWith('data:image/') && patch.thumb.length < 160_000) thumb = patch.thumb;
    this.sql.exec('UPDATE boards SET name = ?, thumb = ?, updated = ? WHERE id = ?', name, thumb, Date.now(), id);
    return this.get(id);
  }

  remove(id) {
    this.sql.exec('DELETE FROM boards WHERE id = ?', id);
  }
}

// Un tablero: elementos, imágenes y personas conectadas.
export class BoardRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS elements(id TEXT PRIMARY KEY, v INTEGER NOT NULL, by TEXT NOT NULL, data TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, created INTEGER NOT NULL)`);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  snapshot() {
    const rows = this.sql.exec('SELECT data FROM elements WHERE data IS NOT NULL').toArray();
    const clock = this.sql.exec('SELECT COALESCE(MAX(v), 0) AS m FROM elements').toArray()[0].m;
    return { clock, elements: `[${rows.map((r) => r.data).join(',')}]` };
  }

  putAsset(mime, data) {
    const id = randomId();
    this.sql.exec('INSERT INTO assets(id, mime, data, created) VALUES(?, ?, ?, ?)', id, mime, data, Date.now());
    return id;
  }

  getAsset(id) {
    const row = this.sql.exec('SELECT mime, data FROM assets WHERE id = ?', id).toArray()[0];
    return row ? { mime: row.mime, data: row.data } : null;
  }

  async wipe() {
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.close(4004, 'board_deleted'); } catch {}
    }
    await this.ctx.storage.deleteAll();
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    const url = new URL(req.url);
    const me = {
      sid: clean(url.searchParams.get('sid'), 24),
      name: clean(url.searchParams.get('name'), 40) || 'Invitado',
      color: clean(url.searchParams.get('color'), 16),
    };
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(me);
    const peers = this.ctx.getWebSockets().filter((ws) => ws !== server).map((ws) => ws.deserializeAttachment()).filter(Boolean);
    server.send(JSON.stringify({ t: 'hello', peers }));
    this.broadcast({ t: 'join', peer: me }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(message, except) {
    const text = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(text); } catch {}
    }
  }

  persist(ops) {
    this.ctx.storage.transactionSync(() => {
      for (const op of ops) {
        if (!op || typeof op.id !== 'string' || op.id.length > 40 || !Number.isFinite(op.v)) continue;
        const data = op.data == null ? null : JSON.stringify(op.data);
        if (data && data.length > MAX_ELEMENT_CHARS) continue;
        this.sql.exec(
          `INSERT INTO elements(id, v, by, data) VALUES(?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET v = excluded.v, by = excluded.by, data = excluded.data
           WHERE excluded.v > elements.v OR (excluded.v = elements.v AND excluded.by > elements.by)`,
          op.id, op.v, clean(op.by, 24), data,
        );
      }
    });
  }

  seed(ops) {
    this.persist(ops);
  }

  webSocketMessage(ws, raw) {
    if (typeof raw !== 'string') return;
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    const me = ws.deserializeAttachment();
    if (!me) return;
    if (message.t === 'ops' && Array.isArray(message.ops)) {
      this.persist(message.ops);
      ws.send(JSON.stringify({ t: 'ack', n: message.n }));
      this.broadcast({ t: 'ops', ops: message.ops, from: me.sid }, ws);
      return;
    }
    if (RELAYED.has(message.t)) {
      message.from = me.sid;
      this.broadcast(message, ws);
    }
  }

  webSocketClose(ws, code) {
    const me = ws.deserializeAttachment();
    if (me) this.broadcast({ t: 'leave', sid: me.sid }, ws);
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye'); } catch {}
  }

  webSocketError(ws) {
    const me = ws.deserializeAttachment();
    if (me) this.broadcast({ t: 'leave', sid: me.sid }, ws);
  }
}
