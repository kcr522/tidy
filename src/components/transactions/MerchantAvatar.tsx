import { useState, useSyncExternalStore } from 'react'
import { categorySnapshot, SAVING_CATEGORY, subscribeCategories } from '../../lib/categories'
import { categoryIcon } from '../common/MoneyIcon'
import { brandShort, brandTextColor, logoUrls, type Brand } from '../../lib/merchants'

/** 내역 동그라미: 브랜드면 로고, 아니면 카테고리 그림 */
export default function MerchantAvatar({ brand, category, size = 40 }: { brand: Brand | null; category: string; size?: number }) {
  // 몇 번째 로고 주소를 쓰는 중인지 (앱에 넣어 둔 아이콘 → 홈페이지 아이콘 → 글자 동그라미)
  const [at, setAt] = useState({ name: brand?.name, tried: 0 })
  // 카테고리 아이콘을 바꾸면 다시 그린다
  useSyncExternalStore(subscribeCategories, categorySnapshot)
  // 다른 가게로 바뀌면 처음 주소부터 다시
  const tried = at.name === brand?.name ? at.tried : 0
  const urls = brand ? logoUrls(brand) : []
  const failed = tried >= urls.length
  const next = () => setAt({ name: brand?.name, tried: tried + 1 })
  const style = { width: size, height: size }

  // 브랜드가 없으면 카테고리를 테두리만 있는 아이콘으로 (사용자 요청 2026-11-23)
  if (!brand) {
    const Icon = categoryIcon(category)
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-full bg-grad-soft ${category === SAVING_CATEGORY ? 'text-saving' : 'text-brand-600'}`} style={style} aria-hidden>
        <Icon style={{ width: size * 0.48, height: size * 0.48 }} strokeWidth={1.9} />
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

  // 앱 아이콘은 동그라미를 꽉 채우고, 옆으로 긴 로고 그림(.png)은 넓게, 홈페이지 아이콘은 여백을 둔다
  const appIcon = urls[tried].endsWith('.webp')
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200" style={style} aria-hidden>
      <img
        key={urls[tried]}
        src={urls[tried]}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className={appIcon ? 'size-full object-cover' : urls[tried].endsWith('.png') ? 'w-[84%] object-contain' : 'size-[62%] object-contain'}
        // 아이콘이 없으면 구글이 16px 기본 지구본을 준다 → 너무 작으면 다음 것(결국 글자 동그라미)
        onLoad={(e) => e.currentTarget.naturalWidth < 24 && next()}
        onError={next}
      />
    </span>
  )
}
