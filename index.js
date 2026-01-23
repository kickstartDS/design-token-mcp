#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKENS_DIR = path.join(__dirname, "tokens");

// Token file categories with metadata
const TOKEN_FILES = {
  branding: {
    file: "branding-token.css",
    description: "Core brand tokens (colors, fonts, spacing base values)",
    category: "branding",
  },
  color: {
    file: "color-token.scss",
    description: "Derived color tokens with scales and mixing",
    category: "color",
  },
  "background-color": {
    file: "background-color-token.scss",
    description: "Background color tokens for various UI states",
    category: "background-color",
  },
  "text-color": {
    file: "text-color-token.scss",
    description: "Text/foreground color tokens",
    category: "text-color",
  },
  "border-color": {
    file: "border-color-token.scss",
    description: "Border color tokens for various UI states",
    category: "border-color",
  },
  border: {
    file: "border-token.scss",
    description: "Border width and radius tokens",
    category: "border",
  },
  font: {
    file: "font-token.scss",
    description: "Font family, weight, and line-height tokens",
    category: "font",
  },
  "font-size": {
    file: "font-size-token.scss",
    description: "Font size scale tokens with responsive calculations",
    category: "font-size",
  },
  spacing: {
    file: "spacing-token.scss",
    description: "Spacing scale tokens for margins and padding",
    category: "spacing",
  },
  "box-shadow": {
    file: "box-shadow-token.scss",
    description: "Box shadow tokens for elevation",
    category: "box-shadow",
  },
  transition: {
    file: "transition-token.scss",
    description: "Animation timing and duration tokens",
    category: "transition",
  },
  scaling: {
    file: "scaling-token.scss",
    description: "Scaling factors for responsive design",
    category: "scaling",
  },
};

/**
 * Parse a single CSS/SCSS file and extract all CSS Custom Properties
 * @param {string} filePath - Path to the token file
 * @param {string} category - Category name for the tokens
 * @returns {Promise<Map<string, {value: string, file: string, category: string}>>}
 */
async function parseTokenFile(filePath, category) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const tokens = new Map();
    const fileName = path.basename(filePath);

    // Regular expression to match CSS custom properties
    // Handles multiline values and SCSS comments
    const tokenRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;

    let match;
    while ((match = tokenRegex.exec(content)) !== null) {
      const tokenName = `--${match[1]}`;
      const tokenValue = match[2].trim().replace(/\s+/g, " "); // Normalize whitespace
      tokens.set(tokenName, {
        value: tokenValue,
        file: fileName,
        category: category,
      });
    }

    return tokens;
  } catch (error) {
    console.error(`Failed to parse ${filePath}: ${error.message}`);
    return new Map();
  }
}

/**
 * Parse all token files and return combined tokens
 * @param {string|null} fileFilter - Optional file key filter
 * @returns {Promise<Map<string, {value: string, file: string, category: string}>>}
 */
async function parseAllTokens(fileFilter = null) {
  const allTokens = new Map();

  const filesToParse = fileFilter
    ? { [fileFilter]: TOKEN_FILES[fileFilter] }
    : TOKEN_FILES;

  for (const [key, config] of Object.entries(filesToParse)) {
    if (!config) continue;
    const filePath = path.join(TOKENS_DIR, config.file);
    try {
      await fs.access(filePath);
      const tokens = await parseTokenFile(filePath, config.category);
      for (const [name, data] of tokens.entries()) {
        allTokens.set(name, data);
      }
    } catch {
      // File doesn't exist, skip
    }
  }

  return allTokens;
}

/**
 * Get token statistics
 * @returns {Promise<Object>}
 */
async function getTokenStats() {
  const allTokens = await parseAllTokens();
  const stats = {
    totalTokens: allTokens.size,
    byFile: {},
    byCategory: {},
    byPrefix: {},
  };

  for (const [name, data] of allTokens.entries()) {
    // Count by file
    stats.byFile[data.file] = (stats.byFile[data.file] || 0) + 1;

    // Count by category
    stats.byCategory[data.category] =
      (stats.byCategory[data.category] || 0) + 1;

    // Count by prefix (e.g., ks-color, ks-spacing)
    const prefixMatch = name.match(/^--([a-z]+-[a-z]+)/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      stats.byPrefix[prefix] = (stats.byPrefix[prefix] || 0) + 1;
    }
  }

  return stats;
}

