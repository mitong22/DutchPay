# DutchPay / 몫대로 프로젝트 분석

작성일: 2026-09-09  
기준: 프로젝트 소스 코드와 `package.json`을 읽어 작성한 현재 구현 설명. 실제 Atlas의 문서·인덱스·배포 설정을 새로 조회한 보고서는 아니다.

## 1. 어떤 프로젝트인가

**몫대로**는 영수증의 메뉴별로 먹은 사람을 선택하고 각자의 부담액과 보내거나 받을 금액을 계산하는 웹 앱이다. 결제 대행이나 실제 송금 기능은 없으며, 금액 계산과 상태 관리가 목적이다.

- 총대는 이메일·비밀번호로 로그인해 모임을 만든다.
- `SOLO`: 총대가 참여자 이름을 입력하면 즉시 시작한다.
- `TOGETHER`: 각자 초대 링크로 들어오며 예정 인원이 모두 참여할 때까지 대기한다.
- 영수증은 직접 입력하거나 CLOVA OCR 결과로 입력칸을 채운다.
- 메뉴마다 참여자를 지정하고 원 단위로 나눈다.
- 모임 전체 정산은 총대가 하단의 완료 버튼을 눌러 종료한다.

## 2. 사용 기술과 선택 방식

아래 버전은 `package.json`에 선언된 버전이다. `^`가 있는 패키지의 정확한 설치 버전은 `package-lock.json`을 기준으로 한다.

| 기술 | 선언 버전 | 실제 사용 역할 |
| --- | --- | --- |
| Next.js | 16.3.3 | App Router, 서버 페이지, API Route Handler, 개발 서버·빌드 |
| React / React DOM | 19.2.8 | 화면, 상태 관리, 입력 모달, 클릭 이벤트 |
| JavaScript / JSX | — | 애플리케이션 구현 언어. `.mjs`는 ES 모듈 파일 |
| MongoDB Node.js Driver | ^7.6.0 | Atlas 연결, 컬렉션 조회·저장, 트랜잭션 |
| Better Auth | ^1.7.3 | 이메일 회원가입·로그인·세션·로그아웃 |
| Better Auth Mongo Adapter | ^1.7.3 | 인증 데이터를 MongoDB에 저장 |
| NAVER CLOVA OCR | General V2 요청 | 사진에서 글자와 좌표를 추출. 앱 파서가 상품 구조로 변환 |
| CSS | — | `app/globals.css`에서 전체 화면·모바일·모달 스타일 정의 |
| ESLint / eslint-config-next | ^9 / 16.3.3 | 정적 코드 검사 |
| Node.js 기본 테스트 러너 | `node --test` | OCR·정산·상태·로그 테스트 |

Mongoose, Prisma, Tailwind CSS, 별도 UI 컴포넌트 라이브러리, 별도 Express 서버는 현재 의존성에 없다. DB는 MongoDB 드라이버로 직접 다루며 서버 API도 Next.js 안에 있다.

## 3. 구조와 파일별 역할

경로는 이 문서가 있는 프로젝트 루트를 기준으로 한다. 수정할 기능과 연결되는 파일을 찾기 위한 목록이다.

### 화면 및 페이지

| 파일 | 역할 |
| --- | --- |
| `app/layout.js` | 전체 페이지의 HTML·body, 한국어 설정, 제목·설명, 공통 CSS 로딩. 카카오톡 웹뷰가 초기화 전에 추가하는 루트 속성 때문에 발생한 경고에 대응해 html/body에만 `suppressHydrationWarning` 적용 |
| `app/page.js` | 서버에서 로그인 세션과 모임 목록을 조회하고 `HomeClient`에 전달. DB 연결 실패 안내도 처리 |
| `app/groups/[groupId]/page.js` | 로그인 세션 또는 비회원 쿠키로 모임 접근을 확인하고 보드 데이터를 조회. 접근 불가 시 notFound 처리 |
| `app/invite/[token]/page.js` | 초대 토큰을 확인하고 참여 화면에 필요한 모임명·인원 정보를 전달 |
| `component/HomeClient.js` | 로그인·회원가입, 내 모임 목록, 로그아웃, 모임 생성 단계와 개별 초대 링크 표시. 내부 `LoginPanel`, `Stepper`, `GroupWizard` 포함 |
| `component/BoardClient.js` | 대기 화면, 참여자별 영수증 필터, 정산 현황, 영수증 상세, 초대 재발급, 총대의 정산 완료. 내부 `ReceiptEditor`가 직접 입력·사진 미리보기·OCR·메뉴 편집을 처리 |
| `component/InviteClient.js` | 초대 미리보기, 닉네임 입력, 참여 API 호출, 입장 후 모임 이동 |
| `component/selectDb.js` | 개발용 user 목록 Server Component. 이름·이메일·인증 여부·가입일 조회. 현재 페이지에서 import하지 않아 실제 화면에는 연결되어 있지 않음 |
| `app/globals.css` | 랜딩·모임 목록·대기·보드·모달·반응형 화면 스타일. 금액 입력 스피너 숨김, 사진 미리보기, 읽기 전용 참여자 표시 포함 |

