@echo off
:: Claude.ai 자동 연결을 위한 Chrome 시작 스크립트
:: 이 파일로 Chrome을 실행하면 대시보드가 세션 키를 자동으로 가져옵니다.
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
