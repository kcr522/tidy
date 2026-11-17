import { useLiveQuery } from 'dexie-react-hooks'
import { BookHeart, Bookmark as BookmarkIcon, CalendarDays, Check, ListChecks, NotebookPen, Search, Wallet, X, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ScrapDetail from '../components/bookmarks/ScrapDetail'
import ConfirmDialog from '../components/common/ConfirmDialog'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import TodoForm from '../components/todos/TodoForm'
import TransactionDetail from '../components/transactions/TransactionDetail'
import TransactionForm from '../components/transactions/TransactionForm'
import { db } from '../db/database'
import type { Bookmark, Todo, Transaction } from '../db/types'
import { formatDateLabel, formatWon } from '../lib/format'
import { KIND_LABEL, KIND_ORDER, highlightParts, searchAll, splitQuery, type SearchHit, type SearchKind } from '../lib/search'
import { clockLabel } from '../lib/memo'
import { toDateKey } from '../lib/date'
import { openUrl } from '../platform/openUrl'
import { bookmarkRepo } from '../repositories/bookmarkRepo'
import { todoRepo, type TodoInput } from '../repositories/todoRepo'
import { transactionRepo, type TransactionInput } from '../repositories/transactionRepo'

const KIND_ICON: Record<SearchKind, LucideIcon> = {
  money: Wallet,
  todo: ListChecks,
  diary: BookHeart,
  scrap: BookmarkIcon,
  memo: NotebookPen,
  event: CalendarDays,
}

/** 한 종류에서 처음에 보여 주는 개수 (더 보기로 펼친다) */
const PAGE = 20

type Sheet = { mode: 'money'; item: Transaction; editing?: boolean } | { mode: 'todo'; item: Todo } | null

/** 전체 검색: 가계부 메모, 할 일, 일기, 스크랩(제목·메모·AI 요약), 일정에서 찾는다 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [kind, setKind] = useState<SearchKind | 'all'>('all')
  const [more, setMore] = useState<Set<SearchKind>>(new Set())
  const [sheet, setSheet] = useState<Sheet>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const [scrapId, setScrapId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => inputRef.current?.focus(), [])

  // 검색어를 주소에 남겨서 결과를 눌렀다가 뒤로 와도 그대로 보이게 한다
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query)
      setMore(new Set())
      setParams(query.trim() ? { q: query } : {}, { replace: true })
    }, 150)
    return () => clearTimeout(id)
  }, [query, setParams])

  // 기기 안의 기록을 한 번에 읽는다 (바뀌면 다시 읽는다)
  const data = useLiveQuery(async () => {
    const [transactions, todos, diaries, bookmarks, events, memos, memoFolders] = await Promise.all([
      db.transactions.toArray(),
      db.todos.toArray(),
      db.diaries.toArray(),
      db.bookmarks.toArray(),
      db.events.toArray(),
      db.memos.toArray(),
      db.memoFolders.toArray(),
    ])
    return { transactions, todos, diaries, bookmarks, events, memos, memoFolders }
  }, [])

  const hits = useMemo(() => (data ? searchAll(data, debounced) : []), [data, debounced])
  const terms = useMemo(() => splitQuery(debounced), [debounced])
  const counts = useMemo(() => {
    const c = new Map<SearchKind, number>()
    for (const h of hits) c.set(h.kind, (c.get(h.kind) ?? 0) + 1)
    return c
  }, [hits])
  const groups = KIND_ORDER.filter((k) => (kind === 'all' || kind === k) && counts.get(k)).map((k) => ({ kind: k, items: hits.filter((h) => h.kind === k) }))
  const scrap = scrapId != null ? (data?.bookmarks.find((b) => b.id === scrapId) ?? null) : null

  function open(hit: SearchHit) {
    if (hit.kind === 'money') setSheet({ mode: 'money', item: hit.item })
    else if (hit.kind === 'todo') setSheet({ mode: 'todo', item: hit.item })
    else if (hit.kind === 'scrap') setScrapId(hit.item.id ?? null)
    else if (hit.kind === 'diary') navigate('/diary', { state: { date: hit.item.date } })
    else if (hit.kind === 'memo') navigate('/memo', { state: { memoId: hit.item.id } })
    else navigate('/calendar')
  }

  async function toggleTodo(t: Todo) {
    if (t.id == null) return
    try {
      const next = await todoRepo.toggleComplete(t.id)
      if (next) toast(`다음 할 일을 ${formatDateLabel(next)}에 만들었어요`)
    } catch {
      toast('바꾸지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function saveTodo(input: TodoInput) {
    if (sheet?.mode !== 'todo' || sheet.item.id == null) return
    try {
      await todoRepo.update(sheet.item.id, input)
      toast('수정했어요')
      setSheet(null)
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function saveMoney(input: TransactionInput) {
    if (sheet?.mode !== 'money' || sheet.item.id == null) return
    try {
      await transactionRepo.update(sheet.item.id, input)
      toast('수정했어요')
      setSheet(null)
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function resolve(item: Transaction, name: string, remember: boolean) {
    if (item.id == null) return
    try {
      const n = await transactionRepo.resolveMerchant(item.id, name, remember)
      toast(n > 1 ? `같은 이름의 내역 ${n}개를 '${name}'(으)로 바꿨어요` : `'${name}'(으)로 바꿨어요`)
      setSheet(null)
    } catch {
      toast('바꾸지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function confirmDelete() {
    if (deleting?.id == null) return
    try {
      await transactionRepo.remove(deleting.id)
      toast('삭제했어요')
    } catch {
      toast('삭제하지 못했어요. 다시 시도해 주세요', 'error')
    }
    setDeleting(null)
    setSheet(null)
  }

  async function openScrap(b: Bookmark) {
    openUrl(b.url)
    if (b.id != null && b.isRead === 0) await bookmarkRepo.markRead(b.id)
  }

  return (
    <>
      <PageHeader title="검색" />

      <div className="card mb-3 flex items-center gap-2 px-4">
        <Search className="size-5 shrink-0 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="가계부, 할 일, 일기, 스크랩, 메모에서 찾기"
          aria-label="검색어"
          className="h-13 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="tap rounded-full bg-slate-100 p-1.5 text-slate-500" aria-label="지우기">
            <X className="size-3.5" strokeWidth={2.5} aria-hidden />
          </button>
        )}
      </div>

      {terms.length > 0 && hits.length > 0 && (
        <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="tablist" aria-label="어디서 찾을지">
          {(['all', ...KIND_ORDER] as const)
            .filter((k) => k === 'all' || counts.get(k))
            .map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold whitespace-nowrap ${kind === k ? 'bg-grad on-grad' : 'bg-white text-slate-600'}`}
              >
                {k === 'all' ? '전체' : KIND_LABEL[k]} <span className="opacity-70">{k === 'all' ? hits.length : counts.get(k)}</span>
              </button>
            ))}
        </div>
      )}

      {data === undefined ? null : terms.length === 0 ? (
        <Hint />
      ) : hits.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-4xl" aria-hidden>
            🔍
          </p>
          <p className="mt-3 font-semibold text-slate-800">‘{debounced.trim()}’ 찾은 게 없어요</p>
          <p className="mt-1 text-sm text-slate-500">다른 말로 찾거나 짧게 줄여 보세요</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {groups.map(({ kind: k, items }) => {
            const Icon = KIND_ICON[k]
            const shown = kind === k || more.has(k) ? items : items.slice(0, kind === 'all' ? 5 : PAGE)
            return (
              <section key={k} className="card overflow-hidden" aria-label={KIND_LABEL[k]}>
                <h2 className="flex items-center gap-2 px-4 pt-4 pb-1 text-sm font-bold text-slate-500">
                  <Icon className="size-4" aria-hidden />
                  {KIND_LABEL[k]} <span className="text-slate-400">{items.length}</span>
                </h2>
                <ul className="divide-y divide-slate-100">
                  {shown.map((h) => (
                    <HitRow key={h.key} hit={h} terms={terms} onOpen={() => open(h)} onToggle={h.kind === 'todo' ? () => toggleTodo(h.item) : undefined} />
                  ))}
                </ul>
                {shown.length < items.length && (
                  <button
                    type="button"
                    onClick={() => (kind === 'all' ? setKind(k) : setMore(new Set(more).add(k)))}
                    className="w-full border-t border-slate-100 py-3 text-sm font-bold text-brand-600"
                  >
                    {KIND_LABEL[k]} {items.length - shown.length}개 더 보기
                  </button>
                )}
              </section>
            )
          })}
        </div>
      )}

      <Modal open={sheet !== null} title={sheet?.mode === 'todo' ? '할 일 수정' : sheet?.mode === 'money' && sheet.editing ? '내역 수정' : '내역 보기'} onClose={() => setSheet(null)}>
        {sheet?.mode === 'money' && !sheet.editing && (
          <TransactionDetail
            item={sheet.item}
            onEdit={() => setSheet({ ...sheet, editing: true })}
            onDelete={() => setDeleting(sheet.item)}
            onResolve={(name, remember) => resolve(sheet.item, name, remember)}
          />
        )}
        {sheet?.mode === 'money' && sheet.editing && <TransactionForm key={sheet.item.id} initial={sheet.item} onSubmit={saveMoney} onDelete={() => setDeleting(sheet.item)} />}
        {sheet?.mode === 'todo' && <TodoForm key={sheet.item.id} initial={sheet.item} onSubmit={saveTodo} />}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="내역 삭제"
        message="이 내역을 삭제할까요? 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <ScrapDetail
        bookmark={scrap}
        onClose={() => setScrapId(null)}
        onOpen={openScrap}
        onEdit={() => {
          setScrapId(null)
          navigate('/scraps')
        }}
      />
    </>
  )
}

/** 결과 한 줄 */
function HitRow({ hit, terms, onOpen, onToggle }: { hit: SearchHit; terms: string[]; onOpen: () => void; onToggle?: () => void }) {
  const done = hit.kind === 'todo' && hit.item.isCompleted === 1
  return (
    <li className="flex items-center gap-2 pr-3">
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={done ? '안 한 걸로 바꾸기' : '완료하기'}
          className={`ml-4 flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${done ? 'bg-check border-transparent text-white' : 'border-slate-300'}`}
        >
          {done && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
        </button>
      )}
      <button type="button" onClick={onOpen} className={`flex min-w-0 flex-1 items-start gap-3 py-3 text-left ${onToggle ? 'pl-1' : 'pl-4'}`}>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] font-semibold ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {hit.kind === 'diary' ? `${formatDateLabel(hit.item.date)} 일기` : <Marked text={hit.title} terms={terms} />}
          </span>
          {hit.snippet && (
            <span className="mt-0.5 line-clamp-2 block text-[13px] text-slate-500">
              {hit.kind !== 'diary' && hit.field !== '금액' && <span className="mr-1 font-semibold text-slate-400">{hit.field}</span>}
              <Marked text={hit.snippet} terms={terms} />
            </span>
          )}
          <span className="mt-0.5 block text-xs text-slate-400">{meta(hit)}</span>
        </span>
        {hit.kind === 'money' && (
          <span className={`shrink-0 pt-0.5 text-[15px] font-bold tabular-nums ${hit.item.type === 'INCOME' ? 'text-income' : 'text-expense'}`}>
            {hit.item.type === 'INCOME' ? '+' : '-'}
            {formatWon(hit.item.amount)}
          </span>
        )}
      </button>
    </li>
  )
}

