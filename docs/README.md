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

기본적으로 모든 영수증의 실제 결제자는 모임 생성자이다.


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
- 금액
- 메뉴별 참여자

메뉴는 여러 개 추가하거나 삭제할 수 있다.


### 7. 영수증 촬영 및 사진 첨부

영수증을 직접 촬영하거나 기존 사진을 첨부할 수 있다.

이미지는 OCR 또는 영수증 이미지 분석 기능을 이용해 분석한다.

가능하면 다음 정보를 추출한다.

- 가게명
- 메뉴명
- 메뉴별 금액
- 총 금액

OCR 결과는 정확하지 않을 수 있으므로 사용자가 반드시 수정할 수 있어야 한다.

처리 흐름은 다음과 같다.

```text
영수증 촬영 또는 사진 첨부
↓
OCR / 이미지 분석
↓
가게명 / 메뉴명 / 금액 추출
↓
입력 Form 자동 완성
↓
사용자 수정
↓
영수증 참여자 선택
↓
메뉴별 참여자 선택
↓
저장
```


### 8. 정산 계산

정산은 메뉴 단위부터 계산한다.

기본 계산식은 다음과 같다.

```text
메뉴 금액 / 메뉴 참여자 수
```

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

불필요한 중간 송금은 가능한 경우 상계한다.

예:

```text
A → B 10,000원
B → C 10,000원
```

B의 최종 잔액이 0이라면 다음과 같이 정리한다.

```text
A → C 10,000원
```

최종 화면에는 실제 필요한 송금 관계를 보여준다.


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

카카오톡은 초대 링크를 전달하는 수단으로 사용한다.

초대받은 참여자는 다음 방식으로 모임에 접근한다.

```text
총대 Better Auth 로그인
↓
함께하기 모임 생성
↓
참여 예정 인원 설정
↓
Invite Token 생성
↓
카카오톡으로 초대 링크 전달
↓
초대받은 사용자가 링크 접속
↓
서버에서 Invite Token 검증
↓
group_member 생성 또는 기존 Member 확인
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

Invite Token 원문은 DB에 그대로 저장하지 않고 해시값으로 저장하는 구조를 사용한다.

개념적인 데이터 구조는 다음과 같다.

```text
invite

_id
group_id
member_id
token_hash
status
expires_at
created_at
```

Invite Token은 Guest Session 발급 및 필요한 경우 재발급을 위한 기준으로 사용한다.


### 5. Guest Session

Invite Token 검증이 완료되면 초대 참여자의 Guest Session을 생성한다.

Guest Session은 Better Auth의 `session`과 별도로 관리한다.

개념적인 구조는 다음과 같다.

```text
guest_session

_id
group_id
member_id
token_hash
expires_at
created_at
```

Guest Session Token은 랜덤한 토큰을 사용한다.

브라우저에는 Guest Session Token을 저장하고 서버에서는 해당 Token을 이용하여 MongoDB의 Guest Session 데이터를 조회한다.

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


## 랜딩 페이지는

랜딩 페이지는 서비스에 처음 접속했을 때 보여주는 화면이다.

총대는 Better Auth를 이용하여 로그인한다.

로그인한 사용자는 **모임 만들기**를 진행할 수 있다.

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

이후 카카오톡으로 초대 링크를 전달한다.

```text
[ 카카오톡으로 초대하기 ]
```

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
- 금액
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

촬영한 이미지를 OCR 또는 이미지 분석 기능으로 분석한다.

```text
영수증 촬영
↓
OCR / 이미지 분석
↓
가게명 / 메뉴 / 금액 추출
↓
입력 Form 자동 완성
↓
사용자 수정
↓
참여자 설정
↓
저장
```


### 6. 사진 첨부

기존에 촬영한 영수증 이미지를 업로드한다.

이후 처리 과정은 촬영하기와 동일하다.

```text
사진 첨부
↓
OCR / 이미지 분석
↓
가게명 / 메뉴 / 금액 추출
↓
입력 Form 자동 완성
↓
사용자 수정
↓
참여자 설정
↓
저장
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

다음 항목을 수정할 수 있다.

- 영수증 소제목
- 실제 결제자
- 영수증 참여자
- 메뉴명
- 메뉴 금액
- 메뉴 추가
- 메뉴 삭제
- 메뉴별 참여자

영수증 또는 메뉴 정보가 변경되면 변경된 데이터를 기준으로 정산 결과도 다시 계산한다.


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


### 10. 화면 기본 구조

기본 화면은 다음 세 영역으로 구성한다.

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


[C 영역]

