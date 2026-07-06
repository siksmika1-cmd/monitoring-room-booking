# 임상시험약국 모니터링 예약

외부 방문객용 모니터링 룸 예약 웹앱입니다. **독립 웹앱**으로도, **Notion 페이지 임베드**로도 사용할 수 있습니다.

## 기능

- **3개 룸**: 2인석 A, 2인석 B, 1인석 (관리자가 on/off 가능)
- **운영 시간**: 관리자 설정 (기본 09:00–16:00)
- **회원가입 없이 예약**: 이름·이메일·연락처 + 시간 선택
- **예약 확인·취소**: 예약 번호 + 이메일로 조회
- **듀얼 모드**: 독립 앱(전체 헤더) / Notion 임베드(컴팩트 UI)

## 독립 앱 vs Notion 임베드

| 용도 | URL | 설명 |
|------|-----|------|
| **독립 앱** | `https://your-app.vercel.app/` | 전체 네비게이션·관리자 페이지 포함 |
| **Notion 임베드** | `https://your-app.vercel.app/?embed=true` | 컴팩트 헤더, iframe 최적화 |

### Notion에 임베드하기

1. Notion 페이지에서 `/embed` 입력
2. 배포 URL + `?embed=true` 붙여서 추가  
   예: `https://your-app.vercel.app/?embed=true`
3. iframe 높이는 Notion에서 드래그로 조절 (권장: 700px 이상)

임베드 모드는 iframe 감지 또는 `?embed=true` 파라미터로 자동 전환됩니다.  
페이지 이동(예: 내 예약) 시에도 embed 파라미터가 유지됩니다.

### 관리자 페이지

- 독립 앱: `/admin` (헤더 → 관리)
- Notion 임베드: 보안상 **새 창으로 열기** 안내만 표시

## 기술 스택

- Frontend: React 19, TypeScript, Vite, Tailwind CSS 4
- Backend: Vercel Serverless Functions (`/api/bookings`)
- 저장소: Notion Database (필수, 프로덕션)
- 캘린더: Google Calendar API (선택)

## 빠른 시작 (로컬 개발)

Notion 설정 없이도 로컬에서 UI·예약 흐름을 테스트할 수 있습니다. `NOTION_API_TOKEN`이 없으면 **인메모리 저장소**가 자동으로 사용됩니다 (서버 재시작 시 데이터 초기화).

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:5173 을 엽니다.

## Notion DB 설정

### 1. Integration 생성

1. [Notion Integrations](https://www.notion.so/my-integrations)에서 Internal Integration 생성
2. API Token 복사 → `.env`의 `NOTION_API_TOKEN`

### 2. 데이터베이스 생성

아래 속성을 가진 **전체 페이지 데이터베이스**를 만듭니다.

| 속성명 | 타입 | 옵션/비고 |
|--------|------|-----------|
| 이름 | Title | |
| 예약 시간 | Date | 시간 포함 |
| 룸 | Select | `2인석 A`, `2인석 B`, `1인석` |
| 이메일 | Email | |
| 연락처 | Phone | |
| 소속 | Text | |
| 방문 목적 | Text | |
| 상태 | Select | `확정`, `취소` |
| 취소 토큰 | Text | |
| Google 이벤트 ID | Text | |
| 예약 ID | Text | |

속성명이 다르면 `server/notion.ts`의 `PROPS` 객체를 수정하세요.

### 3. DB 연결

1. DB 페이지 → `···` → **Connections** → Integration 연결
2. DB URL에서 database ID 복사 → `.env`의 `NOTION_DATABASE_ID`

### 4. 환경 변수

```bash
cp .env.example .env
```

`.env` 파일을 편집합니다:

```env
NOTION_API_TOKEN=secret_xxxxxxxx
NOTION_DATABASE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Google Calendar 연동 (선택)

1. Google Cloud Console에서 서비스 계정 생성
2. Calendar API 활성화
3. 캘린더를 서비스 계정 이메일과 **공유** (일정 변경 권한)
4. `.env`에 서비스 계정 정보 입력

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=booking-bot@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
```

## Vercel 배포

1. GitHub에 푸시 후 Vercel에 연결
2. Environment Variables에 `.env.example` 항목 등록
3. `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`는 `\n` 줄바꿈 그대로 입력

`vercel.json`에 Notion iframe 허용 CSP(`frame-ancestors`)가 설정되어 있습니다.

## API

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/bookings?action=availability&date=YYYY-MM-DD&roomId=room-2p-a` | 슬롯 조회 |
| GET | `/api/bookings?action=day&date=YYYY-MM-DD` | 해당일 전체 예약 |
| GET | `/api/bookings?action=lookup&bookingId=XXX&email=a@b.com` | 예약 조회 |
| POST | `/api/bookings` | 예약 생성 |
| POST | `/api/bookings` `{ action: 'cancel', bookingId, cancelToken }` | 예약 취소 |

## 스크립트

```bash
npm run dev      # 개발 서버 (API 미들웨어 포함)
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
npm run lint     # Oxlint
```

## 프로젝트 구조

```
src/           React 프론트엔드
server/        예약 비즈니스 로직, Notion/Google 연동
api/           Vercel Serverless 핸들러
vite-plugin-bookings-api.ts  로컬 dev API 미들웨어
```
