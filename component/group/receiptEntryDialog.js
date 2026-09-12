"use client";

import { useRef, useState } from "react";

import styles from "../groupBoard.module.css";
import {
  RECEIPT_METHODS,
  createId,
  createMenuDraft,
  findMember,
  formatWon,
} from "@/lib/receiptUtils";

const MAX_RECEIPT_IMAGE_BYTES = 10 * 1024 * 1024;
const RECEIPT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMetadata, setAnalysisMetadata] = useState(null);
  const analysisController = useRef(null);
  const selectedDescription = RECEIPT_METHODS.find(
    (method) => method.id === selectedMethod,
  )?.description;
  const payer = findMember(group, paidByMemberId) ?? defaultPayer;
  const participantMembers = group.members.filter((member) =>
    participantMemberIds.includes(member.id),
  );
  // Teacher: 입력값은 문자열이고 미리보기에서 숫자로 바꿉니다. 빈값·0·정상 수량의 계산 경로를 적고, AI에게 reduce를 for...of 합산으로 풀게 한 뒤 서버 normalizeReceipt의 검증과 비교해 보기.
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

  function handleClose() {
    analysisController.current?.abort();
    onClose();
  }

  // Teacher: 영수증 참여자에서 빼면 모든 메뉴의 소비자 목록에서도 제거합니다. 바깥 배열·메뉴 객체·소비자 배열을 새로 만드는 위치를 찾고, 직접 수정 대신 map·filter를 쓰는 이유를 작은 예제로 확인해 보기.
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

  async function handlePhotoSelected(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    if (!RECEIPT_IMAGE_TYPES.has(file.type)) {
      setValidationMessage("JPEG, PNG, WebP 형식의 영수증 사진만 올릴 수 있어요.");
      input.value = "";
      return;
    }

    if (file.size > MAX_RECEIPT_IMAGE_BYTES) {
      setValidationMessage("영수증 사진은 10MB 이하만 올릴 수 있어요.");
      input.value = "";
      return;
    }

    const formData = new FormData();
    const controller = new AbortController();
    formData.append("receipt", file);
    formData.append("input_method", selectedMethod.toUpperCase());
    analysisController.current = controller;
    setIsAnalyzing(true);
    setValidationMessage("");

    try {
      const response = await fetch(
        `/api/groups/${encodeURIComponent(group.id)}/receipts/analyze`,
        { method: "POST", body: formData, signal: controller.signal },
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message ?? "영수증 사진을 분석하지 못했어요.");
      }

      setTitle(result.store_name);
      setItems(
        result.items.map((item) =>
          createMenuDraft(participantMemberIds, item),
        ),
      );
      setAnalysisMetadata({
        image_key: result.image_key,
        input_method: result.input_method,
        ocr_status: result.ocr_status,
      });
    } catch (error) {
      if (error.name !== "AbortError") setValidationMessage(error.message);
    } finally {
      if (analysisController.current === controller) {
        analysisController.current = null;
      }
      setIsAnalyzing(false);
      input.value = "";
    }
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
      image_key:
        analysisMetadata?.image_key ?? initialReceipt?.image_key ?? null,
      input_method:
        analysisMetadata?.input_method ??
        initialReceipt?.input_method ??
        "MANUAL",
      ocr_status:
        analysisMetadata?.ocr_status ?? initialReceipt?.ocr_status ?? "NONE",
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
                : analysisMetadata
                  ? "분석 결과를 확인해 주세요"
                  : "등록 방식을 선택해 주세요"}
            </h2>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            aria-label={isEditing ? "영수증 수정 취소" : "영수증 추가 닫기"}
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        {!isEditing && !analysisMetadata && (
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
                  disabled={isAnalyzing}
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

        {analysisMetadata && (
          <p className={styles.methodDescription} role="status">
            OCR 분석이 끝났어요. 메뉴와 금액을 확인하고 필요한 부분만 고쳐 주세요.
          </p>
        )}

        {isEditing || selectedMethod === "manual" || analysisMetadata ? (
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
                onClick={handleClose}
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
          <section
            className={styles.photoMethod}
            aria-label="영수증 사진 선택"
            aria-busy={isAnalyzing}
          >
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
                <p role="status">
                  {isAnalyzing
                    ? "로컬 codex-cli가 메뉴와 금액을 분석하고 있어요."
                    : "JPEG, PNG, WebP · 최대 10MB"}
                </p>
              </div>
            </div>

            <label className={styles.photoSelectButton}>
              <input
                className={styles.visuallyHidden}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isAnalyzing}
                capture={
                  selectedMethod === "camera" ? "environment" : undefined
                }
                onChange={handlePhotoSelected}
              />
              {isAnalyzing
                ? "분석 중..."
                : selectedMethod === "camera"
                  ? "카메라 열기"
                  : "사진 선택하기"}
            </label>
            {validationMessage && (
              <p className={styles.validationMessage} role="alert">
                {validationMessage}
              </p>
            )}
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
