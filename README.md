# Design Tokens MCP Server

A production-ready Model Context Protocol (MCP) server for managing CSS Custom Properties (design tokens). This server enables AI assistants and other MCP clients to read, query, search, and update design tokens from CSS files.

## Features

- 📖 **Read CSS Custom Properties** - Automatically parses CSS files to extract all design tokens
- 🔍 **Query Specific Tokens** - Retrieve individual token values by name
- 📋 **List All Tokens** - View all available tokens with optional category filtering
- 🔎 **Search Functionality** - Find tokens by name or value patterns
- ✏️ **Update Tokens** - Modify token values and persist changes back to CSS files
- ⚡ **Production-Ready** - Comprehensive error handling and validation

## Installation

```bash
npm install
```

## Usage

### Starting the Server

```bash
npm start
```

Or make the file executable and run directly:

```bash
chmod +x index.js
./index.js
```

### MCP Client Configuration

Add this server to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "design-tokens": {
      "command": "node",
      "args": ["/path/to/design-tokens-mcp/index.js"]
    }
  }
}
```

## Available Tools

### 1. `get_token`

Retrieve the value of a specific design token.

**Parameters:**

- `name` (string, required): Token name with or without `--` prefix

**Example:**

```json
{
  "name": "ks-brand-color-primary"
}
```

**Response:**

```json
{
  "token": "--ks-brand-color-primary",
  "value": "#3065c0"
}
```

### 2. `list_tokens`

List all available design tokens with optional filtering.

**Parameters:**

- `category` (string, optional): Filter by category (e.g., "color", "font", "spacing")

**Example:**

```json
{
  "category": "color"
}
```

**Response:**

```json
{
  "totalTokens": 25,
  "category": "color",
  "tokens": [
    {
      "name": "--ks-brand-color-primary",
      "value": "#3065c0"
    },
    ...
  ]
}
```

### 3. `search_tokens`

Search for tokens by pattern in names or values.

**Parameters:**

- `pattern` (string, required): Search pattern (case-insensitive)
- `searchIn` (string, optional): Where to search - "name", "value", or "both" (default: "both")

**Example:**

```json
{
  "pattern": "primary",
  "searchIn": "name"
}
```

**Response:**

```json
{
  "pattern": "primary",
  "searchIn": "name",
  "totalMatches": 2,
  "results": [
    {
      "name": "--ks-brand-color-primary",
      "value": "#3065c0"
    },
    {
      "name": "--ks-brand-color-primary-inverted",
      "value": "#3065c0"
    }
  ]
}
```

### 4. `update_token`

Update a token value and save changes to the CSS file.

**Parameters:**

- `name` (string, required): Token name to update
- `value` (string, required): New value for the token

**Example:**

```json
{
  "name": "ks-brand-color-primary",
  "value": "#4075d0"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Token updated successfully",
  "token": "--ks-brand-color-primary",
  "oldValue": "#3065c0",
  "newValue": "#4075d0"
}
```

## Token File Structure

The server reads from `tokens/branding-token.css` which contains CSS Custom Properties:

```css
:root {
  --ks-brand-color-primary: #3065c0;
  --ks-brand-color-bg: #fff;
  --ks-brand-font-family-display: Montserrat, Baskerville, serif;
  /* ... more tokens */
}
```

## Error Handling

The server includes comprehensive error handling for:

- Missing or inaccessible token files
- Invalid token names
- File write failures
- Malformed requests
- Non-existent tokens

All errors are returned in a consistent JSON format:

```json
{
  "error": "Error message description",
  "tool": "tool_name",
  "timestamp": "2026-01-21T12:00:00.000Z"
}
```

## Token Categories

The design tokens are organized by category:

- **Colors**: Primary, background, foreground, semantic colors
- **Typography**: Font families, weights, sizes
- **Spacing**: Base spacing and scale factors
- **Borders**: Width, radius
- **Shadows**: Blur values

## Development

### Project Structure

```
design-tokens-mcp/
├── index.js                 # Main MCP server
├── package.json            # Node.js configuration
├── README.md              # Documentation
└── tokens/
    └── branding-token.css # Design token definitions
```

### Adding New Token Files

To support multiple token files, modify the `TOKENS_FILE` constant in `index.js` or extend the parsing logic to read from multiple files.

## Requirements

- Node.js 16+ (for ES modules support)
- @modelcontextprotocol/sdk ^1.25.3

## License

ISC

## Contributing

Contributions are welcome! Please ensure all changes include proper error handling and maintain the existing code style.
