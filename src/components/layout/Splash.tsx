import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isDark } from '../../lib/colorMode'
import { loadPhotos, photoSrc } from '../../lib/customPhotos'
import { basicSplashDelay, loadCustomization, splashPhoto } from '../../lib/customize'
import type { PhotoPalette } from '../../lib/photoPalette'
import { markSplashDone } from '../../lib/splashSignal'

// 앱을 켤 때 한 번만 (화면을 옮겨 다녀도 다시 안 나온다)
let shown = false

type SplashState = { kind: 'photo'; ref: string; seconds: number; palette?: PhotoPalette } | { kind: 'basic' }

function greeting(h: number) {
  if (h < 5) return '늦은 밤이에요'
  if (h < 11) return '좋은 아침이에요'
  if (h < 17) return '좋은 오후예요'
  if (h < 21) return '좋은 저녁이에요'
  return '오늘도 수고했어요'
}

/**
 * 기본 시작 화면 (사진이 없을 때): 그날 랜덤으로 고른 대시보드 색 그라데이션 위에 로고와 인사.
 * 1초쯤 보여 주고 넘어가고, 누르면 바로 넘어간다.
 */
function BasicSplash({ leaving, onSkip }: { leaving: boolean; onSkip: () => void }) {
  const [now] = useState(() => new Date())
  const date = now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
  return (
    <div
      className={`theme-main on-grad fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center px-6 transition-opacity duration-300 ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      style={{ background: 'var(--grad)' }}
      onClick={onSkip}
      role="presentation"
    >
      <div className="animate-splash-pop flex flex-col items-center text-center">
        <p className="text-[56px] leading-none font-black tracking-tight">TIDY:</p>
        <p className="mt-3 text-sm font-semibold opacity-80">가계부 · 할 일 · 스크랩</p>
      </div>
      <div className="animate-splash-pop absolute bottom-[calc(2.5rem+env(safe-area-inset-bottom))] text-center [animation-delay:150ms]">
        <p className="text-base font-bold">{greeting(now.getHours())}</p>
        <p className="mt-0.5 text-xs font-semibold opacity-75">{date}</p>
      </div>
    </div>
  )
}

/**
 * 시작 화면 (꾸미기 > 시작 화면에서 사진을 넣었을 때. 사진이 없으면 기본 시작 화면)
 * 사진은 가로 폭에 맞춰 잘리지 않게 보여 주고, 남는 곳은 사진에서 뽑은 바탕색으로 채운다.
 * 정한 시간이 지나면 저절로 넘어가고, 아무 데나 누르면 바로 넘어간다.
 */
export default function Splash() {
  const location = useLocation()
  const [splash] = useState<SplashState | null>(() => {
    if (shown || location.pathname.startsWith('/share')) return null
    const c = loadCustomization()
    const ref = splashPhoto(c)
    if (!ref && !c.splash.basic) return null
    shown = true
    return ref ? { kind: 'photo', ref, seconds: c.splash.seconds, palette: c.splash.palettes[ref] } : { kind: 'basic' }
  })
  const state = splash?.kind === 'photo' ? splash : null
  const [src, setSrc] = useState<string | undefined>(() => (state ? photoSrc(state.ref) : undefined))
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(!splash)

  // 사진을 보관함에서 읽는다. 못 읽으면 바로 넘어간다
  useEffect(() => {
    if (!state || src) return
    loadPhotos([state.ref])
      .then(() => {
        const s = photoSrc(state.ref)
        if (s) setSrc(s)
        else setLeaving(true)
      })
      .catch(() => setLeaving(true))
  }, [state, src])

  // 기본 시작 화면은 짧게: 앱을 누른 때부터 1.1초까지 (앱을 읽느라 걸린 시간만큼 줄인다)
  useEffect(() => {
    if (splash?.kind !== 'basic' || leaving) return
    const t = setTimeout(() => setLeaving(true), basicSplashDelay(performance.now()))
    return () => clearTimeout(t)
  }, [splash, leaving])

  // 사진이 뜬 뒤부터 시간을 잰다 (사진이 너무 늦게 뜨면 3초 뒤에는 넘어간다)
  useEffect(() => {
    if (!state || leaving) return
    const t = setTimeout(() => setLeaving(true), ready ? state.seconds * 1000 : 3000)
    return () => clearTimeout(t)
  }, [state, ready, leaving])

  // 시작 화면이 없거나 넘어가기 시작하면 알린다 (잠금 화면의 지문 창이 이때 뜬다)
  useEffect(() => {
    if (!splash || leaving) markSplashDone()
  }, [splash, leaving])

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => setGone(true), 300)
    return () => clearTimeout(t)
  }, [leaving])

  if (gone || !splash) return null
  if (splash.kind === 'basic') return <BasicSplash leaving={leaving} onSkip={() => setLeaving(true)} />
  if (!state) return null
  const dark = isDark()
  const bg = !dark && state.palette ? state.palette.bg : undefined
  const trio = state.palette?.colors

  return (
    <div
      className={`fixed inset-0 z-[60] flex cursor-pointer flex-col bg-slate-100 transition-opacity duration-300 ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      style={bg ? { backgroundColor: bg } : undefined}
      onClick={() => setLeaving(true)}
    >
      <div className="relative flex min-h-0 flex-1 items-start justify-center overflow-hidden">
        {src && (
          <img
            src={src}
            alt=""
            onLoad={() => setReady(true)}
            onError={() => setLeaving(true)}
            className={`max-h-full w-full object-contain object-top transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
      </div>
      <div className="shrink-0 px-6 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
        <p
          className="text-[32px] font-black tracking-tight text-transparent"
          style={{ backgroundImage: `linear-gradient(120deg, ${trio ? trio.join(', ') : 'var(--main-c1), var(--main-c2), var(--main-c3)'})`, WebkitBackgroundClip: 'text', backgroundClip: 'text' }}
        >
          TIDY:
        </p>
        <p className="text-xs font-semibold text-slate-500">가계부 · 할 일 · 스크랩</p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setLeaving(true)
        }}
        className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-4 rounded-full bg-white/75 px-3.5 py-1.5 text-[13px] font-bold text-slate-700 shadow-card backdrop-blur"
      >
        건너뛰기
      </button>
    </div>
  )
}
