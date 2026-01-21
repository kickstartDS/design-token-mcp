# Quick Start Guide

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Make the server executable (optional):**

   ```bash
   chmod +x index.js
   ```

3. **Test the server:**
   ```bash
   npm start
   ```
   The server will start and wait for MCP client connections via stdio.

## Configuration

### For Claude Desktop

1. Open Claude Desktop settings
2. Navigate to Developer → Edit Config
3. Add the server configuration:

```json
{
  "mcpServers": {
    "design-tokens": {
      "command": "node",
      "args": [
        "/home/julrich/Projects/kickstartDS/code/ds-agency-premium-mcp-demo/design-tokens-mcp/index.js"
      ]
    }
  }
}
```

4. Restart Claude Desktop

### For Other MCP Clients

Use the configuration from `mcp-config-example.json` and adjust the path accordingly.

## Usage Examples

Once connected to an MCP client (like Claude), you can use natural language:

### Get a Specific Token

- "What's the value of the primary brand color?"
- "Show me the ks-brand-color-primary token"

### List Tokens

- "List all color tokens"
- "Show me all available design tokens"
- "What font tokens are available?"

### Search Tokens

- "Find all tokens with 'primary' in the name"
- "Search for tokens with the value '#3065c0'"
- "Show tokens related to spacing"

### Update Tokens

- "Change the primary color to #4075d0"
- "Update ks-brand-color-bg to #f5f5f5"
- "Set the border radius to 10px"

## Verifying It Works

After configuration, ask your MCP client:
"List all design tokens with 'color' in the name"

If successful, you'll see a JSON response with all matching color tokens.

## Troubleshooting

### Server won't start

- Verify Node.js version: `node --version` (needs 16+)
- Check dependencies: `npm install`
- Verify file permissions: `chmod +x index.js`

### MCP client can't connect

- Check the absolute path in your config
- Ensure the config file is valid JSON
- Restart your MCP client after configuration changes

### Token file not found

- Verify `tokens/branding-token.css` exists
- Check file permissions

### Changes not persisting

- Verify write permissions on `tokens/branding-token.css`
- Check for file system errors in the server logs

## Next Steps

- Explore all four tools: get_token, list_tokens, search_tokens, update_token
- Try different search patterns and filters
- Modify token values and verify changes in the CSS file
- Consider extending the server to support multiple token files

## Support

For issues or questions, refer to the main README.md file for detailed documentation.