### 서버 API

| 파일 / 요청 | 역할 |
| --- | --- |
| `app/api/auth/[...all]/route.js` / GET·POST `/api/auth/*` | Better Auth의 Next.js 핸들러 연결 |
| `app/login/route.js` / POST `/login` | 로그인 폼 수신, 이메일 로그인, 인증 쿠키 전달, 성공·실패에 따른 303 이동. 개발용 간편 로그인 별칭 처리 |
| `app/api/groups/route.js` / POST `/api/groups` | 로그인 확인 후 모임 생성. 모임 ID와 개별 초대 경로 반환 |
| `app/api/groups/[groupId]/route.js` / POST `/api/groups/:groupId` | `action`에 따라 영수증 저장·삭제, 개별 상태 변경, 정산 완료, 초대 링크 발급 |
| `app/api/invites/[token]/route.js` / POST `/api/invites/:token` | 모임 참여 처리. 비회원이면 HttpOnly 게스트 쿠키 발급 |
| `app/api/ocr/route.js` / POST `/api/ocr?groupId=...` | 접근 권한·진행 상태·파일 검사, 개발용 랜덤 데이터 또는 CLOVA 호출, 파싱 결과 반환 |
| `app/api/client-errors/route.js` / POST `/api/client-errors` | 개발 환경에서 같은 출처의 클라이언트 오류를 받아 서버 콘솔과 로그 파일에 기록. 운영 환경에서는 404 |

모임 API의 action은 `saveReceipt`, `deleteReceipt`, `setPaymentStatus`, `completeSettlement`, `createInvites`이다. 화면에서 버튼을 숨기는 것과 별개로 서버에서도 참여자·소유자·총대·모임 상태를 확인한다.

### 공통 로직

| 파일 | 역할 |
| --- | --- |
| `lib/db.js` | `MONGODB_URI`, `MONGODB_DB`로 MongoClient와 DB 객체 생성. 개발 중 globalThis에 클라이언트를 재사용. `connectDb`, `close` 제공. 서버 전용 모듈 |
| `lib/auth.js` | Better Auth 설정, Mongo 어댑터, 이메일·비밀번호 인증, `nextCookies`, 요청 안에서 캐시되는 `getSession` |
| `lib/groups.js` | 모임·초대·게스트 세션·영수증·payment의 핵심 DB 로직. 문자열·숫자·참여자 검증, 권한 확인, 트랜잭션, 응답 오류 변환 |
| `lib/group-state.mjs` | 대기 여부, 완료 여부, 총대의 완료 가능 여부를 판단하는 공통 함수 |
| `lib/guest-session.mjs` | 모임별 게스트 쿠키 이름과 읽기를 통일. 기존 단일 쿠키도 호환해서 읽음 |
| `lib/settlement.mjs` | 원 단위 분할 `splitAmount`, 참여자별 영수증 필터, 부담액·결제액·잔액·송금 안내 계산, payment 금액 계산 |
| `lib/clova-ocr.mjs` | General OCR의 글자 좌표를 행으로 묶고 상품명·수량·가격을 추출. Document OCR 형태의 receipt 응답도 파싱 가능. 랜덤 목업 선택 함수 포함 |
| `lib/client-log.mjs` | 로그 내 토큰·비밀번호 등 마스킹, `sendBeacon`으로 개발 서버에 오류 전송. 페이지 모듈 기준 최대 20회 전송 |
| `instrumentation-client.js` | 브라우저 error와 unhandledrejection 이벤트를 등록해 오류 수집 함수로 전달 |

