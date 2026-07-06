# 임상시험약국 모니터링 예약 — Notion DB 설정

> 이 문서 전체를 복사(Ctrl+A → Ctrl+C)한 뒤 Notion 새 페이지에 붙여넣으세요.
> 표·체크리스트가 Notion 블록으로 변환됩니다.

---

## ✅ 설정 체크리스트

- [ ] Notion Integration 생성 (Internal)
- [ ] API Token(`secret_...`) 복사
- [ ] 아래 표대로 **전체 페이지 데이터베이스** 생성
- [ ] DB 페이지 → `···` → **Connections** → Integration 연결
- [ ] DB URL에서 Database ID 복사
- [ ] `.env` 또는 Vercel 환경 변수 등록

---

## 📋 DB 속성 목록 (이름·타입 그대로 입력)

| 속성명 | 타입 | 설정 |
| --- | --- | --- |
| 이름 | Title | 기본 Title 속성 사용 |
| 예약 시간 | Date | **Include time(시간 포함)** 켜기 |
| 룸 | Select | 옵션 3개 (아래 참고) |
| 이메일 | Email | — |
| 연락처 | Phone | — |
| 소속 | Text | — |
| 방문 목적 | Text | — |
| Protocol No. | Text | — |
| IRB No. | Text | — |
| 상태 | Select | 옵션 2개 (아래 참고) |
| 취소 토큰 | Text | — |
| Google 이벤트 ID | Text | Google Calendar 미사용 시 비워둠 |
| 예약 ID | Text | — |

---

## 🏷️ Select 옵션 (복사해서 그대로 추가)

### 룸

```
2인석 A
2인석 B
1인석
```

### 상태

```
확정
취소
```

---

## 🔗 Integration 연결

1. DB 페이지 우측 상단 **`···`** 클릭
2. **Connections** (연결) 선택
3. 만든 Integration 선택 (예: `임상시험약국 예약`)

> 연결하지 않으면 API가 DB에 접근할 수 없습니다.

---

## 🆔 Database ID 찾기

DB 페이지 주소 예시:

```
https://www.notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
```

`notion.so/` 뒤 **32자리 ID** → `NOTION_DATABASE_ID`에 입력

---

## 🔐 환경 변수

| 변수 | 값 |
| --- | --- |
| NOTION_API_TOKEN | Integration Secret (`secret_...`) |
| NOTION_DATABASE_ID | DB ID |
| ADMIN_PASSWORD | 관리자 페이지 비밀번호 |

---

## ⚠️ 주의

- 속성 **이름·타입·Select 옵션**은 위와 동일해야 합니다.
- DB 페이지 제목·속성 순서·보기(View)는 자유입니다.
- Google Calendar를 쓰지 않으면 `Google 이벤트 ID`는 비워둬도 됩니다.
