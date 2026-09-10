# 이 프로젝트는

친구, 동료 등 여러 사람이 함께 사용한 비용을 실제 이용 내역에 맞게 세부적으로 나누어 정산할 수 있는 **더치페이 / N빵 서비스**이다.

이 서비스는 단순히 전체 금액을 전체 인원수로 나누는 방식이 아니다.

모임 안에는 여러 개의 영수증이 존재할 수 있고, 각 영수증마다 결제자가 다를 수 있으며, 하나의 영수증 안에서도 메뉴마다 실제 비용을 부담해야 하는 사람이 다를 수 있다.

따라서 정산 구조는 다음과 같이 세분화한다.

```text
모임
 └─ 영수증
      └─ 메뉴
           └─ 메뉴별 참여자
```

예를 들어 전체 모임 인원이 다음과 같다고 가정한다.

- 미연
- 지현
- 수인
- 철수

모든 사람이 모든 일정에 참여했다고 가정하지 않는다.

먼저 집에 간 사람이나 늦게 합류한 사람이 있을 수 있기 때문에 영수증마다 참여자를 다르게 지정할 수 있어야 한다.

예:

```text
밥
→ 미연 / 지현 / 수인 / 철수

술
→ 미연 / 지현 / 수인

카페
→ 미연 / 수인
```

또한 하나의 영수증 안에서도 메뉴마다 실제로 먹거나 사용한 사람이 다를 수 있다.

예:

```text
[술집]
결제자: 지현

삼겹살 60,000원
→ 미연 / 지현 / 수인

소주 20,000원
→ 지현 / 수인

콜라 3,000원
→ 미연
```

이 경우 술집 전체 금액인 83,000원을 단순히 3명으로 나누지 않는다.

```text
삼겹살
60,000 / 3 = 20,000원씩

소주
20,000 / 2 = 10,000원씩

콜라
3,000 / 1 = 3,000원
```

각 메뉴별 참여자를 기준으로 비용을 계산한 뒤 개인별 부담 금액을 합산한다.

서비스는 두 가지 모드를 제공한다.

- `SOLO` : 혼자하기
- `TOGETHER` : 함께하기

기술 스택은 다음과 같다.

- Next.js
- React
- MongoDB
- Better Auth


## 서비스 개괄 설명은

### 1. 전체 서비스 흐름

모임 생성은 다음 3단계로 진행한다.

```text
STEP 1
모임 방식 선택

↓

STEP 2
참여자 설정

↓

STEP 3
모임 확인 및 시작
```


### 2. 혼자하기

혼자하기는 한 사람이 모든 비용을 먼저 결제하고 이후 다른 사람들에게 비용을 나누어 받는 방식이다.

예:

```text
밥   80,000원 → 미연 결제
술   60,000원 → 미연 결제
카페 30,000원 → 미연 결제
```

혼자하기에서는 모임 생성자 한 명만 실제 서비스를 사용한다.

다른 참여자는 회원가입하거나 로그인할 필요가 없다.

모임 생성자가 직접 참여자를 추가하고 별명을 입력한다.

예:

```text
미연
지현
수인
철수
```

이 참여자들은 Better Auth의 `user`가 아니라 해당 모임 안에서만 사용하는 `group_member` 데이터로 관리한다.

혼자하기에서는 모임 생성자가 모든 영수증을 등록하고 관리한다.

`SOLO` 모임은 초대나 대기 과정 없이 생성과 동시에 `status: "ACTIVE"`로 저장한다.

`expected_member_count`에는 총대를 포함하여 생성된 전체 `group_member` 수를 저장하고, `activated_at`에는 생성 시각을 기록한다.

모든 영수증의 실제 결제자인 `paid_by_member_id`는 반드시 총대와 연결된 `group_member._id`여야 하며 서버에서 이를 검증한다.


### 3. 함께하기

함께하기는 여러 사람이 서로 다른 비용을 결제하고 마지막에 함께 정산하는 방식이다.

예:

```text
밥   80,000원 → 미연 결제
술   60,000원 → 지현 결제
카페 30,000원 → 수인 결제
```

모임장이 먼저 모임을 생성한다.

이후 카카오톡을 이용해 다른 참여자들에게 초대 링크를 전달한다.

초대받은 참여자는 별도의 Better Auth 로그인 없이 초대 링크를 통해 모임에 참여한다.

함께하기에서는 각 참여자가 자신이 결제한 영수증을 직접 등록할 수 있다.

예:

```text
미연 → 밥 영수증 등록
지현 → 술 영수증 등록
수인 → 카페 영수증 등록
```

함께하기 모임은 모임 생성 시 설정한 참여 예정 인원이 모두 참여하기 전까지 실제 모임 화면을 열지 않는다.

예:

```text
참여 예정 인원: 4명

미연 ✓
지현 ✓
수인 ✓
철수 대기 중

3 / 4명 참여 완료
```

이 상태에서는 아직 모임을 사용할 수 없다.

모든 참여자가 들어오면 다음과 같이 모임이 활성화된다.

```text
4 / 4명 참여 완료

WAITING
↓
ACTIVE
```

`ACTIVE` 상태가 된 이후부터 영수증 등록 및 정산 기능을 사용할 수 있다.

`TOGETHER` 모임은 생성할 때 `status: "WAITING"`과 총대를 포함한 `expected_member_count`를 저장한다.

현재 참여 인원은 별도 숫자 필드로 중복 저장하지 않고 `group_member.group_id`를 기준으로 계산한다.

계산된 참여 인원이 `expected_member_count`와 같아지는 순간 `status`를 `ACTIVE`로 바꾸고 `activated_at`을 기록한다.


### 4. 영수증별 참여자

모임의 모든 사람이 모든 일정에 참여한다고 가정하지 않는다.

따라서 각각의 영수증마다 해당 영수증에 실제로 참여한 멤버를 별도로 지정할 수 있어야 한다.

예:

```text
[밥]
미연 / 지현 / 수인 / 철수

[술]
미연 / 지현 / 수인

[카페]
미연 / 수인
```

먼저 귀가했거나 늦게 합류한 사람을 영수증 단위에서 제외할 수 있어야 한다.


### 5. 메뉴별 참여자

영수증 참여자 안에서도 메뉴마다 실제 비용을 부담해야 하는 사람이 다를 수 있다.

따라서 각각의 메뉴마다 참여자를 별도로 지정한다.

예:

```text
[1차 고깃집]

결제자
지현

영수증 참여자
미연 / 지현 / 수인


삼겹살
수량 2개
개당 30,000원

먹은 사람
미연 / 지현 / 수인


소주
수량 4개
개당 5,000원

먹은 사람
지현 / 수인


콜라
수량 1개
개당 3,000원

먹은 사람
미연
```

메뉴별 참여자는 해당 영수증 참여자 중에서만 선택할 수 있어야 한다.


### 6. 영수증 등록

