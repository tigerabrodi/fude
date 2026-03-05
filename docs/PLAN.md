# Fude Docs Site — Implementation Plan

## Context

We're building a single-page docs site for `fude` — a React component for rich text input with @mentions and AI autocomplete. The design has already been created in Paper (the design tool) with both desktop (1440px) and mobile (390px) versions. There's also already a working example of the component styled to match the Paper design in `examples/basic/src/paper-design-tab.tsx`.

## What Already Exists

### 1. Scaffolding (DONE)

- `docs/` folder created and added to root workspace
- `docs/package.json` — deps installed: React 19, Vite 6, Tailwind v4, fontsource Inter + Geist Mono, `fude` as `workspace:*`
- `docs/vite.config.ts` — Vite + React + Tailwind v4 plugin
- `docs/tsconfig.json` — standard React TS config
- `docs/index.html` — entry HTML with meta tags
- `docs/src/main.tsx` — React root mount
- `docs/src/index.css` — Tailwind v4 with `@theme` block defining the full color palette and font tokens
- All deps installed via `bun install`

### 2. Paper Design (reference)

The design lives in the Paper file "textbox with auto complete and @ mentions". Two artboards:

- **"Fude Docs"** — Desktop version, 1440px wide, artboard ID `7V-0`
- **"Fude Docs — Mobile"** — Mobile version, 390px wide, artboard ID `FD-0`

You can screenshot these with the Paper MCP tools to see the exact design. The design uses:

**Color palette** (already defined in `docs/src/index.css` as CSS custom properties):

- `--color-bg: #0a0a0a` — page background
- `--color-surface: #141414` — input/card backgrounds
- `--color-elevated: #1c1c1c` — tag chips, hover states
- `--color-border: #262626` — primary borders
- `--color-border-subtle: #1a1a1a` — section dividers, log panel border
- `--color-border-chip: #2e2e2e` — tag chip borders
- `--color-text: #fafafa` — headings, user-typed text
- `--color-text-body: #aaaaaa` — code text, tag labels
- `--color-text-muted: #666666` — body/description text
- `--color-text-dim: #444444` — labels, placeholders
- `--color-text-faint: #333333` — state labels, very muted elements
- Log colors: submit `#5a9a5a`, mentions `#7a7aba`, suggestions `#ba9a5a`, change `#555555`

**Typography**:

- `--font-sans: 'Inter Variable'` — body text, headings, input text
- `--font-mono: 'Geist Mono Variable'` — code blocks, labels, tag chips, kbd badges, log entries
- Headings: font-sans, 900 weight, tight negative tracking
- Section labels: font-mono, 10-11px, uppercase, `tracking-[0.1em]`, dim color
- Body: font-sans, 14-15px, muted color, generous line-height
- Code: font-mono, 11-13px, text-body color

### 3. Working Reference Component (`examples/basic/src/paper-design-tab.tsx`)

This file has a FULLY WORKING interactive demo with the exact Paper design styling. It includes:

- A multiline SmartTextbox styled with `classNames` using Tailwind arbitrary values
- A single-line SmartTextbox with the same styling
- An event log that tracks mentions, suggestions, changes, and submissions
- `toAgentPrompt()` function that converts segments to XML-like `<file name="..." />` format
- Copy and clear buttons for the log

**The SmartTextbox classNames from that file (use these exactly)**:

```tsx
className="rounded-lg border border-[#262626] bg-[#141414]"
classNames={{
  input: 'min-h-[120px] p-[14px_16px] text-[15px] leading-6 text-[#FAFAFA] caret-[#FAFAFA] placeholder:text-[#444444]',
  tag: 'rounded-[5px] border border-[#2E2E2E] bg-[#1C1C1C] text-[#AAAAAA] px-2 py-0.5 gap-[5px] text-[13px] font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]',
  tagIcon: 'text-[#666666]',
  tagHighlighted: 'border-[#FAFAFA]',
  tagDeleteIcon: 'text-[#666666]',
  ghostText: 'text-[rgba(250,250,250,0.5)]',
  dropdown: '!bg-[#161616] !border-[#262626] !rounded-[10px] !p-1',
  dropdownItem: '!rounded-[7px] hover:!bg-[#1E1E1E] !text-[#AAAAAA] font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace] !text-[13px]',
  tooltip: '!bg-[#1A1A1A] !border-[#2A2A2A] !rounded-[6px] !text-[#999999] !text-xs font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]',
}}
```

