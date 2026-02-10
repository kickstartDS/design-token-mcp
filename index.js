#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "node:http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKENS_DIR = path.join(__dirname, "tokens");
const BRANDING_JSON_FILE = path.join(TOKENS_DIR, "branding-token.json");

// Token file categories with metadata
const TOKEN_FILES = {
  branding: {
    file: "branding-tokens.css",
    description:
      "Core brand CSS custom properties (colors, fonts, spacing, factors)",
    category: "branding",
  },
  "branding-json": {
    file: "branding-token.json",
    description:
      "Structured JSON theme configuration (editable source of truth)",
    category: "branding-config",
    isJson: true,
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
 * Fetch an image from a URL and return it as a base64 string.
 * @param {string} url - The image URL to fetch
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const mimeType = contentType.split(";")[0].trim();

    const supportedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
    ];
    if (!supportedTypes.some((t) => mimeType.startsWith(t))) {
      throw new Error(
        `Unsupported image type: ${mimeType}. Supported: ${supportedTypes.join(", ")}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return { base64, mimeType };
  } catch (error) {
    throw new Error(`Failed to fetch image from URL: ${error.message}`);
  }
}

/**
 * Build schema descriptions for branding-token.json fields to guide theme generation.
 * @returns {Object}
 */
function getBrandingSchemaDescription() {
  return {
    "color.primary":
      "Main brand color (hex). Extract the dominant brand/accent color from the image.",
    "color.primary-inverted":
      "Primary color for dark/inverted backgrounds (hex). Often the same as primary or a lighter tint.",
    "color.background":
      "Main background color (hex). Usually white or a very light neutral.",
    "color.background-inverted":
      "Dark/inverted background color (hex). Usually a very dark shade of the primary or a dark neutral.",
    "color.foreground": "Main text color (hex). Usually very dark, near-black.",
    "color.foreground-inverted":
      "Text color on dark backgrounds (hex). Usually white or near-white.",
    "color.link":
      "Link color (hex). Often matches or is close to the primary color.",
    "color.link-inverted":
      "Link color on dark backgrounds (hex). A lighter/brighter variant of the link color.",
    "color.positive": "Success/positive semantic color (hex, typically green).",
    "color.positive-inverted": "Success color for dark backgrounds (hex).",
    "color.informative":
      "Informational semantic color (hex, typically blue/cyan).",
    "color.informative-inverted":
      "Informational color for dark backgrounds (hex).",
    "color.notice":
      "Warning/notice semantic color (hex, typically orange/yellow).",
    "color.notice-inverted": "Warning color for dark backgrounds (hex).",
    "color.negative": "Error/negative semantic color (hex, typically red).",
    "color.negative-inverted": "Error color for dark backgrounds (hex).",
    "font.display.family":
      "Display/heading font family CSS stack. Identify the heading typeface style (serif, sans-serif, slab, geometric, etc.).",
    "font.copy.family":
      "Body/copy font family CSS stack. Identify the body text typeface style.",
    "font.interface.family":
      "UI/interface font family CSS stack. Often the same as copy.",
    "font.mono.family": "Monospace font family CSS stack.",
    "font.display.font-size":
      "Base font size for display text in px (number, typically 16-20).",
    "font.display.line-height":
      "Line height for display text (number, typically 1.1-1.3).",
    "font.display.scale-ratio":
      "Type scale ratio for display headings (number, e.g. 1.25 for Major Third, 1.333 for Perfect Fourth).",
    "font.copy.font-size":
      "Base font size for body text in px (number, typically 16-18).",
    "font.copy.line-height":
      "Line height for body text (number, typically 1.4-1.6).",
    "spacing.base":
      "Base spacing unit in px (number, typically 8-16). Determines overall density.",
    "spacing.scale-ratio":
      "Spacing scale ratio (number, typically 1.25-1.5). Controls spacing progression.",
    "border-radius":
      "Default border radius as CSS value (e.g. '8px', '4px', '0px'). Rounded vs sharp corners.",
  };
}

/**
 * Read the JSON branding configuration
 * @returns {Promise<Object>}
 */
async function readBrandingJson() {
  try {
    const content = await fs.readFile(BRANDING_JSON_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read branding JSON: ${error.message}`);
  }
}

/**
 * Write the JSON branding configuration
 * @param {Object} config - The configuration object
 * @returns {Promise<void>}
 */
