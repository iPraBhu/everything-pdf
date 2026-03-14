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
        <div className="glass-panel overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Link to="/" className="group flex items-center gap-3" onClick={() => setMobileOpen(false)}>
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[18px] border border-white/30 bg-[linear-gradient(135deg,rgba(212,93,66,0.16),rgba(15,159,155,0.18))] shadow-lg">
                  <BrandMark
                    className="h-9 w-9 transition-transform duration-300 group-hover:scale-105"
                    imageClassName="drop-shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
                  />
                </div>
                <div>
                  <div className="section-label mb-1">Paper Engine</div>
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
                    className={`group flex items-center gap-3 rounded-full px-4 py-2 transition-all ${
                      active
                        ? 'bg-[color:var(--ink)] text-[color:var(--bg-strong)] shadow-lg'
                        : 'text-[color:var(--ink-muted)] hover:bg-white/50 hover:text-[color:var(--ink)] dark:hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-semibold">{item.name}</span>
                    <span className={`text-[0.63rem] uppercase tracking-[0.24em] ${active ? 'text-white/70' : 'text-[color:var(--ink-muted)]'}`}>
                      {item.accent}
                    </span>
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--ink-muted)] md:flex dark:bg-white/5">
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
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between rounded-[20px] px-4 py-3 transition-all ${
                        active
                          ? 'bg-[color:var(--ink)] text-[color:var(--bg-strong)]'
                          : 'bg-white/50 text-[color:var(--ink)] dark:bg-white/5'
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