/**
 * Update a token value in its source file
 * @param {string} tokenName - The token name
 * @param {string} newValue - The new value
 * @returns {Promise<Object>}
 */
async function updateTokenInFile(tokenName, newValue) {
  const normalizedName = tokenName.startsWith("--")
    ? tokenName
    : `--${tokenName}`;

  // Find which file contains this token
  const allTokens = await parseAllTokens();
  const tokenData = allTokens.get(normalizedName);

  if (!tokenData) {
    throw new Error(`Token '${normalizedName}' not found in any file`);
  }

  const filePath = path.join(TOKENS_DIR, tokenData.file);
  let content = await fs.readFile(filePath, "utf-8");

  // Create regex to find the specific token
  const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRegex = new RegExp(`(${escapedName}\\s*:\\s*)([^;]+)(;)`, "g");

  if (!tokenRegex.test(content)) {
    throw new Error(`Token '${normalizedName}' not found in ${tokenData.file}`);
  }

  const oldValue = tokenData.value;

  // Replace the token value
  const updatedContent = content.replace(
    new RegExp(`(${escapedName}\\s*:\\s*)([^;]+)(;)`, "g"),
    `$1${newValue}$3`,
  );

  await fs.writeFile(filePath, updatedContent, "utf-8");

  return {
    success: true,
    tokenName: normalizedName,
    oldValue,
    newValue: newValue.trim(),
    file: tokenData.file,
    category: tokenData.category,
  };
}

/**
 * Search tokens by pattern
 * @param {Map} tokens - All tokens
 * @param {string} pattern - Search pattern
 * @param {string} searchIn - 'name', 'value', or 'both'
 * @returns {Array}
 */
function searchTokens(tokens, pattern, searchIn = "both") {
  const results = [];
  const lowerPattern = pattern.toLowerCase();

  for (const [name, data] of tokens.entries()) {
    const matchName = searchIn === "both" || searchIn === "name";
    const matchValue = searchIn === "both" || searchIn === "value";

    const nameMatches = matchName && name.toLowerCase().includes(lowerPattern);
    const valueMatches =
      matchValue && data.value.toLowerCase().includes(lowerPattern);

    if (nameMatches || valueMatches) {
      results.push({
        name,
        value: data.value,
        file: data.file,
        category: data.category,
      });
    }
  }

  return results;
}

/**
 * Get tokens by semantic type (interactive states, scales, etc.)
 * @param {Map} tokens
 * @param {string} semanticType
 * @returns {Array}
 */
function getTokensBySemanticType(tokens, semanticType) {
  const typePatterns = {
    interactive: /(hover|active|selected|disabled|focus)/i,
    inverted: /inverted/i,
    scale: /(alpha-\d|to-bg-\d|to-fg-\d|scale-\d)/i,
    base: /-base$/,
    responsive: /(phone|tablet|laptop|desktop|bp-factor)/i,
    sizing: /(xxs|xs|s|m|l|xl|xxl)$/,
  };

  const pattern = typePatterns[semanticType];
  if (!pattern) return [];

  const results = [];
  for (const [name, data] of tokens.entries()) {
    if (pattern.test(name)) {
      results.push({
        name,
        value: data.value,
        file: data.file,
        category: data.category,
      });
    }
  }

  return results;
}

