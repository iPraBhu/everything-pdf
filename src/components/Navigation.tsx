import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Wrench, PanelsTopLeft, CircleHelp, Moon, Sun, Monitor, Menu, X, ArrowUpRight } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { BrandMark } from './BrandMark'

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const

const navItems = [
  { name: 'Home', path: '/', icon: Home, accent: 'Dust' },
  { name: 'Tools', path: '/tools', icon: Wrench, accent: 'Forge' },
  { name: 'Editor', path: '/editor', icon: PanelsTopLeft, accent: 'Studio' },
  { name: 'Help', path: '/help', icon: CircleHelp, accent: 'Guide' },
]

export function Navigation() {
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const ThemeIcon = themeIcons[theme]

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    setTheme(themes[(currentIndex + 1) % themes.length])
  }

  return (
    <header className="relative z-20 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="glass-panel overflow-hidden border-[color:var(--line-strong)]">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Link to="/" className="group flex items-center gap-3" onClick={() => setMobileOpen(false)}>
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[16px] border border-[color:var(--line)] bg-[color:var(--bg-strong)] shadow-sm">
                  <BrandMark
                    className="h-9 w-9 transition-transform duration-300 group-hover:scale-105"
                    imageClassName="drop-shadow-[0_6px_16px_rgba(0,0,0,0.12)]"
                  />
                </div>
                <div>
                  <div className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
                    Local PDF workspace
                  </div>
                  <div className="text-lg font-semibold text-[color:var(--ink)] sm:text-xl">
                    Free Everything PDF
                  </div>
                </div>
              </Link>
            </div>

            <nav className="hidden items-center gap-2 lg:flex">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex items-center gap-3 rounded-full border px-4 py-2 transition-all ${
                      active
                        ? 'border-[rgba(178,75,48,0.28)] bg-[color:var(--bg-strong)] text-[color:var(--ink)] shadow-sm'
                        : 'border-transparent text-[color:var(--ink-muted)] hover:border-[color:var(--line)] hover:bg-[color:var(--bg-strong)] hover:text-[color:var(--ink)]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-[color:var(--accent)]' : ''}`} />
                    <span className="text-sm font-semibold">{item.name}</span>
                    <span className={`text-[0.63rem] uppercase tracking-[0.24em] ${active ? 'text-[color:var(--accent)]' : 'text-[color:var(--ink-muted)]'}`}>
                      {item.accent}
                    </span>
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-strong)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--ink-muted)] md:flex">
                Client-Side
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>

              <button
                onClick={cycleTheme}
                className="btn btn-secondary h-11 w-11 rounded-full p-0"
                title={`Current theme: ${theme}. Click to cycle.`}
              >
                <ThemeIcon className="h-5 w-5" />
              </button>

              <button
                onClick={() => setMobileOpen((value) => !value)}
                className="btn btn-secondary h-11 w-11 rounded-full p-0 lg:hidden"
                aria-label="Toggle navigation"
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {mobileOpen && (
            <div className="border-t border-[color:var(--line)] px-4 pb-4 pt-2 lg:hidden">
              <div className="grid gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const active = location.pathname === item.path
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between rounded-[20px] px-4 py-3 transition-all ${
                        active
                          ? 'border border-[rgba(178,75,48,0.28)] bg-[color:var(--bg-strong)] text-[color:var(--ink)]'
                          : 'border border-[color:var(--line)] bg-[color:var(--bg-strong)] text-[color:var(--ink)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <span className="font-semibold">{item.name}</span>
                      </div>
                      <span className={`text-[0.65rem] uppercase tracking-[0.24em] ${active ? 'text-white/70' : 'text-[color:var(--ink-muted)]'}`}>
                        {item.accent}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
