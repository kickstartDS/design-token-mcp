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
const COMPONENT_TOKENS_DIR = path.join(TOKENS_DIR, "componentToken");
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

// Component categories for grouping
const COMPONENT_CATEGORIES = {
  navigation: [
    "header",
    "nav-flyout",
    "nav-toggle",
    "nav-topbar",
    "breadcrumb",
    "content-nav",
    "pagination",
  ],
  content: ["headline", "rich-text", "text", "image-text", "image-story"],
  blog: ["blog-aside", "blog-head", "blog-teaser"],
  cards: ["teaser-card", "business-card", "contact"],
  heroes: ["hero", "cta", "video-curtain"],
  forms: [
    "button",
    "checkbox",
    "checkbox-group",
    "radio",
    "radio-group",
    "text-field",
    "text-area",
    "select-field",
  ],
  layout: ["section", "split-even", "split-weighted", "mosaic", "gallery"],
  "data-display": [
    "stats",
    "features",
    "faq",
    "testimonials",
    "downloads",
    "logos",
  ],
  utility: [
    "divider",
    "lightbox",
    "slider",
    "cookie-consent",
    "footer",
    "html",
    "logo",
    "event-latest",
    "event-latest-teaser",
    "event-list-teaser",
  ],
};

// Component token file registry — all 50 files
const COMPONENT_TOKEN_FILES = {
  "blog-aside": {
    file: "blog-aside-tokens.scss",
    category: "blog",
    description: "Blog sidebar with author info, metadata, and share bar",
  },
  "blog-head": {
    file: "blog-head-tokens.scss",
    category: "blog",
    description: "Blog article header with date, headline, and spacing",
  },
  "blog-teaser": {
    file: "blog-teaser-tokens.scss",
    category: "blog",
    description:
      "Blog teaser card with image, topic, copy, and author metadata",
  },
  breadcrumb: {
    file: "breadcrumb-tokens.scss",
    category: "navigation",
    description: "Breadcrumb navigation with icon separators",
  },
  "business-card": {
    file: "business-card-tokens.scss",
    category: "cards",
    description: "Business card with image, contact info, avatar, and links",
  },
  button: {
    file: "button-tokens.scss",
    category: "forms",
    description:
      "Button with primary/secondary/tertiary variants and small/medium/large sizes",
  },
  "checkbox-group": {
    file: "checkbox-group-tokens.scss",
    category: "forms",
    description: "Checkbox group container with label styling",
  },
  checkbox: {
    file: "checkbox-tokens.scss",
    category: "forms",
    description: "Checkbox input with checked/hover/focus states and label",
  },
  contact: {
    file: "contact-tokens.scss",
    category: "cards",
    description:
      "Contact card with image, title, copy, and linked contact items",
  },
  "content-nav": {
    file: "content-nav-tokens.scss",
    category: "navigation",
    description: "Content navigation panel with links, image, and toggle",
  },
  "cookie-consent": {
    file: "cookie-consent-tokens.scss",
    category: "utility",
    description:
      "Cookie consent banner/dialog with options, toggles, and overlay",
  },
  cta: {
    file: "cta-tokens.scss",
    category: "heroes",
    description:
      "Call-to-action section with headline, copy, image, and color variants",
  },
  divider: {
    file: "divider-tokens.scss",
    category: "utility",
    description: "Visual divider/separator with accent variant",
  },
  downloads: {
    file: "downloads-tokens.scss",
    category: "data-display",
    description: "Downloads list with file items, icons, and hover states",
  },
  "event-latest-teaser": {
    file: "event-latest-teaser-tokens.scss",
    category: "utility",
    description: "Event latest teaser (placeholder — no tokens defined)",
  },
  "event-latest": {
    file: "event-latest-tokens.scss",
    category: "utility",
    description: "Event latest component (placeholder — no tokens defined)",
  },
  "event-list-teaser": {
    file: "event-list-teaser-tokens.scss",
    category: "utility",
    description: "Event list teaser (placeholder — no tokens defined)",
  },
  faq: {
    file: "faq-tokens.scss",
    category: "data-display",
    description: "FAQ accordion with summary/answer styling and expand icon",
  },
  features: {
    file: "features-tokens.scss",
    category: "data-display",
    description:
      "Features list with icons, titles, copy, and links at multiple sizes",
  },
  footer: {
    file: "footer-tokens.scss",
    category: "utility",
    description: "Page footer with logo, byline, and navigation links",
  },
  gallery: {
    file: "gallery-tokens.scss",
    category: "layout",
    description: "Image gallery with configurable tile sizes and aspect ratios",
  },
  header: {
    file: "header-tokens.scss",
    category: "navigation",
    description:
      "Page header with logo, floating variant, and responsive spacing",
  },
  headline: {
    file: "headline-tokens.scss",
    category: "content",
    description:
      "Headline component with h1–h4 levels, subheadline, and highlight styling",
  },
  hero: {
    file: "hero-tokens.scss",
    category: "heroes",
    description:
      "Hero banner with textbox, overlay gradients, and responsive min-height",
  },
  html: {
    file: "html-tokens.scss",
    category: "utility",
    description: "HTML embed container with consent overlay styling",
  },
  "image-story": {
    file: "image-story-tokens.scss",
    category: "content",
    description: "Image-story (storytelling) layout with copy and spacing",
  },
  "image-text": {
    file: "image-text-tokens.scss",
    category: "content",
    description: "Image-text block with standard and highlight variants",
  },
  lightbox: {
    file: "lightbox-tokens.scss",
    category: "utility",
    description:
      "Lightbox overlay with counter, buttons, and placeholder background",
  },
  logo: {
    file: "logo-tokens.scss",
    category: "utility",
    description: "Logo component (placeholder — no tokens defined)",
  },
  logos: {
    file: "logos-tokens.scss",
    category: "data-display",
    description: "Logo grid with tagline, responsive columns, and gap control",
  },
  mosaic: {
    file: "mosaic-tokens.scss",
    category: "layout",
    description: "Mosaic layout with headline, copy, and content padding",
  },
  "nav-flyout": {
    file: "nav-flyout-tokens.scss",
    category: "navigation",
    description:
      "Flyout navigation menu with labels, sublist, transitions, and dimmed states",
  },
  "nav-toggle": {
    file: "nav-toggle-tokens.scss",
    category: "navigation",
    description: "Navigation hamburger toggle with floating variant",
  },
  "nav-topbar": {
    file: "nav-topbar-tokens.scss",
    category: "navigation",
    description:
      "Top navigation bar with label styling, icons, and floating variant",
  },
  pagination: {
    file: "pagination-tokens.scss",
    category: "navigation",
    description: "Pagination controls with active state and responsive border",
  },
  "radio-group": {
    file: "radio-group-tokens.scss",
    category: "forms",
    description: "Radio button group container with label styling",
  },
  radio: {
    file: "radio-tokens.scss",
    category: "forms",
    description: "Radio button input with checked/hover/focus states and label",
  },
  "rich-text": {
    file: "rich-text-tokens.scss",
    category: "content",
    description: "Rich text block with headline and body copy styling",
  },
  section: {
    file: "section-tokens.scss",
    category: "layout",
    description:
      "Section layout with columns, gutters, content widths, backgrounds, and slider",
  },
  "select-field": {
    file: "select-field-tokens.scss",
    category: "forms",
    description: "Select dropdown with border states, label, and placeholder",
  },
  slider: {
    file: "slider-tokens.scss",
    category: "utility",
    description: "Content slider with arrow and bullet navigation controls",
  },
  "split-even": {
    file: "split-even-tokens.scss",
    category: "layout",
    description:
      "Even-split layout with configurable gutters and content widths",
  },
  "split-weighted": {
    file: "split-weighted-tokens.scss",
    category: "layout",
    description:
      "Weighted-split layout with main/aside areas and gutter control",
  },
  stats: {
    file: "stats-tokens.scss",
    category: "data-display",
    description:
      "Statistics display with icon, number, topic, and copy styling",
  },
  "teaser-card": {
    file: "teaser-card-tokens.scss",
    category: "cards",
    description:
      "Teaser card with image, topic, label, copy, and compact variant",
  },
  testimonials: {
    file: "testimonials-tokens.scss",
    category: "data-display",
    description:
      "Testimonial quotes with source, byline, image, and quote icon",
  },
  "text-area": {
    file: "text-area-tokens.scss",
    category: "forms",
    description: "Textarea input with border states, label, and placeholder",
  },
  "text-field": {
    file: "text-field-tokens.scss",
    category: "forms",
    description:
      "Text input field with border states, shadow, label, and placeholder",
  },
  text: {
    file: "text-tokens.scss",
    category: "content",
    description: "Text block with highlight variant and multi-column support",
  },
  "video-curtain": {
    file: "video-curtain-tokens.scss",
    category: "heroes",
    description:
      "Video curtain hero with headline, copy, textbox, and overlay gradients",
  },
};

// Reverse lookup: component slug → category
const COMPONENT_CATEGORY_MAP = {};
for (const [category, components] of Object.entries(COMPONENT_CATEGORIES)) {
  for (const slug of components) {
    COMPONENT_CATEGORY_MAP[slug] = category;
  }
}

/**
 * Classify a token value as literal, global-reference, component-reference, or calculated.
 * @param {string} value - The raw CSS value string
 * @returns {{valueType: string, referencedToken: string|null}}
 */
