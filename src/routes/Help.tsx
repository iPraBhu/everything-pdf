import { CircleHelp, CloudOff, Command, Eye, Globe, HeartHandshake, Lock, ScanLine, Shield, Sparkles, Wrench, Zap } from 'lucide-react'

const playbook = [
  {
    title: 'Load',
    text: 'Start from the home drop deck or the editor sidebar. PDFs stay local and enter the current browser session only.'
  },
  {
    title: 'Choose a lane',
    text: 'Use the tool atlas to move into organization, editing, OCR, conversion, or metadata work.'
  },
  {
    title: 'Inspect output',
    text: 'Most tools create new files in-session so you can compare before moving to the editor or the next step.'
  }
]

const groups = [
  {
    icon: Eye,
    title: 'Review & organize',
    items: ['View PDF', 'Merge PDFs', 'Split PDF', 'Reorder Pages', 'Extract Pages']
  },
  {
    icon: Wrench,
    title: 'Edit & mark',
    items: ['Rotate Pages', 'Crop Pages', 'Page Numbers', 'Headers & Footers', 'Watermark']
  },
  {
    icon: ScanLine,
    title: 'OCR & text',
    items: ['OCR Text Recognition', 'Searchable PDF', 'Text Extraction']
  },
  {
    icon: Sparkles,
    title: 'Convert & optimize',
    items: ['Convert to PDF', 'Convert from PDF', 'Grayscale', 'Compress PDF']
  }
]

const realities = [
  {
    icon: Shield,
    title: 'Privacy model',
    text: 'The app is designed for client-side processing. Files are not uploaded for standard use.'
  },
  {
    icon: CloudOff,
    title: 'Offline-friendly',
    text: 'After assets load, most flows continue without a network round-trip.'
  },
  {
    icon: Lock,
    title: 'Security scope',
    text: 'Metadata editing works today. Password-grade encryption and decryption are still roadmap items because the current browser PDF stack does not support them cleanly.'
  }
]

const environment = [
  'Modern Chromium, Firefox, or Safari with WebAssembly and Web Workers enabled',
  'More memory helps with large image-heavy PDFs and OCR passes',
  'Mobile works for review and lighter jobs; dense multi-file editing is still better on a larger screen'
]

export function Help() {
  return (
    <div className="page-shell">
      <section className="hero-panel mb-6 p-5 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="section-label">
              <CircleHelp className="h-3.5 w-3.5" />
              Working guide
            </div>
            <h1 className="text-balance text-4xl leading-none text-[color:var(--ink)] sm:text-5xl lg:text-6xl">
              A straightforward guide to how the PDF workspace behaves.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[color:var(--ink-muted)] sm:text-lg">
              This page explains what is reliable today, what stays local, and where the browser runtime still imposes limits.
            </p>
          </div>

          <div className="grid gap-4">
            {playbook.map((step, index) => (
              <div key={step.title} className="card p-5">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--surface-muted)] text-sm font-semibold text-[color:var(--accent)]">
                  {index + 1}
                </div>
                <h2 className="mb-2 text-2xl text-[color:var(--ink)]">{step.title}</h2>
                <p className="text-sm leading-6 text-[color:var(--ink-muted)]">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="card-strong p-5 sm:p-6">
          <div className="section-label mb-3">Tool lanes</div>
          <h2 className="mb-5 text-3xl text-[color:var(--ink)]">What the workshop covers</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((group) => {
              const Icon = group.icon
              return (
                <div key={group.title} className="card p-5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[16px] bg-[color:var(--surface-muted)] text-[color:var(--accent-2)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-3 text-2xl text-[color:var(--ink)]">{group.title}</h3>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div key={item} className="rounded-full border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-3 py-2 text-sm text-[color:var(--ink)]">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4">
          {realities.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.title} className="card p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[16px] bg-[color:var(--surface-muted)] text-[color:var(--accent)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-2xl text-[color:var(--ink)]">{item.title}</h3>
                <p className="text-sm leading-6 text-[color:var(--ink-muted)]">{item.text}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="card-strong p-5 sm:p-6">
          <div className="section-label mb-3">
            <Command className="h-3.5 w-3.5" />
            Input and environment
          </div>
          <h2 className="mb-5 text-3xl text-[color:var(--ink)]">What the browser needs</h2>
          <div className="space-y-3">
            {environment.map((item) => (
              <div key={item} className="card p-4 text-sm leading-6 text-[color:var(--ink-muted)]">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="card-strong p-5 sm:p-6">
          <div className="section-label mb-3">
            <HeartHandshake className="h-3.5 w-3.5" />
            Practical expectations
          </div>
          <h2 className="mb-5 text-3xl text-[color:var(--ink)]">Known constraints</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: 'Large files',
                text: 'Very large PDFs and OCR-heavy jobs can be slow because they are limited by browser memory and CPU.'
              },
              {
                title: 'Font fidelity',
                text: 'Text-driven transforms preserve core structure, but unusual embedded fonts can still vary between viewers.'
              },
              {
                title: 'Scanned quality',
                text: 'OCR quality depends heavily on source resolution, skew, noise, and language model coverage.'
              },
              {
                title: 'Mobile ceilings',
                text: 'The redesign is mobile-optimized, but long multi-file editing sessions remain more comfortable on desktop.'
              }
            ].map((item) => (
              <div key={item.title} className="card p-5">
                <h3 className="mb-2 text-2xl text-[color:var(--ink)]">{item.title}</h3>
                <p className="text-sm leading-6 text-[color:var(--ink-muted)]">{item.text}</p>
              </div>
            ))}
          </div>

            <div className="mt-5 rounded-[24px] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--ink-muted)]">
              <Globe className="h-4 w-4" />
              Support line
            </div>
            <p className="text-sm leading-6 text-[color:var(--ink-muted)]">
              If a flow behaves unexpectedly, the fastest debugging path is: verify the source PDF loads in the viewer, reproduce with a smaller sample, then isolate whether the issue is file-specific, OCR-specific, or layout-specific.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
