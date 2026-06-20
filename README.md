# lontar-mcp

MCP server that gives AI agents full blog management over a [Lontar](https://github.com/thesimonharms/lontar) headless blogging API — list and read published posts, draft new content, publish, update, and delete.

Lontar is a Laravel package; this server talks to its HTTP API so agents can manage a blog without touching the CMS UI.

## Tools

| Tool | Auth | Description |
|------|------|-------------|
| `list_posts` | No | List published posts (paginated) |
| `get_post` | No | Get a published post by slug, including rendered HTML body |
| `list_drafts` | Yes | List draft posts (paginated) |
| `create_post` | Yes | Create a new post (draft by default) |
| `update_post` | Yes | Update an existing post by slug |
| `delete_post` | Yes | Permanently delete a post |
| `publish_post` | Yes | Publish a draft (sets `published_at` to now) |
| `unpublish_post` | Yes | Unpublish a post (clears `published_at`) |

### `list_posts` / `list_drafts`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number |

### `get_post`

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | Post slug |

### `create_post`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string` | — | Post title (slug auto-generated) |
| `body` | `string` | — | Post body (Markdown) |
| `excerpt` | `string` | — | Short excerpt |
| `published_at` | `string` | — | ISO 8601 date; omit to save as draft |

### `update_post`

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | Current post slug |
| `title` | `string` | New title (regenerates slug) |
| `body` | `string` | New body (Markdown) |
| `excerpt` | `string \| null` | New excerpt |
| `published_at` | `string \| null` | New publish date, or `null` to unpublish |

### `delete_post` / `publish_post` / `unpublish_post`

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | `string` | Post slug |

All tool responses are JSON strings in the MCP text content field.

## Install

```bash
npm install lontar-mcp
```

Or clone and build locally:

```bash
git clone https://github.com/thesimonharms/lontar-mcp.git
cd lontar-mcp
npm install
npm run build
```

Requires Node.js 18+.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LONTAR_API_URL` | Yes | API base URL, e.g. `https://example.com/api` |
| `LONTAR_API_TOKEN` | For write ops | Laravel Sanctum bearer token |

## MCP configuration

### Cursor / Claude Desktop

```json
{
  "mcpServers": {
    "lontar": {
      "command": "node",
      "args": ["C:/absolute/path/to/lontar-mcp/dist/index.js"],
      "env": {
        "LONTAR_API_URL": "https://your-blog.example.com/api",
        "LONTAR_API_TOKEN": "your-sanctum-token"
      }
    }
  }
}
```

If installed globally or via `npx`:

```json
{
  "mcpServers": {
    "lontar": {
      "command": "npx",
      "args": ["lontar-mcp"],
      "env": {
        "LONTAR_API_URL": "https://your-blog.example.com/api",
        "LONTAR_API_TOKEN": "your-sanctum-token"
      }
    }
  }
}
```

## Examples

**List published posts**

```json
{ "page": 1 }
```

**Get a post**

```json
{ "slug": "hello-world" }
```

**Create a draft**

```json
{
  "title": "My New Post",
  "body": "# Hello\n\nMarkdown content here.",
  "excerpt": "A short summary"
}
```

**Publish a draft**

```json
{ "slug": "my-new-post" }
```

## Development

```bash
npm run build   # bundle server to dist/
npm start       # run on stdio
npm test        # build + run cobasaja tests
```

Tests live in `tests/` and use [cobasaja](https://www.npmjs.com/package/cobasaja) to spawn the server over stdio against an in-memory mock API, asserting tool behaviour end-to-end.

## License

MIT © [Simon Harms](https://github.com/thesimonharms)