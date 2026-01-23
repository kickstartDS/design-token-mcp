# Design Tokens MCP Server

A production-ready Model Context Protocol (MCP) server for managing CSS Custom Properties (design tokens). This server enables AI assistants and other MCP clients to read, query, search, and update design tokens from CSS/SCSS files.

## Features

- 📖 **Multi-file Support** - Reads tokens from multiple CSS and SCSS files
- 🔍 **Advanced Querying** - Filter by file, category, prefix, or semantic type
- 📊 **Statistics** - Get token counts and distribution across files
- 🎨 **Color Palette Tools** - Dedicated tools for color tokens with scale support
- ✏️ **Typography Tools** - Query font families, weights, sizes, and line heights
- 📐 **Spacing Tools** - Get spacing tokens by size or type
- 🔄 **Update Tokens** - Modify token values and persist changes
- ⚡ **Pagination** - Handle large token sets efficiently

## Supported Token Files

| File                          | Description                                     | Category         |
| ----------------------------- | ----------------------------------------------- | ---------------- |
| `branding-token.css`          | Core brand tokens (colors, fonts, spacing base) | branding         |
| `color-token.scss`            | Derived color tokens with scales and mixing     | color            |
| `background-color-token.scss` | Background colors for UI states                 | background-color |
| `text-color-token.scss`       | Text/foreground colors                          | text-color       |
| `border-color-token.scss`     | Border colors for UI states                     | border-color     |
| `border-token.scss`           | Border width and radius                         | border           |
| `font-token.scss`             | Font families, weights, line heights            | font             |
| `font-size-token.scss`        | Font size scales with responsive calculations   | font-size        |
| `spacing-token.scss`          | Spacing scales for margins/padding              | spacing          |
| `box-shadow-token.scss`       | Box shadow tokens for elevation                 | box-shadow       |
| `transition-token.scss`       | Animation timing and duration                   | transition       |
| `scaling-token.scss`          | Scaling factors for responsive design           | scaling          |

## Installation

```bash
npm install
```

## Usage

### Starting the Server

```bash
npm start
```

### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

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

## Available Tools (11 total)

### Core Tools

#### `get_token`

Retrieve a specific token by name with its source file and category.

```json
{ "name": "ks-brand-color-primary" }
```

#### `list_tokens`

List tokens with filtering and pagination.

```json
{
  "file": "branding",
  "category": "color",
  "prefix": "ks-brand",
  "limit": 50,
  "offset": 0
}
```

#### `list_files`

List all token files with descriptions and token counts.

#### `get_token_stats`

Get statistics: total tokens, counts by file, category, and prefix.

#### `search_tokens`

Search tokens by pattern in names or values.

```json
{
  "pattern": "primary",
  "searchIn": "name",
  "file": "color",
  "limit": 50
}
```

### Semantic Type Tools

#### `get_tokens_by_type`

Get tokens by semantic type:

- `interactive` - hover, active, selected, disabled states
- `inverted` - dark mode variants
- `scale` - alpha/mixing scale variants
- `base` - base tokens
- `responsive` - breakpoint-specific tokens
- `sizing` - size scale tokens (xxs-xxl)

```json
{ "type": "interactive", "file": "background-color" }
```

### Domain-Specific Tools

#### `get_color_palette`

Get color tokens organized by type.

```json
{
  "colorType": "primary",
  "includeScales": true
}
```

Color types: `primary`, `positive`, `negative`, `informative`, `notice`, `fg`, `bg`, `link`

#### `get_typography_tokens`

Get typography tokens filtered by font type or property.

```json
{
  "fontType": "display",
  "property": "size"
}
```

Font types: `display`, `copy`, `interface`, `mono`
Properties: `family`, `weight`, `size`, `line-height`

#### `get_spacing_tokens`

Get spacing tokens by size or type.

```json
{
  "size": "m",
  "type": "stack"
}
```

Sizes: `xxs`, `xs`, `s`, `m`, `l`, `xl`, `xxl`
Types: `stack`, `inline`, `inset`, `base`

#### `get_branding_tokens`

Get core branding tokens (the primary tokens to modify for theming).

```json
{ "type": "colors" }
```

Types: `colors`, `fonts`, `spacing`, `borders`, `shadows`, `all`

#### `update_token`

Update a token value in its source file.

```json
{
  "name": "ks-brand-color-primary",
  "value": "#4075d0"
}
```

## Token Architecture

The design token system follows a layered architecture:

1. **Branding Tokens** (`branding-token.css`)
   - Core values: primary colors, font families, base sizes
   - These are the tokens to modify for theming

2. **Derived Tokens** (SCSS files)
   - Computed from branding tokens using `var()` references
   - Include scales, states, and responsive variants

3. **Semantic Tokens**
   - Purpose-specific tokens (background, text, border colors)
   - Interactive states (hover, active, selected, disabled)
   - Inverted variants for dark mode

## Example Workflows

### Get an overview of the token system

```
1. list_files → See all token files with counts
2. get_token_stats → See distribution by category
```

### Find and modify a brand color

```
1. get_branding_tokens { type: "colors" } → See editable colors
2. update_token { name: "ks-brand-color-primary", value: "#new-color" }
```

### Explore the color system

```
1. get_color_palette { colorType: "primary" } → See primary colors
2. get_color_palette { colorType: "primary", includeScales: true } → With alpha scales
```

### Query interactive states

```
1. get_tokens_by_type { type: "interactive", file: "background-color" }
```

## Error Handling

All errors return consistent JSON:

```json
{
  "error": "Error message",
  "tool": "tool_name",
  "timestamp": "2026-01-22T12:00:00.000Z"
}
```

## Requirements

- Node.js 16+ (ES modules support)
- @modelcontextprotocol/sdk ^1.25.3

## License

ISC
