import Link from "next/link";

import { updatePaymentStatusAction } from "@/app/groups/[groupId]/actions";
import DeleteReceiptForm from "@/app/groups/[groupId]/delete-receipt-form";
import { formatWon } from "@/app/groups/[groupId]/format-won";
import { calculateReceiptItemShares } from "@/lib/settlement-summary.mjs";

function MemberTags({ memberIds, memberNames }) {
  return (
    <div className="member-tags">
      {memberIds.map((memberId) => (
        <span key={memberId}>{memberNames.get(memberId) || "알 수 없음"}</span>
      ))}
    </div>
  );
}

export default function ReceiptDetail({
  groupId,
  receipt,
  payments,
  memberNames,
  currentMemberId,
  canManage,
  isOwner,
}) {
  if (!receipt) {
    return (
      <section className="receipt-detail-panel receipt-detail-panel--empty">
        <span aria-hidden="true">🧮</span>
        <h2>영수증을 추가해 주세요.</h2>
        <p>메뉴마다 함께 먹은 사람을 선택하면 부담 금액을 계산합니다.</p>
        <Link className="button button--primary" href={`/groups/${groupId}/receipts/new`}>
          첫 영수증 추가
        </Link>
      </section>
    );
  }

  const shareResults = calculateReceiptItemShares(receipt);
  const sharesByItemId = new Map(
    shareResults.map((shareResult) => [shareResult.itemId, shareResult.shares]),
  );
  const paymentsByItemAndMember = new Map(
    payments.map((payment) => [
      `${payment.expense_item_id}:${payment.payer_member_id}`,
      payment,
    ]),
  );
  const paymentAction = updatePaymentStatusAction.bind(null, groupId);

  return (
    <section className="receipt-detail-panel">
      <div className="receipt-detail-heading">
        <div>
          <span className="eyebrow">영수증 상세</span>
          <h2>{receipt.store_name}</h2>
          <p>
            {memberNames.get(receipt.paid_by_member_id)} 결제 · {formatWon(receipt.total_amount)}
          </p>
        </div>
        {canManage ? (
          <div className="receipt-actions">
            <Link
              className="button button--quiet"
              href={`/groups/${groupId}/receipts/${receipt._id}/edit`}
            >
              수정
            </Link>
            <DeleteReceiptForm groupId={groupId} receiptId={receipt._id} />
          </div>
        ) : null}
      </div>

      <div className="receipt-participants">
        <strong>영수증 참여자</strong>
        <MemberTags
          memberIds={receipt.participant_member_ids}
          memberNames={memberNames}
        />
      </div>

      <div className="menu-detail-list">
        {receipt.items.map((item, index) => (
          <article className="menu-detail-card" key={item._id}>
            <div className="menu-detail-card__heading">
              <span>{index + 1}</span>
              <div>
                <strong>{item.menu_name}</strong>
                <p>{formatWon(item.line_total)}</p>
              </div>
            </div>
            <div className="share-list">
              {sharesByItemId.get(item._id).map((share) => {
                const payment = paymentsByItemAndMember.get(
                  `${item._id}:${share.memberId}`,
                );
                const canChangeStatus =
                  payment &&
                  payment.payer_member_id !== payment.payee_member_id &&
                  (isOwner || payment.payer_member_id === currentMemberId);

                return (
                  <div className="share-row" key={share.memberId}>
                    <div>
                      <span className="member-avatar member-avatar--small" aria-hidden="true">
                        {(memberNames.get(share.memberId) || "?").slice(0, 1)}
                      </span>
                      <strong>{memberNames.get(share.memberId)}</strong>
                    </div>
                    <span>{formatWon(share.amount)}</span>
                    <span className={`payment-status payment-status--${payment?.status || "unpaid"}`}>
                      {payment?.status === "paid" ? "확인 완료" : "미확인"}
                    </span>
                    {canChangeStatus ? (
                      <form action={paymentAction}>
                        <input name="payment_id" type="hidden" value={payment._id} />
                        <input
                          name="status"
                          type="hidden"
                          value={payment.status === "paid" ? "unpaid" : "paid"}
                        />
                        <button className="text-button" type="submit">
                          {payment.status === "paid" ? "취소" : "확인"}
                        </button>
                      </form>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <p className="receipt-detail-note">
        나누어떨어지지 않는 금액은 저장할 때 선택된 참여자에게 10원씩 추가되며,
        이후 같은 조건에서는 바뀌지 않습니다.
      </p>
    </section>
  );
}