영수증 등록 방법은 다음 세 가지이다.

1. 직접 입력
2. 촬영하기
3. 사진 첨부

직접 입력에서는 다음 정보를 등록한다.

- 영수증 소제목
- 실제 결제자
- 영수증 참여자
- 메뉴 목록

각 메뉴에는 다음 정보가 존재한다.

- 메뉴명
- 수량
- 개당 금액
- 메뉴별 참여자

메뉴는 여러 개 추가하거나 삭제할 수 있다.


### 7. 영수증 촬영 및 사진 첨부

영수증을 직접 촬영하거나 기존 사진을 첨부할 수 있다.

현재 목업 구현에서는 OCR 또는 이미지 분석을 사용하지 않는다.

촬영하기 또는 사진 첨부 버튼을 누르면 기기의 사진 선택 화면까지만 연다.

선택한 사진을 읽거나 미리보기·저장하는 로직은 두지 않으며, 이후 OCR 기능 구현 단계에서 연결한다.

처리 흐름은 다음과 같다.

```text
영수증 촬영 또는 사진 첨부
↓
기기의 카메라 또는 사진 선택 화면 열기
↓
이후 처리 없음 (OCR 구현 단계에서 연결)
```


### 8. 정산 계산

정산은 메뉴 단위부터 계산한다.

기본 계산식은 다음과 같다.

```text
메뉴 금액 / 메뉴 참여자 수
```

원 단위로 정확히 나누어지지 않는 경우에는 정수 몫을 먼저 모두에게 배분하고, 남은 금액을 `consumer_member_ids[]`의 저장 순서대로 1원씩 추가 배분한다.

예:

```text
10,000원 / 3명

첫 번째 멤버  3,334원
두 번째 멤버  3,333원
세 번째 멤버  3,333원
```

각 메뉴의 분담액 합계는 반드시 원래 메뉴 금액과 같아야 한다.

각 사람이 참여한 모든 메뉴의 부담 금액을 합산하여 해당 사람의 실제 부담 금액을 계산한다.

이후 각 참여자별로 다음 값을 계산한다.

```text
실제 결제한 총 금액
실제로 부담해야 하는 총 금액
```

최종 잔액은 다음과 같이 계산한다.

```text
최종 잔액
= 실제 결제 금액 - 실제 부담 금액
```

결과는 다음과 같이 해석한다.

```text
잔액 > 0
→ 받을 돈이 있음

잔액 < 0
→ 보내야 할 돈이 있음

잔액 = 0
→ 추가 정산 필요 없음
```


### 9. 최종 정산

영수증마다 개별적으로 송금하도록 하지 않는다.

모임 안의 모든 영수증과 메뉴를 계산한 뒤 참여자별 최종 채권과 채무를 계산한다.

계산 순서는 다음과 같다.

```text
1. 메뉴별 개인 부담 금액 계산
2. 참여자별 실제 결제 금액 합산
3. 참여자별 실제 부담 금액 합산
4. 최종 잔액 계산
5. 채무자와 채권자 분리
6. 결정적인 greedy 방식으로 순서대로 매칭
7. 최종 송금 관계 생성
```

DB의 반환 순서에 의존하지 않도록 채무자와 채권자는 각각 `group_member._id` 오름차순으로 정렬한 뒤 매칭한다.

예:

```text
A → B 10,000원
B → C 10,000원
```

B의 최종 잔액이 0이라면 다음과 같이 상계한다.

```text
A → C 10,000원
```

영수증 결제자의 자기 부담분은 잔액 계산에만 반영한다.

```text
from_member_id === to_member_id
```

인 자기 송금 문서는 생성하지 않는다.

최종 화면에 필요한 송금 관계만 `settlement_transfer`에 저장한다.

각 문서에는 확정된 `amount`와 계산 당시의 `calculation_version`을 함께 저장하여, 이후 영수증이 바뀌어도 과거 완료 기록의 금액 의미가 달라지지 않게 한다.


## 로그인 데이터는

### 1. 총대

모임 생성자인 **총대만 Better Auth를 사용하여 로그인한다.**

현재 프로젝트에서는 MongoDB `user` 컬렉션에 존재하는 테스트 계정을 사용하여 로그인한다.

Better Auth가 사용하는 인증 관련 데이터는 다음과 같다.

```text
user
account
session
```

총대의 기본 흐름은 다음과 같다.

```text
Better Auth 로그인
↓
user 확인
↓
모임 생성
↓
group_member 연결
```

총대는 실제 Better Auth 사용자이면서 동시에 해당 모임의 `group_member`가 된다.


### 2. 혼자하기 참여자

혼자하기에서 총대가 직접 추가한 사람들은 Better Auth 사용자가 아니다.

해당 모임에서만 사용하는 `group_member`로 관리한다.

예:

```text
group_member

nickname: 지현
user_id: null
member_type: guest
```

다른 참여자들은 서비스에 직접 접속하지 않는다.


### 3. 함께하기 참여자

함께하기에서 카카오톡으로 초대받은 참여자도 Better Auth 로그인이나 회원가입을 하지 않는다.

카카오톡은 초대 링크를 전달하는 수단으로만 사용한다.

총대가 아닌 참여 자리마다 고유한 Invite Token을 하나씩 만든다.

초대 생성 시 `invite.member_id`는 `null`이고 `status`는 `"PENDING"`이다.

최초 참여 흐름은 다음과 같다.

```text
총대 Better Auth 로그인
↓
TOGETHER 모임 생성
↓
참여 예정 인원 설정
↓
참여 자리별 Invite Token 생성
↓
카카오톡으로 초대 링크 전달
↓
초대받은 사용자가 링크 접속
↓
서버에서 Invite Token 검증
↓
PENDING Invite 조건부 선점
↓
group_member 생성
↓
invite.member_id 연결
↓
invite.status = CLAIMED
↓
Guest Session Token 생성
↓
Guest Session 정보를 MongoDB에 저장
↓
Guest Session Token을 HttpOnly Cookie로 전달
↓
이후 요청마다 Guest Session 검증
↓
현재 group_id / member_id 확인
```

마지막 참여 자리에 여러 요청이 동시에 접근해도 인원을 초과하지 않도록 다음 작업은 MongoDB 트랜잭션 하나에서 처리한다.

- `status: "PENDING"`인 Invite의 조건부 선점
- 현재 `group_member` 수와 `expected_member_count` 확인
- `group_member` 생성
- `invite.member_id` 연결과 `status: "CLAIMED"` 변경
- 마지막 참여자라면 `expense_group.status`를 `ACTIVE`로 변경

조건을 만족하지 못한 동시 요청은 실패 처리하며 새 멤버를 만들지 않는다.

Cookie 삭제 후 같은 초대 링크로 재접속했을 때는 `invite.member_id`로 기존 `group_member`를 확인하고 새로운 Guest Session만 발급한다.


### 4. Invite Token

