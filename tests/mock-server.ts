import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

const VALID_TOKEN = 'test-token';

interface StoredPost {
  id: number;
  title: string;
  slug: string;
  body: string;
  excerpt: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

let nextId = 1;
const posts: StoredPost[] = [
  {
    id: nextId++,
    title: 'Hello World',
    slug: 'hello-world',
    body: '# Hello\n\nWelcome to the blog.',
    excerpt: 'A warm welcome',
    published_at: '2026-01-01T12:00:00.000000Z',
    created_at: '2026-01-01T10:00:00.000000Z',
    updated_at: '2026-01-01T12:00:00.000000Z',
  },
  {
    id: nextId++,
    title: 'Draft Post',
    slug: 'draft-post',
    body: 'Work in progress.',
    excerpt: null,
    published_at: null,
    created_at: '2026-02-01T10:00:00.000000Z',
    updated_at: '2026-02-01T10:00:00.000000Z',
  },
];

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function uniqueSlug(base: string, excludeId?: number): string {
  let slug = base;
  let i = 1;
  while (posts.some((post) => post.slug === slug && post.id !== excludeId)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

function isPublished(post: StoredPost): boolean {
  if (!post.published_at) return false;
  return new Date(post.published_at) <= new Date();
}

function paginate<T>(items: T[], page: number, perPage = 15) {
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(page, 1), lastPage);
  const start = (currentPage - 1) * perPage;

  return {
    data: items.slice(start, start + perPage),
    current_page: currentPage,
    per_page: perPage,
    total,
    last_page: lastPage,
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function isAuthorized(req: IncomingMessage): boolean {
  const auth = req.headers.authorization;
  return auth === `Bearer ${VALID_TOKEN}`;
}

function renderedBody(body: string): string {
  if (body.startsWith('# ')) {
    const text = body.slice(2).split('\n')[0];
    return `<h1>${text}</h1>`;
  }
  return `<p>${body}</p>`;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const page = Number(url.searchParams.get('page') ?? '1');

  if (req.method === 'GET' && path === '/posts') {
    const published = posts
      .filter(isPublished)
      .sort((a, b) => Date.parse(b.published_at!) - Date.parse(a.published_at!))
      .map(({ title, slug, excerpt, published_at }) => ({ title, slug, excerpt, published_at }));

    return sendJson(res, 200, paginate(published, page));
  }

  if (req.method === 'GET' && path === '/posts/drafts') {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { message: 'Unauthenticated.' });
    }

    const drafts = posts
      .filter((post) => !post.published_at)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map(({ title, slug, excerpt, created_at }) => ({ title, slug, excerpt, created_at }));

    return sendJson(res, 200, paginate(drafts, page));
  }

  const showMatch = path.match(/^\/posts\/([^/]+)$/);
  if (req.method === 'GET' && showMatch) {
    const slug = decodeURIComponent(showMatch[1]);
    const post = posts.find((item) => item.slug === slug && isPublished(item));
    if (!post) {
      return sendJson(res, 404, { message: 'Not found.' });
    }

    return sendJson(res, 200, { ...post, rendered_body: renderedBody(post.body) });
  }

  if (req.method === 'POST' && path === '/posts') {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { message: 'Unauthenticated.' });
    }

    const payload = JSON.parse(await readBody(req)) as {
      title?: string;
      body?: string;
      excerpt?: string;
      published_at?: string;
    };

    if (!payload.title || !payload.body) {
      return sendJson(res, 422, {
        message: 'Validation failed.',
        errors: {
          ...(!payload.title ? { title: ['The title field is required.'] } : {}),
          ...(!payload.body ? { body: ['The body field is required.'] } : {}),
        },
      });
    }

    const now = new Date().toISOString();
    const post: StoredPost = {
      id: nextId++,
      title: payload.title,
      slug: uniqueSlug(slugify(payload.title)),
      body: payload.body,
      excerpt: payload.excerpt ?? null,
      published_at: payload.published_at ?? null,
      created_at: now,
      updated_at: now,
    };
    posts.push(post);

    return sendJson(res, 201, post);
  }

  const updateMatch = path.match(/^\/posts\/([^/]+)$/);
  if (req.method === 'PUT' && updateMatch) {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { message: 'Unauthenticated.' });
    }

    const slug = decodeURIComponent(updateMatch[1]);
    const post = posts.find((item) => item.slug === slug);
    if (!post) {
      return sendJson(res, 404, { message: 'Not found.' });
    }

    const payload = JSON.parse(await readBody(req)) as Partial<StoredPost>;
    if (payload.title) {
      post.title = payload.title;
      post.slug = uniqueSlug(slugify(payload.title), post.id);
    }
    if (payload.body !== undefined) post.body = payload.body;
    if (payload.excerpt !== undefined) post.excerpt = payload.excerpt;
    if (payload.published_at !== undefined) post.published_at = payload.published_at;
    post.updated_at = new Date().toISOString();

    return sendJson(res, 200, post);
  }

  const deleteMatch = path.match(/^\/posts\/([^/]+)$/);
  if (req.method === 'DELETE' && deleteMatch) {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { message: 'Unauthenticated.' });
    }

    const slug = decodeURIComponent(deleteMatch[1]);
    const index = posts.findIndex((item) => item.slug === slug);
    if (index === -1) {
      return sendJson(res, 404, { message: 'Not found.' });
    }

    posts.splice(index, 1);
    res.writeHead(204);
    return res.end();
  }

  const publishMatch = path.match(/^\/posts\/([^/]+)\/publish$/);
  if (req.method === 'POST' && publishMatch) {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { message: 'Unauthenticated.' });
    }

    const slug = decodeURIComponent(publishMatch[1]);
    const post = posts.find((item) => item.slug === slug);
    if (!post) {
      return sendJson(res, 404, { message: 'Not found.' });
    }

    post.published_at = new Date().toISOString();
    post.updated_at = post.published_at;
    return sendJson(res, 200, post);
  }

  const unpublishMatch = path.match(/^\/posts\/([^/]+)\/unpublish$/);
  if (req.method === 'POST' && unpublishMatch) {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { message: 'Unauthenticated.' });
    }

    const slug = decodeURIComponent(unpublishMatch[1]);
    const post = posts.find((item) => item.slug === slug);
    if (!post) {
      return sendJson(res, 404, { message: 'Not found.' });
    }

    post.published_at = null;
    post.updated_at = new Date().toISOString();
    return sendJson(res, 200, post);
  }

  sendJson(res, 404, { message: 'Not found.' });
}

export interface MockLontarServer {
  url: string;
  close: () => Promise<void>;
}

export async function startMockServer(): Promise<MockLontarServer> {
  const server: Server = createServer((req, res) => {
    handleRequest(req, res).catch(() => {
      sendJson(res, 500, { message: 'Internal server error.' });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start mock server');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}