// Create MCP server instance
const server = new Server(
  {
    name: "design-tokens-server",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_token",
        description:
          "Retrieve the value of a specific design token by name. Returns the token value along with its source file and category.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "The token name (e.g., 'ks-brand-color-primary' or '--ks-brand-color-primary')",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "list_tokens",
        description:
          "List design tokens with optional filtering. Can filter by file, category, or name prefix. Returns paginated results for large token sets.",
        inputSchema: {
          type: "object",
          properties: {
            file: {
              type: "string",
              enum: Object.keys(TOKEN_FILES),
              description:
                "Filter by source file (e.g., 'branding', 'color', 'spacing')",
            },
            category: {
              type: "string",
              description:
                "Filter by category pattern in token name (e.g., 'color', 'font', 'spacing')",
            },
            prefix: {
              type: "string",
              description:
                "Filter by token name prefix (e.g., 'ks-brand', 'ks-color-primary')",
            },
            limit: {
              type: "number",
              description: "Maximum number of tokens to return (default: 50)",
              default: 50,
            },
            offset: {
              type: "number",
              description:
                "Number of tokens to skip for pagination (default: 0)",
              default: 0,
            },
          },
        },
      },
      {
        name: "list_files",
        description:
          "List all available token files with their descriptions and token counts.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_token_stats",
        description:
          "Get statistics about the token system including counts by file, category, and prefix.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "search_tokens",
        description:
          "Search for design tokens by pattern in names or values. Supports filtering by file and semantic type.",
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "Search pattern (case-insensitive)",
            },
            searchIn: {
              type: "string",
              enum: ["name", "value", "both"],
              description: "Where to search (default: 'both')",
              default: "both",
            },
            file: {
              type: "string",
              enum: Object.keys(TOKEN_FILES),
              description: "Limit search to specific file",
            },
            limit: {
              type: "number",
              description: "Maximum results to return (default: 50)",
              default: 50,
            },
          },
          required: ["pattern"],
        },
      },
      {
        name: "get_tokens_by_type",
        description:
          "Get tokens by semantic type (interactive states, scales, responsive values, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "interactive",
                "inverted",
                "scale",
                "base",
                "responsive",
                "sizing",
              ],
              description:
                "Semantic type: 'interactive' (hover/active/selected), 'inverted' (dark mode), 'scale' (alpha/mixing scales), 'base' (base tokens), 'responsive' (breakpoint), 'sizing' (xxs-xxl)",
            },
            file: {
              type: "string",
              enum: Object.keys(TOKEN_FILES),
              description: "Limit to specific file",
            },
            limit: {
              type: "number",
              description: "Maximum results (default: 50)",
              default: 50,
            },
          },
          required: ["type"],
        },
      },
      {
        name: "get_color_palette",
        description:
          "Get all color-related tokens organized by color type (primary, positive, negative, etc.). Useful for understanding the full color system.",
        inputSchema: {
          type: "object",
          properties: {
            colorType: {
              type: "string",
              enum: [
                "primary",
                "positive",
                "negative",
                "informative",
                "notice",
                "fg",
                "bg",
                "link",
              ],
              description: "Filter by specific color type",
            },
            includeScales: {
              type: "boolean",
              description:
                "Include alpha/mixing scale variants (default: false)",
              default: false,
            },
          },
        },
      },
      {
        name: "get_typography_tokens",
        description:
          "Get typography-related tokens (font families, weights, sizes, line heights).",
        inputSchema: {
          type: "object",
          properties: {
            fontType: {
              type: "string",
              enum: ["display", "copy", "interface", "mono"],
              description: "Filter by font type",
            },
            property: {
              type: "string",
              enum: ["family", "weight", "size", "line-height"],
              description: "Filter by property type",
            },
          },
        },
      },
      {
        name: "get_spacing_tokens",
        description:
          "Get spacing tokens (margins, padding, gaps) with their scale values.",
        inputSchema: {
          type: "object",
          properties: {
            size: {
              type: "string",
              enum: ["xxs", "xs", "s", "m", "l", "xl", "xxl"],
              description: "Filter by specific size",
            },
            type: {
              type: "string",
              enum: ["stack", "inline", "inset", "base"],
              description: "Filter by spacing type",
            },
          },
        },
      },
      {
        name: "update_token",
        description:
          "Update a design token value and save it to its source file. Only works for tokens with direct values (not calculated/derived tokens).",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Token name to update",
            },
            value: {
              type: "string",
              description: "New value for the token",
            },
          },
          required: ["name", "value"],
        },
      },
      {
        name: "get_branding_tokens",
        description:
          "Get the core branding tokens that control the overall design system (brand colors, font bases, spacing base). These are the primary tokens to modify for theming.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["colors", "fonts", "spacing", "borders", "shadows", "all"],
              description: "Filter by branding token type (default: 'all')",
              default: "all",
            },
          },
        },
      },
    ],
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_token": {
        if (!args.name) {
          throw new Error("Token name is required");
        }

        const tokens = await parseAllTokens();
        const normalizedName = args.name.startsWith("--")
          ? args.name
          : `--${args.name}`;

        const tokenData = tokens.get(normalizedName);

        if (!tokenData) {
          // Suggest similar tokens
          const suggestions = [];
          const searchTerm = normalizedName.toLowerCase();
          for (const [tokenName] of tokens.entries()) {
            if (tokenName.toLowerCase().includes(searchTerm.slice(2, 15))) {
              suggestions.push(tokenName);
              if (suggestions.length >= 5) break;
            }
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: "Token not found",
                    requestedToken: normalizedName,
                    suggestions:
                      suggestions.length > 0 ? suggestions : undefined,
                    hint: "Use 'list_tokens' or 'search_tokens' to find available tokens",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  token: normalizedName,
                  value: tokenData.value,
                  file: tokenData.file,
                  category: tokenData.category,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "list_tokens": {
        const tokens = await parseAllTokens(args.file);
        let filteredTokens = Array.from(tokens.entries()).map(
          ([name, data]) => ({
            name,
            ...data,
          }),
        );

        // Apply category filter
        if (args.category) {
          const categoryPattern = args.category.toLowerCase();
          filteredTokens = filteredTokens.filter((token) =>
            token.name.toLowerCase().includes(categoryPattern),
          );
        }

        // Apply prefix filter
        if (args.prefix) {
          const prefixPattern = args.prefix.toLowerCase();
          const normalizedPrefix = prefixPattern.startsWith("--")
            ? prefixPattern
            : `--${prefixPattern}`;
          filteredTokens = filteredTokens.filter((token) =>
            token.name.toLowerCase().startsWith(normalizedPrefix),
          );
        }

        // Sort by name
        filteredTokens.sort((a, b) => a.name.localeCompare(b.name));

        // Paginate
        const limit = args.limit || 50;
        const offset = args.offset || 0;
        const total = filteredTokens.length;
        const paginatedTokens = filteredTokens.slice(offset, offset + limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  totalMatching: total,
                  returned: paginatedTokens.length,
                  offset,
                  limit,
                  hasMore: offset + limit < total,
                  filters: {
                    file: args.file || "all",
                    category: args.category || null,
                    prefix: args.prefix || null,
                  },
                  tokens: paginatedTokens,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "list_files": {
        const fileStats = [];
        for (const [key, config] of Object.entries(TOKEN_FILES)) {
          const filePath = path.join(TOKENS_DIR, config.file);
          try {
            await fs.access(filePath);
            const tokens = await parseTokenFile(filePath, config.category);
            fileStats.push({
              key,
              file: config.file,
              description: config.description,
              category: config.category,
              tokenCount: tokens.size,
            });
          } catch {
            fileStats.push({
              key,
              file: config.file,
              description: config.description,
              category: config.category,
              tokenCount: 0,
              status: "not found",
            });
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  totalFiles: fileStats.length,
                  files: fileStats,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "get_token_stats": {
        const stats = await getTokenStats();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      case "search_tokens": {
        if (!args.pattern) {
          throw new Error("Search pattern is required");
        }

        const tokens = await parseAllTokens(args.file);
        let results = searchTokens(
          tokens,
          args.pattern,
          args.searchIn || "both",
        );

        results.sort((a, b) => a.name.localeCompare(b.name));

        const limit = args.limit || 50;
        const limitedResults = results.slice(0, limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  pattern: args.pattern,
                  searchIn: args.searchIn || "both",
                  file: args.file || "all",
                  totalMatches: results.length,
                  returned: limitedResults.length,
                  results: limitedResults,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "get_tokens_by_type": {
        if (!args.type) {
          throw new Error("Semantic type is required");
        }

        const tokens = await parseAllTokens(args.file);
        let results = getTokensBySemanticType(tokens, args.type);

        results.sort((a, b) => a.name.localeCompare(b.name));

        const limit = args.limit || 50;
        const limitedResults = results.slice(0, limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  type: args.type,
                  file: args.file || "all",
                  totalMatches: results.length,
                  returned: limitedResults.length,
                  results: limitedResults,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "get_color_palette": {
        const colorFiles = [
          "branding",
          "color",
          "background-color",
          "text-color",
          "border-color",
        ];
        const allColors = [];

        for (const fileKey of colorFiles) {
          const tokens = await parseAllTokens(fileKey);
          for (const [tokenName, data] of tokens.entries()) {
            // Filter by color type if specified
            if (args.colorType) {
              if (
                !tokenName.toLowerCase().includes(args.colorType.toLowerCase())
              ) {
                continue;
              }
            }

            // Exclude scales unless requested
            if (!args.includeScales) {
              if (/(alpha-\d|to-bg-\d|to-fg-\d)/.test(tokenName)) {
                continue;
              }
            }

            allColors.push({
              name: tokenName,
              value: data.value,
              file: data.file,
              category: data.category,
            });
          }
        }

        allColors.sort((a, b) => a.name.localeCompare(b.name));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  colorType: args.colorType || "all",
                  includeScales: args.includeScales || false,
                  totalColors: allColors.length,
                  colors: allColors.slice(0, 100),
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "get_typography_tokens": {
        const tokens = await parseAllTokens();
        const typographyTokens = [];

        for (const [tokenName, data] of tokens.entries()) {
          const isTypography =
            tokenName.includes("font") ||
            tokenName.includes("line-height") ||
            tokenName.includes("letter-spacing");

          if (!isTypography) continue;

          // Filter by font type
          if (args.fontType) {
            if (
              !tokenName.toLowerCase().includes(args.fontType.toLowerCase())
            ) {
              continue;
            }
          }

          // Filter by property
          if (args.property) {
            const propertyPatterns = {
              family: /font-family/,
              weight: /font-weight/,
              size: /font-size/,
              "line-height": /line-height/,
            };
            if (!propertyPatterns[args.property]?.test(tokenName)) {
              continue;
            }
          }

          typographyTokens.push({
            name: tokenName,
            value: data.value,
            file: data.file,
            category: data.category,
          });
        }

        typographyTokens.sort((a, b) => a.name.localeCompare(b.name));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  fontType: args.fontType || "all",
                  property: args.property || "all",
                  totalTokens: typographyTokens.length,
                  tokens: typographyTokens.slice(0, 100),
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "get_spacing_tokens": {
        const tokens = await parseAllTokens("spacing");
        const brandingTokens = await parseAllTokens("branding");

        // Merge branding spacing tokens
        for (const [name, data] of brandingTokens.entries()) {
          if (name.includes("spacing")) {
            tokens.set(name, data);
          }
        }

        const spacingTokens = [];

        for (const [tokenName, data] of tokens.entries()) {
          // Filter by size
          if (args.size) {
            const sizePattern = new RegExp(`-${args.size}(-|$)`, "i");
            if (!sizePattern.test(tokenName)) {
              continue;
            }
          }

          // Filter by type
          if (args.type) {
            if (args.type === "base") {
              if (!tokenName.includes("-base")) continue;
            } else {
              if (!tokenName.includes(args.type)) continue;
            }
          }

          spacingTokens.push({
            name: tokenName,
            value: data.value,
            file: data.file,
            category: data.category,
          });
        }

        spacingTokens.sort((a, b) => a.name.localeCompare(b.name));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  size: args.size || "all",
                  type: args.type || "all",
                  totalTokens: spacingTokens.length,
                  tokens: spacingTokens,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "get_branding_tokens": {
        const tokens = await parseAllTokens("branding");
        const brandingTokens = [];

        const typeFilters = {
          colors: /color/i,
          fonts: /font/i,
          spacing: /spacing/i,
          borders: /border/i,
          shadows: /shadow/i,
        };

        for (const [tokenName, data] of tokens.entries()) {
          // Filter by type
          if (args.type && args.type !== "all") {
            const filter = typeFilters[args.type];
            if (filter && !filter.test(tokenName)) {
              continue;
            }
          }

          brandingTokens.push({
            name: tokenName,
            value: data.value,
            file: data.file,
            category: data.category,
            isEditable: !data.value.includes("var("),
          });
        }

        brandingTokens.sort((a, b) => a.name.localeCompare(b.name));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  type: args.type || "all",
                  totalTokens: brandingTokens.length,
                  note: "Tokens with isEditable=true can be modified directly",
                  tokens: brandingTokens,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "update_token": {
        if (!args.name) {
          throw new Error("Token name is required");
        }
        if (args.value === undefined || args.value === null) {
          throw new Error("Token value is required");
        }

        const result = await updateTokenInFile(args.name, args.value);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Token updated successfully",
                  ...result,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: error.message,
              tool: name,
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  try {
    // Verify tokens directory exists
    await fs.access(TOKENS_DIR);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("Design Tokens MCP Server v2.0.0 running on stdio");
    console.error(`Tokens directory: ${TOKENS_DIR}`);

    // Log available files
    const stats = await getTokenStats();
    console.error(`Total tokens available: ${stats.totalTokens}`);
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

main();
