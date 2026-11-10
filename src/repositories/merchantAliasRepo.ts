import { db as defaultDb, type TidyDB } from '../db/database'
import type { MerchantAlias } from '../db/types'
import { normalizeName } from '../lib/merchants'

export function createMerchantAliasRepo(database: TidyDB = defaultDb) {
  return {
    async find(original: string): Promise<MerchantAlias | undefined> {
      const raw = normalizeName(original)
      return raw ? database.merchantAliases.get(raw) : undefined
    },

    async list(): Promise<MerchantAlias[]> {
      return (await database.merchantAliases.toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    async remove(raw: string): Promise<void> {
      await database.merchantAliases.delete(raw)
    },
  }
}

export const merchantAliasRepo = createMerchantAliasRepo()
