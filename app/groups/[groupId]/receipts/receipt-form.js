"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { formatWon } from "@/app/groups/[groupId]/format-won";
import {
  loadTemporaryReceiptAction,
  saveReceiptAction,
} from "@/app/groups/[groupId]/receipts/actions";

const INITIAL_ACTION_STATE = { status: "idle", message: "" };
const INITIAL_TEMPORARY_DATA_STATE = {
  status: "idle",
  message: "",
  loadId: "",
  draft: null,
};

function EntryModeNotice({
  mode,
  onManualMode,
  temporaryDataEnabled,
  temporaryDataAction,
  temporaryDataState,
  isTemporaryDataPending,
}) {
  const isCamera = mode === "camera";

  return (
    <div className="ocr-notice">
      <span aria-hidden="true">{isCamera ? "📷" : "🖼️"}</span>
      <h2>{isCamera ? "촬영하기" : "사진 첨부"}는 정책 확인이 필요합니다.</h2>
      <p>
        OCR 제공 업체와 영수증 이미지 저장 위치가 아직 결정되지 않아 이미지가
        외부로 전송되거나 저장되지 않도록 비활성화했습니다.
      </p>
      <div className="ocr-notice__actions">
        <button
          className={`button ${temporaryDataEnabled ? "button--quiet" : "button--primary"}`}
          type="button"
          onClick={onManualMode}
        >
          직접 입력으로 계속하기
        </button>
        {temporaryDataEnabled ? (
          <form action={temporaryDataAction}>
            <button
              className="button button--primary"
              type="submit"
              disabled={isTemporaryDataPending}
            >
              {isTemporaryDataPending
                ? "임시데이터 불러오는 중..."
                : "임시데이터 가져오기"}
            </button>
          </form>
        ) : null}
      </div>
      {temporaryDataState.status === "error" ? (
        <p className="form-message form-message--error" role="alert">
          {temporaryDataState.message}
        </p>
      ) : null}
    </div>
  );
}

function MemberCheckbox({
  member,
  name,
  checked,
  disabled,
  onChange,
}) {
  return (
    <label className={`check-card ${checked ? "is-checked" : ""}`}>
      <input
        name={name}
        type="checkbox"
        value={member.id}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="member-avatar member-avatar--small" aria-hidden="true">
        {member.nickname.slice(0, 1)}
      </span>
      <strong>{member.nickname}</strong>
    </label>
  );
}