현재 선택한 영수증의 상세 정보
```

PC에서는 화면 공간이 충분한 경우 영수증 목록과 상세 정보를 동시에 확인할 수 있도록 구성한다.

```text
영수증 목록 | 영수증 상세
```

모바일에서는 세로 구조로 자연스럽게 변경한다.


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

다음 사항은 아직 세부 정책이 확정되지 않았으므로 임의로 결정하지 않는다.

- 실제 사용할 카카오톡 API의 구체적인 방식
- Invite Token의 정확한 만료 기간
- Guest Session의 정확한 만료 기간
- Cookie의 정확한 유지 기간
- OCR 서비스 선택
- 금액이 정확히 나누어지지 않을 때의 원 단위 처리 정책
- 송금 최소화 알고리즘의 세부 정책

위 항목이 구현 과정에서 필요해지면 임의로 결정하지 말고 사용자에게 먼저 질문한다.

요구사항에서 알 수 없는 데이터나 정책을 추측하여 구현하지 않는다.

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

설계 과정에서 요구사항이 모호하거나 선택지가 여러 개인 부분이 발견되면 임의로 판단하지 말고 질문한다.

설계 내용을 먼저 보여주고 사용자의 승인을 받은 이후에 실제 코드 구현을 시작한다.

## 데이터베이스 구조는

MongoDB Atlas의 `dutchpay` 데이터베이스를 사용한다.

현재 데이터베이스는 다음 7개 컬렉션으로 구성되어 있다.

```text
user
account
session
expense_group
group_member
receipts
payment
```

현재 영수증과 메뉴는 별도의 `expense_item` 컬렉션으로 분리하지 않는다.

하나의 영수증을 `receipts` 문서 하나로 관리하고, 해당 영수증에 포함된 메뉴들은 `receipts.items[]` 배열에 Embedded Document 형태로 저장한다.

전체적인 관계는 다음과 같다.

```text
user
 ├─ account
 └─ session

user
 └─ expense_group
      │
      ├─ group_member
      │
      └─ receipts
           │
           └─ items[]
                │
                └─ consumer_member_ids[]
                     ↓
                group_member

payment
 ├─ group_id
 ├─ receipt_id
 ├─ expense_item_id
 ├─ payer_member_id
 ├─ payee_member_id
 └─ status
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

카카오톡 초대를 통해 로그인 없이 들어오는 참여자가 사용하는 Guest Session과는 별개로 취급한다.


### expense_group

하나의 더치페이 모임을 의미한다.

주요 필드는 다음과 같다.

```text
_id
name
created_by
mode
member_ids[]
created_at
```

`_id`는 UUID 문자열을 사용한다.

`created_by`는 해당 모임을 생성한 Better Auth 사용자의 `user._id`를 참조한다.

`member_ids[]`에는 해당 모임에 속한 `group_member._id` 목록을 저장한다.

현재 DB 정의서의 `mode` 값은 `shared`로 되어 있다.

하지만 실제 서비스 요구사항에서는 다음 두 가지 모드가 필요하다.

```text
SOLO
TOGETHER
```

따라서 실제 구현 전에 `expense_group.mode`를 기존 `shared` 방식으로 유지할 것인지, `SOLO / TOGETHER` 방식으로 변경할 것인지 확정해야 한다.


### group_member

더치페이 모임 안에서 실제 정산 단위로 사용하는 참여자이다.

주요 필드는 다음과 같다.

```text
_id
group_id
user_id
nickname
member_type
```

`_id`는 UUID 문자열을 사용한다.

`group_id`는 `expense_group._id`를 참조한다.

`user_id`는 Better Auth 사용자와 연결되는 경우 `user._id`를 저장하고, 비회원 참여자는 `null`이 될 수 있다.

`member_type`은 다음 값을 사용한다.

```text
registered
guest
```

총대는 Better Auth 사용자이므로 다음과 같이 연결된다.

```text
user
↓
group_member

user_id = user._id
member_type = registered
```

혼자하기에서 총대가 직접 추가한 참여자는 다음과 같이 사용할 수 있다.

```text
nickname = "지현"
user_id = null
member_type = guest
```

함께하기에서 카카오톡 초대를 통해 들어온 비로그인 사용자 역시 실제 정산에서는 `group_member`를 기준으로 처리한다.


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
items[]
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

items[]
→ 영수증에 포함된 메뉴 목록
```

`paid_by_member_id`와 `uploaded_by_member_id`는 서로 다를 수 있다.

예를 들어 지현이 실제 결제했고 미연이 대신 영수증을 등록했다면 다음과 같이 표현할 수 있다.

```text
paid_by_member_id
→ 지현

uploaded_by_member_id
→ 미연
```


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

예:

```text
삼겹살

quantity
2

unit_price
15,000