function classifyTokenValue(value) {
  const trimmed = value.trim();

  // Calculated values: calc() containing var()
  if (/calc\s*\(/.test(trimmed) && /var\s*\(/.test(trimmed)) {
    // Extract the first var() reference inside calc
    const varMatch = trimmed.match(/var\(\s*(--[a-zA-Z0-9-]+)/);
    return {
      valueType: "calculated",
      referencedToken: varMatch ? varMatch[1] : null,
    };
  }

  // var() references
  const varMatch = trimmed.match(/^var\(\s*(--[a-zA-Z0-9-]+)/);
  if (varMatch) {
    const refToken = varMatch[1];
    // Component reference (--dsa-*) vs global reference (--ks-* or --l-*)
    if (refToken.startsWith("--dsa-") || refToken.startsWith("--l-")) {
      return { valueType: "component-reference", referencedToken: refToken };
    }
    return { valueType: "global-reference", referencedToken: refToken };
  }

  // Values that contain var() but aren't pure var() (e.g., shorthand values with multiple var())
  if (/var\s*\(/.test(trimmed)) {
    const firstVar = trimmed.match(/var\(\s*(--[a-zA-Z0-9-]+)/);
    const refToken = firstVar ? firstVar[1] : null;
    if (
      refToken &&
      (refToken.startsWith("--dsa-") || refToken.startsWith("--l-"))
    ) {
      return { valueType: "component-reference", referencedToken: refToken };
    }
    if (refToken) {
      return { valueType: "global-reference", referencedToken: refToken };
    }
  }

  return { valueType: "literal", referencedToken: null };
}

/**
 * Parse a component token name into structured parts.
 *
 * Token naming convention:
 *   --dsa-{component}[__{element}][_{variant}]--{property}[_{state}]
 *
 * Also handles layout tokens: --l-{component}...
 *
 * @param {string} name - Full token name like "--dsa-button_primary--color_hover"
 * @param {string} knownComponent - The known component slug for this file
 * @returns {{element: string|null, variant: string|null, cssProperty: string, state: string|null}}
 */
function parseComponentTokenName(name, knownComponent) {
  // States that can appear as suffixes
  const STATES = [
    "hover",
    "active",
    "focus",
    "checked",
    "selected",
    "disabled",
    "open",
  ];

  // Strip the leading -- and the component prefix (--dsa-button or --l-split-even)
  let remainder = name;
  const prefixes = [
    `--dsa-${knownComponent}`,
    `--l-${knownComponent}`,
    `--dsa-${knownComponent.replace(/-/g, "_")}`,
  ];

  let matched = false;
  for (const prefix of prefixes) {
    if (remainder.startsWith(prefix)) {
      remainder = remainder.slice(prefix.length);
      matched = true;
      break;
    }
  }

  if (!matched) {
    // Fallback: try to strip any --dsa-{word} prefix
    const fallback = remainder.match(/^--(?:dsa|l)-[a-z]+(?:-[a-z]+)*/);
    if (fallback) {
      remainder = remainder.slice(fallback[0].length);
    }
  }

  let element = null;
  let variant = null;
  let cssProperty = "";
  let state = null;

  // Split on the LAST occurrence of "--" to get the property part
  // e.g., "__copy--font_hover" → before="__copy", property part="font_hover"
  const lastDoubleDash = remainder.lastIndexOf("--");
  let beforeProperty = "";
  let propertyPart = "";

  if (lastDoubleDash > 0) {
    beforeProperty = remainder.slice(0, lastDoubleDash);
    propertyPart = remainder.slice(lastDoubleDash + 2);
  } else if (lastDoubleDash === 0) {
    // Starts with --, everything is property
    propertyPart = remainder.slice(2);
  } else {
    // No --, could be just a suffix like "_small" with no property
    propertyPart = remainder;
  }

  // Extract state from the property part (last _state)
  for (const s of STATES) {
    const suffix = `_${s}`;
    if (propertyPart.endsWith(suffix)) {
      state = s;
      propertyPart = propertyPart.slice(0, -suffix.length);
      break;
    }
  }

  cssProperty = propertyPart || "unknown";

  // Parse element and variant from beforeProperty
  // Elements start with __ and variants start with _
  if (beforeProperty) {
    // Extract elements (e.g., "__copy", "__contact__icon")
    const elementMatch = beforeProperty.match(
      /__([a-zA-Z0-9-]+(?:__[a-zA-Z0-9-]+)*)/,
    );
    if (elementMatch) {
      element = elementMatch[1].replace(/__/g, ".");
    }

    // Extract variant (e.g., "_primary", "_color-neutral", "_highlight-text")
    // Variant is indicated by a single _ NOT preceded by another _ and NOT part of __
    const variantMatch = beforeProperty.match(
      /(?:^|[^_])_([a-zA-Z][a-zA-Z0-9-]*)/,
    );
    if (variantMatch) {
      variant = variantMatch[1];
    }
  }

  return { element, variant, cssProperty, state };
}

/**
 * Parse all component token files and return enriched records.
 * @param {string|null} componentFilter - Optional component slug to filter by
 * @returns {Promise<Array<Object>>}
 */
async function parseAllComponentTokens(componentFilter = null) {
  const results = [];

  const filesToParse = componentFilter
    ? COMPONENT_TOKEN_FILES[componentFilter]
      ? { [componentFilter]: COMPONENT_TOKEN_FILES[componentFilter] }
      : {}
    : COMPONENT_TOKEN_FILES;

  for (const [slug, config] of Object.entries(filesToParse)) {
    const filePath = path.join(COMPONENT_TOKENS_DIR, config.file);
    try {
      await fs.access(filePath);
      const tokens = await parseTokenFile(filePath, config.category);

      for (const [name, data] of tokens.entries()) {
        const { valueType, referencedToken } = classifyTokenValue(data.value);
        const parsed = parseComponentTokenName(name, slug);

        results.push({
          name,
          value: data.value,
          valueType,
          component: slug,
          element: parsed.element,
          variant: parsed.variant,
          cssProperty: parsed.cssProperty,
          state: parsed.state,
          file: config.file,
          category: config.category,
          referencedToken,
          ...(data.section && { section: data.section }),
          ...(data.comment && { comment: data.comment }),
        });
      }
    } catch {
      // File doesn't exist or is empty, skip
    }
  }

  return results;
}

/**
 * Get component token statistics
 * @returns {Promise<Object>}
 */
async function getComponentTokenStats() {
  const allTokens = await parseAllComponentTokens();

  const stats = {
    totalTokens: allTokens.length,
    byComponent: {},
    byCategory: {},
    byPropertyType: {},
    byValueType: {
      literal: 0,
      "global-reference": 0,
      "component-reference": 0,
      calculated: 0,
    },
    topReferencedGlobalTokens: {},
  };

  for (const token of allTokens) {
    stats.byComponent[token.component] =
      (stats.byComponent[token.component] || 0) + 1;
    stats.byCategory[token.category] =
      (stats.byCategory[token.category] || 0) + 1;
    stats.byPropertyType[token.cssProperty] =
      (stats.byPropertyType[token.cssProperty] || 0) + 1;
    stats.byValueType[token.valueType] =
      (stats.byValueType[token.valueType] || 0) + 1;

    if (token.referencedToken && token.valueType === "global-reference") {
      stats.topReferencedGlobalTokens[token.referencedToken] =
        (stats.topReferencedGlobalTokens[token.referencedToken] || 0) + 1;
    }
  }

  // Sort topReferencedGlobalTokens by count, keep top 20
  const sortedRefs = Object.entries(stats.topReferencedGlobalTokens)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);
  stats.topReferencedGlobalTokens = Object.fromEntries(sortedRefs);

  return stats;
}

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
 * Fetch all CSS used by a website (inline styles and linked stylesheets).
 * @param {string} url - The website URL to fetch CSS from
 * @param {object} [options] - Options
 * @param {number} [options.maxStylesheets=20] - Maximum number of external stylesheets to fetch
 * @param {number} [options.timeoutMs=10000] - Timeout per fetch in milliseconds
 * @returns {Promise<{inlineStyles: string[], linkedStylesheets: {href: string, css: string}[], summary: object}>}
 */
async function fetchWebsiteCSS(url, options = {}) {
  const { maxStylesheets = 20, timeoutMs = 10000 } = options;

  // Fetch the HTML page
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let html;
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    html = await response.text();
  } catch (error) {
    clearTimeout(timeout);
    throw new Error(`Failed to fetch page: ${error.message}`);
  }

  // Extract inline <style> blocks
  const inlineStyles = [];
  const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleTagRegex.exec(html)) !== null) {
    const css = styleMatch[1].trim();
    if (css.length > 0) {
      inlineStyles.push(css);
    }
  }

  // Extract <link rel="stylesheet"> hrefs
  const linkHrefs = [];
  const linkRegex =
    /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const linkRegexAlt =
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
  let linkMatch;

  while ((linkMatch = linkRegex.exec(html)) !== null) {
    linkHrefs.push(linkMatch[1]);
  }
  while ((linkMatch = linkRegexAlt.exec(html)) !== null) {
    if (!linkHrefs.includes(linkMatch[1])) {
      linkHrefs.push(linkMatch[1]);
    }
  }

  // Resolve relative URLs
  const baseUrl = new URL(url);
  const resolvedHrefs = linkHrefs
    .slice(0, maxStylesheets)
    .map((href) => {
      try {
        return new URL(href, baseUrl).toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // Fetch external stylesheets in parallel
  const linkedStylesheets = await Promise.all(
    resolvedHrefs.map(async (href) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const resp = await fetch(href, { signal: ctrl.signal });
        clearTimeout(t);
        if (!resp.ok) {
          return { href, css: null, error: `HTTP ${resp.status}` };
        }
        const css = await resp.text();
        return { href, css };
      } catch (err) {
        clearTimeout(t);
        return { href, css: null, error: err.message };
      }
    }),
  );

  // Build a summary of what was found
  const successfulSheets = linkedStylesheets.filter((s) => s.css !== null);
  const failedSheets = linkedStylesheets.filter((s) => s.css === null);

  const allCSS = [...inlineStyles, ...successfulSheets.map((s) => s.css)].join(
    "\n",
  );

  // Extract some quick stats from the combined CSS
  const colorMatches = allCSS.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const rgbMatches = allCSS.match(/rgba?\([^)]+\)/g) || [];
  const hslMatches = allCSS.match(/hsla?\([^)]+\)/g) || [];
  const fontFamilyMatches = allCSS.match(/font-family\s*:[^;}{]+/gi) || [];
  const fontSizeMatches = allCSS.match(/font-size\s*:[^;}{]+/gi) || [];
  const customPropertyMatches =
    allCSS.match(/--[a-zA-Z0-9-]+\s*:[^;}{]+/g) || [];

  // Deduplicate colors
  const uniqueHexColors = [
    ...new Set(colorMatches.map((c) => c.toLowerCase())),
  ];
  const uniqueRgbColors = [...new Set(rgbMatches)];
  const uniqueHslColors = [...new Set(hslMatches)];
  const uniqueFontFamilies = [
    ...new Set(
      fontFamilyMatches.map((f) => f.replace(/font-family\s*:\s*/i, "").trim()),
    ),
  ];

  const summary = {
    inlineStyleBlocks: inlineStyles.length,
    linkedStylesheets: successfulSheets.length,
    failedStylesheets: failedSheets.length,
    totalCSSLength: allCSS.length,
    uniqueHexColors: uniqueHexColors.slice(0, 50),
    uniqueRgbColors: uniqueRgbColors.slice(0, 30),
    uniqueHslColors: uniqueHslColors.slice(0, 30),
    uniqueFontFamilies: uniqueFontFamilies.slice(0, 20),
    fontSizeDeclarations: fontSizeMatches.length,
    cssCustomProperties: customPropertyMatches.length,
  };

  return { inlineStyles, linkedStylesheets, summary };
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
      const tokenMatch = line.match(/--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/);
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

// ============================================================================
// DESIGN INTENT & GOVERNANCE LAYER
// ============================================================================

const RULES_DIR = path.join(__dirname, "rules");

/** Cached design rules — loaded once from rules/*.json */
let _cachedRules = null;

/**
 * Load all design rules from rules/*.json files.
 * Caches in memory after first load.
 * @returns {Promise<Array<Object>>}
 */
async function loadDesignRules() {
  if (_cachedRules) return _cachedRules;

  const rules = [];
  try {
    await fs.access(RULES_DIR);
    const files = await fs.readdir(RULES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(RULES_DIR, file), "utf-8");
        const rule = JSON.parse(content);
        rule._sourceFile = file;
        rules.push(rule);
      } catch (e) {
        console.error(
          `Warning: failed to parse rule file ${file}: ${e.message}`,
        );
      }
    }
  } catch {
    console.error(
      "Warning: rules/ directory not found, governance layer disabled",
    );
  }

  _cachedRules = rules;
  return rules;
}

