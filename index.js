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

const TOKENS_FILE = path.join(__dirname, "tokens", "branding-token.css");

/**
 * Parse CSS file and extract all CSS Custom Properties (design tokens)
 * @returns {Promise<Map<string, string>>} Map of token names to their values
 */
async function parseTokens() {
  try {
    const content = await fs.readFile(TOKENS_FILE, "utf-8");
    const tokens = new Map();

    // Regular expression to match CSS custom properties
    // Matches: --token-name: value; including multiline values
    const tokenRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;

    let match;
    while ((match = tokenRegex.exec(content)) !== null) {
      const tokenName = `--${match[1]}`;
      const tokenValue = match[2].trim();
      tokens.set(tokenName, tokenValue);
    }

    return tokens;
  } catch (error) {
    throw new Error(`Failed to parse tokens: ${error.message}`);
  }
}

/**
 * Update a token value in the CSS file
 * @param {string} tokenName - The token name (with or without --)
 * @param {string} newValue - The new value for the token
 */
async function updateTokenInFile(tokenName, newValue) {
  try {
    // Ensure token name starts with --
    const normalizedName = tokenName.startsWith("--")
      ? tokenName
      : `--${tokenName}`;

    let content = await fs.readFile(TOKENS_FILE, "utf-8");

    // Create regex to find the specific token
    const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tokenRegex = new RegExp(`(${escapedName}\\s*:\\s*)([^;]+)(;)`, "g");

    // Check if token exists
    if (!tokenRegex.test(content)) {
      throw new Error(`Token '${normalizedName}' not found in file`);
    }

    // Reset regex and replace
    const updatedContent = content.replace(
      new RegExp(`(${escapedName}\\s*:\\s*)([^;]+)(;)`, "g"),
      `$1${newValue}$3`,
    );

    // Write back to file
    await fs.writeFile(TOKENS_FILE, updatedContent, "utf-8");

    return {
      success: true,
      tokenName: normalizedName,
      oldValue: content
        .match(new RegExp(`${escapedName}\\s*:\\s*([^;]+);`))?.[1]
        ?.trim(),
      newValue: newValue.trim(),
    };
  } catch (error) {
    throw new Error(`Failed to update token: ${error.message}`);
  }
}

/**
 * Search tokens by name or value pattern
 * @param {Map<string, string>} tokens - All tokens
 * @param {string} pattern - Search pattern (case-insensitive)
 * @param {string} searchIn - 'name', 'value', or 'both'
 * @returns {Array<{name: string, value: string}>} Matching tokens
 */
function searchTokens(tokens, pattern, searchIn = "both") {
  const results = [];
  const lowerPattern = pattern.toLowerCase();

  for (const [name, value] of tokens.entries()) {
    const matchName = searchIn === "both" || searchIn === "name";
    const matchValue = searchIn === "both" || searchIn === "value";

    const nameMatches = matchName && name.toLowerCase().includes(lowerPattern);
    const valueMatches =
      matchValue && value.toLowerCase().includes(lowerPattern);

    if (nameMatches || valueMatches) {
      results.push({ name, value });
    }
  }

  return results;
}

// Create MCP server instance
const server = new Server(
  {
    name: "design-tokens-server",
    version: "1.0.0",
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
          "Retrieve the value of a specific design token by name. Token names can be provided with or without the '--' prefix.",
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
          "List all available design tokens with their values. Optionally filter by category prefix.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description:
                "Optional category filter (e.g., 'color', 'font', 'spacing', 'border')",
            },
          },
        },
      },
      {
        name: "search_tokens",
        description:
          "Search for design tokens by pattern in their names or values. Returns all matching tokens.",
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
              description:
                "Where to search: 'name', 'value', or 'both' (default: 'both')",
              default: "both",
            },
          },
          required: ["pattern"],
        },
      },
      {
        name: "update_token",
        description:
          "Update the value of a design token and save it back to the CSS file. Creates a backup before modifying.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "The token name to update (with or without '--' prefix)",
            },
            value: {
              type: "string",
              description: "The new value for the token",
            },
          },
          required: ["name", "value"],
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

        const tokens = await parseTokens();
        const normalizedName = args.name.startsWith("--")
          ? args.name
          : `--${args.name}`;

        const value = tokens.get(normalizedName);

        if (!value) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: "Token not found",
                    requestedToken: normalizedName,
                    suggestion: "Use 'list_tokens' to see all available tokens",
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
                  value: value,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "list_tokens": {
        const tokens = await parseTokens();
        let filteredTokens = Array.from(tokens.entries()).map(
          ([name, value]) => ({
            name,
            value,
          }),
        );

        // Apply category filter if provided
        if (args.category) {
          const categoryPattern = args.category.toLowerCase();
          filteredTokens = filteredTokens.filter((token) =>
            token.name.toLowerCase().includes(categoryPattern),
          );
        }

        // Sort tokens by name
        filteredTokens.sort((a, b) => a.name.localeCompare(b.name));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  totalTokens: filteredTokens.length,
                  category: args.category || "all",
                  tokens: filteredTokens,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "search_tokens": {
        if (!args.pattern) {
          throw new Error("Search pattern is required");
        }

        const tokens = await parseTokens();
        const results = searchTokens(
          tokens,
          args.pattern,
          args.searchIn || "both",
        );

        // Sort results by name
        results.sort((a, b) => a.name.localeCompare(b.name));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  pattern: args.pattern,
                  searchIn: args.searchIn || "both",
                  totalMatches: results.length,
                  results: results,
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

        // Get current value first
        const tokens = await parseTokens();
        const normalizedName = args.name.startsWith("--")
          ? args.name
          : `--${args.name}`;

        if (!tokens.has(normalizedName)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: "Token not found",
                    requestedToken: normalizedName,
                    suggestion: "Use 'list_tokens' to see all available tokens",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Update the token
        const result = await updateTokenInFile(normalizedName, args.value);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Token updated successfully",
                  token: result.tokenName,
                  oldValue: result.oldValue,
                  newValue: result.newValue,
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
    // Verify tokens file exists
    await fs.access(TOKENS_FILE);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("Design Tokens MCP Server running on stdio");
    console.error(`Token file: ${TOKENS_FILE}`);
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

main();
