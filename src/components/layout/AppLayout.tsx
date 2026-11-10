import { NavLink, Outlet } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'

/**
 * 공통 레이아웃 (spec FR-002)
 * - 폭 768px 미만(폰): 위쪽 제목 + 아래쪽 탭 메뉴
 * - 폭 768px 이상(컴퓨터): 왼쪽 메뉴
 */
export default function AppLayout() {
  return (
    <div className="flex h-full">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <Logo />
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-8">
          <Outlet />
        </main>
      </div>
      <BottomTabBar />
    </div>
  )
}

function Logo() {
  return (
    <span className="text-xl font-extrabold tracking-tight text-brand-700">
      TIDY<span className="text-brand-500">:</span>
    </span>
  )
}

function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-6 md:flex">
      <div className="mb-8 px-3">
        <Logo />
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-brand-700' : 'text-slate-500'
            }`
          }
        >
          <span aria-hidden className="text-lg leading-none">
            {item.icon}
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
