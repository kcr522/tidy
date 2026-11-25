import { highlightParts } from '../../lib/search'

/** 찾은 글자에 형광펜 (전체 검색 · 스크랩 검색) */
export default function Marked({ text, terms }: { text: string; terms: string[] }) {
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