async function writeBrandingJson(config) {
  try {
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(BRANDING_JSON_FILE, content, "utf-8");
  } catch (error) {
    throw new Error(`Failed to write branding JSON: ${error.message}`);
  }
}

/**
 * Get a nested value from an object using dot notation path
 * @param {Object} obj
 * @param {string} path - e.g., "color.primary" or "font.display.family"
 * @returns {*}
 */
function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Set a nested value in an object using dot notation path
 * @param {Object} obj
 * @param {string} path
 * @param {*} value
 */
function setNestedValue(obj, path, value) {
  const keys = path.split(".");
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!(key in current)) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Flatten JSON object to dot notation paths
 * @param {Object} obj
 * @param {string} prefix
 * @returns {Array<{path: string, value: *, type: string}>}
 */
function flattenJsonConfig(obj, prefix = "") {
  const results = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      results.push(...flattenJsonConfig(value, path));
    } else {
      results.push({
        path,
        value,
        type: typeof value,
      });
    }
  }
  return results;
}

/**
 * Get a human-readable description for factor tokens
 * @param {string} tokenName - The token name
 * @returns {string}
 */
function getFactorDescription(tokenName) {
  const descriptions = {
    "duration-factor": "Multiplier for animation/transition durations",
    "border-radius-factor": "Multiplier for border radius values",
    "box-shadow-blur-factor": "Multiplier for box shadow blur radius",
    "box-shadow-opacity-factor": "Multiplier for box shadow opacity",
    "box-shadow-spread-factor": "Multiplier for box shadow spread radius",
    "spacing-factor": "Multiplier for spacing values",
    "scale-ratio": "Base ratio for typographic/spacing scales",
    "bp-factor": "Breakpoint factor for responsive scaling",
    "bp-ratio": "Breakpoint ratio for responsive calculations",
  };

  for (const [key, desc] of Object.entries(descriptions)) {
    if (tokenName.toLowerCase().includes(key.toLowerCase())) {
      return desc;
    }
  }
  return "Factor/ratio token for calculations";
}

/**
 * Parse a single CSS/SCSS file and extract all CSS Custom Properties with comments
 * @param {string} filePath - Path to the token file
 * @param {string} category - Category name for the tokens
 * @returns {Promise<Map<string, {value: string, file: string, category: string, comment?: string, section?: string}>>}
 */