For the single-line variant, same classNames but without `min-h-[120px]` on input.

### 4. Data helpers (`examples/basic/src/app-data.ts`)

Has `mentionCatalog` (10 MentionItems), `fetchMentions()`, and `fetchSuggestions()` functions you can copy directly.

---

## Build Plan

### Approach: Mobile-First with `md:` breakpoints

Build every section as mobile layout first (single column, 24px padding, smaller type). Then add `md:` prefixed classes for desktop (two-column layouts, 120px padding, larger type). This is standard Tailwind responsive — no separate files or duplicated markup.

### Step 1: Create `docs/src/app.tsx`

Single file initially. The page has these sections in order:

#### Section 1: Hero

- Mobile: `px-6 pt-16 pb-20` | Desktop: `md:px-[120px] md:pt-[120px] md:pb-[140px]`
- "OPEN SOURCE · REACT · TYPESCRIPT" — font-mono, 10px mobile / 11px desktop, uppercase, tracking-widest, text-dim
- "fude" — font-sans, 64px mobile / 120px desktop, font-black, negative tracking, text-text
- "筆" — serif, 48px mobile / 88px desktop, text-faint
- Tagline — font-sans, 17px mobile / 22px desktop, text-muted, max-w-xl
- Install badge: `$ npm install @tigerabrodioss/fude` in a surface bg pill with border
- GitHub link: `https://github.com/tigerabrodi/fude` — surface bg pill with border
- Mobile: buttons stack vertically. Desktop: `md:flex-row`

#### Section 2: Divider

- `h-px bg-border-subtle w-full`

#### Section 3: What It Does

- Section label + heading pattern (reuse everywhere)
- Mobile: single column features. Desktop: `md:flex-row md:gap-12` two columns
- Left: "@ Mentions" with description
- Right: "AI Autocomplete" with description

#### Section 4: Interactive Demo ("See it in action")

- **This is the key interactive section.** Use actual `<SmartTextbox>` components from `fude`.
- One multiline instance with pre-filled segments
- One single-line instance
- Style with the classNames from paper-design-tab.tsx (listed above)
- Copy the `fetchMentions` and `fetchSuggestions` from app-data.ts

#### Section 5: Event Log ("Under the hood")

- Port the event log from paper-design-tab.tsx
- Shows timestamped entries for mentions, suggestions, change, submit events
- Color-coded by type using the log color tokens
- Include Copy + Clear buttons
- The submit log should include the `agentPrompt` field (XML-tagged mentions)
- Mobile: stacked layout (timestamp + type on one row, data below). Desktop: `md:flex-row` with fixed-width columns

#### Section 6: Segments ("The value is segments")