/**
 * Check if a token name exists in the system (global + component tokens).
 * @param {string} tokenName - The full token name (e.g., "--ks-text-color-display")
 * @returns {Promise<boolean>}
 */
async function validateTokenExistence(tokenName) {
  const normalized = tokenName.startsWith("--") ? tokenName : `--${tokenName}`;

  // Check global tokens
  const globalTokens = await parseAllTokens();
  if (globalTokens.has(normalized)) return true;

  // Check component tokens
  const componentTokens = await parseAllComponentTokens();
  for (const ct of componentTokens) {
    if (ct.name === normalized) return true;
  }

  return false;
}

/**
 * Extract the typography category from a token name.
 * @param {string} tokenName
 * @returns {string|null} - "display", "copy", "interface", "mono", or null
 */
function extractTypographyCategory(tokenName) {
  if (tokenName.includes("-display")) return "display";
  if (tokenName.includes("-copy")) return "copy";
  if (tokenName.includes("-interface")) return "interface";
  if (tokenName.includes("-mono")) return "mono";
  return null;
}

/**
 * Check if a token is a primitive color token (should use semantic layer instead).
 * @param {string} tokenName
 * @returns {boolean}
 */
function isPrimitiveColorToken(tokenName) {
  const primitivePatterns = [
    /^--ks-color-primary-alpha-/,
    /^--ks-color-primary-to-/,
    /^--ks-color-primary-inverted-alpha-/,
    /^--ks-color-primary-inverted-to-/,
    /^--ks-color-fg-alpha-/,
    /^--ks-color-fg-to-/,
    /^--ks-color-fg-inverted-/,
    /^--ks-color-bg-inverted/,
    /^--ks-color-link-to-/,
    /^--ks-color-link-inverted-to-/,
    /^--ks-color-positive-alpha-/,
    /^--ks-color-positive-to-/,
    /^--ks-color-negative-alpha-/,
    /^--ks-color-negative-to-/,
    /^--ks-color-notice-alpha-/,
    /^--ks-color-notice-to-/,
    /^--ks-color-informative-alpha-/,
    /^--ks-color-informative-to-/,
  ];
  return primitivePatterns.some((p) => p.test(tokenName));
}

/**
 * Detect hardcoded values that should use tokens instead.
 * @param {string} value - Raw CSS value
 * @param {string} cssProperty - CSS property name
 * @returns {{isHardcoded: boolean, suggestion: string|null, category: string|null}}
 */
