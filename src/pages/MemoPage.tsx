import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Folder, FolderPlus, Paperclip, Pencil, Pin, PinOff, Play, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AttachmentField from '../components/common/AttachmentField'
import Button from '../components/common/Button'
import ConfirmDialog from '../components/common/ConfirmDialog'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import MemoFolderForm from '../components/memo/MemoFolderForm'
import type { Attachment, Memo, MemoFolder } from '../db/types'
import { cleanAttachments, isImage, isVideo } from '../lib/attachments'
import { dayTitle } from '../lib/calendar'
import { nowIso, toDateKey } from '../lib/date'
import {
  MAX_MEMO_FILE_BYTES,
  MAX_MEMO_TEXT,
  MAX_MEMO_TITLE,
  MEMO_FOLDER_COLORS,
  clockLabel,
  filterMemos,
  fullWhen,
  groupByDay,
  memoPreview,
  memoTitle,
} from '../lib/memo'
import { memoRepo } from '../repositories/memoRepo'

/** 입력을 멈추고 이만큼 지나면 자동 저장 */
const AUTOSAVE_MS = 800

/** 전체 / 파일집 밖 / 파일집 하나 */
type FolderFilter = 'all' | 'none' | number

/** 지금 쓰고 있는 메모. 새 메모는 처음 저장할 때 id 가 생긴다 */
type Editing = { key: string; id?: number; startedAt: string; folderId?: number }
let nextKey = 0

