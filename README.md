![fude-react-ts-meta-thumbnail](https://github.com/user-attachments/assets/f483cf99-11b1-4347-9de7-76e22fdee0a2)

# fude (筆)

A React component for rich text input with `@` mentions and AI autocomplete. Built for TypeScript.

Inline tag chips. Ghost text suggestions. Keyboard-first. Fully customizable.

---

## What it does

You get a single input component that handles two things at once.

**@ mentions** — type `@` anywhere to open a dropdown. Pick an item. It turns into an inline tag chip that lives inside the text. You can have multiple tags. They flow with the text naturally.

**Autocomplete** — after you stop typing for a moment, ghost text appears after your cursor showing a predicted continuation. Press `Tab` to accept it. Keep typing to dismiss it.

Both work at the same time. You can have tags in the middle of your text and ghost text after your cursor simultaneously.

---

## Install

```bash
npm install @tigerabrodioss/fude
```

---

## The value — what is a Segment

This is the most important thing to understand before using this component.

The value is not a plain string. It is an array of **segments**. A segment is either a piece of text or a mention (a tag that was inserted via `@`).

```ts
type TextSegment = {
  type: 'text'
  value: string
}

type MentionSegment = {
  type: 'mention'
  item: MentionItem
}

type Segment = TextSegment | MentionSegment
```

So if the user typed `lets fix` then inserted a tag for `use-image-drag.ts` then typed `and make it work`, the value would be:

```tsx
;[
  { type: 'text', value: 'lets fix ' },
  {
    type: 'mention',
    item: {
      id: '1',
      searchValue: 'use-image-drag.ts',
      label: 'use-image-drag.ts',
    },
  },
  { type: 'text', value: ' and make it work' },
]
```

You manage this array in state and pass it as `value`. The component gives you the updated array in `onChange`.

**You almost never need to construct segments manually.** You start with an empty array and let the user build it up by typing.

```ts
const [segments, setSegments] = useState<Segment[]>([])
```

When you need plain text for something like sending to an API, use the helper:

```ts
import { getPlainText } from '@tigerabrodioss/fude'

getPlainText(segments) // "lets fix use-image-drag.ts and make it work"
```

---

## Basic usage

```tsx
import { SmartTextbox, fuzzyFilter, getPlainText } from '@tigerabrodioss/fude'
import type { Segment, MentionItem } from '@tigerabrodioss/fude'
import { useState } from 'react'

const files: MentionItem[] = [
  {
    id: '1',
    searchValue: 'use-image-drag.ts',
    label: 'use-image-drag.ts',
  },
  {
    id: '2',
    searchValue: 'canvas-renderer.ts',
    label: 'canvas-renderer.ts',
  },
]

export function MyInput() {
  const [segments, setSegments] = useState<Segment[]>([])

  return (
    <SmartTextbox
      value={segments}
      onChange={setSegments}
      onFetchMentions={async (query) => {
        // filter locally using the built-in fuzzy helper
        return fuzzyFilter(query, files)
      }}
      onFetchSuggestions={async (trailing) => {
        const res = await myAI.complete(trailing)
        return res.suggestions
      }}
      onSubmit={(segments) => {
        console.log(getPlainText(segments))
      }}
    />
  )
}
```

---

## MentionItem shape

Every item in your mentions list must follow this shape.

```ts
type MentionItem = {
  // unique id. used internally to track tags
  id: string

  // plain text used for fuzzy filtering when using fuzzyFilter()
  // even if label is JSX, searchValue must be a plain string
  searchValue: string

  // what renders in the dropdown row and inside the tag chip
  // can be a string or any JSX
  label: ReactNode

  // icon shown in the dropdown row and inside the tag chip
  // optional. falls back to defaultTagIcon, then our built-in default
  icon?: ReactNode

  // icon shown when hovering over the tag chip (the delete icon)
  // optional. falls back to defaultTagDeleteIcon, then our built-in X
  deleteIcon?: ReactNode

  // content shown in the tooltip when hovering over the tag chip
  // optional. no tooltip shown if omitted
  tooltip?: ReactNode
}
```

### label and searchValue are separate on purpose

`searchValue` is what we use to filter. `label` is what renders. This lets you show rich JSX in the UI while still having something plain to search against.

```tsx
const items: MentionItem[] = [
  {
    id: '1',
    searchValue: 'use-image-drag.ts', // searched against
    label: (
      <span>
        <span style={{ opacity: 0.4 }}>src/hooks/</span>
        use-image-drag.ts
      </span>
    ),
    icon: <FileIcon size={12} />,
    tooltip: <span>src/hooks/use-image-drag.ts · last modified 2h ago</span>,
    deleteIcon: <XCircleIcon size={10} />,
  },
]
```

---

## Props

### Value

| Prop       | Type                            | Required | Description                               |
| ---------- | ------------------------------- | -------- | ----------------------------------------- |
| `value`    | `Segment[]`                     | yes      | The current value as an array of segments |
| `onChange` | `(segments: Segment[]) => void` | yes      | Called on every change                    |

### Mentions

| Prop              | Type                                        | Required | Description                                                                                                                 |
| ----------------- | ------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `onFetchMentions` | `(query: string) => Promise<MentionItem[]>` | no       | Called when `@` is typed and on each keystroke after. `query` is what the user typed after `@`. Empty string on first open. |

When `@` is first typed, `onFetchMentions("")` is called immediately. For every keystroke after `@`, it is called again with the current query. You decide if you filter locally or hit an API. You decide if you debounce. We handle ignoring stale responses.

### Autocomplete

| Prop                 | Type                                      | Default | Description                                                                                                                                                                                             |
| -------------------- | ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onFetchSuggestions` | `(trailing: string) => Promise<string[]>` | —       | Called after the user pauses typing. `trailing` is the last N characters of plain text (controlled by `trailingLength`). Return an array of suggestion strings. User can Shift+Tab through all of them. |
| `autocompleteDelay`  | `number`                                  | `300`   | How long in ms the user must pause before we call `onFetchSuggestions`.                                                                                                                                 |
| `trailingLength`     | `number`                                  | `300`   | How many trailing characters to pass to `onFetchSuggestions`. Keeps token usage low for AI calls.                                                                                                       |

Autocomplete is paused while the `@` dropdown is open. The two features do not fight each other.

### Behavior

| Prop          | Type                            | Default | Description                                                                                                                            |
| ------------- | ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `placeholder` | `string`                        | —       | Placeholder text shown when input is empty.                                                                                            |
| `multiline`   | `boolean`                       | `false` | When `false`, Enter submits. When `true`, Enter adds a newline and Cmd/Ctrl+Enter submits. Input grows vertically as content is added. |
| `onSubmit`    | `(segments: Segment[]) => void` | —       | Called when the user submits.                                                                                                          |

### Default icons

| Prop                   | Type        | Description                                                                   |
| ---------------------- | ----------- | ----------------------------------------------------------------------------- |
| `defaultTagIcon`       | `ReactNode` | Default icon for all tag chips. Per-item `icon` overrides this.               |
| `defaultTagDeleteIcon` | `ReactNode` | Default delete icon shown on tag hover. Per-item `deleteIcon` overrides this. |

### Styling

| Prop         | Type                     | Description                              |
| ------------ | ------------------------ | ---------------------------------------- |
| `className`  | `string`                 | Applied to the root wrapper element.     |
| `style`      | `CSSProperties`          | Applied to the root wrapper element.     |
| `classNames` | `SmartTextboxClassNames` | Per-element class names. All optional.   |
| `styles`     | `SmartTextboxStyles`     | Per-element inline styles. All optional. |

#### classNames and styles keys

```ts
type SmartTextboxClassNames = {
  root?: string
  input?: string
  tagWrapper?: string
  tag?: string
  tagHighlighted?: string
  tagIcon?: string
  tagDeleteIcon?: string
  dropdown?: string
  dropdownItem?: string
  ghostText?: string
  tooltip?: string
}

// styles has the same keys but values are CSSProperties
```

`tagWrapper` targets the outer chip wrapper (`inline-block` container). `tag` targets the inner visible chip shell.
`tagHighlighted` targets the inner chip shell while it is highlighted by first Backspace press (before second Backspace deletes the chip).
No default highlight ring is applied; use `tagHighlighted` / `styles.tagHighlighted` to define pre-delete highlight visuals.

When `classNames.tag` is provided, built-in visual inline chip styles (padding/background/border/colors/fonts) are not forced, so utility classes can style the chip shell directly.
When `classNames.tagWrapper` is provided, built-in wrapper metric inline styles (`vertical-align`, `line-height`) are not forced, so classes like `align-middle` and `my-0.5` can tune line centering/row spacing.

#### Styling priority

`styles` wins over `classNames` wins over our built-in defaults. You can mix all three.

---

## Keyboard shortcuts

| Key                      | When                         | What happens                                                     |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------- |
| `@`                      | Typing                       | Opens mention dropdown                                           |
| `ArrowUp / ArrowDown`    | Dropdown open                | Navigate items                                                   |
| `Enter`                  | Dropdown open                | Insert selected item as tag, close dropdown, focus back on input |
| `Escape`                 | Dropdown open                | Close dropdown, keep typed `@query` text                         |
| `Tab`                    | Ghost text visible           | Accept autocomplete suggestion                                   |
| `Shift+Tab`              | Ghost text visible           | Cycle to next suggestion                                         |
| `Escape`                 | Ghost text visible           | Dismiss suggestion                                               |
| `Enter`                  | Single-line, nothing open    | Submit (`onSubmit`)                                              |
| `Cmd+Enter / Ctrl+Enter` | Multiline, nothing open      | Submit (`onSubmit`)                                              |
| `Backspace`              | Cursor directly before a tag | First press highlights the tag. Second press deletes it.         |

---

## Helpers

```ts
import { getPlainText, fuzzyFilter } from '@tigerabrodioss/fude'
```

### getPlainText

Converts a segments array to a plain string. Tag chips become their `searchValue`.

```ts
getPlainText(segments)
// "lets fix use-image-drag.ts and make it work"
```

### fuzzyFilter

Built-in fuzzy filter you can use inside `onFetchMentions` if you have a local static list.

```ts
onFetchMentions={async (query) => fuzzyFilter(query, myItems)}
```

You do not have to use this. Pass any filter logic you want.

---

## Examples

### Local static list with fuzzy filter

```tsx
import { SmartTextbox, fuzzyFilter, getPlainText } from '@tigerabrodioss/fude'
;<SmartTextbox
  value={segments}
  onChange={setSegments}
  onFetchMentions={async (query) => fuzzyFilter(query, files)}
  onSubmit={(segments) => console.log(getPlainText(segments))}
/>
```

### Remote search

```tsx
<SmartTextbox
  value={segments}
  onChange={setSegments}
  onFetchMentions={async (query) => {
    const res = await api.searchFiles(query)
    return res.map((f) => ({
      id: f.id,
      searchValue: f.name,
      label: f.name,
      icon: <FileIcon size={12} />,
      tooltip: f.fullPath,
    }))
  }}
/>
```

### Autocomplete with an AI

```tsx
<SmartTextbox
  value={segments}
  onChange={setSegments}
  onFetchSuggestions={async (trailing) => {
    const res = await openai.complete({ prompt: trailing, n: 3 })
    return res.choices.map((c) => c.text)
  }}
  autocompleteDelay={300}
  trailingLength={300}
/>
```

### Custom icons globally

```tsx
<SmartTextbox
  defaultTagIcon={<FileIcon size={12} />}
  defaultTagDeleteIcon={<XIcon size={10} />}
  value={segments}
  onChange={setSegments}
  onFetchMentions={...}
/>
```

### Custom icons per item

```tsx
const items: MentionItem[] = [
  {
    id: '1',
    searchValue: 'naruto-dataset.json',
    label: 'naruto-dataset.json',
    icon: <JsonIcon size={12} />,
    deleteIcon: <TrashIcon size={10} />,
    tooltip: <span>data/naruto-dataset.json · 2.4mb</span>,
  },
]
```

### Rich label JSX

```tsx
const items: MentionItem[] = [
  {
    id: '1',
    searchValue: 'use-image-drag.ts',
    label: (
      <span style={{ display: 'flex', gap: 4 }}>
        <span style={{ opacity: 0.4 }}>src/hooks/</span>
        <span>use-image-drag.ts</span>
      </span>
    ),
  },
]
```

### Tailwind styling

```tsx
<SmartTextbox
  classNames={{
    input: 'bg-zinc-900 border-zinc-700 text-white',
    tagWrapper: 'align-middle my-0.5',
    tag: 'bg-zinc-800 border-zinc-600 text-zinc-300',
    tagHighlighted: 'ring-2 ring-blue-500',
    dropdown: 'bg-zinc-900 border-zinc-700',
    dropdownItem: 'text-zinc-400 hover:bg-zinc-800',
    ghostText: 'text-white/20',
  }}
/>
```

### Multiline

```tsx
<SmartTextbox
  multiline
  value={segments}
  onChange={setSegments}
  onSubmit={(segments) => send(getPlainText(segments))}
  placeholder="Write something long..."
/>
```

---

## How stale responses are handled

When using `onFetchMentions` with a remote API, the user might type quickly. An old slow response from `@d` might arrive after a faster response from `@dra` has already been shown. We handle this internally. Old responses are discarded. You never have to think about this.

---

## TypeScript

All types are exported.

```ts
import type {
  Segment,
  TextSegment,
  MentionSegment,
  MentionItem,
  SmartTextboxProps,
  SmartTextboxClassNames,
  SmartTextboxStyles,
} from '@tigerabrodioss/fude'
```
