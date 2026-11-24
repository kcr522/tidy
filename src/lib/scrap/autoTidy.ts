// 예전 스크랩 한 번에 정리 (AI 없이). 사용자 요청 2026-11-24: "정리 안 된 거 다 정리해 줘. 맞는 카테고리가 없으면 만들어서"
// 1) 제목 · 내용이 빈 스크랩은 페이지 정보로 먼저 채운다 (enrich)
// 2) 미분류만 나눈다 (사용자가 이미 넣어 둔 카테고리는 건드리지 않는다)
//    확실한 추천 → 주제(여행 · 맛집 · 운동 …)가 같은 것끼리 새 카테고리 → 아마도 추천 → 같은 해시태그끼리 새 카테고리
// 3) 무엇을 바꿨는지 남겨 두고 "되돌리기"로 되돌릴 수 있다
import type { Bookmark, ScrapCategory } from '../../db/types'
import { db } from '../../db/database'
import { nowIso } from '../date'
import { classifyText } from './classify'
import { makeSuggester, tokens } from './suggest'

/** 주제 이름(새 카테고리 이름, 12자 안)과 낱말 */
export const TOPICS: [string, RegExp][] = [
  ['여행', /여행|해외|국내\s?여행|호텔|숙소|펜션|리조트|항공|비행기|공항|일본|도쿄|오사카|후쿠오카|교토|제주|부산|강릉|여수|경주|코스|가볼\s?만한|가볼만한|당일치기|트립|travel|trip/gi],
  ['맛집', /맛집|웨이팅|오마카세|식당|노포|밥집|술집|이자카야|고깃집|맛\s?지도|먹방|런치|디너|코스요리/gi],
  ['카페', /카페|cafe|커피|디저트\s?카페|베이커리|빵집|브런치\s?카페/gi],
  ['운동', /운동|홈트|헬스|필라테스|요가|러닝|스쿼트|런지|플랭크|스트레칭|근력|유산소|다이어트\s?운동|루틴|덤벨|바디프로필/gi],
  ['뷰티', /화장|메이크업|스킨케어|피부|선크림|쿠션|틴트|립|파운데이션|올리브영|뷰티|헤어|머리\s?(스타일|묶|자르)|네일|향수/gi],
  ['패션', /코디|옷|패션|룩북|ootd|OOTD|신발|가방|니트|코트|자켓|청바지|원피스|스니커즈/gi],
  ['공부', /공부|자격증|시험|토익|영어|단어|문법|강의|인강|독서|책\s?추천|필기|노트\s?정리|스터디|코딩|개발|프로그래밍/gi],
  ['돈 · 재테크', /재테크|적금|예금|주식|etf|ETF|청약|절약|가계부|투자|연말정산|세금|신용카드|체크카드|통장|짠테크/gi],
  ['영화 · 책', /영화|드라마|넷플릭스|왓챠|티빙|웹툰|소설|책\s?추천|읽을\s?책|명작|시리즈\s?추천/gi],
  ['음악', /노래|플레이리스트|playlist|음악|앨범|콘서트|가사/gi],
  ['앱 · IT', /앱\s?추천|어플|아이폰|갤럭시|단축키|노션|엑셀|ai\s?툴|챗gpt|chatgpt|설정\s?방법|위젯/gi],
  ['반려동물', /강아지|고양이|반려견|반려묘|댕댕|냥이|펫/gi],
  ['육아', /육아|아기|이유식|유아|어린이|키즈/gi],
  ['선물', /선물|생일\s?선물|기념일|집들이\s?선물|커플\s?선물/gi],
]

/** 글에서 가장 많이 나온 주제 (두 번 이상 나오거나, 하나만 나오면 그 주제) */
export function topicOf(text: string): string | null {
  let best: string | null = null
  let bestN = 0
  for (const [name, re] of TOPICS) {
    const n = text.match(re)?.length ?? 0
    if (n > bestN) {
      best = name
      bestN = n
    }
  }
  return best
}

export interface TidyPlan {
  /** 스크랩 → 넣을 카테고리 (있는 id 또는 새로 만들 이름) */
  moves: { id: number; categoryId?: number; newName?: string }[]
  /** 새로 만들 카테고리 이름 */
  newNames: string[]
}

