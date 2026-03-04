import type { MentionItem } from './types'

/**
 * Internal store that maps mention ids to their full MentionItem data.
 *
 * When a chip span lives in the contentEditable DOM, it only carries a
 * `data-mention-id` attribute (a plain string). The store lets the serializer
 * look up the full item — with label, icon, tooltip, etc. — when converting
 * the DOM back into segments.
 *
 * Lifecycle:
 *  - Items are added when:
 *      1. The deserializer processes incoming `value` prop segments
 *      2. The user picks a mention from the @ dropdown (step 4)
 *  - Items are removed when:
 *      1. A chip is deleted from the DOM
 *      2. The component unmounts (clear)
 */
export class MentionStore {
  private items = new Map<string, MentionItem>()

  /** Register an item. Keyed by item.id automatically. */
  set(item: MentionItem): void {
    this.items.set(item.id, item)
  }

  /** Look up an item by id. Returns undefined if not found. */
  get(id: string): MentionItem | undefined {
    return this.items.get(id)
  }

  /** Remove a single item by id. */
  delete(id: string): void {
    this.items.delete(id)
  }

  /** Remove all items. Used on unmount to avoid stale references. */
  clear(): void {
    this.items.clear()
  }
}
