import { Check, Eye, ImagePlus, Palette, Plus, RotateCcw, Shuffle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { loadPhotos, photoSrc, prunePhotos, storePhoto } from '../../lib/customPhotos'
import {
  DEFAULT_BACKGROUND,
  DEFAULT_CHECK,
  DEFAULT_SPLASH,
  defaultSection,
  loadCustomization,
  MAX_PHOTOS,
  photoRefs,
  saveCustomization,
  shrinkPhoto,
  SPLASH_LOGO_CLEAR_MAX,
  SPLASH_LOGO_POS,
  SPLASH_SECONDS,
  type Customization,
} from '../../lib/customize'
import type { Section, Trio } from '../../lib/palette'
import { paletteFromBlob, type PhotoPalette } from '../../lib/photoPalette'
import { randomTheme } from '../../lib/sessionTheme'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import { useDraftStyles } from '../../hooks/useDraftStyles'
import CustomizePreview from './CustomizePreview'
import { themeFor } from '../layout/theme'

type Target = 'background' | Section | 'check' | 'splash'

const TARGETS: { key: Target; label: string; path: string }[] = [
  { key: 'background', label: '앱 배경', path: '/' },
  { key: 'main', label: '대시보드', path: '/' },
  { key: 'money', label: '가계부', path: '/money' },
  { key: 'todo', label: '할 일', path: '/todos' },
  { key: 'scrap', label: '스크랩', path: '/scraps' },
  { key: 'check', label: '체크 표시', path: '/todos' },
  { key: 'splash', label: '시작 화면', path: '/' },
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
  const [adding, setAdding] = useState(false)
  // 보관함에 있는 사진을 읽어서 작은 사진(썸네일)을 보여 준다
  const [, setLoaded] = useState(0)
  useEffect(() => {
    void loadPhotos(photoRefs(saved)).then(() => setLoaded((n) => n + 1))
  }, [saved])

  function apply() {
    try {
      saveCustomization(custom)
      setSaved(custom)
      setPreviewing(false)
      toast('꾸민 내용을 적용했어요')
      // 지운 사진은 보관함에서도 지운다
      void prunePhotos(photoRefs(custom)).catch(() => {})
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  const bg = custom.background
  const sec = target === 'background' || target === 'check' || target === 'splash' ? null : custom.sections[target]
  const splash = custom.splash
  const photos = target === 'background' ? bg.photos : target === 'splash' ? splash.photos : (sec?.photos ?? [])
  const fit = target === 'background' ? bg.fit : (sec?.fit ?? 'cover')
  const pos = target === 'background' ? bg.pos : (sec?.pos ?? 'center')
  const check = custom.check
  /** 모두 같은 색일 때 가계부·할 일·스크랩은 대시보드 색을 따라간다 */
  const following = custom.sameColor && (target === 'money' || target === 'todo' || target === 'scrap')

  const setBg = (patch: Partial<Customization['background']>) => setCustom((c) => ({ ...c, background: { ...c.background, ...patch } }))
  const setSec = (s: Section, patch: Partial<Customization['sections'][Section]>) =>
    setCustom((c) => ({ ...c, sections: { ...c.sections, [s]: { ...c.sections[s], ...patch } } }))
  const setCheck = (patch: Partial<Customization['check']>) => setCustom((c) => ({ ...c, check: { ...c.check, ...patch } }))
  const setSplash = (patch: Partial<Customization['splash']>) => setCustom((c) => ({ ...c, splash: { ...c.splash, ...patch } }))
  const setPhotos = (list: string[], pals: Record<string, PhotoPalette> = {}) => {
    if (target === 'background') setBg({ photos: list })
    else if (target === 'splash') {
      // 지운 사진의 색은 빼고, 새로 넣은 사진의 색을 더한다
      setCustom((c) => {
        const palettes = Object.fromEntries(Object.entries({ ...c.splash.palettes, ...pals }).filter(([ref]) => list.includes(ref)))
        return { ...c, splash: { ...c.splash, photos: list, palettes } }
      })
    } else if (sec) setSec(target as Section, { photos: list })
  }

  const setFit = (patch: Partial<Pick<Customization['background'], 'fit' | 'pos'>>) =>
    target === 'background' ? setBg(patch) : sec && setSec(target as Section, patch)

  /** 고른 사진 여러 장을 줄여서 보관함에 넣는다 */
  async function pickPhotos(files: File[]) {
    const room = MAX_PHOTOS - photos.length
    if (files.length === 0) return
    if (room <= 0) {
      toast(`사진은 ${MAX_PHOTOS}장까지 넣을 수 있어요`, 'error')
      return
    }
    setAdding(true)
    const added: string[] = []
    const pals: Record<string, PhotoPalette> = {}
    let failed = 0
    for (const file of files.slice(0, room)) {
      try {
        const blob = await shrinkPhoto(file)
        const ref = await storePhoto(blob)
        added.push(ref)
        // 시작 화면 사진이면 앱 색 맞추기에 쓸 색을 뽑아 둔다
        if (target === 'splash') pals[ref] = await paletteFromBlob(blob).catch(() => ({ bg: '#f2f4f6', colors: randomTheme.sections.main.colors }))
      } catch {
        failed++
      }
    }
    setAdding(false)
    if (added.length) setPhotos([...photos, ...added], pals)
    if (files.length > room) toast(`사진은 ${MAX_PHOTOS}장까지라서 ${files.length - room}장은 빼고 넣었어요`, 'error')
    else if (failed) toast(`사진 ${failed}장을 열지 못했어요`, 'error')
  }

  function reset() {
    if (target === 'background') setBg({ ...DEFAULT_BACKGROUND })
    else if (target === 'splash') setSplash({ ...DEFAULT_SPLASH, palettes: {} })
    else if (target === 'check') setCheck({ ...DEFAULT_CHECK })
    else setSec(target, defaultSection(randomTheme.sections[target].colors))
  }

  return (
    <section ref={card} className="card p-5">
      <h2 className="font-bold">꾸미기</h2>
      <p className="mb-4 text-sm text-slate-500">배경과 구역마다 색, 사진, 투명도를 골라요. 미리보기로 먼저 보고 적용할 수 있어요.</p>

      {/* 메뉴 색: 모든 메뉴를 누를 때 같은 색이 되게 (사용자 요청 2026-11-16) */}
      <p className="mb-2 text-sm font-bold text-slate-700">메뉴 색</p>
      <Segmented
        value={custom.sameColor ? 'same' : 'each'}
        options={[
          ['same', '모두 같은 색'],
          ['each', '메뉴마다 다른 색'],
        ]}
        onChange={(v) => setCustom((c) => ({ ...c, sameColor: v === 'same' }))}
      />
      <p className="mt-2 mb-4 text-xs break-keep text-slate-500">
        {custom.sameColor ? '대시보드, 가계부, 할 일, 일기, 캘린더, 스크랩, 설정 모두 대시보드 색으로 맞춰요' : '가계부, 할 일·일기, 스크랩이 각자 다른 색을 써요'}
      </p>

      <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist">
        {TARGETS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={target === t.key}
            onClick={() => setTarget(t.key)}
            className={`${t.key === 'background' || t.key === 'check' || t.key === 'splash' ? 'theme-main' : themeFor(t.path)} min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${
              target === t.key ? 'bg-grad on-grad shadow-float' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {target === 'splash' ? (
        <>
          <p className="mb-1 text-sm text-slate-600">앱을 켜면 고른 사진을 폰 화면에 꽉 차게 보여 주고, 시간이 지나면 저절로 넘어가요. 누르면 바로 넘어가요.</p>
          <Label>사진 {photos.length > 0 && <span className="font-normal text-slate-400">({photos.length}/{MAX_PHOTOS})</span>}</Label>
          <PhotoGrid photos={photos} adding={adding} onRemove={(ref) => setPhotos(photos.filter((p) => p !== ref))} onAdd={() => fileInput.current?.click()} palettes={splash.palettes} />
          {photos.length > 1 && <p className="mt-1.5 text-xs text-slate-500">여러 장이면 앱을 켤 때마다 한 장씩 바뀌어요</p>}
          {photos.length === 0 && (
            <>
              <Label>사진이 없을 때</Label>
              <Segmented
                value={splash.basic ? 'on' : 'off'}
                options={[
                  ['on', '기본 시작 화면'],
                  ['off', '바로 시작'],
                ]}
                onChange={(v) => setSplash({ basic: v === 'on' })}
              />
              <p className="mt-2 text-xs break-keep text-slate-500">
                {splash.basic ? '그날 고른 색 위에 TIDY: 로고와 인사를 1초쯤 보여 줘요. 누르면 바로 넘어가요' : '시작 화면 없이 바로 첫 화면이 열려요'}
              </p>
            </>
          )}
          {photos.length > 0 && (
            <>
              <Label>TIDY: 로고 자리</Label>
              <Segmented value={splash.logoPos} options={SPLASH_LOGO_POS} onChange={(v) => setSplash({ logoPos: v })} />
              {splash.logoPos !== 'hide' && (
                <Slider
                  label="로고 투명도"
                  value={splash.logoClear}
                  max={SPLASH_LOGO_CLEAR_MAX}
                  onChange={(v) => setSplash({ logoClear: v })}
                  hint="높을수록 로고가 흐려져서 사진이 더 잘 보여요"
                />
              )}
              <Label>보여 주는 시간</Label>
              <Segmented
                value={String(splash.seconds)}
                options={SPLASH_SECONDS.map((n) => [String(n), `${n}초`] as [string, string])}
                onChange={(v) => setSplash({ seconds: Number(v) })}
              />
              <Label>사진 색으로 앱 맞추기</Label>
              <Segmented
                value={splash.matchColors ? 'on' : 'off'}
                options={[
                  ['on', '켜기'],
                  ['off', '끄기'],
                ]}
                onChange={(v) => setSplash({ matchColors: v === 'on' })}
              />
              <p className="mt-2 flex items-start gap-1 text-xs text-slate-500">
                <Palette className="mt-px size-3.5 shrink-0" aria-hidden />
                {splash.matchColors
                  ? '그날 나온 사진에서 뽑은 색으로 앱 바탕과 모든 구역 색을 맞춰요 (사진 밑 동그라미 색). 어두운 화면에서는 바탕은 그대로예요'
                  : '앱 색은 다른 항목에서 고른 대로예요'}
              </p>
            </>
          )}
        </>
      ) : target === 'check' ? (
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
        {following ? (
          <p className="mb-1 flex items-start gap-1 text-xs break-keep text-slate-500">
            <Palette className="mt-px size-3.5 shrink-0" aria-hidden />
            모든 메뉴가 대시보드와 같은 색이에요. 이 메뉴만 다른 색으로 하려면 위에서 &lsquo;메뉴마다 다른 색&rsquo;을 골라요
          </p>
        ) : (
        <>
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
        </>
        )}

        {/* 사진: 여러 장 넣으면 앱을 켤 때마다 한 장씩 골라 보여 준다 */}
        <Label>사진 {photos.length > 0 && <span className="font-normal text-slate-400">({photos.length}/{MAX_PHOTOS})</span>}</Label>
        <PhotoGrid photos={photos} adding={adding} onRemove={(ref) => setPhotos(photos.filter((p) => p !== ref))} onAdd={() => fileInput.current?.click()} />
        {photos.length > 1 && <p className="mt-1.5 text-xs text-slate-500">여러 장이면 앱을 켤 때마다 한 장씩 바뀌어요</p>}

        {/* 사진 맞춤: 세로로 긴 사진도 안 잘리게 */}
        {photos.length > 0 && (
          <>
            <Label>사진 맞춤</Label>
            <Segmented
              value={fit}
              options={[
                ['contain', '전체 보이기'],
                ['cover', '꽉 채우기'],
              ]}
              onChange={(v) => setFit({ fit: v })}
            />
            <p className="mt-2 text-xs text-slate-500">
              {fit === 'contain' ? '사진이 잘리지 않아요. 남는 곳은 색으로 채워요' : '칸을 꽉 채워요. 칸보다 긴 쪽은 잘려요'}
            </p>
            {fit === 'cover' && (
              <>
                <Label>보여 줄 곳</Label>
                <Segmented
                  value={pos}
                  options={[
                    ['top', '위쪽'],
                    ['center', '가운데'],
                    ['bottom', '아래쪽'],
                  ]}
                  onChange={(v) => setFit({ pos: v })}
                />
              </>
            )}
          </>
        )}

        {/* 투명도 */}
        {target === 'background' ? (
          <>
            {(bg.photos.length > 0 || bg.color !== 'default') && (
              <Slider label={bg.photos.length > 0 ? '사진 투명도' : '색 투명도'} value={bg.clear} onChange={(v) => setBg({ clear: v })} />
            )}
            <Slider label="카드 투명도" value={bg.cardClear} max={70} onChange={(v) => setBg({ cardClear: v })} hint="배경이 카드 뒤로 비쳐요" />
          </>
        ) : (
          sec && sec.photos.length > 0 && (
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

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void pickPhotos([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />

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

/** 고른 사진 작은 그림들 + 추가 버튼. 시작 화면 사진이면 밑에 뽑은 색을 보여 준다 */
function PhotoGrid({ photos, adding, onRemove, onAdd, palettes }: { photos: string[]; adding: boolean; onRemove: (ref: string) => void; onAdd: () => void; palettes?: Record<string, PhotoPalette> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((ref, i) => (
        <div key={ref} className="relative">
          {photoSrc(ref) ? (
            <img src={photoSrc(ref)} alt={`고른 사진 ${i + 1}`} className="size-16 rounded-2xl object-cover" />
          ) : (
            <span className="block size-16 rounded-2xl bg-slate-100" />
          )}
          {palettes?.[ref] && (
            <span className="mt-1 flex justify-center gap-0.5" aria-label="이 사진에서 뽑은 색">
              {[palettes[ref].bg, ...palettes[ref].colors].map((c, j) => (
                <span key={j} className="size-3 rounded-full ring-1 ring-slate-200" style={{ background: c }} />
              ))}
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(ref)}
            className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-slate-800 text-white shadow"
            aria-label={`사진 ${i + 1} 지우기`}
          >
            <X className="size-3.5" strokeWidth={3} aria-hidden />
          </button>
        </div>
      ))}
      {photos.length < MAX_PHOTOS && (
        <button
          type="button"
          onClick={onAdd}
          disabled={adding}
          className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-500 disabled:opacity-60"
          aria-label="사진 추가"
        >
          {photos.length === 0 ? <ImagePlus className="size-5" aria-hidden /> : <Plus className="size-5" aria-hidden />}
          {adding ? '넣는 중' : '추가'}
        </button>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
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