`lib/groups.js`의 대표 함수는 `createGroup`, `listGroups`, `getGroupViewer`, `getGroupBoard`, `getInvitePreview`, `joinGroup`, `saveReceipt`, `deleteReceipt`, `setPaymentStatus`, `completeSettlement`, `createInvites`이다.

### 데이터·테스트·설정·문서

| 파일 / 폴더 | 역할 |
| --- | --- |
| `seed/clova_general_raw_90_array.json` | 저장된 General OCR 응답 90개. 개발 환경의 사진 선택 목업과 파서 테스트에 사용. DB를 자동 초기화하는 스크립트는 아님 |
| `tests/clova-ocr.test.mjs` | Document 응답·General 좌표·랜덤 목업·GS25 식별번호 오인식·할인 후 합계 회귀 테스트. GS25 사례는 사진 기반 합성 응답 |
| `tests/settlement.test.mjs` | 사용자별 영수증 필터 및 정산 금액 보존 검사 |
| `tests/group-state.test.mjs` | 대기·완료 상태와 총대 완료 권한 검사 |
| `tests/guest-session.test.mjs` | 두 모임의 게스트 접속 정보 분리, 기존 쿠키 호환 회귀 검사 |
| `tests/client-log.test.mjs` | 로그의 초대 링크·비밀값 마스킹 검사 |
| `logs/client-errors.log` | 개발 중 수집되는 브라우저 오류 JSON Lines. Git 제외 |
| `.next/` | Next.js 생성 결과·개발 로그·캐시. 직접 편집할 소스가 아님 |
| `package.json` | 앱 의존성·실행 명령 |
| `package-lock.json` | npm 의존성의 해석된 버전 고정 |
| `next.config.mjs` | 현재 `allowedDevOrigins: ["192.168.0.240"]` 설정 |
| `jsconfig.json` | `@/*` 경로를 프로젝트 루트에 연결 |
| `eslint.config.mjs` | Next.js core-web-vitals 기반 검사와 생성 파일 제외 |
| `.gitignore` | 의존성·빌드·로그·환경 변수 파일 등 Git 제외 |
| `.env.local` | 실행용 환경 변수. 비밀값이 있어 문서에 실제 값은 기록하지 않음 |
| `README.md` | 기본 Next.js 시작 안내가 남아 있음 |
| `docs/README.md` | 서비스 요구사항·화면 설계·DB 정의. 과거 설계 설명도 포함하므로 현재 동작은 코드와 함께 확인 |
| `AGENTS.md` | AI 작업 시 설치된 Next.js 로컬 문서를 먼저 확인하도록 하는 지침 |
| `CLAUDE.md` | `AGENTS.md` 참조 |
| `project.md` | 현재 코드 기준 프로젝트 구조와 동작을 설명하는 이 문서 |

## 4. 데이터 구조

MongoDB에서는 SQL 컬럼 대신 문서의 필드로 데이터를 저장한다. 아래는 코드가 생성·사용하는 주요 필드이며 Atlas 스키마 검증기·인덱스 실사 결과는 아니다.

| 컬렉션 | 주요 필드 및 목적 |
| --- | --- |
| Better Auth 인증 컬렉션 | user·account·session 등은 Better Auth Mongo 어댑터가 관리. 앱이 user 문서에 평문 비밀번호를 직접 넣는 구조가 아님 |
| `expense_group` | `_id`, `name`, `created_by`, `mode`, `status`, `expected_member_count`, `activated_at`, `settlement_completed_at`, `member_ids`, `created_at` |
| `group_member` | `_id`, `group_id`, `user_id`, `nickname`, `member_type`. 회원은 registered, 비회원은 guest |
| `receipts` | `_id`, `group_id`, `store_name`, `total_amount`, `paid_by_member_id`, `uploaded_by_member_id`, `items`, `created_at`, `updated_at` |
| `receipts.items[]` | `_id`, `menu_name`, `quantity`, `unit_price`, `line_total`, `consumer_member_ids`. 메뉴는 별도 expense_item 컬렉션이 아닌 영수증 내부 배열 |
| `payment` | `_id`, `group_id`, `receipt_id`, `expense_item_id`, `payer_member_id`, `payee_member_id`, `status`, `created_at`. 상태 갱신 시 `updated_at` |
| `group_invite` | `_id`, `group_id`, `token_hash`, `used_at`, `used_by_member_id`, `revoked_at`, `created_at`, `expires_at` |
| `guest_session` | `_id`, `group_id`, `member_id`, `token_hash`, `created_at`, `expires_at` |