async function parseTokenFile(filePath, category) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const tokens = new Map();
    const fileName = path.basename(filePath);
    const lines = content.split("\n");

    let currentSection = null;
    let pendingComments = [];
    let inBlockComment = false;
    let blockCommentLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Handle block comment start
      if (trimmedLine.startsWith("/*") && !trimmedLine.includes("*/")) {
        inBlockComment = true;
        const commentStart = trimmedLine.replace(/^\/\*\s*/, "").trim();
        if (commentStart) {
          blockCommentLines.push(commentStart);
        }
        continue;
      }

      // Handle block comment continuation
      if (inBlockComment) {
        if (trimmedLine.includes("*/")) {
          inBlockComment = false;
          const commentEnd = trimmedLine
            .replace(/\*\/.*$/, "")
            .replace(/^\*\s*/, "")
            .trim();
          if (commentEnd) {
            blockCommentLines.push(commentEnd);
          }
          // Add accumulated block comment to pending comments
          if (blockCommentLines.length > 0) {
            pendingComments.push(blockCommentLines.join(" "));
          }
          blockCommentLines = [];
          continue;
        } else {
          // Middle of block comment
          const commentMiddle = trimmedLine.replace(/^\*\s*/, "").trim();
          if (commentMiddle) {
            blockCommentLines.push(commentMiddle);
          }
          continue;
        }
      }

      // Handle single-line block comments /* ... */
      const singleLineBlockMatch = trimmedLine.match(/^\/\*\s*(.+?)\s*\*\/$/);
      if (singleLineBlockMatch) {
        pendingComments.push(singleLineBlockMatch[1]);
        continue;
      }

      // Check for section headers (/// or // ALL CAPS or // Title Case followed by newline)
      if (trimmedLine.startsWith("///")) {
        currentSection = trimmedLine.replace(/^\/\/\/\s*/, "").trim();
        pendingComments = []; // Section header resets pending comments
        continue;
      }

      // Check for regular comments (could be inline documentation)
      if (trimmedLine.startsWith("//") && !trimmedLine.startsWith("///")) {
        const commentText = trimmedLine.replace(/^\/\/\s*/, "").trim();
        if (commentText) {
          pendingComments.push(commentText);
        }
        continue;
      }

      // Check for CSS custom property definition
      const tokenMatch = line.match(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/);
      if (tokenMatch) {
        const tokenName = `--${tokenMatch[1]}`;
        const tokenValue = tokenMatch[2].trim().replace(/\s+/g, " ");

        // Check for inline comment after the value (both // and /* */)
        const inlineSlashComment = line.match(/;\s*\/\/\s*(.+)$/);
        const inlineBlockComment = line.match(/;\s*\/\*\s*(.+?)\s*\*\/\s*$/);
        let inlineComment = inlineSlashComment
          ? inlineSlashComment[1].trim()
          : inlineBlockComment
            ? inlineBlockComment[1].trim()
            : null;

        // Build the token data
        const tokenData = {
          value: tokenValue,
          file: fileName,
          category: category,
        };

        // Add section if available
        if (currentSection) {
          tokenData.section = currentSection;
        }

        // Combine pending comments and inline comment
        const allComments = [...pendingComments];
        if (inlineComment) {
          allComments.push(inlineComment);
        }

        if (allComments.length > 0) {
          tokenData.comment = allComments.join(" | ");
        }

        tokens.set(tokenName, tokenData);
        pendingComments = []; // Reset pending comments after token
      }

      // Reset pending comments if we hit a non-comment, non-token line (like a selector)
      if (
        !trimmedLine.startsWith("//") &&
        !trimmedLine.startsWith("/*") &&
        !trimmedLine.includes("--") &&
        trimmedLine.length > 0 &&
        !trimmedLine.startsWith("{") &&
        !trimmedLine.startsWith("}")
      ) {
        // Don't reset on empty lines or braces, but reset on selectors
        if (trimmedLine.includes(":root") || trimmedLine.includes("[ks-")) {
          // Keep section, but reset inline comments for new block
          pendingComments = [];
        }
      }
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
    const matchComment = searchIn === "both" && data.comment;

    const nameMatches = matchName && name.toLowerCase().includes(lowerPattern);
    const valueMatches =
      matchValue && data.value.toLowerCase().includes(lowerPattern);
    const commentMatches =
      matchComment && data.comment.toLowerCase().includes(lowerPattern);

    if (nameMatches || valueMatches || commentMatches) {
      results.push({
        name,
        value: data.value,
        file: data.file,
        category: data.category,
        ...(data.section && { section: data.section }),
        ...(data.comment && { comment: data.comment }),
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
        ...(data.section && { section: data.section }),
        ...(data.comment && { comment: data.comment }),
      });
    }
  }

  return results;
}