line_total
30,000
```


### 메뉴별 참여자

이 서비스의 핵심 기능 중 하나이다.

같은 영수증에 포함된 메뉴라도 실제로 먹은 사람이 다를 수 있기 때문에 메뉴마다 `consumer_member_ids[]`를 별도로 저장한다.

예:

```text
[1차 고깃집]

삼겹살
60,000원

consumer_member_ids
→ 미연
→ 지현
→ 수인


소주
20,000원

consumer_member_ids
→ 지현
→ 수인


콜라
3,000원

consumer_member_ids
→ 미연
```

따라서 영수증 전체 금액을 영수증 참여자 수로 단순하게 나누지 않는다.

각 메뉴의 `line_total`을 해당 메뉴의 `consumer_member_ids` 수로 나누어 개인별 부담 금액을 계산한다.

예:

```text
삼겹살

60,000 / 3
= 20,000원씩


소주

20,000 / 2
= 10,000원씩


콜라

3,000 / 1
= 3,000원
```

분담 금액 자체는 DB에 별도 저장하지 않고 원본 메뉴 데이터를 기준으로 계산한다.

기본 계산식은 다음과 같다.

```text
메뉴별 개인 부담금
=
items[].line_total / items[].consumer_member_ids.length
```


### 영수증 총 금액 검증

`receipts.total_amount`는 모든 메뉴의 `line_total`을 더한 결과와 일치해야 한다.

```text
receipts.total_amount
=
sum(receipts.items[].line_total)
```

예:

```text
삼겹살 30,000
소주    4,000
콜라    2,000

↓

total_amount
36,000
```

저장 및 수정 시 서버에서 금액 정합성을 검증한다.


### 참여자 정합성

다음 참여자들은 반드시 해당 영수증의 `group_id`와 동일한 모임에 속한 `group_member`여야 한다.

```text
paid_by_member_id
uploaded_by_member_id
items[].consumer_member_ids[]
```

다른 모임의 `group_member` ID를 임의로 전달하여 영수증이나 메뉴에 포함할 수 없어야 한다.

이 검증은 클라이언트의 값을 그대로 신뢰하지 않고 서버에서 다시 확인한다.


### payment

`payment`는 최종 송금 결과를 한 건으로 저장하는 컬렉션이 아니라 **메뉴별 참여자의 정산 상태를 관리하는 컬렉션**이다.

주요 필드는 다음과 같다.

```text
_id
group_id
receipt_id
expense_item_id
payer_member_id
payee_member_id
status
created_at
```

각 필드의 역할은 다음과 같다.

```text
_id
→ 정산 내역 ID

group_id
→ 정산이 속한 모임

receipt_id
→ 정산 대상 영수증

expense_item_id
→ 정산 대상 메뉴

payer_member_id
→ 돈을 보내야 하는 참여자

payee_member_id
→ 돈을 받을 참여자

status
→ 결제 완료 여부
```

`status`는 다음 두 값을 사용한다.

```text
paid
unpaid
```


### payment와 메뉴의 관계

`expense_item` 컬렉션은 사용하지 않는다.

`payment.expense_item_id`는 `receipts.items[]._id`를 논리적으로 참조한다.

예:

```text
receipts

_id
RECEIPT_001

items
 ├─ ITEM_001 삼겹살
 ├─ ITEM_002 소주
 └─ ITEM_003 콜라
```

삼겹살에 대한 정산 상태를 저장하는 경우 다음과 같이 연결한다.

```text
payment.receipt_id
→ RECEIPT_001

payment.expense_item_id
→ ITEM_001
```

즉 다음과 같은 관계이다.

```text
receipts
 └─ items[]
      └─ _id
          ↑
          │
payment.expense_item_id
```


### 메뉴별 payment 생성

현재 DB 정의 기준에서는 메뉴의 `consumer_member_ids[]`에 포함된 참여자별로 `payment` 문서를 생성한다.

각 `payment`는 어떤 메뉴의 어떤 참여자가 정산을 완료했는지를 판단하는 용도로 사용한다.

예:

```text
[삼겹살]

consumer_member_ids

미연
지현
수인
```

각 참여자의 메뉴 정산 상태를 `payment`에서 관리한다.

```text
ITEM_001 / 미연 / unpaid
ITEM_001 / 지현 / paid
ITEM_001 / 수인 / unpaid
```

`payment`에는 개인별 분담 금액을 별도로 저장하지 않는다.

금액이 필요한 경우 다음 값을 기준으로 계산한다.

```text
receipts.items[].line_total
/
receipts.items[].consumer_member_ids.length
```


### payment의 참조 관계

`payment`는 다음 데이터를 참조한다.

```text
group_id
→ expense_group._id

receipt_id
→ receipts._id

expense_item_id
→ receipts.items[]._id

payer_member_id
→ group_member._id

