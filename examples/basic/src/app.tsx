import type { Segment } from 'fude'
import { SmartTextbox } from 'fude'
import { useState } from 'react'

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
  const [lastSubmit, setLastSubmit] = useState<string>('')

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
      </section>
    </div>
  )
}