Invite Token은 해당 사용자가 특정 모임에 들어올 수 있는 자격이 있는지를 확인하기 위한 값이다.

초대 URL은 다음과 같은 형태로 구성한다.

```text
/invite/{inviteToken}
```

서버에서는 Invite Token으로 최소한 다음 내용을 검증한다.

- 실제 존재하는 초대인지
- 어떤 모임의 초대인지
- 만료된 초대인지
- 취소된 초대인지
- 이미 연결된 멤버가 있는지

Invite Token은 충분히 긴 암호학적 난수로 생성한다.

Token 원문은 URL을 통해 사용자에게 한 번 전달하고, DB에는 SHA-256 등의 해시값만 저장한다.

데이터 구조는 다음과 같다.

```text
invite

_id
group_id
member_id
token_hash
status
expires_at
claimed_at
created_at
```

`status`는 다음 값만 사용한다.

```text
PENDING
CLAIMED
REVOKED
```

만료 여부는 별도 상태값을 만들지 않고 `expires_at`으로 판단한다.

`CLAIMED` Invite는 `member_id`에 연결된 기존 참여자의 Guest Session 재발급 기준으로 사용할 수 있다.


### 5. Guest Session

Invite Token 검증이 완료되면 초대 참여자의 Guest Session을 생성한다.

Guest Session은 Better Auth의 `session`과 별도로 관리한다.

데이터 구조는 다음과 같다.

```text
guest_session

_id
group_id
member_id
token_hash
expires_at
created_at
last_accessed_at
```

Guest Session Token은 충분히 긴 암호학적 난수로 생성한다.

브라우저에는 Token 원문을 HttpOnly Cookie로 전달하고, DB에는 SHA-256 등의 해시값만 저장한다.

`expires_at`에는 TTL 인덱스를 적용하여 만료된 세션이 계속 누적되지 않게 한다.

Cookie 안에 다음 정보를 직접 저장해서 신뢰하지 않는다.

```text
group_id
member_id
nickname
권한
```

실제 정보는 서버의 Guest Session과 `group_member` 데이터를 기준으로 판단한다.


### 6. Cookie

Guest Session Token은 **HttpOnly Cookie**에 저장한다.

다음 보안 옵션을 사용한다.

```text
HttpOnly
Secure
SameSite
```

Cookie의 역할은 사용자의 개인정보를 저장하는 것이 아니다.

Cookie에는 Guest Session Token만 저장한다.

처리 방식은 다음과 같다.

```text
브라우저 Cookie
↓
Guest Session Token
↓
Next.js 서버
↓
Token 검증
↓
MongoDB guest_session 조회
↓
group_id / member_id 확인
↓
해당 모임 접근 허용
```


### 7. Cookie가 삭제된 경우

사용자가 Cookie를 삭제하면 해당 브라우저에서는 Guest Session을 더 이상 확인할 수 없다.

이 경우 사용자는 카카오톡으로 전달받은 기존 초대 링크를 다시 이용한다.

```text
카카오톡 초대 링크 재접속
↓
Invite Token 검증
↓
기존 group_member 확인
↓
새 Guest Session 생성
↓
새 HttpOnly Cookie 발급
↓
모임 재입장
```

따라서 두 Token의 역할을 다음과 같이 분리한다.

```text
Invite Token
= 해당 모임에 들어올 자격을 확인하기 위한 값

Guest Session Token
= 초대 검증이 끝난 사용자의 이후 요청을 식별하기 위한 값
```


### 8. 최종 인증 구조

총대는 다음과 같다.

```text
총대
↓
Better Auth
↓
user
↓
group_member
```

초대 참여자는 다음과 같다.

```text
초대 참여자
↓
Invite Token
↓
Guest Session
↓
HttpOnly Cookie
↓
group_member
```

정산 기능 내부에서는 로그인 방식에 관계없이 최종적으로 `group_member`를 기준으로 참여자를 처리한다.

모든 서버 기능은 `getCurrentGroupMember()` 형태의 공통 함수를 통해 Better Auth Session 또는 Guest Session을 현재 `group_member` 정보로 변환한다.

각 요청에서는 변환된 `group_id`와 `member_id`가 조회·수정 대상 데이터의 `group_id`와 일치하는지 다시 검증한다.


## 랜딩 페이지는

랜딩 페이지는 서비스에 처음 접속했을 때 보여주는 화면이다.

루트 경로 `/`에는 로그인과 모임 생성 Stepper를 표시한다.

현재 개발용 사용자·DB 연결 확인 화면은 루트에서 분리하여 개발 환경에서만 접근 가능한 별도 Route에 둔다.

총대는 Better Auth를 이용하여 로그인한다.

로그인한 총대는 먼저 정산 대시보드를 확인한다.

대시보드 상단에는 완료되지 않은 모임을 기준으로 현재 총대가 받아야 할 돈과 보내야 할 돈을 각각 합산해 표시한다.

모임 목록에는 각 모임의 `정산 중` 또는 `정산 완료` 상태를 표시하며, 로그인한 사용자는 **새 정산 시작**을 통해 모임 만들기를 진행할 수 있다.

정산 목록은 `정산 중` 모임을 먼저 표시하고 `정산 완료` 모임을 아래에 표시한다. 대시보드에는 작성 중인 모임을 별도 카드로 표시하지 않는다.

모임 만들기는 다음 Step 방식으로 구성한다.

```text
STEP 1
모임 방식 선택

↓

STEP 2
참여자 설정

↓

STEP 3
모임 확인 및 시작
```


### STEP 1 - 모임 방식 선택

다음 두 가지 중 하나를 선택한다.

```text
혼자하기

내가 모든 비용을 먼저 계산하고
친구들과 나누는 방식
```

```text
함께하기

여러 명이 각각 결제하고
함께 정산하는 방식
```


### STEP 2 - 혼자하기

모임 생성자가 직접 참여자의 별명을 입력한다.

예:

```text
[ 참여자 별명 입력 ] [ + ]

미연
지현
수인
철수
```

참여자는 즉시 추가하거나 삭제할 수 있다.


### STEP 2 - 함께하기

모임 생성자가 참여 예정 인원을 설정한다.

예:

```text
참여 인원

-    4명    +
```

이후 초대 URL을 발급하여 다른 참여자에게 전달한다.

```text
[ 초대 링크 발급 ]

[ 링크 복사 ] [ 초대 화면 열기 ]
```

현재 로컬 목업에서는 서버 프로세스의 메모리에 초대 상태를 보관한다. 총대는 테스트 계정 Cookie로 식별하므로 현재 로그인된 환경에서 자기 초대 링크를 다시 열어도 새 참여자로 등록되지 않는다. 비회원에게는 첫 참여 시 HttpOnly Guest Session Cookie를 발급하며, 같은 브라우저에서 다시 접속하면 기존 참여자로 인식한다. IP 주소는 여러 사람이 공유하거나 변경될 수 있으므로 사용자 식별값으로 사용하지 않는다.

