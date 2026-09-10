"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import ReceiptDetail from "./group/receiptDetail";
import ReceiptEntryDialog from "./group/receiptEntryDialog";
import ReceiptList from "./group/receiptList";
import styles from "./groupBoard.module.css";
import {
  appendReceipt,
  findMember,
  getReceiptsSnapshot,
  parseReceipts,
  removeReceipt,
  replaceReceipt,
  subscribeToReceipts,
} from "@/lib/receiptStore";

export { calculateGroupSettlement } from "@/lib/receiptStore";

export default function GroupBoard({
  currentMemberId,
  group,
  receiptId = null,
  onBack,
  onBackToGroup,
  onComplete,
  onOpenReceipt,
}) {
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [isCompletionConfirming, setIsCompletionConfirming] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const initialReceiptsSnapshot = useMemo(
    () => JSON.stringify(group.receipts ?? []),
    [group.receipts],
  );
  const readReceiptSnapshot = useCallback(
    () => getReceiptsSnapshot(group.id, initialReceiptsSnapshot),
    [group.id, initialReceiptsSnapshot],
  );
  const readInitialReceiptsSnapshot = useCallback(
    () => initialReceiptsSnapshot,
    [initialReceiptsSnapshot],
  );
  const receiptsSnapshot = useSyncExternalStore(
    subscribeToReceipts,
    readReceiptSnapshot,
    readInitialReceiptsSnapshot,
  );
  const receipts = parseReceipts(receiptsSnapshot);
  const selectedReceipt = receipts.find(
    (receipt) => receipt.id === receiptId,
  );
  const currentMember = findMember(group, currentMemberId);
  const isCaptain = currentMember?.member_type === "registered";
  const isCompleted = group.status === "COMPLETED";

  function showReceipt(nextReceiptId) {
    onOpenReceipt(nextReceiptId);
  }

  function showReceiptList() {
    onBackToGroup();
  }

  return (
    <main className={styles.boardMain}>
      <nav className={styles.boardNavigation} aria-label="모임 화면 탐색">
        <button type="button" onClick={onBack}>← 대시보드</button>
        <div className={styles.boardStatusActions}>
          <span>
            {group.mode === "TOGETHER" ? "함께하기" : "혼자하기"} · 총대 계정에 저장됨
          </span>
          {isCompleted ? (
            <strong className={styles.completedBadge}>✓ 정산 완료</strong>
          ) : null}
        </div>
      </nav>

      {selectedReceipt ? (
        <ReceiptDetail
          currentMemberId={currentMemberId}
          group={group}
          isReadOnly={isCompleted}
          receipt={selectedReceipt}
          onBack={showReceiptList}
          onDelete={(receiptId) => {
            const isRemoved = removeReceipt(group.id, receiptId, receipts);

            if (isRemoved) {
              showReceiptList();
            }

            return isRemoved;
          }}
          onUpdate={(receipt) => replaceReceipt(group.id, receipt, receipts)}
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
          onSave={(receipt) => {
            const isSaved = appendReceipt(group.id, receipt, receipts);

            if (isSaved) {
              setIsReceiptDialogOpen(false);
            }

            return isSaved;
          }}
        />
      )}
    </main>
  );
}