도메인 데이터의 새 ID는 주로 UUID 문자열이다. 인증 회원 ID 참조는 기존 문자열/ObjectId 차이를 일부 조회에서 `idVariants`로 수용한다.

참조 관계: `expense_group → group_member / receipts / group_invite`, `receipts.items[]._id ← payment.expense_item_id`, `group_member._id ← consumer_member_ids / payer_member_id / payee_member_id / guest_session.member_id`.

`payment`는 메뉴별 참여자 한 명당 한 문서다. 금액 amount는 저장하지 않고 메뉴 금액과 참여자 목록으로 계산한다. 영수증 저장 시 관련 payment를 트랜잭션으로 다시 구성하며 기존 항목·지불자·수취자 조합의 상태는 유지한다. 직접 결제한 본인 몫은 paid로 초기화된다.

## 5. 주요 동작 흐름

### 로그인과 초대

1. 서버 페이지가 Better Auth 세션을 확인한다.
2. 로그인은 `/login`에 일반 HTML 폼으로 전송한다. 회원가입·로그아웃은 Better Auth React 클라이언트를 사용한다.
3. TOGETHER 생성 시 총대를 제외한 인원수만큼 1회용 초대 링크를 만든다.
4. 초대 토큰 원문은 URL로 전달하고 DB에는 SHA-256 해시를 저장한다. 유효기간은 7일이다.
5. 초대 참여를 트랜잭션에서 처리하고 링크 사용 시각·참여자를 기록한다. 비회원에게는 30일 게스트 세션 쿠키를 발급한다.
6. 마지막 예정 인원이 참여하면 WAITING에서 ACTIVE로 전환한다. 대기 화면은 5초마다 서버 데이터를 갱신한다.

개별 링크는 특정 이메일에 묶인 초대가 아니라 **먼저 사용한 한 명이 차지하는 링크**다. 재발급하면 기존 미사용 링크가 폐기된다. 게스트 쿠키는 `dutchpay_guest_<groupId>`로 모임별로 분리해서 다른 모임 참여 시 덮어쓰지 않는다. 기존 `dutchpay_guest`도 대체 값으로 읽으며, 서버는 토큰·모임 ID·만료일을 함께 검증한다. 이미 브라우저에서 사라진 과거 토큰을 자동 복원하지는 않는다. 쿠키는 브라우저/호스트별 저장이므로 localhost와 LAN IP 또는 다른 브라우저 간에 자동 공유되지 않는다.

### 영수증 입력과 OCR

1. `ReceiptEditor`에서 수동 입력하거나 사진을 고른다. 미리보기는 브라우저 Blob URL을 사용하고 해제 시 정리한다.
2. `/api/ocr`는 그룹 접근·진행 상태와 JPG/PNG·10MB 제한을 검사한다.
3. 개발 환경의 `source=photo`는 90개 저장 응답에서 랜덤 데이터를 가져온다. 카메라 경로와 운영 환경 사진 경로는 CLOVA를 호출한다.
4. CLOVA 요청은 서버에서 HTTPS Invoke URL과 Secret을 사용하며 30초 제한을 둔다.
5. General 응답의 boundingPoly 좌표를 행으로 묶어 상품명·수량·금액을 추출한다. 가격은 엄격한 숫자 형식을 사용하고 상품으로 볼 수 없는 행은 제외한다.
6. 결과를 가게명·메뉴명·수량·단가에 반영한다. 소비자는 일단 본인으로 선택되므로 실제 먹은 사람을 확인해야 한다.
7. OCR 결제액과 입력 메뉴 합계가 다르면 차이를 표시하고 저장 전 확인한다. 총액을 못 읽었으면 비교 안내를 표시한다.
8. 저장 API는 수량·단가·메뉴 수·참여자 소속을 검사하고 line_total 및 total_amount를 서버에서 다시 계산한다.

