import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isDark } from '../../lib/colorMode'
import { loadPhotos, photoSrc } from '../../lib/customPhotos'
import { basicSplashDelay, loadCustomization, splashPhoto, type SplashLogoFx, type SplashLogoPos } from '../../lib/customize'
import type { PhotoPalette } from '../../lib/photoPalette'
import { markSplashDone } from '../../lib/splashSignal'

// 앱을 켤 때 한 번만 (화면을 옮겨 다녀도 다시 안 나온다)
let shown = false

type SplashState = { kind: 'photo'; ref: string; seconds: number; palette?: PhotoPalette; logoPos: SplashLogoPos; logoClear: number; logoFx: SplashLogoFx } | { kind: 'basic' }

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
 * 사진은 화면을 꽉 채운다 (테두리 없이, 넘치는 쪽만 잘린다). TIDY: 로고는 사진 위에 겹쳐서
 * 고른 자리(위 · 가운데 · 아래)에 고른 투명도로 올린다. 사진 크기와 상관없이 로고 자리는 그대로다.
 * 로고는 고른 효과(기본 빛 지나가기)로 사진이 뜬 뒤 나타나서, 넘어가기 전에 사라진다 (src/index.css logo-fx-*).
 * 정한 시간이 지나면 저절로 넘어가고, 아무 데나 누르면 바로 넘어간다.
 */
export default function Splash() {
  const location = useLocation()
  const [splash] = useState<SplashState | null>(() => {
    if (shown || location.pathname.startsWith('/share') || location.pathname.startsWith('/widget')) return null
    const c = loadCustomization()
    const ref = splashPhoto(c)
    if (!ref && !c.splash.basic) return null
    shown = true
    return ref ? { kind: 'photo', ref, seconds: c.splash.seconds, palette: c.splash.palettes[ref], logoPos: c.splash.logoPos, logoClear: c.splash.logoClear, logoFx: c.splash.logoFx } : { kind: 'basic' }
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
  const colors = trio ? trio.join(', ') : 'var(--main-c1), var(--main-c2), var(--main-c3)'
  // 빛 지나가기: 그라데이션 가운데에 흰 빛을 넣고 위치를 옮긴다
  const logoText: React.CSSProperties = {
    backgroundImage: state.logoFx === 'shine' ? `linear-gradient(120deg, ${colors}, #fff 50%, ${trio ? trio[2] : 'var(--main-c3)'} 60%, ${trio ? trio[2] : 'var(--main-c3)'})` : `linear-gradient(120deg, ${colors})`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
  }

  return (
    <div
      className={`fixed inset-0 z-[60] cursor-pointer overflow-hidden bg-slate-100 transition-opacity duration-300 ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      style={bg ? { backgroundColor: bg } : undefined}
      onClick={() => setLeaving(true)}
    >
      {src && (
        <img
          src={src}
          alt=""
          onLoad={() => setReady(true)}
          onError={() => setLeaving(true)}
          className={`absolute inset-0 size-full object-cover object-center transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {state.logoPos !== 'hide' && (
        <div
          className={`pointer-events-none absolute inset-x-0 px-6 text-center ${
            state.logoPos === 'top'
              ? 'top-[calc(4.5rem+env(safe-area-inset-top))]'
              : state.logoPos === 'bottom'
                ? 'bottom-[calc(2.5rem+env(safe-area-inset-bottom))]'
                : 'top-1/2 -translate-y-1/2'
          }`}
          style={{ opacity: 1 - state.logoClear / 100 }}
        >
          <div
            className={ready && state.logoFx !== 'none' ? `logo-fx-${state.logoFx}` : ready ? '' : 'opacity-0'}
            style={{ '--fx-dur': `${state.seconds}s` } as React.CSSProperties}
          >
            <p className="text-[56px] leading-none font-black tracking-tight" style={{ filter: 'drop-shadow(0 1px 6px rgb(0 0 0 / 0.25))' }}>
              {state.logoFx === 'letters' ? (
                'TIDY:'.split('').map((ch, i) => (
                  <span key={i} className="logo-letter text-transparent" style={{ ...logoText, animationDelay: `${i * 0.08}s` }}>
                    {ch}
                  </span>
                ))
              ) : (
                <span className="logo-word text-transparent" style={logoText}>
                  TIDY:
                </span>
              )}
            </p>
            <p className="logo-sub mt-3 text-sm font-semibold text-white [text-shadow:0_1px_4px_rgb(0_0_0/0.45)]">가계부 · 할 일 · 스크랩</p>
          </div>
        </div>
      )}
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