/** 미분류 스크랩을 어디에 넣을지 정하기 (DB를 바꾸지 않는다) */
export function planTidy(all: Bookmark[], categories: ScrapCategory[]): TidyPlan {
  const suggest = makeSuggester(categories, all)
  const byName = new Map(categories.map((c) => [c.name, c.id!]))
  const left = all.filter((b) => b.id != null && b.categoryId == null && classifyText(b).trim())
  const moves: TidyPlan['moves'] = []
  const rest: Bookmark[] = []
  const guesses = new Map<number, number>()
  // 1) 확실한 추천
  for (const b of left) {
    const s = suggest(b)
    if (s?.confidence === 'sure') moves.push({ id: b.id!, categoryId: s.categoryId })
    else {
      if (s) guesses.set(b.id!, s.categoryId)
      rest.push(b)
    }
  }
  // 2) 주제가 같은 것끼리 (있는 카테고리 이름이면 거기로, 둘 이상 모이면 새로 만든다)
  const byTopic = new Map<string, Bookmark[]>()
  for (const b of rest) {
    const t = topicOf(classifyText(b))
    if (t) byTopic.set(t, [...(byTopic.get(t) ?? []), b])
  }
  const done = new Set<number>()
  const newNames: string[] = []
  for (const [t, list] of byTopic) {
    const have = byName.get(t)
    if (have == null && list.length < 2) continue
    if (have == null) newNames.push(t)
    for (const b of list) {
      moves.push(have != null ? { id: b.id!, categoryId: have } : { id: b.id!, newName: t })
      done.add(b.id!)
    }
  }
  // 3) 아마도 추천
  const rest2: Bookmark[] = []
  for (const b of rest) {
    if (done.has(b.id!)) continue
    const g = guesses.get(b.id!)
    if (g != null) moves.push({ id: b.id!, categoryId: g })
    else rest2.push(b)
  }
  // 4) 같은 해시태그가 셋 이상 모이면 그 해시태그 이름으로
  const tagCount = new Map<string, Bookmark[]>()
  for (const b of rest2) for (const w of new Set(tokens(classifyText(b)).filter((x) => x.startsWith('#')))) tagCount.set(w, [...(tagCount.get(w) ?? []), b])
  const tags = [...tagCount.entries()].filter(([, l]) => l.length >= 3).sort((a, z) => z[1].length - a[1].length)
  const used = new Set<number>()
  for (const [tag, list] of tags) {
    const name = tag.slice(1, 13)
    const free = list.filter((b) => !used.has(b.id!))
    if (free.length < 3) continue
    const have = byName.get(name)
    if (have == null && !newNames.includes(name)) newNames.push(name)
    for (const b of free) {
      used.add(b.id!)
      moves.push(have != null ? { id: b.id!, categoryId: have } : { id: b.id!, newName: name })
    }
  }
  return { moves, newNames }
}

export interface TidyResult {
  moved: number
  created: string[]
  /** 되돌리기에 쓴다 */
  undo: { ids: number[]; categoryIds: number[] }
}

/** 정한 대로 바꾸기. 그사이 사용자가 나눈 스크랩은 건드리지 않는다 */
export async function applyTidy(plan: TidyPlan): Promise<TidyResult> {
  return db.transaction('rw', db.bookmarks, db.scrapCategories, async () => {
    const cats = new Map((await db.scrapCategories.toArray()).map((c) => [c.name, c.id as number]))
    let order = ((await db.scrapCategories.orderBy('order').last())?.order ?? -1) + 1
    const created: string[] = []
    const createdIds: number[] = []
    const idFor = async (name: string) => {
      const have = cats.get(name)
      if (have != null) return have
      const id = (await db.scrapCategories.add({ name, order: order++, createdAt: nowIso() })) as number
      cats.set(name, id)
      created.push(name)
      createdIds.push(id)
      return id
    }
    const ids: number[] = []
    for (const m of plan.moves) {
      const b = await db.bookmarks.get(m.id)
      if (!b || b.categoryId != null) continue
      const categoryId = m.categoryId ?? (m.newName ? await idFor(m.newName) : undefined)
      if (categoryId == null) continue
      await db.bookmarks.update(m.id, { categoryId, updatedAt: nowIso() })
      ids.push(m.id)
    }
    return { moved: ids.length, created, undo: { ids, categoryIds: createdIds } }
  })
}

/** 되돌리기: 옮긴 스크랩은 미분류로, 새로 만든 카테고리는 비어 있으면 지운다 */
export async function undoTidy(undo: TidyResult['undo']): Promise<void> {
  await db.transaction('rw', db.bookmarks, db.scrapCategories, async () => {
    for (const id of undo.ids) {
      await db.bookmarks
        .where('id')
        .equals(id)
        .modify((b) => {
          delete b.categoryId
        })
    }
    for (const id of undo.categoryIds) {
      if ((await db.bookmarks.where('categoryId').equals(id).count()) === 0) await db.scrapCategories.delete(id)
    }
  })
}