현재 수량이 없는 General 상품 행은 임의로 1개를 추정하지 않고 제외한다. General 행 금액 후보는 1원 이상 1천만원 이하로 제한한다. 수량으로 나누어 원 단위 단가가 나오지 않는 행도 제외한다. 따라서 애매한 영수증은 수동 확인이 필요하다.

**OCR 결제액은 편집 화면의 비교 상태이며 DB에 별도로 보존하지 않는다.** 저장되는 `receipts.total_amount`는 입력 메뉴 합계다. 할인은 자동 배분하지 않으며 사용자가 단가를 수정하거나 차이를 확인하고 현재 금액으로 저장하는 방식이다. 사진과 원본 CLOVA 응답을 보관하는 서버 저장소도 현재 없다.

### 정산과 권한

- 서버에서 업로더와 결제자를 현재 참여자로 고정한다. 영수증 수정·삭제는 업로더 본인만 가능하다.
- 화면에 들어오면 본인 결제 영수증이 기본 선택되고 참여자 카드를 누르면 그 사람의 영수증으로 전환한다.
- 상세 화면의 먹은 사람은 읽기 전용이다. 변경은 소유자의 수정 모달에서 한다.
- 각 메뉴의 금액을 중복 제거한 참여자에게 나눈다. 나머지 1원은 참여자 선택 순서 앞사람부터 배분한다.
- `결제액 − 부담액`이 양수면 받을 금액, 음수면 보낼 금액이다. 채권자·채무자를 금액순으로 연결해 송금 안내를 만든다. 모든 경우에 송금 횟수의 수학적 최솟값을 보장하는 최적화 알고리즘은 아니다.
- 총대만 완료 버튼을 볼 수 있고 서버에서도 총대를 검사한다. 완료 시 `settlement_completed_at`에 시간을 저장한다. `status`를 COMPLETED로 바꾸는 구조는 아니다.
- 완료 후 영수증 추가·수정·삭제·OCR·개별 상태 변경을 서버에서 차단하고 화면의 추가·수정 버튼도 숨긴다.

**사용자별 영수증 표시는 현재 클라이언트 필터다.** `getGroupBoard`는 참여 권한을 확인한 뒤 해당 모임의 전체 영수증을 클라이언트에 전달한다. 다른 참여자의 영수증 자체를 비공개로 만드는 서버 접근 제한은 아니다.

## 6. 환경 변수

| 이름 | 용도 |
| --- | --- |
| `MONGODB_URI` | MongoDB 연결 URI. 서버 전용 비밀값 |
| `MONGODB_DB` | 사용할 데이터베이스 이름 |
| `BETTER_AUTH_URL` | 인증 기준 URL. 미설정 시 코드 기본값 localhost:3000 |
| `BETTER_AUTH_SECRET` | Better Auth에서 사용하는 인증 비밀값 |
| `NEXT_PUBLIC_APP_URL` | 공유 초대 링크의 기준 URL. 브라우저에 공개되는 값 |
| `CLOVA_OCR_INVOKE_URL` | 서버가 호출할 CLOVA OCR HTTPS 주소 |
| `CLOVA_OCR_SECRET` | CLOVA 요청 인증 Secret. 서버 전용 |
| `DEMO_ACCOUNT_EMAIL`, `DEMO_ACCOUNT_PASSWORD` | 개발용 간편 로그인 별칭을 실제 테스트 계정 자격 증명으로 변환 |
| `NODE_ENV` | 개발·운영에 따른 목업·로그·쿠키·테스트 로그인 분기 |

실제 비밀번호·URI·Secret은 이 문서에 복사하지 않는다. `.env*`는 Git 제외 대상이다. Better Auth의 현재 설정에는 별도 `trustedOrigins` 목록이 명시되어 있지 않다.

## 7. 실행·검사·로그

프로젝트 루트에서 실행한다.

```bash
npm ci
npm run dev
```

같은 네트워크의 휴대폰에서 접속할 개발 서버를 명시적으로 바인딩하려면:

```bash
npm run dev -- --hostname 0.0.0.0
```

