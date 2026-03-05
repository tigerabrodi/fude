import type { Segment } from 'fude'
import { SmartTextbox } from 'fude'
import { useState } from 'react'

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
          searchValue: 'smart-textbox.test.tsx',
          label: 'smart-textbox.test.tsx',
          tooltip: 'tests/smart-textbox.test.tsx',
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

function cloneSegments(segments: Array<Segment>): Array<Segment> {
  return segments.map((segment) =>
    segment.type === 'text'
      ? { ...segment }
      : { type: 'mention', item: { ...segment.item } }
  )
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

  return (
    <div
      style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'system-ui' }}
    >
      <h1>Fude — SmartTextbox</h1>

      <section style={{ marginBottom: 32 }}>
        <h2>Single-line (Enter to submit)</h2>
        <SmartTextbox
          value={singleValue}
          onChange={setSingleValue}
          onSubmit={(segments) =>
            setLastSubmit(JSON.stringify(segments, null, 2))
          }
          placeholder="Type and press Enter..."
          style={{ border: '1px solid #ccc', borderRadius: 6, padding: 8 }}
          styles={{ input: { padding: 4 } }}
        />
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Multiline (Cmd+Enter to submit)</h2>
        <SmartTextbox
          value={multiValue}
          onChange={setMultiValue}
          onSubmit={(segments) =>
            setLastSubmit(JSON.stringify(segments, null, 2))
          }
          placeholder="Type here... (Cmd+Enter to submit)"
          multiline
          style={{ border: '1px solid #ccc', borderRadius: 6, padding: 8 }}
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
          onSubmit={(segments) =>
            setLastSubmit(JSON.stringify(segments, null, 2))
          }
          placeholder="Try adjacent chips, hover delete, and backspace behavior..."
          multiline
          style={{ border: '1px solid #ccc', borderRadius: 6, padding: 8 }}
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
  )
}
