const LEGACY_MODE_KEY = "dutchpay:group-draft:mode";
const DRAFT_KEY = "dutchpay:group-create-draft";
const ACTIVE_GROUP_KEY = "dutchpay:active-group";
const GROUPS_KEY = "dutchpay:groups";
const STORE_CHANGE_EVENT = "dutchpay-demo-store-change";
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
const EMPTY_GROUPS_SNAPSHOT = "[]";
const SOLO_DRAFT_SNAPSHOT = JSON.stringify({ ...EMPTY_DRAFT, mode: "SOLO" });
const TOGETHER_DRAFT_SNAPSHOT = JSON.stringify({
  ...EMPTY_DRAFT,
  mode: "TOGETHER",
});

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

function parseGroups(snapshot) {
  try {
    const groups = JSON.parse(snapshot);
    return Array.isArray(groups)
      ? groups.filter((group) => group && typeof group.id === "string")
      : [];
  } catch {
    return [];
  }
}

function getDraftSnapshot() {
  try {
    const snapshot = window.localStorage.getItem(DRAFT_KEY);

    if (snapshot) {
      return snapshot;
    }

    const legacyMode = window.localStorage.getItem(LEGACY_MODE_KEY);

    if (legacyMode === "SOLO") {
      return SOLO_DRAFT_SNAPSHOT;
    }

    if (legacyMode === "TOGETHER") {
      return TOGETHER_DRAFT_SNAPSHOT;
    }
  } catch {
    return EMPTY_DRAFT_SNAPSHOT;
  }

  return EMPTY_DRAFT_SNAPSHOT;
}

function getServerDraftSnapshot() {
  return EMPTY_DRAFT_SNAPSHOT;
}

function getGroupsSnapshot() {
  try {
    const storedGroups = parseGroups(
      window.localStorage.getItem(GROUPS_KEY) ?? EMPTY_GROUPS_SNAPSHOT,
    );
    const legacyGroupSnapshot = window.localStorage.getItem(ACTIVE_GROUP_KEY);

    if (!legacyGroupSnapshot) {
      return JSON.stringify(storedGroups);
    }

    const legacyGroup = JSON.parse(legacyGroupSnapshot);

    if (
      !legacyGroup?.id ||
      storedGroups.some((group) => group.id === legacyGroup.id)
    ) {
      return JSON.stringify(storedGroups);
    }

    return JSON.stringify([legacyGroup, ...storedGroups]);
  } catch {
    return EMPTY_GROUPS_SNAPSHOT;
  }
}

function getServerGroupsSnapshot() {
  return EMPTY_GROUPS_SNAPSHOT;
}