payee_member_id
→ group_member._id
```

`expense_item_id`는 MongoDB의 실제 FK가 아니라 Embedded Document의 `_id`를 애플리케이션에서 논리적으로 참조하는 구조이다.


### 현재 MongoDB 관계 정리

```text
Better Auth

user
 ├─ account
 └─ session


더치페이

user
  │
  │ created_by
  ↓
expense_group
  │
  ├──────────────┐
  │              │
  ↓              ↓
group_member   receipts
                 │
                 ↓
               items[]
                 │
                 │ consumer_member_ids[]
                 ↓
            group_member


receipts.items[]._id
        ↑
        │
payment.expense_item_id
```


### 데이터베이스에서 계산값을 다루는 원칙

가능한 경우 계산 결과를 중복 저장하지 않고 원본 데이터를 기준으로 계산한다.

다음 값은 원본 데이터에서 계산할 수 있다.

```text
메뉴별 개인 부담 금액
개인별 총 부담 금액
개인별 실제 결제 금액
개인별 최종 잔액
최종 정산 관계
```

특히 메뉴별 부담 금액은 별도 필드로 저장하지 않는다.

```text
line_total
/
consumer_member_ids.length
```

를 기준으로 계산한다.

영수증이나 메뉴가 수정되면 변경된 원본 데이터를 이용하여 정산 결과를 다시 계산한다.


### 현재 DB 정의서 기준 인덱스 검토

현재 각 컬렉션에는 기본 `_id` 인덱스가 존재하는 구조이다.

실제 구현 시 다음 조회 필드에 대한 보조 인덱스를 검토한다.

```text
receipts.group_id
receipts.items._id

payment.group_id
payment.receipt_id
payment.expense_item_id
```

Better Auth 관련해서는 사용하는 Better Auth 버전과 실제 Adapter 요구사항을 확인하여 다음 필드의 고유성 및 인덱스를 검토한다.

```text
user.email
session.token
```


### 현재 DB 정의와 서비스 기획 사이에서 추가로 필요한 부분

현재 MongoDB 정의서에는 다음 두 컬렉션이 존재하지 않는다.

```text
invite
guest_session
```

하지만 함께하기 모드에서 비로그인 참여자를 카카오톡으로 초대하고, Invite Token 검증 이후 HttpOnly Cookie를 이용하여 Guest Session을 유지하려면 별도의 데이터 저장 구조가 필요하다.

현재 기획상 인증 흐름은 다음과 같다.

```text
총대
↓
Better Auth 로그인
↓
함께하기 모임 생성
↓
Invite Token 생성
↓
카카오톡으로 초대 링크 전달
↓
초대받은 사용자가 링크 접속
↓
Invite Token 검증
↓
group_member 연결
↓
Guest Session Token 생성
↓
Guest Session DB 저장
↓
HttpOnly Cookie 발급
↓
이후 요청마다 Guest Session 확인
```

따라서 `invite`와 `guest_session`은 현재 DB에 이미 존재하는 컬렉션으로 취급하지 않는다.

구현 전에 별도 컬렉션으로 추가할지 최종 정의가 필요하다.


### 현재 정의서에서 확정되지 않은 영수증 참여자

현재 `receipts`에는 다음과 같은 별도의 영수증 참여자 배열이 정의되어 있지 않다.

```text
participant_member_ids[]
```

현재 정의되어 있는 것은 메뉴별 참여자인 다음 필드이다.

```text
receipts.items[].consumer_member_ids[]
```

서비스 요구사항에는 다음 두 단계의 참여자 선택이 존재한다.

```text
영수증 참여자
↓
메뉴별 참여자
```

따라서 구현 전에 영수증 참여자를 다음 중 어떤 방식으로 관리할지 확정해야 한다.

```text
방법 1

receipts에 별도의
participant_member_ids[]
필드를 추가한다.


방법 2

items[].consumer_member_ids[]의
전체 합집합을 영수증 참여자로 계산한다.
```

이 부분은 요구사항만으로 임의 결정하지 않는다.


### 현재 정의서에서 확정되지 않은 모임 mode

현재 `expense_group.mode`의 DB 데이터는 `shared`를 기준으로 작성되어 있다.

하지만 현재 서비스 기획에서는 다음 두 모드를 사용한다.

```text
SOLO
TOGETHER
```

따라서 구현 전 `expense_group.mode`의 실제 저장 값을 확정해야 한다.

요구사항 확인 없이 `shared`를 임의로 `SOLO / TOGETHER`로 변경하지 않는다.


## 초대링크 제약사항
고유 토큰(UUID)이 포함된 URL로 생성
초대 받은 사람이 들어오면 세션 id 생성 및 브라우저 쿠키에 저장
생성된 세션 id는 group_member 컬렉션의 group_member._id에 저장.