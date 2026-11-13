import type { LinkSource } from '../../lib/scrap/link'
import { SOURCE_LABEL } from '../../lib/scrap/link'

const STYLE: Record<LinkSource, string> = {
  instagram: 'bg-[linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)] text-white',
  naver: 'bg-[#03c75a] text-white',
  x: 'bg-slate-900 text-white',
  youtube: 'bg-[#ff0033] text-white',
  web: 'bg-slate-100 text-slate-500',
}

/** 어디서 온 링크인지 작은 딱지 */
export default function SourceBadge({ source, className = '' }: { source: string | undefined; className?: string }) {
  const s = (source && source in STYLE ? source : 'web') as LinkSource
  if (s === 'web') return null
  return <span className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-extrabold tracking-tight ${STYLE[s]} ${className}`}>{SOURCE_LABEL[s]}</span>
}