- Explanation text
- Two code blocks: type definition + example value
- Mobile: stacked vertically. Desktop: `md:flex-row md:gap-8` side by side
- Code blocks: surface bg header bar + slightly darker (#111) code area, font-mono, 11px mobile / 13px desktop

#### Section 7: Quick Start ("Up and running in minutes")

- Single code block with basic usage example
- Max-width ~720px on desktop
- Same code block styling as Section 6

#### Section 8: Props Table

- Mobile: each prop is a card-like row (prop name + type inline, description below)
- Desktop: `md:` three-column table layout (prop | type | description)
- Props to show: value, onChange, onFetchMentions, onFetchSuggestions, onSubmit, multiline, placeholder, classNames, autocompleteDelay

#### Section 9: Keyboard Shortcuts

- Each shortcut: kbd badge(s) + description
- kbd badges: bg-border-subtle, border-[#2a2a2a], rounded, font-mono, text-[#888]
- Shortcuts: @, Tab, Shift+Tab, Enter, Cmd+Enter, Backspace, Escape

#### Section 10: Styling ("Style every element")

- Description text
- Two code blocks: classNames keys type definition + Tailwind example
- Mobile: stacked. Desktop: side by side

#### Section 11: Divider + Footer

- Divider line
- "fude 筆" small + muted
- Links: GitHub, npm, MIT License
- Mobile: centered, stacked. Desktop: `md:flex-row md:justify-between`

### Step 2: Extract reusable patterns

After the initial build, consider extracting if there's heavy repetition:

- `SectionHeader` — the label + heading + optional description pattern used in every section
- `CodeBlock` — the header bar + pre code pattern
- `Kbd` — the keyboard badge styling

But don't over-abstract. A few repeated Tailwind classes are fine.

### Step 3: Test and polish

- Run `bun run --filter fude-docs dev` to test
- Verify mobile layout at 390px
- Verify desktop layout at 1440px
- Check that SmartTextbox mentions + autocomplete work
- Check that event log populates correctly
- Check that code blocks don't overflow on mobile (use `overflow-x-auto` on pre tags)

### Step 4: Build verification

```bash
bun run --filter @tigerabrodioss/fude build        # build the fude package first
bun run --filter fude-docs build   # build the docs site
bun run --filter fude-docs preview # preview the built site
```

---

## Publishing to npm

The fude package lives at `packages/fude/`. To publish:

### 1. Verify package.json in `packages/fude/`

Check that it has:

- `"name": "@tigerabrodioss/fude"`
- `"version": "0.1.0"` (or whatever version)
- `"main"` / `"module"` / `"types"` / `"exports"` fields pointing to built output
- `"files"` array specifying what to include in the npm package
- `"license": "MIT"`
- `"repository"` pointing to the GitHub repo
- `"keywords"` for discoverability
- `"peerDependencies"` for react

### 2. Build the package

```bash
bun run --filter @tigerabrodioss/fude build
```

### 3. Verify the package contents

```bash
cd packages/fude
npm pack --dry-run
```

This shows what files would be included. Make sure dist/ files are there and no unnecessary files are included.

### 4. Login to npm

```bash
npm login
```

### 5. Publish

```bash
cd packages/fude
npm publish --access public
```

### 6. Verify

```bash
npm info fude
```

### 7. Update docs npm link

Replace the placeholder npm link in the docs footer with `https://www.npmjs.com/package/@tigerabrodioss/fude`.

---

## Key Files Reference

| File                                      | Purpose                                                |
| ----------------------------------------- | ------------------------------------------------------ |
| `docs/src/index.css`                      | Tailwind v4 theme with all color/font tokens (DONE)    |
| `docs/src/main.tsx`                       | React entry point (DONE)                               |
| `docs/src/app.tsx`                        | Main page component (TO BUILD)                         |
| `docs/package.json`                       | Deps and scripts (DONE)                                |
| `docs/vite.config.ts`                     | Vite config (DONE)                                     |
| `examples/basic/src/paper-design-tab.tsx` | Working reference for SmartTextbox styling + event log |
| `examples/basic/src/app-data.ts`          | Mention catalog + fetch functions to copy              |
| `packages/fude/`                          | The actual fude package to publish                     |

## External Links

- GitHub: https://github.com/tigerabrodi/fude
- npm: https://www.npmjs.com/package/@tigerabrodioss/fude (after publishing)

## Notes

- Tailwind v4 uses `@theme` block for custom values (already set up in index.css)
- Use the theme tokens like `text-text`, `bg-surface`, `border-border`, `text-text-muted`, `font-mono` etc. — they're all defined
- For SmartTextbox classNames, use arbitrary values (like `bg-[#141414]`) since those exact hex values match the design precisely and some don't map 1:1 to the theme tokens
- The `!` prefix on dropdown/dropdownItem/tooltip classes is needed to override fude's built-in styles
- `fontsource` variable fonts use "Inter Variable" and "Geist Mono Variable" as font-family names — the @theme block already maps these to `--font-sans` and `--font-mono`
- The event log `toAgentPrompt()` function wraps mentions in `<file name="..." />` XML tags — this is a cool feature to highlight in the docs
- Run `bun run lint` from root to check for lint errors across the whole workspace
- The Paper MCP design artboards can be screenshotted for pixel-perfect reference: desktop `7V-0`, mobile `FD-0`
