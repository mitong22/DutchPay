import styles from "../groupBoard.module.css";
import {
  calculateGroupSettlement,
  calculateSettlementTransfers,
  findMember,
  formatWon,
} from "@/lib/receiptStore";

export default function ReceiptList({
  currentMemberId,
  group,
  isReadOnly,
  receipts,
  onAdd,
  onSelect,
}) {
  const orderedMembers = [
    ...group.members.filter((member) => member.member_type === "registered"),
    ...group.members.filter((member) => member.member_type !== "registered"),
  ];
  const groupSettlement = calculateGroupSettlement(group, receipts);
  const settlementByMember = new Map(
    groupSettlement.memberTotals.map((memberTotal) => [
      memberTotal.memberId,
      memberTotal,
    ]),
  );
  const settlementTransfers = calculateSettlementTransfers(
    groupSettlement.memberTotals,
  );

  return (
    <>
      <section className={styles.boardIntro} aria-labelledby="board-title">
        <div>
          <p className={styles.eyebrow}>{group.name}</p>
          <h1 id="board-title">모임 영수증을 모아볼게요</h1>
          <p>영수증마다 결제자와 함께 먹은 사람을 기록해요.</p>
        </div>
        <span className={styles.receiptCount}>{receipts.length}장 등록</span>
      </section>

      <section className={styles.memberStrip} aria-label="현재 모임 멤버">
        <div className={styles.memberList}>
          {orderedMembers.map((member) => {
            const isCaptain = member.member_type === "registered";
            const isCurrentMember = member.id === currentMemberId;

            return (
              <span
                className={`${styles.member} ${
                  isCaptain ? styles.captainMember : ""
                }`}
                key={member.id}
              >
                {isCaptain && (
                  <span className={styles.captainBadge}>총대</span>
                )}
                <span
                  className={`${styles.memberAvatar} ${
                    isCurrentMember ? styles.currentMemberAvatar : ""
                  }`}
                  title={member.nickname}
                  aria-current={isCurrentMember ? "true" : undefined}
                  aria-label={`${member.nickname}${
                    isCaptain ? " 총대" : ""
                  }${isCurrentMember ? " 현재 사용자" : ""}`}
                >
                  {member.nickname.slice(0, 2)}
                </span>
              </span>
            );
          })}
        </div>
        <p>총 {group.members.length}명</p>
      </section>

      <div className={styles.boardColumns}>
        <div className={styles.receiptColumn}>
          <div className={styles.listHeading}>
            <h2>모임 영수증</h2>
            <p>결제자와 참여 인원 포함</p>
          </div>

          <section className={styles.receiptList} aria-label="영수증 목록">
            {receipts.map((receipt) => {
              const payer = findMember(group, receipt.paid_by_member_id);
              const participantCount =
                receipt.participant_member_ids?.length ?? 0;
              const itemCount = receipt.items?.length ?? 0;

              return (
                <button
                  className={styles.receiptRow}
                  type="button"
                  key={receipt.id}
                  onClick={() => onSelect(receipt.id)}
                >
                  <span className={styles.receiptPrimary}>
                    <strong>{receipt.title}</strong>
                    <small>
                      참여 {participantCount}명 · 메뉴 {itemCount}개
                    </small>
                  </span>
                  <span className={styles.receiptMeta}>
                    <strong>{formatWon(receipt.total_amount)}</strong>
                    <small>{payer?.nickname ?? "결제자 미정"} 결제</small>
                  </span>
                </button>
              );
            })}

            {!isReadOnly && (
              <button
                className={styles.addReceiptRow}
                type="button"
                onClick={onAdd}
              >
                <span className={styles.addIcon} aria-hidden="true">
                  +
                </span>
                <span>
                  <strong>
                    {receipts.length === 0 ? "첫 영수증 추가" : "영수증 추가"}
                  </strong>
                  <small>직접 입력 · 촬영하기 · 사진 첨부</small>
                </span>
              </button>
            )}
          </section>
        </div>

        <section
          className={styles.settlementOverview}
          aria-labelledby="settlement-overview-title"
        >
        <div className={styles.settlementOverviewHeading}>
          <div>
            <p className={styles.eyebrow}>현재까지</p>
            <h2 id="settlement-overview-title">사람별 정산 현황</h2>
          </div>
          <span className={styles.settlementGrandTotal}>
            <small>{receipts.length}장 합계</small>
            <strong>{formatWon(groupSettlement.totalAmount)}</strong>
          </span>
        </div>

        {receipts.length > 0 ? (
          <div className={styles.settlementMemberList}>
            {orderedMembers.map((member) => {
              const memberTotal = settlementByMember.get(member.id) ?? {
                paidAmount: 0,
                owedAmount: 0,
                balance: 0,
              };
              const isCaptain = member.member_type === "registered";
              const isCurrentMember = member.id === currentMemberId;
              const balanceType =
                memberTotal.balance > 0
                  ? "receive"
                  : memberTotal.balance < 0
                    ? "send"
                    : "settled";
              const balanceLabel =
                balanceType === "receive"
                  ? "받을 돈"
                  : balanceType === "send"
                    ? "보낼 돈"
                    : "정산 완료";
              const balancePrefix =
                memberTotal.balance > 0
                  ? "+"
                  : memberTotal.balance < 0
                    ? "−"
                    : "";

              return (
                <article
                  className={`${styles.settlementMemberRow} ${
                    isCurrentMember ? styles.currentSettlementRow : ""
                  }`}
                  key={member.id}
                >
                  <div className={styles.settlementMemberIdentity}>
                    <span
                      className={`${styles.detailAvatar} ${
                        isCaptain ? styles.captainDetailAvatar : ""
                      } ${
                        isCurrentMember ? styles.currentDetailAvatar : ""
                      }`}
                      aria-hidden="true"
                    >
                      {member.nickname.slice(0, 2)}
                    </span>
                    <span>
                      <strong>{member.nickname}</strong>
                      <small>
                        {isCaptain ? "총대" : "참여자"}
                        {isCurrentMember ? " · 나" : ""}
                      </small>
                    </span>
                  </div>

                  <dl className={styles.settlementNumbers}>
                    <div>
                      <dt>결제</dt>
                      <dd>{formatWon(memberTotal.paidAmount)}</dd>
                    </div>
                    <div>
                      <dt>부담</dt>
                      <dd>{formatWon(memberTotal.owedAmount)}</dd>
                    </div>
                  </dl>

                  <div
                    className={`${styles.settlementBalance} ${
                      styles[`${balanceType}Balance`]
                    }`}
                  >
                    <span>{balanceLabel}</span>
                    <strong>
                      {balancePrefix}
                      {formatWon(Math.abs(memberTotal.balance))}
                    </strong>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.emptySettlement}>
            영수증을 추가하면 사람별 금액이 여기에 계산돼요.
          </p>
        )}

        <p className={styles.settlementNote}>
          각 메뉴에서 선택한 사람을 기준으로 계산했어요.
        </p>

        <section
          className={styles.transferOverview}
          aria-labelledby="transfer-overview-title"
        >
          <div className={styles.transferHeading}>
            <div>
              <p className={styles.eyebrow}>최종 송금</p>
              <h3 id="transfer-overview-title">이대로 보내면 끝나요</h3>
            </div>
            <span>{settlementTransfers.length}건</span>
          </div>

          {settlementTransfers.length > 0 ? (
            <div className={styles.transferList}>
              {settlementTransfers.map((transfer) => {
                const fromMember = findMember(
                  group,
                  transfer.fromMemberId,
                );
                const toMember = findMember(group, transfer.toMemberId);

                return (
                  <article
                    className={styles.transferRow}
                    key={transfer.id}
                    aria-label={`${fromMember?.nickname ?? "알 수 없음"}에서 ${
                      toMember?.nickname ?? "알 수 없음"
                    }에게 ${formatWon(transfer.amount)} 송금`}
                  >
                    <div className={styles.transferRoute}>
                      <span className={styles.transferParty}>
                        <span
                          className={`${styles.transferAvatar} ${
                            fromMember?.id === currentMemberId
                              ? styles.currentTransferAvatar
                              : ""
                          }`}
                          aria-hidden="true"
                        >
                          {fromMember?.nickname.slice(0, 2) ?? "?"}
                        </span>
                        <strong>{fromMember?.nickname ?? "알 수 없음"}</strong>
                      </span>

                      <span className={styles.transferArrow} aria-hidden="true">
                        →
                      </span>

                      <span className={styles.transferParty}>
                        <span
                          className={`${styles.transferAvatar} ${
                            toMember?.id === currentMemberId
                              ? styles.currentTransferAvatar
                              : ""
                          }`}
                          aria-hidden="true"
                        >
                          {toMember?.nickname.slice(0, 2) ?? "?"}
                        </span>
                        <strong>{toMember?.nickname ?? "알 수 없음"}</strong>
                      </span>
                    </div>
                    <strong className={styles.transferAmount}>
                      {formatWon(transfer.amount)}
                    </strong>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.noTransfers}>
              <span aria-hidden="true">✓</span>
              <p>
                <strong>주고받을 돈이 없어요.</strong>
                <small>현재까지 정산이 모두 맞아요.</small>
              </p>
            </div>
          )}
        </section>
        </section>
      </div>
    </>
  );
}