서버를 재시작하면 목업 초대 상태는 초기화된다. 서버 재시작 후에도 유지되는 실제 초대 기능은 이후 `invite`와 `guest_session`을 MongoDB에 연결하는 단계에서 완성한다.

현재 참여 상태를 표시한다.

예:

```text
미연 ✓ 참여 완료
지현 ✓ 참여 완료
수인 ✓ 참여 완료
철수 · 기다리는 중

3 / 4명 참여 완료
```

모든 참여자가 들어오기 전까지 모임을 시작할 수 없다.


### STEP 3 - 모임 확인 및 시작

최종 모임 설정을 확인한다.

예:

```text
모임 방식
함께하기

참여 인원
4명

참여 상태
4 / 4명 참여 완료
```

혼자하기는 참여자 설정이 완료되면 바로 시작할 수 있다.

함께하기는 모든 참여자가 입장해야 시작할 수 있다.


### Step UI

STEP 1, STEP 2, STEP 3은 단순한 Tab보다는 **Stepper + Card 형태**로 구현한다.

예:

```text
●────────────○────────────○

모임 방식     참여자 설정      모임 시작
```

현재 Step은 대표 색상 `#5366EC`로 강조한다.

Stepper 아래에는 하나의 Card 영역을 두고 현재 Step에 따라 Card 내부 컴포넌트를 변경한다.

페이지 전체를 다시 이동시키지 않고 React state를 이용한다.

예:

```jsx
{step === 1 && <StepMode />}
{step === 2 && <StepMembers />}
{step === 3 && <StepConfirm />}
```

SOLO / TOGETHER 선택에 따라서 STEP 2 컴포넌트도 다르게 렌더링한다.

```jsx
{mode === "SOLO"
  ? <SoloMemberSetup />
  : <TogetherInviteSetup />
}
```


## 게시판 페이지는

게시판 페이지에서는 현재 모임의 영수증 등록, 영수증 상세 확인, 메뉴별 참여자 설정 및 정산을 진행한다.


### 1. 상단 영역

상단에는 다음 정보를 표시한다.

- 서비스 Logo
- 현재 사용자 정보
- 모임 이름
- 현재 모임 참여자

예:

```text
성수동 토요일 모임

미연 / 지현 / 수인 / 철수
```


### 2. 영수증 목록

현재 모임에 등록된 영수증 목록을 표시한다.

예:

```text
1차 고깃집

83,000원
지현 결제

참여자
미연 / 지현 / 수인
```

```text
카페

24,000원
수인 결제

참여자
미연 / 수인
```

새로운 영수증을 추가할 수 있는 버튼을 제공한다.

```text
+ 영수증 추가
```


### 3. 영수증 등록 Modal

영수증 추가 버튼을 누르면 Modal을 표시한다.

등록 방식은 다음 세 가지이다.

```text
직접 입력
촬영하기
사진 첨부
```

세 가지 방식은 Tab 또는 Segmented Control 형태로 전환한다.


### 4. 직접 입력

직접 입력에서는 다음 정보를 입력한다.

- 영수증 소제목
- 실제 결제자
- 영수증 참여자
- 메뉴 목록

각 메뉴에는 다음 정보를 입력한다.

- 메뉴명
- 수량
- 개당 금액
- 메뉴별 참여자

예:

```text
[1차 고깃집]

결제자
지현

영수증 참여자
미연 / 지현 / 수인


삼겹살
60,000원

먹은 사람
미연 / 지현 / 수인


소주
20,000원

먹은 사람
지현 / 수인


콜라
3,000원

먹은 사람
미연
```

메뉴는 여러 개 추가하거나 삭제할 수 있다.


### 5. 촬영하기

사용자가 모바일 카메라 등을 이용하여 영수증을 촬영한다.

현재 목업에서는 카메라 또는 사진 선택 화면까지만 열고, 선택 이후 로직은 비워 둔다.

```text
영수증 촬영
↓
이후 처리 없음 (OCR 구현 단계에서 연결)
```


### 6. 사진 첨부

기존에 촬영한 영수증 이미지를 업로드한다.

현재 목업에서는 기기의 사진 선택 화면까지만 열고, 선택 이후 로직은 비워 둔다.

```text
사진 첨부
↓
이후 처리 없음 (OCR 구현 단계에서 연결)
```


### 7. 영수증 상세

등록된 영수증을 선택하면 상세 정보를 표시한다.

표시 정보는 다음과 같다.

- 영수증 소제목
- 실제 결제자
- 영수증 총 금액
- 영수증 참여자
- 메뉴 목록
- 메뉴별 금액
- 메뉴별 참여자
- 참여자별 부담 금액

영수증 수정 버튼을 제공한다.


### 8. 영수증 수정

일반 `TOGETHER` 참여자는 자신이 등록한 영수증만 수정하거나 삭제할 수 있다.

총대는 현재 모임의 모든 영수증을 관리할 수 있다.

`SOLO`에서는 총대만 영수증을 관리한다.

권한을 확인한 뒤 다음 항목을 수정할 수 있다.

- 영수증 소제목
- 실제 결제자
- 영수증 참여자
- 메뉴명
- 메뉴 금액
- 메뉴 추가
- 메뉴 삭제
- 메뉴별 참여자

영수증 또는 메뉴 정보가 변경되면 그룹의 `calculation_version`을 증가시킨다.

이전 버전의 미완료 `settlement_transfer`는 무효화하고, 변경된 원본 데이터와 새 버전을 기준으로 최종 송금 관계를 다시 계산한다.

정산 완료 전 영수증을 삭제하면 관련 미완료 정산 결과도 함께 제거한다.

이미 정산이 완료된 뒤에는 원본 영수증을 물리적으로 삭제하지 않고 `status: "CANCELED"`로 변경하여 이력을 보존한다.


### 9. 정산 결과

모임 전체의 영수증과 메뉴를 기준으로 정산한다.

사용자별로 다음 정보를 표시한다.

- 실제로 결제한 총 금액
- 실제 부담해야 하는 총 금액
- 받을 금액
- 보낼 금액
- 누구에게 얼마를 보내야 하는지
- 누구에게 얼마를 받아야 하는지

예:

```text
내가 결제한 금액
80,000원

내가 부담할 금액
52,500원

받을 금액
27,500원
```

최종 송금 관계는 다음과 같이 표시한다.

```text
지현 → 미연 23,500원
철수 → 미연 15,000원
미연 → 수인 8,000원
```

가능한 경우 불필요한 중간 송금을 상계하여 실제 송금 횟수를 줄인다.

총대는 정산 결과를 확인한 뒤 **정산 완료** 버튼으로 모임을 완료할 수 있다.

**정산 완료** 버튼은 영수증 목록과 정산 현황 아래에 가로로 길게 표시하며, 영수증 상세 및 수정 화면에서는 표시하지 않는다.

