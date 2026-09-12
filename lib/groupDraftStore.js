const LEGACY_MODE_KEY = "dutchpay:group-draft:mode";
const DRAFT_KEY = "dutchpay:group-create-draft";
const STORE_CHANGE_EVENT = "dutchpay-draft-store-change";
const VALID_MODES = new Set(["SOLO", "TOGETHER"]);
const MIN_TOGETHER_MEMBERS = 2;
const MAX_TOGETHER_MEMBERS = 8;

const MODES = [
  {
    id: "SOLO",
    label: "혼자하기",
    description: "내가 모든 비용을 먼저 결제하고 참여자별로 나눠요.",
    detail: "다른 참여자는 서비스에 접속하지 않아도 돼요.",
  },
  {
    id: "TOGETHER",
    label: "함께하기",
    description: "여러 명이 각각 결제한 비용을 마지막에 함께 정산해요.",
    detail: "초대 링크를 열어 각자 별명으로 참여해요.",
  },
];

const EMPTY_DRAFT = {
  step: 1,
  mode: null,
  groupName: "",
  participantNames: [""],
  expectedMemberCount: 3,
  togetherParticipantNames: [],
  togetherParticipants: [],
  inviteToken: null,
  completed: false,
};

const EMPTY_DRAFT_SNAPSHOT = JSON.stringify(EMPTY_DRAFT);
const SOLO_DRAFT_SNAPSHOT = JSON.stringify({ ...EMPTY_DRAFT, mode: "SOLO" });
const TOGETHER_DRAFT_SNAPSHOT = JSON.stringify({
  ...EMPTY_DRAFT,
  mode: "TOGETHER",
});

// Teacher: 브라우저에 저장된 JSON은 과거 형식이거나 사용자가 바꾼 값일 수 있습니다. 기본값 펼치기 → 저장값 덮기 → 항목별 재검증 순서를 보고, AI에게 중첩 삼항식을 if문으로 풀어 달라고 요청해 보기.
function parseDraft(snapshot) {
  try {
    const draft = JSON.parse(snapshot);
    const expectedMemberCount = Number(draft.expectedMemberCount);

    return {
      ...EMPTY_DRAFT,
      ...draft,
      step: [1, 2, 3].includes(draft.step) ? draft.step : 1,
      mode: VALID_MODES.has(draft.mode) ? draft.mode : null,
      participantNames:
        Array.isArray(draft.participantNames) && draft.participantNames.length > 0
          ? draft.participantNames
          : [""],
      expectedMemberCount:
        Number.isInteger(expectedMemberCount) &&
        expectedMemberCount >= MIN_TOGETHER_MEMBERS &&
        expectedMemberCount <= MAX_TOGETHER_MEMBERS
          ? expectedMemberCount
          : EMPTY_DRAFT.expectedMemberCount,
      togetherParticipantNames: Array.isArray(draft.togetherParticipantNames)
        ? draft.togetherParticipantNames
        : [],
      togetherParticipants: Array.isArray(draft.togetherParticipants)
        ? draft.togetherParticipants.filter(
            (member) =>
              member &&
              typeof member.id === "string" &&
              typeof member.nickname === "string",
          )
        : [],
      inviteToken:
        typeof draft.inviteToken === "string" ? draft.inviteToken : null,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

// fun getDraftSnapshot. localStorage 저장된 모임 작성 내용 JSON 문자열로 반환
function getDraftSnapshot() {
  try {
    // localStorage에서 현재 작성 내용 조회
    const snapshot = window.localStorage.getItem(DRAFT_KEY);

    // 작성 중인 내용이 있으면 그대로 반환
    if (snapshot) return snapshot;

    // 작성 중인 내용이 없으면 이전 저장 방식의 모드값 조회
    const legacyMode = window.localStorage.getItem(LEGACY_MODE_KEY);

    // 이전 모드값에 맞는 기본 초안 반환
    if (legacyMode === "SOLO") return SOLO_DRAFT_SNAPSHOT;
    if (legacyMode === "TOGETHER") return TOGETHER_DRAFT_SNAPSHOT;
  } catch {
    // 접근 실패시 빈 초안 반환
    return EMPTY_DRAFT_SNAPSHOT;
  }
  // 저장된 현재, 이전 데이터가 모두 없으면 빈 초안 반환
  return EMPTY_DRAFT_SNAPSHOT;
}

function getServerDraftSnapshot() {
  // 서버 렌더링용 기본 데이터 조회
  return EMPTY_DRAFT_SNAPSHOT;
}

// fun subscribeToDraftStore. storage 구독 - 값 변경시 알림
// Teacher: 다른 문서에서의 storage 이벤트와 현재 창에서 직접 보내는 STORE_CHANGE_EVENT를 구분해 보기. replaceDraft → notifyStoreChange → 구독 콜백 → 화면 갱신 순서를 추적하고, cleanup에서 같은 콜백을 지우는 이유를 설명하기.
function subscribeToDraftStore(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORE_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORE_CHANGE_EVENT, callback);
  };
}

function notifyStoreChange() {
  window.dispatchEvent(new Event(STORE_CHANGE_EVENT));
}

// 모임 생성이 끝나기 전의 입력값만 브라우저에 임시 저장한다.
// 생성된 모임·참여자·영수증 데이터는 MongoDB에서만 관리한다.
function replaceDraft(nextDraft) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));

  if (nextDraft.mode) {
    window.localStorage.setItem(LEGACY_MODE_KEY, nextDraft.mode);
  } else {
    window.localStorage.removeItem(LEGACY_MODE_KEY);
  }

  notifyStoreChange();
}

