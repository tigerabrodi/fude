import type { Segment } from '@tigerabrodioss/fude'
import { SmartTextbox } from '@tigerabrodioss/fude'
import { fetchMentions, fetchSuggestions, tailwindThemes } from './app-data'

type TailwindStylesTabProps = {
  tailwindValues: Record<string, Array<Segment>>
  onThemeValueChange: (themeId: string, segments: Array<Segment>) => void
}

export function TailwindStylesTab({
  tailwindValues,
  onThemeValueChange,
}: TailwindStylesTabProps) {
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Tailwind Styles</h2>
        <p className="mt-1 text-sm text-slate-600">
          Five visual directions using `classNames` with the same dummy
          mentions/suggestions. Type `@` to open mentions and press `Tab` to
          accept ghost text.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {tailwindThemes.map((theme) => (
          <article key={theme.id} className={theme.cardClassName}>
            <h3 className="text-lg font-semibold">{theme.name}</h3>
            <p className="mt-1 mb-4 text-sm opacity-80">{theme.note}</p>
            <SmartTextbox
              value={tailwindValues[theme.id] ?? []}
              onChange={(segments) => onThemeValueChange(theme.id, segments)}
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
  )
}
