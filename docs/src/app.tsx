import type { MentionItem, Segment } from 'fude'
import { getPlainText, SmartTextbox } from 'fude'
import { useEffect, useState } from 'react'

// --- Data helpers (from examples/basic/src/app-data.ts) ---

const mentionCatalog: Array<MentionItem> = [
  {
    id: '1',
    searchValue: 'use-image-drag.ts',
    label: 'use-image-drag.ts',
    tooltip: 'src/hooks/use-image-drag.ts',
  },
  {
    id: '2',
    searchValue: 'serializer.ts',
    label: 'serializer.ts',
    tooltip: 'src/serializer.ts',
  },
  {
    id: '3',
    searchValue: 'cursor-utils.ts',
    label: 'cursor-utils.ts',
    tooltip: 'src/cursor-utils.ts',
  },
  {
    id: '4',
    searchValue: 'smart-textbox.tsx',
    label: 'smart-textbox.tsx',
    tooltip: 'src/smart-textbox.tsx',
  },
  {
    id: '5',
    searchValue: 'smart-textbox.ghost.test.tsx',
    label: 'smart-textbox.ghost.test.tsx',
    tooltip: 'tests/smart-textbox.ghost.test.tsx',
  },
  {
    id: '6',
    searchValue: 'cursor-utils.test.ts',
    label: 'cursor-utils.test.ts',
    tooltip: 'tests/cursor-utils.test.ts',
  },
  {
    id: '7',
    searchValue: 'serializer.test.ts',
    label: 'serializer.test.ts',
    tooltip: 'tests/serializer.test.ts',
  },
  {
    id: '8',
    searchValue: 'README.md',
    label: 'README.md',
    tooltip: 'README.md',
  },
  {
    id: '9',
    searchValue: 'BUILDING.md',
    label: 'BUILDING.md',
    tooltip: 'BUILDING.md',
  },
  {
    id: '10',
    searchValue: 'index.ts',
    label: 'index.ts',
    tooltip: 'src/index.ts',
  },
]

function fetchMentions(query: string): Promise<Array<MentionItem>> {
  const normalized = query.trim().toLowerCase()
  if (normalized.length === 0) {
    return Promise.resolve(mentionCatalog.slice(0, 8))
  }
  return Promise.resolve(
    mentionCatalog
      .filter(
        (item) =>
          item.searchValue.toLowerCase().includes(normalized) ||
          (typeof item.label === 'string' &&
            item.label.toLowerCase().includes(normalized))
      )
      .slice(0, 8)
  )
}

function fetchSuggestions(trailing: string): Promise<Array<string>> {
  const normalized = trailing.toLowerCase()
  const trimmed = normalized.trim()
  if (trimmed.length === 0 || trimmed.includes('@')) {
    return Promise.resolve([])
  }
  const prefix = /\s$/.test(trailing) ? '' : ' '
  const suggestions = new Set<string>()
  if (trimmed.endsWith('fix')) suggestions.add(prefix + 'this')
  if (trimmed.endsWith('review')) suggestions.add(prefix + 'this today')
  if (trimmed.endsWith('make')) suggestions.add(prefix + 'it work')
  suggestions.add(prefix + 'and make it work')
  suggestions.add(prefix + 'with tests')
  suggestions.add(prefix + 'today')
  return Promise.resolve(Array.from(suggestions).slice(0, 4))
}

// --- Types ---

type LogEntry = {
  id: number
  timestamp: string
  type: 'mentions' | 'suggestions' | 'change' | 'submit'
  data: unknown
}

type CodeLanguage = 'ts' | 'tsx'

// --- Constants ---

const LOG_TYPE_COLORS: Record<LogEntry['type'], string> = {
  submit: 'text-log-submit',
  mentions: 'text-log-mentions',
  suggestions: 'text-log-suggestions',
  change: 'text-log-change',
}

const highlightedCodeCache = new Map<string, Promise<string>>()
const SHIKI_THEME = 'min-dark'
let highlighterPromise: Promise<{
  codeToHtml: (code: string, options: { lang: string; theme: string }) => string
}> | null = null

