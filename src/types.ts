export interface Post {
  id: number;
  title: string;
  slug: string;
  body: string;
  excerpt: string | null;
  published_at: string | null;
  created_at?: string;
  updated_at?: string;
  rendered_body?: string;
}

export interface PaginatedPosts<T = Post> {
  data: T[];
  current_page: number;
  per_page: number;
  total: number;
  last_page?: number;
}

export interface CreatePostInput {
  title: string;
  body: string;
  excerpt?: string;
  published_at?: string;
}

export interface UpdatePostInput {
  title?: string;
  body?: string;
  excerpt?: string | null;
  published_at?: string | null;
}

export interface LontarConfig {
  baseUrl: string;
  token?: string;
}