# my-dashboard Installation Manual

This guide is for setting up the dashboard on a new Windows PC after cloning the repository.

## 1. Prerequisites

Install these first:

- Git for Windows
- Python 3.10 or newer, with `python` added to `PATH`
- Node.js LTS, with `npm` added to `PATH`
- Optional: Google Chrome, only for the Claude browser bridge

Check from Command Prompt:

```bat
git --version
python --version
npm --version
```

## 2. Quick Install

```bat
git clone <repo-url>
cd my-dashboard
install.bat
start_dashboard.bat
```

Open [http://localhost:5173](http://localhost:5173).

`install.bat` performs these steps:

- Creates `.venv`
- Installs Python packages from `requirements.txt`
- Installs Node packages from `package-lock.json`
- Runs a production build check

## 3. Manual Install

Use this if you prefer to run each step yourself.

```bat
git clone <repo-url>
cd my-dashboard
python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
npm install
npm run build
```

Start the dashboard:

```bat
npm run dev
```

Or use the startup helper:

```bat
start_dashboard.bat
```

## 4. Services And Ports

Default startup is lightweight.

| Service | Port | Started by default | Purpose |
| --- | ---: | --- | --- |
| Vite dashboard | 5173 | Yes | React dashboard UI |
| MCP server | 8765 | Yes | Stocks, weather, RSS, AI news, PDF/web/local file summary |
| TTS helper | 8767 | No | Optional Windows SAPI TTS helper |
| Mental Avatar API | 8766 | If project exists | Separate `mental-avatar` project API |
| Mental Avatar frontend | 5174 | If project exists | Embedded avatar app at `http://localhost:5174/` |

## 5. Optional Startup Modes

Start optional TTS helper with `npm run dev`:

```bat
set START_TTS=1
npm run dev
```

Start optional Mental Avatar extras from `start_dashboard.bat`:

```bat
set START_AVATAR_EXTRAS=1
start_dashboard.bat
```

The Mental Avatar API on port 8766 and frontend on port 5174 are started by default only when the `mental-avatar` project is found.
`START_AVATAR_EXTRAS=1` additionally starts heavier extras such as the XTTS worker and watcher.

Start optional Claude browser bridge:

```bat
set START_CLAUDE_BROWSER=1
start_dashboard.bat
```

By default, the helper looks for `mental-avatar` next to `my-dashboard`, for example:

```text
D:\MyWork\
  my-dashboard\
  mental-avatar\
```

If it lives elsewhere, set:

```bat
set MENTAL_AVATAR_ROOT=C:\path\to\mental-avatar
```

## 6. Verify Installation

Dashboard page:

```bat
curl http://localhost:5173
```

MCP tools:

```bat
curl -X POST http://127.0.0.1:8765/mcp -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}"
```

MCP health:

```bat
curl http://127.0.0.1:8765/health
```

Production build:

```bat
npm run build
```

## 7. Common Problems

Python is not found:

- Reinstall Python and enable "Add python.exe to PATH".
- Open a new Command Prompt after installation.

npm is not found:

- Install Node.js LTS.
- Open a new Command Prompt after installation.

MCP server fails to start:

```bat
call .venv\Scripts\activate.bat
python stock_mcp_server.py
```

Port already in use:

```bat
netstat -ano | findstr ":5173"
netstat -ano | findstr ":8765"
netstat -ano | findstr ":8766"
```

Then stop the listed PID if it is an old dashboard process:

```bat
taskkill /PID <PID> /F
```

PDF extraction quality is poor:

- Confirm `pypdf` installed successfully.
- Re-run `python -m pip install -r requirements.txt` inside `.venv`.

Mental Avatar does not start:

- Confirm `MENTAL_AVATAR_ROOT` points to the folder that contains `api\server.py`.
- Confirm the avatar project has its own Python and Node dependencies installed.
- The dashboard can still run without it.

## 8. Backup And Restore On A New PC

On the old PC:

1. Open the dashboard.
2. Go to Settings -> Data -> Full Backup / Restore.
3. Click `Backup Export (JSON)`.

On the new PC:

1. Install and start the dashboard.
2. Go to Settings -> Data -> Full Backup / Restore.
3. Select the exported `dashboard-backup-YYYY-MM-DD.json`.
4. Refresh the page after restore completes.

If restore causes a problem, use `Restore latest pre-restore state` in the same section.

## 9. Update Existing Install

```bat
git pull
call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt
npm install
npm run build
start_dashboard.bat
```

## 10. Files Added For Installation

- `requirements.txt`: Python packages for MCP/TTS helpers
- `install.bat`: one-command Windows setup
- `INSTALL.md`: this manual
- `start_dashboard.bat`: starts dashboard services
- `start_mcp_server.bat`: starts only the MCP server
- `start_vite_server.bat`: starts only the Vite dashboard
- `start_mental_avatar_api.bat`: starts optional Mental Avatar API
- `start_chrome.bat`: starts Chrome for the optional Claude browser bridge
