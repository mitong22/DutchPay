import {
  TEST_ACCOUNT_EMAIL,
  TEST_LOGIN_ID,
  TEST_LOGIN_PASSWORD,
} from "../lib/testAccount.mjs";

const USER_CREATED_AT = "2026-08-01T00:00:00.000Z";

const USER_SPECS = {
  yunha: {
    id: "mock-user-001",
    name: "윤하",
    email: TEST_ACCOUNT_EMAIL,
    username: TEST_LOGIN_ID,
  },
  jihyun: {
    id: "seed-user-jihyun",
    name: "지현",
    email: "jihyun@dutchpay.local",
    username: "test-jihyun",
  },
  sumin: {
    id: "seed-user-sumin",
    name: "수인",
    email: "sumin@dutchpay.local",
    username: "test-sumin",
  },
  minjae: {
    id: "seed-user-minjae",
    name: "민재",
    email: "minjae@dutchpay.local",
    username: "test-minjae",
  },
  seoyeon: {
    id: "seed-user-seoyeon",
    name: "서연",
    email: "seoyeon@dutchpay.local",
    username: "test-seoyeon",
  },
};

function registered(userKey) {
  return { key: userKey, userKey };
}

function guest(key, nickname) {
  return { key, nickname };
}

const DATASETS = {
  demo: {
    label: "서비스 데모",
    groups: [
      {
        key: "seongsu-food-tour",
        name: "성수 맛집 투어",
        createdAt: "2026-09-10T09:00:00.000Z",
        members: [
          registered("yunha"),
          guest("jihyun", "지현"),
          guest("sumin", "수인"),
          guest("daeun", "다은"),
        ],
        receipts: [
          {
            key: "dinner",
            storeName: "난포 성수",
            paidBy: "yunha",
            createdAt: "2026-09-10T10:30:00.000Z",
            items: [
              {
                key: "ssambap",
                name: "강된장 쌈밥",
                quantity: 2,
                unitPrice: 13000,
                consumers: ["yunha", "jihyun", "sumin", "daeun"],
              },
              {
                key: "noodle",
                name: "제철회국수",
                quantity: 2,
                unitPrice: 15000,
                consumers: ["yunha", "jihyun", "sumin", "daeun"],
              },
              {
                key: "yukhoe",
                name: "한우 육회",
                quantity: 1,
                unitPrice: 22000,
                consumers: ["yunha", "jihyun", "sumin"],
              },
            ],
          },
          {
            key: "cafe",
            storeName: "카페 어니언 성수",
            paidBy: "jihyun",
            createdAt: "2026-09-10T12:00:00.000Z",
            items: [
              {
                key: "americano",
                name: "아이스 아메리카노",
                quantity: 3,
                unitPrice: 5000,
                consumers: ["yunha", "jihyun", "sumin"],
              },
              {
                key: "pastry",
                name: "딸기 페이스트리",
                quantity: 2,
                unitPrice: 8500,
                consumers: ["yunha", "daeun"],
              },
            ],
          },
          {
            key: "taxi",
            storeName: "서울숲에서 집까지",
            paidBy: "sumin",
            createdAt: "2026-09-10T13:10:00.000Z",
            items: [
              {
                key: "fare",
                name: "택시비",
                quantity: 1,
                unitPrice: 23800,
                consumers: ["yunha", "sumin"],
              },
            ],
          },
        ],
      },
      {
        key: "weekend-brunch",
        name: "주말 브런치 정산",
        mode: "SOLO",
        createdAt: "2026-09-09T02:00:00.000Z",
        members: [registered("yunha"), guest("jiwoo", "지우")],
        receipts: [
          {
            key: "brunch",
            storeName: "리틀넥 한남",
            paidBy: "yunha",
            createdAt: "2026-09-09T03:10:00.000Z",
            items: [
              {
                key: "salmon",
                name: "살몬 포케",
                quantity: 1,
                unitPrice: 15900,
                consumers: ["yunha"],
              },
              {
                key: "steak",
                name: "하우스 스테이크",
                quantity: 1,
                unitPrice: 23900,
                consumers: ["jiwoo"],
              },
              {
                key: "ade",
                name: "청포도 에이드",
                quantity: 2,
                unitPrice: 6500,
                consumers: ["yunha", "jiwoo"],
              },
            ],
          },
        ],
      },
      {
        key: "jeju-friends-trip",
        name: "제주도 우정 여행",
        createdAt: "2026-09-06T01:00:00.000Z",
        members: [
          registered("yunha"),
          guest("jihyun", "지현"),
          guest("minjae", "민재"),
          guest("seoyeon", "서연"),
        ],
        receipts: [
          {
            key: "rent-car",
            storeName: "제주 렌터카",
            paidBy: "minjae",
            createdAt: "2026-09-06T02:00:00.000Z",
            items: [
              {
                key: "rent",
                name: "렌터카 3일",
                quantity: 1,
                unitPrice: 186000,
                consumers: ["yunha", "jihyun", "minjae", "seoyeon"],
              },
            ],
          },
          {
            key: "black-pork",
            storeName: "숙성도 중문점",
            paidBy: "yunha",
            createdAt: "2026-09-06T10:40:00.000Z",
            items: [
              {
                key: "pork",
                name: "숙성 흑돼지",
                quantity: 4,
                unitPrice: 22000,
                consumers: ["yunha", "jihyun", "minjae", "seoyeon"],
              },
              {
                key: "hallasan",
                name: "한라산",
                quantity: 2,
                unitPrice: 6000,
                consumers: ["yunha", "jihyun", "minjae"],
              },
            ],
          },
          {
            key: "jeju-cafe",
            storeName: "노티드 제주",
            paidBy: "seoyeon",
            createdAt: "2026-09-07T05:20:00.000Z",
            items: [
              {
                key: "drinks",
                name: "시그니처 음료",
                quantity: 4,
                unitPrice: 6500,
                consumers: ["yunha", "jihyun", "minjae", "seoyeon"],
              },
              {
                key: "donuts",
                name: "도넛 박스",
                quantity: 1,
                unitPrice: 18000,
                consumers: ["yunha", "jihyun", "minjae", "seoyeon"],
              },
            ],
          },
        ],
      },
      {
        key: "hangang-picnic",
        name: "망원 한강 피크닉",
        createdAt: "2026-08-30T07:00:00.000Z",
        completedAt: "2026-08-31T01:00:00.000Z",
        members: [
          registered("yunha"),
          guest("jihyun", "지현"),
          guest("sumin", "수인"),
        ],
        receipts: [
          {
            key: "market",
            storeName: "망원시장 장보기",
            paidBy: "yunha",
            createdAt: "2026-08-30T08:00:00.000Z",
            items: [
              {
                key: "gimbap",
                name: "참치김밥",
                quantity: 4,
                unitPrice: 4500,
                consumers: ["yunha", "jihyun", "sumin"],
              },
              {
                key: "chicken",
                name: "시장 통닭",
                quantity: 2,
                unitPrice: 21000,
                consumers: ["yunha", "jihyun", "sumin"],
              },
              {
                key: "drinks",
                name: "음료와 얼음",
                quantity: 1,
                unitPrice: 15000,
                consumers: ["yunha", "jihyun", "sumin"],
              },
            ],
          },
        ],
      },
    ],
  },
  test: {
    label: "정산 검증",
    groups: [
      {
        key: "empty",
        name: "[검증] 영수증 없는 모임",
        createdAt: "2026-08-20T01:00:00.000Z",
        members: [registered("yunha"), guest("jihyun", "지현")],
        receipts: [],
      },
      {
        key: "equal-three",
        name: "[검증] 3인 균등 분할",
        createdAt: "2026-08-19T01:00:00.000Z",
        members: [
          registered("yunha"),
          guest("jihyun", "지현"),
          guest("sumin", "수인"),
        ],
        receipts: [
          {
            key: "equal",
            storeName: "30,000원 ÷ 3명",
            paidBy: "yunha",
            items: [
              {
                key: "shared",
                name: "공통 메뉴",
                quantity: 1,
                unitPrice: 30000,
                consumers: ["yunha", "jihyun", "sumin"],
              },
            ],
          },
        ],
      },
      {
        key: "remainder-three",
        name: "[검증] 1원 나머지 분할",
        createdAt: "2026-08-18T01:00:00.000Z",
        members: [
          registered("yunha"),
          guest("jihyun", "지현"),
          guest("sumin", "수인"),
        ],
        receipts: [
          {
            key: "remainder",
            storeName: "10,000원 ÷ 3명",
            paidBy: "yunha",
            items: [
              {
                key: "shared",
                name: "나머지 발생 메뉴",
                quantity: 1,
                unitPrice: 10000,
                consumers: ["yunha", "jihyun", "sumin"],
              },
            ],
          },
        ],
      },
      {
        key: "different-consumers",
        name: "[검증] 항목별 참여자 다름",
        createdAt: "2026-08-17T01:00:00.000Z",
        members: [
          registered("yunha"),
          guest("jihyun", "지현"),
          guest("sumin", "수인"),
          guest("minjae", "민재"),
        ],
        receipts: [
          {
            key: "different",
            storeName: "항목별 소비자 검증",
            paidBy: "yunha",
            items: [
              {
                key: "meal",
                name: "공통 식사",
                quantity: 1,
                unitPrice: 40000,
                consumers: ["yunha", "jihyun", "sumin", "minjae"],
              },
              {
                key: "beer",
                name: "윤하·지현만 주문",
                quantity: 2,
                unitPrice: 5000,
                consumers: ["yunha", "jihyun"],
              },
              {
                key: "dessert",
                name: "수인만 주문",
                quantity: 1,
                unitPrice: 7000,
                consumers: ["sumin"],
              },
            ],
          },
        ],
      },
      {
        key: "multiple-payers",
        name: "[검증] 여러 결제자 상계",
        createdAt: "2026-08-16T01:00:00.000Z",
        members: [
          registered("yunha"),
          guest("jihyun", "지현"),
          guest("sumin", "수인"),
        ],
        receipts: [
          {
            key: "first",
            storeName: "윤하 결제",
            paidBy: "yunha",
            items: [
              {
                key: "meal",
                name: "저녁 식사",
                quantity: 1,
                unitPrice: 51000,
                consumers: ["yunha", "jihyun", "sumin"],
              },
            ],
          },
          {
            key: "second",
            storeName: "지현 결제",
            paidBy: "jihyun",
            items: [
              {
                key: "cafe",
                name: "카페",
                quantity: 1,
                unitPrice: 24000,
                consumers: ["yunha", "jihyun", "sumin"],
              },
            ],
          },
          {
            key: "third",
            storeName: "수인 결제",
            paidBy: "sumin",
            items: [
              {
                key: "taxi",
                name: "택시",
                quantity: 1,
                unitPrice: 18000,
                consumers: ["yunha", "sumin"],
              },
            ],
          },
        ],
      },
      {
        key: "registered-and-guests",
        name: "[검증] 회원·게스트 혼합",
        createdAt: "2026-08-15T01:00:00.000Z",
        members: [
          registered("yunha"),
          registered("jihyun"),
          guest("hyunwoo", "현우"),
          guest("daeun", "다은"),
        ],
        receipts: [
          {
            key: "mixed",
            storeName: "회원과 게스트 4명",
            paidBy: "jihyun",
            items: [
              {
                key: "meal",
                name: "함께 먹은 메뉴",
                quantity: 1,
                unitPrice: 64000,
                consumers: ["yunha", "jihyun", "hyunwoo", "daeun"],
              },
            ],
          },
        ],
      },
      {
        key: "partially-paid",
        name: "[검증] 일부 송금 완료",
        createdAt: "2026-08-14T01:00:00.000Z",
        members: [
          registered("yunha"),
          guest("jihyun", "지현"),
          guest("sumin", "수인"),
          guest("minjae", "민재"),
        ],
        receipts: [
          {
            key: "partial",
            storeName: "지현만 송금 완료",
            paidBy: "yunha",
            paidConsumers: ["jihyun"],
            items: [
              {
                key: "meal",
                name: "4인 식사",
                quantity: 1,
                unitPrice: 80000,
                consumers: ["yunha", "jihyun", "sumin", "minjae"],
              },
            ],
          },
        ],
      },
      {
        key: "completed",
        name: "[검증] 전체 정산 완료",
        createdAt: "2026-08-13T01:00:00.000Z",
        completedAt: "2026-08-13T08:00:00.000Z",
        members: [
          registered("yunha"),
          guest("jihyun", "지현"),
          guest("sumin", "수인"),
        ],
        receipts: [
          {
            key: "completed",
            storeName: "모든 송금 완료",
            paidBy: "yunha",
            items: [
              {
                key: "meal",
                name: "완료된 식사",
                quantity: 1,
                unitPrice: 45000,
                consumers: ["yunha", "jihyun", "sumin"],
              },
            ],
          },
        ],
      },
      {
        key: "other-captain",
        name: "[검증] 다른 총대의 모임",
        createdBy: "jihyun",
        createdAt: "2026-08-12T01:00:00.000Z",
        members: [
          registered("jihyun"),
          registered("yunha"),
          registered("sumin"),
        ],
        receipts: [
          {
            key: "other",
            storeName: "지현 총대 결제",
            paidBy: "jihyun",
            items: [
              {
                key: "meal",
                name: "회원 3인 식사",
                quantity: 1,
                unitPrice: 36000,
                consumers: ["jihyun", "yunha", "sumin"],
              },
            ],
          },
        ],
      },
      {
        key: "solo-one-person",
        name: "[검증] 1인 SOLO 정산",
        mode: "SOLO",
        createdAt: "2026-08-11T01:00:00.000Z",
        members: [registered("yunha")],
        receipts: [
          {
            key: "solo",
            storeName: "혼자 결제하고 혼자 부담",
            paidBy: "yunha",
            items: [
              {
                key: "meal",
                name: "1인 식사",
                quantity: 1,
                unitPrice: 12900,
                consumers: ["yunha"],
              },
            ],
          },
        ],
      },
    ],
  },
};

