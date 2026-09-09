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

function createId(prefix) {
  const value =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${value}`;
}

function createMenuDraft(memberIds) {
  return {
    id: createId("menu-draft"),
    name: "",
    amount: "",
    consumer_member_ids: [...memberIds],
  };
}

function appendReceipt(groupId, receipt) {
  try {
    const currentReceipts = parseReceipts(getReceiptsSnapshot(groupId));

    window.localStorage.setItem(
      getReceiptStoreKey(groupId),
      JSON.stringify([...currentReceipts, receipt]),
    );
    window.dispatchEvent(new Event(RECEIPT_STORE_EVENT));
    return true;
  } catch {
    return false;
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

function ReceiptEntryDialog({ currentMemberId, group, onClose, onSave }) {
  const [selectedMethod, setSelectedMethod] = useState("manual");
  const initialMemberIds = group.members.map((member) => member.id);
  const [title, setTitle] = useState("");
  const [participantMemberIds, setParticipantMemberIds] = useState(
    () => initialMemberIds,
  );
  const [items, setItems] = useState(() => [
    createMenuDraft(initialMemberIds),
  ]);
  const [validationMessage, setValidationMessage] = useState("");
  const selectedDescription = RECEIPT_METHODS.find(
    (method) => method.id === selectedMethod,
  )?.description;
  const payer =
    group.members.find((member) => member.member_type === "registered") ??
    findMember(group, currentMemberId) ??
    group.members[0];
  const participantMembers = group.members.filter((member) =>
    participantMemberIds.includes(member.id),
  );
  const draftTotal = items.reduce((total, item) => {
    const amount = Number(item.amount);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  function selectMethod(methodId) {
    setSelectedMethod(methodId);
    setValidationMessage("");
  }

  function toggleReceiptParticipant(memberId) {
    const nextMemberIds = participantMemberIds.includes(memberId)
      ? participantMemberIds.filter((id) => id !== memberId)
      : [...participantMemberIds, memberId];

    setValidationMessage("");
    setParticipantMemberIds(nextMemberIds);
    setItems((currentItems) =>
      currentItems.map((item) => ({
        ...item,
        consumer_member_ids: item.consumer_member_ids.filter((id) =>
          nextMemberIds.includes(id),
        ),
      })),
    );
  }

  function updateItem(itemId, patch) {
    setValidationMessage("");
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    );
  }

  function toggleItemConsumer(itemId, memberId) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextConsumerIds = item.consumer_member_ids.includes(memberId)
          ? item.consumer_member_ids.filter((id) => id !== memberId)
          : [...item.consumer_member_ids, memberId];

        return { ...item, consumer_member_ids: nextConsumerIds };
      }),
    );
    setValidationMessage("");
  }

  function addItem() {
    setValidationMessage("");
    setItems((currentItems) => [
      ...currentItems,
      createMenuDraft(participantMemberIds),
    ]);
  }

  function removeItem(itemId) {
    setValidationMessage("");
    setItems((currentItems) =>
      currentItems.filter((item) => item.id !== itemId),
    );
  }

  function handleSubmit(event) {
    event.preventDefault();

    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      setValidationMessage("영수증 소제목을 입력해 주세요.");
      return;
    }

    if (participantMemberIds.length === 0) {
      setValidationMessage("영수증 참여자를 한 명 이상 선택해 주세요.");
      return;
    }

    if (items.length === 0) {
      setValidationMessage("메뉴를 한 개 이상 추가해 주세요.");
      return;
    }

    const normalizedItems = [];

    for (const [index, item] of items.entries()) {
      const name = item.name.trim();
      const amount = Number(item.amount);

      if (!name) {
        setValidationMessage(`${index + 1}번 메뉴명을 입력해 주세요.`);
        return;
      }

      if (!Number.isSafeInteger(amount) || amount <= 0) {
        setValidationMessage(`${index + 1}번 메뉴 금액을 원 단위로 입력해 주세요.`);
        return;
      }

      if (item.consumer_member_ids.length === 0) {
        setValidationMessage(
          `${index + 1}번 메뉴를 부담할 사람을 한 명 이상 선택해 주세요.`,
        );
        return;
      }

      normalizedItems.push({
        id: createId("menu"),
        name,
        menu_name: name,
        quantity: 1,
        unit_price: amount,
        amount,
        line_total: amount,
        consumer_member_ids: item.consumer_member_ids,
      });
    }

    const savedAt = new Date().toISOString();
    const receipt = {
      id: createId("receipt"),
      group_id: group.id,
      title: normalizedTitle,
      store_name: normalizedTitle,
      total_amount: normalizedItems.reduce(
        (total, item) => total + item.line_total,
        0,
      ),
      paid_by_member_id: payer.id,
      uploaded_by_member_id: currentMemberId,
      participant_member_ids: participantMemberIds,
      items: normalizedItems,
      image_key: null,
      input_method: "MANUAL",
      ocr_status: "NONE",
      status: "ACTIVE",
      created_at: savedAt,
      updated_at: savedAt,
    };

    if (!onSave(receipt)) {
      setValidationMessage("브라우저에 저장하지 못했어요. 다시 시도해 주세요.");
    }
  }

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
              onClick={() => selectMethod(method.id)}
            >
              {method.label}
            </button>
          ))}
        </div>

        <p className={styles.methodDescription} role="tabpanel">
          {selectedDescription}
        </p>

        {selectedMethod === "manual" ? (
          <form className={styles.manualForm} onSubmit={handleSubmit}>
            <label className={styles.formField}>
              <span>영수증 소제목</span>
              <input
                type="text"
                value={title}
                placeholder="예: 저녁 식사"
                required
                onChange={(event) => {
                  setTitle(event.target.value);
                  setValidationMessage("");
                }}
              />
            </label>

            <div className={styles.fixedPayer}>
              <span>결제자</span>
              <strong>{payer.nickname}</strong>
              <small>혼자하기에서는 총대가 결제자로 고정돼요.</small>
            </div>

            <fieldset className={styles.choiceGroup}>
              <legend>영수증 참여자</legend>
              <p>이 영수증의 자리에 함께한 사람을 골라 주세요.</p>
              <div className={styles.memberChoices}>
                {group.members.map((member) => {
                  const isSelected = participantMemberIds.includes(member.id);

                  return (
                    <label
                      className={`${styles.memberChoice} ${
                        isSelected ? styles.selectedChoice : ""
                      }`}
                      key={member.id}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleReceiptParticipant(member.id)}
                      />
                      <span>{member.nickname}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <section className={styles.menuEditor} aria-labelledby="menu-editor-title">
              <div className={styles.menuEditorHeading}>
                <div>
                  <h3 id="menu-editor-title">메뉴 목록</h3>
                  <p>금액과 메뉴를 나눌 사람을 입력해 주세요.</p>
                </div>
                <strong>{formatWon(draftTotal)}</strong>
              </div>

              <div className={styles.menuCards}>
                {items.map((item, index) => (
                  <article className={styles.menuCard} key={item.id}>
                    <div className={styles.menuCardHeading}>
                      <strong>메뉴 {index + 1}</strong>
                      <button
                        className={styles.removeMenuButton}
                        type="button"
                        disabled={items.length === 1}
                        onClick={() => removeItem(item.id)}
                      >
                        삭제
                      </button>
                    </div>

                    <div className={styles.menuFieldGrid}>
                      <label className={styles.formField}>
                        <span>메뉴명</span>
                        <input
                          type="text"
                          value={item.name}
                          placeholder="예: 파스타"
                          required
                          onChange={(event) =>
                            updateItem(item.id, { name: event.target.value })
                          }
                        />
                      </label>
                      <label className={styles.formField}>
                        <span>금액</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={item.amount}
                          placeholder="0"
                          required
                          onChange={(event) =>
                            updateItem(item.id, { amount: event.target.value })
                          }
                        />
                      </label>
                    </div>

                    <fieldset className={styles.consumerGroup}>
                      <legend>먹은 사람</legend>
                      {participantMembers.length > 0 ? (
                        <div className={styles.memberChoices}>
                          {participantMembers.map((member) => {
                            const isSelected = item.consumer_member_ids.includes(
                              member.id,
                            );

                            return (
                              <label
                                className={`${styles.memberChoice} ${
                                  isSelected ? styles.selectedChoice : ""
                                }`}
                                key={member.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    toggleItemConsumer(item.id, member.id)
                                  }
                                />
                                <span>{member.nickname}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className={styles.emptyChoice}>
                          영수증 참여자를 먼저 선택해 주세요.
                        </p>
                      )}
                    </fieldset>
                  </article>
                ))}
              </div>

              <button
                className={styles.addMenuButton}
                type="button"
                onClick={addItem}
              >
                + 메뉴 추가
              </button>
            </section>

            {validationMessage && (
              <p className={styles.validationMessage} role="alert">
                {validationMessage}
              </p>
            )}

            <div className={styles.dialogActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={onClose}
              >
                취소
              </button>
              <button className={styles.primaryButton} type="submit">
                영수증 저장
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.deferredMethod}>
            <p>촬영과 사진 첨부는 9단계에서 연결할게요.</p>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ReceiptList({ currentMemberId, group, receipts, onAdd, onSelect }) {
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

export default function GroupBoard({ currentMemberId, group }) {
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
          currentMemberId={currentMemberId}
          group={group}
          receipts={receipts}
          onAdd={() => setIsReceiptDialogOpen(true)}
          onSelect={setSelectedReceiptId}
        />
      )}

      {isReceiptDialogOpen && (
        <ReceiptEntryDialog
          currentMemberId={currentMemberId}
          group={group}
          onClose={() => setIsReceiptDialogOpen(false)}
          onSave={(receipt) => {
            const isSaved = appendReceipt(group.id, receipt);

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