const TEXTBOX_CLASS_NAMES = {
  input:
    'min-h-[120px] p-[14px_16px] text-[15px] leading-6 text-[#FAFAFA] caret-[#FAFAFA] placeholder:text-[#444444]',
  tag: 'rounded-[5px] border border-[#2E2E2E] bg-[#1C1C1C] text-[#AAAAAA] px-2 py-0.5 gap-[5px] text-[13px] font-[Geist_Mono_Variable,Geist_Mono,ui-monospace,monospace]',
  tagIcon: 'text-[#666666]',
  tagHighlighted: 'border-[#FAFAFA]',
  tagDeleteIcon: 'text-[#666666]',
  ghostText: 'text-[rgba(250,250,250,0.5)]',
  dropdown: '!bg-[#161616] !border-[#262626] !rounded-[10px] !p-1',
  dropdownItem:
    '!rounded-[7px] hover:!bg-[#1E1E1E] !text-[#AAAAAA] font-[Geist_Mono_Variable,Geist_Mono,ui-monospace,monospace] !text-[13px]',
  tooltip:
    '!bg-[#1A1A1A] !border-[#2A2A2A] !rounded-[6px] !text-[#999999] !text-xs font-[Geist_Mono_Variable,Geist_Mono,ui-monospace,monospace]',
}

const SINGLE_LINE_CLASS_NAMES = {
  ...TEXTBOX_CLASS_NAMES,
  input:
    'p-[14px_16px] text-[15px] leading-6 text-[#FAFAFA] caret-[#FAFAFA] placeholder:text-[#444444]',
}

const INITIAL_SEGMENTS: Array<Segment> = [
  { type: 'text', value: 'lets fix ' },
  {
    type: 'mention',
    item: {
      id: '1',
      searchValue: 'use-image-drag.ts',
      label: 'use-image-drag.ts',
      tooltip: 'src/hooks/use-image-drag.ts',
    },
  },
  { type: 'text', value: ' and make it work' },
]

const PROPS_DATA = [
  {
    name: 'value',
    type: 'Segment[]',
    desc: 'Current value as an array of segments. Required.',
  },
  {
    name: 'onChange',
    type: '(Segment[]) => void',
    desc: 'Called on every change. Required.',
  },
  {
    name: 'onFetchMentions',
    type: '(string) => Promise',
    desc: 'Called when @ is typed. Filter locally or hit an API.',
  },
  {
    name: 'onFetchSuggestions',
    type: '(string) => Promise',
    desc: 'Called after typing pause. Return ghost text suggestions.',
  },
  {
    name: 'onSubmit',
    type: '(Segment[]) => void',
    desc: 'Called on Enter or Cmd+Enter.',
  },
  {
    name: 'multiline',
    type: 'boolean',
    desc: 'Enter adds newline, Cmd+Enter submits. Default false.',
  },
  {
    name: 'classNames',
    type: 'SmartTextboxClassNames',
    desc: 'Per-element class names for full styling control.',
  },
  {
    name: 'autocompleteDelay',
    type: 'number',
    desc: 'Ms before fetching suggestions. Default 300.',
  },
]

const SHORTCUTS_DATA = [
  { keys: ['@'], desc: 'Open mentions' },
  { keys: ['Tab'], desc: 'Accept suggestion' },
  { keys: ['Shift', 'Tab'], desc: 'Cycle suggestions' },
  { keys: ['Enter'], desc: 'Submit or select item' },
  { keys: ['Cmd', 'Enter'], desc: 'Submit (multiline)' },
  { keys: ['Backspace'], desc: 'Highlight / delete tag' },
  { keys: ['Escape'], desc: 'Close / dismiss' },
]

const TYPE_DEFINITION_CODE = `type TextSegment = {
  type: 'text'
  value: string
}

type MentionSegment = {
  type: 'mention'
  item: MentionItem
}

type Segment = TextSegment | MentionSegment`

const EXAMPLE_VALUE_CODE = `[
  { type: 'text', value: 'lets fix ' },
  {
    type: 'mention',
    item: {
      id: '1',
      searchValue: 'use-image-drag.ts',
      label: 'use-image-drag.ts',
    },
  },
  { type: 'text', value: ' and make it work' },
]`

