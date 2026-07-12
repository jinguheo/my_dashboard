from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


OUT = Path(r"D:\MyWork\my-dashboard\mental_avatar_workflow_overview.png")
FONT = r"C:\Windows\Fonts\malgun.ttf"
FONT_BOLD = r"C:\Windows\Fonts\malgunbd.ttf"

W, H = 1672, 941
img = Image.new("RGB", (W, H), "#061120")
draw = ImageDraw.Draw(img)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def glow_line(points, fill, width=3, glow=10):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.line(points, fill=fill, width=width + glow)
    layer = layer.filter(ImageFilter.GaussianBlur(glow / 2))
    img.paste(Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB"))
    draw.line(points, fill=fill, width=width)


def neon_rect(x, y, w, h, outline="#52d6ff", fill="#0a1a2f", radius=12, width=2):
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle((x, y, x + w, y + h), radius, outline=outline, width=width + 5, fill=None)
    glow = glow.filter(ImageFilter.GaussianBlur(5))
    base = Image.alpha_composite(img.convert("RGBA"), glow)
    img.paste(base.convert("RGB"))
    draw.rounded_rectangle((x, y, x + w, y + h), radius, fill=fill, outline=outline, width=width)


def text(x, y, s, size=22, color="#dceeff", bold=False, anchor=None):
    draw.text((x, y), s, font=font(size, bold), fill=color, anchor=anchor)


def draw_icon(kind: str, cx: int, cy: int, color: str, scale: float = 1.0):
    s = int(24 * scale)
    lw = max(2, int(3 * scale))

    def line(points, width=lw):
        draw.line(points, fill=color, width=width, joint="curve")

    def rect(dx, dy, w, h, r=4, width=lw):
        draw.rounded_rectangle((cx + dx, cy + dy, cx + dx + w, cy + dy + h), r, outline=color, width=width)

    def ellipse(dx, dy, w, h, width=lw):
        draw.ellipse((cx + dx, cy + dy, cx + dx + w, cy + dy + h), outline=color, width=width)

    if kind == "globe":
        ellipse(-s, -s, s * 2, s * 2)
        line((cx - s, cy, cx + s, cy))
        line((cx, cy - s, cx, cy + s))
        draw.arc((cx - s // 2, cy - s, cx + s // 2, cy + s), 90, 270, fill=color, width=lw)
        draw.arc((cx - s // 2, cy - s, cx + s // 2, cy + s), -90, 90, fill=color, width=lw)
    elif kind == "search":
        ellipse(-s, -s, s * 4 // 3, s * 4 // 3)
        line((cx + s // 3, cy + s // 3, cx + s, cy + s))
    elif kind == "chat":
        rect(-s, -s // 2, s * 2, s * 4 // 3, 7)
        line((cx - s // 3, cy + s * 5 // 6, cx - s * 2 // 3, cy + s * 4 // 3, cx + s // 4, cy + s * 5 // 6))
        line((cx - s // 2, cy, cx + s // 2, cy), max(1, lw - 1))
        line((cx - s // 2, cy + s // 3, cx + s // 4, cy + s // 3), max(1, lw - 1))
    elif kind == "avatar":
        ellipse(-s // 2, -s, s, s)
        draw.arc((cx - s, cy - s // 5, cx + s, cy + s * 3 // 2), 205, 335, fill=color, width=lw)
        line((cx - s // 2, cy - s // 5, cx - s // 6, cy - s // 5), max(1, lw - 1))
        line((cx + s // 6, cy - s // 5, cx + s // 2, cy - s // 5), max(1, lw - 1))
    elif kind == "presenter":
        rect(-s, -s, s * 2, s * 3 // 2, 3)
        line((cx - s, cy - s // 2, cx + s, cy - s // 2), max(1, lw - 1))
        line((cx - s // 2, cy + s // 2, cx - s // 2, cy + s), max(1, lw - 1))
        line((cx, cy + s // 2, cx, cy + s), max(1, lw - 1))
        line((cx + s // 2, cy + s // 2, cx + s // 2, cy + s), max(1, lw - 1))
    elif kind == "video":
        rect(-s, -s // 2, s * 3 // 2, s, 5)
        draw.polygon([(cx + s // 2, cy - s // 3), (cx + s, cy - s * 2 // 3), (cx + s, cy + s * 2 // 3), (cx + s // 2, cy + s // 3)], outline=color)
        line((cx + s // 2, cy - s // 3, cx + s, cy - s * 2 // 3, cx + s, cy + s * 2 // 3, cx + s // 2, cy + s // 3, cx + s // 2, cy - s // 3))
    elif kind == "wiki":
        rect(-s, -s, s * 2, s * 3 // 2, 4)
        line((cx, cy - s, cx, cy + s // 2), max(1, lw - 1))
        line((cx - s * 3 // 4, cy - s // 2, cx - s // 4, cy - s // 2), max(1, lw - 1))
        line((cx + s // 4, cy - s // 2, cx + s * 3 // 4, cy - s // 2), max(1, lw - 1))
    elif kind == "settings":
        ellipse(-s * 3 // 4, -s * 3 // 4, s * 3 // 2, s * 3 // 2)
        ellipse(-s // 4, -s // 4, s // 2, s // 2)
        for dx, dy in [(0, -s), (0, s), (-s, 0), (s, 0)]:
            line((cx + dx * 3 // 4, cy + dy * 3 // 4, cx + dx, cy + dy), max(1, lw - 1))
    elif kind == "backup":
        draw.arc((cx - s, cy - s, cx + s, cy + s), 35, 320, fill=color, width=lw)
        line((cx + s // 2, cy - s, cx + s, cy - s, cx + s, cy - s // 2))
    elif kind == "server":
        for yy in [-s, -s // 5, s * 3 // 5]:
            rect(-s, yy, s * 2, s // 2, 4)
            draw.ellipse((cx + s // 2, cy + yy + 4, cx + s // 2 + 5, cy + yy + 9), fill=color)
    elif kind == "database":
        draw.ellipse((cx - s, cy - s, cx + s, cy - s // 3), outline=color, width=lw)
        draw.rectangle((cx - s, cy - s * 2 // 3, cx + s, cy + s), outline=color, width=lw)
        draw.arc((cx - s, cy + s // 2, cx + s, cy + s * 7 // 6), 0, 180, fill=color, width=lw)
    elif kind == "ai":
        rect(-s, -s, s * 2, s * 2, 6)
        text(cx, cy - 13, "AI", int(18 * scale), color, True, anchor="ma")
        for dx in [-s * 5 // 4, s * 5 // 4]:
            line((cx + dx, cy - s // 2, cx + dx // 2, cy - s // 2), max(1, lw - 1))
            line((cx + dx, cy + s // 2, cx + dx // 2, cy + s // 2), max(1, lw - 1))
    elif kind == "voice":
        line((cx - s // 2, cy + s // 2, cx - s // 2, cy - s))
        draw.ellipse((cx - s // 2, cy + s // 3, cx, cy + s), outline=color, width=lw)
        line((cx - s // 2, cy - s, cx + s // 2, cy - s // 2))
        for i, h in enumerate([s // 3, s * 2 // 3, s]):
            line((cx + s // 2 + i * 8, cy + h // 2, cx + s // 2 + i * 8, cy - h // 2), max(1, lw - 1))
    elif kind == "engines":
        rect(-s, -s, s * 2, s * 2, 4)
        line((cx - s, cy - s, cx + s, cy + s), max(1, lw - 1))
        line((cx - s, cy, cx, cy + s), max(1, lw - 1))
    elif kind == "launch":
        line((cx - s // 2, cy + s // 2, cx + s // 2, cy - s // 2))
        line((cx + s // 2, cy - s // 2, cx + s // 2, cy + s // 6, cx - s // 6, cy + s // 6))
    elif kind == "input":
        rect(-s, -s, s * 2, s * 2, 4)
        line((cx - s // 2, cy, cx + s // 2, cy), max(1, lw - 1))
        line((cx, cy - s // 2, cx + s // 2, cy, cx, cy + s // 2), max(1, lw - 1))
    elif kind == "profile":
        ellipse(-s // 2, -s, s, s)
        draw.arc((cx - s, cy - s // 5, cx + s, cy + s * 3 // 2), 205, 335, fill=color, width=lw)
        ellipse(s // 3, s // 4, s // 2, s // 2, max(1, lw - 1))
    elif kind == "lipsync":
        ellipse(-s, -s // 2, s * 2, s, width=lw)
        line((cx - s // 2, cy, cx - s // 4, cy + s // 4, cx, cy, cx + s // 4, cy + s // 4, cx + s // 2, cy), max(1, lw - 1))
    elif kind == "output":
        rect(-s, -s, s * 2, s * 3 // 2, 4)
        line((cx - s // 2, cy - s // 2, cx + s // 2, cy - s // 2), max(1, lw - 1))
        line((cx - s // 2, cy, cx + s // 2, cy), max(1, lw - 1))
        line((cx - s // 2, cy + s // 2, cx + s // 2, cy + s // 2), max(1, lw - 1))


def wrap(s: str, chars: int) -> list[str]:
    out: list[str] = []
    for raw in s.split("\n"):
        cur = ""
        for token in raw.split(" "):
            nxt = token if not cur else f"{cur} {token}"
            if len(nxt) <= chars:
                cur = nxt
            else:
                if cur:
                    out.append(cur)
                cur = token
        if cur:
            out.append(cur)
    return out


def feature_card(x, y, w, h, title, body, icon_kind, color):
    neon_rect(x, y, w, h, outline=color, fill="#0b1a31", radius=12, width=2)
    draw_icon(icon_kind, x + 42, y + 55, color, 0.72)
    text(x + 70, y + 22, title, 18, "#f2fbff", True)
    yy = y + 57
    for line in wrap(body, 16):
        text(x + 70, yy, line, 14, "#b9c9da")
        yy += 20


def service_box(x, y, w, h, title, body, icon_kind, color):
    neon_rect(x, y, w, h, outline=color, fill="#0b1a31", radius=10, width=2)
    draw_icon(icon_kind, x + 38, y + 35, color, 0.62)
    text(x + 74, y + 18, title, 18, "#f2fbff", True)
    yy = y + 52
    for line in wrap(body, 28):
        text(x + 74, yy, line, 14, "#b9c9da")
        yy += 18


def arrow(x1, y1, x2, y2, color="#5ee7ff", label=None, n=None, dotted=False):
    import math

    if dotted:
        steps = max(1, int(((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5 / 18))
        pts = []
        for i in range(steps):
            if i % 2 == 0:
                a = i / steps
                b = min(1, (i + 1) / steps)
                pts.extend([(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a), (x1 + (x2 - x1) * b, y1 + (y2 - y1) * b)])
        for i in range(0, len(pts), 2):
            glow_line((pts[i], pts[i + 1]), color, width=2, glow=7)
    else:
        glow_line((x1, y1, x2, y2), color, width=3, glow=8)
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 14
    p1 = (x2 - size * math.cos(ang - 0.5), y2 - size * math.sin(ang - 0.5))
    p2 = (x2 - size * math.cos(ang + 0.5), y2 - size * math.sin(ang + 0.5))
    draw.polygon(((x2, y2), p1, p2), fill=color)
    if n:
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        draw.ellipse((cx - 17, cy - 17, cx + 17, cy + 17), fill="#0c2b46", outline=color, width=3)
        text(cx, cy - 12, str(n), 20, "#ffffff", True, anchor="ma")
    if label:
        mx, my = (x1 + x2) / 2 + 10, (y1 + y2) / 2 + 18
        text(mx, my, label, 14, color, True)


def flow_node(cx, cy, n, title, subtitle, icon_kind, color):
    draw.ellipse((cx - 52, cy - 52, cx + 52, cy + 52), fill="#07182b", outline=color, width=2)
    draw.ellipse((cx - 18, cy - 72, cx + 18, cy - 36), fill="#0b2b45", outline=color, width=3)
    text(cx, cy - 69, str(n), 21, "#ffffff", True, anchor="ma")
    draw_icon(icon_kind, cx, cy - 16, color, 0.9)
    text(cx, cy + 62, title, 17, color, True, anchor="mm")
    text(cx, cy + 86, subtitle, 14, "#d8e6f3", False, anchor="mm")


# Background grid and circuit accents
for x in range(0, W, 36):
    draw.line((x, 0, x, H), fill="#0b1b2d", width=1)
for y in range(0, H, 36):
    draw.line((0, y, W, y), fill="#0b1b2d", width=1)
for x in range(25, W, 150):
    draw.line((x, 18, x + 55, 18), fill="#0e3c66", width=2)
    draw.line((x + 55, 18, x + 70, 5), fill="#0e3c66", width=2)
for x in range(W - 320, W - 30, 110):
    draw.line((x, 38, x + 72, 38), fill="#0e3c66", width=2)
    draw.ellipse((x + 70, 36, x + 75, 41), fill="#16d4ff")

text(W / 2, 20, "Mental Avatar — Workflow Structure & Feature Map", 40, "#eaf8ff", True, anchor="ma")
text(W / 2, 74, "지식 그래프 · AI 대화 · STT/TTS · 한국어 립싱크 · 발표 영상 · 아바타 미디어 파이프라인", 24, "#d8e6f3", True, anchor="ma")

# Left browser
neon_rect(22, 100, 280, 580, "#39d8ff", "#07182b", radius=16)
text(67, 122, "●", 36, "#77e8ff", True)
text(105, 124, "사용자 / Browser", 22, "#66eaff", True)
neon_rect(84, 162, 157, 95, "#8acfff", "#132941", radius=11)
draw_icon("globe", 162, 210, "#ccefff", 1.25)
nav_items = ["Dashboard Embed", "KG Search", "AI Chat", "3D Avatar", "Video Studio", "Presenter", "Settings"]
for i, item in enumerate(nav_items):
    y = 273 + i * 43
    neon_rect(43, y, 226, 34, "#8ab7dc" if i != 5 else "#39d8ff", "#10243b", radius=6, width=1)
    draw_icon(["globe", "search", "chat", "avatar", "video", "presenter", "settings"][i], 76, y + 17, "#d7efff", 0.28)
    text(103, y + 6, item, 17, "#dbeeff")

# Center frontend shell
neon_rect(358, 112, 790, 520, "#3d95d8", "#07182b", radius=14)
text(395, 130, "⚛  Mental Avatar Frontend", 26, "#66eaff", True)
neon_rect(390, 175, 705, 420, "#45729d", "#0a1628", radius=12, width=1)
text(835, 196, "Interactive App Pages", 24, "#eaf8ff", True, anchor="ma")

feature_card(407, 236, 160, 170, "기억 검색", "문서/노트/대화 검색\n그래프 시각화", "search", "#84f06d")
feature_card(579, 236, 160, 170, "AI 대화", "프로필·기억 기반\n말투 반영 응답", "chat", "#77cfff")
feature_card(751, 236, 160, 170, "3D 아바타", "GLB 표정·입모양\nSTT/TTS 연동", "avatar", "#56f0c8")
feature_card(923, 236, 160, 170, "발표", "PPT/PDF→대본\n아바타 WebM", "presenter", "#c57bff")
feature_card(407, 420, 160, 150, "영상 도구", "SadTalker\nFaceSwap", "video", "#ffb35c")
feature_card(579, 420, 160, 150, "Wiki/Graphify", "자동 요약\n지식 연결", "wiki", "#8b8cff")
feature_card(751, 420, 160, 150, "설정", "프로필·음성\n서비스 상태", "settings", "#67dfff")
feature_card(923, 420, 160, 150, "백업/복구", "데이터 보존\n임시 정리", "backup", "#d984ff")

# Right service layer
neon_rect(1260, 100, 380, 580, "#7aa7dc", "#07182b", radius=16)
text(1302, 124, "▰  Service & AI Layer", 24, "#7bdcff", True)
service_box(1285, 168, 322, 64, "Flask API : 127.0.0.1:8766", "라우팅 · 상태 · 백업 · 복원", "server", "#7fd4ff")
service_box(1285, 262, 322, 64, "KG / Local Stores", "SQLite graph · files · memory", "database", "#8df27a")
service_box(1285, 350, 322, 68, "Ollama / LLM", "대화 · 요약 · 대본 · 분석", "ai", "#c57bff")
service_box(1285, 443, 322, 70, "Voice & Lip Sync", "XTTS · Whisper · KO viseme", "voice", "#ff8bd1")
service_box(1285, 538, 322, 90, "Avatar / Video Engines", "GLB morph · SadTalker · FaceSwap · Presenter", "engines", "#80eaff")

# Main arrows
arrow(270, 292, 390, 292, "#56e6ff", n=1)
arrow(1095, 305, 1285, 205, "#56e6ff", n=2, label="API calls")
arrow(1095, 330, 1285, 295, "#91f279", n=3, label="memory")
arrow(1095, 360, 1285, 385, "#c57bff", n=4, label="LLM")
arrow(1095, 420, 1285, 478, "#ff8bd1", n=5, label="voice")
arrow(1095, 475, 1285, 583, "#80eaff", n=6, label="video")
arrow(1607, 203, 1607, 583, "#36dfff", n=7, dotted=True, label="status")

# Bottom automation and data flow
neon_rect(22, 698, 1338, 220, "#466b9c", "#07182b", radius=16)
text(596, 716, "⚙  Automation & Media/Data Flow", 24, "#66eaff", True)
nodes = [
    (95, "App Start", "5173→5174", "launch", "#6ee7ff"),
    (300, "Input Capture", "문서·음성·PPT", "input", "#8df27a"),
    (505, "KG / Profile", "검색·개인화", "profile", "#ffd566"),
    (710, "AI Compose", "응답·대본", "ai", "#7bdcff"),
    (915, "TTS / STT", "XTTS·Whisper", "voice", "#8db7ff"),
    (1120, "Korean Lip Sync", "KO viseme", "lipsync", "#c57bff"),
    (1300, "Video Output", "WebM·MP4", "output", "#ff8bd1"),
]
for idx, (cx, title, sub, icon, color) in enumerate(nodes, start=1):
    flow_node(cx, 800, idx, title, sub, icon, color)
for i in range(len(nodes) - 1):
    arrow(nodes[i][0] + 58, 800, nodes[i + 1][0] - 58, 800, nodes[i + 1][4], dotted=(i >= 3))

# Key
neon_rect(1383, 698, 255, 220, "#466b9c", "#07182b", radius=12)
text(1510, 718, "범례 (Flow Key)", 18, "#eaf8ff", True, anchor="ma")
legend = [
    ("UI 탐색 / 페이지 흐름", "#56e6ff", False),
    ("데이터 저장 / 동기화", "#91f279", False),
    ("AI 처리 / 응답", "#c57bff", True),
    ("음성·립싱크", "#ff8bd1", False),
    ("영상 생성", "#80eaff", False),
]
for i, (label, color, dotted) in enumerate(legend):
    y = 760 + i * 30
    arrow(1408, y, 1465, y, color, dotted=dotted)
    text(1482, y - 10, label, 15, "#dbeeff")

# Feature summary footer
neon_rect(360, 640, 790, 40, "#c57bff", "#0a1628", radius=10, width=1)
text(
    755,
    650,
    "핵심 발표 흐름: PPT/PDF → 슬라이드/대본 → TTS WAV → Whisper+한글 분해 → GLB 모프타겟 → WebM 저장",
    17,
    "#f7ecff",
    True,
    anchor="ma",
)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT)
print(str(OUT))
