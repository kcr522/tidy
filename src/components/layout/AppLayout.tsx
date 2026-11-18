import { useLiveQuery } from 'dexie-react-hooks'
import { Suspense, useEffect } from 'react'
import { Search, Settings } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useToday } from '../../hooks/useToday'
import { prefetchPages } from '../../lib/lazyPage'
import { useWidgetSync } from '../../hooks/useWidgetSync'
import { useBudgetAlerts } from '../../hooks/useBudgetAlerts'
import { useAutoBackup } from '../../hooks/useAutoBackup'
import { useDeviceCalendarSync } from '../../hooks/useDeviceCalendarSync'
import { useGoogleCalendarSync } from '../../hooks/useGoogleCalendarSync'
import { useGooglePush } from '../../hooks/useGooglePush'
import { syncAlarms } from '../../platform/alarms'
import { loadPayFilter, onPayFilterChange } from '../../lib/payNotifyFilter'
import { listenPayNotify, syncPayNotifyFilter } from '../../platform/payNotify'
import { listenForShares } from '../../platform/shareIntent'
import { listenForWidgetRoutes } from '../../platform/widgetRoute'
import { syncTodoAlarms } from '../../platform/todoAlarms'
import { habitRepo } from '../../repositories/habitRepo'
import { recurringRepo } from '../../repositories/recurringRepo'
import { savingsRepo } from '../../repositories/savingsRepo'
import { todoRepo } from '../../repositories/todoRepo'
import ColorModeButton from '../common/ColorModeButton'
import AskAmountPrompt from '../transactions/AskAmountPrompt'
import { useToast } from '../common/Toast'
import { NAV_ITEMS } from './navItems'
import { themeFor } from './theme'

/**
 * 공통 레이아웃 (spec FR-002)
 * - 폭 768px 미만(폰): 위쪽 로고 + 아래쪽 탭 메뉴
 * - 폭 768px 이상(컴퓨터): 왼쪽 메뉴
 */