function detectHardcodedValue(value, cssProperty) {
  if (!value || value.includes("var("))
    return { isHardcoded: false, suggestion: null, category: null };

  const trimmed = value.trim();

  // Hardcoded colors: hex, rgb, rgba, hsl, hsla, named colors (excluding 'transparent', 'inherit', 'initial', 'currentColor')
  if (
    cssProperty === "color" ||
    cssProperty === "background-color" ||
    cssProperty === "border-color"
  ) {
    if (
      /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ||
      /^rgba?\(/.test(trimmed) ||
      /^hsla?\(/.test(trimmed)
    ) {
      return {
        isHardcoded: true,
        suggestion:
          "Use a --ks-text-color-*, --ks-background-color-*, or --ks-border-color-* token",
        category: "hardcoded-color",
      };
    }
  }

  // Hardcoded spacing: pixel or rem values for spacing properties
  if (
    [
      "padding",
      "margin",
      "gap",
      "padding-top",
      "padding-bottom",
      "padding-left",
      "padding-right",
      "margin-top",
      "margin-bottom",
      "margin-left",
      "margin-right",
    ].includes(cssProperty)
  ) {
    if (/^\d+(\.\d+)?(px|rem|em)$/.test(trimmed)) {
      return {
        isHardcoded: true,
        suggestion: "Use a --ks-spacing-* token",
        category: "hardcoded-spacing",
      };
    }
  }

  // Hardcoded border-radius
  if (cssProperty === "border-radius") {
    if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(trimmed)) {
      return {
        isHardcoded: true,
        suggestion: "Use a --ks-border-radius-* token",
        category: "hardcoded-border-radius",
      };
    }
  }

  // Hardcoded font-weight
  if (cssProperty === "font-weight") {
    if (/^\d{3}$/.test(trimmed)) {
      return {
        isHardcoded: true,
        suggestion: "Use a --ks-font-weight-* token",
        category: "hardcoded-font-weight",
      };
    }
  }

  // Hardcoded box-shadow
  if (cssProperty === "box-shadow") {
    if (!trimmed.includes("var(") && trimmed !== "none") {
      return {
        isHardcoded: true,
        suggestion: "Use a --ks-box-shadow-* token",
        category: "hardcoded-box-shadow",
      };
    }
  }

  return { isHardcoded: false, suggestion: null, category: null };
}

/**
 * Validate a single token usage against all applicable design rules.
 * @param {string} tokenName - Token being used (e.g., "--ks-text-color-display")
 * @param {string} cssProperty - CSS property (e.g., "color")
 * @param {string|null} element - Element context (e.g., "hero headline")
 * @param {string|null} designContext - Broad design context (e.g., "hero")
 * @param {string|null} rawValue - Raw CSS value (for hardcoded detection)
 * @param {Array} rules - Loaded design rules
 * @returns {Promise<Array<Object>>} - Array of violations
 */
async function validateSingleTokenUsage(
  tokenName,
  cssProperty,
  element,
  designContext,
  rawValue,
  rules,
) {
  const violations = [];

  // 1. Hardcoded value detection
  if (rawValue && !tokenName) {
    const { isHardcoded, suggestion, category } = detectHardcodedValue(
      rawValue,
      cssProperty,
    );
    if (isHardcoded) {
      violations.push({
        severity: "critical",
        ruleId: "hardcoded-value",
        ruleName: "Hardcoded Value Detection",
        token: rawValue,
        message: `Hardcoded ${category} value "${rawValue}" for ${cssProperty}. This bypasses the token system and breaks theming.`,
        suggestion,
        rationale:
          "Hardcoded values can't be themed and don't respond to design system changes",
      });
    }
    return violations;
  }

  if (!tokenName) return violations;

  // 2. Token existence check
  const exists = await validateTokenExistence(tokenName);
  if (!exists) {
    violations.push({
      severity: "critical",
      ruleId: "token-existence",
      ruleName: "Phantom Token Detection",
      token: tokenName,
      message: `Phantom token: "${tokenName}" does not exist in the design system. It will silently fail at runtime.`,
      suggestion:
        "Search for similar tokens using search_tokens or get_color_palette",
      rationale:
        "Phantom tokens produce invisible failures — the CSS property falls through to inherited/initial value",
    });
    return violations; // No point checking intent if token doesn't exist
  }

  // 3. Semantic layer check — primitive color tokens used directly
  if (isPrimitiveColorToken(tokenName)) {
    const semanticRule = rules.find((r) => r.id === "color-semantic-layer");
    violations.push({
      severity: "warning",
      ruleId: "color-semantic-layer",
      ruleName: semanticRule?.name || "Use Semantic Color Tokens",
      token: tokenName,
      message: `Primitive color token "${tokenName}" used directly. Prefer semantic tokens (--ks-text-color-*, --ks-background-color-*, --ks-border-color-*).`,
      suggestion:
        semanticRule?.semanticAlternatives?.[cssProperty] ||
        "Use the appropriate semantic color token layer",
      rationale:
        "Primitive color tokens bypass the semantic layer, making intent unclear and theming fragile",
    });
  }

  // 4. Text-color hierarchy check
  const textColorRule = rules.find((r) => r.id === "text-color-hierarchy");
  if (textColorRule && tokenName.startsWith("--ks-text-color-")) {
    const baseTokenName = tokenName
      .replace(/-inverted/, "")
      .replace(/-(interactive|hover|active|selected|base).*/, "");
    const tokenConfig = textColorRule.tokens?.[baseTokenName];
    if (tokenConfig && element) {
      const elementLower = element.toLowerCase();
      const contextLower = (designContext || "").toLowerCase();
      const allContext = `${elementLower} ${contextLower}`.trim();

      // Fuzzy match: stem common suffixes so "headline" matches "headings", "buttons" matches "button", etc.
      const stem = (s) =>
        s.replace(/s$/, "").replace(/ing$/, "").replace(/line$/, "line");

      const isInvalid = tokenConfig.invalidContexts?.some((ctx) => {
        const ctxNorm = ctx.toLowerCase().replace(/-/g, " ");
        return (
          allContext.includes(ctxNorm) ||
          ctxNorm.split(" ").some((w) => allContext.includes(stem(w)))
        );
      });

      if (isInvalid) {
        const validTokens = Object.entries(textColorRule.tokens)
          .filter(([, cfg]) =>
            cfg.validContexts?.some((ctx) => {
              const ctxNorm = ctx.toLowerCase().replace(/-/g, " ");
              return (
                allContext.includes(ctxNorm) ||
                ctxNorm.split(" ").some((w) => allContext.includes(stem(w)))
              );
            }),
          )
          .map(([name]) => name);

        violations.push({
          severity: "warning",
          ruleId: "text-color-hierarchy",
          ruleName: textColorRule.name,
          token: tokenName,
          message: `"${tokenName}" used for "${element}"${designContext ? ` in ${designContext} context` : ""} — this token is for ${tokenConfig.role}.`,
          suggestion:
            validTokens.length > 0
              ? `Consider using ${validTokens.join(" or ")} instead`
              : `Check the text-color hierarchy for the appropriate token`,
          rationale: tokenConfig.rationale,
        });
      }
    }
  }

  // 5. Background-color layer check
  const bgRule = rules.find((r) => r.id === "background-color-layers");
  if (bgRule && tokenName.startsWith("--ks-background-color-")) {
    const baseTokenName = tokenName
      .replace(/-inverted/, "")
      .replace(
        /-(interactive|hover|active|selected|disabled|base|translucent).*/,
        "",
      );
    const tokenConfig = bgRule.tokens?.[baseTokenName];
    if (tokenConfig && element) {
      const allContext =
        `${element.toLowerCase()} ${(designContext || "").toLowerCase()}`.trim();
      const isInvalid = tokenConfig.invalidContexts?.some((ctx) =>
        allContext.includes(ctx.toLowerCase().replace(/-/g, " ")),
      );
      if (isInvalid) {
        violations.push({
          severity: "info",
          ruleId: "background-color-layers",
          ruleName: bgRule.name,
          token: tokenName,
          message: `"${tokenName}" used for "${element}"${designContext ? ` in ${designContext} context` : ""} — this token is for ${tokenConfig.role}.`,
          suggestion: `Check background-color layer hierarchy for the appropriate token`,
          rationale: tokenConfig.rationale,
        });
      }
    }
  }

  // 6. Font-family role check
  const fontFamilyRule = rules.find((r) => r.id === "font-family-roles");
  if (fontFamilyRule && tokenName.startsWith("--ks-font-family-")) {
    const tokenConfig = fontFamilyRule.tokens?.[tokenName];
    if (tokenConfig && element) {
      const allContext = `${element.toLowerCase()} ${(designContext || "").toLowerCase()}`;
      const isInvalid = tokenConfig.invalidContexts?.some((ctx) =>
        allContext.includes(ctx.toLowerCase().replace(/-/g, " ")),
      );
      if (isInvalid) {
        violations.push({
          severity: "warning",
          ruleId: "font-family-roles",
          ruleName: fontFamilyRule.name,
          token: tokenName,
          message: `"${tokenName}" used for "${element}" — this font family is for ${tokenConfig.role}.`,
          suggestion: `Check font-family role assignments for the appropriate token`,
          rationale: tokenConfig.rationale,
        });
      }
    }
  }

  // 7. Typography category pairing check
  const typoPairingRule = rules.find((r) => r.id === "typography-pairing");
  if (typoPairingRule) {
    const typoCategory = extractTypographyCategory(tokenName);
    if (
      typoCategory &&
      (tokenName.includes("font-size") || tokenName.includes("line-height"))
    ) {
      // This violation is detected at the component level when multiple tokens are checked together
      // Stored as metadata for component-level validation
    }
  }

  return violations;
}

/**
 * Validate a set of token usages and return all violations.
 * @param {string} context - What is being validated
 * @param {string|null} designContext - Broad design context
 * @param {Array} tokenUsages - Array of {token, cssProperty, element, value}
 * @returns {Promise<Object>} - Validation response with violations and summary
 */
async function validateTokenUsages(context, designContext, tokenUsages) {
  const rules = await loadDesignRules();
  const violations = [];
  let cleanCount = 0;

  for (const usage of tokenUsages) {
    const tokenViolations = await validateSingleTokenUsage(
      usage.token || null,
      usage.cssProperty,
      usage.element || null,
      designContext || null,
      usage.value || null,
      rules,
    );

    if (tokenViolations.length === 0) {
      cleanCount++;
    } else {
      violations.push(...tokenViolations);
    }
  }

  // Cross-usage checks: typography pairing
  const typoPairingRule = rules.find((r) => r.id === "typography-pairing");
  if (typoPairingRule) {
    const typoCategories = {};
    for (const usage of tokenUsages) {
      if (usage.token) {
        const cat = extractTypographyCategory(usage.token);
        if (cat) {
          if (!typoCategories[usage.element || "_root"]) {
            typoCategories[usage.element || "_root"] = {};
          }
          const prop = usage.cssProperty;
          if (prop.includes("font-size") || prop === "font-size") {
            typoCategories[usage.element || "_root"].fontSize = {
              token: usage.token,
              category: cat,
            };
          } else if (prop.includes("line-height") || prop === "line-height") {
            typoCategories[usage.element || "_root"].lineHeight = {
              token: usage.token,
              category: cat,
            };
          } else if (prop.includes("font-family") || prop === "font-family") {
            typoCategories[usage.element || "_root"].fontFamily = {
              token: usage.token,
              category: cat,
            };
          }
        }
      }
    }

    for (const [element, cats] of Object.entries(typoCategories)) {
      const categories = new Set(Object.values(cats).map((c) => c.category));
      if (categories.size > 1) {
        const details = Object.entries(cats)
          .map(([prop, c]) => `${prop}: ${c.token} (${c.category})`)
          .join(", ");
        violations.push({
          severity: "warning",
          ruleId: "typography-pairing",
          ruleName: typoPairingRule.name || "Typography Category Pairing",
          token: Object.values(cats)
            .map((c) => c.token)
            .join(", "),
          message: `Typography category mismatch in "${element}": ${details}. Font-size and line-height should come from the same category.`,
          suggestion: `Align all typography tokens to the same category (display, copy, interface, or mono)`,
          rationale:
            typoPairingRule.rule || "Mixing categories breaks vertical rhythm",
        });
      }
    }
  }

  return {
    context,
    designContext: designContext || "unspecified",
    totalUsages: tokenUsages.length,
    violations,
    summary: {
      critical: violations.filter((v) => v.severity === "critical").length,
      warning: violations.filter((v) => v.severity === "warning").length,
      info: violations.filter((v) => v.severity === "info").length,
      clean: cleanCount,
    },
  };
}

/**
 * Recommend tokens for a given design context and CSS property.
 * @param {string} cssProperty
 * @param {string} element
 * @param {string|null} designContext
 * @param {{interactive?: boolean, inverted?: boolean}} options
 * @returns {Promise<Object>}
 */
async function recommendTokenForContext(
  cssProperty,
  element,
  designContext,
  options = {},
) {
  const rules = await loadDesignRules();
  const recommendations = [];
  const avoid = [];
  const elementLower = element.toLowerCase();
  const contextLower = (designContext || "").toLowerCase();
  const allContext = `${elementLower} ${contextLower}`;

  // Find applicable rules based on CSS property
  const applicableRules = [];

  if (cssProperty === "color") {
    const rule = rules.find((r) => r.id === "text-color-hierarchy");
    if (rule) applicableRules.push(rule);
  } else if (cssProperty === "background-color") {
    const rule = rules.find((r) => r.id === "background-color-layers");
    if (rule) applicableRules.push(rule);
  } else if (cssProperty === "font-family") {
    const rule = rules.find((r) => r.id === "font-family-roles");
    if (rule) applicableRules.push(rule);
  } else if (cssProperty === "box-shadow") {
    const rule = rules.find((r) => r.id === "elevation-hierarchy");
    if (rule) applicableRules.push(rule);
  } else if (cssProperty === "border-radius") {
    const rule = rules.find((r) => r.id === "border-radius-scale");
    if (rule) applicableRules.push(rule);
  } else if (["padding", "margin", "gap"].includes(cssProperty)) {
    const rule = rules.find((r) => r.id === "spacing-scale");
    if (rule) applicableRules.push(rule);
  } else if (cssProperty === "transition") {
    const rule = rules.find((r) => r.id === "transition-consistency");
    if (rule) applicableRules.push(rule);
  }

  for (const rule of applicableRules) {
    // Handle scale-based rules (elevation, spacing, border-radius)
    if (rule.scale) {
      for (const level of rule.scale) {
        const matchesValid = level.validContexts?.some((ctx) =>
          allContext.includes(ctx.toLowerCase().replace(/-/g, " ")),
        );
        const matchesInvalid = level.invalidContexts?.some((ctx) =>
          allContext.includes(ctx.toLowerCase().replace(/-/g, " ")),
        );

        if (matchesValid && !matchesInvalid) {
          const rec = {
            rank: recommendations.length + 1,
            token:
              options.inverted && level.token.includes("-inverted")
                ? level.token
                : level.token,
            confidence: "high",
            rationale: `${level.label}: ${level.purpose}`,
          };
          if (level.hoverToken && options.interactive) {
            rec.interactiveStates = { hover: level.hoverToken };
          }
          recommendations.push(rec);
        } else if (matchesInvalid) {
          avoid.push({
            token: level.token,
            reason: `${level.label} elevation is for ${level.purpose} — not appropriate for ${element}`,
          });
        }
      }
    }

    // Handle token-map rules (text-color, background-color, font-family)
    if (rule.tokens) {
      for (const [tokenName, config] of Object.entries(rule.tokens)) {
        const matchesValid = config.validContexts?.some((ctx) =>
          allContext.includes(ctx.toLowerCase().replace(/-/g, " ")),
        );
        const matchesInvalid = config.invalidContexts?.some((ctx) =>
          allContext.includes(ctx.toLowerCase().replace(/-/g, " ")),
        );

        const resolvedToken =
          options.inverted && !tokenName.includes("-inverted")
            ? tokenName.replace(/(--ks-[a-z-]+)/, "$1-inverted")
            : tokenName;

        if (matchesValid && !matchesInvalid) {
          const rec = {
            rank: recommendations.length + 1,
            token: resolvedToken,
            confidence: "high",
            rationale: config.role,
          };

          // Add pairing info if available
          const pairingRules = rule.pairingRules?.find(
            (p) => p.token === tokenName || p.fontFamily === tokenName,
          );
          if (pairingRules) {
            rec.pairWith = [];
            if (pairingRules.expectedFontFamily) {
              rec.pairWith.push({
                cssProperty: "font-family",
                token: pairingRules.expectedFontFamily,
              });
            }
            if (pairingRules.expectedLineHeight) {
              rec.pairWith.push({
                cssProperty: "line-height",
                pattern: pairingRules.expectedLineHeight,
              });
            }
            if (pairingRules.expectedFontSize) {
              rec.pairWith.push({
                cssProperty: "font-size",
                pattern: pairingRules.expectedFontSize,
              });
            }
            if (pairingRules.expectedTextColor) {
              rec.pairWith.push({
                cssProperty: "color",
                token: pairingRules.expectedTextColor,
              });
            }
          }

          // Add interactive state tokens if requested
          if (options.interactive) {
            const interactiveBase = `${resolvedToken}-interactive`;
            rec.interactiveStates = {
              base: interactiveBase,
              hover: `${interactiveBase}-hover`,
              active: `${interactiveBase}-active`,
            };
          }

          recommendations.push(rec);
        } else if (matchesInvalid) {
          avoid.push({
            token: tokenName,
            reason: `${config.role} — not appropriate for ${element}. ${config.rationale || ""}`,
          });
        }
      }
    }
  }

  // If no specific match, try returning the full hierarchy for the property
  if (recommendations.length === 0 && applicableRules.length > 0) {
    const rule = applicableRules[0];
    if (rule.tokens) {
      for (const [tokenName, config] of Object.entries(rule.tokens)) {
        recommendations.push({
          rank: recommendations.length + 1,
          token: tokenName,
          confidence: "low",
          rationale: `${config.role} — review if this matches your "${element}" context`,
        });
      }
    }
    if (rule.scale) {
      for (const level of rule.scale) {
        recommendations.push({
          rank: recommendations.length + 1,
          token: level.token,
          confidence: "low",
          rationale: `${level.label}: ${level.purpose} — review if this matches your "${element}" context`,
        });
      }
    }
  }

  return {
    cssProperty,
    element,
    designContext: designContext || "unspecified",
    recommendations,
    avoid,
  };
}

/**
 * Get the semantic hierarchy for a token category.
 * @param {string} category - e.g., "text-color", "elevation", "spacing"
 * @returns {Promise<Object>}
 */
async function getTokenHierarchy(category) {
  const rules = await loadDesignRules();

  const categoryRuleMap = {
    "text-color": "text-color-hierarchy",
    "background-color": "background-color-layers",
    elevation: "elevation-hierarchy",
    "font-family": "font-family-roles",
    "font-size": "typography-pairing",
    spacing: "spacing-scale",
    "border-radius": "border-radius-scale",
    "line-height": "typography-pairing",
    transition: "transition-consistency",
  };

  const ruleId = categoryRuleMap[category];
  if (!ruleId) {
    return {
      error: `Unknown category: ${category}. Available: ${Object.keys(categoryRuleMap).join(", ")}`,
    };
  }

  const rule = rules.find((r) => r.id === ruleId);
  if (!rule) {
    return { error: `Rule "${ruleId}" not found in rules/ directory` };
  }

  const result = {
    category,
    ruleId: rule.id,
    name: rule.name,
    description: rule.description,
    severity: rule.severity,
  };

  if (rule.scale) {
    result.hierarchy = rule.scale;
  }
  if (rule.tokens) {
    result.hierarchy = Object.entries(rule.tokens).map(([name, config], i) => ({
      level: i + 1,
      token: name,
      role: config.role,
      validContexts: config.validContexts,
      invalidContexts: config.invalidContexts,
      rationale: config.rationale,
    }));
  }
  if (rule.pairingRules) {
    result.pairingRules = rule.pairingRules;
  }
  if (rule.categories) {
    result.typographyCategories = rule.categories;
  }
  if (rule.spacingTypes) {
    result.spacingTypes = rule.spacingTypes;
  }

  return result;
}

/**
 * Audit all tokens for a single component against design rules.
 * @param {string} componentSlug - Component slug (e.g., "button")
 * @returns {Promise<Object>}
 */
async function auditComponentTokens(componentSlug) {
  const config = COMPONENT_TOKEN_FILES[componentSlug];
  if (!config) {
    return {
      error: `Component "${componentSlug}" not found. Use list_components to see available components.`,
    };
  }

  const tokens = await parseAllComponentTokens(componentSlug);
  const rules = await loadDesignRules();
  const violations = [];

  // Track state tokens for completeness checks
  const stateMap = {}; // variant+property → set of states

  for (const token of tokens) {
    const { valueType, referencedToken } = classifyTokenValue(token.value);

    // Check referenced token existence
    if (referencedToken) {
      const exists = await validateTokenExistence(referencedToken);
      if (!exists) {
        violations.push({
          severity: "critical",
          ruleId: referencedToken.startsWith("--dsa-")
            ? "component-reference-validity"
            : "token-existence",
          ruleName: referencedToken.startsWith("--dsa-")
            ? "Component Cross-Reference Validity"
            : "Phantom Token Detection",
          token: token.name,
          referencedToken,
          message: `Token "${token.name}" references "${referencedToken}" which does not exist in the design system.`,
          suggestion: "Search for the correct token name using search_tokens",
          rationale: "Phantom tokens silently fail at runtime",
        });
      }

      // Check semantic layer usage
      if (isPrimitiveColorToken(referencedToken)) {
        violations.push({
          severity: "warning",
          ruleId: "color-semantic-layer",
          ruleName: "Use Semantic Color Tokens",
          token: token.name,
          referencedToken,
          message: `Token "${token.name}" references primitive color "${referencedToken}". Prefer semantic color tokens.`,
          suggestion:
            "Use --ks-text-color-*, --ks-background-color-*, or --ks-border-color-* instead",
          rationale: "Primitive color tokens bypass the semantic layer",
        });
      }
    }

    // Check hardcoded values
    if (valueType === "literal" && token.value) {
      const { isHardcoded, suggestion, category } = detectHardcodedValue(
        token.value,
        token.cssProperty,
      );
      if (isHardcoded) {
        violations.push({
          severity: "critical",
          ruleId: "hardcoded-value",
          ruleName: "Hardcoded Value Detection",
          token: token.name,
          message: `Hardcoded ${category} value "${token.value}" in ${token.cssProperty}. Use a design token instead.`,
          suggestion,
          rationale:
            "Hardcoded values bypass the token system and break theming",
        });
      }
    }

    // Track states for completeness check
    if (token.state) {
      const key = `${token.variant || "_base"}::${token.cssProperty}`;
      if (!stateMap[key]) stateMap[key] = { states: new Set(), tokens: [] };
      stateMap[key].states.add(token.state);
      stateMap[key].tokens.push(token.name);
    }
  }

  // Interactive state completeness check
  const stateRule = rules.find(
    (r) => r.id === "interactive-state-completeness",
  );
  if (stateRule) {
    for (const [key, data] of Object.entries(stateMap)) {
      const colorProps = ["color", "background-color", "border-color"];
      const [, prop] = key.split("::");
      if (colorProps.includes(prop)) {
        const required = stateRule.stateGroups?.["color-states"]
          ?.requiredStates || ["hover", "active"];
        const missing = required.filter((s) => !data.states.has(s));
        if (missing.length > 0) {
          violations.push({
            severity: "warning",
            ruleId: "interactive-state-completeness",
            ruleName: stateRule.name,
            token: data.tokens.join(", "),
            message: `Incomplete interactive states for ${key}: has [${[...data.states].join(", ")}] but missing [${missing.join(", ")}].`,
            suggestion: `Add ${missing.map((s) => `_${s}`).join(", ")} state token(s) for complete interaction feedback`,
            rationale:
              "Incomplete state sets create gaps in interaction feedback",
          });
        }
      }
    }
  }

  // Sort violations by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  violations.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  return {
    component: componentSlug,
    file: config.file,
    category: config.category,
    totalTokens: tokens.length,
    totalViolations: violations.length,
    violations,
    summary: {
      critical: violations.filter((v) => v.severity === "critical").length,
      warning: violations.filter((v) => v.severity === "warning").length,
      info: violations.filter((v) => v.severity === "info").length,
    },
  };
}