/** 결과 아래 작은 글씨: 날짜, 카테고리 등 */
function meta(hit: SearchHit): string {
  switch (hit.kind) {
    case 'money':
      return [formatDateLabel(hit.item.date), hit.item.category, hit.item.account].filter(Boolean).join(' · ')
    case 'todo':
      return [hit.item.dueDate ? `${formatDateLabel(hit.item.dueDate)}까지` : '날짜 없음', hit.item.isCompleted ? '끝냄' : ''].filter(Boolean).join(' · ')
    case 'diary':
      return hit.field === '사진 메모' ? '사진 메모에서 찾음' : ''
    case 'scrap':
      return [hit.item.siteName || hostOf(hit.item.url), formatDateLabel(hit.item.createdAt.slice(0, 10)), hit.item.isRead ? '' : '안 읽음'].filter(Boolean).join(' · ')
    case 'memo':
      return [`${formatDateLabel(toDateKey(new Date(hit.item.createdAt)))} ${clockLabel(hit.item.createdAt)}에 씀`, hit.folder?.name].filter(Boolean).join(' · ')
    case 'event':
      return hit.item.startDate === hit.item.endDate ? formatDateLabel(hit.item.startDate) : `${formatDateLabel(hit.item.startDate)} ~ ${formatDateLabel(hit.item.endDate)}`
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** 찾은 글자에 형광펜 */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightParts(text, terms).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded bg-brand-100 px-0.5 text-brand-700">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}

/** 검색어를 쓰기 전 안내 */
function Hint() {
  return (
    <div className="card px-5 py-6 text-sm text-slate-500">
      <p className="font-semibold text-slate-700">이런 걸 찾을 수 있어요</p>
      <ul className="mt-2 grid gap-1.5">
        <li>💸 가계부 메모 · 카테고리 · 결제 수단 · 금액 (예: 5000)</li>
        <li>✅ 할 일</li>
        <li>📔 일기 글과 사진 메모</li>
        <li>🔖 스크랩 제목 · 메모 · AI 요약 · 링크</li>
        <li>📅 캘린더 일정</li>
      </ul>
      <p className="mt-3 text-xs text-slate-400">띄어쓰기로 여러 단어를 쓰면 모두 들어 있는 것만 찾아요. 모든 기록은 이 기기 안에서만 찾아요.</p>
    </div>
  )
}
