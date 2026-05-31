# Journal 뷰 + mental-avatar 연동 설계

**날짜:** 2026-05-31  
**상태:** 승인됨

---

## 개요

짧은 일상·업무·리뷰 기록을 카드로 쌓고, 누적 기록을 매일 자정 자동으로 mental-avatar에 전송해 성향 분석 결과를 상단 배너에 표시하는 저널 뷰.

---

## 레이아웃

**분석 배너 상단 고정 + 카드 그리드형 (C안)**

```
┌─────────────────────────────────────────────┐
│ ✦ 나 분석  [효율 지향형] [시각 스토리 선호] │  ← 상단 고정 배너
├─────────────────────────────────────────────┤
│ [입력창]  내용...                           │
│ [업무][일상][영화][책][음악][운동][식사][기타] [✦자동태그] [저장] │
├─────────────────────────────────────────────┤
│ [카드] [카드] [카드]                        │  ← 3열 그리드
│ [카드] [카드] [카드]                        │
└─────────────────────────────────────────────┘
```

---

## 컴포넌트

### 1. 분석 배너 (`JournalAnalysisBanner`)
- 상단 고정, 배경 `#f0fdf4`, 테두리 `#bbf7d0`
- `✦ 나 분석` 레이블 + 키워드 태그 나열 (초록색 pill)
- 우측에 "어제 분석 · 다음 자정 갱신" 텍스트
- 분석 결과 없으면 "아직 분석 없음 — 기록이 쌓이면 자동 분석됩니다" 표시

### 2. 입력창 (`JournalEntryForm`)
- 텍스트 영역 (자동 높이, min 56px)
- 고정 태그 8개: 업무 / 일상 / 영화 / 책 / 음악 / 운동 / 식사 / 기타
  - 선택 시 배경 `#111827` 흰 글씨로 활성화
- Claude 자동 추천 태그 (보라색 `#ede9fe`): 내용 입력 후 500ms 디바운스로 MCP `claude.chat` 호출, 태그 1~3개 추천
- 저장 버튼: 내용 비어있으면 비활성화

### 3. 카드 그리드 (`JournalCard`)
- 3열 그리드 (모바일 1열)
- 각 카드: 태그(색상 구분) + 날짜 + 내용 + Claude 자동 태그(보라색)
- 태그별 배경색:
  - 업무: `#fef3c7` / 일상: `#f0fdf4` / 영화: `#dbeafe` / 책: `#fce7f3`
  - 음악: `#fdf4ff` / 운동: `#dcfce7` / 식사: `#fef9c3` / 기타: `#f3f4f6`
- 카드 클릭 시 편집 모달

---

## 데이터 구조 (localStorage)

**키:** `dash-journal-entries`

```ts
interface JournalEntry {
  id: string           // uuid
  content: string      // 본문
  tags: string[]       // 선택된 고정 태그
  autoTags: string[]   // Claude 자동 추천 태그
  createdAt: string    // ISO 8601
}
```

**키:** `dash-journal-analysis`

```ts
interface JournalAnalysis {
  keywords: string[]   // 분석 키워드
  analyzedAt: string   // ISO 8601 (마지막 분석 시각)
}
```

---

## 자동 분석 (매일 자정)

### 트리거
- `useEffect` + `setInterval`로 자정(00:00) 감지
- 앱이 켜져 있을 때만 실행 (백그라운드 없음)
- 마지막 분석 날짜가 오늘이면 스킵

### 흐름
1. localStorage에서 최근 30일 기록 수집
2. mental-avatar `/ingest` POST — 기록들을 텍스트로 전송
3. mental-avatar `/profile/analysis` GET — 분석 결과 수신
4. 키워드 파싱 → `dash-journal-analysis`에 저장
5. 배너 즉시 업데이트

### `/ingest` 페이로드
```json
{
  "text": "2026-05-31 [운동] 오늘 30분 달리기...\n2026-05-31 [식사] 점심에 된장찌개...",
  "source": "journal",
  "metadata": { "date": "2026-05-31" }
}
```

---

## Claude 자동 태그 추천

- 입력창에 내용 작성 후 500ms 디바운스
- MCP `claude.chat` 호출, 프롬프트:  
  `"다음 짧은 기록에 어울리는 한국어 태그를 1~3개만 단어로 답해줘 (쉼표 구분): {content}"`
- 응답 파싱 → 보라색 pill로 입력창 하단에 표시
- 클릭 시 선택/해제, 저장 시 `autoTags`에 포함

---

## 사이드바 연동

`src/components/Sidebar.tsx`의 `nav` 배열에 항목 추가:
```ts
{ id: 'journal', label: '저널', icon: '✍' }
```

`src/types.ts`의 `View` 타입에 `'journal'` 추가.

---

## 파일 구조

```
src/
  views/
    Journal.tsx          # 메인 뷰 (배너 + 입력 + 그리드)
  store/
    useJournal.ts        # localStorage 상태 훅
  services/
    journalAnalysis.ts   # mental-avatar 연동, 자정 스케줄러
```

---

## mental-avatar 연동 엔드포인트

| 목적 | 메서드 | URL |
|------|--------|-----|
| 기록 전송 | POST | `http://localhost:8766/ingest` |
| 분석 요청 | GET | `http://localhost:8766/profile/analysis` |

---

## 범위 외

- 기록 검색/필터 (추후)
- 모바일 반응형 (추후)
- 기록 내보내기 (추후)