/**
 * Batch audit across all components, returning a summary table.
 * @param {string} category - Component category filter ("all" for all)
 * @param {string} minSeverity - Minimum severity to include ("info", "warning", "critical")
 * @returns {Promise<Object>}
 */
async function auditAllComponents(category = "all", minSeverity = "info") {
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const minSev = severityOrder[minSeverity] ?? 2;

  const components = Object.entries(COMPONENT_TOKEN_FILES)
    .filter(([slug, config]) => {
      if (category === "all") return true;
      return config.category === category;
    })
    .map(([slug]) => slug)
    .sort();

  const results = [];
  let totalCritical = 0;
  let totalWarning = 0;
  let totalInfo = 0;
  let totalTokens = 0;

  for (const slug of components) {
    const audit = await auditComponentTokens(slug);
    if (audit.error) continue;

    const filteredViolations = audit.violations.filter(
      (v) => severityOrder[v.severity] <= minSev,
    );

    const crit = filteredViolations.filter(
      (v) => v.severity === "critical",
    ).length;
    const warn = filteredViolations.filter(
      (v) => v.severity === "warning",
    ).length;
    const info = filteredViolations.filter((v) => v.severity === "info").length;
    const total = crit + warn + info;

    totalCritical += crit;
    totalWarning += warn;
    totalInfo += info;
    totalTokens += audit.totalTokens;

    results.push({
      component: slug,
      category: COMPONENT_TOKEN_FILES[slug].category,
      tokens: audit.totalTokens,
      critical: crit,
      warning: warn,
      info: info,
      total,
    });
  }

  return {
    scope: category === "all" ? "All components" : `Category: ${category}`,
    componentsScanned: results.length,
    totalTokens,
    summary: results,
    totals: {
      critical: totalCritical,
      warning: totalWarning,
      info: totalInfo,
      total: totalCritical + totalWarning + totalInfo,
    },
  };
}

