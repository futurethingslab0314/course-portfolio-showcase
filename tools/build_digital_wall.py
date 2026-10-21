import argparse
import html
import json
import math
import pathlib
from typing import Any, Dict, List


REFINEMENT_WEIGHTS = {
    "空間魔法師": 0.12,
    "好方便": 0.18,
    "省錢": 0.28,
    "適應": 0.38,
    "平衡": 0.45,
    "借放": 0.52,
    "切割": 0.58,
    "網子": 0.62,
    "修補": 0.68,
    "壓制": 0.74,
    "偽裝": 0.82,
    "硬要": 0.88,
}

STICKY_COLORS = ["#e9ff51", "#ff7b61", "#76ddd6", "#d7a4ff", "#ff7eb6"]

REFERENCE_WALL_NOTES = [
    {"text": "好方便", "x": 8, "y": 31, "color": "#e9ff51"},
    {"text": "靠牆扶手", "x": 9, "y": 39, "color": "#ff7b61"},
    {"text": "暫時固定", "x": 9, "y": 52, "color": "#76ddd6"},
    {"text": "支撐", "x": 10, "y": 57, "color": "#d7a4ff"},
    {"text": "待辨識", "x": 20, "y": 57, "color": "#76ddd6", "uncertain": True},
    {"text": "待辨識", "x": 46, "y": 26, "color": "#e9ff51", "uncertain": True},
    {"text": "重複警示", "x": 45, "y": 32, "color": "#e9ff51"},
    {"text": "百年修補", "x": 53, "y": 32, "color": "#ff7b61"},
    {"text": "待辨識", "x": 53, "y": 18, "color": "#ff9a85", "uncertain": True},
    {"text": "暫時置物", "x": 62, "y": 38, "color": "#e9ff51"},
    {"text": "另類固定", "x": 68, "y": 38, "color": "#e9ff51"},
    {"text": "重複施工", "x": 82, "y": 38, "color": "#76ddd6"},
    {"text": "神奇修補", "x": 57, "y": 76, "color": "#76ddd6"},
    {"text": "丁", "x": 33, "y": 13, "color": "#d7a4ff"},
    {"text": "待辨識", "x": 22, "y": 16, "color": "#76ddd6", "uncertain": True},
    {"text": "保護", "x": 31, "y": 38, "color": "#d7a4ff"},
    {"text": "補丁", "x": 44, "y": 12, "color": "#d7a4ff"},
    {"text": "修補扶手", "x": 59, "y": 11, "color": "#ff7b61"},
    {"text": "延長", "x": 63, "y": 13, "color": "#d7a4ff"},
    {"text": "76", "x": 77, "y": 16, "color": "#76ddd6"},
    {"text": "遺落物", "x": 75, "y": 25, "color": "#d7a4ff"},
    {"text": "樹枝日", "x": 83, "y": 41, "color": "#e9ff51"},
    {"text": "無印良品", "x": 90, "y": 41, "color": "#e9ff51"},
    {"text": "停車", "x": 24, "y": 65, "color": "#d7a4ff"},
    {"text": "紅椅警示", "x": 43, "y": 72, "color": "#ff7b61"},
    {"text": "待辨識", "x": 55, "y": 69, "color": "#76ddd6", "uncertain": True},
    {"text": "同意書", "x": 49, "y": 91, "color": "#d7a4ff"},
    {"text": "強迫症", "x": 72, "y": 75, "color": "#ff7b61"},
    {"text": "沒關係", "x": 91, "y": 93, "color": "#ff7b61"},
    {"text": "路不平", "x": 22, "y": 27, "color": "#e9ff51"},
    {"text": "無印良", "x": 8, "y": 38, "color": "#e9ff51"},
    {"text": "維持", "x": 17, "y": 40, "color": "#e9ff51"},
    {"text": "屋住", "x": 28, "y": 51, "color": "#e9ff51"},
    {"text": "禁止", "x": 35, "y": 57, "color": "#e9ff51"},
    {"text": "無色偽裝", "x": 43, "y": 68, "color": "#ff7b61"},
    {"text": "阻止", "x": 61, "y": 67, "color": "#d7a4ff"},
    {"text": "同意書", "x": 71, "y": 39, "color": "#d7a4ff"},
    {"text": "注意", "x": 83, "y": 62, "color": "#ff7b61"},
    {"text": "這不是垃圾", "x": 88, "y": 55, "color": "#76ddd6"},
    {"text": "待辨識", "x": 51, "y": 8, "color": "#ff7eb6", "uncertain": True},
]


def _stable_fraction(seed: str, salt: int) -> float:
    value = 0
    for char in f"{seed}:{salt}":
        value = (value * 131 + ord(char)) % 1000003
    return value / 1000003


def _axis_score(tags: List[str]) -> float:
    scores = [REFINEMENT_WEIGHTS[tag] for tag in tags if tag in REFINEMENT_WEIGHTS]
    if not scores:
        return 0.5
    return sum(scores) / len(scores)


def _wall_shape_y_adjustment(x: float) -> float:
    center_lift = -8 * math.exp(-((x - 50) / 20) ** 2)
    side_drop = 8 * (abs(x - 50) / 50) ** 1.4
    return center_lift + side_drop


def _card_size(index: int, seed: str) -> Dict[str, float]:
    landscape = _stable_fraction(seed, 7) > 0.38
    if landscape:
        return {"w": 3.82 + (index % 3) * 0.13, "h": 2.68 + (index % 2) * 0.1}
    return {"w": 2.85 + (index % 2) * 0.12, "h": 3.9 + (index % 3) * 0.1}