export default function ReceiptForm({
  group,
  members,
  initialReceipt,
  temporaryReceiptDataEnabled = false,
}) {
  const saveAction = saveReceiptAction.bind(
    null,
    group.id,
    initialReceipt.id,
  );
  const temporaryDataLoaderAction = loadTemporaryReceiptAction.bind(
    null,
    group.id,
  );
  const [actionState, formAction, isPending] = useActionState(
    saveAction,
    INITIAL_ACTION_STATE,
  );
  const [
    temporaryDataState,
    temporaryDataFormAction,
    isTemporaryDataPending,
  ] = useActionState(
    temporaryDataLoaderAction,
    INITIAL_TEMPORARY_DATA_STATE,
  );
  const appliedTemporaryLoadId = useRef("");
  const [entryMode, setEntryMode] = useState("manual");
  const [storeName, setStoreName] = useState(initialReceipt.storeName);
  const [loadedTemporarySourceName, setLoadedTemporarySourceName] =
    useState("");
  const [paidByMemberId, setPaidByMemberId] = useState(
    initialReceipt.paidByMemberId,
  );
  const [participantMemberIds, setParticipantMemberIds] = useState(
    initialReceipt.participantMemberIds,
  );
  const [menus, setMenus] = useState(
    initialReceipt.items.map((item, index) => ({
      ...item,
      clientKey: item.id || `initial-${index}`,
    })),
  );

  useEffect(() => {
    if (
      temporaryDataState.status !== "success" ||
      !temporaryDataState.draft ||
      !temporaryDataState.loadId ||
      appliedTemporaryLoadId.current === temporaryDataState.loadId
    ) {
      return;
    }

    appliedTemporaryLoadId.current = temporaryDataState.loadId;
    setStoreName(temporaryDataState.draft.storeName);
    setMenus(
      temporaryDataState.draft.items.map((item, itemIndex) => ({
        id: "",
        clientKey: `temporary-${temporaryDataState.loadId}-${itemIndex}`,
        menuName: item.menuName,
        lineTotal: String(item.lineTotal),
        consumerMemberIds: [...participantMemberIds],
      })),
    );
    setLoadedTemporarySourceName(temporaryDataState.draft.sourceName);
    setEntryMode("manual");
  }, [participantMemberIds, temporaryDataState]);

  const totalAmount = menus.reduce(
    (total, menu) => total + (Number(menu.lineTotal) || 0),
    0,
  );

  function toggleReceiptParticipant(memberId, isChecked) {
    if (isChecked) {
      setParticipantMemberIds([...participantMemberIds, memberId]);
      return;
    }

    setParticipantMemberIds(
      participantMemberIds.filter(
        (participantMemberId) => participantMemberId !== memberId,
      ),
    );
    setMenus(
      menus.map((menu) => ({
        ...menu,
        consumerMemberIds: menu.consumerMemberIds.filter(
          (consumerMemberId) => consumerMemberId !== memberId,
        ),
      })),
    );
  }

  function updateMenu(menuIndex, fieldName, value) {
    setMenus(
      menus.map((menu, index) =>
        index === menuIndex ? { ...menu, [fieldName]: value } : menu,
      ),
    );
  }

  function toggleMenuConsumer(menuIndex, memberId, isChecked) {
    const menu = menus[menuIndex];
    const nextConsumerMemberIds = isChecked
      ? [...menu.consumerMemberIds, memberId]
      : menu.consumerMemberIds.filter(
          (consumerMemberId) => consumerMemberId !== memberId,
        );

    updateMenu(menuIndex, "consumerMemberIds", nextConsumerMemberIds);
  }

  function addMenu() {
    setMenus([
      ...menus,
      {
        id: "",
        clientKey: `new-${Date.now()}-${menus.length}`,
        menuName: "",
        lineTotal: "",
        consumerMemberIds: [...participantMemberIds],
      },
    ]);
  }

  function removeMenu(menuIndex) {
    setMenus(menus.filter((menu, index) => index !== menuIndex));
  }

  return (
    <main className="page-shell receipt-form-page">
      <div className="receipt-form-heading">
        <div>
          <span className="eyebrow">
            {initialReceipt.id ? "영수증 수정" : "새 영수증"}
          </span>
          <h1>{group.name}</h1>
          <p>금액은 원 단위가 아닌 10원 단위로 입력해 주세요.</p>
        </div>
        <Link className="button button--quiet" href={`/groups/${group.id}`}>
          모임으로 돌아가기
        </Link>
      </div>

      <div className="entry-mode-tabs" aria-label="영수증 등록 방식">
        <button
          className={entryMode === "manual" ? "is-active" : ""}
          type="button"
          onClick={() => setEntryMode("manual")}
        >
          직접 입력
        </button>
        <button
          className={entryMode === "camera" ? "is-active" : ""}
          type="button"
          onClick={() => setEntryMode("camera")}
        >
          촬영하기
        </button>
        <button
          className={entryMode === "upload" ? "is-active" : ""}
          type="button"
          onClick={() => setEntryMode("upload")}
        >
          사진 첨부
        </button>
      </div>

      {entryMode !== "manual" ? (
        <EntryModeNotice
          mode={entryMode}
          onManualMode={() => setEntryMode("manual")}
          temporaryDataEnabled={temporaryReceiptDataEnabled}
          temporaryDataAction={temporaryDataFormAction}
          temporaryDataState={temporaryDataState}
          isTemporaryDataPending={isTemporaryDataPending}
        />
      ) : (
        <form className="receipt-form" action={formAction}>
          <input name="menu_count" type="hidden" value={menus.length} />

          {loadedTemporarySourceName ? (
            <p
              className="form-message form-message--success receipt-form__source"
              aria-live="polite"
            >
              임시 OCR 데이터 {loadedTemporarySourceName}를 불러왔습니다.
            </p>
          ) : null}

          <section className="form-section">
            <div className="form-section__heading">
              <span>1</span>
              <div>
                <h2>영수증 기본 정보</h2>
                <p>구분하기 쉬운 소제목과 실제 결제자를 입력합니다.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>영수증 소제목</span>
                <input
                  name="store_name"
                  type="text"
                  maxLength={80}
                  value={storeName}
                  placeholder="예: 1차 고깃집"
                  required
                  onChange={(event) => setStoreName(event.target.value)}
                />
              </label>

              {group.mode === "TOGETHER" ? (
                <label className="field">
                  <span>실제 결제자</span>
                  <select
                    name="paid_by_member_id"
                    value={paidByMemberId}
                    onChange={(event) => setPaidByMemberId(event.target.value)}
                  >
                    {members.map((member) => (
                      <option value={member.id} key={member.id}>
                        {member.nickname}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="field">
                  <span>실제 결제자</span>
                  <div className="fixed-value">
                    {members.find((member) => member.id === paidByMemberId)?.nickname}
                    <small>혼자하기에서는 모임장으로 고정됩니다.</small>
                  </div>
                  <input
                    name="paid_by_member_id"
                    type="hidden"
                    value={paidByMemberId}
                  />
                </div>
              )}
            </div>
          </section>

          <section className="form-section">
            <div className="form-section__heading">
              <span>2</span>
              <div>
                <h2>영수증 참여자</h2>
                <p>이 영수증의 일정에 참여한 사람만 선택합니다.</p>
              </div>
            </div>
            <div className="check-card-grid">
              {members.map((member) => {
                const isChecked = participantMemberIds.includes(member.id);
                return (
                  <MemberCheckbox
                    member={member}
                    name="participant_member_ids"
                    checked={isChecked}
                    disabled={isChecked && participantMemberIds.length === 1}
                    onChange={(checked) =>
                      toggleReceiptParticipant(member.id, checked)
                    }
                    key={member.id}
                  />
                );
              })}
            </div>
          </section>

          <section className="form-section">
            <div className="form-section__heading form-section__heading--row">
              <div className="form-section__title">
                <span>3</span>
                <div>
                  <h2>메뉴와 먹은 사람</h2>
                  <p>메뉴 금액과 실제로 비용을 부담할 사람을 고릅니다.</p>
                </div>
              </div>
              <strong className="running-total">합계 {formatWon(totalAmount)}</strong>
            </div>

            <div className="menu-form-list">
              {menus.map((menu, menuIndex) => {
                const selectedMembers = members.filter((member) =>
                  participantMemberIds.includes(member.id),
                );

                return (
                  <article className="menu-form-card" key={menu.clientKey}>
                    <input
                      name={`item_id_${menuIndex}`}
                      type="hidden"
                      value={menu.id}
                    />
                    <div className="menu-form-card__heading">
                      <strong>메뉴 {menuIndex + 1}</strong>
                      <button
                        className="text-button text-button--danger"
                        type="button"
                        disabled={menus.length === 1}
                        onClick={() => removeMenu(menuIndex)}
                      >
                        메뉴 삭제
                      </button>
                    </div>
                    <div className="form-grid">
                      <label className="field">
                        <span>메뉴명</span>
                        <input
                          name={`menu_name_${menuIndex}`}
                          type="text"
                          maxLength={80}
                          value={menu.menuName}
                          placeholder="예: 삼겹살"
                          required
                          onChange={(event) =>
                            updateMenu(menuIndex, "menuName", event.target.value)
                          }
                        />
                      </label>
                      <label className="field">
                        <span>금액</span>
                        <div className="amount-input">
                          <input
                            name={`line_total_${menuIndex}`}
                            type="number"
                            inputMode="numeric"
                            min={10}
                            step={10}
                            value={menu.lineTotal}
                            placeholder="0"
                            required
                            onChange={(event) =>
                              updateMenu(
                                menuIndex,
                                "lineTotal",
                                event.target.value,
                              )
                            }
                          />
                          <span>원</span>
                        </div>
                      </label>
                    </div>

                    <div className="menu-consumers">
                      <strong>먹은 사람</strong>
                      <div className="check-card-grid check-card-grid--compact">
                        {selectedMembers.map((member) => {
                          const isChecked = menu.consumerMemberIds.includes(
                            member.id,
                          );
                          return (
                            <MemberCheckbox
                              member={member}
                              name={`consumer_member_ids_${menuIndex}`}
                              checked={isChecked}
                              disabled={
                                isChecked && menu.consumerMemberIds.length === 1
                              }
                              onChange={(checked) =>
                                toggleMenuConsumer(
                                  menuIndex,
                                  member.id,
                                  checked,
                                )
                              }
                              key={member.id}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <button
              className="button button--secondary button--wide"
              type="button"
              disabled={menus.length >= 50}
              onClick={addMenu}
            >
              + 메뉴 추가
            </button>
          </section>

          {actionState.status === "error" ? (
            <p className="form-message form-message--error" role="alert">
              {actionState.message}
            </p>
          ) : null}

          <div className="receipt-form-actions">
            <Link className="button button--quiet" href={`/groups/${group.id}`}>
              취소
            </Link>
            <button
              className="button button--primary"
              type="submit"
              disabled={isPending}
            >
              {isPending
                ? "저장 중..."
                : initialReceipt.id
                  ? "수정 내용 저장"
                  : "영수증 저장"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