완료된 모임은 `status: "COMPLETED"`와 `completed_at`을 기록하고, 대시보드의 진행 중 금액 합산에서는 제외한다. 완료 후 영수증과 정산 결과는 조회할 수 있지만 수정하거나 삭제할 수 없다.


### 10. 화면 기본 구조

기본 게시판의 목록 화면은 다음 두 영역으로 구성한다.

```text
[A 영역]

현재 모임 멤버
미연 / 지현 / 수인 / 철수


[B 영역]

영수증 목록

1차 고깃집
카페
편의점

+ 영수증 추가
```

영수증은 세로 목록으로 표시하고 `+ 영수증 추가` 항목은 등록된 영수증 다음 순서에 항상 붙인다.

```text
영수증 1
영수증 2
+ 영수증 추가
```

영수증을 선택하면 게시판의 본문을 상세 화면으로 전환한다.

상세 화면에서는 결제자, 영수증 참여자, 메뉴, 메뉴별 부담 참여자를 확인하고 수정할 수 있어야 하며 `영수증 목록` 버튼으로 이전 화면에 돌아간다.

상세 정보가 많으므로 작은 Popup 안에 넣지 않는다. PC와 모바일 모두 같은 목록 → 상세 전환 흐름을 사용하고 화면 폭만 반응형으로 조정한다.


### 11. 모바일 대응

영수증 촬영 기능을 사용하므로 모바일 사용성을 중요하게 고려한다.

모바일에서 다음 기능을 쉽게 사용할 수 있어야 한다.

- 카메라 촬영
- 사진 첨부
- 영수증 참여자 선택
- 메뉴별 참여자 선택
- 메뉴 추가
- 메뉴 삭제
- 금액 입력
- 영수증 상세 확인
- 정산 결과 확인

PC와 모바일에서 모두 사용할 수 있는 반응형 UI로 구현한다.


## 구현 시 주의사항

요구사항에 없는 기능을 임의로 추가하지 않는다.

현재 구현 범위에서 다음 기능은 제외한다.

- 사다리타기
- 랜덤 게임
- 벌칙
- 실제 송금 API
- 실제 결제 API

다음 정책은 이 README의 기준을 그대로 따른다.

- 모임 모드는 `SOLO`와 `TOGETHER`만 사용한다.
- 모임 상태는 `WAITING`, `ACTIVE`, `COMPLETED`만 사용한다.
- 영수증 참여자는 `receipts.participant_member_ids[]`에 저장한다.
- 메뉴 참여자는 반드시 영수증 참여자의 부분집합이어야 한다.
- 나누어지지 않는 원 단위는 `consumer_member_ids[]` 저장 순서대로 1원씩 배분한다.
- 최종 송금은 `group_member._id` 기준으로 정렬한 결정적 greedy 상계 결과를 사용한다.
- 메뉴별 결제 상태용 `payment` 컬렉션은 사용하지 않는다.
- 실제 최종 송금 관계는 `settlement_transfer`에 금액과 계산 버전을 함께 저장한다.

다음 항목의 구체적인 값이나 외부 서비스는 아직 확정되지 않았으므로 구현 전에 사용자에게 질문한다.

- 실제 사용할 카카오톡 API의 구체적인 방식
- Invite Token의 정확한 만료 기간
- Guest Session의 정확한 만료 기간
- Cookie의 정확한 유지 기간
- OCR 서비스 및 객체 스토리지 선택

### 환경변수와 비밀정보

MongoDB 접속 URI와 인증 Secret을 소스 또는 README에 직접 적지 않는다.

로컬 개발 값은 Git에서 제외되는 `.env.local`에만 저장한다.

```dotenv
MONGODB_URI=<새로 발급한 MongoDB URI>
MONGODB_DB=dutchpay
BETTER_AUTH_SECRET=<충분히 긴 랜덤 Secret>
BETTER_AUTH_URL=http://localhost:3000
```

운영 환경에서는 `BETTER_AUTH_URL`을 실제 배포 URL로 설정한다.

과거 Git 추적 README에 노출된 MongoDB 비밀번호는 문서에서 제거하는 것만으로 안전해지지 않으므로 Atlas에서 반드시 교체한다.

### 페이지 기본 설정

한국어 서비스에 맞춰 Root Layout과 metadata를 다음 기준으로 구현한다.

- `<html lang="ko">`를 사용한다.
- `<header>`를 `<body>` 내부에 둔다.
- 페이지 제목은 `몫대로`로 설정한다.
- 페이지 설명에는 메뉴별 참여자를 기준으로 정산하는 더치페이 서비스임을 적는다.
- `/`에는 로그인과 모임 생성 Stepper를 둔다.
- DB 연결 확인 화면은 개발 전용 Route로 분리한다.

### 서버 검증과 권한

클라이언트가 전달한 ID와 계산 결과를 그대로 신뢰하지 않는다.

모든 조회·생성·수정·삭제 요청에서 `getCurrentGroupMember()`를 사용하고, 현재 세션의 `group_id`와 `member_id`를 대상 데이터와 비교한다.

일반 `TOGETHER` 참여자는 자신이 등록한 영수증만 수정·삭제할 수 있고, 총대는 해당 그룹 전체 영수증을 관리할 수 있다.

`SOLO`에서는 모든 영수증의 `paid_by_member_id`가 총대의 `group_member._id`인지 서버에서 강제한다.

모임·멤버·영수증·메뉴·초대·정산 문서의 참조와 금액 정합성도 서버에서 검증한다.

### 구현 전 설계 확인

바로 코드를 수정하지 않는다.

먼저 현재 프로젝트 구조를 분석한 뒤 다음 내용을 설계해서 보여준다.

1. 전체 사용자 Flow
2. SOLO / TOGETHER Flow
3. WAITING → ACTIVE 상태 전환 과정
4. 필요한 페이지 및 Route
5. React 컴포넌트 구조
6. MongoDB 컬렉션 구조
7. Better Auth `user`와 `group_member` 관계
8. Invite Token 구조
9. Guest Session 구조
10. 영수증 / 메뉴 / 참여자 데이터 관계
11. OCR 처리 흐름
12. N빵 계산 알고리즘
13. 최종 송금 계산 알고리즘
14. 서버에서 반드시 검증해야 하는 권한
15. 전체 구현 순서

설계 과정에서 이 README로 확정되지 않은 요구사항이나 여러 선택지가 발견되면 질문한다.

설계 내용을 먼저 보여주고 사용자의 승인을 받은 이후에 실제 코드 구현을 시작한다.


## 데이터베이스 구조는

MongoDB Atlas의 `dutchpay` 데이터베이스를 사용한다.

데이터베이스는 다음 9개 컬렉션으로 구성한다.

```text
user
account
session
expense_group
group_member
receipts
settlement_transfer
invite
guest_session
```

