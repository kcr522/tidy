import { CheckCircle2, ExternalLink, FileUp, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { enrichMany } from '../../lib/scrap/enrich'
import { readInstagramSaved, type SavedPost } from '../../lib/scrap/instagramSaved'
import { openUrl } from '../../platform/openUrl'
import { bookmarkRepo } from '../../repositories/bookmarkRepo'
import Button from '../common/Button'
import Modal from '../common/Modal'

interface Props {
  open: boolean
  onClose: () => void
}

/** 인스타 "내 정보 다운로드" 화면 (계정 센터) */
const DOWNLOAD_URL = 'https://accountscenter.instagram.com/info_and_permissions/dyi/'

type Step = { kind: 'pick' } | { kind: 'reading' } | { kind: 'found'; posts: SavedPost[] } | { kind: 'done'; added: number; skipped: number; read: number }

/**
 * 인스타에서 저장(북마크)한 게시물을 Tidy 스크랩으로 가져오기.
 * 인스타는 저장 목록을 다른 앱에 주지 않아서, 인스타 "내 정보 다운로드"로 받은 파일을 읽는다
 */
export default function InstagramImportDialog({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [error, setError] = useState<string | null>(null)
  const [withCollections, setWithCollections] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  function close() {
    setStep({ kind: 'pick' })
    setError(null)
    onClose()
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setStep({ kind: 'reading' })
    try {
      const posts = await readInstagramSaved(file)
      if (!posts.length) throw new Error('저장한 게시물을 찾지 못했어요. "저장됨"이 들어 있는 파일인지 확인해 주세요')
      setStep({ kind: 'found', posts })
    } catch (e) {
      setError(e instanceof Error ? e.message : '파일을 읽지 못했어요')
      setStep({ kind: 'pick' })
    }
  }

  async function runImport(posts: SavedPost[]) {
    try {
      const { added, skipped } = await bookmarkRepo.importInstagram(posts, withCollections)
      setStep({ kind: 'done', added: added.length, skipped, read: 0 })
      // 캡션은 뒤에서 차례로 읽어 온다 (창을 닫아도 계속)
      void enrichMany(added, (read) => setStep((s) => (s.kind === 'done' ? { ...s, read } : s)))
    } catch {
      setError('가져오지 못했어요. 다시 시도해 주세요')
    }
  }

  const collections = step.kind === 'found' ? new Set(step.posts.map((p) => p.collection).filter(Boolean)).size : 0

  return (
    <Modal open={open} title="인스타 저장 목록 가져오기" onClose={close}>
      {step.kind === 'pick' && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">
            인스타는 저장한 게시물 목록을 다른 앱에 바로 주지 않아요. 대신 인스타에서 <b>내 정보 다운로드</b>로 받은 파일을 넣으면 저장한 게시물이 전부 스크랩으로 들어와요.
          </p>
          <ol className="space-y-2 rounded-2xl bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-700">
            <li>
              <b>1.</b> 인스타 앱 → 프로필 → ≡ → <b>계정 센터</b> → 내 정보 및 권한 → <b>내 정보 다운로드</b>
            </li>
            <li>
              <b>2.</b> 정보 다운로드 또는 전송 → <b>일부 정보</b> → <b>저장됨</b>만 고르기
            </li>
            <li>
              <b>3.</b> 기기로 다운로드 · 형식 <b>JSON</b> · 미디어 화질 낮음 → 요청 (보통 몇 분 안에 알림이 와요)
            </li>
            <li>
              <b>4.</b> 받은 <b>zip 파일</b>을 아래에서 고르기 (압축 풀지 않아도 돼요)
            </li>
          </ol>
          <button type="button" onClick={() => openUrl(DOWNLOAD_URL)} className="tap inline-flex items-center gap-1 text-sm font-bold text-brand-700">
            인스타 내 정보 다운로드 열기 <ExternalLink className="size-3.5" aria-hidden />
          </button>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
          <input ref={fileRef} type="file" accept=".zip,.json,.html,application/zip,application/json,text/html" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button className="w-full" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" aria-hidden /> 받은 파일 고르기
          </Button>
          <p className="text-xs leading-relaxed text-slate-400">파일은 이 기기 안에서만 읽어요. 저장한 게시물 주소만 가져오고, 캡션은 공개 게시물만 읽혀요.</p>
        </div>
      )}

      {step.kind === 'reading' && (
        <div className="flex flex-col items-center gap-3 py-10 text-sm text-slate-500">
          <Loader2 className="size-7 animate-spin text-brand-600" aria-hidden />
          파일에서 저장한 게시물을 찾는 중…
        </div>
      )}

      {step.kind === 'found' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-grad-soft p-4">
            <p className="text-2xl font-extrabold text-slate-900">{step.posts.length.toLocaleString()}개</p>
            <p className="text-sm text-slate-600">저장한 게시물을 찾았어요{collections > 0 && ` · 컬렉션 ${collections}개`}</p>
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-[13px] text-slate-600">
            {step.posts.slice(0, 30).map((p) => (
              <li key={p.code} className="flex justify-between gap-2">
                <span className="truncate">{p.author ? `@${p.author}` : p.url.replace('https://www.instagram.com', '')}</span>
                <span className="shrink-0 text-slate-400">{p.collection ?? ''}</span>
              </li>
            ))}
            {step.posts.length > 30 && <li className="text-slate-400">… 외 {step.posts.length - 30}개</li>}
          </ul>
          {collections > 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={withCollections} onChange={(e) => setWithCollections(e.target.checked)} className="size-4 accent-brand-600" />
              인스타 컬렉션을 스크랩 카테고리로 나누기
            </label>
          )}
          <p className="text-xs text-slate-400">이미 Tidy에 있는 게시물은 새로 만들지 않고 하나로 둬요. 자동 캡처는 하지 않고, 캡션만 차례로 읽어 와요.</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep({ kind: 'pick' })}>
              다른 파일
            </Button>
            <Button className="flex-[2]" onClick={() => void runImport(step.posts)}>
              가져오기
            </Button>
          </div>
        </div>
      )}

      {step.kind === 'done' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-9 shrink-0 text-emerald-500" aria-hidden />
            <div>
              <p className="text-lg font-extrabold text-slate-900">{step.added.toLocaleString()}개 가져왔어요</p>
              {step.skipped > 0 && <p className="text-sm text-slate-500">이미 있던 {step.skipped}개는 새로 만들지 않고 하나로 뒀어요 (적어 둔 메모 · 제목은 그대로)</p>}
            </div>
          </div>
          {step.added > 0 && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>{step.read < step.added ? '캡션 읽어 오는 중' : '캡션 다 읽었어요'}</span>
                <span>
                  {step.read} / {step.added}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-grad transition-all" style={{ width: `${Math.round((step.read / step.added) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">창을 닫아도 뒤에서 계속 읽어요.</p>
            </div>
          )}
          <Button className="w-full" onClick={close}>
            스크랩 보러 가기
          </Button>
        </div>
      )}
    </Modal>
  )
}