def _spread_positions(count: int, x_min: float, x_max: float, y: float, row_index: int) -> List[Dict[str, float]]:
    slots = []
    if count == 1:
        xs = [(x_min + x_max) / 2]
    else:
        xs = [x_min + column * ((x_max - x_min) / (count - 1)) for column in range(count)]
    for column, x in enumerate(xs):
        seed = f"slot:{row_index}:{column}"
        stagger = (_stable_fraction(seed, 1) - 0.5) * 4.2
        stagger += ((row_index % 4) - 1.5) * 0.9
        vertical_stagger = (_stable_fraction(seed, 2) - 0.5) * 2.1
        gap = 0
        if row_index in {1, 3, 6} and column > count * 0.62:
            gap += 2.8
        if row_index in {4, 5, 8} and count * 0.30 < column < count * 0.44:
            gap += 2.4
        slots.append(
            {
                "x": min(96, max(4, x + stagger + gap)),
                "y": min(92, max(8, y + vertical_stagger)),
            }
        )
    return slots


def _reference_wall_slots(total: int) -> List[Dict[str, float]]:
    rows = [
        (7, 19, 72, 12),
        (10, 16, 91, 18),
        (13, 7, 96, 27),
        (15, 6, 94, 35),
        (18, 5, 91, 43),
        (17, 6, 88, 51),
        (20, 4, 96, 59),
        (17, 7, 91, 67),
        (15, 10, 88, 75),
        (11, 18, 83, 82),
        (6, 30, 77, 88),
        (3, 47, 72, 92),
    ]
    slots: List[Dict[str, float]] = []
    for row_index, (count, x_min, x_max, y) in enumerate(rows):
        slots.extend(_spread_positions(count, x_min, x_max, y, row_index))
    slots = slots[:total]
    if len(slots) < total:
        for index in range(total - len(slots)):
            slots.append({"x": 8 + (index * 7) % 84, "y": 88 + (index % 2) * 4})
    return slots


def _position_for(index: int, total: int, item: Dict[str, Any]) -> Dict[str, float]:
    seed = str(item.get("id") or item.get("assignmentName") or index)
    slot = _reference_wall_slots(total)[index]
    x = slot["x"]
    y = slot["y"]

    return {
        "x": round(min(96, max(4, x)), 2),
        "y": round(min(90, max(8, y)), 2),
        "rotation": round((_stable_fraction(seed, 3) - 0.5) * 5, 2),
    }


def _notes_for(item: Dict[str, Any]) -> List[Dict[str, str]]:
    return []


def build_wall_model(payload: Dict[str, Any]) -> Dict[str, Any]:
    project = next(
        project
        for project in payload["projects"]
        if project.get("projectName") == "Taiwan Solution"
    )
    source_database_id = project.get("sourceDatabaseId")
    works = [
        work
        for work in payload.get("studentWorks", [])
        if work.get("sourceDatabaseId") == source_database_id
    ]
    photo_works = [work for work in works if work.get("mainImage")]
    group_count = sum(1 for work in works if work.get("cardCaseRecordType") == "group")

    items = []
    for index, work in enumerate(photo_works):
        position = _position_for(index, len(photo_works), work)
        size = _card_size(index, str(work.get("id") or index))
        items.append(
            {
                "id": work.get("id"),
                "title": work.get("assignmentName") or "Untitled",
                "group": work.get("group") or "",
                "members": work.get("members") or [],
                "image": work.get("mainImage"),
                "thumbnail": work.get("mainImageThumbnail") or work.get("mainImage"),
                "preview": work.get("mainImagePreview") or work.get("mainImage"),
                "notes": _notes_for(work),
                **position,
                **size,
            }
        )

    return {
        "course": payload.get("course", {}).get("courseName", ""),
        "slug": payload.get("course", {}).get("slug", ""),
        "project": project.get("projectName", ""),
        "axis": {
            "top": "將就得很精緻",
            "bottom": "將就得很隨意",
        },
        "summary": {
            "workCount": len(works),
            "photoCount": len(items),
            "groupCount": group_count,
        },
        "wallNotes": REFERENCE_WALL_NOTES,
        "items": items,
    }


