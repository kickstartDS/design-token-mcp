# Task List: Expose Component Tokens via MCP

**PRD:** [PRD-component-tokens.md](PRD-component-tokens.md)  
**Date:** 2026-02-12  

---

## Phase 1 — Data Layer (Foundation)

### 1.1 Component Token File Registry
- [ ] Define `COMPONENT_TOKEN_FILES` map with all 50 entries (file name, component slug, category, description)
- [ ] Define `COMPONENT_CATEGORIES` map grouping components into semantic categories (navigation, content, blog, cards, heroes, forms, layout, data-display, utility)
- [ ] Add `COMPONENT_TOKENS_DIR` constant pointing to `tokens/componentToken/`

### 1.2 Token Name Parser
- [ ] Implement `parseComponentTokenName(name)` function that decomposes `--dsa-{component}[__{element}][_{variant}]--{property}[_{state}]` into structured parts
- [ ] Handle edge cases: multi-word component names (`teaser-card`, `nav-flyout`), multi-word elements (`tag-label`, `toggle-more`), multi-word variants (`color-neutral`, `highlight-text`)
- [ ] Write inline tests / assertions for known token names from at least 5 different components

### 1.3 Token Value Classifier
- [ ] Implement `classifyTokenValue(value)` that returns `"literal"`, `"global-reference"`, `"component-reference"`, or `"calculated"`
- [ ] Extract referenced token name from `var()` expressions (handle `var(--xxx, fallback)` with fallbacks)
- [ ] Classify `calc(...)` containing `var()` as `"calculated"`

### 1.4 Component Token Parser
- [ ] Implement `parseAllComponentTokens(componentFilter?)` that reads SCSS files from `componentToken/` directory
- [ ] Reuse existing `parseTokenFile()` for the low-level CSS custom property extraction
- [ ] Enrich each parsed token with: `component`, `element`, `variant`, `cssProperty`, `state`, `valueType`, `referencedToken`
- [ ] Handle responsive overrides (container queries / media queries) — tag tokens inside `@container` or `@media` blocks as overrides
- [ ] Skip empty files gracefully (return 0 tokens, don't error)

---

## Phase 2 — New MCP Tools

### 2.1 `list_components` Tool
- [ ] Add tool definition to `ListToolsRequestSchema` handler with name, description, and input schema
- [ ] Implement handler in `CallToolRequestSchema` switch
- [ ] For each component: return `name`, `slug`, `category`, `file`, `tokenCount`, `description`, `hasResponsiveOverrides`
- [ ] Support `category` filter parameter
- [ ] Sort components alphabetically by name
- [ ] Exclude components with 0 tokens (or include them with a flag)

### 2.2 `get_component_tokens` Tool
- [ ] Add tool definition with `component` (required), `element`, `property`, `statesOnly` parameters
- [ ] Implement handler: load tokens for the requested component, apply filters
- [ ] Return enriched token records with `valueType`, `element`, `variant`, `cssProperty`, `state`, `referencedToken`
- [ ] Include a `summary` object listing all unique variants, elements, states, and property types for the component
- [ ] Include a `responsiveOverrides` array for container/media query overrides
- [ ] Return helpful error message with suggestions when component slug is not found

### 2.3 `search_component_tokens` Tool
- [ ] Add tool definition with `pattern` (required), `searchIn`, `component`, `category`, `limit` parameters
- [ ] Implement handler: load all component tokens, apply search pattern to names/values/comments
- [ ] Support filtering by component slug and category
- [ ] Sort results by component then token name
- [ ] Paginate with `limit` (default 50)
- [ ] Include component name and category in each result for context

---

## Phase 3 — Extend Existing Tools

### 3.1 Extend `list_tokens`
- [ ] Add `includeComponentTokens` boolean parameter to input schema (default: `false`)
- [ ] When `true`, merge component tokens into the result set
- [ ] Ensure existing `file`, `category`, `prefix` filters work with component tokens
- [ ] Update result metadata to indicate component tokens are included

### 3.2 Extend `search_tokens`
- [ ] Add `includeComponentTokens` boolean parameter (default: `false`)
- [ ] When `true`, search across both global and component tokens
- [ ] Merge and sort results; indicate source (global vs component) in each result

### 3.3 Extend `get_token_stats`
- [ ] Add `componentTokens` section to stats output
- [ ] Include: total component tokens, per-component counts, per-category counts, per-property-type counts
- [ ] Include: top referenced global tokens (which `--ks-*` tokens are used most by components)

### 3.4 Extend `list_files`
- [ ] Include component token files in the file listing
- [ ] Add `type: "component"` discriminator to differentiate from global files
- [ ] Include component slug and category for each component file

---

## Phase 4 — Quality & Polish

### 4.1 Component Descriptions
- [ ] Write concise, accurate descriptions for all 46 non-empty components (used in `list_components` and `list_files`)
- [ ] Include key variants, notable features, and typical use cases in each description

### 4.2 Testing
- [ ] Manually test `list_components` with no filter and each category filter
- [ ] Manually test `get_component_tokens` for at least 5 diverse components (button, hero, section, teaser-card, headline)
- [ ] Manually test `search_component_tokens` with various patterns: CSS property (`border-radius`), global token (`ks-color-primary`), state (`hover`), literal value (`transparent`)
- [ ] Manually test extended `list_tokens` and `search_tokens` with `includeComponentTokens: true`
- [ ] Verify `get_token_stats` output includes complete component statistics
- [ ] Verify `list_files` includes component files with correct metadata
- [ ] Test edge cases: empty component files, unknown component slug, very long result sets

### 4.3 Documentation
- [ ] Update README.md with new tool descriptions and example queries
- [ ] Add component token section to the tool listing
- [ ] Document typical workflows (discover → inspect → search)
- [ ] Update version number in package.json and server metadata

### 4.4 Performance Validation
- [ ] Verify `list_components` responds in < 2 seconds (reads all 50 files)
- [ ] Verify `get_component_tokens` for a single component responds in < 500ms
- [ ] Verify `search_component_tokens` full scan responds in < 3 seconds
- [ ] If any are too slow, add file-level caching with mtime-based invalidation