// Create MCP server instance
const server = new Server(
  {
    name: "design-tokens-server",
    version: "3.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

/**
 * Register all MCP tool handlers on a given Server instance.
 * Extracted so that both stdio and HTTP session servers share the same logic.
 * @param {Server} srv
 */
function registerHandlers(srv) {
  // Tool definitions
  srv.setRequestHandler(ListToolsRequestSchema, async () => {
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
                enum: [
                  "colors",
                  "fonts",
                  "spacing",
                  "borders",
                  "shadows",
                  "factors",
                  "all",
                ],
                description: "Filter by branding token type (default: 'all')",
                default: "all",
              },
            },
          },
        },
        {
          name: "get_theme_config",
          description:
            "Get the JSON theme configuration file (branding-token.json). This is the structured source of truth for theming that controls colors, fonts, spacing, breakpoints, and other design decisions.",
          inputSchema: {
            type: "object",
            properties: {
              section: {
                type: "string",
                enum: [
                  "color",
                  "font",
                  "font-weight",
                  "spacing",
                  "border-radius",
                  "box-shadow",
                  "breakpoints",
                  "all",
                ],
                description:
                  "Get a specific section of the config (default: 'all')",
                default: "all",
              },
            },
          },
        },
        {
          name: "update_theme_config",
          description:
            "Update a value in the JSON theme configuration (branding-token.json). Use dot notation for nested paths like 'color.primary' or 'font.display.family'. This is the recommended way to change theme values.",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description:
                  "Dot notation path to the value (e.g., 'color.primary', 'font.display.font-size', 'spacing.base')",
              },
              value: {
                type: ["string", "number", "boolean", "object"],
                description: "New value to set",
              },
            },
            required: ["path", "value"],
          },
        },
        {
          name: "list_theme_values",
          description:
            "List all values in the JSON theme configuration as a flat list with dot notation paths. Useful for seeing all configurable theme values at once.",
          inputSchema: {
            type: "object",
            properties: {
              filter: {
                type: "string",
                description:
                  "Filter paths containing this string (e.g., 'color', 'font', 'bp-factor')",
              },
            },
          },
        },
        {
          name: "get_factor_tokens",
          description:
            "Get factor-based tokens that control scaling (duration, border-radius, box-shadow, spacing factors). These are multipliers that affect the intensity of design elements.",
          inputSchema: {
            type: "object",
            properties: {
              factorType: {
                type: "string",
                enum: [
                  "duration",
                  "border-radius",
                  "box-shadow",
                  "spacing",
                  "font-size",
                  "all",
                ],
                description: "Filter by factor type (default: 'all')",
                default: "all",
              },
            },
          },
        },
        {
          name: "get_breakpoint_tokens",
          description:
            "Get breakpoint-related tokens including breakpoint values and responsive scaling factors (bp-factor).",
          inputSchema: {
            type: "object",
            properties: {
              includeFactors: {
                type: "boolean",
                description:
                  "Include bp-factor tokens for responsive scaling (default: true)",
                default: true,
              },
            },
          },
        },
        {
          name: "get_duration_tokens",
          description:
            "Get animation/transition duration and timing function tokens.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "generate_theme_from_image",
          description:
            "Analyze a website screenshot or design image to generate a branding theme. Accepts either a base64-encoded image or an image URL. Returns the image for visual analysis alongside the current theme schema with field descriptions. Use your vision capabilities to examine the image, extract colors, typography cues, and spacing characteristics, then call update_theme_config for each value to apply the generated theme.",
          inputSchema: {
            type: "object",
            properties: {
              imageBase64: {
                type: "string",
                description:
                  "Base64-encoded image data (PNG, JPEG, or WebP). Provide this OR imageUrl, not both.",
              },
              imageUrl: {
                type: "string",
                description:
                  "URL to a website screenshot or design image. The server will fetch and convert it. Provide this OR imageBase64, not both.",
              },
              mimeType: {
                type: "string",
                enum: ["image/png", "image/jpeg", "image/webp"],
                description:
                  "MIME type of the image when providing imageBase64 (default: 'image/png'). Ignored when using imageUrl (auto-detected).",
                default: "image/png",
              },
            },
          },
        },
      ],
    };
  });

  // Tool execution handler
  srv.setRequestHandler(CallToolRequestSchema, async (request) => {
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
                    ...(tokenData.section && { section: tokenData.section }),
                    ...(tokenData.comment && { comment: tokenData.comment }),
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
                  !tokenName
                    .toLowerCase()
                    .includes(args.colorType.toLowerCase())
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
                ...(data.section && { section: data.section }),
                ...(data.comment && { comment: data.comment }),
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
              ...(data.section && { section: data.section }),
              ...(data.comment && { comment: data.comment }),
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
              ...(data.section && { section: data.section }),
              ...(data.comment && { comment: data.comment }),
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
              ...(data.section && { section: data.section }),
              ...(data.comment && { comment: data.comment }),
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

        case "get_theme_config": {
          const config = await readBrandingJson();

          let result;
          if (args.section) {
            const sectionData = config[args.section];
            if (sectionData === undefined) {
              throw new Error(
                `Unknown section: ${args.section}. Available sections: ${Object.keys(config).join(", ")}`,
              );
            }
            result = {
              section: args.section,
              data: sectionData,
              availableSections: Object.keys(config),
            };
          } else {
            result = {
              sections: Object.keys(config),
              config: config,
              note: "Use the 'section' parameter to get specific sections like 'color', 'font', 'spacing', etc.",
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "update_theme_config": {
          if (!args.path) {
            throw new Error(
              "Path is required (e.g., 'color.primary', 'font.copy.font-size')",
            );
          }
          if (args.value === undefined || args.value === null) {
            throw new Error("Value is required");
          }

          const config = await readBrandingJson();
          const oldValue = getNestedValue(config, args.path);

          if (oldValue === undefined) {
            throw new Error(`Path not found: ${args.path}`);
          }

          setNestedValue(config, args.path, args.value);
          await writeBrandingJson(config);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    message: "Theme configuration updated successfully",
                    path: args.path,
                    oldValue: oldValue,
                    newValue: args.value,
                    note: "Remember to regenerate CSS tokens if needed",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "list_theme_values": {
          const config = await readBrandingJson();
          const flatValues = flattenJsonConfig(config);

          let filtered = flatValues;
          if (args.filter) {
            const filterLower = args.filter.toLowerCase();
            filtered = flatValues.filter(
              (item) =>
                item.path.toLowerCase().includes(filterLower) ||
                String(item.value).toLowerCase().includes(filterLower),
            );
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    filter: args.filter || "none",
                    totalValues: filtered.length,
                    values: filtered,
                    note: "Use update_theme_config with the 'path' to modify values",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "get_factor_tokens": {
          const tokens = await parseAllTokens("branding");
          const factorTokens = [];

          const factorPatterns = [/factor/i, /ratio/i, /scale/i, /multiplier/i];

          for (const [tokenName, data] of tokens.entries()) {
            const isFactorToken = factorPatterns.some((pattern) =>
              pattern.test(tokenName),
            );

            if (!isFactorToken) continue;

            // Filter by type if specified
            if (args.type) {
              if (!tokenName.toLowerCase().includes(args.type.toLowerCase())) {
                continue;
              }
            }

            factorTokens.push({
              name: tokenName,
              value: data.value,
              file: data.file,
              category: data.category,
              description: getFactorDescription(tokenName),
              ...(data.section && { section: data.section }),
              ...(data.comment && { comment: data.comment }),
            });
          }

          factorTokens.sort((a, b) => a.name.localeCompare(b.name));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    type: args.type || "all",
                    totalTokens: factorTokens.length,
                    note: "Factor tokens are multipliers that affect other token calculations",
                    tokens: factorTokens,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "get_breakpoint_tokens": {
          const tokens = await parseAllTokens("branding");
          const breakpointTokens = [];

          for (const [tokenName, data] of tokens.entries()) {
            const isBreakpoint =
              tokenName.includes("breakpoint") ||
              tokenName.includes("bp-") ||
              tokenName.includes("-bp");

            if (!isBreakpoint) continue;

            breakpointTokens.push({
              name: tokenName,
              value: data.value,
              file: data.file,
              category: data.category,
              ...(data.section && { section: data.section }),
              ...(data.comment && { comment: data.comment }),
            });
          }

          // Also get breakpoints from JSON config
          const config = await readBrandingJson();
          if (config.breakpoints) {
            for (const [bpName, bpValue] of Object.entries(
              config.breakpoints,
            )) {
              breakpointTokens.push({
                name: `breakpoint.${bpName}`,
                value: bpValue,
                file: "branding-token.json",
                category: "json-config",
                source: "json",
              });
            }
          }

          breakpointTokens.sort((a, b) => a.name.localeCompare(b.name));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    totalTokens: breakpointTokens.length,
                    note: "Breakpoints define responsive design boundaries",
                    tokens: breakpointTokens,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "get_duration_tokens": {
          const tokens = await parseAllTokens("branding");
          const durationTokens = [];

          for (const [tokenName, data] of tokens.entries()) {
            const isDuration =
              tokenName.includes("duration") ||
              tokenName.includes("timing") ||
              tokenName.includes("transition") ||
              tokenName.includes("animation");

            if (!isDuration) continue;

            durationTokens.push({
              name: tokenName,
              value: data.value,
              file: data.file,
              category: data.category,
              ...(data.section && { section: data.section }),
              ...(data.comment && { comment: data.comment }),
            });
          }

          durationTokens.sort((a, b) => a.name.localeCompare(b.name));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    totalTokens: durationTokens.length,
                    note: "Duration tokens control animation and transition timing",
                    tokens: durationTokens,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "generate_theme_from_image": {
          if (!args.imageBase64 && !args.imageUrl) {
            throw new Error(
              "Either 'imageBase64' or 'imageUrl' must be provided",
            );
          }
          if (args.imageBase64 && args.imageUrl) {
            throw new Error(
              "Provide either 'imageBase64' or 'imageUrl', not both",
            );
          }

          let base64Data;
          let mimeType;

          if (args.imageUrl) {
            // Fetch the image from the URL
            const fetched = await fetchImageAsBase64(args.imageUrl);
            base64Data = fetched.base64;
            mimeType = fetched.mimeType;
          } else {
            // Use the provided base64 data directly
            base64Data = args.imageBase64;
            mimeType = args.mimeType || "image/png";
          }

          // Read the current theme config as the schema template
          const config = await readBrandingJson();
          const schemaDescription = getBrandingSchemaDescription();

          return {
            content: [
              {
                type: "image",
                data: base64Data,
                mimeType: mimeType,
              },
              {
                type: "text",
                text: JSON.stringify(
                  {
                    instruction:
                      "Analyze this image and generate a branding theme based on what you see. " +
                      "Look at the colors, typography style, spacing density, and visual personality of the design. " +
                      "Then use the 'update_theme_config' tool to apply each value. " +
                      "The 'path' parameter uses dot notation matching the schema below.",
                    currentTheme: config,
                    schemaDescription: schemaDescription,
                    availablePaths: Object.keys(schemaDescription),
                    tips: [
                      "Extract the dominant brand color for 'color.primary'",
                      "Identify if headings use a serif or sans-serif typeface for 'font.display.family'",
                      "Estimate spacing density: tight (base ~8-10), normal (12-14), generous (16-20)",
                      "Observe corner rounding: sharp (0-2px), slightly rounded (4-6px), rounded (8-12px), pill (16px+)",
                      "Derive inverted/dark-mode colors as lighter or more saturated variants of the base colors",
                      "For font families, provide a full CSS font stack with appropriate fallbacks",
                    ],
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
} // end registerHandlers

// Start the server
async function main() {
  try {
    // Verify tokens directory exists
    await fs.access(TOKENS_DIR);

    const transportType = process.env.MCP_TRANSPORT || "stdio";
    const stats = await getTokenStats();

    if (transportType === "http") {
      // --- Streamable HTTP transport (for cloud / remote deployment) ---
      const PORT = parseInt(process.env.PORT || "3000", 10);

      const httpServer = createServer(async (req, res) => {
        const url = new URL(req.url, `http://localhost:${PORT}`);

        // Health check endpoint for Kamal / load balancer probes
        if (url.pathname === "/health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "ok",
              version: "3.0.0",
              tokens: stats.totalTokens,
            }),
          );
          return;
        }

        // MCP endpoint
        if (url.pathname === "/mcp") {
          // Stateless mode: every request gets its own transport and server.
          // This avoids session-affinity issues behind reverse proxies / load
          // balancers and survives container restarts without stale sessions.
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // stateless – no session ID
          });

          transport.onclose = () => {
            // nothing to clean up in stateless mode
          };

          const sessionServer = new Server(
            { name: "design-tokens-server", version: "3.0.0" },
            { capabilities: { tools: {} } },
          );

          registerHandlers(sessionServer);

          await sessionServer.connect(transport);

          await transport.handleRequest(req, res);
          return;
        }

        // Fallback — unknown route
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
      });

      httpServer.listen(PORT, () => {
        console.error(
          `Design Tokens MCP Server v3.0.0 running on HTTP port ${PORT}`,
        );
        console.error(`  MCP endpoint:   http://localhost:${PORT}/mcp`);
        console.error(`  Health check:   http://localhost:${PORT}/health`);
        console.error(`  Tokens directory: ${TOKENS_DIR}`);
        console.error(`  Total tokens available: ${stats.totalTokens}`);
      });

      // Graceful shutdown
      const shutdown = async () => {
        console.error("Shutting down…");
        httpServer.close();
        process.exit(0);
      };
      process.on("SIGTERM", shutdown);
      process.on("SIGINT", shutdown);
    } else {
      // --- stdio transport (for local MCP clients like Claude Desktop) ---
      registerHandlers(server);
      const transport = new StdioServerTransport();
      await server.connect(transport);

      console.error("Design Tokens MCP Server v3.0.0 running on stdio");
      console.error(`Tokens directory: ${TOKENS_DIR}`);
      console.error(`Total tokens available: ${stats.totalTokens}`);
    }
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

main();
