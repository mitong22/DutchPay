"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import styles from "./groupBoard.module.css";

const RECEIPT_STORE_EVENT = "dutchpay-receipt-store-change";
const EMPTY_RECEIPTS_SNAPSHOT = "[]";
const RECEIPT_METHODS = [
  {
    id: "manual",
    label: "직접 입력",
    description: "영수증과 메뉴 정보를 직접 입력해요.",
  },
  {
    id: "camera",
    label: "촬영하기",
    description: "카메라로 영수증을 바로 촬영해요.",
  },
  {
    id: "upload",
    label: "사진 첨부",
    description: "기기에 저장된 영수증 사진을 선택해요.",
  },
];

function getReceiptStoreKey(groupId) {
  return `dutchpay:receipts:${groupId}`;
}

function getReceiptsSnapshot(groupId) {
  try {
    return (
      window.localStorage.getItem(getReceiptStoreKey(groupId)) ??
      EMPTY_RECEIPTS_SNAPSHOT
    );
  } catch {
    return EMPTY_RECEIPTS_SNAPSHOT;
  }
}

function getServerReceiptsSnapshot() {
  return EMPTY_RECEIPTS_SNAPSHOT;
}

function subscribeToReceipts(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(RECEIPT_STORE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(RECEIPT_STORE_EVENT, callback);
  };
}

function parseReceipts(snapshot) {
  try {
    const receipts = JSON.parse(snapshot);
    return Array.isArray(receipts) ? receipts : [];
  } catch {
    return [];
  }
}

function formatWon(amount) {
  return `${Number(amount).toLocaleString("ko-KR")}원`;
}

function findMember(group, memberId) {
  return group.members.find((member) => member.id === memberId);
}

function getMemberNames(group, memberIds = []) {
  return memberIds
    .map((memberId) => findMember(group, memberId)?.nickname)
    .filter(Boolean);
}

function ReceiptEntryDialog({ onClose }) {
  const [selectedMethod, setSelectedMethod] = useState("manual");
  const selectedDescription = RECEIPT_METHODS.find(
    (method) => method.id === selectedMethod,
  )?.description;

  return (
    <div className={styles.dialogBackdrop}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-entry-title"
      >
        <div className={styles.dialogHeading}>
          <div>
            <p className={styles.eyebrow}>영수증 추가</p>
            <h2 id="receipt-entry-title">등록 방식을 선택해 주세요</h2>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            aria-label="영수증 추가 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={styles.methodTabs} role="tablist" aria-label="등록 방식">
          {RECEIPT_METHODS.map((method) => (
            <button
              className={
                selectedMethod === method.id ? styles.selectedMethod : ""
              }
              type="button"
              role="tab"
              aria-selected={selectedMethod === method.id}
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
            >
              {method.label}
            </button>
          ))}
        </div>

        <p className={styles.methodDescription} role="tabpanel">
          {selectedDescription}
        </p>

        <div className={styles.dialogActions}>
          <button className={styles.secondaryButton} type="button" onClick={onClose}>
            닫기
          </button>
        </div>
      </section>
    </div>
  );
}

function ReceiptList({ group, receipts, onAdd, onSelect }) {
  const orderedMembers = [
    ...group.members.filter((member) => member.member_type === "registered"),
    ...group.members.filter((member) => member.member_type !== "registered"),
  ];

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
          {orderedMembers.map((member) => (
            <span className={styles.member} key={member.id}>
              {member.member_type === "registered" && (
                <span className={styles.captainBadge}>총대</span>
              )}
              <span
                className={styles.memberAvatar}
                title={member.nickname}
                aria-label={`${member.nickname}${
                  member.member_type === "registered" ? " 총대" : ""
                }`}
              >
                {member.nickname.slice(0, 2)}
              </span>
            </span>
          ))}
        </div>
        <p>총 {group.members.length}명</p>
      </section>

      <div className={styles.listHeading}>
        <h2>모임 영수증</h2>
        <p>결제자와 참여 인원 포함</p>
      </div>

      <section className={styles.receiptList} aria-label="영수증 목록">
        {receipts.map((receipt) => {
          const payer = findMember(group, receipt.paid_by_member_id);
          const participantCount = receipt.participant_member_ids?.length ?? 0;
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

        <button className={styles.addReceiptRow} type="button" onClick={onAdd}>
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
      </section>
    </>
  );
}

function ReceiptDetail({ group, receipt, onBack }) {
  const payer = findMember(group, receipt.paid_by_member_id);
  const participantNames = getMemberNames(
    group,
    receipt.participant_member_ids,
  );

  return (
    <section className={styles.detailView} aria-labelledby="receipt-detail-title">
      <button className={styles.backButton} type="button" onClick={onBack}>
        ← 영수증 목록
      </button>

      <div className={styles.detailHeading}>
        <div>
          <p className={styles.eyebrow}>{group.name}</p>
          <h1 id="receipt-detail-title">{receipt.title}</h1>
        </div>
        <strong>{formatWon(receipt.total_amount)}</strong>
      </div>

      <dl className={styles.receiptSummary}>
        <div>
          <dt>결제자</dt>
          <dd>{payer?.nickname ?? "미정"}</dd>
        </div>
        <div>
          <dt>영수증 참여자</dt>
          <dd>{participantNames.join(" · ") || "미정"}</dd>
        </div>
      </dl>

      <div className={styles.itemHeading}>
        <h2>메뉴와 부담할 사람</h2>
        <p>{receipt.items?.length ?? 0}개 메뉴</p>
      </div>

      <div className={styles.itemList}>
        {(receipt.items ?? []).map((item) => {
          const consumerNames = getMemberNames(
            group,
            item.consumer_member_ids,
          );

          return (
            <article className={styles.itemRow} key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>{consumerNames.join(" · ") || "부담할 사람 미정"}</p>
              </div>
              <strong>{formatWon(item.amount)}</strong>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function GroupBoard({ group }) {
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const readReceiptSnapshot = useCallback(
    () => getReceiptsSnapshot(group.id),
    [group.id],
  );
  const receiptsSnapshot = useSyncExternalStore(
    subscribeToReceipts,
    readReceiptSnapshot,
    getServerReceiptsSnapshot,
  );
  const receipts = parseReceipts(receiptsSnapshot);
  const selectedReceipt = receipts.find(
    (receipt) => receipt.id === selectedReceiptId,
  );

  return (
    <main className={styles.boardMain}>
      {selectedReceipt ? (
        <ReceiptDetail
          group={group}
          receipt={selectedReceipt}
          onBack={() => setSelectedReceiptId(null)}
        />
      ) : (
        <ReceiptList
          group={group}
          receipts={receipts}
          onAdd={() => setIsReceiptDialogOpen(true)}
          onSelect={setSelectedReceiptId}
        />
      )}

      {isReceiptDialogOpen && (
        <ReceiptEntryDialog onClose={() => setIsReceiptDialogOpen(false)} />
      )}
    </main>
  );
}
