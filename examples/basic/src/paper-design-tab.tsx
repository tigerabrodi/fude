import type { Segment } from 'fude'
import { SmartTextbox } from 'fude'
import { fetchMentions, fetchSuggestions } from './app-data'

type PaperDesignTabProps = {
  value: Array<Segment>
  onChange: (segments: Array<Segment>) => void
}

const mono = '"Geist Mono", "JetBrains Mono", ui-monospace, monospace'
const sans = '"Inter", system-ui, sans-serif'

export function PaperDesignTab({ value, onChange }: PaperDesignTabProps) {
  return (
    <section
      className="-mx-4 -mt-2 min-h-[80vh] rounded-2xl px-10 py-10 sm:px-20 sm:py-16"
      style={{ backgroundColor: '#0A0A0A', fontFamily: sans }}
    >
      <div className="mb-12">
        <p
          className="mb-3 text-[11px] font-normal uppercase"
          style={{
            color: '#444444',
            fontFamily: mono,
            letterSpacing: '0.1em',
          }}
        >
          Component Library
        </p>
        <h2
          className="text-5xl font-black"
          style={{ color: '#FAFAFA', letterSpacing: '-0.02em' }}
        >
          Smart Textbox
        </h2>
        <p
          className="mt-3 max-w-xl text-lg"
          style={{ color: '#555555', lineHeight: '28px' }}
        >
          @ mentions with inline tags, autocomplete suggestions, and
          keyboard-first interactions.
        </p>
      </div>

      <div className="max-w-[540px]">
        <SmartTextbox
          value={value}
          onChange={onChange}
          onFetchMentions={fetchMentions}
          onFetchSuggestions={fetchSuggestions}
          onSubmit={() => {}}
          placeholder="Type @ to mention, or just start typing..."
          multiline
          style={{
            backgroundColor: '#141414',
            border: '1px solid #262626',
            borderRadius: '8px',
          }}
          styles={{
            input: {
              minHeight: '120px',
              padding: '14px 16px',
              fontSize: '15px',
              lineHeight: '24px',
              color: '#FAFAFA',
              fontFamily: sans,
              caretColor: '#FAFAFA',
            },
            tag: {
              backgroundColor: '#1C1C1C',
              border: '1px solid #2E2E2E',
              borderRadius: '5px',
              padding: '2px 8px',
              gap: '5px',
              fontSize: '13px',
              color: '#AAAAAA',
              fontFamily: mono,
            },
            tagIcon: {
              color: '#666666',
            },
            tagDeleteIcon: {
              color: '#666666',
            },
            ghostText: {
              color: 'rgba(250, 250, 250, 0.22)',
              fontFamily: sans,
            },
            dropdown: {
              backgroundColor: '#161616',
              border: '1px solid #262626',
              borderRadius: '10px',
              padding: '4px',
            },
            dropdownItem: {
              borderRadius: '7px',
              padding: '8px 10px',
              gap: '10px',
              fontSize: '13px',
              color: '#AAAAAA',
              fontFamily: mono,
            },
            tooltip: {
              backgroundColor: '#1A1A1A',
              border: '1px solid #2A2A2A',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              color: '#999999',
              fontFamily: mono,
            },
          }}
        />
      </div>

      <div
        className="mt-6 flex flex-wrap items-center gap-4 text-xs"
        style={{ color: '#444444', fontFamily: mono }}
      >
        <span className="flex items-center gap-1.5">
          press
          <kbd
            className="rounded px-1.5 py-0.5 text-[11px]"
            style={{
              backgroundColor: '#1A1A1A',
              border: '1px solid #2A2A2A',
              color: '#888888',
            }}
          >
            Tab
          </kbd>
          to accept
        </span>
        <span className="flex items-center gap-1.5">
          press
          <kbd
            className="rounded px-1.5 py-0.5 text-[11px]"
            style={{
              backgroundColor: '#1A1A1A',
              border: '1px solid #2A2A2A',
              color: '#888888',
            }}
          >
            Shift+Tab
          </kbd>
          to cycle suggestions
        </span>
        <span className="flex items-center gap-1.5">
          press
          <kbd
            className="rounded px-1.5 py-0.5 text-[11px]"
            style={{
              backgroundColor: '#1A1A1A',
              border: '1px solid #2A2A2A',
              color: '#888888',
            }}
          >
            @
          </kbd>
          to mention
        </span>
        <span className="flex items-center gap-1.5">
          press
          <kbd
            className="rounded px-1.5 py-0.5 text-[11px]"
            style={{
              backgroundColor: '#1A1A1A',
              border: '1px solid #2A2A2A',
              color: '#888888',
            }}
          >
            Cmd+Enter
          </kbd>
          to submit
        </span>
      </div>
    </section>
  )
}
