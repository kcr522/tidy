import { useState } from 'react'
import { categoryEmoji } from '../../lib/categories'
import { brandShort, brandTextColor, logoUrl, type Brand } from '../../lib/merchants'

/** 내역 동그라미: 브랜드면 로고, 아니면 카테고리 그림 */
export default function MerchantAvatar({ brand, category, size = 40 }: { brand: Brand | null; category: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }

  if (!brand) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full bg-grad-soft" style={{ ...style, fontSize: size * 0.45 }} aria-hidden>
        {categoryEmoji(category)}
      </span>
    )
  }

  if (failed) {
    const short = brandShort(brand)
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full font-extrabold tracking-tight"
        style={{ ...style, background: brand.color, color: brandTextColor(brand.color), fontSize: size * (short.length >= 3 ? 0.27 : 0.34) }}
        aria-hidden
      >
        {short}
      </span>
    )
  }

  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200" style={style} aria-hidden>
      <img
        src={logoUrl(brand)}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="size-[62%] object-contain"
        // 아이콘이 없으면 구글이 16px 기본 지구본을 준다 → 너무 작으면 대신 글자 동그라미
        onLoad={(e) => e.currentTarget.naturalWidth < 24 && setFailed(true)}
        onError={() => setFailed(true)}
      />
    </span>
  )
}
