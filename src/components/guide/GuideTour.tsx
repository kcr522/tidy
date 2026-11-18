import { BellRing, BookHeart, Bookmark, CalendarDays, ChevronLeft, ChevronRight, CreditCard, Fingerprint, House, ImagePlus, LayoutGrid, ListChecks, MessageCircle, Palette, Plus, Repeat, Search, Share2, Sparkles, Wallet, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAccount } from '../../hooks/useAccount'
import { guideSeen, markGuideSeen, onOpenGuide } from '../../lib/guide'
import { isDeskWidget } from '../../platform/deskWidget'

interface Tip {
  icon: LucideIcon
  text: string
}

interface Step {
  icon: LucideIcon
  title: string
  desc: string
  tips: Tip[]
  /** 이 화면 열기 */
  to?: string
}

/** 가이드 장면들 (그림 파일 없이 아이콘과 글로만 → 앱 크기가 늘지 않는다) */
export const GUIDE_STEPS: Step[] = [
  {
    icon: House,
    title: 'TIDY:에 오신 걸 환영해요',
    desc: '가계부 · 할 일 · 스크랩을 한곳에서 정리하는 앱이에요. 1분이면 다 둘러볼 수 있어요.',
    tips: [
      { icon: LayoutGrid, text: '아래 탭(컴퓨터는 왼쪽 메뉴)으로 화면을 옮겨요' },
      { icon: House, text: '대시보드에서 오늘 할 일 · 이번 달 지출 · 습관을 한눈에 봐요' },
      { icon: Search, text: '위쪽 돋보기로 모든 기록을 한 번에 찾아요' },
    ],
  },
  {
    icon: Wallet,
    title: '가계부',
    desc: '쓴 돈과 들어온 돈을 적고, 달력과 차트로 모아 봐요.',
    to: '/money',
    tips: [
      { icon: Plus, text: '"+ 추가"로 금액 · 분류 · 결제 수단(카드 · 계좌)을 적어요' },
      { icon: ImagePlus, text: '은행 캡처나 음식 사진을 올리면 금액과 가게를 알아서 채워요' },
      { icon: BellRing, text: '안드로이드 앱은 카드 결제 알림을 읽어서 바로 기록해 줘요 (설정 > 결제 알림)' },
      { icon: CreditCard, text: '메뉴에서 월 예산 · 고정 금액 · 적금도 관리해요' },
    ],
  },
  {
    icon: ListChecks,
    title: '할 일 · 습관',
    desc: '해야 할 일을 적고 끝나면 체크해요.',
    to: '/todos',
    tips: [
      { icon: BellRing, text: '날짜와 시간을 정하면 그 시간에 알려 줘요' },
      { icon: Repeat, text: '매일 · 매주 반복하는 할 일도 만들 수 있어요' },
      { icon: House, text: '습관은 대시보드에서 하루 한 번씩 체크해요' },
    ],
  },
  {
    icon: Bookmark,
    title: '스크랩',
    desc: '나중에 볼 글 · 영상 · 인스타 · X 게시물을 모아 둬요.',
    to: '/scraps',
    tips: [
      { icon: Plus, text: '"+ 링크 저장"에 주소를 붙여 넣어요' },
      { icon: Share2, text: '폰에서는 다른 앱의 "공유"에서 TIDY:를 고르면 바로 저장돼요' },
      { icon: Sparkles, text: 'AI가 내용을 읽고 요약과 카테고리를 붙여 줘요' },
    ],
  },
  {
    icon: CalendarDays,
    title: '캘린더 · 일기',
    desc: '일정과 하루 기록을 날짜별로 남겨요.',
    to: '/calendar',
    tips: [
      { icon: CalendarDays, text: '날짜를 눌러 일정을 넣고, 색 · 스티커로 꾸며요 (공휴일은 저절로)' },
      { icon: Repeat, text: '설정에서 구글 · 삼성 캘린더와 연결할 수 있어요' },
      { icon: BookHeart, text: '일기는 1시간마다 칸이 있는 시간별 보기로도 써요. 형광펜 · 글 색 · 손글씨도 돼요' },
    ],
  },
  {
    icon: Sparkles,
    title: 'AI 비서',
    desc: '대시보드 오른쪽 아래 반짝이 버튼을 눌러요.',
    to: '/',
    tips: [
      { icon: MessageCircle, text: '"이번 달 식비 얼마야?", "내일 일정 알려 줘"처럼 물어봐요' },
      { icon: Plus, text: '"점심 김밥 4500원", "금요일 7시 저녁 약속"처럼 보내면 가계부 · 캘린더에 기록해 줘요' },
      { icon: Sparkles, text: '무료로 쓰고, 하루에 쓸 수 있는 횟수가 정해져 있어요' },
    ],
  },
  {
    icon: Palette,
    title: '내 마음대로 꾸미기',
    desc: '설정에서 TIDY:를 내 폰에 맞게 바꿔요.',
    to: '/settings',
    tips: [
      { icon: Palette, text: '꾸미기: 화면마다 사진 · 색 · 시작 화면을 바꿔요' },
      { icon: LayoutGrid, text: '홈 화면 위젯으로 달력 · 할 일을 바로 봐요' },
      { icon: Fingerprint, text: '앱 잠금(비밀번호 · 지문)과 자동 백업도 켤 수 있어요' },
    ],
  },
]