기존의 메뉴별 참여자 상태용 `payment` 컬렉션은 사용하지 않는다.

현재 영수증과 메뉴는 별도의 `expense_item` 컬렉션으로 분리하지 않는다.

하나의 영수증을 `receipts` 문서 하나로 관리하고, 해당 영수증에 포함된 메뉴는 `receipts.items[]` 배열에 Embedded Document 형태로 저장한다.

전체적인 관계는 다음과 같다.

```text
Better Auth

user
 ├─ account
 └─ session


더치페이

user
 └─ expense_group
      │
      ├─ group_member
      ├─ invite
      ├─ guest_session
      ├─ receipts
      │    └─ items[]
      │         └─ consumer_member_ids[]
      │              ↓
      │         group_member
      │
      └─ settlement_transfer
           ├─ from_member_id
           └─ to_member_id
                ↓
           group_member
```


### user

Better Auth에서 사용하는 실제 로그인 사용자 정보이다.

이 프로젝트에서는 모임을 생성하는 총대가 Better Auth를 통해 로그인한다.

주요 필드는 다음과 같다.

```text
_id
name
email
emailVerified
createdAt
updatedAt
```

`_id`는 MongoDB `ObjectId`를 사용한다.

`user`는 실제 로그인 가능한 회원 데이터이며, 모임 안에서 정산에 사용하는 `group_member`와는 별개의 개념이다.


### account

Better Auth의 로그인 제공자와 자격 증명을 관리한다.

주요 필드는 다음과 같다.

```text
_id
accountId
providerId
userId
password
createdAt
updatedAt
```

`userId`는 `user._id`를 참조한다.

credential 로그인인 경우 비밀번호 원문이 아니라 해시된 비밀번호를 저장한다.


### session

Better Auth를 통해 로그인한 총대의 로그인 세션을 관리한다.

주요 필드는 다음과 같다.

```text
_id
expiresAt
token
createdAt
updatedAt
ipAddress
userAgent
userId
```

`userId`는 `user._id`를 참조한다.

이 `session`은 Better Auth 회원용 세션이다.

카카오톡 초대를 통해 로그인 없이 들어오는 참여자가 사용하는 `guest_session`과는 별개로 취급한다.


### expense_group

하나의 더치페이 모임을 의미한다.

주요 필드는 다음과 같다.

```text
_id
name
created_by
mode
status
expected_member_count
activated_at
completed_at
calculation_version
created_at
updated_at
```

`_id`는 UUID 문자열을 사용한다.

`created_by`는 해당 모임을 생성한 Better Auth 사용자의 `user._id`를 참조한다.

`mode`는 다음 값만 사용한다.

```text
SOLO
TOGETHER
```

기존 `shared` 값은 사용하지 않는다.

`status`는 다음 값만 사용한다.

```text
WAITING
ACTIVE
COMPLETED
```

`SOLO` 모임은 생성과 동시에 `ACTIVE`가 되며 `activated_at`에 생성 시각을 기록한다.

`TOGETHER` 모임은 `WAITING`으로 생성하고, 실제 참여 인원이 `expected_member_count`에 도달하면 `ACTIVE`로 전환한다.

총대가 정산을 확정하면 `COMPLETED`로 전환하고 `completed_at`에 완료 시각을 기록한다.

`expected_member_count`는 총대를 포함한 전체 참여 예정 인원이다.

현재 참여 인원은 `group_member.group_id`로 계산하며 `joined_member_count`를 별도 저장하지 않는다.

멤버 관계도 `group_member.group_id`를 기준으로 조회하며 `expense_group.member_ids[]`를 중복 저장하지 않는다.

`calculation_version`은 정산 원본의 버전이다.

영수증 또는 메뉴가 생성·수정·삭제되면 값을 증가시키고, 같은 버전으로 생성한 `settlement_transfer`만 현재 정산 결과로 취급한다.


### group_member

더치페이 모임 안에서 실제 정산 단위로 사용하는 참여자이다.

주요 필드는 다음과 같다.

```text
_id
group_id
user_id
nickname
member_type
created_at
```

`_id`는 UUID 문자열을 사용한다.

`group_id`는 `expense_group._id`를 참조한다.

`user_id`는 Better Auth 사용자와 연결되는 경우 `user._id`를 저장하고, 비회원 참여자는 `null`이 될 수 있다.

`member_type`은 다음 값만 사용한다.

```text
registered
guest
```

총대는 Better Auth 사용자이면서 동시에 다음과 같은 `group_member`이다.

```text
user_id = user._id
member_type = registered
```

혼자하기에서 총대가 직접 추가한 참여자와 함께하기 초대로 들어온 비로그인 참여자는 다음과 같다.

```text
user_id = null
member_type = guest
```

같은 Better Auth 사용자가 한 모임에서 중복 멤버가 되지 않도록 `user_id`가 `null`이 아닌 문서에만 `(group_id, user_id)` partial unique index를 적용한다.


### receipts

하나의 영수증과 해당 영수증에 포함된 메뉴를 하나의 MongoDB 문서에 저장한다.

주요 필드는 다음과 같다.

```text
_id
group_id
store_name
total_amount
paid_by_member_id
uploaded_by_member_id
participant_member_ids[]
items[]
image_key
input_method
ocr_status
status
canceled_at
created_at
updated_at
```

각 필드의 역할은 다음과 같다.

```text
_id
→ 영수증 ID

group_id
→ 이 영수증이 속한 더치페이 모임

store_name
→ 가게명 또는 영수증 소제목

total_amount
→ 영수증 전체 결제 금액

paid_by_member_id
→ 실제로 이 영수증 금액을 먼저 결제한 사람

uploaded_by_member_id
→ 이 영수증을 서비스에 등록한 사람

participant_member_ids[]
→ 이 영수증의 일정에 실제로 참여한 멤버

items[]
→ 영수증에 포함된 메뉴 목록

image_key
→ 객체 스토리지에 저장한 영수증 이미지의 키 또는 null

input_method
→ 입력 방법

ocr_status
→ OCR 처리 상태

status
→ 영수증 사용 또는 취소 상태
```

`paid_by_member_id`와 `uploaded_by_member_id`는 `TOGETHER`에서 서로 다를 수 있다.

예를 들어 지현이 실제 결제했고 미연이 대신 영수증을 등록했다면 다음과 같이 표현할 수 있다.

```text
paid_by_member_id
→ 지현

uploaded_by_member_id
→ 미연
```

`SOLO`에서는 `paid_by_member_id`가 항상 총대와 연결된 `group_member._id`여야 한다.

`input_method`는 다음 값만 사용한다.

```text
MANUAL
CAMERA
UPLOAD
```

`ocr_status`는 다음 값만 사용한다.

```text
NONE
PENDING
COMPLETED
FAILED
```

