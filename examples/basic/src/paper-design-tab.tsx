import type { Segment } from 'fude'
import { SmartTextbox } from 'fude'
import { fetchMentions, fetchSuggestions } from './app-data'

type PaperDesignTabProps = {
  value: Array<Segment>
  onChange: (segments: Array<Segment>) => void
}

export function PaperDesignTab({ value, onChange }: PaperDesignTabProps) {
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
          onChange={onChange}
          onFetchMentions={fetchMentions}
          onFetchSuggestions={fetchSuggestions}
          onSubmit={() => {}}
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
            ghostText: 'text-[#FAFAFA]',
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
    </section>
  )
}
