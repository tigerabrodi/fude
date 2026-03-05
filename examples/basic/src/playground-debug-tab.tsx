import type { Segment } from 'fude'
import { SmartTextbox } from 'fude'
import { fetchMentions, fetchSuggestions, multiChipScenarios } from './app-data'
import {
  cloneSegments,
  formatSegmentsForDebug,
  formatTextSegmentLengths,
} from './app-utils'

type PlaygroundDebugTabProps = {
  singleValue: Array<Segment>
  multiValue: Array<Segment>
  multiChipValue: Array<Segment>
  lastSubmit: string
  copyStatus: string
  onSingleChange: (segments: Array<Segment>) => void
  onMultiChange: (segments: Array<Segment>) => void
  onMultiChipChange: (segments: Array<Segment>) => void
  onSubmit: (segments: Array<Segment>) => void
  onScenarioNameChange: (name: string) => void
  onCopy: (which: 'multiline' | 'multiChip' | 'all') => Promise<void>
}

const panelStyle = {
  border: '1px solid #ccc',
  borderRadius: 6,
  padding: 8,
}

const actionButtonStyle = {
  border: '1px solid #bbb',
  borderRadius: 6,
  padding: '4px 10px',
  background: '#fff',
  cursor: 'pointer',
}

const preStyle = {
  background: '#f5f5f5',
  padding: 12,
  borderRadius: 6,
  fontSize: 13,
  overflow: 'auto',
}

export function PlaygroundDebugTab({
  singleValue,
  multiValue,
  multiChipValue,
  lastSubmit,
  copyStatus,
  onSingleChange,
  onMultiChange,
  onMultiChipChange,
  onSubmit,
  onScenarioNameChange,
  onCopy,
}: PlaygroundDebugTabProps) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', fontFamily: 'system-ui' }}>
      <section style={{ marginBottom: 32 }}>
        <h2>Single-line (Enter to submit)</h2>
        <SmartTextbox
          value={singleValue}
          onChange={onSingleChange}
          onFetchMentions={fetchMentions}
          onFetchSuggestions={fetchSuggestions}
          onSubmit={onSubmit}
          placeholder="Type and press Enter..."
          style={panelStyle}
          styles={{ input: { padding: 4 } }}
        />
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Multiline (Cmd+Enter to submit)</h2>
        <SmartTextbox
          value={multiValue}
          onChange={onMultiChange}
          onFetchMentions={fetchMentions}
          onFetchSuggestions={fetchSuggestions}
          onSubmit={onSubmit}
          placeholder="Type here... (Cmd+Enter to submit)"
          multiline
          style={panelStyle}
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
                onScenarioNameChange(scenario.name)
                onMultiChipChange(cloneSegments(scenario.value))
              }}
              style={actionButtonStyle}
            >
              {scenario.name}
            </button>
          ))}
        </div>

        <SmartTextbox
          value={multiChipValue}
          onChange={onMultiChipChange}
          onFetchMentions={fetchMentions}
          onFetchSuggestions={fetchSuggestions}
          onSubmit={onSubmit}
          placeholder="Try adjacent chips, hover delete, and backspace behavior..."
          multiline
          style={panelStyle}
          styles={{ input: { padding: 4, minHeight: 80 } }}
        />
      </section>

      {lastSubmit && (
        <section>
          <h3>Last submitted:</h3>
          <pre style={preStyle}>{lastSubmit}</pre>
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
            onClick={() => void onCopy('multiline')}
            style={actionButtonStyle}
          >
            Copy multiline debug
          </button>
          <button
            type="button"
            onClick={() => void onCopy('multiChip')}
            style={actionButtonStyle}
          >
            Copy multi-chip debug
          </button>
          <button
            type="button"
            onClick={() => void onCopy('all')}
            style={actionButtonStyle}
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
        <pre style={preStyle}>{formatSegmentsForDebug(singleValue)}</pre>
        <p>
          <strong>Multiline text lengths:</strong>{' '}
          {formatTextSegmentLengths(multiValue)}
        </p>
        <pre style={preStyle}>{formatSegmentsForDebug(multiValue)}</pre>
        <p>
          <strong>Multi-chip text lengths:</strong>{' '}
          {formatTextSegmentLengths(multiChipValue)}
        </p>
        <pre style={preStyle}>{formatSegmentsForDebug(multiChipValue)}</pre>
      </section>
    </div>
  )
}
