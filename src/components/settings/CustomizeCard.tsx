import { Check, Eye, ImagePlus, RotateCcw, Shuffle, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  DEFAULT_BACKGROUND,
  DEFAULT_CHECK,
  defaultSection,
  loadCustomization,
  saveCustomization,
  shrinkPhoto,
  type Customization,
} from '../../lib/customize'
import type { Section, Trio } from '../../lib/palette'
import { randomTheme } from '../../lib/sessionTheme'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import { useDraftStyles } from '../../hooks/useDraftStyles'
import CustomizePreview from './CustomizePreview'
import { themeFor } from '../layout/theme'

type Target = 'background' | Section | 'check'

const TARGETS: { key: Target; label: string; path: string }[] = [
  { key: 'background', label: '앱 배경', path: '/' },
  { key: 'main', label: '대시보드', path: '/' },
  { key: 'money', label: '가계부', path: '/money' },
  { key: 'todo', label: '할 일', path: '/todos' },
  { key: 'scrap', label: '스크랩', path: '/scraps' },
  { key: 'check', label: '체크 표시', path: '/todos' },
]

/**
 * 설정 > 꾸미기: 앱 배경과 구역마다 색(랜덤 / 고정), 사진, 투명도를 고른다.
 * 바꾼 내용은 [미리보기]로 먼저 보고, [적용하기]를 눌러야 화면에 들어가고 이 기기에 저장된다.
 */
export default function CustomizeCard() {
  const toast = useToast()
  const [saved, setSaved] = useState<Customization>(loadCustomization)
  // 아직 적용하지 않은 바꾼 내용
  const [custom, setCustom] = useState<Customization>(saved)
  const [target, setTarget] = useState<Target>('background')
  const [previewing, setPreviewing] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const card = useRef<HTMLElement>(null)
  // 이 카드 안(견본, 미리보기)에는 바꾼 내용을 바로 입혀서 보여 준다
  useDraftStyles(card, custom)
  const dirty = JSON.stringify(custom) !== JSON.stringify(saved)

  function apply() {
    try {
      saveCustomization(custom)
      setSaved(custom)
      setPreviewing(false)
      toast('꾸민 내용을 적용했어요')
    } catch {
      toast('저장 공간이 모자라요. 더 작은 사진을 골라 주세요', 'error')
    }
  }

  const bg = custom.background
  const sec = target === 'background' || target === 'check' ? null : custom.sections[target]
  const photo = target === 'background' ? bg.photo : (sec?.photo ?? null)
  const check = custom.check

  const setBg = (patch: Partial<Customization['background']>) => setCustom((c) => ({ ...c, background: { ...c.background, ...patch } }))
  const setSec = (s: Section, patch: Partial<Customization['sections'][Section]>) =>
    setCustom((c) => ({ ...c, sections: { ...c.sections, [s]: { ...c.sections[s], ...patch } } }))
  const setCheck = (patch: Partial<Customization['check']>) => setCustom((c) => ({ ...c, check: { ...c.check, ...patch } }))
  const setPhoto = (p: string | null) => (target === 'background' ? setBg({ photo: p }) : sec && setSec(target as Section, { photo: p }))

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
    else if (target === 'check') setCheck({ ...DEFAULT_CHECK })
    else setSec(target, defaultSection(randomTheme.sections[target].colors))
  }

  return (
    <section ref={card} className="card p-5">
      <h2 className="font-bold">꾸미기</h2>
      <p className="mb-4 text-sm text-slate-500">배경과 구역마다 색, 사진, 투명도를 골라요. 미리보기로 먼저 보고 적용할 수 있어요.</p>

      <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist">
        {TARGETS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={target === t.key}
            onClick={() => setTarget(t.key)}
            className={`${t.key === 'background' || t.key === 'check' ? 'theme-main' : themeFor(t.path)} min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${
              target === t.key ? 'bg-grad on-grad shadow-float' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {target === 'check' ? (
        <>
          <div
            className="theme-todo mb-2 flex items-center gap-4 rounded-2xl bg-slate-50 p-4"
          >
            {[true, false].map((done) => (
              <span key={String(done)} className="flex items-center gap-2 text-[15px] font-medium text-slate-800">
                <span className={`flex size-6 items-center justify-center rounded-full ${done ? 'bg-check' : 'border-2 border-slate-300 bg-white'}`}>
                  {done && <Check className="size-3.5" strokeWidth={3.5} aria-hidden />}
                </span>
                {done ? '다 한 일' : '아직 안 한 일'}
              </span>
            ))}
          </div>
          <Label>색</Label>
          <Segmented
            value={check.color}
            options={[
              ['section', '구역 색 그대로'],
              ['fixed', '내가 고른 색'],
            ]}
            onChange={(v) => setCheck({ color: v })}
          />
          <p className="mt-2 mb-1 text-xs text-slate-500">
            {check.color === 'fixed' ? '동그라미를 눌러 색깔표에서 골라요. 할 일과 습관 체크에 같이 쓰여요' : '할 일, 습관 화면의 그라데이션 색을 따라가요'}
          </p>
          {check.color === 'fixed' && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Swatch value={check.fixed} label="체크 표시 색" onChange={(v) => setCheck({ fixed: v })} />
              {QUICK_CHECK.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCheck({ fixed: c })}
                  className={`size-8 rounded-full ${check.fixed === c ? 'ring-2 ring-slate-400 ring-offset-2 ring-offset-white' : ''}`}
                  style={{ background: c }}
                  aria-label={`${c} 고르기`}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
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
              setSec(target as Section, v === 'fixed' && sec!.color !== 'fixed' ? { color: v, colors: randomTheme.sections[target as Section].colors } : { color: v })
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
          sec?.photo && (
            <Slider label="사진 투명도" value={sec!.clear} onChange={(v) => setSec(target as Section, { clear: v })} hint="0%면 사진이 또렷하게, 높일수록 그라데이션 색이 비쳐요" />
          )
        )}
        </>
      )}

      <button type="button" onClick={reset} className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
        <RotateCcw className="size-4" aria-hidden /> 이 항목 처음으로 되돌리기
      </button>

      {/* 적용 전에 미리보기 → 적용하기 */}
      <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" className="flex-1" onClick={() => setPreviewing(true)}>
          <Eye className="mr-1.5 inline size-4" aria-hidden />
          미리보기
        </Button>
        <Button className="flex-1" onClick={apply} disabled={!dirty}>
          적용하기
        </Button>
      </div>
      {dirty && (
        <p className="mt-2 flex items-center justify-between text-xs text-slate-500">
          아직 적용하지 않은 변경이 있어요
          <button type="button" onClick={() => setCustom(saved)} className="tap font-semibold text-slate-600 underline underline-offset-2">
            변경 취소
          </button>
        </p>
      )}

      <CustomizePreview open={previewing} custom={custom} dirty={dirty} onClose={() => setPreviewing(false)} onApply={apply} />
    </section>
  )
}

const QUICK_CHECK = ['#34c759', '#3182f6', '#ff8db8', '#9686ff', '#ffb020', '#191f28']

function Preview({ target }: { target: Target }) {
  if (target === 'background' || target === 'check') {
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
