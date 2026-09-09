"use client";

import { deleteReceiptAction } from "@/app/groups/[groupId]/actions";

export default function DeleteReceiptForm({ groupId, receiptId }) {
  const action = deleteReceiptAction.bind(null, groupId, receiptId);

  function confirmDeletion(event) {
    if (!window.confirm("이 영수증과 메뉴별 결제 상태를 모두 삭제할까요?")) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={confirmDeletion}>
      <button className="button button--danger" type="submit">
        삭제
      </button>
    </form>
  );
}
