// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Segment } from '../src/types'
import {
  GhostTestHarness,
  flushAsyncUpdates,
  replaceEditorText,
  setCursorAt,
} from './helpers/smart-textbox-test-utils'

const originalExecCommandDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'execCommand'
)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  if (originalExecCommandDescriptor) {
    Object.defineProperty(
      document,
      'execCommand',
      originalExecCommandDescriptor
    )
  } else {
    const doc = document as { execCommand?: unknown }
    delete doc.execCommand
  }
})

function dispatchPlainTextPaste(
  editor: Element,
  plainText: string,
  html = '<b>ignored</b>'
): void {
  const event = new Event('paste', {
    bubbles: true,
    cancelable: true,
  }) as Event & {
    clipboardData: { getData: (type: string) => string }
  }

  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (type: string) => {
        if (type === 'text/plain') return plainText
        if (type === 'text/html') return html
        return ''
      },
    },
  })

  editor.dispatchEvent(event)
}

function setSelectionRange(node: Text, start: number, end: number): void {
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)
  const selection = document.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  selection.addRange(range)
}

function mockExecCommandInsertText(): void {
  mockExecCommand((commandId: string, _showUI?: boolean, value?: string) => {
    if (commandId !== 'insertText') return false

    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const range = selection.getRangeAt(0)
    range.deleteContents()

    const textNode = document.createTextNode(String(value ?? ''))
    range.insertNode(textNode)

    const nextRange = document.createRange()
    nextRange.setStart(textNode, textNode.textContent?.length ?? 0)
    nextRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(nextRange)
    return true
  })
}

function mockExecCommand(
  implementation: (
    commandId: string,
    showUI?: boolean,
    value?: string
  ) => boolean
): ReturnType<typeof vi.fn> {
  const execCommandMock = vi.fn(implementation)
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: execCommandMock,
  })
  return execCommandMock
}

function getLastSegments(onChange: ReturnType<typeof vi.fn>): Array<Segment> {
  const calls = onChange.mock.calls
  return calls[calls.length - 1]?.[0] as Array<Segment>
}

