import { act } from '@testing-library/react'
import { useState } from 'react'
import { vi } from 'vitest'
import { SmartTextbox } from '../../src/smart-textbox'
import type { MentionItem, Segment, SmartTextboxProps } from '../../src/types'

export type MentionFetcher = (query: string) => Promise<Array<MentionItem>>
export type SuggestionFetcher = (trailing: string) => Promise<Array<string>>

export function createItem(id: string, name: string): MentionItem {
  return { id, searchValue: name, label: name }
}

export function setCursorAt(node: Node, offset: number): void {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  const selection = document.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  selection.addRange(range)
}

export function replaceEditorText(editor: Element, value: string): Text {
  editor.textContent = ''
  const textNode = document.createTextNode(value)
  editor.appendChild(textNode)
  setCursorAt(textNode, value.length)
  return textNode
}

export function updateTextNodeValue(node: Text, value: string): void {
  node.textContent = value
  setCursorAt(node, value.length)
}

export async function flushAsyncUpdates(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

export async function flushTimeoutTick(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

export async function advanceFakeTime(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

export function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

export function MentionTestHarness({
  onFetchMentions,
  onChangeSpy,
  multiline = true,
}: {
  onFetchMentions?: SmartTextboxProps['onFetchMentions']
  onChangeSpy?: (segments: Array<Segment>) => void
  multiline?: boolean
}) {
  const [value, setValue] = useState<Array<Segment>>([])
  return (
    <SmartTextbox
      value={value}
      onChange={(segments) => {
        setValue(segments)
        onChangeSpy?.(segments)
      }}
      onFetchMentions={onFetchMentions}
      multiline={multiline}
    />
  )
}

export function GhostTestHarness({
  onFetchMentions,
  onFetchSuggestions,
  onChangeSpy,
  onSubmitSpy,
  multiline = true,
  trailingLength,
  autocompleteDelay,
  initialValue = [],
  classNames,
  styles,
}: {
  onFetchMentions?: SmartTextboxProps['onFetchMentions']
  onFetchSuggestions?: SmartTextboxProps['onFetchSuggestions']
  onChangeSpy?: (segments: Array<Segment>) => void
  onSubmitSpy?: (segments: Array<Segment>) => void
  multiline?: boolean
  trailingLength?: number
  autocompleteDelay?: number
  initialValue?: Array<Segment>
  classNames?: SmartTextboxProps['classNames']
  styles?: SmartTextboxProps['styles']
}) {
  const [value, setValue] = useState<Array<Segment>>(initialValue)
  return (
    <SmartTextbox
      value={value}
      onChange={(segments) => {
        setValue(segments)
        onChangeSpy?.(segments)
      }}
      onSubmit={onSubmitSpy}
      onFetchMentions={onFetchMentions}
      onFetchSuggestions={onFetchSuggestions}
      multiline={multiline}
      trailingLength={trailingLength}
      autocompleteDelay={autocompleteDelay}
      classNames={classNames}
      styles={styles}
    />
  )
}
