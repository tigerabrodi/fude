import type { MentionItem, Segment } from 'fude'
import { getPlainText, SmartTextbox } from 'fude'
import { useState } from 'react'
import { fetchMentions, fetchSuggestions } from './app-data'

type PaperDesignTabProps = {
  value: Array<Segment>
  onChange: (segments: Array<Segment>) => void
}

type LogEntry = {
  id: number
  timestamp: string
  type: 'mentions' | 'suggestions' | 'change' | 'submit'
  data: unknown
}

const LOG_TYPE_COLORS: Record<LogEntry['type'], string> = {
  submit: 'text-[#5A9A5A]',
  mentions: 'text-[#7A7ABA]',
  suggestions: 'text-[#BA9A5A]',
  change: 'text-[#555555]',
}

function logTypeColor(type: LogEntry['type']): string {
  return LOG_TYPE_COLORS[type]
}

let logId = 0

export function PaperDesignTab({ value, onChange }: PaperDesignTabProps) {
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

  function handleChange(segments: Array<Segment>) {
    onChange(segments)
    addLog('change', {
      segmentCount: segments.length,
      mentions: segments.filter((s) => s.type === 'mention').length,
      plainText: getPlainText(segments),
    })
  }

  function toAgentPrompt(segments: Array<Segment>): string {
    return segments
      .map((s) =>
        s.type === 'text' ? s.value : `<file name="${s.item.searchValue}" />`
      )
      .join('')
  }

  function handleSubmit(segments: Array<Segment>) {
    addLog('submit', {
      agentPrompt: toAgentPrompt(segments),
      plainText: getPlainText(segments),
      segments,
    })
  }
  return (
    <section className="-mx-4 -mt-2 min-h-[80vh] rounded-2xl bg-[#0A0A0A] px-10 py-10 font-[Inter,system-ui,sans-serif] sm:px-20 sm:py-16">
      <div className="mb-12">
        <p className="mb-3 text-[11px] font-normal uppercase tracking-[0.1em] text-[#444444] font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]">
          Component Library
        </p>
        <h2 className="text-5xl font-black tracking-[-0.02em] text-[#FAFAFA]">
          Smart Textbox
        </h2>
        <p className="mt-3 max-w-xl text-lg leading-7 text-[#555555]">
          @ mentions with inline tags, autocomplete suggestions, and
          keyboard-first interactions.
        </p>
      </div>

      <div className="max-w-[540px]">
        <SmartTextbox
          value={value}
          onChange={handleChange}
          onFetchMentions={handleFetchMentions}
          onFetchSuggestions={handleFetchSuggestions}
          onSubmit={handleSubmit}
          placeholder="Type @ to mention, or just start typing..."
          multiline
          className="rounded-lg border border-[#262626] bg-[#141414]"
          classNames={{
            input:
              'min-h-[120px] p-[14px_16px] text-[15px] leading-6 text-[#FAFAFA] caret-[#FAFAFA] placeholder:text-[#444444]',
            tag: 'rounded-[5px] border border-[#2E2E2E] bg-[#1C1C1C] text-[#AAAAAA] px-2 py-0.5 gap-[5px] text-[13px] font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]',
            tagIcon: 'text-[#666666]',
            tagHighlighted: 'border-[#FAFAFA]',
            tagDeleteIcon: 'text-[#666666]',
            ghostText: 'text-[rgba(250,250,250,0.5)]',
            dropdown: '!bg-[#161616] !border-[#262626] !rounded-[10px] !p-1',
            dropdownItem:
              '!rounded-[7px] hover:!bg-[#1E1E1E] !text-[#AAAAAA] font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace] !text-[13px]',
            tooltip:
              '!bg-[#1A1A1A] !border-[#2A2A2A] !rounded-[6px] !text-[#999999] !text-xs font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]',
          }}
        />
      </div>

      <div className="mt-10 max-w-[540px]">
        <p className="mb-3 text-[11px] font-normal uppercase tracking-[0.1em] text-[#444444] font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]">
          Single-line
        </p>
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
          classNames={{
            input:
              'p-[14px_16px] text-[15px] leading-6 text-[#FAFAFA] caret-[#FAFAFA] placeholder:text-[#444444]',
            tag: 'rounded-[5px] border border-[#2E2E2E] bg-[#1C1C1C] text-[#AAAAAA] px-2 py-0.5 gap-[5px] text-[13px] font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]',
            tagIcon: 'text-[#666666]',
            tagHighlighted: 'border-[#FAFAFA]',
            tagDeleteIcon: 'text-[#666666]',
            ghostText: 'text-[rgba(250,250,250,0.5)]',
            dropdown: '!bg-[#161616] !border-[#262626] !rounded-[10px] !p-1',
            dropdownItem:
              '!rounded-[7px] hover:!bg-[#1E1E1E] !text-[#AAAAAA] font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace] !text-[13px]',
            tooltip:
              '!bg-[#1A1A1A] !border-[#2A2A2A] !rounded-[6px] !text-[#999999] !text-xs font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]',
          }}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-[#444444] font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]">
        <span className="flex items-center gap-1.5">
          press
          <kbd className="rounded border border-[#2A2A2A] bg-[#1A1A1A] px-1.5 py-0.5 text-[11px] text-[#888888]">
            Tab
          </kbd>
          to accept
        </span>
        <span className="flex items-center gap-1.5">
          press
          <kbd className="rounded border border-[#2A2A2A] bg-[#1A1A1A] px-1.5 py-0.5 text-[11px] text-[#888888]">
            Shift+Tab
          </kbd>
          to cycle suggestions
        </span>
        <span className="flex items-center gap-1.5">
          press
          <kbd className="rounded border border-[#2A2A2A] bg-[#1A1A1A] px-1.5 py-0.5 text-[11px] text-[#888888]">
            @
          </kbd>
          to mention
        </span>
        <span className="flex items-center gap-1.5">
          press
          <kbd className="rounded border border-[#2A2A2A] bg-[#1A1A1A] px-1.5 py-0.5 text-[11px] text-[#888888]">
            Cmd+Enter
          </kbd>
          to submit
        </span>
      </div>
      <div className="mt-12">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-normal uppercase tracking-[0.1em] text-[#444444] font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]">
            Event Log
          </p>
          {logs.length > 0 && (
            <div className="flex gap-3">
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
                className="text-[11px] uppercase tracking-[0.1em] text-[#444444] hover:text-[#888888] font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]"
              >
                {copyFeedback || 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-[11px] uppercase tracking-[0.1em] text-[#444444] hover:text-[#888888] font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        <div className="max-h-[320px] overflow-y-auto rounded-lg border border-[#1A1A1A] bg-[#0E0E0E] p-4 font-[Geist_Mono,JetBrains_Mono,ui-monospace,monospace]">
          {logs.length === 0 ? (
            <p className="text-[12px] text-[#333333]">
              Start typing to see events...
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 text-[12px] leading-5">
                  <span className="shrink-0 text-[#333333]">
                    {log.timestamp}
                  </span>
                  <span
                    className={`shrink-0 w-[90px] ${logTypeColor(log.type)}`}
                  >
                    {log.type}
                  </span>
                  <span className="text-[#666666] break-all">
                    {JSON.stringify(log.data)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
