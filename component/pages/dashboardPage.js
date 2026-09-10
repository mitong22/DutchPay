import { calculateGroupSettlement } from "../groupBoard";
import styles from "../app.module.css";
import {
  formatSavedDate,
  formatWon,
} from "@/lib/demoStore";

export default function DashboardPage({
  captain,
  groups,
  onCreate,
  onOpenGroup,
}) {
  const groupSummaries = groups.map((group) => {
    const receiptSummary = {
      receipts: group.receipts ?? [],
      count: group.receipts?.length ?? 0,
    };
    const settlement = calculateGroupSettlement(
      group,
      receiptSummary.receipts,
    );
    const captainMember = group.members.find(
      (member) => member.user_id === captain.user_id,
    );
    const captainBalance =
      settlement.memberTotals.find(
        (memberTotal) => memberTotal.memberId === captainMember?.id,
      )?.balance ?? 0;

    return { group, receiptSummary, captainBalance };
  });
  const activeSummaries = groupSummaries.filter(
    ({ group }) => group.status !== "COMPLETED",
  );
  const sortedGroupSummaries = [...groupSummaries].sort(
    (left, right) =>
      Number(left.group.status === "COMPLETED") -
      Number(right.group.status === "COMPLETED"),
  );
  const receiveAmount = activeSummaries.reduce(
    (total, summary) => total + Math.max(summary.captainBalance, 0),
    0,
  );
  const sendAmount = activeSummaries.reduce(
    (total, summary) => total + Math.max(-summary.captainBalance, 0),
    0,
  );
  return (
    <main className={styles.dashboardMain}>
      <section className={styles.dashboardHero} aria-labelledby="dashboard-title">
        <div>
          <p className={styles.eyebrow}>총대 대시보드</p>
          <h1 id="dashboard-title">{captain.nickname}님의 정산</h1>
          <p>만들었던 모임과 진행 중인 정산을 여기서 다시 열 수 있어요.</p>
        </div>
        <button className={styles.newGroupButton} type="button" onClick={onCreate}>
          + 새 정산 시작
        </button>
      </section>

      <section
        className={styles.balanceSpotlight}
        aria-labelledby="balance-spotlight-title"
      >
        <div className={styles.balanceSpotlightIntro}>
          <span><i aria-hidden="true" /> 진행 중인 정산</span>
          <h2 id="balance-spotlight-title">지금 내 돈 흐름</h2>
          <p>정산 완료 전 모임에서 주고받을 금액을 모두 모았어요.</p>
        </div>
        <dl className={styles.balanceCards}>
          <div className={styles.receiveCard}>
            <dt>내가 받을 돈</dt>
            <dd>{formatWon(receiveAmount)}</dd>
          </div>
          <div className={styles.sendCard}>
            <dt>내가 보낼 돈</dt>
            <dd>{formatWon(sendAmount)}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.dashboardSection} aria-labelledby="saved-title">
        <div className={styles.sectionHeadingRow}>
          <div>
            <p className={styles.eyebrow}>내 정산</p>
            <h2 id="saved-title">정산 목록</h2>
          </div>
        </div>

        {groupSummaries.length > 0 ? (
          <div className={styles.savedGroupList}>
            {sortedGroupSummaries.map(({ group, receiptSummary, captainBalance }) => {
              const isCompleted = group.status === "COMPLETED";
              const balanceLabel =
                captainBalance > 0
                  ? isCompleted
                    ? "받은 돈"
                    : "받을 돈"
                  : captainBalance < 0
                    ? isCompleted
                      ? "보낸 돈"
                      : "보낼 돈"
                    : "정산 없음";

              return (
                <button
                  className={styles.savedGroupCard}
                  type="button"
                  key={group.id}
                  onClick={() => onOpenGroup(group.id)}
                >
                  <span className={styles.groupCardMain}>
                    <span className={styles.groupBadges}>
                      <span className={styles.groupModeBadge}>
                        {group.mode === "TOGETHER" ? "함께하기" : "혼자하기"}
                      </span>
                      <span
                        className={`${styles.groupStatusBadge} ${
                          isCompleted
                            ? styles.completedStatus
                            : styles.activeStatus
                        }`}
                      >
                        {isCompleted ? "정산 완료" : "정산 중"}
                      </span>
                    </span>
                    <strong>{group.name}</strong>
                    <small>
                      {group.members?.length ?? 0}명 · {receiptSummary.count}장 · {formatSavedDate(
                        group.completed_at ??
                          group.activated_at ??
                          group.created_at,
                      )}
                    </small>
                  </span>
                  <span className={styles.groupCardBalance}>
                    <small>{balanceLabel}</small>
                    <strong
                      className={
                        isCompleted
                          ? ""
                          : captainBalance > 0
                          ? styles.receiveText
                          : captainBalance < 0
                            ? styles.sendText
                            : ""
                      }
                    >
                      {formatWon(Math.abs(captainBalance))}
                    </strong>
                  </span>
                  <span className={styles.cardArrow} aria-hidden="true">→</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyDashboard}>
            <span aria-hidden="true">＋</span>
            <strong>아직 저장된 정산이 없어요.</strong>
            <p>새 정산을 시작하면 총대 계정의 목록에 남아요.</p>
          </div>
        )}
      </section>
    </main>
  );
}
