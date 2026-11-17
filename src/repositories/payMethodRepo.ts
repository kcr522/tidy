import { db as defaultDb, type TidyDB } from '../db/database'
import type { PayMethod, PayMethodKind } from '../db/types'
import { nowIso } from '../lib/date'
import { cleanLast4, MAX_PAY_METHOD_NAME } from '../lib/payMethods'

export class PayMethodError extends Error {}

export interface PayMethodInput {
  name: string
  kind: PayMethodKind
  last4?: string
}

function check(input: PayMethodInput): Pick<PayMethod, 'name' | 'kind' | 'last4'> {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (!name) throw new PayMethodError('이름을 입력해 주세요')
  if (name.length > MAX_PAY_METHOD_NAME) throw new PayMethodError(`${MAX_PAY_METHOD_NAME}자까지 쓸 수 있어요`)
  if (name === '미지정') throw new PayMethodError('이 이름은 쓸 수 없어요')
  const raw = (input.last4 ?? '').replace(/\D/g, '')
  if (raw && raw.length !== 4) throw new PayMethodError('끝 4자리는 숫자 4개로 써 주세요')
  const last4 = cleanLast4(raw)
  // 값이 없는 칸은 아예 빼 둔다 (동기화할 때 undefined 를 못 보낸다)
  return last4 ? { name, kind: input.kind, last4 } : { name, kind: input.kind }
}

/** 내 카드 · 계좌. 내역은 이름으로 이어지므로 이름을 바꾸면 그 이름으로 쓴 내역 · 고정 금액 · 적금도 같이 바꾼다 */
export function createPayMethodRepo(database: TidyDB = defaultDb) {
  async function ensureUnique(name: string, exceptId?: number) {
    const all = await database.payMethods.toArray()
    if (all.some((m) => m.name === name && m.id !== exceptId)) throw new PayMethodError('이미 있는 이름이에요')
  }

  return {
    async list(): Promise<PayMethod[]> {
      return database.payMethods.orderBy('order').toArray()
    },

    async add(input: PayMethodInput): Promise<number> {
      const v = check(input)
      await ensureUnique(v.name)
      const last = await database.payMethods.orderBy('order').last()
      const now = nowIso()
      return database.payMethods.add({ ...v, order: (last?.order ?? -1) + 1, createdAt: now, updatedAt: now })
    },

    /** 이름을 바꾸면 그 이름으로 쓴 내역도 새 이름으로 (몇 개 바꿨는지 돌려준다) */
    async update(id: number, input: PayMethodInput): Promise<number> {
      const v = check(input)
      await ensureUnique(v.name, id)
      return database.transaction('rw', [database.payMethods, database.transactions, database.recurring, database.savings], async () => {
        const before = await database.payMethods.get(id)
        if (!before) throw new PayMethodError('없는 카드 · 계좌예요')
        const now = nowIso()
        const { last4: _old, ...rest } = before
        void _old
        await database.payMethods.put({ ...rest, ...v, updatedAt: now })
        if (before.name === v.name) return 0
        const n = await database.transactions.filter((t) => t.account === before.name).modify({ account: v.name, updatedAt: now })
        await database.recurring.filter((r) => r.account === before.name).modify({ account: v.name })
        await database.savings.filter((p) => p.fromAccount === before.name).modify({ fromAccount: v.name })
        return n
      })
    },

    /** 등록만 지운다 (그 이름으로 쓴 내역은 그대로) */
    async remove(id: number): Promise<void> {
      await database.payMethods.delete(id)
    },

    /** 두 카드 · 계좌의 순서를 맞바꾼다 (같은 종류 안에서 위 · 아래로) */
    async swap(a: number, b: number): Promise<void> {
      await database.transaction('rw', database.payMethods, async () => {
        const [x, y] = await Promise.all([database.payMethods.get(a), database.payMethods.get(b)])
        if (!x || !y) return
        const ox = x.order === y.order ? y.order + 1 : y.order
        await database.payMethods.update(a, { order: ox })
        await database.payMethods.update(b, { order: x.order })
      })
    },
  }
}

export const payMethodRepo = createPayMethodRepo()
