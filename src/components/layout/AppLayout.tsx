import { NavLink, Outlet } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'

/**
 * 공통 레이아웃 (spec FR-002)
 * - 폭 768px 미만(폰): 위쪽 로고 + 아래쪽 탭 메뉴
 * - 폭 768px 이상(컴퓨터): 왼쪽 메뉴
 */
export default function AppLayout() {
  return (
    <div className="flex h-full">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 bg-slate-100/85 px-5 pt-3 pb-2 backdrop-blur-md md:hidden">
          <Logo />
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-3 pb-28 md:px-10 md:pt-10 md:pb-10">
          <Outlet />
        </main>
      </div>
      <BottomTabBar />
    </div>
  )
}

function Logo() {
  return <span className="text-insta text-[22px] font-black tracking-tight">TIDY:</span>
}

function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-white px-4 py-8 md:flex">
      <div className="mb-10 px-3">
        <Logo />
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold transition-colors ${
                isActive ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="size-5" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex rounded-t-3xl bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgb(25_31_40/0.06)] backdrop-blur-md md:hidden">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
              isActive ? 'text-brand-600' : 'text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className="size-6" strokeWidth={isActive ? 2.4 : 1.8} aria-hidden />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
