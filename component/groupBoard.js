"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import ReceiptDetail from "./group/receiptDetail";
import ReceiptEntryDialog from "./group/receiptEntryDialog";
import ReceiptList from "./group/receiptList";
import styles from "./groupBoard.module.css";
import { findMember } from "@/lib/receiptUtils";

export { calculateGroupSettlement } from "@/lib/receiptUtils";

export default function GroupBoard({
  currentMemberId,
  group,
  isCaptain,
  receiptId = null,
  onBack,
  onBackToGroup,
  onComplete,
  onOpenReceipt,
}) {
  const router = useRouter();
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [isCompletionConfirming, setIsCompletionConfirming] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const receipts = group.receipts ?? [];
  const selectedReceipt = receipts.find(
    (receipt) => receipt.id === receiptId,
  );
  const currentMember = findMember(group, currentMemberId);
  const isCompleted = group.status === "COMPLETED";

  async function requestReceipt(path, options) {
    const response = await fetch(path, options);
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message ?? "영수증을 처리하지 못했어요.");
    }

    router.refresh();
    return result;
  }

  async function saveReceipt(receipt) {
    const isEditing = receipts.some(
      (currentReceipt) => currentReceipt.id === receipt.id,
    );
    const path = isEditing
      ? `/api/groups/${encodeURIComponent(group.id)}/receipts/${encodeURIComponent(receipt.id)}`
      : `/api/groups/${encodeURIComponent(group.id)}/receipts`;

    await requestReceipt(path, {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(receipt),
    });
    return true;
  }

  async function deleteReceipt(receiptId) {
    const path = `/api/groups/${encodeURIComponent(group.id)}/receipts/${encodeURIComponent(receiptId)}`;
    const response = await fetch(path, { method: "DELETE" });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message ?? "영수증을 삭제하지 못했어요.");
    }

    showReceiptList();
    router.refresh();
    return true;
  }

  function showReceipt(nextReceiptId) {
    onOpenReceipt(nextReceiptId);
  }

  function showReceiptList() {
    onBackToGroup();
  }

  return (
    <main className={styles.boardMain}>
      {/* // Teacher: Client의 isCaptain·canEdit는 버튼 표시를 위한 값입니다. API의 getGroupCredentials와 lib의 assertReceiptEditor가 실제 저장 권한을 다시 검사하는지 호출 경로를 찾아보기. */}
      <nav className={styles.boardNavigation} aria-label="모임 화면 탐색">
        <button type="button" onClick={onBack}>← 대시보드</button>
        <div className={styles.boardStatusActions}>
          <span>
            {group.mode === "TOGETHER" ? "함께하기" : "혼자하기"} · {isCaptain ? "총대 계정에 저장됨" : "초대 참여자 화면"}
          </span>
          {isCompleted ? (
            <strong className={styles.completedBadge}>✓ 정산 완료</strong>
          ) : null}
        </div>
      </nav>

      {selectedReceipt ? (
        <ReceiptDetail
          canEdit={
            !isCompleted &&
            (isCaptain ||
              selectedReceipt.uploaded_by_member_id === currentMemberId)
          }
          currentMemberId={currentMemberId}
          group={group}
          isReadOnly={isCompleted}
          receipt={selectedReceipt}
          onBack={showReceiptList}
          onDelete={deleteReceipt}
          onUpdate={saveReceipt}
        />
      ) : (
        <>
          <ReceiptList
            currentMemberId={currentMemberId}
            group={group}
            isReadOnly={isCompleted}
            receipts={receipts}
            onAdd={() => setIsReceiptDialogOpen(true)}
            onSelect={showReceipt}
          />

          {isCaptain && !isCompleted && (
            <div className={styles.completionFooter}>
              {isCompletionConfirming ? (
                <section className={styles.completionConfirmation} role="alert">
                  <div>
                    <strong>현재 금액으로 정산을 완료할까요?</strong>
                    <p>완료하면 영수증은 그대로 보관되고 수정할 수 없어요.</p>
                  </div>
                  {completionError && <p>{completionError}</p>}
                  <div>
                    <button
                      type="button"
                      onClick={() => setIsCompletionConfirming(false)}
                    >
                      취소
                    </button>
                    <button
                      className={styles.confirmCompleteButton}
                      type="button"
                      disabled={isCompleting}
                      onClick={async () => {
                        setIsCompleting(true);
                        setCompletionError("");

                        try {
                          await onComplete();
                          setIsCompletionConfirming(false);
                        } catch (error) {
                          setCompletionError(error.message);
                        } finally {
                          setIsCompleting(false);
                        }
                      }}
                    >
                      {isCompleting ? "완료 중..." : "완료 확정"}
                    </button>
                  </div>
                </section>
              ) : (
                <button
                  className={styles.completeButton}
                  type="button"
                  disabled={receipts.length === 0}
                  onClick={() => setIsCompletionConfirming(true)}
                >
                  정산 완료
                </button>
              )}
            </div>
          )}
        </>
      )}

      {isReceiptDialogOpen && (
        <ReceiptEntryDialog
          currentMemberId={currentMemberId}
          group={group}
          onClose={() => setIsReceiptDialogOpen(false)}
          onSave={async (receipt) => {
            await saveReceipt(receipt);
            setIsReceiptDialogOpen(false);
            return true;
          }}
        />
      )}
    </main>
  );
}
