const POLL_URL = 'http://localhost:8765/bridge/poll';
const RESP_URL = 'http://localhost:8765/bridge/response';
const POLL_MS  = 800;

let polling = false;

async function callClaudeApi(req) {
  const { org_id, conv_id, body } = req;

  // 대화 생성
  await fetch(`https://claude.ai/api/organizations/${org_id}/chat_conversations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '', uuid: conv_id }),
  });

  // 완성 요청
  const r = await fetch(
    `https://claude.ai/api/organizations/${org_id}/chat_conversations/${conv_id}/completion`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'accept': 'text/event-stream' },
      body: JSON.stringify(body),
    }
  );

  if (!r.ok) throw new Error(`Claude API error: ${r.status}`);

  const text = await r.text();
  let full = '';
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const d = JSON.parse(line.slice(6));
      if (d.type === 'content_block_delta') full += d.delta?.text || '';
      else if (d.completion) full = d.completion;
    } catch (_) {}
  }
  return full;
}

async function getOrgId() {
  const r = await fetch('https://claude.ai/api/organizations', { credentials: 'include' });
  if (!r.ok) throw new Error('Claude.ai에 로그인되어 있지 않습니다.');
  const orgs = await r.json();
  return orgs[0]?.uuid;
}

async function poll() {
  try {
    const r = await fetch(POLL_URL, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return;
    const task = await r.json();
    if (!task || !task.id) return;

    try {
      // org_id가 없으면 가져오기
      if (!task.org_id) task.org_id = await getOrgId();
      const text = await callClaudeApi(task);
      await fetch(RESP_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: task.id, text, error: null }),
      });
    } catch (e) {
      await fetch(RESP_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: task.id, text: null, error: e.message }),
      });
    }
  } catch (_) {
    // MCP 서버 꺼져 있으면 조용히 무시
  }
}

function startPolling() {
  if (polling) return;
  polling = true;
  setInterval(poll, POLL_MS);
}

// 익스텐션 시작 시 폴링 시작
startPolling();