// Create MCP server instance
const server = new Server(
  {
    name: "design-tokens-server",
    version: "4.0.0",
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
              includeComponentTokens: {
                type: "boolean",
                description:
                  "Include component-level design tokens (--dsa-*) alongside global tokens (default: false)",
                default: false,
              },
            },
          },
        },
        {
          name: "list_files",
          description:
            "List all available token files with their descriptions and token counts. Includes both global token files and optionally component token files.",
          inputSchema: {
            type: "object",
            properties: {
              includeComponentFiles: {
                type: "boolean",
                description:
                  "Include component token files from tokens/componentToken/ (default: true)",
                default: true,
              },
            },
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
              includeComponentTokens: {
                type: "boolean",
                description:
                  "Include component-level design tokens (--dsa-*) in search results (default: false)",
                default: false,
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
        {
          name: "extract_theme_from_css",
          description:
            "Fetch all CSS from a website (inline <style> blocks and linked stylesheets) and return it for analysis. " +
            "Extracts exact color values, font families, font sizes, spacing, border-radius, and CSS custom properties. " +
            "Returns the raw CSS along with a pre-parsed summary of unique colors, fonts, and custom properties found. " +
            "Use this data together with the theme schema to generate accurate branding token values via update_theme_config.",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description:
                  "The website URL to extract CSS from (e.g., 'https://example.com')",
              },
              includeRawCSS: {
                type: "boolean",
                description:
                  "Whether to include the full raw CSS text in the response (default: false). " +
                  "The raw CSS can be very large. When false, only the summary and CSS custom properties are returned.",
                default: false,
              },
              maxStylesheets: {
                type: "number",
                description:
                  "Maximum number of external stylesheets to fetch (default: 20)",
                default: 20,
              },
            },
            required: ["url"],
          },
        },
        {
          name: "list_components",
          description:
            "List all Design System components that have customizable design tokens. Returns component name, category, token count, and description for each. Use this as the starting point to discover which components can be customized, then use get_component_tokens to drill into a specific component.",
          inputSchema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: [
                  "navigation",
                  "content",
                  "blog",
                  "cards",
                  "heroes",
                  "forms",
                  "layout",
                  "data-display",
                  "utility",
                  "all",
                ],
                description: "Filter by component category (default: 'all')",
                default: "all",
              },
              includeEmpty: {
                type: "boolean",
                description:
                  "Include components with 0 tokens (default: false)",
                default: false,
              },
            },
          },
        },
        {
          name: "get_component_tokens",
          description:
            "Get all design tokens for a specific Design System component. Returns every CSS custom property defined for that component, organized with element/variant/state metadata and references to global tokens. Use 'list_components' first to discover available component names.",
          inputSchema: {
            type: "object",
            properties: {
              component: {
                type: "string",
                description:
                  "Component name/slug (e.g., 'button', 'hero', 'teaser-card', 'section'). Use list_components to discover valid names.",
              },
              element: {
                type: "string",
                description:
                  "Filter to a specific sub-element (e.g., 'label', 'icon', 'copy', 'image')",
              },
              property: {
                type: "string",
                description:
                  "Filter by CSS property type (e.g., 'color', 'font', 'gap', 'border', 'padding')",
              },
              statesOnly: {
                type: "boolean",
                description:
                  "Only return tokens that have interactive states (hover, active, focus, checked). Default: false",
                default: false,
              },
            },
            required: ["component"],
          },
        },
        {
          name: "search_component_tokens",
          description:
            "Search across all component-level design tokens by pattern. Searches token names, values, component names, and comments. Useful for finding all tokens related to a CSS property (e.g., 'border-radius'), a global token (e.g., 'ks-color-primary'), or a concept (e.g., 'hover').",
          inputSchema: {
            type: "object",
            properties: {
              pattern: {
                type: "string",
                description:
                  "Search pattern (case-insensitive). Matches against token names, values, and comments.",
              },
              searchIn: {
                type: "string",
                enum: ["name", "value", "both"],
                description: "Where to search (default: 'both')",
                default: "both",
              },
              component: {
                type: "string",
                description: "Limit search to a specific component",
              },
              category: {
                type: "string",
                enum: [
                  "navigation",
                  "content",
                  "blog",
                  "cards",
                  "heroes",
                  "forms",
                  "layout",
                  "data-display",
                  "utility",
                ],
                description: "Limit search to a component category",
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

        // ============================================================
        // DESIGN INTENT & GOVERNANCE TOOLS
        // ============================================================
        {
          name: "get_design_rules",
          description:
            "List all design intent rules encoded in the system, or get details for a specific rule. Each rule describes what's valid, what violates the intent even when syntax is correct, and the rationale behind the design decision. Use this to understand the 'why' behind token choices.",
          inputSchema: {
            type: "object",
            properties: {
              ruleId: {
                type: "string",
                description:
                  "Get details for a specific rule by ID (e.g., 'text-color-hierarchy', 'elevation-hierarchy'). Omit to list all rules.",
              },
              category: {
                type: "string",
                enum: [
                  "semantic-hierarchy",
                  "hierarchy",
                  "pairing",
                  "existence",
                  "completeness",
                ],
                description: "Filter rules by category",
              },
              severity: {
                type: "string",
                enum: ["critical", "warning", "info"],
                description: "Filter rules by severity level",
              },
            },
          },
        },
        {
          name: "get_token_hierarchy",
          description:
            "Get the semantic hierarchy and relationships for a token category. Shows which tokens are designed for which level of the visual hierarchy, their intended ordering, and pairing rules. Use this to understand the design system's intent before choosing tokens.",
          inputSchema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: [
                  "text-color",
                  "background-color",
                  "elevation",
                  "font-family",
                  "font-size",
                  "spacing",
                  "border-radius",
                  "line-height",
                  "transition",
                ],
                description: "The token category to get the hierarchy for",
              },
            },
            required: ["category"],
          },
        },
        {
          name: "validate_token_usage",
          description:
            "Validate a set of design token usages against the design system's intent rules. Checks not just whether tokens exist, but whether they are semantically correct for their context. Returns violations classified by severity (critical/warning/info) with suggestions for correct alternatives. Use this after generating CSS or when reviewing component styling.",
          inputSchema: {
            type: "object",
            properties: {
              context: {
                type: "string",
                description:
                  "What is being validated (e.g., 'hero component', 'contact form', 'card body text')",
              },
              designContext: {
                type: "string",
                enum: [
                  "hero",
                  "card",
                  "form",
                  "navigation",
                  "section",
                  "modal",
                  "footer",
                  "body-content",
                  "data-display",
                ],
                description: "The broad design context to validate against",
              },
              tokenUsages: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    token: {
                      type: "string",
                      description:
                        "Token name (e.g., '--ks-text-color-display')",
                    },
                    cssProperty: {
                      type: "string",
                      description:
                        "CSS property being set (e.g., 'color', 'background-color')",
                    },
                    element: {
                      type: "string",
                      description:
                        "Element within the component (e.g., 'headline', 'body', 'label')",
                    },
                    value: {
                      type: "string",
                      description:
                        "Raw CSS value if not using a token (for hardcoded value detection)",
                    },
                  },
                  required: ["cssProperty"],
                },
                description: "List of token usages to validate",
              },
            },
            required: ["context", "tokenUsages"],
          },
        },
        {
          name: "get_token_for_context",
          description:
            "Get the recommended design token for a specific design context and CSS property. Instead of browsing all tokens, describe what you're styling and get a ranked recommendation with rationale. This encodes the design system's intent — which token is *right*, not just which tokens *exist*.",
          inputSchema: {
            type: "object",
            properties: {
              cssProperty: {
                type: "string",
                description:
                  "The CSS property you're setting (e.g., 'color', 'background-color', 'font-family', 'box-shadow', 'padding', 'border-radius', 'transition')",
              },
              element: {
                type: "string",
                description:
                  "What you're styling (e.g., 'hero headline', 'card body text', 'form input', 'navigation link', 'section background', 'modal overlay')",
              },
              designContext: {
                type: "string",
                enum: [
                  "hero",
                  "card",
                  "form",
                  "navigation",
                  "section",
                  "modal",
                  "footer",
                  "body-content",
                  "data-display",
                ],
                description: "The broad design context",
              },
              interactive: {
                type: "boolean",
                description:
                  "Whether the element has interactive states (hover, active, focus). If true, all required state tokens are returned.",
                default: false,
              },
              inverted: {
                type: "boolean",
                description:
                  "Whether the element is in an inverted (dark-on-light / light-on-dark) context.",
                default: false,
              },
            },
            required: ["cssProperty", "element"],
          },
        },
        {
          name: "validate_component_tokens",
          description:
            "Run a full design intent audit on a component's token file. Scans all token definitions for the named component and validates them against every applicable design rule. Returns a structured report with violations by severity. Use list_components first to discover available component names.",
          inputSchema: {
            type: "object",
            properties: {
              component: {
                type: "string",
                description:
                  "Component slug to audit (e.g., 'button', 'hero', 'teaser-card'). Use list_components to discover valid names.",
              },
              severity: {
                type: "string",
                enum: ["all", "critical", "warning", "info"],
                description: "Minimum severity to report (default: 'all')",
                default: "all",
              },
            },
            required: ["component"],
          },
        },
        {
          name: "audit_all_components",
          description:
            "Run a design intent audit across all component token files. Returns a summary table with violation counts per component and severity. Use this to get a health overview of the entire design system's token governance.",
          inputSchema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: [
                  "navigation",
                  "content",
                  "blog",
                  "cards",
                  "heroes",
                  "forms",
                  "layout",
                  "data-display",
                  "utility",
                  "all",
                ],
                description: "Filter to a component category (default: 'all')",
                default: "all",
              },
              minSeverity: {
                type: "string",
                enum: ["critical", "warning", "info"],
                description: "Minimum severity to include (default: 'info')",
                default: "info",
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

          // Merge component tokens if requested
          if (args.includeComponentTokens) {
            const componentTokens = await parseAllComponentTokens();
            for (const ct of componentTokens) {
              filteredTokens.push({
                name: ct.name,
                value: ct.value,
                file: ct.file,
                category: ct.category,
                ...(ct.section && { section: ct.section }),
                ...(ct.comment && { comment: ct.comment }),
                source: "component",
                component: ct.component,
              });
            }
          }

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
                type: "global",
                tokenCount: tokens.size,
              });
            } catch {
              fileStats.push({
                key,
                file: config.file,
                description: config.description,
                category: config.category,
                type: "global",
                tokenCount: 0,
                status: "not found",
              });
            }
          }

          // Include component token files
          const includeComponents = args.includeComponentFiles !== false;
          const componentFileStats = [];
          if (includeComponents) {
            for (const [slug, config] of Object.entries(
              COMPONENT_TOKEN_FILES,
            )) {
              const filePath = path.join(COMPONENT_TOKENS_DIR, config.file);
              try {
                await fs.access(filePath);
                const tokens = await parseTokenFile(filePath, config.category);
                componentFileStats.push({
                  key: slug,
                  file: `componentToken/${config.file}`,
                  description: config.description,
                  category: config.category,
                  type: "component",
                  component: slug,
                  tokenCount: tokens.size,
                });
              } catch {
                componentFileStats.push({
                  key: slug,
                  file: `componentToken/${config.file}`,
                  description: config.description,
                  category: config.category,
                  type: "component",
                  component: slug,
                  tokenCount: 0,
                  status: "not found",
                });
              }
            }
          }

          const allFiles = [...fileStats, ...componentFileStats];

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    totalFiles: allFiles.length,
                    globalFiles: fileStats.length,
                    componentFiles: componentFileStats.length,
                    files: allFiles,
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
          const componentStats = await getComponentTokenStats();
          stats.componentTokens = componentStats;
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

          // Mark global results
          results = results.map((r) => ({ ...r, source: "global" }));

          // Merge component tokens if requested
          if (args.includeComponentTokens) {
            const lowerPattern = args.pattern.toLowerCase();
            const searchIn = args.searchIn || "both";
            const componentTokens = await parseAllComponentTokens();
            for (const ct of componentTokens) {
              const matchName =
                (searchIn === "both" || searchIn === "name") &&
                ct.name.toLowerCase().includes(lowerPattern);
              const matchValue =
                (searchIn === "both" || searchIn === "value") &&
                ct.value.toLowerCase().includes(lowerPattern);
              const matchComment =
                searchIn === "both" &&
                ct.comment &&
                ct.comment.toLowerCase().includes(lowerPattern);
              if (matchName || matchValue || matchComment) {
                results.push({
                  name: ct.name,
                  value: ct.value,
                  file: ct.file,
                  category: ct.category,
                  source: "component",
                  component: ct.component,
                  ...(ct.section && { section: ct.section }),
                  ...(ct.comment && { comment: ct.comment }),
                });
              }
            }
          }

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
                    includeComponentTokens:
                      args.includeComponentTokens || false,
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

        case "extract_theme_from_css": {
          if (!args.url) {
            throw new Error("URL is required");
          }

          const cssResult = await fetchWebsiteCSS(args.url, {
            maxStylesheets: args.maxStylesheets || 20,
          });

          // Read the current theme config and schema for reference
          const cssConfig = await readBrandingJson();
          const cssSchemaDescription = getBrandingSchemaDescription();

          // Collect all CSS custom properties (these are the most useful for theming)
          const allCSS = [
            ...cssResult.inlineStyles,
            ...cssResult.linkedStylesheets
              .filter((s) => s.css !== null)
              .map((s) => s.css),
          ].join("\n");

          const customPropsRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;}{]+)/g;
          const customProperties = [];
          let cpMatch;
          while ((cpMatch = customPropsRegex.exec(allCSS)) !== null) {
            customProperties.push({
              name: `--${cpMatch[1]}`,
              value: cpMatch[2].trim(),
            });
          }

          // Deduplicate custom properties (keep first occurrence)
          const seenProps = new Set();
          const uniqueCustomProperties = customProperties.filter((prop) => {
            if (seenProps.has(prop.name)) return false;
            seenProps.add(prop.name);
            return true;
          });

          // Extract :root or html custom properties specifically (most relevant)
          const rootBlockRegex = /(?::root|html)\s*\{([^}]+)\}/gi;
          const rootProperties = [];
          let rootMatch;
          while ((rootMatch = rootBlockRegex.exec(allCSS)) !== null) {
            const block = rootMatch[1];
            const propRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+)/g;
            let propMatch;
            while ((propMatch = propRegex.exec(block)) !== null) {
              rootProperties.push({
                name: `--${propMatch[1]}`,
                value: propMatch[2].trim(),
              });
            }
          }

          // Build the response
          const responseContent = [];

          responseContent.push({
            type: "text",
            text: JSON.stringify(
              {
                instruction:
                  "Analyze the CSS extracted from this website and generate a branding theme. " +
                  "The CSS contains exact color values, font families, font sizes, spacing, and other design properties. " +
                  "Map these to the branding token schema and use 'update_theme_config' to apply each value. " +
                  "Pay special attention to :root/html CSS custom properties and the most frequently used values.",
                sourceUrl: args.url,
                summary: cssResult.summary,
                rootCustomProperties:
                  rootProperties.length > 0
                    ? rootProperties
                    : "No :root custom properties found",
                allCustomProperties: uniqueCustomProperties.slice(0, 200),
                currentTheme: cssConfig,
                schemaDescription: cssSchemaDescription,
                availablePaths: Object.keys(cssSchemaDescription),
                tips: [
                  "CSS custom properties (especially in :root) are the most reliable source for theme colors",
                  "Look for properties named with 'primary', 'brand', 'accent' for the primary color",
                  "The most commonly declared font-family is likely the body font",
                  "Check for design system naming patterns (e.g., --color-primary, --font-base-size)",
                  "border-radius values indicate the design's corner rounding preference",
                  "If the site uses a CSS framework, its custom properties often define the complete palette",
                ],
              },
              null,
              2,
            ),
          });

          // Optionally include the full raw CSS
          if (args.includeRawCSS) {
            // Truncate if extremely large to avoid overwhelming the context
            const maxCSSLength = 200_000;
            const truncatedCSS =
              allCSS.length > maxCSSLength
                ? allCSS.slice(0, maxCSSLength) +
                  `\n\n/* ... truncated (${allCSS.length - maxCSSLength} chars omitted) */`
                : allCSS;

            responseContent.push({
              type: "text",
              text: `--- RAW CSS (${cssResult.summary.linkedStylesheets} stylesheets + ${cssResult.summary.inlineStyleBlocks} inline blocks) ---\n\n${truncatedCSS}`,
            });
          }

          return { content: responseContent };
        }

        case "list_components": {
          const categoryFilter =
            args.category && args.category !== "all" ? args.category : null;
          const includeEmpty = args.includeEmpty || false;
          const componentEntries = [];

          for (const [slug, config] of Object.entries(COMPONENT_TOKEN_FILES)) {
            // Apply category filter
            if (categoryFilter && config.category !== categoryFilter) continue;

            const filePath = path.join(COMPONENT_TOKENS_DIR, config.file);
            let tokenCount = 0;
            let propertyTypes = [];
            let hasResponsiveOverrides = false;

            try {
              await fs.access(filePath);
              const content = await fs.readFile(filePath, "utf-8");
              const tokens = await parseTokenFile(filePath, config.category);
              tokenCount = tokens.size;

              // Detect responsive overrides
              hasResponsiveOverrides = /@container|@media/.test(content);

              // Collect unique property types
              const propSet = new Set();
              for (const [name] of tokens.entries()) {
                const parsed = parseComponentTokenName(name, slug);
                propSet.add(parsed.cssProperty);
              }
              propertyTypes = Array.from(propSet).sort();
            } catch {
              // File doesn't exist
            }

            if (!includeEmpty && tokenCount === 0) continue;

            componentEntries.push({
              name: slug
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase()),
              slug,
              category: config.category,
              file: config.file,
              tokenCount,
              description: config.description,
              hasResponsiveOverrides,
              tokenPropertyTypes: propertyTypes,
            });
          }

          componentEntries.sort((a, b) => a.slug.localeCompare(b.slug));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    totalComponents: componentEntries.length,
                    category: categoryFilter || "all",
                    components: componentEntries,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "get_component_tokens": {
          if (!args.component) {
            throw new Error(
              "Component name is required. Use list_components to discover valid names.",
            );
          }

          const slug = args.component.toLowerCase();
          const config = COMPONENT_TOKEN_FILES[slug];

          if (!config) {
            // Suggest similar component names
            const available = Object.keys(COMPONENT_TOKEN_FILES);
            const suggestions = available
              .filter(
                (s) =>
                  s.includes(slug) ||
                  slug.includes(s) ||
                  s.split("-").some((part) => slug.includes(part)),
              )
              .slice(0, 5);

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      error: `Component '${slug}' not found`,
                      suggestions:
                        suggestions.length > 0 ? suggestions : undefined,
                      hint: "Use 'list_components' to discover available component names",
                      availableCategories: Object.keys(COMPONENT_CATEGORIES),
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          let tokens = await parseAllComponentTokens(slug);

          // Apply element filter
          if (args.element) {
            const el = args.element.toLowerCase();
            tokens = tokens.filter(
              (t) => t.element && t.element.toLowerCase().includes(el),
            );
          }

          // Apply property filter
          if (args.property) {
            const prop = args.property.toLowerCase();
            tokens = tokens.filter((t) =>
              t.cssProperty.toLowerCase().includes(prop),
            );
          }

          // Apply statesOnly filter
          if (args.statesOnly) {
            tokens = tokens.filter((t) => t.state !== null);
          }

          // Build summary
          const variants = [
            ...new Set(tokens.filter((t) => t.variant).map((t) => t.variant)),
          ];
          const elements = [
            ...new Set(tokens.filter((t) => t.element).map((t) => t.element)),
          ];
          const states = [
            ...new Set(tokens.filter((t) => t.state).map((t) => t.state)),
          ];
          const propTypes = [...new Set(tokens.map((t) => t.cssProperty))];

          tokens.sort((a, b) => a.name.localeCompare(b.name));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    component: slug,
                    file: config.file,
                    category: config.category,
                    description: config.description,
                    totalTokens: tokens.length,
                    filters: {
                      element: args.element || null,
                      property: args.property || null,
                      statesOnly: args.statesOnly || false,
                    },
                    tokens,
                    summary: {
                      variants,
                      elements,
                      states,
                      propertyTypes: propTypes,
                    },
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "search_component_tokens": {
          if (!args.pattern) {
            throw new Error("Search pattern is required");
          }

          const lowerPattern = args.pattern.toLowerCase();
          const searchIn = args.searchIn || "both";

          // Load tokens — optionally filtered by component
          let allTokens = await parseAllComponentTokens(args.component || null);

          // Apply category filter
          if (args.category) {
            allTokens = allTokens.filter((t) => t.category === args.category);
          }

          // Apply search pattern
          const results = [];
          for (const token of allTokens) {
            const matchName =
              (searchIn === "both" || searchIn === "name") &&
              token.name.toLowerCase().includes(lowerPattern);
            const matchValue =
              (searchIn === "both" || searchIn === "value") &&
              token.value.toLowerCase().includes(lowerPattern);
            const matchComment =
              searchIn === "both" &&
              token.comment &&
              token.comment.toLowerCase().includes(lowerPattern);
            const matchComponent =
              searchIn === "both" &&
              token.component.toLowerCase().includes(lowerPattern);

            if (matchName || matchValue || matchComment || matchComponent) {
              results.push(token);
            }
          }

          // Sort by component, then name
          results.sort((a, b) => {
            const compCmp = a.component.localeCompare(b.component);
            return compCmp !== 0 ? compCmp : a.name.localeCompare(b.name);
          });

          const limit = args.limit || 50;
          const limitedResults = results.slice(0, limit);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    pattern: args.pattern,
                    searchIn,
                    component: args.component || "all",
                    category: args.category || "all",
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

        // ============================================================
        // DESIGN INTENT & GOVERNANCE TOOL HANDLERS
        // ============================================================

        case "get_design_rules": {
          const rules = await loadDesignRules();
          let result = [...rules];

          // Filter by specific ruleId
          if (args.ruleId) {
            const rule = rules.find((r) => r.id === args.ruleId);
            if (!rule) {
              throw new Error(
                `Rule '${args.ruleId}' not found. Available rules: ${rules.map((r) => r.id).join(", ")}`,
              );
            }
            result = [rule];
          }

          // Filter by category
          if (args.category) {
            result = result.filter((r) => r.category === args.category);
          }

          // Filter by severity
          if (args.severity) {
            result = result.filter((r) => r.severity === args.severity);
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    totalRules: result.length,
                    filters: {
                      ruleId: args.ruleId || null,
                      category: args.category || null,
                      severity: args.severity || null,
                    },
                    rules: result,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "get_token_hierarchy": {
          const hierarchy = await getTokenHierarchy(args.category);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(hierarchy, null, 2),
              },
            ],
          };
        }

        case "validate_token_usage": {
          const validationResult = await validateTokenUsages(
            args.context,
            args.designContext || null,
            args.tokenUsages,
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(validationResult, null, 2),
              },
            ],
          };
        }

        case "get_token_for_context": {
          const recommendation = await recommendTokenForContext(
            args.cssProperty,
            args.element,
            args.designContext || null,
            {
              interactive: args.interactive || false,
              inverted: args.inverted || false,
            },
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(recommendation, null, 2),
              },
            ],
          };
        }

        case "validate_component_tokens": {
          const auditResult = await auditComponentTokens(args.component);

          // Apply severity filter
          if (args.severity && args.severity !== "all") {
            const severityOrder = { critical: 0, warning: 1, info: 2 };
            const minLevel = severityOrder[args.severity] ?? 2;
            auditResult.violations = auditResult.violations.filter(
              (v) => (severityOrder[v.severity] ?? 2) <= minLevel,
            );
            auditResult.summary = {
              ...auditResult.summary,
              total: auditResult.violations.length,
              critical: auditResult.violations.filter(
                (v) => v.severity === "critical",
              ).length,
              warning: auditResult.violations.filter(
                (v) => v.severity === "warning",
              ).length,
              info: auditResult.violations.filter((v) => v.severity === "info")
                .length,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(auditResult, null, 2),
              },
            ],
          };
        }

        case "audit_all_components": {
          const fullAudit = await auditAllComponents(
            args.category || "all",
            args.minSeverity || "info",
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(fullAudit, null, 2),
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
              version: "4.0.0",
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
            { name: "design-tokens-server", version: "4.0.0" },
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
          `Design Tokens MCP Server v4.0.0 running on HTTP port ${PORT}`,
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

      console.error("Design Tokens MCP Server v4.0.0 running on stdio");
      console.error(`Tokens directory: ${TOKENS_DIR}`);
      console.error(`Total tokens available: ${stats.totalTokens}`);
    }
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

main();
