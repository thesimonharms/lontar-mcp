import { defineServer, describe, it, expect } from 'cobasaja';
import type { McpToolResult } from 'cobasaja';
import { startMockServer } from './mock-server.js';

const mock = await startMockServer();

defineServer({
  command: 'node',
  args: ['dist/index.js'],
  timeout: 10000,
  env: {
    LONTAR_API_URL: mock.url,
    LONTAR_API_TOKEN: 'test-token',
  },
});

function text(result: McpToolResult): string {
  return result.content[0]?.text ?? '';
}

function json(result: McpToolResult): Record<string, unknown> {
  return JSON.parse(text(result)) as Record<string, unknown>;
}

it('lists all blog management tools', async ({ tools }) => {
  expect(tools).toHaveTool('list_posts');
  expect(tools).toHaveTool('get_post');
  expect(tools).toHaveTool('list_drafts');
  expect(tools).toHaveTool('create_post');
  expect(tools).toHaveTool('update_post');
  expect(tools).toHaveTool('delete_post');
  expect(tools).toHaveTool('publish_post');
  expect(tools).toHaveTool('unpublish_post');
  expect(tools.length).toBe(8);
});

describe('list_posts', () => {
  it('returns published posts', async ({ call }) => {
    const result = await call('list_posts');
    expect(result).toBeSuccessful();

    const data = json(result);
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect((data.data as { slug: string }[])[0]).toMatchObject({
      slug: 'hello-world',
      title: 'Hello World',
    });
  });
});

describe('get_post', () => {
  it('returns a published post with rendered body', async ({ call }) => {
    const result = await call('get_post', { slug: 'hello-world' });
    expect(result).toBeSuccessful();

    const post = json(result);
    expect(post.slug).toBe('hello-world');
    expect(post.body).toContain('Hello');
    expect(post.rendered_body).toContain('<h1>');
  });

  it('returns an error for draft slugs', async ({ call }) => {
    const result = await call('get_post', { slug: 'draft-post' });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain('404');
  });
});

describe('list_drafts', () => {
  it('returns draft posts when authenticated', async ({ call }) => {
    const result = await call('list_drafts');
    expect(result).toBeSuccessful();

    const data = json(result);
    const slugs = (data.data as { slug: string }[]).map((post) => post.slug);
    expect(slugs).toContain('draft-post');
    expect(slugs).not.toContain('hello-world');
  });
});

describe('create_post', () => {
  it('creates a draft post with an auto-generated slug', async ({ call }) => {
    const result = await call('create_post', {
      title: 'Agent Written Post',
      body: 'Created by an MCP agent.',
      excerpt: 'Agentic blogging',
    });
    expect(result).toBeSuccessful();

    const post = json(result);
    expect(post.title).toBe('Agent Written Post');
    expect(post.slug).toBe('agent-written-post');
    expect(post.published_at).toBeNull();
  });
});

describe('publish_post', () => {
  it('publishes a draft and makes it publicly readable', async ({ call }) => {
    const created = await call('create_post', {
      title: 'Publish Me',
      body: 'Soon to be live.',
    });
    expect(created).toBeSuccessful();
    const slug = json(created).slug as string;

    const published = await call('publish_post', { slug });
    expect(published).toBeSuccessful();
    expect(json(published).published_at).toBeDefined();

    const fetched = await call('get_post', { slug });
    expect(fetched).toBeSuccessful();
    expect(json(fetched).slug).toBe(slug);
  });
});

describe('update_post', () => {
  it('updates post content', async ({ call }) => {
    const created = await call('create_post', {
      title: 'Update Target',
      body: 'Original body.',
    });
    const slug = json(created).slug as string;

    const updated = await call('update_post', {
      slug,
      body: 'Updated body.',
      excerpt: 'New excerpt',
    });
    expect(updated).toBeSuccessful();
    expect(json(updated).body).toBe('Updated body.');
    expect(json(updated).excerpt).toBe('New excerpt');
  });
});

describe('unpublish_post', () => {
  it('removes a post from the public index', async ({ call }) => {
    const created = await call('create_post', {
      title: 'Temporary Live Post',
      body: 'Will go dark again.',
    });
    const slug = json(created).slug as string;

    await call('publish_post', { slug });
    const unpublished = await call('unpublish_post', { slug });
    expect(unpublished).toBeSuccessful();
    expect(json(unpublished).published_at).toBeNull();

    const hidden = await call('get_post', { slug });
    expect(hidden.isError).toBe(true);
  });
});

describe('delete_post', () => {
  it('deletes a post permanently', async ({ call }) => {
    const created = await call('create_post', {
      title: 'Delete Me',
      body: 'Short-lived post.',
    });
    const slug = json(created).slug as string;

    const deleted = await call('delete_post', { slug });
    expect(deleted).toBeSuccessful();
    expect(json(deleted)).toMatchObject({ deleted: true, slug });

    const missing = await call('get_post', { slug });
    expect(missing.isError).toBe(true);
  });
});