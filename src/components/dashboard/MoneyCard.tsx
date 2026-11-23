import { useLiveQuery } from "dexie-react-hooks";
import { Wallet } from "lucide-react";
import type { Transaction } from "../../db/types";
import { budgetStatus } from "../../lib/budget";
import { formatWon } from "../../lib/format";
import { budgetRepo } from "../../repositories/budgetRepo";
import { monthSummary, todayExpense, usageRate } from "../../lib/summary";
import DashboardCard, { CardEmpty } from "./DashboardCard";

interface MoneyCardProps {
  month: number;
  /** 이번 달 내역 */
  items: Transaction[];
  today: string;
  onAdd: () => void;
}

/** 가계부 카드: 이번 달 수입, 지출, 오늘 지출, 사용률 막대 (FR-051) */
export default function MoneyCard({
  month,
  items,
  today,
  onAdd,
}: MoneyCardProps) {
  const summary = monthSummary(items);
  const rate = usageRate(summary);
  const budgets = useLiveQuery(() => budgetRepo.list(), []);
  const status = budgets
    ? budgetStatus(budgets, items, today.slice(0, 7), today)
    : null;
  const budget = status?.total;

  return (
    <DashboardCard
      to="/money"
      icon={Wallet}
      title={`${month}월 가계부`}
      addLabel="수입/지출 추가"
      onAdd={onAdd}
      vivid
    >
      {items.length === 0 ? (
        <CardEmpty vivid>
          이번 달 기록이 없어요. + 를 눌러 첫 내역을 남겨 보세요.
        </CardEmpty>
      ) : (
        <>
          <p className="text-sm opacity-85">이번 달 쓴 돈</p>
          <p className="mt-0.5 text-[28px] leading-tight font-extrabold tracking-tight">
            {formatWon(summary.expense)}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="수입" value={formatWon(summary.income)} />
            <Stat
              label="오늘 지출"
              value={formatWon(todayExpense(items, today))}
            />
          </dl>
          {budget ? (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="opacity-85">
                  예산 {formatWon(budget.budget)}
                </span>
                <span className="font-bold">{budget.pct}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-on-soft"
                role="progressbar"
                aria-label="예산 사용"
                aria-valuenow={budget.pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-current transition-all"
                  style={{ width: `${Math.min(budget.pct, 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs font-semibold">
                {budget.left >= 0
                  ? `${formatWon(budget.left)} 남았어요${status?.perDay != null ? ` · 하루 ${formatWon(status.perDay)}씩` : ""}`
                  : `예산을 ${formatWon(-budget.left)} 넘었어요`}
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="opacity-85">수입 대비 사용률</span>
                <span className="font-bold">
                  {rate === null ? "-" : `${rate}%`}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-on-soft"
                role="progressbar"
                aria-label="사용률"
                aria-valuenow={rate ?? undefined}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-current transition-all"
                  style={{ width: `${Math.min(rate ?? 0, 100)}%` }}
                />
              </div>
              {rate === null && (
                <p className="mt-1.5 text-xs opacity-85">
                  수입을 기록하면 사용률이 보여요
                </p>
              )}
              {rate !== null && rate >= 100 && (
                <p className="mt-1.5 text-xs font-semibold">
                  이번 달 수입보다 많이 썼어요
                </p>
              )}
            </div>
          )}
        </>
      )}
    </DashboardCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="@container min-w-0 rounded-2xl bg-on-soft px-3 py-2.5">
      <dt className="text-xs opacity-85">{label}</dt>
      {/* 칸이 좁으면(분할 화면) 숫자가 두 줄로 쪼개지지 않게 글자를 줄인다 */}
      <dd className="mt-0.5 truncate text-[min(1rem,15.5cqw)] font-bold">{value}</dd>
    </div>
  );
}
