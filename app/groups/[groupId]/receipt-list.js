import Link from "next/link";

import { formatWon } from "@/app/groups/[groupId]/format-won";

export default function ReceiptList({ groupId, receipts, selectedReceiptId, memberNames }) {
  return (
    <aside className="receipt-list-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">영수증</span>
          <h2>등록 내역</h2>
        </div>
        <span className="count-label">{receipts.length}개</span>
      </div>

      <Link className="button button--primary button--wide" href={`/groups/${groupId}/receipts/new`}>
        + 영수증 추가
      </Link>

      <nav className="receipt-navigation" aria-label="영수증 목록">
        {receipts.map((receipt) => (
          <Link
            className={`receipt-nav-card ${receipt._id === selectedReceiptId ? "is-selected" : ""}`}
            href={`/groups/${groupId}?receipt=${receipt._id}`}
            key={receipt._id}
          >
            <div>
              <strong>{receipt.store_name}</strong>
              <span>{formatWon(receipt.total_amount)}</span>
            </div>
            <p>{memberNames.get(receipt.paid_by_member_id)} 결제</p>
            <small>
              참여자 {receipt.participant_member_ids.length}명 · 메뉴 {receipt.items.length}개
            </small>
          </Link>
        ))}

        {receipts.length === 0 ? (
          <div className="compact-empty">
            <span aria-hidden="true">🧾</span>
            <p>첫 영수증을 등록해 주세요.</p>
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
