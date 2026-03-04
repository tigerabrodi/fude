# Building fude — chronological steps

Each step is a natural commit boundary. The order matters — later steps depend on earlier ones.

---

## 1. Serializer and deserializer

The serializer walks `childNodes` of the editable div. A `TEXT_NODE` becomes a `TextSegment`. An `ELEMENT_NODE` that has a `data-mention-id` attribute becomes a `MentionSegment`. We need to decide how the chip span carries its data. Probably a `data-mention-id` attribute that we use to look up the full `MentionItem` from an internal map we keep. The deserializer does the reverse. Takes segments, produces a `DocumentFragment` with text nodes and chip spans. The tricky thing to figure out here is the internal map. When we create a chip we store the full `MentionItem` keyed by id so the serializer can reconstruct the `MentionSegment` with the full item attached, not just the id. Tests should cover empty segments, all text, all chips, mixed, adjacent chips, empty text segments between chips.

---

## 2. Bare contentEditable shell

The big thing to figure out here is how React and `contentEditable` coexist. The pattern is you use a `ref` to the div and you never let React control its `innerHTML`. You set the content imperatively via the ref when `value` prop changes from outside, but you guard against unnecessary DOM writes because every write resets the cursor. So you only write to the DOM if the serialized current DOM does not match the incoming `value`. Otherwise you leave the DOM alone and trust the browser. This guard is important and easy to get wrong. Auto-grow is just setting `height: auto` and reading `scrollHeight` on every input and applying it. Single line vs multiline is just a `minHeight` difference. `onInput` fires the serializer and calls `onChange`. `onKeyDown` is where submit logic lives.

---

## 3. Chip rendering and insertion

Inserting a chip at cursor position is the most fiddly part of this whole project. You need to get the current selection, find the Range, split the text node at the cursor if needed, insert the chip span, insert an empty text node after it, then place the cursor inside that empty text node. If you do not insert the empty text node after the chip the cursor gets trapped and the browser behaves weirdly. The chip span needs `contentEditable="false"`, `user-select="none"`, and a `data-mention-id`. It also needs `display: inline-flex` so the icon and label sit nicely. One thing to figure out is how React renders into chip spans. The chip content is JSX. But we are in a raw DOM environment. So we probably `createRoot` per chip and render into it. This means chips are their own React roots living inside a non-React DOM. That is fine but means chip unmounting needs to be handled carefully to avoid memory leaks. When a chip is removed from the DOM we need to unmount its React root.

---

## 4. @ dropdown

When `@` is detected in `onKeyDown` or `onInput` we enter "mention mode". We need to track two things. The position in the DOM where `@` was typed so we can replace it later, and the query string as the user keeps typing. The query is everything the user typed after `@` until they pick something or press escape. As the query changes we call `onFetchMentions(query)` and render results. The stale response problem is solved with a request counter. Increment on each call, ignore responses where the counter does not match. The dropdown needs pixel coordinates to position itself. We get these from `Range.getBoundingClientRect()` on the `@` character. The dropdown is rendered in a portal outside the editable div so it does not interfere with the DOM structure. Floating UI handles the actual anchor logic and keeps it in viewport. On select we need to find the `@query` text in the DOM, remove it, and insert the chip in its place. This is a Range operation. The thing to figure out is how to reliably find and remove the `@query` text. Probably store the Range at the point `@` was typed and extend it as the query grows. Escape removes the `@` and exits mention mode cleanly. Arrow keys, enter, escape all need to be intercepted in `onKeyDown` and prevented from doing their default behavior while the dropdown is open.

---

## 5. Ghost text overlay

Ghost text is not in the DOM of the editable div. It is an absolutely positioned div rendered next to the component. To position it you get the cursor's bounding rect via `Range.getBoundingClientRect()`, get the component's bounding rect, subtract to get relative coordinates. This needs to recalculate on every input and on resize. The debounce for `onFetchSuggestions` lives here. After the debounce fires you call the function with the last `trailingLength` characters of plain text from the current segments. You store the returned array. Index starts at 0. Tab accepts index 0 and appends it to the DOM then serializes. Shift+Tab increments the index and updates the ghost text visually. Any `onInput` dismisses the ghost text and clears the suggestion array. While the `@` dropdown is open the debounce is paused and any existing ghost text is hidden. The thing to figure out is font matching. The ghost text div needs exactly the same font, size, line height, and letter spacing as the editable div or it will not align visually. Probably copy computed styles from the editable div to the ghost div on mount.

---

## 6. Paste

Intercept `paste` event. `e.preventDefault()`. Read `text/plain` from `clipboardData`. Insert at cursor using `document.execCommand('insertText')`. Note that `execCommand` is technically deprecated but it is still the most reliable way to insert text at cursor in a `contentEditable` while preserving browser undo stack. The alternative is manual Range manipulation which breaks undo. Something to keep an eye on.

---

## 7. Submit behavior

In `onKeyDown` check if Enter is pressed. If `multiline` is false, call `onSubmit` with current segments and `preventDefault`. If `multiline` is true, check for `metaKey` or `ctrlKey`. If modifier is held, submit. Otherwise let the browser insert a newline naturally. One thing to think about is whether `onSubmit` should also clear the input or leave that to the consumer. Probably leave it to the consumer. They call whatever they want and if they want to clear they set `value` to `[]`.

---

## 8. Styling surface

`classNames` and `styles` props get spread onto each element. The tricky part is chip styling because chips are React roots rendered imperatively. They need to receive `classNames.tag` and `styles.tag` at render time. Since they are created during DOM insertion we need to pass the current styling props into the chip creation function. If props change after a chip is already rendered we need to re-render the chip root with the new props. This means chips need to be re-renderable. Probably each chip root gets updated whenever the parent component re-renders. Default styles are minimal. Dark background, subtle border, monospace label. Everything is overridable.

---

## 9. Exports and helpers

`getPlainText` maps segments to strings, mentions become `searchValue`. Pure function. `fuzzyFilter` takes a query and an items array and returns filtered items. Needs to handle empty query by returning all items, which is important for the initial `@` open. All are pure functions fully unit testable with zero DOM involvement.

---

## 10. Package setup

`tsup` is the right bundler. Produces ESM and CJS. Types via `tsc`. Peer deps are React and ReactDOM. The one thing to figure out is how to handle the chip React roots without bundling a second copy of React. Peer deps handle this but worth verifying the build output. README is already written. Publish as `fude` on npm under `tigerabrodioss`.