describe('paste handling', () => {
  it('pastes plain text only (ignores rich text payload)', async () => {
    const onChange = vi.fn()
    mockExecCommand(() => false)

    const { container } = render(
      <GhostTestHarness onChangeSpy={onChange} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'hello ')
    dispatchPlainTextPaste(editor, 'world', '<b>WRONG</b>')
    await flushAsyncUpdates()

    expect(getLastSegments(onChange)).toEqual([
      { type: 'text', value: 'hello world' },
    ])
  })

  it('converts pasted newlines to spaces in single-line mode', async () => {
    const onChange = vi.fn()
    mockExecCommand(() => false)

    const { container } = render(
      <GhostTestHarness onChangeSpy={onChange} multiline={false} />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'a')
    dispatchPlainTextPaste(editor, '\nb\r\nc')
    await flushAsyncUpdates()

    expect(getLastSegments(onChange)).toEqual([
      { type: 'text', value: 'a b c' },
    ])
  })

  it('trims trailing line breaks in single-line mode without adding trailing spaces', async () => {
    const onChange = vi.fn()
    mockExecCommand(() => false)

    const { container } = render(
      <GhostTestHarness onChangeSpy={onChange} multiline={false} />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, '')
    dispatchPlainTextPaste(editor, 'replace-me NOW\n')
    await flushAsyncUpdates()

    expect(getLastSegments(onChange)).toEqual([
      { type: 'text', value: 'replace-me NOW' },
    ])
  })

  it('preserves pasted newlines in multiline mode', async () => {
    const onChange = vi.fn()
    mockExecCommand(() => false)

    const { container } = render(
      <GhostTestHarness onChangeSpy={onChange} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'start ')
    dispatchPlainTextPaste(editor, 'line1\nline2')
    await flushAsyncUpdates()

    expect(getLastSegments(onChange)).toEqual([
      { type: 'text', value: 'start line1\nline2' },
    ])
  })

  it('trims one trailing newline in multiline paste payloads', async () => {
    const onChange = vi.fn()
    mockExecCommand(() => false)

    const { container } = render(
      <GhostTestHarness onChangeSpy={onChange} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, '')
    dispatchPlainTextPaste(editor, 'alpha\nbeta\ngamma\n')
    await flushAsyncUpdates()

    expect(getLastSegments(onChange)).toEqual([
      { type: 'text', value: 'alpha\nbeta\ngamma' },
    ])
  })

  it('trims multiple trailing newlines in multiline paste payloads', async () => {
    const onChange = vi.fn()
    mockExecCommand(() => false)

    const { container } = render(
      <GhostTestHarness onChangeSpy={onChange} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, '')
    dispatchPlainTextPaste(
      editor,
      'hello <b>rich?</b> world\nline 2 with @mention\n\n'
    )
    await flushAsyncUpdates()

    expect(getLastSegments(onChange)).toEqual([
      { type: 'text', value: 'hello <b>rich?</b> world\nline 2 with @mention' },
    ])
  })

  it('replaces selected text range on paste', async () => {
    const onChange = vi.fn()
    mockExecCommand(() => false)

    const { container } = render(
      <GhostTestHarness onChangeSpy={onChange} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    const node = replaceEditorText(editor, 'hello world')
    setSelectionRange(node, 6, 11)

    dispatchPlainTextPaste(editor, 'fude')
    await flushAsyncUpdates()

    expect(getLastSegments(onChange)).toEqual([
      { type: 'text', value: 'hello fude' },
    ])
  })

  it('prefers execCommand insertText before fallback insertion', async () => {
    const onChange = vi.fn()
    const execCommandSpy = mockExecCommand(() => false)

    const { container } = render(
      <GhostTestHarness onChangeSpy={onChange} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'hello ')

    dispatchPlainTextPaste(editor, 'world')
    await flushAsyncUpdates()

    expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, 'world')
    expect(getLastSegments(onChange)).toEqual([
      { type: 'text', value: 'hello world' },
    ])
  })

  it('uses range fallback when execCommand returns false', async () => {
    const onChange = vi.fn()
    mockExecCommand(() => false)

    const { container } = render(
      <GhostTestHarness onChangeSpy={onChange} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'fallback ')
    dispatchPlainTextPaste(editor, 'works')
    await flushAsyncUpdates()

    expect(getLastSegments(onChange)).toEqual([
      { type: 'text', value: 'fallback works' },
    ])
  })

  it('commits only once when paste is followed by a native input event', async () => {
    const onChange = vi.fn()
    mockExecCommandInsertText()

    const { container } = render(
      <GhostTestHarness onChangeSpy={onChange} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'a')
    dispatchPlainTextPaste(editor, 'b')
    fireEvent.input(editor)
    await flushAsyncUpdates()

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(getLastSegments(onChange)).toEqual([{ type: 'text', value: 'ab' }])
  })

  it('keeps caret continuity after paste so typing continues from inserted end', async () => {
    const onChange = vi.fn()
    mockExecCommand(() => false)

    const { container } = render(
      <GhostTestHarness onChangeSpy={onChange} multiline />
    )

    const editor = container.querySelector('[role="textbox"]')!
    replaceEditorText(editor, 'hello')

    dispatchPlainTextPaste(editor, ' world')
    await flushAsyncUpdates()

    const selection = document.getSelection()
    expect(selection?.rangeCount).toBe(1)
    const range = selection!.getRangeAt(0)
    expect(range.collapsed).toBe(true)
    const exclamation = document.createTextNode('!')
    range.insertNode(exclamation)
    setCursorAt(exclamation, 1)
    fireEvent.input(editor)
    await flushAsyncUpdates()

    expect(getLastSegments(onChange)).toEqual([
      { type: 'text', value: 'hello world!' },
    ])
  })
})