export default function AppLayout() {
  // 지금 보고 있는 구역의 색 (가계부: 하늘, 할 일: 민트, 스크랩: 라벤더)
  const theme = themeFor(useLocation().pathname)
  const today = useToday()
  const toast = useToast()
  const navigate = useNavigate()

  // 안드로이드 앱: 인스타그램·X 에서 "공유 → Tidy" 로 들어온 링크를 스크랩 저장 창으로
  useEffect(() => listenForShares((path) => navigate(path)), [navigate])

  // 안드로이드 앱: 홈 화면 위젯에서 누른 곳으로 (메모 위젯의 메모 하나, 새 메모)
  useEffect(() => listenForWidgetRoutes((path) => navigate(path)), [navigate])
  // 안드로이드 앱: "가계부에 기록할까요?" 알림을 누르면 가계부의 결제 알림 확인 화면으로
  useEffect(
    () =>
      listenPayNotify(
        () => undefined,
        () => navigate('/money', { state: { payNotify: true } }),
      ),
    [navigate],
  )
  // 기록하지 않을 알림 규칙을 폰 쪽에도 맞춰 둔다 (켤 때 + 바꿀 때)
  useEffect(() => {
    const sync = () => void syncPayNotifyFilter(loadPayFilter())
    sync()
    return onPayFilterChange(sync)
  }, [])

  // 앱을 켜거나 날짜가 바뀌면 오늘까지의 정기 내역을 가계부에 기록한다
  useEffect(() => {
    recurringRepo
      .runDue(today)
      .then((n) => n > 0 && toast(`정기 내역 ${n}건을 가계부에 기록했어요`))
      .catch(() => toast('정기 내역을 기록하지 못했어요', 'error'))
    // 자동이체 적금도 넣는 날 가계부에 기록한다
    savingsRepo
      .runDue(today)
      .then((n) => n > 0 && toast(`적금 납입 ${n}건을 가계부에 기록했어요`))
      .catch(() => toast('적금 납입을 기록하지 못했어요', 'error'))
  }, [today, toast])

  // 적금 알림: 적금이나 오늘 체크가 바뀌면 다시 맞춘다
  const plans = useLiveQuery(() => savingsRepo.list(), [])
  const todayChecks = useLiveQuery(async () => (await habitRepo.allChecks()).filter((c) => c.date === today).map((c) => c.habitId).join(','), [today])
  useEffect(() => {
    if (!plans || todayChecks === undefined) return
    const done = new Set(todayChecks.split(',').filter(Boolean).map(Number))
    return syncAlarms(plans, (p) => p.habitId != null && done.has(p.habitId), (text) => toast(text))
  }, [plans, todayChecks, today, toast])

  // 할 일 알림: 할 일이 바뀌면(추가, 시간 변경, 완료) 다시 맞춘다
  const todos = useLiveQuery(() => todoRepo.listAll(), [])
  useEffect(() => {
    if (!todos) return
    return syncTodoAlarms(todos, (text) => toast(text))
  }, [todos, today, toast])

  // 갤럭시 홈 화면 위젯에 오늘 할 일과 지출을 보낸다
  useWidgetSync(todos, today)

  // 이번 달 예산의 80%를 쓰거나 넘으면 알려 준다
  useBudgetAlerts(today, toast)

  // 자동 백업 (폰 앱: 때가 되면 조용히 파일로 저장)
  useAutoBackup(today)

  // 구글 캘린더를 연결했으면 가끔 새로 가져온다
  useGoogleCalendarSync(today)

  // 구글 계정을 연결했으면 Tidy 일정과 할 일이 바뀔 때마다 구글 캘린더에 보낸다
  useGooglePush()

  // 삼성 캘린더(폰 캘린더) 연동을 켰으면 폰 일정을 가져오고, Tidy 일정을 폰 Tidy 캘린더에 넣는다 (폰 앱만)
  useDeviceCalendarSync(today)

  // 첫 화면이 뜬 뒤 쉬는 틈에 다른 화면들을 미리 읽어 둔다
  useEffect(() => prefetchPages(), [])
  return (
    <div className={`flex h-full ${theme}`}>
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-slate-100/85 px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 backdrop-blur-md short:pt-[calc(0.375rem+env(safe-area-inset-top))] short:pb-1 md:hidden">
          <Logo />
          <div className="flex items-center gap-1">
            <Link to="/search" className="tap rounded-full p-1.5 text-slate-500" aria-label="검색">
              <Search className="size-[22px]" aria-hidden />
            </Link>
            <ColorModeButton />
            <Link to="/settings" className="tap rounded-full p-1.5 text-slate-500" aria-label="설정">
              <Settings className="size-[22px]" aria-hidden />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-3 pb-28 short:pb-20 md:px-6 md:pt-[calc(2.5rem+env(safe-area-inset-top))] md:pb-10 short:md:pt-[calc(1.5rem+env(safe-area-inset-top))] lg:px-10">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomTabBar />
      {/* 금액이 일정하지 않은 월급 등: 그날이 되면 "월급을 입력해주세요" */}
      <AskAmountPrompt today={today} />
    </div>
  )
}

function Logo() {
  return <span className="text-logo text-[22px] font-black tracking-tight">TIDY:</span>
}

function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col overflow-y-auto bg-white px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-8 short:pt-[calc(1rem+env(safe-area-inset-top))] short:pb-4 md:flex lg:w-60">
      <div className="mb-10 flex short:mb-4 items-center justify-between pl-3">
        <Logo />
        <ColorModeButton className="bg-slate-100 hover:bg-slate-200" />
      </div>
      {/* 전체 검색: 가계부·할 일·일기·스크랩·메모에서 찾기 */}
      <Link to="/search" className="mb-4 flex items-center gap-2 rounded-2xl bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-200">
        <Search className="size-4" aria-hidden />
        검색
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `${themeFor(item.to)} flex items-center gap-3 rounded-2xl px-2.5 py-2 text-[15px] font-semibold transition-colors ${
                isActive ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex size-8 items-center justify-center rounded-xl ${isActive ? 'bg-grad on-grad' : ''}`}>
                  <item.icon className="size-[18px]" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                </span>
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
      {NAV_ITEMS.filter((item) => item.to !== '/settings').map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `${themeFor(item.to)} flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold whitespace-nowrap transition-colors short:min-h-12 ${
              isActive ? 'text-brand-600' : 'text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`flex h-8 w-11 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-grad on-grad' : ''}`}>
                <item.icon className="size-[22px]" strokeWidth={isActive ? 2.3 : 1.8} aria-hidden />
              </span>
              {/* 낮은 창에서는 글자를 빼고 아이콘만 (aria-label 로 이름은 남긴다) */}
              <span className="short:sr-only">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/** 화면 조각을 처음 읽는 잠깐 동안 (보통 눈에 안 띌 만큼 짧다) */
function PageLoading() {
  return (
    <div className="flex justify-center pt-24" role="status" aria-label="불러오는 중">
      <span className="size-6 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
    </div>
  )
}
