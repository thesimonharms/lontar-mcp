import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { LontarApiError, createClientFromEnv } from './client.js';

function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true as const,
  };
}

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'lontar-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.registerTool(
    'list_posts',
    {
      description:
        'List published blog posts (paginated). Returns title, slug, excerpt, and published_at for each post.',
      inputSchema: {
        page: z.number().int().min(1).optional().describe('Page number (default: 1)'),
      },
    },
    async ({ page }) => {
      try {
        const client = createClientFromEnv();
        return jsonResult(await client.listPublished(page ?? 1));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'get_post',
    {
      description:
        'Get a single published post by slug. Returns full post data including body and rendered_body (HTML).',
      inputSchema: {
        slug: z.string().describe('Post slug'),
      },
    },
    async ({ slug }) => {
      try {
        const client = createClientFromEnv();
        return jsonResult(await client.getPost(slug));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'list_drafts',
    {
      description:
        'List draft posts (paginated). Requires LONTAR_API_TOKEN. Returns title, slug, excerpt, and created_at.',
      inputSchema: {
        page: z.number().int().min(1).optional().describe('Page number (default: 1)'),
      },
    },
    async ({ page }) => {
      try {
        const client = createClientFromEnv();
        return jsonResult(await client.listDrafts(page ?? 1));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'create_post',
    {
      description:
        'Create a new blog post. Requires LONTAR_API_TOKEN. Slug is auto-generated from the title. Omit published_at to create a draft.',
      inputSchema: {
        title: z.string().describe('Post title'),
        body: z.string().describe('Post body (Markdown)'),
        excerpt: z.string().optional().describe('Short excerpt'),
        published_at: z
          .string()
          .optional()
          .describe('ISO 8601 publish date; omit to save as draft'),
      },
    },
    async ({ title, body, excerpt, published_at }) => {
      try {
        const client = createClientFromEnv();
        return jsonResult(
          await client.createPost({
            title,
            body,
            excerpt,
            published_at,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'update_post',
    {
      description:
        'Update an existing post by slug. Requires LONTAR_API_TOKEN. Only provided fields are changed.',
      inputSchema: {
        slug: z.string().describe('Current post slug'),
        title: z.string().optional().describe('New title (regenerates slug)'),
        body: z.string().optional().describe('New body (Markdown)'),
        excerpt: z.string().nullable().optional().describe('New excerpt'),
        published_at: z
          .string()
          .nullable()
          .optional()
          .describe('New publish date, or null to unpublish'),
      },
    },
    async ({ slug, title, body, excerpt, published_at }) => {
      try {
        const client = createClientFromEnv();
        return jsonResult(
          await client.updatePost(slug, {
            title,
            body,
            excerpt,
            published_at,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'delete_post',
    {
      description: 'Permanently delete a post by slug. Requires LONTAR_API_TOKEN.',
      inputSchema: {
        slug: z.string().describe('Post slug to delete'),
      },
    },
    async ({ slug }) => {
      try {
        const client = createClientFromEnv();
        await client.deletePost(slug);
        return jsonResult({ deleted: true, slug });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'publish_post',
    {
      description:
        'Publish a draft post by setting published_at to now. Requires LONTAR_API_TOKEN.',
      inputSchema: {
        slug: z.string().describe('Post slug to publish'),
      },
    },
    async ({ slug }) => {
      try {
        const client = createClientFromEnv();
        return jsonResult(await client.publishPost(slug));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'unpublish_post',
    {
      description:
        'Unpublish a post by clearing published_at. Requires LONTAR_API_TOKEN.',
      inputSchema: {
        slug: z.string().describe('Post slug to unpublish'),
      },
    },
    async ({ slug }) => {
      try {
        const client = createClientFromEnv();
        return jsonResult(await client.unpublishPost(slug));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts'));

if (isMain) {
  main().catch((error: unknown) => {
    if (error instanceof LontarApiError) {
      console.error(error.message);
    } else {
      console.error('Server error:', error);
    }
    process.exit(1);
  });
}