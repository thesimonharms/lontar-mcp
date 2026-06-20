import type {
  CreatePostInput,
  LontarConfig,
  PaginatedPosts,
  Post,
  UpdatePostInput,
} from './types.js';

export class LontarApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Lontar API error ${status}: ${body}`);
    this.name = 'LontarApiError';
  }
}

export class LontarClient {
  constructor(private readonly config: LontarConfig) {}

  private headers(auth = false): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (auth) {
      if (!this.config.token) {
        throw new Error('LONTAR_API_TOKEN is required for this operation');
      }
      headers.Authorization = `Bearer ${this.config.token}`;
    }

    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    options: { auth?: boolean; body?: unknown } = {},
  ): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: this.headers(options.auth),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new LontarApiError(response.status, await response.text());
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  listPublished(page = 1): Promise<PaginatedPosts<Pick<Post, 'title' | 'slug' | 'excerpt' | 'published_at'>>> {
    return this.request('GET', `/posts?page=${page}`);
  }

  getPost(slug: string): Promise<Post> {
    return this.request('GET', `/posts/${encodeURIComponent(slug)}`);
  }

  listDrafts(page = 1): Promise<PaginatedPosts<Pick<Post, 'title' | 'slug' | 'excerpt' | 'created_at'>>> {
    return this.request('GET', `/posts/drafts?page=${page}`, { auth: true });
  }

  createPost(input: CreatePostInput): Promise<Post> {
    return this.request('POST', '/posts', { auth: true, body: input });
  }

  updatePost(slug: string, input: UpdatePostInput): Promise<Post> {
    return this.request('PUT', `/posts/${encodeURIComponent(slug)}`, {
      auth: true,
      body: input,
    });
  }

  deletePost(slug: string): Promise<void> {
    return this.request('DELETE', `/posts/${encodeURIComponent(slug)}`, { auth: true });
  }

  publishPost(slug: string): Promise<Post> {
    return this.request('POST', `/posts/${encodeURIComponent(slug)}/publish`, { auth: true });
  }

  unpublishPost(slug: string): Promise<Post> {
    return this.request('POST', `/posts/${encodeURIComponent(slug)}/unpublish`, { auth: true });
  }
}

export function createClientFromEnv(): LontarClient {
  const baseUrl = process.env.LONTAR_API_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('LONTAR_API_URL environment variable is required');
  }

  return new LontarClient({
    baseUrl,
    token: process.env.LONTAR_API_TOKEN,
  });
}