"use client";

import { useState } from "react";

import styles from "../groupBoard.module.css";
import {
  RECEIPT_METHODS,
  createId,
  createMenuDraft,
  findMember,
  formatWon,
} from "@/lib/receiptUtils";

export default function ReceiptEntryDialog({
  currentMemberId,
  group,
  initialReceipt = null,
  onClose,
  onSave,
}) {
  const isEditing = Boolean(initialReceipt);
  const [selectedMethod, setSelectedMethod] = useState("manual");
  const defaultMemberIds = group.members.map((member) => member.id);
  const initialMemberIds =
    initialReceipt?.participant_member_ids ?? defaultMemberIds;
  const defaultPayer =
    findMember(group, initialReceipt?.paid_by_member_id) ??
    findMember(group, currentMemberId) ??
    group.members[0];
  const [title, setTitle] = useState(initialReceipt?.title ?? "");
  const [paidByMemberId, setPaidByMemberId] = useState(defaultPayer.id);
  const [participantMemberIds, setParticipantMemberIds] = useState(
    () => initialMemberIds,
  );
  const [items, setItems] = useState(() =>
    initialReceipt?.items?.length
      ? initialReceipt.items.map((item) =>
          createMenuDraft(initialMemberIds, item),
        )
      : [createMenuDraft(initialMemberIds)],
  );
  const [validationMessage, setValidationMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const selectedDescription = RECEIPT_METHODS.find(
    (method) => method.id === selectedMethod,
  )?.description;
  const payer = findMember(group, paidByMemberId) ?? defaultPayer;
  const participantMembers = group.members.filter((member) =>
    participantMemberIds.includes(member.id),
  );
  const draftTotal = items.reduce((total, item) => {
    const quantity = Number(item.quantity);
    const amount = Number(item.amount);

    return total +
      (Number.isFinite(quantity) &&
      Number.isFinite(amount) &&
      quantity > 0 &&
      amount > 0
        ? quantity * amount
        : 0);
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

  async function handleSubmit(event) {
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
      const quantity = Number(item.quantity);
      const amount = Number(item.amount);

      if (!name) {
        setValidationMessage(`${index + 1}번 메뉴명을 입력해 주세요.`);
        return;
      }

      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        setValidationMessage(`${index + 1}번 메뉴 수량을 입력해 주세요.`);
        return;
      }

      if (!Number.isSafeInteger(amount) || amount <= 0) {
        setValidationMessage(
          `${index + 1}번 메뉴의 개당 금액을 원 단위로 입력해 주세요.`,
        );
        return;
      }

      if (item.consumer_member_ids.length === 0) {
        setValidationMessage(
          `${index + 1}번 메뉴를 부담할 사람을 한 명 이상 선택해 주세요.`,
        );
        return;
      }

      normalizedItems.push({
        id: String(item.id).startsWith("menu-draft-")
          ? createId("menu")
          : item.id,
        name,
        menu_name: name,
        quantity,
        unit_price: amount,
        amount: quantity * amount,
        line_total: quantity * amount,
        consumer_member_ids: item.consumer_member_ids,
      });
    }

    const savedAt = new Date().toISOString();
    const receipt = {
      ...(initialReceipt ?? {}),
      id: initialReceipt?.id ?? createId("receipt"),
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
      image_key: initialReceipt?.image_key ?? null,
      input_method: initialReceipt?.input_method ?? "MANUAL",
      ocr_status: initialReceipt?.ocr_status ?? "NONE",
      status: initialReceipt?.status ?? "ACTIVE",
      created_at: initialReceipt?.created_at ?? savedAt,
      updated_at: savedAt,
    };

    setIsSaving(true);
    setValidationMessage("");

    try {
      await onSave(receipt);
    } catch (error) {
      setValidationMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  const editor = (
    <section
      className={`${styles.dialog} ${isEditing ? styles.detailEditor : ""}`}
      role={isEditing ? undefined : "dialog"}
      aria-modal={isEditing ? undefined : "true"}
      aria-labelledby="receipt-entry-title"
    >
        <div className={styles.dialogHeading}>
          <div>
            <p className={styles.eyebrow}>
              {isEditing ? "영수증 수정" : "영수증 추가"}
            </p>
            <h2 id="receipt-entry-title">
              {isEditing
                ? "내용을 확인하고 수정해 주세요"
                : "등록 방식을 선택해 주세요"}
            </h2>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            aria-label={isEditing ? "영수증 수정 취소" : "영수증 추가 닫기"}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {!isEditing && (
          <>
            <div
              className={styles.methodTabs}
              role="tablist"
              aria-label="등록 방식"
            >
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
          </>
        )}

        {isEditing || selectedMethod === "manual" ? (
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

            {group.mode === "TOGETHER" ? (
              <fieldset className={`${styles.choiceGroup} ${styles.payerChoiceGroup}`}>
                <legend>실제 결제자</legend>
                <p>이 영수증의 금액을 먼저 결제한 사람을 골라 주세요.</p>
                <div className={styles.memberChoices}>
                  {group.members.map((member) => {
                    const isSelected = member.id === payer.id;

                    return (
                      <label
                        className={`${styles.memberChoice} ${
                          isSelected ? styles.selectedChoice : ""
                        }`}
                        key={member.id}
                      >
                        <input
                          type="radio"
                          name="paid-by-member"
                          value={member.id}
                          checked={isSelected}
                          onChange={() => {
                            setPaidByMemberId(member.id);
                            setValidationMessage("");
                          }}
                        />
                        <span>{member.nickname}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : (
              <div className={styles.fixedPayer}>
                <span>결제자</span>
                <strong>{payer.nickname}</strong>
                <small>혼자하기에서는 총대가 결제자로 고정돼요.</small>
              </div>
            )}

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
                  <p>수량, 개당 금액과 메뉴를 나눌 사람을 입력해 주세요.</p>
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
                        <span>수량</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={item.quantity}
                          required
                          onChange={(event) =>
                            updateItem(item.id, { quantity: event.target.value })
                          }
                        />
                      </label>
                      <label className={styles.formField}>
                        <span>개당 금액</span>
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
                disabled={isSaving}
                onClick={onClose}
              >
                {isEditing ? "수정 취소" : "취소"}
              </button>
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={isSaving}
              >
                {isSaving
                  ? "저장 중..."
                  : isEditing
                    ? "변경사항 저장"
                    : "영수증 저장"}
              </button>
            </div>
          </form>
        ) : (
          <section className={styles.photoMethod} aria-label="영수증 사진 선택">
            <div className={styles.photoMethodHeading}>
              <span aria-hidden="true">
                {selectedMethod === "camera" ? "⌁" : "↑"}
              </span>
              <div>
                <strong>
                  {selectedMethod === "camera"
                    ? "영수증을 촬영해 주세요"
                    : "영수증 사진을 골라 주세요"}
                </strong>
                <p>선택 이후 처리는 OCR 기능에서 연결할 예정이에요.</p>
              </div>
            </div>

            <label className={styles.photoSelectButton}>
              <input
                className={styles.visuallyHidden}
                type="file"
                accept="image/*"
                capture={
                  selectedMethod === "camera" ? "environment" : undefined
                }
              />
              {selectedMethod === "camera" ? "카메라 열기" : "사진 선택하기"}
            </label>
          </section>
        )}
    </section>
  );

  return isEditing ? (
    editor
  ) : (
    <div className={styles.dialogBackdrop}>{editor}</div>
  );
}