/** 메모: 글 + 사진·영상·파일을 남기고, 색깔 있는 파일집에 모은다. 쓴 시각이 그대로 남는다 (사용자 요청 2026-11-17) */
export default function MemoPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const memos = useLiveQuery(() => memoRepo.list(), [])
  const folders = useLiveQuery(() => memoRepo.folders(), [])
  const [filter, setFilter] = useState<FolderFilter>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Editing | null>(() => {
    // 전체 검색에서 누르고 들어오면 그 메모를 바로 연다
    const id = (location.state as { memoId?: number } | null)?.memoId
    return id ? { key: `e${nextKey++}`, id, startedAt: nowIso() } : null
  })
  const [folderForm, setFolderForm] = useState<MemoFolder | 'new' | null>(null)
  const [removingFolder, setRemovingFolder] = useState<MemoFolder | null>(null)
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const folderById = useMemo(() => new Map((folders ?? []).map((f) => [f.id!, f])), [folders])
  const counts = useMemo(() => {
    const c = new Map<FolderFilter, number>([['all', 0], ['none', 0]])
    for (const m of memos ?? []) {
      c.set('all', (c.get('all') ?? 0) + 1)
      const k: FolderFilter = m.folderId && folderById.has(m.folderId) ? m.folderId : 'none'
      c.set(k, (c.get(k) ?? 0) + 1)
    }
    return c
  }, [memos, folderById])

  const shown = useMemo(() => {
    const inFolder = (memos ?? []).filter((m) =>
      filter === 'all' ? true : filter === 'none' ? !m.folderId || !folderById.has(m.folderId) : m.folderId === filter,
    )
    return groupByDay(filterMemos(inFolder, query))
  }, [memos, filter, query, folderById])

  const current = editing?.id !== undefined ? memos?.find((m) => m.id === editing.id) : undefined
  const selFolder = typeof filter === 'number' ? folderById.get(filter) : undefined
  // 고른 파일집이 지워지면 전체로
  useEffect(() => {
    if (typeof filter === 'number' && folders && !folderById.has(filter)) setFilter('all')
  }, [filter, folders, folderById])

  function startNew() {
    setEditing({ key: `e${nextKey++}`, startedAt: nowIso(), folderId: typeof filter === 'number' ? filter : undefined })
  }

  async function saveFolder(name: string, color: string) {
    if (folderForm === 'new') {
      const id = await memoRepo.addFolder(name, color)
      setFilter(id)
      toast('파일집을 만들었어요')
    } else if (folderForm) {
      await memoRepo.updateFolder(folderForm.id!, name, color)
      toast('파일집을 고쳤어요')
    }
    setFolderForm(null)
  }

  const list = (
    <section aria-label="메모 목록" className={`min-w-0 ${editing ? 'hidden md:block' : ''}`}>
      <label className="mb-3 flex min-h-12 items-center gap-2 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-slate-100 focus-within:ring-2 focus-within:ring-brand-500">
        <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={selFolder ? `'${selFolder.name}'에서 찾기` : '메모 내용·제목·파일 이름으로 찾기'}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
          aria-label="메모 검색"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="검색어 지우기">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </label>

      {/* 파일집: 누르면 그 안의 메모만, 연필로 이름·색 고치기 */}
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="파일집">
        <FolderChip label="전체" count={counts.get('all') ?? 0} active={filter === 'all'} onClick={() => setFilter('all')} />
        {(folders ?? []).map((f) => (
          <FolderChip key={f.id} label={f.name} color={f.color} count={counts.get(f.id!) ?? 0} active={filter === f.id} onClick={() => setFilter(f.id!)} />
        ))}
        {(counts.get('none') ?? 0) > 0 && (folders?.length ?? 0) > 0 && (
          <FolderChip label="파일집 밖" count={counts.get('none') ?? 0} active={filter === 'none'} onClick={() => setFilter('none')} />
        )}
        <button
          type="button"
          onClick={() => setFolderForm('new')}
          className="flex min-h-10 shrink-0 items-center gap-1 rounded-full border-2 border-dashed border-slate-200 px-3 text-sm font-semibold whitespace-nowrap text-slate-500 hover:bg-white"
        >
          <FolderPlus className="size-4" aria-hidden />
          파일집 만들기
        </button>
      </div>

      {selFolder && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: `${selFolder.color}1f` }}>
          <Folder className="size-5 shrink-0" style={{ color: selFolder.color, fill: selFolder.color }} aria-hidden />
          <span className="min-w-0 flex-1 truncate font-bold">{selFolder.name}</span>
          <button type="button" onClick={() => setFolderForm(selFolder)} className="flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-600">
            <Pencil className="size-3.5" aria-hidden />
            이름·색 바꾸기
          </button>
        </div>
      )}

      {memos === undefined ? null : shown.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-3xl" aria-hidden>
            {query ? '🔍' : '🗒️'}
          </p>
          <p className="mt-2 font-semibold text-slate-800">{query ? '찾는 메모가 없어요' : selFolder ? '이 파일집은 비어 있어요' : '아직 쓴 메모가 없어요'}</p>
          {!query && <p className="mt-1 text-sm text-slate-500">사진, 영상, 파일도 같이 넣을 수 있어요</p>}
        </div>
      ) : (
        <div className="space-y-5">
          {shown.map((g) => (
            <div key={g.key}>
              <h2 className="mb-2 flex items-center gap-1 px-1 text-sm font-bold text-slate-500">
                {g.key === 'pinned' ? (
                  <>
                    <Pin className="size-3.5" aria-hidden />
                    고정한 메모
                  </>
                ) : g.key === toDateKey(new Date()) ? (
                  `오늘 · ${dayTitle(g.key)}`
                ) : (
                  dayTitle(g.key)
                )}
              </h2>
              <ol className="space-y-2">
                {g.memos.map((m) => (
                  <li key={m.id}>
                    <MemoRow
                      memo={m}
                      folder={m.folderId ? folderById.get(m.folderId) : undefined}
                      showDate={g.key === 'pinned'}
                      active={editing?.id === m.id}
                      onClick={() => setEditing({ key: `e${nextKey++}`, id: m.id, startedAt: m.createdAt })}
                    />
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  )

  return (
    <>
      <PageHeader
        title="메모"
        action={
          <Button onClick={startNew} className="min-h-11 px-4">
            <Plus className="size-4" strokeWidth={2.6} aria-hidden />
            새 메모
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-start">
        {list}
        {editing && (editing.id === undefined || current) ? (
          <MemoEditor
            key={editing.key}
            memo={current}
            startedAt={editing.startedAt}
            initialFolderId={editing.folderId}
            folders={folders ?? []}
            onCreated={(id) => setEditing((e) => (e ? { ...e, id } : e))}
            onClose={() => setEditing(null)}
          />
        ) : (
          <section className="card hidden min-h-80 flex-col items-center justify-center gap-2 p-6 text-center text-slate-500 md:flex">
            <p className="text-3xl" aria-hidden>
              ✍️
            </p>
            <p className="font-semibold">메모를 고르거나 새로 써 보세요</p>
            <p className="text-sm">쓰기 시작한 시각이 그대로 기록돼요</p>
          </section>
        )}
      </div>

      <Modal open={folderForm !== null} title={folderForm === 'new' ? '새 파일집' : '파일집 고치기'} onClose={() => setFolderForm(null)}>
        {folderForm !== null && (
          <MemoFolderForm
            key={folderForm === 'new' ? 'new' : folderForm.id}
            initial={folderForm === 'new' ? undefined : folderForm}
            defaultColor={MEMO_FOLDER_COLORS[(folders?.length ?? 0) % MEMO_FOLDER_COLORS.length].hex}
            onSubmit={saveFolder}
            onDelete={
              folderForm === 'new'
                ? undefined
                : () => {
                    setRemovingFolder(folderForm)
                    setFolderForm(null)
                  }
            }
          />
        )}
      </Modal>

      <ConfirmDialog
        open={removingFolder !== null}
        title="파일집 삭제"
        message={`'${removingFolder?.name ?? ''}' 파일집을 지울까요? 안에 있던 메모는 지우지 않고 파일집 밖으로 꺼내 둬요.`}
        confirmLabel="삭제"
        danger
        onConfirm={async () => {
          if (removingFolder?.id) await memoRepo.removeFolder(removingFolder.id)
          setRemovingFolder(null)
          setFilter('all')
          toast('파일집을 지웠어요')
        }}
        onCancel={() => setRemovingFolder(null)}
      />
    </>
  )
}

function FolderChip({ label, count, color, active, onClick }: { label: string; count: number; color?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition ${
        active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-100 hover:bg-slate-50'
      }`}
      style={active && color ? { background: color } : undefined}
    >
      {color && <Folder className="size-4" style={{ color: active ? '#fff' : color, fill: active ? '#ffffff55' : color }} aria-hidden />}
      {label}
      <span className={`text-xs ${active ? 'text-white/80' : 'text-slate-400'}`}>{count}</span>
    </button>
  )
}

function MemoRow({ memo, folder, showDate, active, onClick }: { memo: Memo; folder?: MemoFolder; showDate: boolean; active: boolean; onClick: () => void }) {
  const preview = memoPreview(memo)
  const media = memo.attachments?.find((a) => isImage(a) || isVideo(a))
  const fileCount = memo.attachments?.length ?? 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card flex w-full gap-3 overflow-hidden p-3 text-left transition hover:brightness-[0.99] ${active ? 'ring-2 ring-brand-500' : ''}`}
    >
      {/* 쓴 시각 */}
      <span className="w-[58px] shrink-0 pt-0.5 text-xs font-bold text-brand-700">
        {showDate && <span className="block text-slate-400">{new Date(memo.createdAt).getMonth() + 1}/{new Date(memo.createdAt).getDate()}</span>}
        {clockLabel(memo.createdAt)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-slate-900">{memoTitle(memo)}</span>
        {preview && <span className="mt-0.5 line-clamp-2 text-sm break-all text-slate-500">{preview}</span>}
        {(folder || fileCount > 0) && (
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {folder && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${folder.color}22`, color: folder.color }}>
                <Folder className="size-3" style={{ fill: folder.color }} aria-hidden />
                {folder.name}
              </span>
            )}
            {fileCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-400">
                <Paperclip className="size-3" aria-hidden />
                {fileCount}
              </span>
            )}
          </span>
        )}
      </span>
      {media && (
        <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {isVideo(media) ? (
            <>
              <video src={media.src} muted playsInline preload="metadata" className="size-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-full bg-slate-900/60 p-1 text-white">
                  <Play className="size-3 fill-current" aria-hidden />
                </span>
              </span>
            </>
          ) : (
            <img src={media.src} alt="" className="size-full object-cover" />
          )}
        </span>
      )}
    </button>
  )
}

interface EditorProps {
  memo?: Memo
  /** 새 메모를 연 시각: 이 시각이 '쓴 시각'으로 남는다 */
  startedAt: string
  initialFolderId?: number
  folders: MemoFolder[]
  onCreated: (id: number) => void
  onClose: () => void
}

/** 메모 쓰기·고치기. 쓰는 대로 자동 저장된다 */
function MemoEditor({ memo, startedAt, initialFolderId, folders, onCreated, onClose }: EditorProps) {
  const toast = useToast()
  const [title, setTitle] = useState(memo?.title ?? '')
  const [text, setText] = useState(memo?.text ?? '')
  const [folderId, setFolderId] = useState<number | undefined>(memo?.folderId ?? initialFolderId)
  const [files, setFiles] = useState<Attachment[]>(memo?.attachments ?? [])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const idRef = useRef<number | undefined>(memo?.id)
  const textRef = useRef<HTMLTextAreaElement>(null)
  // 저장된 내용 (바뀐 게 있는지 비교용)
  const saved = useRef(JSON.stringify([memo?.title ?? '', memo?.text ?? '', memo?.folderId, cleanAttachments(memo?.attachments)]))

  const snapshot = JSON.stringify([title.trim(), text, folderId, cleanAttachments(files)])
  const dirty = snapshot !== saved.current
  const empty = !title.trim() && !text.trim() && files.length === 0
  const latest = useRef({ title, text, folderId, files, snapshot, dirty, empty })
  useEffect(() => {
    latest.current = { title, text, folderId, files, snapshot, dirty, empty }
  })
  const running = useRef<Promise<void> | null>(null)
  const removed = useRef(false)

  async function flush(): Promise<void> {
    while (running.current) await running.current
    const now = latest.current
    if (removed.current || !now.dirty || (now.empty && idRef.current === undefined)) return
    const job = (async () => {
      setSaving(true)
      try {
        const input = { title: now.title, text: now.text, folderId: now.folderId, attachments: now.files }
        if (idRef.current === undefined) {
          idRef.current = await memoRepo.add(input, startedAt)
          onCreated(idRef.current)
        } else {
          await memoRepo.update(idRef.current, input)
        }
        saved.current = now.snapshot
      } catch {
        toast('저장하지 못했어요. 파일이 너무 크면 빼고 다시 해 주세요', 'error')
      } finally {
        setSaving(false)
      }
    })()
    running.current = job
    await job
    running.current = null
  }
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  })

  useEffect(() => {
    if (!dirty) return
    const t = window.setTimeout(() => void flushRef.current(), AUTOSAVE_MS)
    return () => window.clearTimeout(t)
  }, [snapshot, dirty])

  // 앱을 내리거나 이 칸을 떠날 때 바로 저장
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flushRef.current()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    if (!memo) textRef.current?.focus()
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      void flushRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function remove() {
    removed.current = true
    while (running.current) await running.current
    if (idRef.current !== undefined) await memoRepo.remove(idRef.current)
    setDeleting(false)
    toast('메모를 지웠어요')
    onClose()
  }

  const createdAt = memo?.createdAt ?? startedAt
  const status = saving ? '저장 중…' : dirty && !empty ? '잠시 뒤 자동으로 저장돼요' : idRef.current !== undefined ? '자동 저장됨' : '쓰는 대로 자동으로 저장돼요'

  return (
    <section className="card min-w-0 p-4" aria-label="메모 쓰기">
      <div className="mb-3 flex items-center gap-1">
        <button type="button" onClick={onClose} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="목록으로">
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{fullWhen(createdAt)}에 씀</p>
          <p className="text-xs text-slate-400" aria-live="polite">
            {memo && memo.updatedAt.slice(0, 16) !== memo.createdAt.slice(0, 16) ? `${fullWhen(memo.updatedAt)} 고침 · ` : ''}
            {status}
          </p>
        </div>
        {memo?.id !== undefined && (
          <button
            type="button"
            onClick={() => void memoRepo.setPinned(memo.id!, !memo.pinned).then(() => toast(memo.pinned ? '고정을 풀었어요' : '맨 위에 고정했어요'))}
            className={`tap rounded-full p-2 hover:bg-slate-100 ${memo.pinned ? 'text-brand-600' : 'text-slate-400'}`}
            aria-label={memo.pinned ? '고정 풀기' : '맨 위에 고정'}
            title={memo.pinned ? '고정 풀기' : '맨 위에 고정'}
          >
            {memo.pinned ? <PinOff className="size-5" aria-hidden /> : <Pin className="size-5" aria-hidden />}
          </button>
        )}
      </div>

      {/* 파일집 고르기 */}
      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="파일집">
        <button
          type="button"
          role="radio"
          aria-checked={!folderId}
          onClick={() => setFolderId(undefined)}
          className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-bold whitespace-nowrap ${!folderId ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}
        >
          파일집 없음
        </button>
        {folders.map((f) => {
          const on = folderId === f.id
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setFolderId(f.id)}
              className="flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold whitespace-nowrap"
              style={on ? { background: f.color, color: '#fff' } : { background: `${f.color}1f`, color: f.color }}
            >
              <Folder className="size-3.5" style={{ fill: on ? '#ffffff66' : f.color }} aria-hidden />
              {f.name}
            </button>
          )
        })}
      </div>

      <input
        value={title}
        maxLength={MAX_MEMO_TITLE}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목 (선택)"
        className="w-full bg-transparent px-1 py-2 text-xl font-extrabold tracking-tight outline-none placeholder:text-slate-300"
        aria-label="메모 제목"
      />
      <textarea
        ref={textRef}
        value={text}
        maxLength={MAX_MEMO_TEXT}
        onChange={(e) => setText(e.target.value)}
        placeholder="생각나는 것, 기억할 것을 적어 두세요"
        rows={10}
        className="mt-1 w-full resize-y rounded-2xl bg-slate-100 p-4 text-base leading-relaxed outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500"
        aria-label="메모 내용"
      />

      <div className="mt-3">
        <span className="mb-1.5 block text-sm font-medium text-slate-600">사진·영상·파일 (선택)</span>
        <AttachmentField value={files} onChange={setFiles} acceptDrop maxBytes={MAX_MEMO_FILE_BYTES} addLabel="사진·영상·파일 넣기" />
        <p className="mt-1 text-xs text-slate-400">파일 하나에 50MB까지 넣을 수 있어요. 약 650KB가 넘는 파일은 다른 기기로 동기화되지 않고 이 기기에만 남아요.</p>
      </div>

      {idRef.current !== undefined && (
        <div className="mt-4 flex">
          <Button variant="secondary" className="text-expense" onClick={() => setDeleting(true)}>
            삭제
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleting}
        title="메모 삭제"
        message="이 메모를 지울까요? 지우면 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </section>
  )
}
