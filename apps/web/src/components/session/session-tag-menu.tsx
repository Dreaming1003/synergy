import { For, Show, createMemo, createSignal } from "solid-js"
import { useLingui } from "@lingui/solid"
import { Icon } from "@ericsanchezok/synergy-ui/icon"
import { getSemanticIcon } from "@ericsanchezok/synergy-ui/semantic-icon"
import { sessionTags } from "@/locales/messages"

export function SessionTagMenu(props: { tags: string[]; availableTags: string[]; onChange: (tags: string[]) => void }) {
  const { _ } = useLingui()
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const filteredTags = createMemo(() => {
    const term = query().trim().toLowerCase()
    return props.availableTags.filter((tag) => !term || tag.toLowerCase().includes(term))
  })

  function toggleTag(tag: string) {
    const next = props.tags.includes(tag) ? props.tags.filter((value) => value !== tag) : [...props.tags, tag]
    props.onChange(next)
  }

  function createTag() {
    const tag = query().trim()
    if (!tag || props.tags.includes(tag)) return
    props.onChange([...props.tags, tag])
    setQuery("")
  }

  return (
    <div class="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-1.5 text-12-medium text-text-base hover:bg-surface-raised-base-hover transition-colors cursor-pointer text-left"
        onClick={() => setOpen(!open())}
      >
        <Icon name={getSemanticIcon("notes.tag")} size="small" class="text-icon-weak-base" />
        {_(sessionTags.tags)}
      </button>
      <Show when={open()}>
        <div class="absolute right-full top-0 mr-1 z-50 w-[220px] rounded-lg bg-surface-raised-base border border-border-base shadow-lg p-2">
          <input
            type="text"
            value={query()}
            placeholder={_(sessionTags.filterOrCreate)}
            class="w-full px-2 py-1.5 text-12-regular rounded-md bg-surface-inset-base border border-border-base outline-none focus:border-border-interactive-base"
            onInput={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") createTag()
            }}
          />
          <div class="flex flex-wrap gap-1 py-2">
            <For each={props.tags}>
              {(tag) => (
                <button
                  type="button"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-10-medium text-text-interactive-base bg-surface-info-base/20"
                  onClick={() => toggleTag(tag)}
                >
                  #{tag}
                  <Icon name={getSemanticIcon("action.close")} size="small" />
                </button>
              )}
            </For>
          </div>
          <Show when={filteredTags().length > 0}>
            <div class="max-h-32 overflow-y-auto border-t border-border-weaker-base/40 pt-1">
              <For each={filteredTags()}>
                {(tag) => (
                  <button
                    type="button"
                    class="w-full px-2 py-1 text-left text-12-regular text-text-base hover:bg-surface-raised-base-hover rounded cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    <span class={props.tags.includes(tag) ? "text-text-interactive-base" : ""}>#{tag}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Show when={query().trim() && !props.availableTags.includes(query().trim())}>
            <button
              type="button"
              class="w-full mt-1 px-2 py-1.5 text-left text-12-medium text-text-interactive-base hover:bg-surface-raised-base-hover rounded cursor-pointer"
              onClick={createTag}
            >
              {_(sessionTags.create)} #{query().trim()}
            </button>
          </Show>
        </div>
      </Show>
    </div>
  )
}
