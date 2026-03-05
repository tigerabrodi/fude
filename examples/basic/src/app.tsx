import type { MentionItem, Segment, SmartTextboxClassNames } from 'fude'
import { SmartTextbox } from 'fude'
import { useState } from 'react'

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

  const results = mentionCatalog
    .filter((item) => {
      const isSearchMatches = item.searchValue
        .toLowerCase()
        .includes(normalized)
      const isLabelMatches =
        typeof item.label === 'string' &&
        item.label.toLowerCase().includes(normalized)
      return isSearchMatches || isLabelMatches
    })
    .slice(0, 8)

  return Promise.resolve(results)
}

function fetchSuggestions(trailing: string): Promise<Array<string>> {
  const normalized = trailing.toLowerCase()
  const trimmed = normalized.trim()
  if (trimmed.length === 0 || trimmed.includes('@')) {
    return Promise.resolve([])
  }

  const prefix = /\s$/.test(trailing) ? '' : ' '
  const suggestions = new Set<string>()

  if (trimmed.endsWith('fix')) {
    suggestions.add(prefix + 'this')
  }
  if (trimmed.endsWith('review')) {
    suggestions.add(prefix + 'this today')
  }
  if (trimmed.endsWith('make')) {
    suggestions.add(prefix + 'it work')
  }

  suggestions.add(prefix + 'and make it work')
  suggestions.add(prefix + 'with tests')
  suggestions.add(prefix + 'today')

  return Promise.resolve(Array.from(suggestions).slice(0, 4))
}

const multiChipScenarios: Array<{ name: string; value: Array<Segment> }> = [
  {
    name: 'Adjacent chips (no spaces)',
    value: [
      { type: 'text', value: 'review ' },
      {
        type: 'mention',
        item: {
          id: '2',
          searchValue: 'serializer.ts',
          label: 'serializer.ts',
          tooltip: 'src/serializer.ts',
        },
      },
      {
        type: 'mention',
        item: {
          id: '3',
          searchValue: 'cursor-utils.ts',
          label: 'cursor-utils.ts',
          tooltip: 'src/cursor-utils.ts',
        },
      },
      {
        type: 'mention',
        item: {
          id: '4',
          searchValue: 'smart-textbox.tsx',
          label: 'smart-textbox.tsx',
          tooltip: 'src/smart-textbox.tsx',
        },
      },
      { type: 'text', value: ' today' },
    ],
  },
  {
    name: 'Spaced chips',
    value: [
      { type: 'text', value: 'review ' },
      {
        type: 'mention',
        item: {
          id: '2',
          searchValue: 'serializer.ts',
          label: 'serializer.ts',
          tooltip: 'src/serializer.ts',
        },
      },
      { type: 'text', value: ' ' },
      {
        type: 'mention',
        item: {
          id: '3',
          searchValue: 'cursor-utils.ts',
          label: 'cursor-utils.ts',
          tooltip: 'src/cursor-utils.ts',
        },
      },
      { type: 'text', value: ' ' },
      {
        type: 'mention',
        item: {
          id: '4',
          searchValue: 'smart-textbox.tsx',
          label: 'smart-textbox.tsx',
          tooltip: 'src/smart-textbox.tsx',
        },
      },
      { type: 'text', value: ' today' },
    ],
  },
  {
    name: 'Mixed chips + text',
    value: [
      { type: 'text', value: 'fix ' },
      {
        type: 'mention',
        item: {
          id: '5',
          searchValue: 'smart-textbox.ghost.test.tsx',
          label: 'smart-textbox.ghost.test.tsx',
          tooltip: 'tests/smart-textbox.ghost.test.tsx',
        },
      },
      { type: 'text', value: ' then check ' },
      {
        type: 'mention',
        item: {
          id: '6',
          searchValue: 'cursor-utils.test.ts',
          label: 'cursor-utils.test.ts',
          tooltip: 'tests/cursor-utils.test.ts',
        },
      },
      { type: 'text', value: ' and ' },
      {
        type: 'mention',
        item: {
          id: '7',
          searchValue: 'serializer.test.ts',
          label: 'serializer.test.ts',
          tooltip: 'tests/serializer.test.ts',
        },
      },
    ],
  },
  {
    name: 'Multiline chips',
    value: [
      { type: 'text', value: 'line 1 ' },
      {
        type: 'mention',
        item: {
          id: '8',
          searchValue: 'README.md',
          label: 'README.md',
          tooltip: 'README.md',
        },
      },
      { type: 'text', value: '\nline 2 ' },
      {
        type: 'mention',
        item: {
          id: '9',
          searchValue: 'BUILDING.md',
          label: 'BUILDING.md',
          tooltip: 'BUILDING.md',
        },
      },
      {
        type: 'mention',
        item: {
          id: '10',
          searchValue: 'index.ts',
          label: 'index.ts',
          tooltip: 'src/index.ts',
        },
      },
      { type: 'text', value: '\nline 3 done' },
    ],
  },
]