function saveDraft(patch) {
  const currentDraft = parseDraft(getDraftSnapshot());
  replaceDraft({ ...currentDraft, ...patch });
}

function normalizeNames(names) {
  return names.map((name) => name.trim()).filter(Boolean);
}

function getDraftParticipantNames(draft) {
  return normalizeNames(
    draft.mode === "TOGETHER"
      ? draft.togetherParticipants.length > 0
        ? draft.togetherParticipants.map((member) => member.nickname)
        : draft.togetherParticipantNames
      : draft.participantNames,
  );
}

function getSetupError(draft, captain) {
  if (!draft.groupName.trim()) return "모임 이름을 입력해 주세요.";

  const participantNames = getDraftParticipantNames(draft);
  const comparableNames = participantNames.map((name) => name.toLowerCase());

  if (new Set(comparableNames).size !== comparableNames.length) {
    return "참여자 별명은 서로 다르게 입력해 주세요.";
  }

  if (comparableNames.includes(captain.nickname.trim().toLowerCase())) {
    return "총대와 다른 참여자 별명을 입력해 주세요.";
  }

  if (draft.mode === "TOGETHER" && !draft.inviteToken) {
    return "초대 링크를 발급하고 참여자를 받아 주세요.";
  }

  if (
    draft.mode === "TOGETHER" &&
    participantNames.length !== draft.expectedMemberCount - 1
  ) {
    return "예정된 참여자가 모두 입장해야 모임을 시작할 수 있어요.";
  }

  return "";
}

function getInviteUrl(inviteToken) {
  if (!inviteToken || typeof window === "undefined") return "";

  return `${window.location.origin}/invite/${encodeURIComponent(inviteToken)}`;
}

async function readInviteResponse(response) {
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(result.message ?? "초대 정보를 불러오지 못했어요.");
    error.status = response.status;
    throw error;
  }

  return result.invite;
}

function saveInviteParticipants(invite) {
  const participants = Array.isArray(invite?.participants)
    ? invite.participants
    : [];

  saveDraft({
    togetherParticipants: participants,
    togetherParticipantNames: participants.map((member) => member.nickname),
  });
}

function formatWon(amount) {
  return `${Number(amount).toLocaleString("ko-KR")}원`;
}

function formatSavedDate(value) {
  if (!value) return "저장됨";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "저장됨";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export {
  EMPTY_DRAFT,
  MAX_TOGETHER_MEMBERS,
  MIN_TOGETHER_MEMBERS,
  MODES,
  formatSavedDate,
  formatWon,
  getDraftParticipantNames,
  getDraftSnapshot,
  getInviteUrl,
  getServerDraftSnapshot,
  getSetupError,
  normalizeNames,
  parseDraft,
  readInviteResponse,
  replaceDraft,
  saveDraft,
  saveInviteParticipants,
  subscribeToDraftStore,
};
