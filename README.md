# DutchPay

모임 영수증을 모으고, 메뉴별 참여자를 기준으로 정산 금액을 계산하는 Next.js 프로젝트입니다.

## 로컬 실행 준비

- Node.js 20.19 이상
- MongoDB Community Server
- npm

MongoDB Compass만 설치한 경우에는 `mongod` 실행 파일이 없을 수 있습니다. Community Server가 설치되어 있어야 합니다.

## 빠른 시작

```bash
npm install
npm run seed
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)에 접속합니다.

테스트 로그인 계정:

```text
아이디: 1234
비밀번호: 1234
```

`.env.local`을 직접 만들 필요는 없습니다. 저장소의 `.env.development`가 로컬 개발 기본값을 제공합니다.

## Seed 명령

### `npm run seed`

서비스를 시연하거나 화면을 확인하기 좋은 실제 형태의 데모 데이터를 넣습니다.

- 성수 맛집 투어
- 주말 브런치 정산
- 제주도 우정 여행
- 망원 한강 피크닉

```bash
npm run seed
```

### `npm run testseed`

정산 로직과 여러 화면 상태를 직접 검증하기 위한 데이터를 넣습니다.

- 영수증 없는 모임
- 3인 균등 분할
- 1원 나머지 분할
- 항목별 참여자가 다른 영수증
- 여러 결제자 상계
- 회원과 게스트 혼합
- 일부 송금 완료
- 전체 정산 완료
- 다른 총대의 모임
- 1인 SOLO 정산

```bash
npm run testseed
npm run dev
```

> 주의: `seed`와 `testseed`는 로컬 `dutchpay_dev` DB 전체를 삭제한 뒤 선택한 데이터셋만 새로 저장합니다. 직접 만든 데이터와 로그인 세션도 모두 사라집니다.

따라서 반복 실행하거나 두 명령을 번갈아 실행해도 이전 데이터가 남거나 누적되지 않습니다.

두 명령은 안전을 위해 다음 로컬 DB에서만 실행됩니다.

```text
mongodb://127.0.0.1:27018/?replicaSet=dutchpay-rs
DB: dutchpay_dev
```

MongoDB는 프로젝트의 `.local/mongodb`에 데이터를 저장하며, 해당 폴더는 Git에 포함되지 않습니다.

## 자주 사용하는 명령

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run seed` | 실제 형태의 데모 데이터로 교체 |
| `npm run testseed` | 정산 검증 데이터로 교체 |
| `npm test` | 자동 테스트 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run build` | 배포 빌드 검사 |
| `npm run db:status` | 프로젝트 로컬 MongoDB 상태 확인 |
| `npm run db:stop` | 프로젝트 로컬 MongoDB 종료 |

## Atlas 연결

배포 환경에서는 로컬 설정 파일을 수정하지 않고 배포 서비스의 환경변수를 설정합니다.

```dotenv
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/
MONGODB_DB=dutchpay
BETTER_AUTH_SECRET=<충분히 긴 배포용 비밀키>
```

애플리케이션은 같은 환경변수 이름을 사용하므로 MongoDB 주소와 DB 이름만 교체하면 Atlas에 연결됩니다. `seed`와 `testseed`는 계속 로컬 DB만 사용하므로 실수로 Atlas 데이터를 덮어쓰지 않습니다.
