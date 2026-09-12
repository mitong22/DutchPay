"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { reportClientError } from "@/lib/client-log.mjs";
import {
  canCompleteSettlement,
  isSettlementCompleted,
  isWaitingGroup,
} from "@/lib/group-state.mjs";
import { calculateSettlement, receiptsForMember } from "@/lib/settlement.mjs";

const won = new Intl.NumberFormat("ko-KR");
let draftNumber = 0;

function nextDraftKey() {
  draftNumber += 1;
  return `draft-${draftNumber}`;
}

function formatWon(amount) {
  return `${won.format(amount)}원`;
}

function receiptDraft(receipt, members, viewerMemberId) {
  if (receipt) {
    return {
      ...receipt,
      paid_by_member_id: viewerMemberId,
      items: receipt.items.map((item) => ({ ...item, _key: item._id })),
    };
  }
  const defaultMemberId = viewerMemberId || members[0]?._id || "";
  return {
    store_name: "",
    paid_by_member_id: defaultMemberId,
    items: [
      {
        _key: nextDraftKey(),
        menu_name: "",
        quantity: 1,
        unit_price: "",
        consumer_member_ids: defaultMemberId ? [defaultMemberId] : [],
      },
    ],
  };
}

// Teacher: 한 파일에 영수증 편집·OCR·모임 보드가 함께 있습니다. props와 콜백의 이동 경로를 먼저 그린 뒤, AI에게 ReceiptEditor를 같은 기능 폴더로 분리하는 안을 요청해 독립적으로 읽기 쉬운지 비교해 보기.
function ReceiptEditor({ draft, groupId, members, onClose, onSave, saving }) {
  const [receipt, setReceipt] = useState(draft);
  const [tab, setTab] = useState("manual");
  const [photoName, setPhotoName] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const photoPreviewUrlRef = useRef("");
  const [reading, setReading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrTotal, setOcrTotal] = useState(null);
  const [error, setError] = useState("");
  const total = receipt.items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0,
  );

  useEffect(() => () => {
    if (photoPreviewUrlRef.current) URL.revokeObjectURL(photoPreviewUrlRef.current);
  }, []);

  // Teacher: createObjectURL은 브라우저 메모리의 파일 미리보기 주소를 만듭니다. 업로드된 서버 URL과 구분하고, 사진 교체와 컴포넌트 종료 때 revokeObjectURL로 해제하는 위치를 찾아보기.
  function selectPhoto(file) {
    if (photoPreviewUrlRef.current) URL.revokeObjectURL(photoPreviewUrlRef.current);
    const url = file ? URL.createObjectURL(file) : "";
    photoPreviewUrlRef.current = url;
    setPhotoPreviewUrl(url);
    setPhotoFile(file);
    setPhotoName(file?.name ?? "");
    setOcrError("");
  }

  // Teacher: setReceipt의 current는 최신 상태이고, 바깥 객체·items 배열·변경 메뉴를 각각 새로 만듭니다. 메뉴 2개 중 하나를 고치는 예제로 객체 참조를 그려 보고, AI에게 반복문 버전으로 풀어 달라고 요청해 보기.
  function updateItem(index, patch) {
    setReceipt((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function toggleConsumer(index, memberId) {
    const ids = receipt.items[index].consumer_member_ids;
    updateItem(index, {
      consumer_member_ids: ids.includes(memberId)
        ? ids.filter((id) => id !== memberId)
        : [...ids, memberId],
    });
  }

  function submit(event) {
    event.preventDefault();
    if (receipt.items.some((item) => item.consumer_member_ids.length === 0)) {
      return setError("모든 메뉴에서 먹은 사람을 한 명 이상 선택해 주세요.");
    }
    if (ocrTotal !== null && total !== ocrTotal && !window.confirm(`영수증 결제액 ${formatWon(ocrTotal)}과 메뉴 합계 ${formatWon(total)}이 달라요. 할인이나 누락을 확인했으며 현재 메뉴 금액으로 저장할까요?`)) return;
    onSave({
      ...receipt,
      items: receipt.items.map(({ _key, ...item }) => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
    });
  }

  async function readReceipt() {
    if (!photoFile) return setOcrError("영수증 사진을 선택해 주세요.");
    setReading(true);
    setOcrError("");
    const form = new FormData();
    form.append("file", photoFile);
    form.append("source", tab);

    try {
      const response = await fetch(`/api/ocr?groupId=${encodeURIComponent(groupId)}`, {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.error || "영수증을 인식하지 못했어요.");
        error.status = response.status;
        throw error;
      }

      const defaultMemberId = receipt.paid_by_member_id || members[0]?._id || "";
      setOcrTotal(data.total_amount > 0 ? data.total_amount : null);
      if (!data.total_amount) setOcrError("메뉴는 읽었지만 결제 총액은 확인하지 못했어요. 사진과 메뉴 금액을 비교해 주세요.");
      setReceipt((current) => ({
        ...current,
        store_name: data.store_name || current.store_name,
        items: data.items.map((item) => ({
          ...item,
          _key: nextDraftKey(),
          consumer_member_ids: defaultMemberId ? [defaultMemberId] : [],
        })),
      }));
    } catch (error) {
      reportClientError(error, "receipt.ocr", error.status);
      setOcrError(error.message);
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
        <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="닫기">×</button>
        <p className="eyebrow">RECEIPT</p>
        <h2 id="receipt-title">{receipt._id ? "영수증 수정" : "영수증 추가"}</h2>

        <div className="segmented receipt-tabs" aria-label="입력 방식">
          {[
            ["manual", "직접 입력"],
            ["camera", "카메라"],
            ["photo", "사진 선택"],
          ].map(([value, label]) => (
            <button
              className={tab === value ? "active" : ""}
              type="button"
              key={value}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab !== "manual" && (
          <div className="photo-box">
            {photoPreviewUrl ? (
              // Blob 미리보기는 Next 이미지 최적화 대상이 아니다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="receipt-preview"
                src={photoPreviewUrl}
                alt={tab === "camera" ? "촬영한 영수증 미리보기" : "선택한 영수증 미리보기"}
              />
            ) : (
              <span aria-hidden="true">📷</span>
            )}
            <strong>{photoName || (tab === "camera" ? "영수증을 촬영해 주세요" : "영수증 사진을 골라 주세요")}</strong>
            <small>JPG/PNG · 최대 10MB · 인식 결과는 저장 전에 확인해 주세요.</small>
            <label className="secondary-button file-button">
              {tab === "camera" ? "카메라 열기" : "사진 선택"}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                capture={tab === "camera" ? "environment" : undefined}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  selectPhoto(file);
                }}
              />
            </label>
            {photoFile && (
              <button className="primary-button" type="button" onClick={readReceipt} disabled={reading}>
                {reading ? "영수증 읽는 중..." : "영수증 인식"}
              </button>
            )}
            {ocrError && <p className="form-error" role="alert">{ocrError}</p>}
          </div>
        )}

        {/* // Teacher: 이 폼은 preventDefault 후 JSON을 만들어 onSave로 넘깁니다. submit → saveReceipt → post → API의 input.action 분기까지 추적하고, 수업의 form + Server Action으로 줄이는 안과 비교해 보기. */}
        <form className="receipt-form" onSubmit={submit}>
          <div className="two-columns">
            <label>
              가게 이름
              <input
                required
                maxLength={100}
                value={receipt.store_name}
                placeholder="OO식당"
                onChange={(event) => setReceipt((value) => ({ ...value, store_name: event.target.value }))}
              />
            </label>
            <label>
              결제한 사람 (본인)
              <input
                readOnly
                value={members.find((member) => member._id === receipt.paid_by_member_id)?.nickname ?? ""}
              />
            </label>
          </div>

          <div className="menu-editor-heading">
            <div><strong>메뉴별 내역</strong><small>수량 × 단가와 먹은 사람을 선택하세요</small></div>
            <strong className="running-total">합계 {formatWon(total)}</strong>
          </div>
          {ocrTotal !== null && (
            <p className={total === ocrTotal ? "muted" : "form-error"} role="status">
              영수증 결제액 {formatWon(ocrTotal)} · 메뉴 합계 {formatWon(total)}
              {total !== ocrTotal && ` · 차이 ${formatWon(Math.abs(total - ocrTotal))}. 할인 또는 누락된 메뉴를 확인하고 단가를 수정해 주세요.`}
            </p>
          )}

          <div className="menu-editor-list">
            {receipt.items.map((item, index) => (
              <fieldset className="menu-editor-item" key={item._key}>
                <legend>메뉴 {index + 1}</legend>
                {receipt.items.length > 1 && (
                  <button
                    className="icon-button remove-menu"
                    type="button"
                    aria-label={`메뉴 ${index + 1} 삭제`}
                    onClick={() => setReceipt((value) => ({
                      ...value,
                      items: value.items.filter((_, itemIndex) => itemIndex !== index),
                    }))}
                  >×</button>
                )}
                <div className="menu-input-grid">
                  <label>
                    메뉴 이름
                    <input
                      required
                      maxLength={80}
                      value={item.menu_name}
                      placeholder="삼겹살"
                      onChange={(event) => updateItem(index, { menu_name: event.target.value })}
                    />
                  </label>
                  <label>
                    수량
                    <input
                      required
                      type="number"
                      min="1"
                      max="999"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, { quantity: event.target.value })}
                    />
                  </label>
                  <label>
                    단가
                    <span className="input-with-suffix">
                      <input
                        className="amount-input"
                        required
                        type="number"
                        min="0"
                        step="1"
                        value={item.unit_price}
                        placeholder="15000"
                        onChange={(event) => updateItem(index, { unit_price: event.target.value })}
                      />
                      <span>원</span>
                    </span>
                  </label>
                </div>
                <div className="consumer-field">
                  <span>이 메뉴를 먹은 사람</span>
                  <div className="consumer-chips">
                    {members.map((member) => (
                      <label className={item.consumer_member_ids.includes(member._id) ? "checked" : ""} key={member._id}>
                        <input
                          type="checkbox"
                          checked={item.consumer_member_ids.includes(member._id)}
                          onChange={() => toggleConsumer(index, member._id)}
                        />
                        {member.nickname}
                      </label>
                    ))}
                  </div>
                </div>
                <p className="line-total">소계 {formatWon(Number(item.quantity || 0) * Number(item.unit_price || 0))}</p>
              </fieldset>
            ))}
          </div>

          <button
            className="text-button add-menu"
            type="button"
            onClick={() => setReceipt((value) => ({
              ...value,
              items: [
                ...value.items,
                {
                  _key: nextDraftKey(),
                  menu_name: "",
                  quantity: 1,
                  unit_price: "",
                  consumer_member_ids: [],
                },
              ],
            }))}
          >+ 메뉴 추가</button>

          {error && <p className="form-error" role="alert">{error}</p>}
          <footer className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>취소</button>
            <button className="primary-button" disabled={saving}>{saving ? "저장 중..." : "영수증 저장"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function BoardClient({ initialBoard }) {
  const router = useRouter();
  const { group, members, receipts, viewer } = initialBoard;
  const [selectedId, setSelectedId] = useState(receipts[0]?._id ?? null);
  // Teacher: 참여자 필터와 선택 영수증을 로컬 state에 둡니다. 새로고침·뒤로가기·URL 공유 때 유지되는지 확인하고, 수업의 검색·필터를 searchParams로 전달하는 방식과 비교해 보기.
  const [memberFilterId, setMemberFilterId] = useState(
    viewer.memberId ?? members[0]?._id ?? null,
  );
  const [editorDraft, setEditorDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [inviteUrls, setInviteUrls] = useState([]);
  const [notice, setNotice] = useState("");
  // Teacher: useMemo는 의존값이 같을 때 계산 결과를 재사용하는 Hook입니다. 수업의 기본 Hook만 쓰는 안으로 먼저 일반 Map·배열 계산을 해 보고, 실제 비용을 확인한 뒤 세 군데 메모이제이션이 필요한지 논의해 보기.
  const memberById = useMemo(
    () => new Map(members.map((member) => [member._id, member])),
    [members],
  );
  const visibleReceipts = useMemo(
    () => receiptsForMember(receipts, memberFilterId),
    [memberFilterId, receipts],
  );
  const selectedReceipt =
    visibleReceipts.find((receipt) => receipt._id === selectedId) ??
    visibleReceipts[0] ??
    null;
  const filteredMember = memberFilterId ? memberById.get(memberFilterId) : null;
  const settlement = useMemo(
    () => calculateSettlement(receipts, members),
    [receipts, members],
  );
  const isWaiting = isWaitingGroup(group);
  const settlementCompleted = isSettlementCompleted(group);
  const canFinishSettlement = canCompleteSettlement(group, viewer);
  const canManageReceipt =
    !settlementCompleted &&
    selectedReceipt?.uploaded_by_member_id === viewer.memberId;

  useEffect(() => {
    if (!isWaiting) return undefined;
    const interval = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [isWaiting, router]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function post(input) {
    let response;
    try {
      response = await fetch(`/api/groups/${group._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.error || "요청을 처리하지 못했어요.");
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      reportClientError(error, `group.${input.action}`, response?.status);
      throw error;
    }
  }

  async function saveReceipt(receipt) {
    setSaving(true);
    setNotice("");
    try {
      const data = await post({ action: "saveReceipt", receipt });
      setSelectedId(data.receiptId);
      setMemberFilterId(viewer.memberId);
      setEditorDraft(null);
      setNotice("영수증을 저장했어요.");
      router.refresh();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeReceipt() {
    if (!selectedReceipt || !window.confirm("이 영수증과 결제 상태를 삭제할까요?")) return;
    try {
      await post({ action: "deleteReceipt", receiptId: selectedReceipt._id });
      setSelectedId(null);
      setNotice("영수증을 삭제했어요.");
      router.refresh();
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function issueInvites() {
    if (
      inviteUrls.length &&
      !window.confirm("기존에 아직 사용하지 않은 링크는 폐기돼요. 새로 발급할까요?")
    ) return;

    try {
      const data = await post({ action: "createInvites" });
      const urls = data.invitePaths.map((path) => new URL(
        path,
        process.env.NEXT_PUBLIC_APP_URL || window.location.origin,
      ).toString());
      setInviteUrls(urls);
      setNotice(`${urls.length}개의 1회용 초대 링크를 발급했어요.`);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function shareInvite(url) {
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: `${group.name} 초대`, text: "몫대로 모임에 참여해 주세요.", url });
          return;
        } catch (error) {
          if (error.name === "AbortError") return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setNotice("초대 링크를 복사했어요. 한 사람에게만 보내 주세요.");
      } else {
        window.prompt("초대 링크를 길게 눌러 복사해 주세요.", url);
        setNotice("초대 링크를 표시했어요.");
      }
    } catch (error) {
      reportClientError(error, "invite.share", error.status);
      setNotice(error.message);
    }
  }

  async function finishSettlement() {
    if (!window.confirm("정산을 완료하면 영수증과 참여 내역을 더 이상 수정할 수 없어요. 완료할까요?")) return;
    setFinishing(true);
    setNotice("");
    try {
      await post({ action: "completeSettlement" });
      setNotice("정산을 완료했어요.");
      router.refresh();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setFinishing(false);
    }
  }

  if (isWaiting) {
    const expectedCount = Number(group.expected_member_count) || members.length;
    const remainingCount = Math.max(0, expectedCount - members.length);

    return (
      <main className="board-shell">
        <nav className="board-nav">
          <Link href="/" className="brand"><span className="brand-mark">몫</span>몫대로</Link>
          <div className="board-nav-actions">
            <span className="viewer-chip">{viewer.nickname}</span>
            <Link className="secondary-button compact" href="/">내 모임</Link>
          </div>
        </nav>

        {notice && <button className="notice" type="button" onClick={() => setNotice("")} aria-label="알림 닫기">{notice}<span>×</span></button>}

        <section className="invite-card panel" aria-live="polite">
          <span className="invite-emoji" aria-hidden="true">⏳</span>
          <p className="eyebrow">WAITING</p>
          <h1>{group.name}</h1>
          <p>모든 참여자가 들어오면 자동으로 모임이 시작돼요.</p>
          <div className="join-progress">
            <div><span style={{ width: `${Math.min(100, (members.length / expectedCount) * 100)}%` }} /></div>
            <strong>{members.length} / {expectedCount}명 참여 완료</strong>
          </div>
          <div className="summary-box">
            {members.map((member) => (
              <div key={member._id}>
                <span>{member._id === viewer.memberId ? "나" : member.nickname}</span>
                <strong>참여 완료</strong>
              </div>
            ))}
            {remainingCount > 0 && (
              <div><span>아직 입장 전</span><strong>{remainingCount}명 기다리는 중</strong></div>
            )}
          </div>
          {viewer.isHost && inviteUrls.length > 0 && (
            <div className="invite-link-list">
              <p>각 링크는 한 사람만 한 번 사용할 수 있어요.</p>
              {inviteUrls.map((url, index) => (
                <div key={url}>
                  <label>
                    참여자 {index + 1}
                    <input readOnly value={url} onFocus={(event) => event.target.select()} />
                  </label>
                  <button className="secondary-button compact" type="button" onClick={() => shareInvite(url)}>공유</button>
                </div>
              ))}
            </div>
          )}
          <footer className="modal-actions">
            {viewer.isHost && (
              <button className="primary-button" onClick={issueInvites}>
                {inviteUrls.length ? "개별 링크 다시 발급" : "개별 초대 링크 발급"}
              </button>
            )}
            <button className="secondary-button" onClick={() => router.refresh()}>참여 현황 새로고침</button>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className="board-shell">
      <nav className="board-nav">
        <Link href="/" className="brand"><span className="brand-mark">몫</span>몫대로</Link>
        <div className="board-nav-actions">
          <span className="viewer-chip">{viewer.nickname}</span>
          <Link className="secondary-button compact" href="/">내 모임</Link>
        </div>
      </nav>

      <header className="group-hero">
        <div>
          <div className="hero-badges">
            <span className={`mode-badge ${group.mode === "SOLO" ? "solo" : "together"}`}>
              {group.mode === "SOLO" ? "혼자 정리" : "함께 정리"}
            </span>
            <span className={`status-dot ${settlementCompleted ? "completed" : ""}`}>
              {settlementCompleted ? "정산 완료" : "정산 진행 중"}
            </span>
          </div>
          <h1>{group.name}</h1>
          <div className="member-stack" aria-label={`${members.length}명 참여`}>
            {members.map((member, index) => (
              <span
                style={{ zIndex: members.length - index }}
                title={member._id === viewer.memberId ? `${member.nickname} (나)` : member.nickname}
                key={member._id}
              >
                {member._id === viewer.memberId ? "나" : member.nickname.slice(0, 1)}
              </span>
            ))}
            <strong>{members.length}명</strong>
          </div>
        </div>
        <div className="group-actions">
          {!settlementCompleted && (
            <button
              className="primary-button"
              onClick={() => setEditorDraft(receiptDraft(null, members, viewer.memberId))}
            >+ 영수증 추가</button>
          )}
        </div>
      </header>

      {notice && <button className="notice" type="button" onClick={() => setNotice("")} aria-label="알림 닫기">{notice}<span>×</span></button>}

      <section className="settlement-section">
        <div className="section-heading">
          <div><p className="eyebrow">SETTLEMENT</p><h2>정산 현황</h2></div>
          <span>{settlementCompleted ? "총대가 정산을 완료했어요" : "참여자를 누르면 그 사람이 올린 영수증을 볼 수 있어요"}</span>
        </div>
        <div className="balance-grid">
          {settlement.rows.map((row) => (
            <article className={`balance-card ${memberFilterId === row._id ? "selected" : ""}`} key={row._id}>
              <div><span className="avatar">{row.nickname.slice(0, 1)}</span><strong>{row.nickname} <span role="img" aria-label={String(row.user_id) === String(group.created_by) ? "총대" : "팀원"}>{String(row.user_id) === String(group.created_by) ? "🔫" : "💛"}</span></strong></div>
              <dl>
                <div><dt>결제</dt><dd>{formatWon(row.paid)}</dd></div>
                <div><dt>내 몫</dt><dd>{formatWon(row.owes)}</dd></div>
              </dl>
              <p className={row.balance >= 0 ? "positive" : "negative"}>
                {row.balance > 0
                  ? `${formatWon(row.balance)} 받기`
                  : row.balance < 0
                    ? `${formatWon(-row.balance)} 보내기`
                    : "주고받을 금액 없음"}
              </p>
              <button
                className="balance-card-filter"
                type="button"
                aria-label={`${row.nickname}님이 올린 영수증 보기`}
                aria-pressed={memberFilterId === row._id}
                onClick={() => {
                  setMemberFilterId(row._id);
                  setSelectedId(null);
                }}
              />
            </article>
          ))}
        </div>
        {settlement.transfers.length > 0 && (
          <div className="transfer-strip">
            <strong>최소 송금 안내</strong>
            <div>
              {settlement.transfers.map((transfer, index) => (
                <span key={`${transfer.fromMemberId}-${transfer.toMemberId}-${index}`}>
                  {memberById.get(transfer.fromMemberId)?.nickname} → {memberById.get(transfer.toMemberId)?.nickname}
                  <b>{formatWon(transfer.amount)}</b>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="receipts-section">
        <div className="section-heading">
          <div><p className="eyebrow">RECEIPTS</p><h2>영수증 내역</h2></div>
          <span className="receipt-summary">
            <strong>{filteredMember?.nickname} 등록 · 총 {formatWon(visibleReceipts.reduce((sum, receipt) => sum + receipt.total_amount, 0))}</strong>
          </span>
        </div>

        {visibleReceipts.length === 0 ? (
          <div className="receipt-empty panel">
            <span aria-hidden="true">🧾</span>
            <h3>{filteredMember?.nickname}님이 등록한 영수증이 없어요</h3>
            <p>위에서 다른 참여자를 누르면 그 사람이 직접 올린 영수증을 볼 수 있어요.</p>
            {!settlementCompleted && memberFilterId === viewer.memberId && (
              <button className="primary-button" onClick={() => setEditorDraft(receiptDraft(null, members, viewer.memberId))}>영수증 추가</button>
            )}
          </div>
        ) : (
          <div className="receipt-workspace">
            <aside className="receipt-list" aria-label="영수증 목록">
              {visibleReceipts.map((receipt) => (
                  <button
                    className={selectedReceipt?._id === receipt._id ? "selected" : ""}
                    type="button"
                    onClick={() => setSelectedId(receipt._id)}
                    key={receipt._id}
                  >
                    <span className="receipt-icon" aria-hidden="true">⌁</span>
                    <span><strong>{receipt.store_name}</strong><small>{receipt.items?.length ?? 0}개 메뉴</small></span>
                    <b>{formatWon(receipt.total_amount)}</b>
                  </button>
                ))}
            </aside>

            {selectedReceipt && (
              <article className="receipt-detail">
                <header>
                  <div>
                    <p>{selectedReceipt.created_at ? new Date(selectedReceipt.created_at).toLocaleDateString("ko-KR") : "등록된 영수증"}</p>
                    <h3>{selectedReceipt.store_name}</h3>
                    <span>{memberById.get(selectedReceipt.paid_by_member_id)?.nickname}님이 결제</span>
                  </div>
                  {canManageReceipt && (
                    <div className="detail-actions">
                      <button className="text-button" onClick={() => setEditorDraft(receiptDraft(selectedReceipt, members, viewer.memberId))}>수정</button>
                      <button className="text-button danger" onClick={removeReceipt}>삭제</button>
                    </div>
                  )}
                </header>

                <div className="item-detail-list">
                  {selectedReceipt.items.map((item) => (
                      <section className="item-detail" key={item._id}>
                        <div className="item-title">
                          <div><strong>{item.menu_name}</strong><small>{formatWon(item.unit_price)} × {item.quantity}</small></div>
                          <b>{formatWon(item.line_total)}</b>
                        </div>
                        <div className="receipt-consumers">
                          <small>먹은 사람</small>
                          <div>
                            {item.consumer_member_ids.map((memberId) => (
                              <span key={memberId}>{memberById.get(memberId)?.nickname ?? "알 수 없는 참여자"}</span>
                            ))}
                          </div>
                        </div>
                      </section>
                    ))}
                </div>
                <footer className="receipt-total"><span>영수증 합계</span><strong>{formatWon(selectedReceipt.total_amount)}</strong></footer>
              </article>
            )}
          </div>
        )}
      </section>

      {canFinishSettlement && (
        <section className="settlement-complete panel">
          <div>
            <strong>모든 영수증을 확인했나요?</strong>
            <small>완료 후에는 영수증과 참여 내역을 더 이상 바꿀 수 없어요.</small>
          </div>
          <button className="primary-button" type="button" onClick={finishSettlement} disabled={finishing}>
            {finishing ? "완료 중..." : "정산 완료"}
          </button>
        </section>
      )}

      {editorDraft && (
        <ReceiptEditor
          key={editorDraft._id ?? "new"}
          draft={editorDraft}
          groupId={group._id}
          members={members}
          onClose={() => setEditorDraft(null)}
          onSave={saveReceipt}
          saving={saving}
        />
      )}
    </main>
  );
}