type TailwindTheme = {
  id: string
  name: string
  note: string
  placeholder: string
  multiline?: boolean
  cardClassName: string
  className: string
  classNames: SmartTextboxClassNames
  initialValue: Array<Segment>
}

const tailwindThemes: Array<TailwindTheme> = [
  {
    id: 'aurora-glass',
    name: 'Aurora Glass',
    note: 'Soft gradient glass surface with rounded chips and airy spacing.',
    placeholder: 'Try @mentions and press Tab for ghost text...',
    multiline: true,
    cardClassName:
      'rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-100/60 via-white to-indigo-100/70 p-5 shadow-xl backdrop-blur',
    className:
      'rounded-2xl border border-white/70 bg-white/70 p-2 shadow-inner backdrop-blur-sm',
    classNames: {
      root: 'ring-1 ring-cyan-200/70',
      input:
        'min-h-24 p-3 text-slate-800 caret-cyan-700 font-medium placeholder:text-slate-400',
      tag: 'rounded-full border border-cyan-300 bg-cyan-700/90 text-cyan-50',
      tagIcon: 'text-cyan-100',
      tagDeleteIcon: 'text-rose-200',
      dropdown:
        '!border-cyan-300/80 !bg-white/95 !text-slate-800 shadow-2xl backdrop-blur-md',
      dropdownItem: '!rounded-xl hover:!bg-cyan-100',
      ghostText: 'text-cyan-600/55',
      tooltip: '!border-cyan-300 !bg-cyan-950 !text-cyan-50',
    },
    initialValue: [
      { type: 'text', value: 'shape ' },
      { type: 'mention', item: { ...mentionCatalog[0] } },
      { type: 'text', value: ' for launch notes' },
    ],
  },
  {
    id: 'midnight-console',
    name: 'Midnight Console',
    note: 'Monospace terminal mood with neon accents and dense contrast.',
    placeholder: 'type @ then pick with Enter/Tab',
    multiline: true,
    cardClassName:
      'rounded-2xl border border-emerald-500/30 bg-slate-950 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]',
    className:
      'rounded-xl border border-emerald-500/35 bg-slate-950 p-2 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]',
    classNames: {
      root: 'ring-1 ring-emerald-500/25',
      input:
        'min-h-24 p-3 font-mono text-emerald-200 caret-emerald-300 tracking-tight placeholder:text-emerald-600/80',
      tag: 'rounded-md border border-emerald-400/50 bg-slate-900 text-emerald-100',
      tagIcon: 'text-emerald-300',
      tagDeleteIcon: 'text-rose-300',
      dropdown:
        '!border-emerald-400/45 !bg-slate-950 !text-emerald-100 shadow-2xl',
      dropdownItem: 'font-mono !rounded-sm hover:!bg-emerald-500/15',
      ghostText: 'font-mono text-emerald-300/45',
      tooltip:
        'font-mono !border-emerald-400/50 !bg-slate-900 !text-emerald-100',
    },
    initialValue: [
      { type: 'text', value: 'ship ' },
      { type: 'mention', item: { ...mentionCatalog[1] } },
      { type: 'text', value: ' with confidence' },
    ],
  },
  {
    id: 'warm-paper',
    name: 'Warm Paper',
    note: 'Editorial cream palette with serif rhythm and quiet borders.',
    placeholder: 'Review copy with @ references...',
    multiline: true,
    cardClassName:
      'rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-100/60 p-5 shadow-lg',
    className: 'rounded-2xl border border-amber-200 bg-amber-50/85 p-2',
    classNames: {
      root: 'ring-1 ring-amber-200/80',
      input:
        'min-h-24 p-3 text-stone-700 caret-amber-700 font-serif placeholder:text-stone-400',
      tag: 'rounded-full border border-amber-500 bg-amber-700 text-amber-50',
      tagIcon: 'text-amber-100',
      tagDeleteIcon: 'text-rose-100',
      dropdown: '!border-amber-300 !bg-amber-50 !text-stone-800 shadow-xl',
      dropdownItem: 'font-serif !rounded-lg hover:!bg-amber-100',
      ghostText: 'text-amber-800/50',
      tooltip: 'font-serif !border-amber-500 !bg-amber-800 !text-amber-50',
    },
    initialValue: [
      { type: 'text', value: 'review ' },
      { type: 'mention', item: { ...mentionCatalog[7] } },
      { type: 'text', value: ' before release' },
    ],
  },
  {
    id: 'cyber-grid',
    name: 'Cyber Grid',
    note: 'Sharp corners, high contrast, uppercase energy.',
    placeholder: 'Annotate blockers with @...',
    multiline: true,
    cardClassName:
      'rounded-none border border-fuchsia-500 bg-slate-900 p-5 shadow-[0_0_28px_rgba(217,70,239,0.28)]',
    className: 'rounded-none border border-fuchsia-500/80 bg-slate-900 p-2',
    classNames: {
      root: 'ring-1 ring-fuchsia-500/45',
      input:
        'min-h-24 p-3 font-mono uppercase tracking-wide text-fuchsia-100 caret-fuchsia-300 placeholder:text-fuchsia-500/70',
      tag: 'rounded-none border border-fuchsia-300 bg-fuchsia-700 text-white',
      tagIcon: 'text-fuchsia-100',
      tagDeleteIcon: 'text-red-200',
      dropdown:
        '!rounded-none !border-fuchsia-400 !bg-slate-900 !text-fuchsia-100',
      dropdownItem: '!rounded-none font-mono hover:!bg-fuchsia-500/20',
      ghostText: 'font-mono text-fuchsia-300/45',
      tooltip:
        '!rounded-none font-mono !border-fuchsia-300 !bg-black !text-fuchsia-100',
    },
    initialValue: [
      { type: 'text', value: 'trace ' },
      { type: 'mention', item: { ...mentionCatalog[2] } },
      { type: 'text', value: ' and lock fix path' },
    ],
  },
  {
    id: 'minimal-mono',
    name: 'Minimal Mono',
    note: 'Production-like neutral shell with restrained monochrome styling.',
    placeholder: 'Single-line minimalist mode...',
    multiline: false,
    cardClassName: 'rounded-xl border border-zinc-300 bg-white p-5 shadow-sm',
    className: 'rounded-lg border border-zinc-300 bg-white p-2',
    classNames: {
      root: 'ring-1 ring-zinc-200',
      input:
        'p-3 font-mono text-zinc-800 caret-zinc-700 placeholder:text-zinc-400',
      tag: 'rounded-sm border border-zinc-400 bg-zinc-100 text-zinc-800',
      tagIcon: 'text-zinc-600',
      tagDeleteIcon: 'text-zinc-500',
      dropdown: '!border-zinc-300 !bg-white !text-zinc-900 shadow-lg',
      dropdownItem: '!rounded-sm hover:!bg-zinc-100',
      ghostText: 'font-mono text-zinc-400/60',
      tooltip: 'font-mono !border-zinc-500 !bg-zinc-900 !text-zinc-100',
    },
    initialValue: [
      { type: 'text', value: 'sync ' },
      { type: 'mention', item: { ...mentionCatalog[9] } },
      { type: 'text', value: ' today' },
    ],
  },
]

