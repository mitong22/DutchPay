"use client";

import { useState } from "react";

import styles from "./groupBoard.module.css";

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

export default function GroupBoard({ group, onReset }) {
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const receipts = [];

  return (
    <main className={styles.boardMain}>
      <section className={styles.groupOverview} aria-labelledby="group-name">
        <div className={styles.groupHeading}>
          <div>
            <p className={styles.eyebrow}>SOLO · 진행 중</p>
            <h1 id="group-name">{group.name}</h1>
          </div>
          <button className={styles.secondaryButton} type="button" onClick={onReset}>
            새 모임 만들기
          </button>
        </div>

        <div className={styles.memberArea}>
          <p>현재 모임 멤버 · {group.members.length}명</p>
          <div className={styles.memberList}>
            {group.members.map((member) => (
              <span key={member.id}>
                {member.nickname}
                {member.member_type === "registered" ? " · 총대" : ""}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.boardGrid}>
        <section className={styles.receiptPanel} aria-labelledby="receipt-list-title">
          <div className={styles.panelHeading}>
            <div>
              <h2 id="receipt-list-title">영수증 목록</h2>
              <p>{receipts.length}개</p>
            </div>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => setIsReceiptDialogOpen(true)}
            >
              + 영수증 추가
            </button>
          </div>

          <div className={styles.emptyState}>
            <strong>등록된 영수증이 없어요</strong>
            <p>첫 영수증을 추가하면 이곳에서 바로 확인할 수 있어요.</p>
            <button
              className={styles.emptyAddButton}
              type="button"
              onClick={() => setIsReceiptDialogOpen(true)}
            >
              첫 영수증 추가
            </button>
          </div>
        </section>

        <aside className={styles.detailPanel} aria-labelledby="receipt-detail-title">
          <p className={styles.eyebrow}>영수증 상세</p>
          <h2 id="receipt-detail-title">영수증을 선택해 주세요</h2>
          <p>등록된 영수증을 선택하면 메뉴와 참여자를 확인할 수 있어요.</p>
        </aside>
      </div>

      {isReceiptDialogOpen && (
        <ReceiptEntryDialog onClose={() => setIsReceiptDialogOpen(false)} />
      )}
    </main>
  );
}