현재 목업에서는 사진 선택 화면까지만 열고 이미지 데이터를 읽거나 저장하지 않는다. 실제 OCR 구현에서는 이미지 바이너리를 MongoDB 문서가 아니라 객체 스토리지에 저장한다.

`status`는 다음 값만 사용한다.

```text
ACTIVE
CANCELED
```

정산이 완료된 영수증은 물리적으로 삭제하지 않고 `CANCELED`로 변경하여 원본 이력을 보존한다.


### receipts.items[]

메뉴는 별도 컬렉션으로 관리하지 않고 `receipts` 내부에 Embedded Document로 저장한다.

메뉴 한 건의 구조는 다음과 같다.

```text
_id
menu_name
quantity
unit_price
line_total
consumer_member_ids[]
```

각 필드의 역할은 다음과 같다.

```text
_id
→ 메뉴 항목 ID

menu_name
→ 메뉴명

quantity
→ 주문 수량

unit_price
→ 메뉴 1개의 단가

line_total
→ 해당 메뉴 전체 금액

consumer_member_ids[]
→ 해당 메뉴의 비용을 실제로 나눌 참여자
```

`line_total`은 다음 계산 결과와 일치해야 한다.

```text
quantity * unit_price
```


### 영수증 참여자와 메뉴별 참여자

영수증에 실제로 참여한 멤버는 `receipts.participant_member_ids[]`에 명시적으로 저장한다.

메뉴마다 실제 비용을 부담할 멤버는 `receipts.items[].consumer_member_ids[]`에 저장한다.

예:

```text
[1차 고깃집]

participant_member_ids
→ 미연
→ 지현
→ 수인

삼겹살 consumer_member_ids
→ 미연
→ 지현
→ 수인

소주 consumer_member_ids
→ 지현
→ 수인

콜라 consumer_member_ids
→ 미연
```

모든 `items[].consumer_member_ids[]`는 `participant_member_ids[]`의 부분집합이어야 한다.

메뉴별 참여자는 한 명 이상이어야 하고, 배열 안에서 같은 멤버를 중복 저장하지 않는다.

클라이언트 선택 범위도 영수증 참여자로 제한하지만 최종 검증은 서버에서 수행한다.


### 메뉴별 금액 계산

각 메뉴의 `line_total`을 해당 메뉴의 `consumer_member_ids` 수로 나누어 개인별 부담 금액을 계산한다.

정수 몫을 먼저 모두에게 배분하고 나머지는 `consumer_member_ids[]`의 저장 순서대로 1원씩 추가한다.

예:

```text
10,000원 / 3명

첫 번째 멤버  3,334원
두 번째 멤버  3,333원
세 번째 멤버  3,333원
```

분담 금액은 원본 메뉴 데이터에서 계산하며 메뉴별 결과를 별도 필드로 중복 저장하지 않는다.

각 메뉴의 분담액 합계는 항상 `line_total`과 같아야 한다.


### 영수증 총 금액 검증

`receipts.total_amount`는 모든 메뉴의 `line_total`을 더한 결과와 일치해야 한다.

```text
receipts.total_amount
=
sum(receipts.items[].line_total)
```

저장 및 수정 시 서버에서 금액 정합성을 검증한다.


### 참여자 정합성

다음 참여자는 모두 영수증의 `group_id`와 동일한 모임에 속한 `group_member`여야 한다.

```text
paid_by_member_id
uploaded_by_member_id
participant_member_ids[]
items[].consumer_member_ids[]
```

다른 모임의 `group_member` ID를 전달하여 영수증이나 메뉴에 포함할 수 없어야 한다.

모든 서버 요청은 현재 세션의 `group_id`와 `member_id`도 대상 문서와 비교한다.


### settlement_transfer

`settlement_transfer`는 메뉴별 상태가 아니라 모임 전체를 상계한 실제 최종 송금 관계를 저장한다.

주요 필드는 다음과 같다.

```text
_id
group_id
from_member_id
to_member_id
amount
status
calculation_version
created_at
paid_at
```

각 필드의 역할은 다음과 같다.

```text
group_id
→ 정산이 속한 모임

from_member_id
→ 돈을 보내야 하는 참여자

to_member_id
→ 돈을 받을 참여자

amount
→ 해당 버전에서 확정된 송금 금액

status
→ 송금 진행 상태

calculation_version
→ 이 결과를 만든 그룹 정산 버전

paid_at
→ 송금 완료 시각 또는 null
```

`status`는 다음 값만 사용한다.

```text
PENDING
PAID
INVALIDATED
```

영수증 결제자의 자기 부담분은 잔액 계산에만 반영한다.

`from_member_id`와 `to_member_id`가 같은 문서는 생성하지 않는다.

`amount`는 0보다 큰 정수 원 단위 값이어야 한다.

영수증 또는 메뉴가 바뀌면 그룹의 `calculation_version`을 증가시키고 이전 버전의 미완료 결과를 `INVALIDATED`로 변경한 뒤 새 결과를 생성한다.

이미 `PAID`인 결과의 `amount`와 `calculation_version`은 과거 이력으로 보존한다.


### 최종 송금 계산

참여자별 최종 잔액은 다음과 같이 계산한다.

```text
최종 잔액
=
실제 결제한 총 금액 - 실제 부담해야 하는 총 금액
```

잔액이 음수인 참여자는 채무자, 양수인 참여자는 채권자이다.

채무자와 채권자를 각각 `group_member._id` 오름차순으로 정렬한 뒤 앞에서부터 결정적인 greedy 방식으로 매칭한다.

한쪽 잔액이 0이 되면 다음 참여자로 이동하고 모든 잔액이 0이 될 때까지 반복한다.

이 과정으로 불필요한 중간 채무를 상계한다.

```text
A → B 10,000원
B → C 10,000원

최종 결과
A → C 10,000원
```


### 영수증 변경과 정산 버전

영수증 또는 메뉴를 생성·수정·삭제하면 같은 트랜잭션 또는 일관된 서버 절차에서 다음 순서로 처리한다.

```text
원본 영수증 변경
↓
expense_group.calculation_version 증가
↓
이전 PENDING settlement_transfer 무효화
↓
새 버전으로 부담액과 최종 잔액 계산
↓
새 settlement_transfer 생성
```

정산 완료 전 영수증 삭제 시 해당 원본으로 만든 미완료 결과를 함께 제거하거나 무효화한다.

정산 완료 후에는 영수증을 물리적으로 삭제하지 않고 `CANCELED` 상태로 변경한다.


### invite

참여 자리마다 고유 Invite를 한 건 생성한다.

주요 필드는 다음과 같다.

```text
_id
group_id
member_id
token_hash
status
expires_at
claimed_at
created_at
```

최초 생성 시 `member_id`는 `null`이고 `status`는 `PENDING`이다.

최초 참여가 성공하면 생성된 `group_member._id`를 `member_id`에 연결하고 `status`를 `CLAIMED`로 변경한다.

