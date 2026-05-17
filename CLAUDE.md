# my-dashboard 프로젝트 지침

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
# 백그라운드 실행
Start-Process python -ArgumentList "stock_mcp_server.py" -WorkingDirectory "d:\MyWork\my-dashboard" -WindowStyle Hidden
```

또는 터미널에서:
```
python d:\MyWork\my-dashboard\stock_mcp_server.py
```

### MCP 서버 제공 기능
- `stocks.watchlist` — Yahoo Finance 주식 시세 (API 키 불필요)
- `weather.current` — wttr.in 현재 날씨 (API 키 불필요)
- `weather.forecast` — Open-Meteo 7일 예보 (API 키 불필요)
- `imap.inbox` — IMAP 메일 조회 (Gmail 앱 비밀번호, Naver 등)

### 설정
- 포트: `http://127.0.0.1:8765/mcp`
- 데이터 연결 방식: `MCP` 모드

## 개발 서버

```powershell
npm run dev  # Vite dev server → http://localhost:5173
```
