import { formatWon } from "@/app/groups/[groupId]/format-won";

function BalanceText({ balance }) {
  if (balance > 0) {
    return <strong className="balance balance--receive">+{formatWon(balance)}</strong>;
  }

  if (balance < 0) {
    return <strong className="balance balance--send">-{formatWon(Math.abs(balance))}</strong>;
  }

  return <strong className="balance">0원</strong>;
}

export default function SettlementPanel({ settlement, memberNames, currentMemberId }) {
  const currentTotal = settlement.memberTotals.find(
    (total) => total.memberId === currentMemberId,
  );

  return (
    <section className="settlement-panel">
      <div className="panel-heading settlement-panel__heading">
        <div>
          <span className="eyebrow">최종 정산</span>
          <h2>모든 영수증을 합친 결과</h2>
        </div>
        <p>중간 송금을 상계한 뒤 실제로 필요한 송금만 표시합니다.</p>
      </div>

      {currentTotal ? (
        <div className="my-settlement">
          <div>
            <span>내가 결제한 금액</span>
            <strong>{formatWon(currentTotal.paidAmount)}</strong>
          </div>
          <div>
            <span>내가 부담할 금액</span>
            <strong>{formatWon(currentTotal.owedAmount)}</strong>
          </div>
          <div>
            <span>{currentTotal.balance >= 0 ? "받을 금액" : "보낼 금액"}</span>
            <BalanceText balance={currentTotal.balance} />
          </div>
        </div>
      ) : null}

      <div className="settlement-content">
        <div>
          <h3>참여자별 합계</h3>
          <div className="member-total-list">
            {settlement.memberTotals.map((total) => (
              <div className={total.memberId === currentMemberId ? "is-me" : ""} key={total.memberId}>
                <strong>
                  {memberNames.get(total.memberId)}
                  {total.memberId === currentMemberId ? " (나)" : ""}
                </strong>
                <span>결제 {formatWon(total.paidAmount)}</span>
                <span>부담 {formatWon(total.owedAmount)}</span>
                <BalanceText balance={total.balance} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3>최종 송금 목록</h3>
          <ol className="transfer-list">
            {settlement.transfers.map((transfer, index) => (
              <li key={`${transfer.fromMemberId}-${transfer.toMemberId}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>{memberNames.get(transfer.fromMemberId)}</strong>
                  <small>보내는 사람</small>
                </div>
                <em>→</em>
                <div>
                  <strong>{memberNames.get(transfer.toMemberId)}</strong>
                  <small>받는 사람</small>
                </div>
                <b>{formatWon(transfer.amount)}</b>
              </li>
            ))}
            {settlement.transfers.length === 0 ? (
              <li className="compact-empty">
                등록된 비용이 없거나 추가 송금 없이 정산이 맞습니다.
              </li>
            ) : null}
          </ol>
        </div>
      </div>
    </section>
  );
}