def render_html(model: Dict[str, Any]) -> str:
    data_json = json.dumps(model, ensure_ascii=False)
    title = html.escape(f"{model['course']} / {model['project']} 數位牆面")
    storage_slug = str(model.get("slug") or "wall").lower()
    project_slug = str(model.get("project") or "project").lower().replace(" ", "-")
    storage_key = f"digital-wall-positions:{storage_slug}:{project_slug}"
    if model.get("layoutRevision"):
        storage_key += f":{model['layoutRevision']}"
    notes_key = f"digital-wall-notes:{storage_slug}:{project_slug}"
    if model.get("notesRevision"):
        notes_key += f":{model['notesRevision']}"
    return f"""<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <style>
    :root {{
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif;
      background: #f2eee6;
      color: #1e1a16;
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; padding: 28px; }}
    header {{ display: flex; align-items: end; justify-content: space-between; gap: 24px; margin: 0 auto 18px; max-width: 1500px; }}
    h1 {{ margin: 0; font-size: clamp(24px, 4vw, 52px); line-height: .95; letter-spacing: 0; }}
    .meta {{ color: #6c6258; font-size: 13px; text-align: right; }}
    .toolbar {{
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      max-width: 1500px;
      margin: 0 auto 14px;
    }}
    .toolbar button, .toolbar input {{
      border: 1px solid rgba(30,23,17,.22);
      background: rgba(255,255,255,.84);
      color: #241d18;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(30,23,17,.08);
    }}
    .toolbar input[type="text"] {{ width: 150px; cursor: text; }}
    .toolbar input[type="color"] {{ width: 38px; height: 32px; padding: 2px; }}
    .save-status {{ min-width: 96px; color: #766b60; font-size: 12px; text-align: right; }}
    .wall-wrap {{ max-width: 1500px; margin: 0 auto; }}
    .wall {{
      position: relative;
      aspect-ratio: {model.get('wallAspectRatio', 2.58)} / 1;
      min-width: 1100px;
      overflow: hidden;
      background:
        radial-gradient(circle at 16% 5%, rgba(255,255,255,.9), transparent 18%),
        radial-gradient(circle at 57% 4%, rgba(255,255,255,.75), transparent 20%),
        radial-gradient(circle at 82% 5%, rgba(255,255,255,.65), transparent 18%),
        linear-gradient(180deg, #ddd2c4, #eee8dd 18%, #d8cfc2 100%);
      border: 1px solid rgba(55,44,32,.22);
      box-shadow: inset 0 0 90px rgba(70,50,30,.18), 0 24px 80px rgba(52,42,32,.18);
    }}
    .axis {{
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 4;
    }}
    .axis::before, .axis::after {{
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0;
      color: #333;
      padding: 2px 12px;
    }}
    .axis::before {{ content: "將就得很精緻"; top: 4px; }}
    .axis::after {{ content: "將就得很隨意"; bottom: 8px; }}
    .photo {{
      position: absolute;
      width: calc(var(--w) * 1%);
      height: auto;
      aspect-ratio: auto;
      left: calc(var(--x) * 1%);
      top: calc(var(--y) * 1%);
      transform: translate(-50%, -50%) rotate(calc(var(--r) * 1deg));
      background: #fff;
      padding: 1px;
      border: 1px solid rgba(0,0,0,.12);
      box-shadow: 0 5px 11px rgba(30,23,17,.22);
      transition: transform .16s ease, z-index .16s ease, box-shadow .16s ease;
      z-index: 2;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }}
    .photo.dragging {{ cursor: grabbing; z-index: 50; box-shadow: 0 20px 48px rgba(30,23,17,.35); }}
    .photo:hover {{
      z-index: 30;
      box-shadow: 0 20px 48px rgba(30,23,17,.35);
    }}
    .photo img {{ width: 100%; height: auto; object-fit: contain; display: block; background: #fff; }}
    .wall-note {{
      position: absolute;
      left: calc(var(--x) * 1%);
      top: calc(var(--y) * 1%);
      transform: translate(-50%, -50%) rotate(calc(var(--r) * 1deg));
      z-index: 12;
      min-width: 28px;
      max-width: 64px;
      padding: 4px 5px;
      color: #332a23;
      font-size: 8px;
      font-weight: 800;
      line-height: 1.18;
      text-align: center;
      box-shadow: 0 3px 7px rgba(30,23,17,.18);
      border: 1px solid rgba(0,0,0,.06);
      overflow-wrap: anywhere;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }}
    .wall-note.selected {{ outline: 3px solid rgba(0,0,0,.55); z-index: 60; }}
    .wall-note.dragging {{ cursor: grabbing; z-index: 70; }}
    .wall-note.uncertain {{
      border: 2px dashed rgba(30,23,17,.72);
      background-image: repeating-linear-gradient(-45deg, rgba(255,255,255,.45) 0 6px, rgba(0,0,0,.08) 6px 12px);
      color: #221b15;
    }}
    .wall-note.uncertain::after {{
      content: "模糊待確認";
      display: block;
      margin-top: 3px;
      font-size: 7px;
      font-weight: 900;
      letter-spacing: 0;
      color: #7a1f12;
    }}
    .caption {{
      position: absolute;
      left: 50%;
      top: calc(100% + 5px);
      transform: translateX(-50%);
      width: 140px;
      display: none;
      background: rgba(255,255,255,.92);
      border: 1px solid rgba(0,0,0,.08);
      padding: 5px 6px;
      font-size: 10px;
      line-height: 1.25;
      box-shadow: 0 4px 10px rgba(0,0,0,.12);
    }}
    .photo:hover .caption {{ display: block; }}
    footer {{ max-width: 1500px; margin: 14px auto 0; color: #7b7065; font-size: 12px; }}
    @media (max-width: 760px) {{
      body {{ padding: 14px; }}
      header {{ display: block; }}
      .meta {{ text-align: left; margin-top: 8px; }}
      .wall-wrap {{ overflow-x: auto; }}
    }}
    .wall-wrap {{ overflow-x: auto; }}
    .toolbar {{ flex-wrap: wrap; }}
    .view-controls {{ max-width: 1500px; margin: 0 auto 12px; display: flex; flex-wrap: wrap; gap: 24px; align-items: center; font-size: 13px; }}
    .view-controls label {{ display: flex; align-items: center; gap: 8px; }}
    .view-controls input {{ width: 130px; }}
    .view-controls output {{ min-width: 42px; font-variant-numeric: tabular-nums; }}
    .wall .photo {{ width: calc((var(--photo-size, 3) * 1% - 4px) * var(--photo-ratio, 1) + 4px); }}
    .wall.reference-view {{ background: url('reference-wall.jpg') center / 100% 100% no-repeat; }}
    .wall.reference-view > * {{ visibility: hidden; }}
    .wall.grid-layout:not(.reference-view) {{
      background-color: #fff;
      background-image: linear-gradient(to right, rgba(70,70,70,.13) 1px, transparent 1px), linear-gradient(to bottom, rgba(70,70,70,.13) 1px, transparent 1px), linear-gradient(to bottom, #fff 0%, #b8b8b8 100%);
      background-size: calc(100% / var(--grid-columns)) calc(100% / var(--grid-rows)), calc(100% / var(--grid-columns)) calc(100% / var(--grid-rows)), 100% 100%;
      box-shadow: none;
    }}
    .pending {{ max-width: 1500px; margin: 24px auto; }}
    .pending h2 {{ font-size: 16px; }}
    .pending-list {{ display: flex; flex-wrap: wrap; gap: 16px; align-items: start; }}
    .photo.pending-photo {{ position: relative; left: auto; top: auto; width: 130px; transform: none; }}
    .pending-actions {{ display: none; }}
    .pending-photo .pending-actions {{ display: grid; gap: 6px; padding: 8px 3px; font-size: 12px; overflow-wrap: anywhere; }}
    .pending-actions button {{ padding: 6px; cursor: pointer; background: white; border: 1px solid #aaa; }}
    .wall-note.source-note {{ width: calc(var(--note-width, 1.8) * 1%); min-width: 0; max-width: none; padding: 0; border: 0; transform: translate(-50%, -50%); }}
    .source-note img {{ display: block; width: 100%; height: auto; pointer-events: none; }}
    .source-note.uncertain {{ outline: 1px dashed #983c21; }}
    .source-note.uncertain::after {{ content: '?'; position: absolute; right: -3px; bottom: -3px; margin: 0; background: white; padding: 1px 3px; font-size: 10px; }}
    #noteReference {{ position: fixed; right: 16px; bottom: 16px; width: 280px; max-width: calc(100vw - 32px); padding: 14px; background: white; border: 1px solid #aaa; box-shadow: 0 6px 24px #0003; z-index: 100; }}
    #noteReference img {{ width: 100%; max-height: 240px; object-fit: contain; }}
    #noteReference p {{ white-space: pre-wrap; font-size: 14px; margin: 8px 0 0; }}
    #closeNoteReference {{ float: right; border: 0; background: transparent; cursor: pointer; font-size: 20px; }}
  </style>
</head>
<body>
  <header>
    <h1>{title}</h1>
    <div class="meta">照片 {model['summary']['photoCount']} 張 / 分組 {model['summary']['groupCount']} 組<br />上：將就得很精緻，下：將就得很隨意</div>
  </header>
  <div class="toolbar" aria-label="Edit wall controls">
    <button type="button" id="compareWall" aria-pressed="false">對照實體牆</button>
    <button type="button" id="arrangeGrid">格位排列</button>
    <button type="button" id="restoreLayout">還原排列</button>
    <button type="button" id="exportPositions">Export Positions</button>
    <button type="button" id="addNote">Add Post-it</button>
    <button type="button" id="deleteNote">Delete Post-it</button>
    <input type="text" id="noteText" placeholder="Post-it text" aria-label="Post-it text" />
    <input type="color" id="noteColor" value="#e9ff51" aria-label="Post-it color" />
    <button type="button" id="resetPositions">Reset Positions</button>
    <span class="save-status" id="saveStatus">Auto-save on</span>
  </div>
  <div class="view-controls">
    <label>牆面縮放 <input id="wallZoom" type="range" min="100" max="300" step="10" value="150" /><output id="wallZoomValue">150%</output></label>
    <label>照片尺寸 <input id="photoSize" type="range" min="1.5" max="5" step="0.1" value="3" /><output id="photoSizeValue">100%</output></label>
  </div>
  <main class="wall-wrap">
    <section class="wall" id="wall" aria-label="Taiwan Solution digital coordinate wall">
      <div class="axis" aria-hidden="true"></div>
    </section>
  </main>
  <section class="pending" id="pendingSection" hidden>
    <h2>待放置照片 <span id="pendingCount"></span></h2>
    <div class="pending-list" id="pendingPhotos"></div>
  </section>
  <footer>Observation on the Road / Taiwan Solution</footer>
  <aside id="noteReference" hidden aria-label="便利貼實拍原稿">
    <button id="closeNoteReference" type="button" aria-label="關閉原稿">×</button>
    <img id="noteReferenceImage" alt="便利貼實拍原稿" />
    <p id="noteReferenceText"></p>
    <p id="noteReferenceStatus"></p>
  </aside>
  <script id="wall-data" type="application/json">{data_json}</script>
  <script>
    const model = JSON.parse(document.getElementById('wall-data').textContent);
    const wall = document.getElementById('wall');
    const storageKey = '{storage_key}';
    const notesStorageKey = '{notes_key}';
    const viewStorageKey = storageKey + ':view';
    const wallZoom = document.getElementById('wallZoom');
    const photoSize = document.getElementById('photoSize');
    try {{
      const savedView = JSON.parse(localStorage.getItem(viewStorageKey) || '{{}}');
      if (Number.isFinite(savedView.zoom)) wallZoom.value = savedView.zoom;
      if (Number.isFinite(savedView.size)) photoSize.value = savedView.size;
    }} catch {{}}
    function applyView() {{
      wall.style.width = wallZoom.value + '%';
      wall.style.setProperty('--photo-size', model.grid ? (80 / model.grid.columns) * Number(photoSize.value) / 3 : photoSize.value);
      if (model.grid) {{
        wall.classList.add('grid-layout');
        wall.style.setProperty('--grid-columns', model.grid.columns);
        wall.style.setProperty('--grid-rows', model.grid.rows);
        if (!wall.classList.contains('reference-view')) wall.style.aspectRatio = model.grid.columns + ' / ' + model.grid.rows;
      }}
      document.getElementById('wallZoomValue').value = wallZoom.value + '%';
      document.getElementById('photoSizeValue').value = Math.round(Number(photoSize.value) / 3 * 100) + '%';
    }}
    applyView();
    for (const control of [wallZoom, photoSize]) {{
      control.addEventListener('input', () => {{
        applyView();
        localStorage.setItem(viewStorageKey, JSON.stringify({{zoom: Number(wallZoom.value), size: Number(photoSize.value)}}));
      }});
    }}
    const saveStatus = document.getElementById('saveStatus');
    const noteText = document.getElementById('noteText');
    const noteColor = document.getElementById('noteColor');
    let selectedNote = null;
    function loadSavedPositions() {{
      try {{
        return JSON.parse(localStorage.getItem(storageKey) || '{{}}');
      }} catch {{
        return {{}};
      }}
    }}
    function savePositions() {{
      const positions = {{}};
      for (const item of model.items) {{
        if (item.alignmentStatus !== 'unmatched') {{
          positions[item.id] = {{ x: Number(item.x.toFixed(2)), y: Number(item.y.toFixed(2)), placed: true }};
        }}
      }}
      localStorage.setItem(storageKey, JSON.stringify(positions));
      saveStatus.textContent = 'Saved';
      window.setTimeout(() => {{ saveStatus.textContent = 'Auto-save on'; }}, 900);
    }}
    function loadSavedNotes() {{
      try {{
        return JSON.parse(localStorage.getItem(notesStorageKey) || 'null');
      }} catch {{
        return null;
      }}
    }}
    function saveNotes() {{
      localStorage.setItem(notesStorageKey, JSON.stringify(model.wallNotes || []));
      saveStatus.textContent = 'Notes saved';
      window.setTimeout(() => {{ saveStatus.textContent = 'Auto-save on'; }}, 900);
    }}
    function applyPosition(card, item) {{
      card.style.setProperty('--x', item.x);
      card.style.setProperty('--y', item.y);
    }}
    const savedPositions = loadSavedPositions();
    const savedNotes = loadSavedNotes();
    if (Array.isArray(savedNotes)) {{
      model.wallNotes = savedNotes;
    }}
    for (const item of model.items) {{
      if (savedPositions[item.id]) {{
        item.x = Number(savedPositions[item.id].x);
        item.y = Number(savedPositions[item.id].y);
        if (savedPositions[item.id].placed) item.alignmentStatus = 'manual';
      }}
    }}
    const gridStorageKey = storageKey + ':grid-v1';
    const backupStorageKey = gridStorageKey + ':backup';
    function readGridState() {{
      try {{ return JSON.parse(localStorage.getItem(gridStorageKey) || 'null'); }} catch {{ return null; }}
    }}
    function arrangeGrid() {{
      const placed = model.items.filter(item => item.alignmentStatus !== 'unmatched');
      if (!placed.length) return;
      localStorage.setItem(backupStorageKey, JSON.stringify({{
        items: model.items.map(item => ({{id:item.id, x:item.x, y:item.y, rotation:item.rotation, alignmentStatus:item.alignmentStatus}})),
        notes: model.wallNotes, notesRevision: model.notesRevision, grid: model.grid || null
      }}));
      const columns = 32;
      const bands = new Map();
      for (const item of placed) {{
        const row = Math.round(item.y / 6);
        if (!bands.has(row)) bands.set(row, []);
        bands.get(row).push(item);
      }}
      const cells = [];
      for (const [row, items] of bands) {{
        items.sort((a,b) => a.x - b.x);
        // Monotonic assignment keeps the left-to-right order within each row.
        const count = Math.max(columns, items.length);
        const dp = Array.from({{length:items.length + 1}}, () => Array(count + 1).fill(Infinity));
        const take = Array.from({{length:items.length + 1}}, () => Array(count + 1).fill(false));
        dp[0].fill(0);
        for (let i=1; i<=items.length; i++) {{
          for (let c=1; c<=count; c++) {{
            const cost = dp[i-1][c-1] + Math.pow(c-1 - items[i-1].x / 100 * (columns-1), 2);
            if (cost < dp[i][c-1]) {{ dp[i][c]=cost; take[i][c]=true; }}
            else dp[i][c]=dp[i][c-1];
          }}
        }}
        let i=items.length, c=count;
        while (i>0) {{
          if (take[i][c]) {{ cells.push({{item:items[i-1], col:c-1, row}}); i--; }}
          c--;
        }}
      }}
      const minCol=Math.min(...cells.map(c=>c.col))-1;
      const maxCol=Math.max(...cells.map(c=>c.col))+1;
      const minRow=Math.min(...cells.map(c=>c.row))-1;
      const maxRow=Math.max(...cells.map(c=>c.row))+1;
      model.grid={{columns:maxCol-minCol+1, rows:maxRow-minRow+1}};
      wallZoom.value='100';
      localStorage.setItem(viewStorageKey, JSON.stringify({{zoom:100,size:Number(photoSize.value)}}));
      for (const cell of cells) {{
        cell.item.x=(cell.col-minCol+.5)/model.grid.columns*100;
        cell.item.y=(cell.row-minRow+.5)/model.grid.rows*100;
        cell.item.rotation=0;
      }}
      for (const note of model.wallNotes || []) {{
        note.x=Math.max(1,Math.min(99,(note.x/100*(columns-1)-minCol+.5)/model.grid.columns*100));
        note.y=Math.max(1,Math.min(99,(note.y/6-minRow+.5)/model.grid.rows*100));
      }}
      localStorage.setItem(gridStorageKey, JSON.stringify(model.grid));
      savePositions(); saveNotes();
    }}
    const gridState = readGridState();
    if (!gridState) arrangeGrid();
    else if (!gridState.disabled) {{
      model.grid = gridState;
      model.items.filter(item=>item.alignmentStatus !== 'unmatched').forEach(item=>item.rotation=0);
    }}
    if (model.notesRevision && !Array.isArray(savedNotes)) {{
      for (const note of model.wallNotes) {{
        const anchor=model.items.find(item=>item.id===note.anchorPhotoId);
        if (!anchor) continue;
        note.x=Math.max(1,Math.min(99,anchor.x+note.anchorOffset.x*(model.grid?32/model.grid.columns:1)));
        note.y=Math.max(1,Math.min(99,anchor.y+note.anchorOffset.y*(model.grid?100/6/model.grid.rows:1)));
      }}
      saveNotes();
    }}
    if (model.grid) photoSize.max='3.4';
    applyView();
    document.getElementById('arrangeGrid').addEventListener('click', () => {{ arrangeGrid(); window.location.reload(); }});
    document.getElementById('restoreLayout').addEventListener('click', () => {{
      const raw = localStorage.getItem(backupStorageKey);
      if (!raw) return;
      const backup=JSON.parse(raw);
      const positions={{}};
      for (const item of backup.items) {{
        if (item.alignmentStatus !== 'unmatched') positions[item.id]={{x:item.x,y:item.y,placed:true}};
      }}
      localStorage.setItem(storageKey, JSON.stringify(positions));
      if(backup.notesRevision === model.notesRevision) localStorage.setItem(notesStorageKey, JSON.stringify(backup.notes));
      else localStorage.removeItem(notesStorageKey);
      localStorage.setItem(gridStorageKey, JSON.stringify(backup.grid || {{disabled:true}}));
      window.location.reload();
    }});
    function updatePendingCount() {{
      const count=document.querySelectorAll('#pendingPhotos .photo').length;
      document.getElementById('pendingCount').textContent = `（${{count}} 張）`;
      document.getElementById('pendingSection').hidden = false;
    }}
    function placeFromTray(card, item) {{
      const bounds=wall.getBoundingClientRect();
      const viewport=wall.parentElement.getBoundingClientRect();
      item.x=Math.max(3,Math.min(97,((Math.max(0,viewport.left)+Math.min(innerWidth,viewport.right))/2-bounds.left)/bounds.width*100));
      item.y=Math.max(3,Math.min(97,((Math.max(0,bounds.top)+Math.min(innerHeight,bounds.bottom))/2-bounds.top)/bounds.height*100));
      if (model.grid) {{
        const occupied=new Set(model.items.filter(i=>i!==item&&i.alignmentStatus!=='unmatched').map(i=>Math.floor(i.x/100*model.grid.columns)+','+Math.floor(i.y/100*model.grid.rows)));
        let best=null;
        for(let r=0;r<model.grid.rows;r++) for(let c=0;c<model.grid.columns;c++) {{
          if(occupied.has(c+','+r)) continue;
          const x=(c+.5)/model.grid.columns*100, y=(r+.5)/model.grid.rows*100;
          const distance=Math.pow((x-item.x)*bounds.width,2)+Math.pow((y-item.y)*bounds.height,2);
          if(!best||distance<best.distance) best={{x,y,distance}};
        }}
        if(best) {{item.x=best.x;item.y=best.y;}}
      }}
      item.alignmentStatus='manual'; item.rotation=0;
      card.classList.remove('pending-photo'); card.style.setProperty('--r',0);
      wall.appendChild(card); applyPosition(card,item); savePositions(); updatePendingCount();
      card.scrollIntoView({{block:'center',inline:'nearest',behavior:'smooth'}});
    }}
    for (const item of model.items) {{
      const card = document.createElement('article');
      card.className = 'photo';
      card.dataset.id = item.id;
      applyPosition(card, item);
      card.style.setProperty('--r', item.rotation);
      card.style.setProperty('--w', item.w);
      card.style.setProperty('--h', item.h);
      const image = document.createElement('img');
      image.addEventListener('load', () => {{
        card.style.setProperty('--photo-ratio', Math.min(1, image.naturalWidth / image.naturalHeight));
      }});
      image.src = item.thumbnail || item.image;
      image.alt = item.title;
      image.loading = 'lazy';
      card.appendChild(image);
      const caption = document.createElement('div');
      caption.className = 'caption';
      caption.textContent = `${{item.title}}${{item.group ? ' / ' + item.group : ''}}`;
      card.appendChild(caption);
      const actions=document.createElement('div'); actions.className='pending-actions';
      const label=document.createElement('span'); label.textContent=item.title;
      const placeButton=document.createElement('button'); placeButton.type='button'; placeButton.textContent='放到牆面';
      placeButton.addEventListener('click',()=>placeFromTray(card,item));
      actions.append(label,placeButton); card.appendChild(actions);
      card.addEventListener('pointerdown', (event) => {{
        if(event.target.closest('button') || event.button !== 0) return;
        event.preventDefault();
        const fromPending=card.classList.contains('pending-photo');
        if (card.classList.contains('pending-photo')) {{
          const bounds = wall.getBoundingClientRect();
          item.x = Math.max(3, Math.min(97, (event.clientX - bounds.left) / bounds.width * 100));
          item.y = Math.max(3, Math.min(97, (event.clientY - bounds.top) / bounds.height * 100));
          item.alignmentStatus = 'manual';
          card.classList.remove('pending-photo');
          wall.appendChild(card);
          applyPosition(card, item);
        }}
        card.setPointerCapture(event.pointerId);
        card.classList.add('dragging');
        const rect = wall.getBoundingClientRect();
        const start = {{ clientX: event.clientX, clientY: event.clientY, x: item.x, y: item.y }};
        const move = (moveEvent) => {{
          if(fromPending) {{
            const bounds=wall.getBoundingClientRect();
            item.x=Math.max(0,Math.min(100,(moveEvent.clientX-bounds.left)/bounds.width*100));
            item.y=Math.max(0,Math.min(100,(moveEvent.clientY-bounds.top)/bounds.height*100));
            applyPosition(card,item); return;
          }}
          const dx = ((moveEvent.clientX - start.clientX) / rect.width) * 100;
          const dy = ((moveEvent.clientY - start.clientY) / rect.height) * 100;
          item.x = Math.max(0, Math.min(100, start.x + dx));
          item.y = Math.max(0, Math.min(100, start.y + dy));
          applyPosition(card, item);
        }};
        const up = (endEvent) => {{
          card.classList.remove('dragging');
          card.removeEventListener('pointermove', move);
          card.removeEventListener('pointerup', up);
          card.removeEventListener('pointercancel', up);
          if(fromPending) {{
            const bounds=wall.getBoundingClientRect();
            if(endEvent.type==='pointercancel' || endEvent.clientX<bounds.left || endEvent.clientX>bounds.right || endEvent.clientY<bounds.top || endEvent.clientY>bounds.bottom) {{
              item.alignmentStatus='unmatched'; card.classList.add('pending-photo');
              document.getElementById('pendingPhotos').appendChild(card);
            }} else {{ item.rotation=0;card.style.setProperty('--r',0); }}
            updatePendingCount();
          }}
          savePositions();
        }};
        card.addEventListener('pointermove', move);
        card.addEventListener('pointerup', up);
        card.addEventListener('pointercancel', up);
      }});
      if (item.alignmentStatus === 'unmatched') {{
        card.classList.add('pending-photo');
        document.getElementById('pendingPhotos').appendChild(card);
        document.getElementById('pendingSection').hidden = false;
      }} else {{
        wall.appendChild(card);
      }}
    }}
    updatePendingCount();
    function selectNote(note, element) {{
      document.querySelectorAll('.wall-note.selected').forEach(node => node.classList.remove('selected'));
      selectedNote = {{ note, element }};
      element.classList.add('selected');
      noteText.value = note.text || '';
      noteColor.value = note.color || '#e9ff51';
      const reference=document.getElementById('noteReference');
      reference.hidden=!note.sourceImage;
      if(note.sourceImage) {{
        document.getElementById('noteReferenceImage').src=note.sourceImage;
        document.getElementById('noteReferenceText').textContent=note.text;
        document.getElementById('noteReferenceStatus').textContent=note.uncertain?'部分文字待確認，以實拍原稿為準':(note.colorName||'')+'色便利貼';
      }}
    }}
    function applyNotePosition(element, note) {{
      element.style.setProperty('--x', note.x);
      element.style.setProperty('--y', note.y);
    }}
    function renderNote(note) {{
      const sticky = document.createElement('div');
      const uncertain = note.uncertain || note.text === '待辨識';
      sticky.className = uncertain ? 'wall-note uncertain' : 'wall-note';
      sticky.dataset.id = note.id || crypto.randomUUID();
      note.id = sticky.dataset.id;
      applyNotePosition(sticky, note);
      sticky.style.setProperty('--r', ((note.x * 17 + note.y * 11) % 8) - 4);
      sticky.style.background = note.color || '#e9ff51';
      sticky.contentEditable = 'true';
      sticky.textContent = uncertain ? '？' : note.text;
      if(note.sourceImage && !note.useTranscript) {{
        sticky.classList.add('source-note');
        sticky.contentEditable='false';
        const original=document.createElement('img'); original.src=note.sourceImage; original.alt=note.text;
        sticky.replaceChildren(original);
        const factor=note.sourceBounds ? (note.sourceBounds[2]-note.sourceBounds[0])/38 : 1;
        sticky.style.setProperty('--note-width',(model.grid?50/model.grid.columns:1.8)*factor);
      }}
      sticky.title=note.text+(uncertain?'（部分文字待確認）':'');
      sticky.addEventListener('click', (event) => {{
        event.stopPropagation();
        selectNote(note, sticky);
      }});
      sticky.addEventListener('input', () => {{
        note.text = sticky.textContent.trim();
        note.uncertain = false;
        sticky.classList.remove('uncertain');
        saveNotes();
      }});
      sticky.addEventListener('pointerdown', (event) => {{
        if (event.detail > 1) return;
        event.stopPropagation();
        selectNote(note, sticky);
        sticky.setPointerCapture(event.pointerId);
        sticky.classList.add('dragging');
        const rect = wall.getBoundingClientRect();
        const start = {{ clientX: event.clientX, clientY: event.clientY, x: note.x, y: note.y }};
        const move = (moveEvent) => {{
          const dx = ((moveEvent.clientX - start.clientX) / rect.width) * 100;
          const dy = ((moveEvent.clientY - start.clientY) / rect.height) * 100;
          note.x = Math.max(0, Math.min(100, start.x + dx));
          note.y = Math.max(0, Math.min(100, start.y + dy));
          applyNotePosition(sticky, note);
        }};
        const up = () => {{
          sticky.classList.remove('dragging');
          sticky.removeEventListener('pointermove', move);
          sticky.removeEventListener('pointerup', up);
          sticky.removeEventListener('pointercancel', up);
          saveNotes();
        }};
        sticky.addEventListener('pointermove', move);
        sticky.addEventListener('pointerup', up);
        sticky.addEventListener('pointercancel', up);
      }});
      wall.appendChild(sticky);
      return sticky;
    }}
    for (const note of model.wallNotes || []) {{
      renderNote(note);
    }}
    document.getElementById('closeNoteReference').addEventListener('click',()=>{{document.getElementById('noteReference').hidden=true;}});
    document.getElementById('addNote').addEventListener('click', () => {{
      const note = {{ id: crypto.randomUUID(), text: noteText.value.trim() || '新便利貼', x: 50, y: 50, color: noteColor.value || '#e9ff51' }};
      model.wallNotes.push(note);
      const element = renderNote(note);
      selectNote(note, element);
      saveNotes();
    }});
    document.getElementById('deleteNote').addEventListener('click', () => {{
      if (!selectedNote) return;
      model.wallNotes = model.wallNotes.filter(note => note.id !== selectedNote.note.id);
      selectedNote.element.remove();
      selectedNote = null;
      noteText.value = '';
      saveNotes();
    }});
    noteText.addEventListener('input', () => {{
      if (!selectedNote) return;
      selectedNote.note.text = noteText.value;
      selectedNote.note.useTranscript = true;
      selectedNote.element.classList.remove('source-note');
      selectedNote.element.contentEditable='true';
      selectedNote.note.uncertain = false;
      selectedNote.element.classList.remove('uncertain');
      selectedNote.element.textContent = noteText.value;
      saveNotes();
    }});
    noteColor.addEventListener('input', () => {{
      if (!selectedNote) return;
      selectedNote.note.color = noteColor.value;
      selectedNote.note.useTranscript=true;
      selectedNote.element.classList.remove('source-note');
      selectedNote.element.contentEditable='true';
      selectedNote.element.textContent=selectedNote.note.text;
      selectedNote.element.style.background = noteColor.value;
      saveNotes();
    }});
    document.getElementById('exportPositions').addEventListener('click', () => {{
      const payload = {{
        storageKey,
        notesStorageKey,
        grid: model.grid || null,
        updatedAt: new Date().toISOString(),
        positions: Object.fromEntries(model.items.map(item => [item.id, {{ x: Number(item.x.toFixed(2)), y: Number(item.y.toFixed(2)) }}])),
        wallNotes: model.wallNotes,
      }};
      const blob = new Blob([JSON.stringify(payload, null, 2)], {{ type: 'application/json' }});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'digital-wall-positions.json';
      link.click();
      URL.revokeObjectURL(url);
    }});
    document.getElementById('compareWall').addEventListener('click', (event) => {{
      const active = wall.classList.toggle('reference-view');
      wall.style.aspectRatio = active ? String(model.wallAspectRatio || 2.58) : (model.grid ? model.grid.columns + ' / ' + model.grid.rows : String(model.wallAspectRatio || 2.58));
      event.currentTarget.setAttribute('aria-pressed', String(active));
      event.currentTarget.textContent = active ? '返回數位牆' : '對照實體牆';
    }});
    document.getElementById('resetPositions').addEventListener('click', () => {{
      localStorage.removeItem(storageKey);
      localStorage.removeItem(notesStorageKey);
      localStorage.removeItem(gridStorageKey);
      window.location.reload();
    }});
  </script>
</body>
</html>
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="/tmp/observation-on-the-road.json")
    parser.add_argument("--out-dir", default="digital-wall")
    args = parser.parse_args()

    input_path = pathlib.Path(args.input)
    out_dir = pathlib.Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = json.loads(input_path.read_text())
    model = build_wall_model(payload)
    notes_path = pathlib.Path(__file__).resolve().parent.parent / "digital-wall" / "wall-notes-verified.json"
    if notes_path.exists():
        notes = json.loads(notes_path.read_text())
        model["wallNotes"] = notes["notes"]
        model["notesRevision"] = notes["revision"]
    alignment_path = pathlib.Path(__file__).resolve().parent.parent / "digital-wall" / "wall-alignment.json"
    if alignment_path.exists():
        alignment = json.loads(alignment_path.read_text())
        model["layoutRevision"] = alignment["revision"]
        model["wallAspectRatio"] = alignment["aspectRatio"]
        for item in model["items"]:
            position = alignment["positions"].get(item["id"])
            if position:
                item.update(position)
            else:
                item["alignmentStatus"] = "unmatched"
    (out_dir / "digital-wall-data.json").write_text(
        json.dumps(model, ensure_ascii=False, indent=2)
    )
    (out_dir / "digital-wall.html").write_text(render_html(model))


if __name__ == "__main__":
    main()