function asDate(value, label) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} 날짜가 올바르지 않습니다.`);
  }

  return date;
}

function requireUnique(values, label) {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} 값이 중복되었습니다.`);
  }
}

export function buildSeedDocuments(datasetName, passwordHash) {
  const dataset = DATASETS[datasetName];

  if (!dataset) {
    throw new Error(`지원하지 않는 seed 종류입니다: ${datasetName}`);
  }

  const prefix = `seed-${datasetName}`;
  const userCreatedAt = asDate(USER_CREATED_AT, "사용자 생성일");
  const users = Object.values(USER_SPECS).map((user) => ({
    _id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    emailVerified: true,
    createdAt: userCreatedAt,
    updatedAt: userCreatedAt,
  }));
  const accounts = Object.entries(USER_SPECS).map(([key, user]) => ({
    _id: `seed-account-${key}`,
    accountId: user.id,
    providerId: "credential",
    userId: user.id,
    password: passwordHash,
    createdAt: userCreatedAt,
    updatedAt: userCreatedAt,
  }));
  const groups = [];
  const members = [];
  const receipts = [];
  const payments = [];

  for (const scenario of dataset.groups) {
    const creatorKey = scenario.createdBy ?? "yunha";
    const creator = USER_SPECS[creatorKey];
    const groupId = `${prefix}-group-${scenario.key}`;
    const createdAt = asDate(scenario.createdAt, `${scenario.name} 생성일`);
    const memberKeys = scenario.members.map((member) => member.key);
    const mode = scenario.mode ?? "TOGETHER";

    requireUnique(memberKeys, `${scenario.name} 멤버 키`);

    if (!["SOLO", "TOGETHER"].includes(mode)) {
      throw new Error(`${scenario.name} 정산 방식이 올바르지 않습니다.`);
    }

    if (!creator || !scenario.members.some((member) => member.userKey === creatorKey)) {
      throw new Error(`${scenario.name} 총대가 회원 멤버에 없습니다.`);
    }

    const memberIdByKey = new Map();

    for (const member of scenario.members) {
      const user = member.userKey ? USER_SPECS[member.userKey] : null;

      if (member.userKey && !user) {
        throw new Error(`${scenario.name}에 알 수 없는 회원이 있습니다.`);
      }

      const memberId = `${prefix}-member-${scenario.key}-${member.key}`;
      memberIdByKey.set(member.key, memberId);
      members.push({
        _id: memberId,
        group_id: groupId,
        user_id: user?.id ?? null,
        nickname: user?.name ?? member.nickname,
        member_type: user ? "registered" : "guest",
      });
    }

    const completedAt = scenario.completedAt
      ? asDate(scenario.completedAt, `${scenario.name} 완료일`)
      : null;

    groups.push({
      _id: groupId,
      name: scenario.name,
      created_by: creator.id,
      mode,
      status: "ACTIVE",
      expected_member_count: scenario.members.length,
      activated_at: new Date(createdAt.getTime() + 5 * 60 * 1000),
      settlement_completed_at: completedAt,
      member_ids: memberKeys.map((key) => memberIdByKey.get(key)),
      created_at: createdAt,
    });

    const receiptKeys = scenario.receipts.map((receipt) => receipt.key);
    requireUnique(receiptKeys, `${scenario.name} 영수증 키`);

    for (const receipt of scenario.receipts) {
      const paidByMemberId = memberIdByKey.get(receipt.paidBy);

      if (!paidByMemberId) {
        throw new Error(`${scenario.name} 영수증 결제자가 멤버가 아닙니다.`);
      }

      const receiptId = `${prefix}-receipt-${scenario.key}-${receipt.key}`;
      const receiptCreatedAt = asDate(
        receipt.createdAt ?? scenario.createdAt,
        `${scenario.name} 영수증 생성일`,
      );
      const paidConsumers = new Set(receipt.paidConsumers ?? []);
      const itemKeys = receipt.items.map((item) => item.key);
      const receiptItems = [];

      requireUnique(itemKeys, `${scenario.name} 항목 키`);

      if (receipt.items.length === 0) {
        throw new Error(`${scenario.name} 영수증에 항목이 없습니다.`);
      }

      for (const paidConsumer of paidConsumers) {
        if (!memberIdByKey.has(paidConsumer)) {
          throw new Error(`${scenario.name}에 알 수 없는 송금 완료 멤버가 있습니다.`);
        }
      }

      for (const item of receipt.items) {
        if (
          !Array.isArray(item.consumers) ||
          item.consumers.length === 0 ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1 ||
          !Number.isSafeInteger(item.unitPrice) ||
          item.unitPrice < 1
        ) {
          throw new Error(`${scenario.name} 항목 데이터가 올바르지 않습니다.`);
        }

        requireUnique(item.consumers, `${scenario.name} 소비자`);

        const consumerMemberIds = item.consumers.map((consumerKey) => {
          const memberId = memberIdByKey.get(consumerKey);

          if (!memberId) {
            throw new Error(`${scenario.name} 항목 소비자가 멤버가 아닙니다.`);
          }

          return memberId;
        });
        const itemId = `${prefix}-item-${scenario.key}-${receipt.key}-${item.key}`;
        const lineTotal = item.quantity * item.unitPrice;

        if (!Number.isSafeInteger(lineTotal)) {
          throw new Error(`${scenario.name} 항목 금액이 안전한 정수 범위를 벗어났습니다.`);
        }

        receiptItems.push({
          _id: itemId,
          menu_name: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: lineTotal,
          consumer_member_ids: consumerMemberIds,
        });

        item.consumers.forEach((consumerKey, index) => {
          const payerMemberId = consumerMemberIds[index];
          payments.push({
            _id: `${prefix}-payment-${scenario.key}-${receipt.key}-${item.key}-${consumerKey}`,
            group_id: groupId,
            receipt_id: receiptId,
            expense_item_id: itemId,
            payer_member_id: payerMemberId,
            payee_member_id: paidByMemberId,
            status:
              completedAt ||
              payerMemberId === paidByMemberId ||
              paidConsumers.has(consumerKey)
                ? "paid"
                : "unpaid",
            created_at: receiptCreatedAt,
          });
        });
      }

      receipts.push({
        _id: receiptId,
        group_id: groupId,
        store_name: receipt.storeName,
        total_amount: receiptItems.reduce(
          (total, item) => total + item.line_total,
          0,
        ),
        paid_by_member_id: paidByMemberId,
        uploaded_by_member_id: paidByMemberId,
        participant_member_ids: [
          ...new Set(
            receiptItems.flatMap((item) => item.consumer_member_ids),
          ),
        ],
        items: receiptItems,
        input_method: "MANUAL",
        ocr_status: "NONE",
        status: "ACTIVE",
        created_at: receiptCreatedAt,
        updated_at: receiptCreatedAt,
      });
    }
  }

  for (const [collectionName, documents] of Object.entries({
    users,
    accounts,
    groups,
    members,
    receipts,
    payments,
  })) {
    requireUnique(
      documents.map((document) => document._id),
      `${collectionName} ID`,
    );
  }

  return {
    dataset: datasetName,
    label: dataset.label,
    login: { id: TEST_LOGIN_ID, password: TEST_LOGIN_PASSWORD },
    users,
    accounts,
    groups,
    members,
    receipts,
    payments,
  };
}
