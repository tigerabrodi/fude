import type { CSSProperties, ReactNode } from 'react'

// --- Segments (the value model) ---

export type TextSegment = {
  type: 'text'
  value: string
}

export type MentionSegment = {
  type: 'mention'
  item: MentionItem
}

export type Segment = TextSegment | MentionSegment

// --- Mention items ---

export type MentionItem = {
  /** Unique id. Used internally to track tags. */
  id: string

  /** Plain text used for fuzzy filtering. Must be a plain string even if label is JSX. */
  searchValue: string

  /** What renders in the dropdown row and inside the tag chip. Can be a string or JSX. */
  label: ReactNode

  /** Icon shown in the dropdown row and inside the tag chip. */
  icon?: ReactNode

  /** Icon shown when hovering over the tag chip (the delete icon). */
  deleteIcon?: ReactNode

  /** Content shown in the tooltip when hovering over the tag chip. No tooltip if omitted. */
  tooltip?: ReactNode
}

// --- Styling ---

export type SmartTextboxClassNames = {
  root?: string
  input?: string
  tag?: string
  tagIcon?: string
  tagDeleteIcon?: string
  dropdown?: string
  dropdownItem?: string
  ghostText?: string
  tooltip?: string
}

export type SmartTextboxStyles = {
  [K in keyof SmartTextboxClassNames]?: CSSProperties
}

// --- Component props ---

export type SmartTextboxProps = {
  /** The current value as an array of segments. */
  value: Segment[]

  /** Called on every change. */
  onChange: (segments: Segment[]) => void

  /** Called when @ is typed. query is what the user typed after @. */
  onFetchMentions?: (query: string) => Promise<MentionItem[]>

  /** Called after the user pauses typing. Return suggestion strings. */
  onFetchSuggestions?: (trailing: string) => Promise<string[]>

  /** How long in ms the user must pause before calling onFetchSuggestions. */
  autocompleteDelay?: number

  /** How many trailing characters to pass to onFetchSuggestions. */
  trailingLength?: number

  /** Placeholder text shown when input is empty. */
  placeholder?: string

  /** When false, Enter submits. When true, Enter adds newline, Cmd+Enter submits. */
  multiline?: boolean

  /** Called when the user submits. */
  onSubmit?: (segments: Segment[]) => void

  /** Default icon for all tag chips. Per-item icon overrides this. */
  defaultTagIcon?: ReactNode

  /** Default delete icon shown on tag hover. Per-item deleteIcon overrides this. */
  defaultTagDeleteIcon?: ReactNode

  /** Applied to the root wrapper element. */
  className?: string

  /** Applied to the root wrapper element. */
  style?: CSSProperties

  /** Per-element class names. */
  classNames?: SmartTextboxClassNames

  /** Per-element inline styles. */
  styles?: SmartTextboxStyles
}
