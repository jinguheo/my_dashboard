# my-dashboard 프로젝트 지침

## 작업 완료 응답 규칙 (매번 필수)

작업이 끝날 때마다 응답 마지막에 반드시 아래를 포함하세요:

```
대시보드: [http://localhost:5173](http://localhost:5173)
```

마크다운 링크 형식으로 표기해 클릭 시 새 창에서 열리도록 합니다. 예외 없이 모든 작업 완료 시 표기합니다.

---

## 채팅 로그 실시간 백업 (세션 내내 필수)

### 기록 시점
대화 중 아래 상황이 발생하면 **즉시** 해당 날짜 파일에 기록합니다:
- 사용자 요청을 받았을 때
- 작업을 완료했을 때
- 중요한 결정이나 오류가 발생했을 때

### 파일 경로
```
C:\Users\oem\.claude\projects\d--MyWork-my-dashboard\memory\chatting_log\YYYY-MM-DD.md
```

### 기록 형식
```markdown
## HH:MM

**사용자:** [요청 내용 요약]

**작업:** [수행한 내용]

**결과:** [성공/실패/결정 사항]
```

### 규칙
- 파일이 없으면 새로 생성합니다 (Write 툴 사용)
- 파일이 있으면 맨 아래에 추가합니다 (Read 후 Write)
- MEMORY.md의 "채팅 로그 최신" 항목도 함께 갱신합니다

---

## 세션 복원 (세션 시작 시 필수)

새 세션이 시작되면 아래 순서로 실행하세요:

### 1단계: 최신 chatting_log 자동 로드
```
C:\Users\oem\.claude\projects\d--MyWork-my-dashboard\memory\chatting_log\
```
가장 최근 날짜 파일을 Read 툴로 읽습니다.

### 2단계: MEMORY.md 확인
```
C:\Users\oem\.claude\projects\d--MyWork-my-dashboard\memory\MEMORY.md
```

### 3단계: 사용자에게 보고
이전 세션 요약과 남은 과제를 한국어로 보고합니다.

---

## MCP 서버 자동 확인 (세션 시작 시 필수)

새 세션이 시작되면 **항상** 아래 순서로 MCP 서버를 확인하고 실행하세요.

### 확인 방법
```powershell
# 1. 포트 8765 사용 여부 확인
netstat -ano | Select-String ":8765"

# 2. 응답 테스트
curl -s -X POST http://127.0.0.1:8765/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### 실행 방법 (서버가 없을 때)
```powershell
Start-Process python -ArgumentList "stock_mcp_server.py" -WorkingDirectory "d:\MyWork\my-dashboard" -WindowStyle Hidden
```

### MCP 서버 제공 기능
- `claude.capture_session` — Playwright 브라우저 열어 Claude.ai 세션 키 자동 추출
- `stocks.watchlist` — Yahoo Finance 주식 시세 (API 키 불필요)
- `weather.current` — wttr.in 현재 날씨 (API 키 불필요)
- `weather.forecast` — Open-Meteo 7일 예보 (API 키 불필요)
- `imap.inbox` — IMAP 메일 조회 (Gmail 앱 비밀번호, Naver 등)

### 설정
- MCP 포트: `http://127.0.0.1:8765/mcp`
- 데이터 연결 방식: `MCP` 모드

---

## 개발 서버

```powershell
npm run dev  # Vite dev server → http://localhost:5173
```