type TabKey = 'tailwind' | 'playground'

function cloneSegments(segments: Array<Segment>): Array<Segment> {
  return segments.map((segment) =>
    segment.type === 'text'
      ? { ...segment }
      : { type: 'mention', item: { ...segment.item } }
  )
}

function createTailwindValues(): Record<string, Array<Segment>> {
  const result: Record<string, Array<Segment>> = {}
  for (const theme of tailwindThemes) {
    result[theme.id] = cloneSegments(theme.initialValue)
  }
  return result
}

function revealWhitespace(value: string): string {
  return value
    .replace(/ /g, '<space>')
    .replace(/\n/g, '<newline>')
    .replace(/\t/g, '<tab>')
}

function formatSegmentsForDebug(segments: Array<Segment>): string {
  return JSON.stringify(
    segments.map((segment, index) =>
      segment.type === 'text'
        ? {
            ...segment,
            segmentIndex: index,
            valueVisible: revealWhitespace(segment.value),
            valueLength: segment.value.length,
          }
        : { ...segment, segmentIndex: index }
    ),
    null,
    2
  )
}

function formatTextSegmentLengths(segments: Array<Segment>): string {
  const lengths = segments
    .map((segment, index) =>
      segment.type === 'text' ? `#${index}:${segment.value.length}` : null
    )
    .filter((entry): entry is string => entry !== null)

  return lengths.length > 0 ? lengths.join(', ') : 'none'
}

