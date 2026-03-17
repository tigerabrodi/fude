import type { MentionItem, Segment } from '@tigerabrodioss/fude'
import { getPlainText, SmartTextbox } from '@tigerabrodioss/fude'
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

type DesktopPreviewLogEntry = {
  timestamp: string
  type: LogEntry['type']
  text: string
}

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
  dropdown:
    'bg-[#161616] border border-[#262626] rounded-[10px] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
  dropdownItem:
    'rounded-[7px] px-[10px] py-2 text-[13px] text-[#AAAAAA] hover:bg-[#1E1E1E] aria-selected:bg-[#1E1E1E] font-[Geist_Mono_Variable,Geist_Mono,ui-monospace,monospace]',
  tooltip:
    'bg-[#1A1A1A] border border-[#2A2A2A] rounded-[6px] px-2 py-1 text-xs text-[#999999] font-[Geist_Mono_Variable,Geist_Mono,ui-monospace,monospace]',
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
    type: '(segments: Segment[]) => void',
    desc: 'Called on every change. Required.',
  },
  {
    name: 'onFetchMentions',
    type: '(query: string) => Promise<MentionItem[]>',
    desc: 'Called when @ is typed. Filter locally or hit an API.',
  },
  {
    name: 'onFetchSuggestions',
    type: '(trailing: string) => Promise<string[]>',
    desc: 'Called after typing pause. Return ghost text suggestions.',
  },
  {
    name: 'onSubmit',
    type: '(segments: Segment[]) => void',
    desc: 'Called when user submits (Enter or Cmd+Enter).',
  },
  {
    name: 'multiline',
    type: 'boolean',
    desc: 'Enter adds newline, Cmd+Enter submits. Default false.',
  },
  {
    name: 'placeholder',
    type: 'string',
    desc: 'Placeholder text shown when input is empty.',
  },
  {
    name: 'classNames',
    type: 'SmartTextboxClassNames',
    desc: 'Per-element class names for full styling control.',
  },
  {
    name: 'autocompleteDelay',
    type: 'number',
    desc: 'Milliseconds to wait before fetching suggestions. Default 300.',
  },
]

const SHORTCUTS_DATA = [
  { keys: ['@'], desc: 'Open mention dropdown' },
  { keys: ['Tab'], desc: 'Accept autocomplete suggestion' },
  { keys: ['Shift', 'Tab'], desc: 'Cycle through suggestions' },
  {
    keys: ['Enter'],
    desc: 'Submit (single-line) or select dropdown item',
  },
  { keys: ['Cmd', 'Enter'], desc: 'Submit (multiline mode)' },
  {
    keys: ['Backspace'],
    desc: 'Highlight tag (first press), delete tag (second press)',
  },
  { keys: ['Escape'], desc: 'Close dropdown or dismiss ghost text' },
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
import { SmartTextbox, fuzzyFilter, getPlainText } from '@tigerabrodioss/fude'
import type { MentionItem, Segment } from '@tigerabrodioss/fude'

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
    dropdownItem: 'text-zinc-400 hover:bg-zinc-800',
    ghostText: 'text-white/20',
  }}