/**
 * 처음 켰을 때 한 번 나오는 사용 가이드 (넘겨 보는 카드).
 * 시작 화면(z-60) · 잠금(z-55) · 로그인(z-50) 아래(z-45)에 깔려서, 그 화면들이 다 지나간 뒤에 보인다.
 * 건너뛰거나 끝까지 보면 다시 안 나오고, 설정 > 사용 가이드에서 다시 볼 수 있다.
 */
export default function GuideTour() {
  const location = useLocation()
  const navigate = useNavigate()
  const account = useAccount()
  const [open, setOpen] = useState(() => !guideSeen() && !isDeskWidget())
  const [i, setI] = useState(0)
  const touch = useRef<number | null>(null)

  useEffect(
    () =>
      onOpenGuide(() => {
        setI(0)
        setOpen(true)
      }),
    [],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, GUIDE_STEPS.length - 1))
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
      else if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // 공유로 들어온 화면이나 위젯 창에서는 띄우지 않고, 로그인 상태를 확인하는 동안에는 기다린다 (로그인 화면이 뜨기 전에 번쩍이지 않게)
  const hidden = location.pathname.startsWith('/share') || location.pathname.startsWith('/widget') || (account.available && account.checking)
  if (!open || hidden) return null

  const step = GUIDE_STEPS[i]
  const last = i === GUIDE_STEPS.length - 1
  const Icon = step.icon

  function close() {
    markGuideSeen()
    setOpen(false)
  }

  function go(to: string) {
    close()
    navigate(to)
  }

  return (
    <div className="fixed inset-0 z-[45] flex items-end justify-center bg-black/45 backdrop-blur-[2px] md:items-center md:p-6" role="dialog" aria-modal="true" aria-label="사용 가이드">
      <div
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-xl md:max-w-md md:rounded-3xl"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return
          const dx = e.changedTouches[0].clientX - touch.current
          touch.current = null
          if (dx < -50 && !last) setI(i + 1)
          else if (dx > 50 && i > 0) setI(i - 1)
        }}
      >
        <div className="theme-main on-grad relative shrink-0 px-6 pt-6 pb-7 text-center" style={{ background: 'var(--grad)' }}>
          <button type="button" onClick={close} className="absolute top-3 right-3 flex min-h-9 items-center gap-1 rounded-full bg-white/20 px-3 text-sm font-bold hover:bg-white/30" aria-label="가이드 건너뛰기">
            {last ? <X className="size-4" strokeWidth={2.5} aria-hidden /> : '건너뛰기'}
          </button>
          <span key={i} className="animate-splash-pop mx-auto mt-3 flex size-16 items-center justify-center rounded-[22px] bg-white/25 shadow-lg shadow-black/10">
            <Icon className="size-8" strokeWidth={2.2} aria-hidden />
          </span>
          <p className="mt-4 text-xs font-bold opacity-80">
            {i + 1} / {GUIDE_STEPS.length}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight break-keep">{step.title}</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm font-semibold break-keep opacity-90">{step.desc}</p>
        </div>

        <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 pt-5 pb-2">
          {step.tips.map((t) => (
            <li key={t.text} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-3.5 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad-soft text-brand-600">
                <t.icon className="size-4.5" aria-hidden />
              </span>
              <span className="pt-1 text-[15px] leading-snug break-keep text-slate-700">{t.text}</span>
            </li>
          ))}
          {step.to && (
            <li>
              <button type="button" onClick={() => go(step.to!)} className="tap mt-1 w-full rounded-2xl py-2 text-sm font-bold text-brand-600 hover:bg-brand-50">
                이 화면 바로 열기 →
              </button>
            </li>
          )}
        </ul>

        <div className="shrink-0 px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5">
          <div className="mb-4 flex justify-center gap-1.5" role="tablist" aria-label="가이드 장면">
            {GUIDE_STEPS.map((s, n) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={n === i}
                aria-label={`${n + 1}번째: ${s.title}`}
                onClick={() => setI(n)}
                className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-brand-600' : 'w-2 bg-slate-200 hover:bg-slate-300'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && (
              <button type="button" onClick={() => setI(i - 1)} className="tap flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 px-4 font-bold text-slate-600 hover:bg-slate-200" aria-label="이전">
                <ChevronLeft className="size-5" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? close() : setI(i + 1))}
              className="bg-grad on-grad tap flex min-h-12 flex-1 items-center justify-center gap-1 rounded-2xl text-base font-extrabold shadow-float active:scale-[0.98]"
            >
              {last ? '시작하기' : '다음'}
              {!last && <ChevronRight className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