const QUICK_START_CODE = `import { useState } from 'react'
import { SmartTextbox, fuzzyFilter, getPlainText } from 'fude'
import type { MentionItem, Segment } from 'fude'

const files: MentionItem[] = [
  { id: '1', searchValue: 'use-image-drag.ts', label: 'use-image-drag.ts' },
]

export function MyInput() {
  const [segments, setSegments] = useState<Array<Segment>>([])

  return (
    <SmartTextbox
      value={segments}
      onChange={setSegments}
      onFetchMentions={async (query) => fuzzyFilter(query, files)}
      onSubmit={(nextSegments) => console.log(getPlainText(nextSegments))}
    />
  )
}`

const TAILWIND_EXAMPLE_CODE = `<SmartTextbox
  classNames={{
    input: 'bg-zinc-900 text-white',
    tag: 'bg-zinc-800 border-zinc-600 text-zinc-300',
    tagHighlighted: 'border-white',
    dropdown: 'bg-zinc-900 border-zinc-700',
    dropdownItem: 'hover:bg-zinc-800',
    ghostText: 'text-white/20',
  }}
/>`

const CLASSNAMES_KEYS = `root · input
tagWrapper · tag
tagIcon · tagHighlighted
tagDeleteIcon
dropdown · dropdownItem
ghostText · tooltip`

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/tsx.mjs'),
      import('shiki/themes/min-dark.mjs'),
    ]).then(
      ([
        { createHighlighterCore },
        { createJavaScriptRegexEngine },
        { default: typescriptLanguage },
        { default: tsxLanguage },
        { default: minDarkTheme },
      ]) =>
        createHighlighterCore({
          themes: [minDarkTheme],
          langs: [typescriptLanguage, tsxLanguage],
          engine: createJavaScriptRegexEngine(),
        })
    )
  }

  return highlighterPromise
}

async function getHighlightedCode(
  code: string,
  language: CodeLanguage
): Promise<string> {
  const cacheKey = `${SHIKI_THEME}:${language}:${code}`
  const cached = highlightedCodeCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const highlighted = getHighlighter().then((highlighter) =>
    highlighter.codeToHtml(code, {
      lang: language === 'ts' ? 'typescript' : language,
      theme: SHIKI_THEME,
    })
  )

  highlightedCodeCache.set(cacheKey, highlighted)

  return highlighted
}

// --- Components ---

let logId = 0

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase leading-[12px] tracking-[0.1em] text-text-dim">
      {children}
    </p>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-sans text-[28px] font-black leading-[1.15] tracking-[-0.03em] text-text">
      {children}
    </h2>
  )
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] leading-[24px] text-text-muted">{children}</p>
  )
}