접속 주소는 실행 중인 컴퓨터의 LAN IP와 포트다. `0.0.0.0`은 서버가 수신할 인터페이스 설정이고 `allowedDevOrigins`의 허용 출처 설정과는 다르다. LAN IP가 바뀌면 공유 URL·인증 URL·개발 출처 설정도 확인한다.

```bash
npm run lint
npm test
npm run build
npm start
```

`npm start`는 빌드 후 운영 서버를 실행한다. 모임 데이터 변경은 MongoDB 트랜잭션을 사용하므로 replica set 또는 이를 지원하는 Atlas 환경이 필요하다. Better Auth 어댑터의 `transaction: false`와 도메인 로직의 트랜잭션 사용은 별개의 설정이다.

VS Code 터미널에서 클라이언트 오류를 실시간으로 보려면:

```bash
npm run logs:client
```

서버 출력은 개발 서버 터미널에서 확인한다. 클라이언트 로그는 `logs/client-errors.log`에 기록되고 개발 환경에서만 수집된다. Next 개발 로그가 생성된 경우 `.next/dev/logs/next-development.log`에서도 hydration 경고 등을 확인할 수 있다. 모든 요청·모든 동작을 기록하는 감사 로그나 운영 모니터링 시스템은 아니다.

## 8. 현재 구현의 경계와 유지보수 포인트

- 총대의 전체 정산 완료와 payment의 개별 paid/unpaid는 별개다. 상세 체크박스 UI는 제거됐지만 개별 상태 변경 API와 DB 문서는 남아 있다.
- SOLO 설명에는 총대가 전체를 정리한다고 되어 있지만 현재 저장 로직은 모든 모드에서 결제자를 본인으로 고정한다. 다른 사람이 결제한 영수증을 총대가 대신 입력하는 기능은 제공하지 않는다.
- 사진 선택은 개발 중 랜덤 목업이다. 실제 사진 인식을 시험할 때 입력 경로를 구분해야 한다.
- OCR 회귀 테스트의 GS25 데이터는 사진을 보고 구성한 합성 좌표 응답이며 원본 사진을 재호출한 테스트가 아니다. 90개 저장 응답을 검사했을 때 50개가 파싱되고 40개가 거절됐다. 이는 상품 정답 정확도 지표가 아니다.
- 정산 계산은 입력 메뉴 금액에 의존한다. 할인·누락을 확인하지 않고 차이가 있는 합계로 저장하면 해당 합계로 정산된다.
- 토큰 만료는 조회 조건에서 검사한다. 소스에 컬렉션 인덱스/TTL을 자동 생성하는 코드가 없으므로 Atlas에 이미 설정된 인덱스의 존재 여부는 별도 확인 대상이다.
- 기본 README와 상세 설계 문서에 과거 설명이 남을 수 있다. 변경 시 실제 구현과 이 문서의 흐름·필드 설명을 함께 갱신한다.

## 9. 수정하려는 기능별 시작점

| 수정할 내용 | 먼저 볼 파일 |
| --- | --- |
| 로그인·인증 쿠키 | `lib/auth.js`, `app/login/route.js`, `component/HomeClient.js` |
| 모임 생성·대기·초대 | `lib/groups.js`, `component/HomeClient.js`, `component/InviteClient.js`, `lib/group-state.mjs` |
| OCR 결과가 잘못 입력됨 | `lib/clova-ocr.mjs`, `tests/clova-ocr.test.mjs`, `app/api/ocr/route.js` |
| 사진 선택·미리보기·입력 모달 | `component/BoardClient.js`의 `ReceiptEditor` |
| 영수증 저장·소유권 | `lib/groups.js`의 `normalizeReceipt`, `assertReceiptOwner`, `saveReceipt` |
| 나눗셈·송금 안내 금액 | `lib/settlement.mjs`, `tests/settlement.test.mjs` |
| 모임 정산 완료 | `lib/group-state.mjs`, `lib/groups.js`의 `completeSettlement`, `component/BoardClient.js` |
| 모바일 화면·스타일 | `app/globals.css` |
| 브라우저 오류 수집 | `instrumentation-client.js`, `lib/client-log.mjs`, `app/api/client-errors/route.js` |