/>`

const CLASSNAMES_KEYS = `type SmartTextboxClassNames = {
  root?: string
  input?: string
  tagWrapper?: string
  tag?: string
  tagIcon?: string
  tagHighlighted?: string
  tagDeleteIcon?: string
  dropdown?: string
  dropdownItem?: string
  ghostText?: string
  tooltip?: string
}`

const DESKTOP_LOG_PREVIEW: Array<DesktopPreviewLogEntry> = [
  {
    timestamp: '01:29:21',
    type: 'submit',
    text: '{"agentPrompt":"lets fix <file name=\\"use-image-drag.ts\\" /> and make sure <file name=\\"serializer.ts\\" /> its working"}',
  },
  {
    timestamp: '01:29:18',
    type: 'change',
    text: '{"segmentCount":5,"mentions":2,"plainText":"lets fix use-image-drag.ts and make sure serializer.ts its working"}',
  },
  {
    timestamp: '01:29:14',
    type: 'suggestions',
    text: '{"trailing":"... make sure serializer.ts its ","results":["and make it work","with tests","today"]}',
  },
  {
    timestamp: '01:29:10',
    type: 'mentions',
    text: '{"query":"ser","results":["serializer.ts","serializer.test.ts"]}',
  },
  {
    timestamp: '01:29:08',
    type: 'mentions',
    text: '{"query":"(empty)","results":["use-image-drag.ts","serializer.ts","cursor-utils.ts"]}',
  },
  {
    timestamp: '01:29:05',
    type: 'change',
    text: '{"segmentCount":3,"mentions":1,"plainText":"lets fix use-image-drag.ts and make it work"}',
  },
]

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
    <p className="font-mono text-[10px] uppercase leading-[12px] tracking-[0.1em] text-text-dim md:text-[11px] md:leading-[14px]">
      {children}
    </p>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-sans text-[28px] font-black leading-[1.15] tracking-[-0.03em] text-text md:text-[49px] md:leading-[49px] md:tracking-[-0.04em]">
      {children}
    </h2>
  )
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] leading-[24px] text-text-muted md:max-w-[560px] md:text-[15px] md:leading-[26px]">
      {children}
    </p>
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
    <kbd className="flex items-center rounded border border-[#2A2A2A] bg-[#1A1A1A] px-2 py-[3px] font-mono text-[11px] leading-[14px] text-[#888888] md:px-[10px] md:py-[4px] md:text-[12px] md:leading-[16px]">
      {children}
    </kbd>
  )
}

function DemoTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex whitespace-nowrap items-center gap-[7px] rounded-[8px] border border-border-chip bg-elevated px-[12px] py-[4px] font-mono text-[13px] leading-[18px] text-text-body">
      <span className="text-text-muted">=</span>
      <span>{children}</span>
    </span>
  )
}

function DemoCaret() {
  return (
    <span
      aria-hidden
      className="ml-[3px] inline-block h-[20px] w-[2px] rounded-full bg-text align-[-3px]"
    />
  )
}

function DesktopDemoCard({
  label,
  children,
  footer,
  minHeightClass = 'min-h-[48px]',
}: {
  label: string
  children: React.ReactNode
  footer?: React.ReactNode
  minHeightClass?: string
}) {
  return (
    <div className="flex flex-col gap-[10px]">
      <SectionLabel>{label}</SectionLabel>
      <div
        className={`rounded-[12px] border border-border bg-surface p-[14px_16px] ${minHeightClass}`}
      >
        {children}
      </div>
      {footer ? (
        <div className="font-mono text-[11px] leading-[14px] text-text-dim">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

function formatLogData(data: unknown): string {
  return typeof data === 'string' ? data : JSON.stringify(data)
}

export function App() {
  const [value, setValue] = useState<Array<Segment>>(INITIAL_SEGMENTS)
  const [singleValue, setSingleValue] = useState<Array<Segment>>([])
  const [logs, setLogs] = useState<Array<LogEntry>>([])
  const [copyFeedback, setCopyFeedback] = useState('')
  const desktopLogEntries =
    logs.length > 0
      ? logs.map((log) => ({
          timestamp: log.timestamp,
          type: log.type,
          text: formatLogData(log.data),
        }))
      : DESKTOP_LOG_PREVIEW

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

  const livePlayground = (
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
  )

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
            href="https://www.npmjs.com/package/@tigerabrodioss/fude"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3"
          >
            <span className="font-mono text-[13px] leading-4 text-text-muted">
              $
            </span>
            <span className="font-mono text-[13px] leading-4 text-text-body">
              npm install @tigerabrodioss/fude
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
      <section className="flex flex-col gap-10 px-6 pt-16 md:gap-14 md:px-[120px] md:pt-[100px]">
        <div className="flex flex-col gap-[10px] md:max-w-[700px]">
          <SectionLabel>What it does</SectionLabel>
          <SectionHeading>
            Two features in one input. They work together.
          </SectionHeading>
        </div>
        <div className="flex flex-col gap-8 md:flex-row md:gap-12">
          <div className="flex flex-col gap-[10px] md:w-[576px]">
            <h3 className="font-mono text-[12px] font-medium leading-4 tracking-[0.02em] text-text">
              @ Mentions
            </h3>
            <p className="text-[14px] leading-6 text-text-muted md:text-[15px] md:leading-[26px]">
              Type @ anywhere to open a dropdown. Pick an item. It turns into an
              inline tag chip that lives inside the text.
            </p>
          </div>
          <div className="flex flex-col gap-[10px] md:w-[576px]">
            <h3 className="font-mono text-[12px] font-medium leading-4 tracking-[0.02em] text-text">
              AI Autocomplete
            </h3>
            <p className="text-[14px] leading-6 text-text-muted md:text-[15px] md:leading-[26px]">
              After you stop typing, ghost text appears showing a predicted
              continuation. Press Tab to accept. Shift+Tab to cycle.
            </p>
          </div>
        </div>
      </section>

      {/* ===== INTERACTIVE DEMO ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:gap-11 md:px-[120px] md:pt-[110px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>Try it</SectionLabel>
          <SectionHeading>See it in action</SectionHeading>
        </div>
        <div className="md:hidden">{livePlayground}</div>
        <div className="hidden md:grid md:grid-cols-2 md:gap-x-8">
          <div className="flex flex-col gap-8">
            <DesktopDemoCard label="Empty">
              <p className="text-[15px] leading-6 text-text-dim">
                Type @ to mention, or just start typing...
              </p>
            </DesktopDemoCard>
            <DesktopDemoCard label="Typing">
              <p className="text-[15px] leading-6 text-text">
                lets fix the drag handling in
                <DemoCaret />
              </p>
            </DesktopDemoCard>
            <DesktopDemoCard
              label="Autocomplete"
              minHeightClass="min-h-[72px]"
              footer={
                <span className="inline-flex items-center gap-2">
                  press <Kbd>Tab</Kbd> to accept
                </span>
              }
            >
              <div className="text-[15px] leading-6 text-text">
                <div>lets fix the</div>
                <div>
                  drag han
                  <DemoCaret />
                  <span className="text-[rgba(250,250,250,0.22)]">
                    dling in the canvas component
                  </span>
                </div>
              </div>
            </DesktopDemoCard>
          </div>
          <div className="flex flex-col gap-8">
            <DesktopDemoCard label="Tag inserted">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] leading-6 text-text">
                <span>lets fix</span>
                <DemoTag>use-image-drag.ts</DemoTag>
              </div>
              <div className="mt-1 text-[15px] leading-6 text-text">
                and make it
                <DemoCaret />
              </div>
            </DesktopDemoCard>
            <DesktopDemoCard
              label="Multiple tags"
              minHeightClass="min-h-[74px]"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] leading-6 text-text">
                <span>refactor</span>
                <DemoTag>canvas-renderer.ts</DemoTag>
                <span>and</span>
                <DemoTag>viewport.ts</DemoTag>
                <span>to use</span>
                <DemoTag>drag-handler.ts</DemoTag>
                <DemoCaret />
              </div>
            </DesktopDemoCard>
            <DesktopDemoCard
              label="Tags + autocomplete"
              minHeightClass="min-h-[72px]"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] leading-6 text-text">
                <span>fix the bug in</span>
                <DemoTag>viewport.ts</DemoTag>
              </div>
              <div className="mt-1 text-[15px] leading-6 text-text">
                where the zo
                <DemoCaret />
                <span className="text-[rgba(250,250,250,0.22)]">
                  om level resets on scroll
                </span>
              </div>
            </DesktopDemoCard>
          </div>
        </div>
        <div className="hidden md:flex md:flex-col md:gap-5 md:pt-4">
          <div className="flex flex-col gap-[10px]">
            <SectionLabel>Live input</SectionLabel>
            <p className="max-w-[560px] text-[15px] leading-[26px] text-text-muted">
              Try the real component here. The event log below updates as you
              type.
            </p>
          </div>
          <div className="max-w-[720px]">{livePlayground}</div>
        </div>
      </section>

      {/* ===== EVENT LOG ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:gap-11 md:px-[120px] md:pt-[112px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>Under the hood</SectionLabel>
          <SectionHeading>Event log</SectionHeading>
          <SectionDesc>
            Every mention fetch, suggestion request, state change, and
            submission is tracked. You see the full data flow in real time.
          </SectionDesc>
        </div>
        <div className="md:hidden">
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
          <div className="max-h-[400px] overflow-y-auto rounded-[10px] border border-border-subtle bg-[#0E0E0E] p-[14px] font-mono">
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
        <div className="hidden md:block md:w-[900px]">
          <div className="max-h-[400px] overflow-y-auto rounded-[10px] border border-border-subtle bg-[#0E0E0E] p-[20px_21px]">
            {desktopLogEntries.map((log, index) => (
              <div key={`${log.timestamp}-${log.type}-${index}`}>
                <div className="grid grid-cols-[70px_90px_minmax(0,1fr)] gap-x-3 py-[11px]">
                  <span className="font-mono text-[12px] leading-4 text-text-faint">
                    {log.timestamp}
                  </span>
                  <span
                    className={`font-mono text-[12px] leading-4 ${LOG_TYPE_COLORS[log.type]}`}
                  >
                    {log.type}
                  </span>
                  <span className="font-mono text-[12px] leading-5 text-text-muted break-all">
                    {log.text}
                  </span>
                </div>
                {index < desktopLogEntries.length - 1 ? (
                  <div className="h-px bg-border-subtle/60" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SEGMENTS ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:gap-12 md:px-[120px] md:pt-[118px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>Core concept</SectionLabel>
          <SectionHeading>The value is segments</SectionHeading>
          <SectionDesc>
            The value is not a plain string. It&apos;s an array of segments —
            text or mentions. That makes editing and prompt generation reliable.
          </SectionDesc>
        </div>
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <div className="flex-1 md:max-w-[584px]">
            <CodeBlock
              label="Type definition"
              code={TYPE_DEFINITION_CODE}
              language="ts"
            />
          </div>
          <div className="flex-1 md:max-w-[584px]">
            <CodeBlock
              label="Example value"
              code={EXAMPLE_VALUE_CODE}
              language="ts"
            />
          </div>
        </div>
      </section>

      {/* ===== QUICK START ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:gap-11 md:px-[120px] md:pt-[120px]">
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
      <section className="flex flex-col gap-8 px-6 pt-20 md:gap-11 md:px-[120px] md:pt-[120px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>API Reference</SectionLabel>
          <SectionHeading>Props</SectionHeading>
        </div>
        <div className="flex flex-col md:hidden">
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
        <div className="hidden md:flex md:w-[900px] md:flex-col">
          <div className="grid grid-cols-[180px_260px_minmax(0,1fr)] border-b border-border-subtle pb-[13px] font-mono text-[11px] leading-4 text-text-dim">
            <span>Prop</span>
            <span>Type</span>
            <span>Description</span>
          </div>
          {PROPS_DATA.map((prop) => (
            <div
              key={prop.name}
              className="grid grid-cols-[180px_260px_minmax(0,1fr)] gap-x-0 border-b border-border-subtle py-[14px]"
            >
              <span className="font-mono text-[14px] leading-[22px] text-text">
                {prop.name}
              </span>
              <span className="font-mono text-[13px] leading-[22px] text-text-dim">
                {prop.type}
              </span>
              <span className="text-[14px] leading-[22px] text-text-muted">
                {prop.desc}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== KEYBOARD SHORTCUTS ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:gap-11 md:px-[120px] md:pt-[122px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>Keyboard-first</SectionLabel>
          <SectionHeading>Shortcuts</SectionHeading>
        </div>
        <div className="flex flex-col md:hidden">
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
        <div className="hidden md:flex md:w-[700px] md:flex-col">
          {SHORTCUTS_DATA.map((shortcut, index) => (
            <div
              key={shortcut.desc}
              className={`grid grid-cols-[200px_minmax(0,1fr)] items-start gap-x-6 py-[16px] ${
                index < SHORTCUTS_DATA.length - 1
                  ? 'border-b border-border-subtle'
                  : ''
              }`}
            >
              <div className="flex min-h-[26px] items-center gap-2">
                {shortcut.keys.map((key, keyIndex) => (
                  <span key={key} className="flex items-center gap-2">
                    {keyIndex > 0 ? (
                      <span className="font-mono text-[11px] leading-[16px] text-text-dim">
                        +
                      </span>
                    ) : null}
                    <Kbd>{key}</Kbd>
                  </span>
                ))}
              </div>
              <span className="text-[14px] leading-[18px] text-text-muted">
                {shortcut.desc}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== STYLING ===== */}
      <section className="flex flex-col gap-8 px-6 pt-20 md:gap-12 md:px-[120px] md:pt-[118px]">
        <div className="flex flex-col gap-[10px]">
          <SectionLabel>Customization</SectionLabel>
          <SectionHeading>Style every element</SectionHeading>
          <SectionDesc>
            Use classNames to target individual parts. Tailwind, CSS modules, or
            plain classes. styles prop works too for inline overrides.
          </SectionDesc>
        </div>
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <div className="flex-1 md:order-2 md:max-w-[584px]">
            <CodeBlock
              label="Tailwind example"
              code={TAILWIND_EXAMPLE_CODE}
              language="tsx"
            />
          </div>
          <div className="flex-1 md:order-1 md:max-w-[584px]">
            <CodeBlock
              label="classNames keys"
              code={CLASSNAMES_KEYS}
              language="ts"
            />
          </div>
        </div>
      </section>

      {/* ===== DIVIDER ===== */}
      <div className="mt-20 h-px w-full bg-border-subtle md:mt-[100px]" />

      {/* ===== FOOTER ===== */}
      <footer className="flex flex-col items-center gap-4 px-6 pt-8 pb-12 md:flex-row md:justify-between md:px-[120px] md:pt-[40px] md:pb-[50px]">
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-[16px] font-black leading-5 tracking-[-0.02em] text-text-faint md:text-[18px] md:leading-[22px]">
            fude
          </span>
          <span className="text-[14px] leading-[18px] text-[#222222] md:text-[16px] md:leading-5">
            筆
          </span>
        </div>
        <div className="flex gap-6 md:gap-8">
          <a
            href="https://github.com/tigerabrodi/fude"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] leading-[14px] text-text-faint hover:text-text-muted"
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/@tigerabrodioss/fude"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] leading-[14px] text-text-faint hover:text-text-muted"
          >
            npm
          </a>
          <span className="font-mono text-[11px] leading-[14px] text-text-faint md:hidden">
            MIT
          </span>
          <span className="hidden font-mono text-[11px] leading-[14px] text-text-faint md:inline">
            MIT License
          </span>
        </div>
      </footer>
    </div>
  )
}