function CodeBlock({
  label,
  code,
  language,
}: {
  label: string
  code: string
  language?: CodeLanguage
}) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)

  useEffect(() => {
    if (!language) {
      setHighlightedHtml(null)
      return
    }

    let isCancelled = false

    void getHighlightedCode(code, language)
      .then((html) => {
        if (!isCancelled) {
          setHighlightedHtml(html)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setHighlightedHtml(null)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [code, language])

  return (
    <div className="flex flex-col">
      <div className="flex items-center rounded-t-lg border border-border bg-surface px-[14px] py-2">
        <span className="font-mono text-[10px] uppercase leading-[12px] tracking-[0.06em] text-text-dim">
          {label}
        </span>
      </div>
      <div className="code-block-body overflow-x-auto rounded-b-lg border-x border-b border-border bg-[#111111] px-3 py-3 font-mono text-[11px] leading-[18px] text-text-body md:px-[13px] md:py-[13px] md:text-[12px] md:leading-[19px]">
        {highlightedHtml ? (
          <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <pre className="whitespace-pre">{code}</pre>
        )}
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="flex items-center rounded border border-[#2A2A2A] bg-[#1A1A1A] px-2 py-[3px] font-mono text-[11px] leading-[14px] text-[#888888]">
      {children}
    </kbd>
  )
}

export function App() {
  const [value, setValue] = useState<Array<Segment>>(INITIAL_SEGMENTS)
  const [singleValue, setSingleValue] = useState<Array<Segment>>([])
  const [logs, setLogs] = useState<Array<LogEntry>>([])
  const [copyFeedback, setCopyFeedback] = useState('')

  function addLog(type: LogEntry['type'], data: unknown) {
    setLogs((prev) =>
      [
        {
          id: ++logId,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          type,
          data,
        },
        ...prev,
      ].slice(0, 30)
    )
  }

  async function handleFetchMentions(
    query: string
  ): Promise<Array<MentionItem>> {
    const results = await fetchMentions(query)
    addLog('mentions', {
      query: query || '(empty)',
      results: results.map((r) => r.searchValue),
    })
    return results
  }

  async function handleFetchSuggestions(
    trailing: string
  ): Promise<Array<string>> {
    const results = await fetchSuggestions(trailing)
    addLog('suggestions', {
      trailing: trailing.length > 40 ? '...' + trailing.slice(-40) : trailing,
      results,
    })
    return results
  }

  function toAgentPrompt(segments: Array<Segment>): string {
    return segments
      .map((s) =>
        s.type === 'text' ? s.value : `<file name="${s.item.searchValue}" />`
      )
      .join('')
  }

  function handleChange(segments: Array<Segment>) {
    setValue(segments)
    addLog('change', {
      segmentCount: segments.length,
      mentions: segments.filter((s) => s.type === 'mention').length,
      plainText: getPlainText(segments),
    })
  }

  function handleSubmit(segments: Array<Segment>) {
    addLog('submit', {
      agentPrompt: toAgentPrompt(segments),
      plainText: getPlainText(segments),
      segments,
    })
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[390px] bg-bg md:max-w-none">
      {/* ===== HERO ===== */}
      <section className="flex flex-col px-6 pt-[60px] pb-[80px] md:px-[120px] md:pt-[120px] md:pb-[140px]">
        <p className="mb-6 font-mono text-[10px] uppercase leading-[12px] tracking-[0.1em] text-text-dim md:text-[11px]">
          Open Source · React · TypeScript
        </p>
        <div className="mb-4 flex items-baseline gap-[14px]">
          <h1 className="font-sans text-[64px] font-black leading-none tracking-[-0.04em] text-text md:text-[120px]">
            fude
          </h1>
          <span className="text-[48px] leading-none text-text-faint md:text-[88px]">
            筆
          </span>
        </div>
        <p className="text-[17px] leading-[28px] text-text-muted md:max-w-xl md:text-[22px] md:leading-[34px]">
          Rich text input with @mentions and AI autocomplete. Inline tag chips.
          Ghost text. Keyboard-first.
        </p>
        <div className="mt-8 flex flex-col gap-[10px] md:flex-row md:gap-4">
          <a
            href="https://www.npmjs.com/package/fude"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3"
          >
            <span className="font-mono text-[13px] leading-4 text-text-muted">
              $
            </span>
            <span className="font-mono text-[13px] leading-4 text-text-body">
              npm install fude
            </span>
          </a>
          <a
            href="https://github.com/tigerabrodi/fude"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-3 font-mono text-[13px] leading-4 text-text-body"
          >
            GitHub →
          </a>
        </div>
      </section>

      {/* ===== DIVIDER ===== */}
      <div className="h-px w-full bg-border-subtle" />

      {/* ===== WHAT IT DOES ===== */}
      <section className="flex flex-col gap-10 px-6 pt-16 md:px-[120px] md:pt-[100px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>What it does</SectionLabel>
          <SectionHeading>
            Two features in one input. They work together.
          </SectionHeading>
        </div>
        <div className="flex flex-col gap-8 md:flex-row md:gap-12">
          <div className="flex flex-col gap-[10px]">
            <h3 className="font-mono text-[12px] font-medium leading-4 tracking-[0.02em] text-text">
              @ Mentions
            </h3>
            <p className="text-[14px] leading-6 text-text-muted">
              Type @ anywhere to open a dropdown. Pick an item. It turns into an
              inline tag chip that lives inside the text.
            </p>
          </div>
          <div className="flex flex-col gap-[10px]">
            <h3 className="font-mono text-[12px] font-medium leading-4 tracking-[0.02em] text-text">
              AI Autocomplete
            </h3>
            <p className="text-[14px] leading-6 text-text-muted">
              After you stop typing, ghost text appears showing a predicted
              continuation. Press Tab to accept. Shift+Tab to cycle.
            </p>
          </div>
        </div>
      </section>

      {/* ===== INTERACTIVE DEMO ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:px-[120px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>Try it</SectionLabel>
          <SectionHeading>See it in action</SectionHeading>
        </div>
        <div className="flex flex-col gap-6">
          <div>
            <SmartTextbox
              value={value}
              onChange={handleChange}
              onFetchMentions={handleFetchMentions}
              onFetchSuggestions={handleFetchSuggestions}
              onSubmit={handleSubmit}
              placeholder="Type @ to mention, or just start typing..."
              multiline
              className="rounded-lg border border-[#262626] bg-[#141414]"
              classNames={TEXTBOX_CLASS_NAMES}
            />
          </div>
          <div>
            <SmartTextbox
              value={singleValue}
              onChange={(segments) => {
                setSingleValue(segments)
                addLog('change', {
                  input: 'single-line',
                  segmentCount: segments.length,
                  mentions: segments.filter((s) => s.type === 'mention').length,
                  plainText: getPlainText(segments),
                })
              }}
              onFetchMentions={handleFetchMentions}
              onFetchSuggestions={handleFetchSuggestions}
              onSubmit={handleSubmit}
              placeholder="Enter submits. Try @mentions here too..."
              className="rounded-lg border border-[#262626] bg-[#141414]"
              classNames={SINGLE_LINE_CLASS_NAMES}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] leading-[12px] text-text-dim">
            <span className="flex items-center gap-1.5">
              press
              <kbd className="rounded border border-[#2A2A2A] bg-[#1A1A1A] px-[7px] py-[2px] font-mono text-[9px] leading-[12px] text-[#888888]">
                Tab
              </kbd>
              to accept
            </span>
            <span className="flex items-center gap-1.5">
              press
              <kbd className="rounded border border-[#2A2A2A] bg-[#1A1A1A] px-[7px] py-[2px] font-mono text-[9px] leading-[12px] text-[#888888]">
                Shift+Tab
              </kbd>
              to cycle
            </span>
            <span className="flex items-center gap-1.5">
              press
              <kbd className="rounded border border-[#2A2A2A] bg-[#1A1A1A] px-[7px] py-[2px] font-mono text-[9px] leading-[12px] text-[#888888]">
                @
              </kbd>
              to mention
            </span>
            <span className="flex items-center gap-1.5">
              press
              <kbd className="rounded border border-[#2A2A2A] bg-[#1A1A1A] px-[7px] py-[2px] font-mono text-[9px] leading-[12px] text-[#888888]">
                Cmd+Enter
              </kbd>
              to submit
            </span>
          </div>
        </div>
      </section>

      {/* ===== EVENT LOG ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:px-[120px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>Under the hood</SectionLabel>
          <SectionHeading>Event log</SectionHeading>
          <SectionDesc>
            Every mention fetch, suggestion request, state change, and
            submission is tracked in real time.
          </SectionDesc>
        </div>
        <div>
          {logs.length > 0 && (
            <div className="mb-3 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  const text = logs
                    .map(
                      (l) =>
                        `${l.timestamp} [${l.type}] ${JSON.stringify(l.data)}`
                    )
                    .join('\n')
                  void navigator.clipboard.writeText(text)
                  setCopyFeedback('Copied!')
                  setTimeout(() => setCopyFeedback(''), 1500)
                }}
                className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim hover:text-[#888888]"
              >
                {copyFeedback || 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim hover:text-[#888888]"
              >
                Clear
              </button>
            </div>
          )}
          <div className="max-h-[320px] overflow-y-auto rounded-[10px] border border-border-subtle bg-[#0E0E0E] p-[14px] font-mono">
            {logs.length === 0 ? (
              <p className="text-[10px] leading-[17px] text-text-faint">
                Start typing above to see events...
              </p>
            ) : (
              <div className="flex flex-col gap-[10px]">
                {logs.map((log, i) => (
                  <div key={log.id}>
                    <div className="flex flex-col gap-[3px]">
                      <div className="flex gap-2">
                        <span className="shrink-0 text-[10px] leading-[12px] text-text-faint">
                          {log.timestamp}
                        </span>
                        <span
                          className={`shrink-0 text-[10px] leading-[12px] ${LOG_TYPE_COLORS[log.type]}`}
                        >
                          {log.type}
                        </span>
                      </div>
                      <p className="break-all text-[10px] leading-[17px] text-text-muted">
                        {JSON.stringify(log.data)}
                      </p>
                    </div>
                    {i < logs.length - 1 && (
                      <div className="mt-[10px] h-px bg-border-subtle" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== SEGMENTS ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:px-[120px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>Core concept</SectionLabel>
          <SectionHeading>The value is segments</SectionHeading>
          <SectionDesc>
            Not a string. An array of segments — each is either text or a
            mention.
          </SectionDesc>
        </div>
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <div className="flex-1">
            <CodeBlock
              label="Type definition"
              code={TYPE_DEFINITION_CODE}
              language="ts"
            />
          </div>
          <div className="flex-1">
            <CodeBlock
              label="Example value"
              code={EXAMPLE_VALUE_CODE}
              language="ts"
            />
          </div>
        </div>
      </section>

      {/* ===== QUICK START ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:px-[120px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>Quick start</SectionLabel>
          <SectionHeading>Up and running in minutes</SectionHeading>
        </div>
        <div className="md:max-w-[720px]">
          <CodeBlock
            label="Basic usage"
            code={QUICK_START_CODE}
            language="tsx"
          />
        </div>
      </section>

      {/* ===== PROPS ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:px-[120px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>API Reference</SectionLabel>
          <SectionHeading>Props</SectionHeading>
        </div>
        <div className="flex flex-col">
          {PROPS_DATA.map((prop) => (
            <div
              key={prop.name}
              className="flex flex-col gap-1 border-b border-border-subtle py-[14px] first:pt-0"
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[13px] leading-4 text-text">
                  {prop.name}
                </span>
                <span className="font-mono text-[11px] leading-[14px] text-text-dim">
                  {prop.type}
                </span>
              </div>
              <p className="text-[13px] leading-5 text-text-muted">
                {prop.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== KEYBOARD SHORTCUTS ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:px-[120px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>Keyboard-first</SectionLabel>
          <SectionHeading>Shortcuts</SectionHeading>
        </div>
        <div className="flex flex-col">
          {SHORTCUTS_DATA.map((shortcut, i) => (
            <div
              key={shortcut.desc}
              className={`flex items-center gap-4 py-3 ${i < SHORTCUTS_DATA.length - 1 ? 'border-b border-border-subtle' : ''}`}
            >
              <div className="flex w-[120px] shrink-0 items-center gap-1">
                {shortcut.keys.map((key, ki) => (
                  <span key={key} className="flex items-center gap-1">
                    {ki > 0 && (
                      <span className="font-mono text-[10px] leading-[12px] text-text-dim">
                        +
                      </span>
                    )}
                    <Kbd>{key}</Kbd>
                  </span>
                ))}
              </div>
              <span className="text-[13px] leading-4 text-text-muted">
                {shortcut.desc}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== STYLING ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:px-[120px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>Customization</SectionLabel>
          <SectionHeading>Style every element</SectionHeading>
          <SectionDesc>
            Use classNames to target individual parts. Tailwind, CSS modules, or
            plain classes.
          </SectionDesc>
        </div>
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <div className="flex-1">
            <CodeBlock
              label="Tailwind example"
              code={TAILWIND_EXAMPLE_CODE}
              language="tsx"
            />
          </div>
          <div className="flex-1">
            <CodeBlock label="classNames keys" code={CLASSNAMES_KEYS} />
          </div>
        </div>
      </section>

      {/* ===== DIVIDER ===== */}
      <div className="mx-6 mt-20 h-px bg-border-subtle md:mx-[120px]" />

      {/* ===== FOOTER ===== */}
      <footer className="flex flex-col items-center gap-4 px-6 pt-8 pb-12">
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-[16px] font-black leading-5 tracking-[-0.02em] text-text-faint">
            fude
          </span>
          <span className="text-[14px] leading-[18px] text-[#222222]">筆</span>
        </div>
        <div className="flex gap-6">
          <a
            href="https://github.com/tigerabrodi/fude"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] leading-[14px] text-text-faint hover:text-text-muted"
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/fude"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] leading-[14px] text-text-faint hover:text-text-muted"
          >
            npm
          </a>
          <span className="font-mono text-[11px] leading-[14px] text-text-faint">
            MIT
          </span>
        </div>
      </footer>
    </div>
  )
}
