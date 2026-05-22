#!/usr/bin/env python3
"""
주식 + 날씨 + IMAP 메일 MCP 브리지 서버
Yahoo Finance(주식) + wttr.in(날씨) + imaplib(메일)
실행: python stock_mcp_server.py
포트: http://127.0.0.1:8765/mcp
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import requests as req_lib
import logging
import imaplib
import email as email_lib
from email.header import decode_header as _dh
from email.utils import parsedate_to_datetime
from datetime import date as _date
import re as _re
import time as _time

app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

# ─── IMAP 메일 ───────────────────────────────────────────

def _decode(value):
    if not value:
        return ''
    parts = _dh(value)
    out = []
    for chunk, charset in parts:
        if isinstance(chunk, bytes):
            out.append(chunk.decode(charset or 'utf-8', errors='replace'))
        else:
            out.append(str(chunk))
    return ''.join(out)

def _parse_from(s):
    s = _decode(s)
    m = _re.match(r'^(.*?)\s*<([^>]+)>', s)
    if m:
        return (m.group(1).strip().strip('"') or m.group(2)), m.group(2)
    return s, s

def _fmt_date(d):
    try:
        dt = parsedate_to_datetime(d)
        return dt.strftime('%H:%M') if dt.date() == _date.today() else dt.strftime('%m/%d')
    except Exception:
        return d or ''

def _extract_snippet(msg, max_len=200):
    """MIME 메시지에서 텍스트 본문 추출 (base64/quoted-printable 디코딩 포함)"""
    import quopri as _qp
    import base64 as _b64s
    text = ''
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == 'text/plain':
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or 'utf-8'
                if payload:
                    text = payload.decode(charset, errors='replace')
                    break
    else:
        payload = msg.get_payload(decode=True)
        charset = msg.get_content_charset() or 'utf-8'
        if payload:
            text = payload.decode(charset, errors='replace')
    text = _re.sub(r'\s+', ' ', text).strip()
    return text[:max_len]

def fetch_imap_inbox(host, port, use_ssl, username, password, max_results=25):
    try:
        M = imaplib.IMAP4_SSL(host, int(port)) if use_ssl else imaplib.IMAP4(host, int(port))
        M.login(username, password)
        M.select('INBOX', readonly=True)
        _, data = M.search(None, 'ALL')
        all_ids = data[0].split() if data[0] else []
        ids = all_ids[-max_results:][::-1]   # 최신순

        messages = []
        for uid in ids:
            # 헤더 + 전체 바디를 한 번에 가져옴 (MIME 파싱 정확도를 위해)
            _, raw = M.fetch(uid, '(FLAGS RFC822)')
            if not raw or not raw[0] or not isinstance(raw[0], tuple):
                continue
            flags_line = raw[0][0].decode('utf-8', errors='replace') if isinstance(raw[0][0], bytes) else str(raw[0][0])
            msg = email_lib.message_from_bytes(raw[0][1])
            subject  = _decode(msg.get('Subject') or '(제목 없음)')
            fr_name, fr_email = _parse_from(msg.get('From') or '')
            date_fmt = _fmt_date(msg.get('Date') or '')
            is_read  = '\\Seen' in flags_line
            snippet  = _extract_snippet(msg)

            messages.append({
                'id': uid.decode(), 'threadId': uid.decode(),
                'subject': subject, 'from': fr_name, 'fromEmail': fr_email,
                'snippet': snippet, 'date': date_fmt, 'isRead': is_read,
            })

        M.logout()
        return messages
    except imaplib.IMAP4.error as e:
        raise Exception(f'IMAP 인증 실패: {e}')
    except Exception as e:
        raise Exception(f'IMAP 오류: {e}')

# ─── 주식 ────────────────────────────────────────────────

KRW_SYMBOLS = {'^KS11', '^KQ11', '^KS200'}

def is_krw(symbol: str) -> bool:
    return '.KS' in symbol or '.KQ' in symbol or symbol in KRW_SYMBOLS

DISPLAY_NAMES = {
    # 한국 종목
    '005930.KS': '삼성전자',
    '000660.KS': 'SK하이닉스',
    '042700.KS': '한미반도체',
    '000990.KS': 'DB하이텍',
    '091810.KS': '티씨케이',
    '035720.KS': '카카오',
    '035420.KS': '네이버',
    '005380.KS': '현대차',
    '000270.KS': '기아',
    '066570.KS': 'LG전자',
    '006400.KS': '삼성SDI',
    '051910.KS': 'LG화학',
    '005490.KS': 'POSCO',
    '096770.KS': 'SK이노베이션',
    '068270.KS': '셀트리온',
    '207940.KS': '삼성바이오',
    # 인덱스
    '^KS11': '코스피',
    '^KQ11': '코스닥',
    '^IXIC': 'NASDAQ',
    '^GSPC': 'S&P 500',
    '^DJI':  '다우존스',
    # 미국 종목
    'AAPL':  'Apple',
    'MSFT':  'Microsoft',
    'NVDA':  'NVIDIA',
    'TSLA':  'Tesla',
    'AMZN':  'Amazon',
    'GOOGL': 'Google',
    'META':  'Meta',
    'NFLX':  'Netflix',
    'TSMC':  'TSMC',
    'ASML':  'ASML',
    'INTC':  'Intel',
    'AMD':   'AMD',
    'BABA':  'Alibaba',
    # 원자재 선물
    'GC=F':  '금 선물',
    'SI=F':  '은 선물',
    'CL=F':  'WTI 원유',
    'NG=F':  '천연가스',
    'HG=F':  '구리',
    # 암호화폐
    'BTC-USD': '비트코인',
    'ETH-USD': '이더리움',
    # 미국 주요 ETF
    'SPY':  'S&P500 ETF',
    'QQQ':  'NASDAQ100 ETF',
    'ARKK': 'ARK 이노베이션',
    'GLD':  '금 ETF',
    'DIA':  '다우 ETF',
    'IWM':  '러셀2000 ETF',
    'VTI':  'VTI ETF',
    'VOO':  'VOO ETF',
    'SCHD': 'SCHD ETF',
    'SOXL': '반도체 3X',
    'TQQQ': 'NASDAQ 3X',
    # 한국 ETF
    '069500.KS': 'KODEX 200',
    '122630.KS': 'KODEX 레버리지',
    '114800.KS': 'KODEX 인버스',
    '229200.KS': 'KODEX 코스닥150',
}

def fetch_quotes(symbols: list) -> list:
    quotes = []
    for symbol in symbols:
        try:
            fi = yf.Ticker(symbol).fast_info
            price = fi.last_price or 0.0
            prev  = fi.previous_close or price
            change = price - prev
            change_pct = (change / prev * 100) if prev else 0.0
            quotes.append({
                'symbol':        symbol,
                'displayName':   DISPLAY_NAMES.get(symbol, symbol),
                'price':         round(price, 2),
                'change':        round(change, 2),
                'changePercent': round(change_pct, 4),
                'high':          round(fi.day_high or price, 2),
                'low':           round(fi.day_low  or price, 2),
                'prevClose':     round(prev, 2),
                'isKRW':         is_krw(symbol),
            })
            logging.info(f'  {symbol}: {price:.2f}')
        except Exception as e:
            logging.warning(f'  {symbol} 실패: {e}')
    return quotes

# ─── 날씨 ────────────────────────────────────────────────

# 한글 도시명 → wttr.in 영문 쿼리 변환 (한글은 천문 용어와 혼동 가능)
CITY_MAP = {
    '화성': 'Hwaseong, Gyeonggi, South Korea',
    '서울': 'Seoul, South Korea',
    '수원': 'Suwon, Gyeonggi, South Korea',
    '인천': 'Incheon, South Korea',
    '부산': 'Busan, South Korea',
    '대구': 'Daegu, South Korea',
    '대전': 'Daejeon, South Korea',
    '광주': 'Gwangju, South Korea',
    '울산': 'Ulsan, South Korea',
    '제주': 'Jeju, South Korea',
}

# wttr.in weatherCode → OWM 호환 icon 문자열
def _code_to_icon(code: int) -> str:
    if code == 113:                              return '01d'  # 맑음
    if code == 116:                              return '02d'  # 구름 조금
    if code in (119, 122):                       return '04d'  # 흐림
    if code in (143, 248, 260):                  return '50d'  # 안개
    if code in (200, 386, 389, 392, 395):        return '11d'  # 뇌우
    if code in (179, 182, 185, 317, 320,
                323, 326, 329, 332, 335, 338,
                350, 362, 365, 368, 371, 374, 377): return '13d'  # 눈
    if code in (176, 263, 266, 281, 284,
                293, 296, 299, 302, 305, 308,
                353, 356, 359):                  return '10d'  # 비
    return '02d'

def fetch_weather(city: str) -> dict:
    display_name = city  # 사용자 입력 도시명을 표시에 사용
    query = CITY_MAP.get(city, city)  # 한글이면 영문으로 변환
    url = f'https://wttr.in/{req_lib.utils.quote(query)}?format=j1&lang=ko'
    resp = req_lib.get(url, timeout=8, headers={'User-Agent': 'dashboard/1.0'})
    resp.raise_for_status()
    data = resp.json()

    cur = data['current_condition'][0]
    code = int(cur.get('weatherCode', '113'))
    desc_list = cur.get('lang_ko') or cur.get('weatherDesc', [{}])
    description = desc_list[0].get('value', '') if desc_list else ''

    return {
        'city':        display_name,
        'temp':        round(float(cur['temp_C'])),
        'feelsLike':   round(float(cur['FeelsLikeC'])),
        'description': description,
        'icon':        _code_to_icon(code),
        'humidity':    int(cur['humidity']),
    }

# Open-Meteo용 좌표 — 영문 소문자 키 (한글 인코딩 이슈 방지)
CITY_COORDS = {
    'hwaseong, gyeonggi, south korea': (37.1998, 126.8310),
    'seoul, south korea':              (37.5665, 126.9780),
    'suwon, gyeonggi, south korea':    (37.2636, 127.0286),
    'incheon, south korea':            (37.4563, 126.7052),
    'busan, south korea':              (35.1796, 129.0756),
    'daegu, south korea':              (35.8714, 128.6014),
    'daejeon, south korea':            (36.3504, 127.3845),
    'gwangju, south korea':            (35.1595, 126.8526),
    'ulsan, south korea':              (35.5384, 129.3114),
    'jeju, south korea':               (33.4996, 126.5312),
    'seongnam, gyeonggi, south korea': (37.4196, 127.1267),
    'yongin, gyeonggi, south korea':   (37.2411, 127.1776),
}

def _wmo_to_icon(code: int) -> str:
    if code == 0:              return '01d'
    if code in (1, 2):         return '02d'
    if code == 3:              return '04d'
    if code in (45, 48):       return '50d'
    if 51 <= code <= 67:       return '10d'
    if 71 <= code <= 77:       return '13d'
    if 80 <= code <= 82:       return '10d'
    if code in (85, 86):       return '13d'
    if code in (95, 96, 99):   return '11d'
    return '02d'

def fetch_forecast(city: str) -> list:
    coords = CITY_COORDS.get(city.lower())
    if not coords:
        # 좌표 없는 도시: wttr.in의 3일 예보 사용
        query = CITY_MAP.get(city, city)
        url = f'https://wttr.in/{req_lib.utils.quote(query)}?format=j1'
        resp = req_lib.get(url, timeout=8, headers={'User-Agent': 'dashboard/1.0'})
        resp.raise_for_status()
        data = resp.json()
        result = []
        for day in data.get('weather', [])[1:4]:
            hourly = day.get('hourly', [{}])
            midday = hourly[len(hourly)//2] if hourly else {}
            code = int(midday.get('weatherCode', 113))
            result.append({
                'date':    day['date'],
                'maxTemp': int(day['maxtempC']),
                'minTemp': int(day['mintempC']),
                'icon':    _code_to_icon(code),
            })
        return result

    lat, lon = coords
    url = (f'https://api.open-meteo.com/v1/forecast'
           f'?latitude={lat}&longitude={lon}'
           f'&daily=temperature_2m_max,temperature_2m_min,weather_code'
           f'&timezone=Asia%2FSeoul&forecast_days=14')
    resp = req_lib.get(url, timeout=8)
    resp.raise_for_status()
    data = resp.json()['daily']
    return [
        {
            'date':    data['time'][i],
            'maxTemp': round(data['temperature_2m_max'][i]),
            'minTemp': round(data['temperature_2m_min'][i]),
            'icon':    _wmo_to_icon(int(data['weather_code'][i])),
        }
        for i in range(len(data['time']))
    ]

# ─── Google Calendar CalDAV ──────────────────────────────

import base64 as _b64
from datetime import datetime as _dt, timedelta as _td
import re as _re2

def fetch_ics_events(ics_url, days=60):
    """Google Calendar 비공개 ICS URL에서 일정 파싱"""
    r = req_lib.get(ics_url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
    r.raise_for_status()
    text = r.text

    events = []
    now = _dt.utcnow()
    end_dt = now + _td(days=days)

    for vevent in _re2.findall(r'BEGIN:VEVENT(.*?)END:VEVENT', text, _re2.DOTALL):
        def get(field):
            m = _re2.search(rf'^{field}(?:;[^:]*)?:(.*)', vevent, _re2.MULTILINE)
            return m.group(1).strip().replace('\\n', '\n').replace('\\,', ',') if m else ''

        summary = get('SUMMARY')
        dtstart_raw = get('DTSTART')
        uid = get('UID')
        if not summary or not dtstart_raw:
            continue

        def parse_dt(s):
            s = s.strip()
            try:
                if len(s) == 8:
                    d = _dt.strptime(s, '%Y%m%d')
                    return d.strftime('%Y-%m-%d'), ''
                clean = s.replace('Z', '')
                if 'T' in clean:
                    d = _dt.strptime(clean[:15], '%Y%m%dT%H%M%S')
                    return d.strftime('%Y-%m-%d'), d.strftime('%H:%M')
                return s[:10], ''
            except Exception:
                return s[:10], ''

        date_str, time_str = parse_dt(dtstart_raw)
        try:
            event_dt = _dt.strptime(date_str, '%Y-%m-%d')
            if event_dt < now.replace(hour=0, minute=0, second=0) or event_dt > end_dt:
                continue
        except Exception:
            pass

        events.append({
            'id': uid or f'{summary}-{date_str}',
            'title': summary,
            'date': date_str,
            'time': time_str,
            'color': '#4285F4',
        })

    return sorted(events, key=lambda e: (e['date'], e.get('time', '')))

def fetch_caldav_events(email, app_password, days=30):
    """Google Calendar CalDAV로 일정 조회 (앱 비밀번호 사용)"""
    # 앱 비밀번호 공백 제거 (Google 표시 형식 "xxxx xxxx xxxx xxxx" 처리)
    app_password = app_password.replace(' ', '')
    email = email.strip().lower()
    token = _b64.b64encode(f'{email}:{app_password}'.encode()).decode()
    headers = {
        'Authorization': f'Basic {token}',
        'Content-Type': 'application/xml; charset=utf-8',
        'Depth': '1',
        'User-Agent': 'Mozilla/5.0',
    }
    now = _dt.utcnow()
    end = now + _td(days=days)
    body = f'''<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="{now.strftime('%Y%m%dT%H%M%SZ')}" end="{end.strftime('%Y%m%dT%H%M%SZ')}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>'''

    # Google CalDAV URL 순서대로 시도
    urls = [
        f'https://apidata.googleusercontent.com/caldav/v2/{email}/events/',
        f'https://www.google.com/calendar/dav/{email}/events/',
    ]
    r = None
    last_status = 0
    for url in urls:
        try:
            r = req_lib.request('REPORT', url, headers=headers, data=body.encode(), timeout=15)
            last_status = r.status_code
            if r.status_code != 404:
                break
        except Exception:
            continue

    if r is None:
        raise Exception('CalDAV 서버에 연결할 수 없습니다.')
    if last_status == 401:
        raise Exception('인증 실패 — 앱 비밀번호(공백 없이 16자리)를 확인하세요. Google 계정의 2단계 인증이 활성화되어 있어야 합니다.')
    if last_status == 403:
        raise Exception('접근 거부 — Google 계정 설정에서 "안전하지 않은 앱 허용" 또는 캘린더 공유 설정을 확인하세요.')
    r.raise_for_status()
    r.raise_for_status()

    events = []
    for cal_data in _re2.findall(r'<calendar-data[^>]*>(.*?)</calendar-data>', r.text, _re2.DOTALL):
        cal_data = cal_data.replace('&#13;', '').strip()
        for vevent in _re2.findall(r'BEGIN:VEVENT(.*?)END:VEVENT', cal_data, _re2.DOTALL):
            def get(field):
                m = _re2.search(rf'^{field}(?:;[^:]*)?:(.*)', vevent, _re2.MULTILINE)
                return m.group(1).strip() if m else ''
            summary = get('SUMMARY')
            dtstart_raw = get('DTSTART')
            dtend_raw = get('DTEND')
            uid = get('UID')
            if not summary or not dtstart_raw:
                continue
            def parse_dt(s):
                s = _re2.sub(r'[TZ]', lambda m: '' if m.group()=='Z' else 'T', s)
                try:
                    if len(s) == 8:
                        return _dt.strptime(s, '%Y%m%d').strftime('%Y-%m-%d'), ''
                    return _dt.strptime(s[:15], '%Y%m%dT%H%M%S').strftime('%Y-%m-%d'), _dt.strptime(s[:15], '%Y%m%dT%H%M%S').strftime('%H:%M')
                except Exception:
                    return s[:10], ''
            date, time = parse_dt(dtstart_raw)
            events.append({'id': uid or f'{summary}-{date}', 'title': summary, 'date': date, 'time': time, 'color': '#4285F4'})
    return sorted(events, key=lambda e: e['date'])

# ─── AI 뉴스 (Reddit + HuggingFace) ─────────────────────

import xml.etree.ElementTree as _ET
from datetime import timezone as _tz

def _fetch_reddit(subreddit, limit=10):
    """Reddit 서브레딧 최신 글 (무료, 인증 불필요)"""
    url = f'https://www.reddit.com/r/{subreddit}/hot.json?limit={limit}'
    r = req_lib.get(url, headers={'User-Agent': 'dashboard/1.0'}, timeout=10)
    r.raise_for_status()
    items = []
    for post in r.json().get('data', {}).get('children', []):
        d = post.get('data', {})
        if d.get('is_self') and not d.get('selftext'):
            continue
        items.append({
            'title': d.get('title', ''),
            'url': d.get('url') or f"https://reddit.com{d.get('permalink','')}",
            'points': d.get('score', 0),
            'comments': d.get('num_comments', 0),
            'date': _dt.utcfromtimestamp(d.get('created_utc', 0)).strftime('%Y-%m-%d'),
            'source': f"r/{subreddit}",
        })
    return items

def _fetch_hf_blog(limit=5):
    """HuggingFace 블로그 RSS"""
    try:
        r = req_lib.get('https://huggingface.co/blog/feed.xml',
                        headers={'User-Agent': 'dashboard/1.0'}, timeout=10)
        r.raise_for_status()
        root = _ET.fromstring(r.text)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        items = []
        for entry in root.findall('atom:entry', ns)[:limit]:
            title = entry.findtext('atom:title', '', ns)
            link_el = entry.find('atom:link', ns)
            url = link_el.get('href', '') if link_el is not None else ''
            date = (entry.findtext('atom:published', '', ns) or '')[:10]
            items.append({'title': title, 'url': url, 'points': 0,
                          'comments': 0, 'date': date, 'source': 'HuggingFace Blog'})
        return items
    except Exception:
        return []

def _fetch_hf_trending(limit=8):
    """HuggingFace 트렌딩 모델"""
    try:
        r = req_lib.get(
            'https://huggingface.co/api/models',
            params={'sort': 'trending', 'limit': limit, 'direction': -1},
            headers={'User-Agent': 'dashboard/1.0'}, timeout=10)
        r.raise_for_status()
        today = _dt.utcnow().strftime('%Y-%m-%d')
        return [{
            'title': f"[HF 트렌딩] {m.get('id', '')}",
            'url': f"https://huggingface.co/{m.get('id', '')}",
            'points': m.get('downloads', 0),
            'comments': m.get('likes', 0),
            'date': (m.get('lastModified') or today)[:10],
            'source': 'HuggingFace Models',
        } for m in r.json() if m.get('id')]
    except Exception:
        return []

def _fetch_hf_papers(limit=8):
    """HuggingFace Daily Papers"""
    try:
        r = req_lib.get(
            'https://huggingface.co/api/daily_papers',
            params={'limit': limit},
            headers={'User-Agent': 'dashboard/1.0'}, timeout=10)
        r.raise_for_status()
        items = []
        for p in r.json():
            paper = p.get('paper', {})
            pid = paper.get('id', '')
            items.append({
                'title': paper.get('title', ''),
                'url': f"https://huggingface.co/papers/{pid}",
                'points': p.get('upvotes', 0),
                'comments': 0,
                'date': (p.get('publishedAt') or '')[:10],
                'source': 'HuggingFace Papers',
            })
        return items
    except Exception:
        return []

_PAPER_KW   = ['arxiv', 'paper', 'research', 'study', 'survey', 'benchmark', 'dataset', 'preprint', 'published', 'findings']
_LLM_KW     = ['llm', 'llama', 'mistral', 'claude', 'gpt', 'gemini', 'falcon', 'phi', 'qwen', 'inference', 'fine-tun', 'finetun', 'rlhf', 'sft', 'rag', 'embedding', 'tokenizer', 'transformer', 'quantiz', 'lora', 'vllm', 'ollama', 'openai', 'anthropic', 'deepseek', 'cohere']
_BIZ_KW     = ['raises', 'funding', 'million', 'billion', 'startup', 'company', 'acqui', 'ipo', 'valuation', 'invest', 'launch', 'partnership', 'deal', 'hired', 'ceo', 'lawsuit', 'regulation', 'ban', 'policy', 'government', 'microsoft', 'google', 'amazon', 'meta ', 'apple']
_CODE_KW    = ['github', 'huggingface', 'open.source', 'open source', 'repo', 'release', 'weights', 'checkpoint', 'model card', 'pip install', 'docker', 'api ', 'sdk', 'library', 'framework', 'v1.', 'v2.', 'v3.']

def _categorize(item):
    t = (item['title'] + ' ' + item['source']).lower()
    src = item['source']
    if src in ('HuggingFace Blog', 'HuggingFace Models', 'HuggingFace Papers'):
        if src == 'HuggingFace Papers':
            return '논문'
        return 'GitHub/HuggingFace'
    if any(k in t for k in _CODE_KW):
        return 'GitHub/HuggingFace'
    if any(k in t for k in _PAPER_KW):
        return '논문'
    if any(k in t for k in _LLM_KW):
        return 'LLM'
    if any(k in t for k in _BIZ_KW):
        return 'Business'
    if src == 'r/MachineLearning':
        return '논문'
    if src == 'r/LocalLLaMA':
        return 'LLM'
    return '전반'

def fetch_ai_news(max_results=25, query=''):
    """Reddit ML/LLM 커뮤니티 + HuggingFace 블로그 최신 AI 뉴스 (무료, 인증 불필요)"""
    items = []
    for sub in ['MachineLearning', 'LocalLLaMA', 'artificial']:
        try:
            items += _fetch_reddit(sub, limit=10)
        except Exception:
            pass
    items += _fetch_hf_blog(limit=5)
    items += _fetch_hf_papers(limit=8)
    items += _fetch_hf_trending(limit=8)
    # 최신순 정렬 + 중복 제거 + 카테고리 분류
    seen = set()
    result = []
    for item in sorted(items, key=lambda x: x['date'], reverse=True):
        key = item['title'][:50]
        if key not in seen:
            seen.add(key)
            item['category'] = _categorize(item)
            result.append(item)
    return result[:max_results]

# ─── Claude.ai 웹 프록시 ─────────────────────────────────

import json as _json
import uuid as _uuid

_CLAUDE_BASE = 'https://claude.ai'

def _ch(session_key):
    return {
        'cookie': f'sessionKey={session_key}',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'origin': 'https://claude.ai',
        'referer': 'https://claude.ai/new',
    }

def _get_org(session_key):
    r = req_lib.get(f'{_CLAUDE_BASE}/api/organizations', headers=_ch(session_key), timeout=10)
    if r.status_code == 401:
        raise Exception('세션 만료 — 다시 로그인해주세요.')
    r.raise_for_status()
    orgs = r.json()
    if not orgs:
        raise Exception('조직 정보 없음')
    return orgs[0]['uuid']

def claude_web_chat(session_key, messages, system=''):
    org_id = _get_org(session_key)

    # 마지막 user 메시지를 prompt로 추출
    prompt = ''
    for m in reversed(messages):
        if m.get('role') == 'user':
            prompt = m.get('content', '')
            break

    # 시스템 컨텍스트를 prompt 앞에 붙임
    if system:
        prompt = f'{system}\n\n---\n\n{prompt}'

    hdrs_base = _ch(session_key)
    hdrs = {**hdrs_base, 'accept': 'text/event-stream'}
    body = {
        'prompt': prompt,
        'model': 'claude-sonnet-4-5',
        'timezone': 'Asia/Seoul',
        'attachments': [],
        'files': [],
        'rendering_mode': 'messages',
        'tools': [],
    }

    # 429 대응: 최대 2회 재시도 (30초 대기)
    for attempt in range(3):
        conv_id = str(_uuid.uuid4())
        req_lib.post(f'{_CLAUDE_BASE}/api/organizations/{org_id}/chat_conversations',
                     json={'name': '', 'uuid': conv_id}, headers=hdrs_base, timeout=10)
        r = req_lib.post(
            f'{_CLAUDE_BASE}/api/organizations/{org_id}/chat_conversations/{conv_id}/completion',
            json=body, headers=hdrs, stream=True, timeout=90)
        if r.status_code == 429:
            if attempt < 2:
                wait = int(r.headers.get('retry-after', 30))
                logging.warning(f'Claude.ai 429 — {wait}초 후 재시도 (시도 {attempt+1}/3)')
                _time.sleep(min(wait, 60))
                continue
            raise Exception('요청 한도 초과(429). 잠시 후 다시 시도하세요.')
        r.raise_for_status()
        break
    full = ''
    for line in r.iter_lines():
        if not line or not line.startswith(b'data: '):
            continue
        try:
            d = _json.loads(line[6:])
            if d.get('type') == 'content_block_delta':
                delta = d.get('delta', {})
                full += delta.get('text', '')
            elif 'completion' in d:
                full = d['completion']
        except Exception:
            pass
    return full

import pathlib as _pathlib
_SESSION_CACHE = _pathlib.Path(__file__).parent / '.claude_session_key'

def store_session_key(key):
    _SESSION_CACHE.write_text(key, encoding='utf-8')
    logging.info('세션 키 캐시 저장 완료')

def load_session_key_cache():
    if _SESSION_CACHE.exists():
        return _SESSION_CACHE.read_text(encoding='utf-8').strip() or None
    return None

def _read_chrome_via_cdp(port=9222):
    """실행 중인 Chrome의 CDP로 claude.ai sessionKey 읽기 (--remote-debugging-port 필요)"""
    import urllib.request, json as _json
    try:
        r = urllib.request.urlopen(f'http://localhost:{port}/json', timeout=2)
        tabs = _json.loads(r.read())
    except Exception:
        return None

    # claude.ai 탭 찾기
    ws_url = None
    for tab in tabs:
        if 'claude.ai' in tab.get('url', '') and tab.get('webSocketDebuggerUrl'):
            ws_url = tab['webSocketDebuggerUrl']
            break
    if not ws_url:
        # 탭 없으면 첫 번째 탭 사용
        for tab in tabs:
            if tab.get('webSocketDebuggerUrl'):
                ws_url = tab['webSocketDebuggerUrl']
                break
    if not ws_url:
        return None

    try:
        import websocket
        ws = websocket.WebSocket()
        ws.connect(ws_url, timeout=5)
        ws.send(_json.dumps({'id': 1, 'method': 'Network.getCookies',
                             'params': {'urls': ['https://claude.ai']}}))
        result = _json.loads(ws.recv())
        ws.close()
        for c in result.get('result', {}).get('cookies', []):
            if c['name'] == 'sessionKey' and c['value']:
                return c['value']
    except Exception as e:
        logging.warning(f'CDP 쿠키 읽기 실패: {e}')
    return None


def _read_chrome_session_key():
    """Chrome 쿠키 DB에서 claude.ai sessionKey를 직접 읽어 반환 (브라우저 불필요)"""
    import os, sqlite3, shutil, tempfile, json, base64, ctypes, ctypes.wintypes

    local_app = os.environ.get('LOCALAPPDATA', '')
    cookie_src = os.path.join(local_app, r'Google\Chrome\User Data\Default\Network\Cookies')
    local_state_path = os.path.join(local_app, r'Google\Chrome\User Data\Local State')
    if not os.path.exists(cookie_src) or not os.path.exists(local_state_path):
        return None

    # AES 키 추출 (DPAPI로 보호된 Chrome 마스터 키)
    with open(local_state_path, 'r', encoding='utf-8') as f:
        enc_key_b64 = json.load(f)['os_crypt']['encrypted_key']
    enc_key = base64.b64decode(enc_key_b64)[5:]  # 'DPAPI' 접두사 제거

    class _BLOB(ctypes.Structure):
        _fields_ = [('cbData', ctypes.wintypes.DWORD), ('pbData', ctypes.POINTER(ctypes.c_char))]

    def _dpapi_decrypt(data):
        buf = ctypes.create_string_buffer(data, len(data))
        blob_in = _BLOB(len(data), buf)
        blob_out = _BLOB()
        if not ctypes.windll.crypt32.CryptUnprotectData(
                ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)):
            return None
        result = ctypes.string_at(blob_out.pbData, blob_out.cbData)
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)
        return result

    aes_key = _dpapi_decrypt(enc_key)
    if not aes_key:
        return None

    # 쿠키 DB 임시 복사 (Chrome 실행 중 lock 우회)
    tmp = tempfile.mktemp(suffix='.db')
    shutil.copy2(cookie_src, tmp)
    try:
        conn = sqlite3.connect(tmp)
        row = conn.execute(
            "SELECT encrypted_value FROM cookies WHERE host_key LIKE '%claude.ai%' AND name='sessionKey'"
        ).fetchone()
        conn.close()
    finally:
        try:
            os.unlink(tmp)
        except Exception:
            pass

    if not row:
        return None

    enc_val = row[0]
    if enc_val[:3] != b'v10':
        return None  # 구버전 포맷은 미지원

    try:
        from Crypto.Cipher import AES
        iv, payload = enc_val[3:15], enc_val[15:]
        decrypted = AES.new(aes_key, AES.MODE_GCM, iv).decrypt(payload[:-16])
        return decrypted.decode('utf-8')
    except Exception:
        return None


def claude_capture_session(timeout_s=120, quick_only=False):
    import os

    # 1단계: CDP (실행 중인 Chrome에서 직접 읽기, 가장 빠름)
    try:
        key = _read_chrome_via_cdp()
        if key:
            logging.info('CDP로 실행 중인 Chrome에서 sessionKey 추출 성공')
            return key
    except Exception as e:
        logging.warning(f'CDP 읽기 실패: {e}')

    # 2단계: Chrome 쿠키 DB 직접 읽기 (Chrome이 닫혀있을 때)
    try:
        key = _read_chrome_session_key()
        if key:
            logging.info('Chrome 쿠키 DB에서 sessionKey 추출 성공')
            return key
    except Exception as e:
        logging.warning(f'쿠키 DB 직접 읽기 실패: {e}')

    # 캐시 확인 (북마크릿으로 저장된 키)
    try:
        key = load_session_key_cache()
        if key:
            logging.info('캐시에서 sessionKey 로드')
            return key
    except Exception:
        pass

    if quick_only:
        raise Exception('세션 키 없음. claude.ai에서 북마크릿을 클릭하거나 설정에서 연결하세요.')

    # 2단계: Chrome 기존 프로필로 브라우저 열기 (Google 봇 감지 우회)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise Exception('playwright가 없습니다. pip install playwright && playwright install chromium 를 실행하세요.')

    chrome_profile = os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\User Data')

    with sync_playwright() as p:
        try:
            context = p.chromium.launch_persistent_context(
                user_data_dir=chrome_profile,
                channel='chrome',
                headless=False,
                args=['--no-first-run', '--no-default-browser-check'],
            )
        except Exception:
            browser = p.chromium.launch(headless=False)
            context = browser.new_context()

        page = context.new_page()
        page.goto('https://claude.ai')

        deadline = _time.time() + timeout_s
        while _time.time() < deadline:
            _time.sleep(1)
            try:
                for c in context.cookies(['https://claude.ai']):
                    if c['name'] == 'sessionKey' and c['value']:
                        key = c['value']
                        _time.sleep(0.5)
                        context.close()
                        return key
            except Exception:
                pass

        try:
            context.close()
        except Exception:
            pass
        raise Exception(f'로그인 시간 초과 ({timeout_s}초). claude.ai에서 Google 로그인 후 다시 시도해주세요.')

def claude_login(email, password):
    s = req_lib.Session()
    clerk = 'https://clerk.anthropic.com'
    hdrs = {'content-type': 'application/json', 'origin': 'https://claude.ai'}
    r = s.post(f'{clerk}/v1/client/sign_ins', json={'identifier': email}, headers=hdrs, timeout=10)
    if not r.ok:
        raise Exception(f'이메일 인증 실패 ({r.status_code})')
    sign_in_id = r.json().get('response', {}).get('id')
    if not sign_in_id:
        raise Exception('로그인 ID를 가져올 수 없습니다.')
    r2 = s.post(f'{clerk}/v1/client/sign_ins/{sign_in_id}/attempt_first_factor',
                json={'strategy': 'password', 'password': password}, headers=hdrs, timeout=10)
    if not r2.ok:
        raise Exception('비밀번호가 올바르지 않습니다.')
    for c in s.cookies:
        if c.name in ('sessionKey', '__Secure-next-auth.session-token', 'session'):
            return c.value
    sessions = r2.json().get('client', {}).get('sessions', [{}])
    token = (sessions[0] if sessions else {}).get('last_active_token', {}).get('jwt', '')
    if token:
        return token
    raise Exception('세션 키 추출 실패 — 브라우저 쿠키에서 sessionKey를 직접 복사해주세요.')

# ─── MCP 라우터 ──────────────────────────────────────────

TOOLS = [
    {
        'name': 'claude.store_session',
        'description': '북마크릿에서 전달받은 세션 키를 로컬에 저장',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'session_key': {'type': 'string', 'description': '저장할 세션 키'},
            },
            'required': ['session_key'],
        },
    },
    {
        'name': 'claude.capture_session',
        'description': 'Claude.ai 브라우저를 열어 Google/이메일 로그인 후 세션 키 자동 추출',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'timeout': {'type': 'integer', 'description': '최대 대기 시간(초, 기본 120)'},
            },
        },
    },
    {
        'name': 'claude.login',
        'description': 'Claude.ai 계정(이메일+비밀번호)으로 로그인해서 세션 키 획득',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'email':    {'type': 'string', 'description': '이메일 주소'},
                'password': {'type': 'string', 'description': '비밀번호'},
            },
            'required': ['email', 'password'],
        },
    },
    {
        'name': 'claude.chat',
        'description': 'Claude.ai 세션으로 채팅 (API 키 없이 구독 계정 사용)',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'session_key': {'type': 'string', 'description': '세션 키'},
                'messages':    {'type': 'array',  'description': '메시지 배열'},
                'system':      {'type': 'string', 'description': '시스템 프롬프트'},
            },
            'required': ['session_key', 'messages'],
        },
    },
    {
        'name': 'calendar.ics',
        'description': 'Google Calendar 비공개 ICS URL에서 일정 조회 (인증 불필요, 가장 간단)',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'url':  {'type': 'string',  'description': 'Google Calendar 비공개 ICS URL'},
                'days': {'type': 'integer', 'description': '조회 기간 (기본 60일)'},
            },
            'required': ['url'],
        },
    },
    {
        'name': 'news.ai',
        'description': 'Hacker News에서 AI 관련 최신 뉴스 가져오기 (인증 불필요)',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'query':      {'type': 'string',  'description': '검색 키워드 (기본: AI LLM GPT Claude)'},
                'maxResults': {'type': 'integer', 'description': '최대 결과 수 (기본 15)'},
            },
        },
    },
    {
        'name': 'calendar.caldav',
        'description': 'Google Calendar CalDAV로 일정 조회 (앱 비밀번호 사용, OAuth 불필요)',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'email':        {'type': 'string',  'description': 'Gmail 주소'},
                'app_password': {'type': 'string',  'description': '앱 비밀번호 (16자리)'},
                'days':         {'type': 'integer', 'description': '조회 기간 (기본 30일)'},
            },
            'required': ['email', 'app_password'],
        },
    },
    {
        'name': 'imap.inbox',
        'description': 'IMAP으로 받은편지함 조회 (Gmail 앱 비밀번호, Naver, 기타 IMAP 서버)',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'host':       {'type': 'string',  'description': 'IMAP 서버 (예: imap.gmail.com, imap.naver.com)'},
                'port':       {'type': 'integer', 'description': 'IMAP 포트 (기본 993)'},
                'ssl':        {'type': 'boolean', 'description': 'SSL 사용 여부 (기본 true)'},
                'username':   {'type': 'string',  'description': '이메일 주소'},
                'password':   {'type': 'string',  'description': '비밀번호 또는 앱 비밀번호'},
                'maxResults': {'type': 'integer', 'description': '최대 메일 수 (기본 25)'},
            },
            'required': ['host', 'username', 'password'],
        },
    },
    {
        'name': 'stocks.watchlist',
        'description': 'Yahoo Finance에서 관심 종목/지수 시세 조회',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'symbols': {
                    'type': 'array',
                    'items': {'type': 'string'},
                    'description': '심볼 목록 (예: 005930.KS, ^KS11, NVDA)',
                }
            },
            'required': ['symbols'],
        },
    },
    {
        'name': 'weather.current',
        'description': 'wttr.in으로 현재 날씨 조회 (API 키 불필요)',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'city': {
                    'type': 'string',
                    'description': '도시명 (한글/영문 모두 가능, 예: 화성, Seoul)',
                }
            },
            'required': ['city'],
        },
    },
    {
        'name': 'weather.forecast',
        'description': 'Open-Meteo로 7일 예보 조회 (API 키 불필요, 주요 한국 도시 지원)',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'city': {
                    'type': 'string',
                    'description': '도시명 (한글 가능, 예: 화성, 서울)',
                }
            },
            'required': ['city'],
        },
    },
]


@app.route('/mcp', methods=['POST', 'OPTIONS'])
def mcp():
    if request.method == 'OPTIONS':
        return '', 204

    body    = request.get_json(force=True, silent=True) or {}
    method  = body.get('method', '')
    req_id  = body.get('id')
    params  = body.get('params') or {}
    name    = params.get('name', '')
    args    = params.get('arguments', {})

    if method == 'tools/list':
        return jsonify({'jsonrpc': '2.0', 'id': req_id, 'result': {'tools': TOOLS}})

    if method == 'tools/call':
        if name == 'claude.store_session':
            try:
                key = args.get('session_key', '').strip()
                if not key:
                    raise Exception('session_key가 비어있습니다.')
                store_session_key(key)
                return jsonify({'jsonrpc':'2.0','id':req_id,
                                'result':{'content':[{'type':'json','json':{'ok':True}}]}})
            except Exception as e:
                return jsonify({'jsonrpc':'2.0','id':req_id,
                                'error':{'code':-32000,'message':str(e)}})

        if name == 'calendar.ics':
            try:
                events = fetch_ics_events(args.get('url', ''), int(args.get('days', 60)))
                return jsonify({'jsonrpc': '2.0', 'id': req_id,
                                'result': {'content': [{'type': 'json', 'json': events}]}})
            except Exception as e:
                return jsonify({'jsonrpc': '2.0', 'id': req_id,
                                'error': {'code': -32000, 'message': str(e)}})

        if name == 'news.ai':
            try:
                news = fetch_ai_news(
                    int(args.get('maxResults', 15)),
                    args.get('query', 'AI LLM GPT Claude Gemini'),
                )
                return jsonify({'jsonrpc': '2.0', 'id': req_id,
                                'result': {'content': [{'type': 'json', 'json': news}]}})
            except Exception as e:
                return jsonify({'jsonrpc': '2.0', 'id': req_id,
                                'error': {'code': -32000, 'message': str(e)}})

        if name == 'calendar.caldav':
            try:
                events = fetch_caldav_events(
                    args.get('email', ''),
                    args.get('app_password', ''),
                    int(args.get('days', 30))
                )
                return jsonify({'jsonrpc': '2.0', 'id': req_id,
                                'result': {'content': [{'type': 'json', 'json': events}]}})
            except Exception as e:
                return jsonify({'jsonrpc': '2.0', 'id': req_id,
                                'error': {'code': -32000, 'message': str(e)}})

        if name == 'claude.capture_session':
            try:
                timeout = int(args.get('timeout', 120))
                quick_only = bool(args.get('quick_only', False))
                key = claude_capture_session(timeout, quick_only)
                return jsonify({'jsonrpc':'2.0','id':req_id,
                                'result':{'content':[{'type':'json','json':{'sessionKey':key}}]}})
            except Exception as e:
                return jsonify({'jsonrpc':'2.0','id':req_id,
                                'error':{'code':-32000,'message':str(e)}})

        if name == 'claude.login':
            try:
                key = claude_login(args.get('email',''), args.get('password',''))
                return jsonify({'jsonrpc':'2.0','id':req_id,
                                'result':{'content':[{'type':'json','json':{'sessionKey':key}}]}})
            except Exception as e:
                return jsonify({'jsonrpc':'2.0','id':req_id,
                                'error':{'code':-32000,'message':str(e)}})

        if name == 'claude.chat':
            try:
                text = claude_web_chat(
                    args.get('session_key',''),
                    args.get('messages',[]),
                    args.get('system',''))
                return jsonify({'jsonrpc':'2.0','id':req_id,
                                'result':{'content':[{'type':'json','json':{'text':text}}]}})
            except Exception as e:
                return jsonify({'jsonrpc':'2.0','id':req_id,
                                'error':{'code':-32000,'message':str(e)}})

        if name == 'imap.inbox':
            host     = args.get('host', '')
            port     = args.get('port', 993)
            use_ssl  = args.get('ssl', True)
            username = args.get('username', '')
            password = args.get('password', '')
            max_r    = int(args.get('maxResults', 25))
            logging.info(f'IMAP 요청: {username}@{host}:{port}')
            try:
                msgs = fetch_imap_inbox(host, port, use_ssl, username, password, max_r)
                return jsonify({'jsonrpc': '2.0', 'id': req_id,
                                'result': {'content': [{'type': 'json', 'json': msgs}]}})
            except Exception as e:
                return jsonify({'jsonrpc': '2.0', 'id': req_id,
                                'error': {'code': -32000, 'message': str(e)}})

        if name == 'stocks.watchlist':
            symbols = args.get('symbols', [])
            logging.info(f'시세 요청: {symbols}')
            quotes = fetch_quotes(symbols)
            return jsonify({'jsonrpc': '2.0', 'id': req_id,
                            'result': {'content': [{'type': 'json', 'json': quotes}]}})

        if name == 'weather.current':
            city = args.get('city', '화성')
            logging.info(f'날씨 요청: {city}')
            try:
                weather = fetch_weather(city)
                return jsonify({'jsonrpc': '2.0', 'id': req_id,
                                'result': {'content': [{'type': 'json', 'json': weather}]}})
            except Exception as e:
                return jsonify({'jsonrpc': '2.0', 'id': req_id,
                                'error': {'code': -32000, 'message': str(e)}})

        if name == 'weather.forecast':
            city = args.get('city', '화성')
            logging.info(f'주간예보 요청: {city}')
            try:
                forecast = fetch_forecast(city)
                return jsonify({'jsonrpc': '2.0', 'id': req_id,
                                'result': {'content': [{'type': 'json', 'json': forecast}]}})
            except Exception as e:
                return jsonify({'jsonrpc': '2.0', 'id': req_id,
                                'error': {'code': -32000, 'message': str(e)}})

        return jsonify({'jsonrpc': '2.0', 'id': req_id,
                        'error': {'code': -32601, 'message': f'Unknown tool: {name}'}})

    return jsonify({'jsonrpc': '2.0', 'id': req_id,
                    'error': {'code': -32601, 'message': f'Unknown method: {method}'}})


if __name__ == '__main__':
    print('=' * 50)
    print('주식 + 날씨 MCP 브리지 서버')
    print('주소: http://127.0.0.1:8765/mcp')
    print('종료: Ctrl+C')
    print('=' * 50)
    app.run(host='127.0.0.1', port=8765, debug=False, threaded=True)
