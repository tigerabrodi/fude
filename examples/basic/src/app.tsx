import type { Segment } from 'fude'
import { useState } from 'react'
import { mentionCatalog, multiChipScenarios } from './app-data'
import {
  cloneSegments,
  copyText,
  createTailwindValues,
  formatDebugBlock,
} from './app-utils'
import { PaperDesignTab } from './paper-design-tab'
import { PlaygroundDebugTab } from './playground-debug-tab'
import { TailwindStylesTab } from './tailwind-styles-tab'

type TabKey = 'paper' | 'tailwind' | 'playground'

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('paper')
  const [tailwindValues, setTailwindValues] = useState<
    Record<string, Array<Segment>>
  >(() => createTailwindValues())

  const [paperValue, setPaperValue] = useState<Array<Segment>>([
    { type: 'text', value: 'lets fix ' },
    {
      type: 'mention',
      item: { ...mentionCatalog[0] },
    },
    { type: 'text', value: ' and make it work' },
  ])
  const [singleValue, setSingleValue] = useState<Array<Segment>>([])
  const [multiValue, setMultiValue] = useState<Array<Segment>>([
    { type: 'text', value: 'lets fix ' },
    {
      type: 'mention',
      item: { ...mentionCatalog[0] },
    },
    { type: 'text', value: ' and make it work' },
  ])
  const [multiChipValue, setMultiChipValue] = useState<Array<Segment>>(
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
            onClick={() => setActiveTab('paper')}
            className={`${tabButtonClassName} ${
              activeTab === 'paper'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Paper Design
          </button>
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

        {activeTab === 'paper' ? (
          <PaperDesignTab value={paperValue} onChange={setPaperValue} />
        ) : activeTab === 'tailwind' ? (
          <TailwindStylesTab
            tailwindValues={tailwindValues}
            onThemeValueChange={setTailwindThemeValue}
          />
        ) : (
          <PlaygroundDebugTab
            singleValue={singleValue}
            multiValue={multiValue}
            multiChipValue={multiChipValue}
            lastSubmit={lastSubmit}
            copyStatus={copyStatus}
            onSingleChange={setSingleValue}
            onMultiChange={setMultiValue}
            onMultiChipChange={setMultiChipValue}
            onSubmit={(segments) =>
              setLastSubmit(JSON.stringify(segments, null, 2))
            }
            onScenarioNameChange={setActiveScenarioName}
            onCopy={handleCopy}
          />
        )}
      </div>
    </div>
  )
}
