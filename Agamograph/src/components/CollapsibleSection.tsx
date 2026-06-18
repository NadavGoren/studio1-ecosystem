import { useState, type ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  /** Show a small "on" dot in the header (e.g. when an optional feature is active). */
  active?: boolean
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * A titled, collapsible card. One self-contained "area" of the controls so the
 * client can see at a glance what each section is responsible for, and expand
 * only what they need. RTL-safe (title at the start, chevron at the end).
 */
export function CollapsibleSection({
  title,
  description,
  active = false,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition hover:bg-neutral-50"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">{title}</span>
            {active && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-900"
              />
            )}
          </span>
          {description && (
            <span className="mt-0.5 block truncate text-xs text-neutral-400">
              {description}
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={[
            'h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200',
            open ? 'rotate-180' : '',
          ].join(' ')}
        >
          <path d="M5 7.5 10 12.5 15 7.5" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-neutral-100 px-4 py-4">{children}</div>
      )}
    </section>
  )
}
