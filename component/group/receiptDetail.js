"use client";

import { useState } from "react";

import ReceiptEntryDialog from "./receiptEntryDialog";
import styles from "../groupBoard.module.css";
import {
  calculateReceiptShares,
  findMember,
  formatWon,
} from "@/lib/receiptUtils";

export default function ReceiptDetail({
  canEdit,
  currentMemberId,
  group,
  isReadOnly,
  receipt,
  onBack,
  onDelete,
  onUpdate,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const payer = findMember(group, receipt.paid_by_member_id);
  const participantMembers = (receipt.participant_member_ids ?? [])
    .map((memberId) => findMember(group, memberId))
    .filter(Boolean);
  const receiptShares = calculateReceiptShares(receipt);
  const currentMemberTotal =
    receiptShares.memberTotals.find(
      (share) => share.memberId === currentMemberId,
    )?.amount ?? 0;

  if (isEditing) {
    return (
      <ReceiptEntryDialog
        currentMemberId={currentMemberId}
        group={group}
        initialReceipt={receipt}
        onClose={() => setIsEditing(false)}
        onSave={async (updatedReceipt) => {
          await onUpdate(updatedReceipt);
          setIsEditing(false);
          return true;
        }}
      />
    );
  }

  async function handleDelete() {
    setIsDeleting(true);
    setActionMessage("");

    try {
      await onDelete(receipt.id);
    } catch (error) {
      setActionMessage(error.message);
      setIsDeleting(false);
    }
  }

  return (
    <section className={styles.detailView} aria-labelledby="receipt-detail-title">
      <div className={styles.detailToolbar}>
        <button className={styles.backButton} type="button" onClick={onBack}>
          ← 영수증 목록
        </button>
        {isReadOnly ? (
          <span className={styles.readOnlyBadge}>완료된 정산 · 읽기 전용</span>
        ) : canEdit ? (
          <div className={styles.detailActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => {
                setActionMessage("");
                setIsEditing(true);
              }}
            >
              수정하기
            </button>
            <button
              className={styles.deleteButton}
              type="button"
              onClick={() => {
                setActionMessage("");
                setIsDeleteConfirming(true);
              }}
            >
              삭제
            </button>
          </div>
        ) : (
          <span className={styles.readOnlyBadge}>
            다른 참여자가 등록 · 보기 전용
          </span>
        )}
      </div>

      <div className={styles.detailHeading}>
        <div>
          <p className={styles.eyebrow}>{group.name}</p>
          <h1 id="receipt-detail-title">{receipt.title}</h1>
        </div>
        <strong>{formatWon(receipt.total_amount)}</strong>
      </div>

      <dl className={styles.receiptSummary}>
        <div>
          <dt>결제한 사람</dt>
          <dd className={styles.payerProfile}>
            <span
              className={`${styles.detailAvatar} ${
                payer?.member_type === "registered"
                  ? styles.captainDetailAvatar
                  : ""
              } ${
                payer?.id === currentMemberId
                  ? styles.currentDetailAvatar
                  : ""
              }`}
              aria-hidden="true"
            >
              {payer?.nickname.slice(0, 2) ?? "?"}
            </span>
            <span>
              <strong>{payer?.nickname ?? "미정"}</strong>
              {payer && (
                <small>
                  {payer.member_type === "registered" ? "총대" : "참여자"}
                  {payer.id === currentMemberId ? " · 나" : ""}
                </small>
              )}
            </span>
          </dd>
        </div>
        <div>
          <dt>함께한 사람 {participantMembers.length}명</dt>
          <dd className={styles.participantProfiles}>
            {participantMembers.length > 0 ? (
              participantMembers.map((member) => {
                const isCaptain = member.member_type === "registered";
                const isCurrentMember = member.id === currentMemberId;

                return (
                  <span
                    className={styles.participantProfile}
                    key={member.id}
                    aria-label={`${member.nickname}${
                      isCaptain ? " 총대" : ""
                    }${isCurrentMember ? " 현재 사용자" : ""}`}
                  >
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
                    <span>{member.nickname}</span>
                  </span>
                );
              })
            ) : (
              <span className={styles.emptyPeople}>참여자 미정</span>
            )}
          </dd>
        </div>
      </dl>

      <div className={styles.itemHeading}>
        <h2>메뉴</h2>
        <p>{receipt.items?.length ?? 0}개 메뉴</p>
      </div>

      <div className={styles.itemList}>
        {(receipt.items ?? []).map((item) => {
          const consumerMembers = (item.consumer_member_ids ?? [])
            .map((memberId) => findMember(group, memberId))
            .filter(Boolean);
          const visibleConsumers = consumerMembers.slice(0, 4);
          const hiddenConsumerCount = consumerMembers.length - 4;

          return (
            <article className={styles.itemRow} key={item.id}>
              <strong className={styles.compactItemName}>{item.name}</strong>
              <div
                className={styles.compactConsumers}
                aria-label={`${item.name} 먹은 사람: ${
                  consumerMembers.map((member) => member.nickname).join(", ") ||
                  "없음"
                }`}
              >
                {visibleConsumers.map((member) => {
                  const isCaptain = member.member_type === "registered";
                  const isCurrentMember = member.id === currentMemberId;

                  return (
                    <span
                      className={`${styles.compactConsumerAvatar} ${
                        isCaptain ? styles.captainCompactAvatar : ""
                      } ${
                        isCurrentMember ? styles.currentCompactAvatar : ""
                      }`}
                      key={member.id}
                      title={member.nickname}
                      aria-hidden="true"
                    >
                      {member.nickname.slice(0, 2)}
                    </span>
                  );
                })}
                {hiddenConsumerCount > 0 && (
                  <span
                    className={`${styles.compactConsumerAvatar} ${styles.moreConsumers}`}
                    aria-hidden="true"
                  >
                    +{hiddenConsumerCount}
                  </span>
                )}
                {consumerMembers.length === 0 && (
                  <span className={styles.noConsumers}>—</span>
                )}
              </div>
              <span className={styles.compactQuantity}>
                {item.quantity ?? 1}개
              </span>
              <strong className={styles.compactItemAmount}>
                {formatWon(item.line_total ?? item.amount)}
              </strong>
            </article>
          );
        })}
      </div>

      <details className={styles.shareDisclosure}>
        <summary className={styles.shareDisclosureSummary}>
          <span className={styles.mySharePreview}>
            <small>내가 낼 금액</small>
            <strong>{formatWon(currentMemberTotal)}</strong>
          </span>
          <span className={styles.receiptTotalPreview}>
            <small>영수증 전체</small>
            <strong>{formatWon(receipt.total_amount)}</strong>
          </span>
          <span className={styles.shareDisclosureAction}>
            <span className={styles.closedDisclosureLabel}>상세보기</span>
            <span className={styles.openDisclosureLabel}>접기</span>
            <span className={styles.disclosureChevron} aria-hidden="true">
              ⌄
            </span>
          </span>
        </summary>

        <div className={styles.shareDetails}>
          <section aria-labelledby="menu-share-title">
            <div className={styles.shareSectionHeading}>
              <div>
                <h2 id="menu-share-title">메뉴별 분담금</h2>
                <p>선택된 사람끼리 메뉴 금액을 나눴어요.</p>
              </div>
            </div>

            <div className={styles.shareBreakdownList}>
              {(receipt.items ?? []).map((item) => {
                const itemShares =
                  receiptShares.itemShares.get(item.id) ?? [];

                return (
                  <article className={styles.shareBreakdownItem} key={item.id}>
                    <div className={styles.shareBreakdownHeading}>
                      <strong>{item.name}</strong>
                      <span>{formatWon(item.line_total ?? item.amount)}</span>
                    </div>
                    <div
                      className={styles.itemShareList}
                      aria-label={`${item.name} 메뉴 분담액`}
                    >
                      {itemShares.map((share) => {
                        const member = findMember(group, share.memberId);

                        return (
                          <span
                            className={styles.itemShare}
                            key={share.memberId}
                          >
                            <span>{member?.nickname ?? "알 수 없음"}</span>
                            <strong>{formatWon(share.amount)}</strong>
                          </span>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section
            className={styles.shareSummary}
            aria-labelledby="receipt-share-title"
          >
            <div className={styles.shareSummaryHeading}>
              <div>
                <h2 id="receipt-share-title">사람별 최종 부담금</h2>
                <p>참여한 메뉴의 분담금을 모두 더했어요.</p>
              </div>
              <strong>{formatWon(receipt.total_amount)}</strong>
            </div>

            <div className={styles.shareTotalList}>
              {receiptShares.memberTotals.map((share) => {
                const member = findMember(group, share.memberId);
                const isCurrentMember = share.memberId === currentMemberId;

                return (
                  <div
                    className={`${styles.shareTotalRow} ${
                      isCurrentMember ? styles.currentShareRow : ""
                    }`}
                    key={share.memberId}
                  >
                    <span className={styles.shareMember}>
                      <span
                        className={`${styles.shareAvatar} ${
                          isCurrentMember ? styles.currentShareAvatar : ""
                        }`}
                        aria-hidden="true"
                      >
                        {member?.nickname.slice(0, 2) ?? "?"}
                      </span>
                      <strong>{member?.nickname ?? "알 수 없음"}</strong>
                    </span>
                    <strong>{formatWon(share.amount)}</strong>
                  </div>
                );
              })}
            </div>

            <p className={styles.calculationNote}>
              나누어지지 않는 1원은 메뉴에서 선택된 사람 순서대로
              배분해요.
            </p>
          </section>
        </div>
      </details>

      {isDeleteConfirming && (
        <div className={styles.deleteConfirmation} role="alert">
          <div>
            <strong>이 영수증을 삭제할까요?</strong>
            <p>삭제하면 현재 모임의 영수증 목록에서 사라져요.</p>
          </div>
          <div className={styles.deleteConfirmationActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={isDeleting}
              onClick={() => setIsDeleteConfirming(false)}
            >
              취소
            </button>
            <button
              className={styles.confirmDeleteButton}
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "삭제 중..." : "삭제하기"}
            </button>
          </div>
        </div>
      )}

      {actionMessage && (
        <p className={styles.validationMessage} role="alert">
          {actionMessage}
        </p>
      )}
    </section>
  );
}