`status`는 다음 값만 사용한다.

```text
PENDING
CLAIMED
REVOKED
```

만료 여부는 `expires_at`으로 판단한다.

Invite claim과 `group_member` 생성은 MongoDB 트랜잭션으로 처리하고, `PENDING` 상태인 문서만 조건부로 선점한다.

이미 `CLAIMED`인 Invite로 재접속하면 `member_id`의 기존 멤버를 확인한 뒤 새 Guest Session만 발급한다.


### guest_session

비로그인 초대 참여자의 세션을 Better Auth `session`과 별도로 저장한다.

주요 필드는 다음과 같다.

```text
_id
group_id
member_id
token_hash
expires_at
created_at
last_accessed_at
```

Token은 충분히 긴 암호학적 난수로 생성하고 원문은 DB에 저장하지 않는다.

서버는 Cookie의 원문 Token을 동일한 방식으로 해시하여 `token_hash`로 세션을 찾는다.

`expires_at`에는 TTL 인덱스를 적용한다.


### 인증 통합과 접근 권한

`getCurrentGroupMember()` 형태의 공통 서버 함수는 Better Auth `session` 또는 `guest_session`을 현재 `group_member` 정보로 변환한다.

모든 API는 이 결과의 `group_id` 및 `member_id`와 대상 모임·영수증·메뉴·Invite·정산 문서의 `group_id`를 비교한다.

권한 기준은 다음과 같다.

- 총대는 자신이 만든 그룹의 모든 영수증을 관리할 수 있다.
- 일반 `TOGETHER` 참여자는 자신이 등록한 영수증만 수정하거나 삭제할 수 있다.
- `SOLO`에서는 총대만 영수증을 등록·수정·삭제할 수 있다.
- `SOLO` 영수증의 결제자는 항상 총대의 `group_member`이다.


### 데이터베이스에서 계산값을 다루는 원칙

원본에서 다시 계산할 수 있는 중간 값은 가능한 한 중복 저장하지 않는다.

다음 값은 영수증과 메뉴 원본에서 계산한다.

```text
메뉴별 개인 부담 금액
개인별 총 부담 금액
개인별 실제 결제 금액
개인별 최종 잔액
```

실제로 송금해야 하는 최종 결과는 상태 추적과 과거 이력을 위해 `settlement_transfer`에 저장한다.

이때 반드시 `amount`와 `calculation_version`을 함께 저장한다.


### MongoDB validator

MongoDB validator는 최소한 다음 내용을 보호한다.

- 필수 필드 존재 여부
- 문자열, 숫자, 날짜, 배열 등 기본 BSON 타입
- `expense_group.mode`의 `SOLO | TOGETHER` enum
- `expense_group.status`의 `WAITING | ACTIVE | COMPLETED` enum
- `invite.status`의 `PENDING | CLAIMED | REVOKED` enum
- `receipts.input_method`의 `MANUAL | CAMERA | UPLOAD` enum
- `receipts.ocr_status`의 `NONE | PENDING | COMPLETED | FAILED` enum
- `settlement_transfer.status`의 `PENDING | PAID | INVALIDATED` enum
- 금액과 인원수의 최소값

컬렉션 간 참조, 메뉴 참여자의 부분집합 관계, 금액 합계, 모드별 권한과 같은 규칙은 서버 validation으로 다시 보호한다.


### 인덱스

주요 그룹별 조회를 위해 다음 보조 인덱스를 추가한다.

```text
expense_group.created_by
group_member.group_id
receipts.group_id
settlement_transfer.group_id
invite.group_id
guest_session.member_id
```

중복을 DB에서 차단하기 위해 다음 고유 인덱스를 추가한다.

```text
user.email
session.token
account(providerId, accountId)
invite.token_hash
guest_session.token_hash
```

`group_member(group_id, user_id)`에는 `user_id`가 `null`이 아닌 문서만 대상으로 하는 partial unique index를 적용한다.

`guest_session.expires_at`에는 TTL 인덱스를 적용한다.

실제 Better Auth 컬렉션의 필드명과 인덱스 요구사항은 설치된 Better Auth Adapter 버전의 스키마와 맞춰 확인한다.


### 환경변수와 보안

`lib/db.js`가 요구하는 MongoDB 설정과 Better Auth 운영 설정은 환경변수로만 제공한다.

```dotenv
MONGODB_URI=<새로 발급한 MongoDB URI>
MONGODB_DB=dutchpay
BETTER_AUTH_SECRET=<충분히 긴 랜덤 Secret>
BETTER_AUTH_URL=http://localhost:3000
```

`.env.local`은 Git에 포함하지 않는다.

Git 추적 문서나 소스에 URI, 비밀번호, Secret, Token 원문을 기록하지 않는다.

이미 노출된 MongoDB 비밀번호는 Atlas에서 교체한 뒤 새 URI만 로컬과 배포 환경변수에 등록한다.


### 개발·테스트 Seed

현재 seed의 참조와 금액 정합성에는 문제가 없으므로 단일 영수증 N빵 기본 예시로 유지한다.

기능 구현 후에는 다음 예시를 추가하여 검증 범위를 넓힌다.

1. 총대 1명과 guest 여러 명, 모든 결제자가 총대인 `SOLO ACTIVE`
2. 목표 인원보다 참여자가 적고 `PENDING` Invite가 남은 `TOGETHER WAITING`
3. 총대와 모든 guest가 참여한 `TOGETHER ACTIVE`
4. 서로 다른 멤버가 결제한 영수증이 3개 이상인 최종 상계 예시
5. 실제 결제자와 영수증 등록자가 다른 예시
6. 영수증 참여자와 메뉴 소비자가 다른 예시
7. 10,000원을 3명이 나누는 원 단위 나머지 예시
8. `A → B`와 `B → C`가 `A → C`로 상계되는 예시
9. 여러 번 실행해도 같은 상태가 되는 개발·테스트 전용 멱등성 seed 스크립트

Seed는 개발·테스트 환경에서만 실행한다.


## 초대링크 제약사항

- 참여 자리마다 충분히 긴 암호학적 난수 Token이 포함된 고유 URL을 생성한다.
- Token 원문은 URL로 전달하고 DB에는 해시만 저장한다.
- 최초 참여에서는 `PENDING` Invite를 조건부로 선점하고 멤버 생성까지 트랜잭션으로 처리한다.
- 참여 인원이 `expected_member_count`를 넘지 않도록 서버에서 다시 확인한다.
- 참여가 끝난 Invite는 `member_id`와 연결하여 같은 링크 재접속 시 기존 멤버를 식별한다.
- 재접속 시 새 `group_member`를 만들지 않고 새 `guest_session`과 HttpOnly Cookie만 발급한다.
- `REVOKED`이거나 `expires_at`이 지난 Invite는 사용할 수 없다.
- 브라우저 Cookie에는 Guest Session Token만 저장한다.
