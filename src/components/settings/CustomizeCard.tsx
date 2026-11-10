import { ImagePlus, RotateCcw, Shuffle, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_BACKGROUND,
  defaultSection,
  loadCustomization,
  saveCustomization,
  shrinkPhoto,
  type Customization,
} from '../../lib/customize'
import type { Section, Trio } from '../../lib/palette'
import { randomTheme } from '../../lib/sessionTheme'
import { useToast } from '../common/Toast'
import { themeFor } from '../layout/theme'

type Target = 'background' | Section

const TARGETS: { key: Target; label: string; path: string }[] = [
  { key: 'background', label: '앱 배경', path: '/' },
  { key: 'main', label: '대시보드', path: '/' },
  { key: 'money', label: '가계부', path: '/money' },
  { key: 'todo', label: '할 일', path: '/todos' },
  { key: 'scrap', label: '스크랩', path: '/scraps' },
]

/**
 * 설정 > 꾸미기: 앱 배경과 구역마다 색(랜덤 / 고정), 사진, 투명도를 고른다.
 * 바꾸면 바로 화면에 보이고 이 기기에 저장된다.
 */
export default function CustomizeCard() {
  const toast = useToast()
  const [custom, setCustom] = useState<Customization>(loadCustomization)
  const [target, setTarget] = useState<Target>('background')
  const fileInput = useRef<HTMLInputElement>(null)
  const first = useRef(true)

  // 슬라이더를 끄는 동안 너무 자주 저장하지 않도록 잠깐 기다렸다 저장
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => {
      try {
        saveCustomization(custom)
      } catch {
        toast('저장 공간이 모자라요. 더 작은 사진을 골라 주세요', 'error')
        setCustom(loadCustomization())
      }
    }, 150)
    return () => clearTimeout(t)
  }, [custom, toast])

  const bg = custom.background
  const sec = target === 'background' ? null : custom.sections[target]
  const photo = target === 'background' ? bg.photo : sec!.photo

  const setBg = (patch: Partial<Customization['background']>) => setCustom((c) => ({ ...c, background: { ...c.background, ...patch } }))
  const setSec = (s: Section, patch: Partial<Customization['sections'][Section]>) =>
    setCustom((c) => ({ ...c, sections: { ...c.sections, [s]: { ...c.sections[s], ...patch } } }))
  const setPhoto = (p: string | null) => (target === 'background' ? setBg({ photo: p }) : setSec(target, { photo: p }))

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    try {
      setPhoto(await shrinkPhoto(file))
    } catch {
      toast('사진을 열지 못했어요', 'error')
    }
  }

  function reset() {
    if (target === 'background') setBg({ ...DEFAULT_BACKGROUND })
    else setSec(target, defaultSection(randomTheme.sections[target].colors))
  }

  return (
    <section className="card p-5">
      <h2 className="font-bold">꾸미기</h2>
      <p className="mb-4 text-sm text-slate-500">배경과 구역마다 색, 사진, 투명도를 골라요. 바로 보이고 이 기기에 저장돼요.</p>

      <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist">
        {TARGETS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={target === t.key}
            onClick={() => setTarget(t.key)}
            className={`${t.key === 'background' ? 'theme-main' : themeFor(t.path)} min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${
              target === t.key ? 'bg-grad on-grad shadow-float' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 미리보기 */}
      <Preview target={target} />

      {/* 색 */}
      <Label>색</Label>
      {target === 'background' ? (
        <Segmented
          value={bg.color}
          options={[
            ['default', '기본'],
            ['random', '랜덤'],
            ['fixed', '고정'],
          ]}
          onChange={(v) => setBg({ color: v })}
        />
      ) : (
        <Segmented
          value={sec!.color}
          options={[
            ['random', '랜덤'],
            ['fixed', '고정'],
          ]}
          onChange={(v) =>
            setSec(target, v === 'fixed' && sec!.color !== 'fixed' ? { color: v, colors: randomTheme.sections[target].colors } : { color: v })
          }
        />
      )}
      <p className="mt-2 mb-1 flex items-center gap-1 text-xs text-slate-500">
        {(target === 'background' ? bg.color === 'random' : sec!.color === 'random') && (
          <>
            <Shuffle className="size-3.5" aria-hidden /> 앱을 켤 때마다 바뀌어요
          </>
        )}
        {target === 'background' && bg.color === 'default' && '회색 기본 바탕이에요'}
        {(target === 'background' ? bg.color === 'fixed' : sec!.color === 'fixed') && '동그라미를 눌러 색깔표에서 골라요'}
      </p>
      {target === 'background' && bg.color === 'fixed' && (
        <div className="mt-2 flex gap-3">
          <Swatch value={bg.fixed} label="배경 색" onChange={(v) => setBg({ fixed: v })} />
        </div>
      )}
      {sec?.color === 'fixed' && (
        <div className="mt-2 flex gap-3">
          {sec.colors.map((c, i) => (
            <Swatch
              key={i}
              value={c}
              label={`${i + 1}번째 색`}
              onChange={(v) => setSec(target as Section, { colors: sec.colors.map((x, j) => (j === i ? v : x)) as Trio })}
            />
          ))}
        </div>
      )}

      {/* 사진 */}
      <Label>사진</Label>
      <div className="flex items-center gap-3">
        {photo ? (
          <img src={photo} alt="고른 사진" className="size-14 rounded-2xl object-cover" />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <ImagePlus className="size-5" aria-hidden />
          </span>
        )}
        <button type="button" onClick={() => fileInput.current?.click()} className="min-h-10 rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700">
          {photo ? '사진 바꾸기' : '사진 고르기'}
        </button>
        {photo && (
          <button type="button" onClick={() => setPhoto(null)} className="tap rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="사진 지우기">
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pickPhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      {/* 투명도 */}
      {target === 'background' ? (
        <>
          {(bg.photo || bg.color !== 'default') && (
            <Slider label={bg.photo ? '사진 투명도' : '색 투명도'} value={bg.clear} onChange={(v) => setBg({ clear: v })} />
          )}
          <Slider label="카드 투명도" value={bg.cardClear} max={70} onChange={(v) => setBg({ cardClear: v })} hint="배경이 카드 뒤로 비쳐요" />
        </>
      ) : (
        sec!.photo && (
          <Slider label="사진 투명도" value={sec!.clear} onChange={(v) => setSec(target, { clear: v })} hint="0%면 사진이 또렷하게, 높일수록 그라데이션 색이 비쳐요" />
        )
      )}

      <button type="button" onClick={reset} className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
        <RotateCcw className="size-4" aria-hidden /> 처음으로 되돌리기
      </button>
    </section>
  )
}

function Preview({ target }: { target: Target }) {
  if (target === 'background') {
    return (
      <div className="mb-2 rounded-2xl bg-slate-100 bg-(image:--page-image) bg-cover bg-center p-4 ring-1 ring-slate-200">
        <div className="card p-3 text-sm font-semibold text-slate-700">카드는 이렇게 보여요</div>
      </div>
    )
  }
  const path = TARGETS.find((t) => t.key === target)!.path
  return (
    <div className={`${themeFor(path)} bg-grad on-grad mb-2 flex h-20 items-end rounded-2xl p-4 text-lg font-bold`}>
      {TARGETS.find((t) => t.key === target)!.label}
    </div>
  )
}

function Label({ children }: { children: string }) {
  return <p className="mt-5 mb-2 text-sm font-bold text-slate-700">{children}</p>
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`min-h-10 flex-1 rounded-xl text-sm font-semibold ${value === key ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** 동그란 색 버튼. 누르면 기기의 색깔표가 열린다 */
function Swatch({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  return (
    <label className="relative size-11 cursor-pointer rounded-full shadow-card ring-2 ring-white" style={{ background: value }}>
      <span className="sr-only">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
    </label>
  )
}

function Slider({ label, value, onChange, max = 100, hint }: { label: string; value: number; onChange: (v: number) => void; max?: number; hint?: string }) {
  return (
    <label className="mt-5 block">
      <span className="mb-1 flex items-center justify-between text-sm font-bold text-slate-700">
        {label}
        <span className="text-brand-600">{value}%</span>
      </span>
      <input type="range" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-(--color-brand-500)" />
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  )
}