function subscribeToDemoStore(callback) {
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

// 모임을 만들기 전 작성 중인 값(draft)은 임시 데이터이므로
// 운영에서도 자동 저장이 필요하면 localStorage에 남겨둘 수 있다.
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

// 운영 DB 전환: 이 함수는 async로 바꾸고 POST /api/groups를 호출한다.
// 해당 Route Handler가 로그인 사용자와 입력값을 검증한 뒤
// db.collection("groups").insertOne(...)으로 저장하고 저장된 모임을 응답한다.
function saveGroup(group) {
  const currentGroups = parseGroups(getGroupsSnapshot());
  const nextGroups = [
    group,
    ...currentGroups.filter((currentGroup) => currentGroup.id !== group.id),
  ];

  window.localStorage.setItem(GROUPS_KEY, JSON.stringify(nextGroups));
  window.localStorage.setItem(ACTIVE_GROUP_KEY, JSON.stringify(group));
  notifyStoreChange();
}

// 운영 DB 전환: PATCH /api/groups/:groupId를 호출한다.
// 서버가 총대 권한을 확인한 뒤 updateOne(...)을 실행하며,
// 브라우저 상태는 DB 응답을 화면에 반영하는 용도로만 사용한다.
function replaceGroup(group) {
  const currentGroups = parseGroups(getGroupsSnapshot());
  const nextGroups = currentGroups.map((currentGroup) =>
    currentGroup.id === group.id ? group : currentGroup,
  );

  window.localStorage.setItem(GROUPS_KEY, JSON.stringify(nextGroups));

  const activeGroup = JSON.parse(
    window.localStorage.getItem(ACTIVE_GROUP_KEY) ?? "null",
  );

  if (activeGroup?.id === group.id) {
    window.localStorage.setItem(ACTIVE_GROUP_KEY, JSON.stringify(group));
  }

  notifyStoreChange();
}

function createId(prefix) {
  const value =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${value}`;
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
  if (!draft.groupName.trim()) {
    return "모임 이름을 입력해 주세요.";
  }

  const participantNames = getDraftParticipantNames(draft);
  const comparableNames = participantNames.map((name) => name.toLowerCase());

  if (new Set(comparableNames).size !== comparableNames.length) {
    return "참여자 별명은 서로 다르게 입력해 주세요.";
  }

  if (comparableNames.includes(captain.nickname.trim().toLowerCase())) {
    return "목업 총대와 다른 참여자 별명을 입력해 주세요.";
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
  if (!inviteToken || typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}/invite/${encodeURIComponent(inviteToken)}`;
}

async function readInviteResponse(response) {
  let result = {};

  try {
    result = await response.json();
  } catch {
    result = {};
  }

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

function getReceiptSummary(groupId) {
  try {
    const snapshot = window.localStorage.getItem(
      `dutchpay:receipts:${groupId}`,
    );
    const receipts = snapshot ? JSON.parse(snapshot) : [];
    const safeReceipts = Array.isArray(receipts) ? receipts : [];

    return {
      receipts: safeReceipts,
      count: safeReceipts.length,
    };
  } catch {
    return { receipts: [], count: 0 };
  }
}

function formatSavedDate(value) {
  if (!value) {
    return "저장됨";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "저장됨";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function resetPageScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function getDemoData(captain) {
  const captainMember = {
    id: captain.id,
    user_id: captain.user_id,
    nickname: captain.nickname,
    member_type: captain.member_type,
  };
  const activeMembers = [
    captainMember,
    {
      id: "demo-active-member-jihyun",
      user_id: null,
      nickname: "지현",
      member_type: "guest",
    },
    {
      id: "demo-active-member-sumin",
      user_id: null,
      nickname: "수인",
      member_type: "guest",
    },
  ];
  const completedMembers = [
    captainMember,
    {
      id: "demo-completed-member-minjae",
      user_id: null,
      nickname: "민재",
      member_type: "guest",
    },
  ];
  const groups = [
    {
      id: "demo-group-active",
      name: "성수 저녁 모임",
      created_by: captain.user_id,
      mode: "TOGETHER",
      status: "ACTIVE",
      expected_member_count: 3,
      created_at: "2026-09-09T09:00:00.000Z",
      activated_at: "2026-09-09T09:10:00.000Z",
      calculation_version: 1,
      members: activeMembers,
    },
    {
      id: "demo-group-completed",
      name: "주말 카페 정산",
      created_by: captain.user_id,
      mode: "SOLO",
      status: "COMPLETED",
      expected_member_count: 2,
      created_at: "2026-09-07T05:00:00.000Z",
      activated_at: "2026-09-07T05:05:00.000Z",
      completed_at: "2026-09-07T07:00:00.000Z",
      calculation_version: 1,
      members: completedMembers,
    },
  ];
  const activeMemberIds = activeMembers.map((member) => member.id);
  const completedMemberIds = completedMembers.map((member) => member.id);
  const receiptsByGroup = {
    "demo-group-active": [
      {
        id: "demo-receipt-dinner",
        group_id: "demo-group-active",
        title: "저녁 식사",
        store_name: "저녁 식사",
        total_amount: 66000,
        paid_by_member_id: captain.id,
        uploaded_by_member_id: captain.id,
        participant_member_ids: activeMemberIds,
        items: [
          {
            id: "demo-menu-dinner",
            name: "저녁 세트",
            menu_name: "저녁 세트",
            quantity: 3,
            unit_price: 18000,
            amount: 54000,
            line_total: 54000,
            consumer_member_ids: activeMemberIds,
          },
          {
            id: "demo-menu-drink",
            name: "음료",
            menu_name: "음료",
            quantity: 3,
            unit_price: 4000,
            amount: 12000,
            line_total: 12000,
            consumer_member_ids: activeMemberIds,
          },
        ],
        image_key: null,
        input_method: "MANUAL",
        ocr_status: "NONE",
        status: "ACTIVE",
        created_at: "2026-09-09T10:00:00.000Z",
        updated_at: "2026-09-09T10:00:00.000Z",
      },
    ],
    "demo-group-completed": [
      {
        id: "demo-receipt-cafe",
        group_id: "demo-group-completed",
        title: "카페",
        store_name: "카페",
        total_amount: 24000,
        paid_by_member_id: captain.id,
        uploaded_by_member_id: captain.id,
        participant_member_ids: completedMemberIds,
        items: [
          {
            id: "demo-menu-cafe",
            name: "커피와 디저트",
            menu_name: "커피와 디저트",
            quantity: 2,
            unit_price: 12000,
            amount: 24000,
            line_total: 24000,
            consumer_member_ids: completedMemberIds,
          },
        ],
        image_key: null,
        input_method: "MANUAL",
        ocr_status: "NONE",
        status: "ACTIVE",
        created_at: "2026-09-07T06:00:00.000Z",
        updated_at: "2026-09-07T06:00:00.000Z",
      },
    ],
  };

  return { groups, receiptsByGroup };
}

function ensureDemoData(captain) {
  // 운영 DB 전환: 브라우저가 데모 데이터를 넣는 이 함수는 제거한다.
  // 개발용 데이터는 scripts/seed.mjs에서 만들고 npm run seed로 개발 DB에만 넣는다.
  try {
    const { groups: demoGroups, receiptsByGroup } = getDemoData(captain);
    const currentGroups = parseGroups(getGroupsSnapshot());
    const missingGroups = demoGroups.filter(
      (demoGroup) =>
        !currentGroups.some((group) => group.id === demoGroup.id),
    );
    let didChange = false;

    if (missingGroups.length > 0) {
      window.localStorage.setItem(
        GROUPS_KEY,
        JSON.stringify([...missingGroups, ...currentGroups]),
      );
      didChange = true;
    }

    for (const [groupId, receipts] of Object.entries(receiptsByGroup)) {
      const receiptKey = `dutchpay:receipts:${groupId}`;

      if (window.localStorage.getItem(receiptKey) === null) {
        window.localStorage.setItem(receiptKey, JSON.stringify(receipts));
        didChange = true;
      }
    }

    if (didChange) {
      notifyStoreChange();
    }
  } catch {
    // 브라우저 저장소를 사용할 수 없어도 로그인 흐름은 계속 진행한다.
  }
}


export {
  EMPTY_DRAFT,
  MAX_TOGETHER_MEMBERS,
  MIN_TOGETHER_MEMBERS,
  MODES,
  createId,
  ensureDemoData,
  formatSavedDate,
  formatWon,
  getDraftParticipantNames,
  getDraftSnapshot,
  getGroupsSnapshot,
  getInviteUrl,
  getReceiptSummary,
  getServerDraftSnapshot,
  getServerGroupsSnapshot,
  getSetupError,
  normalizeNames,
  parseDraft,
  parseGroups,
  readInviteResponse,
  replaceDraft,
  replaceGroup,
  saveDraft,
  saveGroup,
  saveInviteParticipants,
  subscribeToDemoStore,
};