function formatDebugBlock(label: string, segments: Array<Segment>): string {
  return `${label} text lengths: ${formatTextSegmentLengths(segments)}\n\n${formatSegmentsForDebug(
    segments
  )}`
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('tailwind')
  const [tailwindValues, setTailwindValues] = useState<
    Record<string, Array<Segment>>
  >(() => createTailwindValues())

  const [singleValue, setSingleValue] = useState<Array<Segment>>([])
  const [multiValue, setMultiValue] = useState<Array<Segment>>([
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
  ])
  const [multiChipValue, setMultiChipValue] = useState<Array<Segment>>(() =>
    cloneSegments(multiChipScenarios[1].value)
  )
  const [lastSubmit, setLastSubmit] = useState<string>('')
  const [activeScenarioName, setActiveScenarioName] = useState<string>(
    multiChipScenarios[1].name
  )
  const [copyStatus, setCopyStatus] = useState<string>('')

  const singleDebug = formatDebugBlock('Single-line', singleValue)
  const multilineDebug = formatDebugBlock('Multiline', multiValue)
  const multiChipDebug = formatDebugBlock(
    `Multi-chip (${activeScenarioName})`,
    multiChipValue
  )

  function setTailwindThemeValue(
    themeId: string,
    segments: Array<Segment>
  ): void {
    setTailwindValues((previous) => ({
      ...previous,
      [themeId]: segments,
    }))
  }

  async function handleCopy(which: 'multiline' | 'multiChip' | 'all') {
    let payload = `${singleDebug}\n\n${multilineDebug}\n\n${multiChipDebug}`
    if (which === 'multiline') {
      payload = multilineDebug
    } else if (which === 'multiChip') {
      payload = multiChipDebug
    }

    try {
      await copyText(payload)
      if (which === 'all') {
        setCopyStatus('Copied full debug snapshot.')
      } else if (which === 'multiline') {
        setCopyStatus('Copied multiline debug.')
      } else {
        setCopyStatus('Copied multi-chip debug.')
      }
    } catch {
      setCopyStatus('Copy failed. Please copy from the debug blocks manually.')
    }
  }

  const tabButtonClassName =
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150'

  return (
    <div className="min-h-screen bg-slate-100 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-4">
        <header className="mb-6">
          <h1 className="text-4xl font-black tracking-tight">
            Fude — SmartTextbox
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Mention chips + ghost autocomplete playground with styling examples.
          </p>
        </header>

        <div className="mb-8 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('tailwind')}
            className={`${tabButtonClassName} ${
              activeTab === 'tailwind'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Tailwind Styles
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('playground')}
            className={`${tabButtonClassName} ${
              activeTab === 'playground'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Playground (Debug)
          </button>
        </div>

        {activeTab === 'tailwind' ? (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">
                Tailwind Styles
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Five visual directions using `classNames` with the same dummy
                mentions/suggestions. Type `@` to open mentions and press `Tab`
                to accept ghost text.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {tailwindThemes.map((theme) => (
                <article key={theme.id} className={theme.cardClassName}>
                  <h3 className="text-lg font-semibold">{theme.name}</h3>
                  <p className="mt-1 mb-4 text-sm opacity-80">{theme.note}</p>
                  <SmartTextbox
                    value={tailwindValues[theme.id] ?? []}
                    onChange={(segments) =>
                      setTailwindThemeValue(theme.id, segments)
                    }
                    onFetchMentions={fetchMentions}
                    onFetchSuggestions={fetchSuggestions}
                    onSubmit={() => {
                      // Keep showcase clean; submit behavior remains active.
                    }}
                    placeholder={theme.placeholder}
                    multiline={theme.multiline}
                    className={theme.className}
                    classNames={theme.classNames}
                  />
                </article>
              ))}
            </div>
          </section>
        ) : (
          <div
            style={{ maxWidth: 600, margin: '0 auto', fontFamily: 'system-ui' }}
          >
            <section style={{ marginBottom: 32 }}>
              <h2>Single-line (Enter to submit)</h2>
              <SmartTextbox
                value={singleValue}
                onChange={setSingleValue}
                onFetchMentions={fetchMentions}
                onFetchSuggestions={fetchSuggestions}
                onSubmit={(segments) =>
                  setLastSubmit(JSON.stringify(segments, null, 2))
                }
                placeholder="Type and press Enter..."
                style={{
                  border: '1px solid #ccc',
                  borderRadius: 6,
                  padding: 8,
                }}
                styles={{ input: { padding: 4 } }}
              />
            </section>

            <section style={{ marginBottom: 32 }}>
              <h2>Multiline (Cmd+Enter to submit)</h2>
              <SmartTextbox
                value={multiValue}
                onChange={setMultiValue}
                onFetchMentions={fetchMentions}
                onFetchSuggestions={fetchSuggestions}
                onSubmit={(segments) =>
                  setLastSubmit(JSON.stringify(segments, null, 2))
                }
                placeholder="Type here... (Cmd+Enter to submit)"
                multiline
                style={{
                  border: '1px solid #ccc',
                  borderRadius: 6,
                  padding: 8,
                }}
                styles={{ input: { padding: 4, minHeight: 80 } }}
              />
            </section>

            <section style={{ marginBottom: 32 }}>
              <h2>Multi-chip rendering playground</h2>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {multiChipScenarios.map((scenario) => (
                  <button
                    key={scenario.name}
                    type="button"
                    onClick={() => {
                      setActiveScenarioName(scenario.name)
                      setMultiChipValue(cloneSegments(scenario.value))
                    }}
                    style={{
                      border: '1px solid #bbb',
                      borderRadius: 6,
                      padding: '4px 10px',
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {scenario.name}
                  </button>
                ))}
              </div>

              <SmartTextbox
                value={multiChipValue}
                onChange={setMultiChipValue}
                onFetchMentions={fetchMentions}
                onFetchSuggestions={fetchSuggestions}
                onSubmit={(segments) =>
                  setLastSubmit(JSON.stringify(segments, null, 2))
                }
                placeholder="Try adjacent chips, hover delete, and backspace behavior..."
                multiline
                style={{
                  border: '1px solid #ccc',
                  borderRadius: 6,
                  padding: 8,
                }}
                styles={{ input: { padding: 4, minHeight: 80 } }}
              />
            </section>

            {lastSubmit && (
              <section>
                <h3>Last submitted:</h3>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 13,
                    overflow: 'auto',
                  }}
                >
                  {lastSubmit}
                </pre>
              </section>
            )}

            <section style={{ marginTop: 24 }}>
              <h3>Current values (debug)</h3>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => void handleCopy('multiline')}
                  style={{
                    border: '1px solid #bbb',
                    borderRadius: 6,
                    padding: '4px 10px',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Copy multiline debug
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy('multiChip')}
                  style={{
                    border: '1px solid #bbb',
                    borderRadius: 6,
                    padding: '4px 10px',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Copy multi-chip debug
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy('all')}
                  style={{
                    border: '1px solid #bbb',
                    borderRadius: 6,
                    padding: '4px 10px',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Copy all debug
                </button>
              </div>
              {copyStatus && (
                <p style={{ marginTop: 0, marginBottom: 12, fontSize: 13 }}>
                  {copyStatus}
                </p>
              )}
              <p>
                <strong>Single-line text lengths:</strong>{' '}
                {formatTextSegmentLengths(singleValue)}
              </p>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 13,
                  overflow: 'auto',
                }}
              >
                {formatSegmentsForDebug(singleValue)}
              </pre>
              <p>
                <strong>Multiline text lengths:</strong>{' '}
                {formatTextSegmentLengths(multiValue)}
              </p>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 13,
                  overflow: 'auto',
                }}
              >
                {formatSegmentsForDebug(multiValue)}
              </pre>
              <p>
                <strong>Multi-chip text lengths:</strong>{' '}
                {formatTextSegmentLengths(multiChipValue)}
              </p>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 13,
                  overflow: 'auto',
                }}
              >
                {formatSegmentsForDebug(multiChipValue)}
              </pre>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
