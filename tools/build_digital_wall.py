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
    title = "台灣將就之道"
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
    h1 {{ margin: 0; font-size: 28px; line-height: 1.3; letter-spacing: 0; }}
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
      max-width: 88px;
      padding: 4px 5px;
      color: #332a23;
      font-size: 10px;
      font-weight: 800;
      line-height: 1.35;
      white-space: pre-wrap;
      text-align: center;
      box-shadow: 0 3px 7px rgba(30,23,17,.18);
      border: 1px solid rgba(0,0,0,.06);
      overflow-wrap: anywhere;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }}
    .wall-note.selected {{ outline: 3px solid rgba(0,0,0,.55); z-index: 60; }}
    .note-content {{ display: block; min-width: 28px; min-height: 1em; cursor: text; user-select: text; outline: none; }}
    .note-content:empty {{ min-width: 48px; min-height: 40px; }}
    .note-delete {{ display: none; position: absolute; top: -14px; right: -14px; width: 26px; height: 26px; padding: 0; border-radius: 50%; border: 1px solid #777; background: white; color: #222; font-size: 20px; line-height: 22px; cursor: pointer; }}
    .wall-note.selected .note-delete {{ display: block; }}
    #addNote {{ position: relative; width: 50px; height: 44px; border: 0; background: transparent; padding: 5px; }}
    #addNote::before {{ content: ''; position: absolute; inset: 6px 8px; background: #fff0a3; box-shadow: -4px 3px 0 #f7e79b, 0 2px 5px #0003; transform: rotate(-4deg); }}
    #addNote::after {{ content: ''; position: absolute; right: 8px; bottom: 6px; border: 7px solid transparent; border-right-color: #ddce80; border-bottom-color: #ddce80; }}
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
    #photoPreview {{ position: fixed; right: 16px; bottom: 16px; width: 280px; max-width: calc(100vw - 32px); max-height: calc(100dvh - 32px); overflow: auto; padding: 16px; border: 1px solid #dce3df; border-radius: 8px; background: #fff; color: #303834; box-shadow: 0 12px 40px #1020191a; z-index: 100; }}
    .preview-heading {{ display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }}
    .preview-heading h2 {{ flex: 1; margin: 0; font-size: 13px; font-weight: 500; line-height: 1.6; overflow-wrap: anywhere; }}
    #closePhotoPreview, #closeNoteReference {{ width: 32px; height: 32px; flex: 0 0 32px; border: 1px solid #e1e6e3; border-radius: 6px; background: #fff; color: #303834; font-size: 24px; cursor: pointer; }}
    #closePhotoPreview:hover, #closeNoteReference:hover {{ background: #f0f3f1; }}
    #photoPreviewImage {{ display: block; width: 100%; height: auto; max-height: 240px; object-fit: contain; background: #f7f8f7; }}
    #photoPreviewStatus {{ margin: 10px 0 0; font-size: 12px; color: #727e76; }}
    #photoPreviewStatus:empty {{ display: none; }}
    #noteReference {{ border-color: #dce3df; border-radius: 8px; padding: 16px; color: #303834; box-shadow: 0 12px 40px #1020191a; }}
    #noteReference img {{ margin-top: 12px; background: #f7f8f7; }}
    #noteReference p {{ font-size: 13px; line-height: 1.6; }}
    #noteReferenceStatus {{ font-size: 11px !important; color: #727e76; }}
    .unlock-dialog {{ width: 340px; max-width: calc(100vw - 32px); padding: 24px; border: 1px solid #dce3df; border-radius: 8px; color: #303834; background: #fff; box-shadow: 0 20px 60px #10201926; }}
    .unlock-dialog::backdrop {{ background: #16221c55; }}
    .unlock-dialog label {{ display: block; font-size: 12px; margin-bottom: 8px; }}
    .unlock-dialog input {{ width: 100%; padding: 10px 12px; border: 1px solid #cfd8d2; border-radius: 6px; font-size: 16px; }}
    .unlock-close {{ background: transparent; border: 0; font-size: 24px; cursor: pointer; }}
    .unlock-error {{ color: #a33b35; font-size: 12px; min-height: 18px; }}
    .unlock-submit {{ width: 100%; padding: 10px; border: 0; border-radius: 6px; color: white; background: #375f4c; cursor: pointer; }}
    :root {{ background: #f5f6f7; color: #202322; }}
    body {{ padding: 24px 28px; }}
    header {{ align-items: center; margin-bottom: 20px; }}
    .meta {{ color: #737977; font-size: 12px; line-height: 1.8; }}
    .toolbar {{ justify-content: flex-start; gap: 8px; padding: 10px 16px; background: white; border: 1px solid #dfe3e1; border-radius: 8px; box-shadow: 0 3px 12px #15251b05; margin-bottom: 0; }}
    button, input, select {{ font: inherit; }}
    button {{ transition: background .15s, border-color .15s; }}
    .toolbar button, .sync-controls button {{ display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 38px; padding: 8px 12px; background: transparent; color: #303834; font-size: 12px; font-weight: 500; border: 1px solid transparent; border-radius: 6px; box-shadow: none; }}
    .toolbar button:hover:not(:disabled), .sync-controls button:hover:not(:disabled) {{ background: #f0f3f1; border-color: #dce3df; }}
    button:disabled {{ opacity: .3; cursor: default; }}
    button:focus-visible, input:focus-visible, select:focus-visible {{ outline: 2px solid #397564; outline-offset: 3px; }}
    .toolbar .icon-button {{ width: 40px; height: 40px; padding: 10px; flex: 0 0 40px; }}
    #compareWall {{ border-left: 1px solid #e0e5e2; margin-left: 8px; padding-left: 20px; border-radius: 0 6px 6px 0; }}
    #compareWall[aria-pressed="true"] {{ background: #e5efeb; color: #245943; }}
    #exportPositions {{ margin-right: 8px; }}
    #addNote {{ width: 64px; flex: 0 0 64px; border-left: 1px solid #e0e5e2; border-radius: 0; box-shadow: none; }}
    #addNote::before {{ left: 22px; right: 8px; }}
    .toolbar input[type="color"] {{ width: 30px; height: 30px; padding: 3px; background: white; border: 1px solid #d6dcd8; border-radius: 50%; box-shadow: none; cursor: pointer; }}
    input[type="color"]::-webkit-color-swatch-wrapper {{ padding: 0; }}
    input[type="color"]::-webkit-color-swatch {{ border: 0; border-radius: 50%; }}
    .save-status {{ margin-left: auto; color: #6e7973; font-size: 11px; min-width: auto; }}
    .save-status::before {{ content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #5d8a71; margin-right: 7px; }}
    .view-controls {{ padding: 14px 4px; margin-bottom: 0; gap: 28px; color: #626c66; font-size: 12px; }}
    .view-controls output {{ color: #27352d; font-size: 11px; }}
    input[type="range"] {{ accent-color: #375f4c; height: 4px; cursor: pointer; }}
    .sync-controls {{ gap: 8px; padding: 0 0 12px; }}
    [hidden] {{ display: none !important; }}
    .sync-controls strong {{ font-size: 12px; font-weight: 500; margin-right: auto; }}
    .sync-controls input, .sync-controls select {{ border: 1px solid #dce3df; border-radius: 6px; padding: 9px; background: white; max-width: 100%; }}
    .wall {{ border-color: #d2d8d4; background: linear-gradient(#fff,#b8b8b8); box-shadow: none; }}
    .pending {{ border-top: 1px solid #dce1de; padding-top: 18px; }}
    .pending h2 {{ font-size: 14px; font-weight: 600; color: #414d45; margin: 0 0 18px; }}
    .pending-actions button {{ border: 1px solid #dbe2dd; border-radius: 4px; font-size: 12px; color: #365440; }}
    footer {{ color: #87918b; font-size: 11px; padding: 8px 0; }}
    @media (max-width: 760px) {{
      body {{ padding: 16px 12px; }}
      h1 {{ font-size: 24px; }}
      header {{ margin-bottom: 14px; }}
      .meta {{ font-size: 11px; margin-top: 6px; }}
      .toolbar {{ gap: 8px; padding: 8px; }}
      .toolbar button {{ padding: 8px; }}
      #exportPositions {{ margin-right: 0; }}
      .save-status {{ flex-basis: 100%; padding: 4px; }}
      .view-controls {{ gap: 16px; }}
      .view-controls input {{ width: 100px; }}
    }}
  </style>
</head>
<body>
  <header>
    <h1>{title}</h1>
    <div class="meta">照片 {model['summary']['photoCount']} 張 / 分組 {model['summary']['groupCount']} 組<br />上：將就得很精緻，下：將就得很隨意</div>
  </header>
  <div class="toolbar" aria-label="Edit wall controls">
    <button type="button" id="compareWall" aria-pressed="false"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panels-top-left" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M3 9h18"></path><path d="M9 21V9"></path></svg><span>對照實體牆</span></button>
    <button type="button" id="exportPositions"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download" aria-hidden="true"><path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path></svg><span>download json</span></button>
    <button type="button" id="addNote" title="新增空白便利貼" aria-label="新增空白便利貼"></button>
    <input type="hidden" id="noteText" />
    <input type="color" id="noteColor" value="#e9ff51" aria-label="Post-it color" />
    <span class="save-status" id="saveStatus">已編輯 0 次</span>
    <button type="button" id="syncPhotos" title="從 Notion 同步新照片"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg><span>同步照片</span></button>
  </div>
  <div class="view-controls">
    <label>牆面縮放 <input id="wallZoom" type="range" min="100" max="300" step="10" value="150" /><output id="wallZoomValue">150%</output></label>
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
  <aside id="photoPreview" hidden aria-labelledby="photoPreviewTitle">
    <div class="preview-heading"><h2 id="photoPreviewTitle"></h2><button type="button" id="closePhotoPreview" aria-label="關閉照片" title="關閉照片">×</button></div>
    <img id="photoPreviewImage" alt="" />
    <p id="photoPreviewStatus" role="status"></p>
  </aside>
  <script id="wall-data" type="application/json">{data_json}</script>
  <script>
    const model = JSON.parse(document.getElementById('wall-data').textContent);
    const wall = document.getElementById('wall');
    const photoPreview=document.getElementById('photoPreview');
    const previewImage=document.getElementById('photoPreviewImage');
    const previewStatus=document.getElementById('photoPreviewStatus');
    function openPhotoPreview(item) {{
      document.getElementById('noteReference').hidden=true;
      document.getElementById('photoPreviewTitle').textContent=item.title || '照片';
      previewStatus.textContent='載入中…';
      previewImage.alt=item.title || '牆面照片';
      previewImage.onload=()=>{{previewStatus.textContent='';}};
      previewImage.onerror=()=>{{previewStatus.textContent='照片暫時無法載入';}};
      previewImage.src=item.image || item.preview || item.thumbnail;
      photoPreview.hidden=false;
    }}
    document.getElementById('closePhotoPreview').onclick=()=>{{photoPreview.hidden=true;}};
    document.addEventListener('keydown',event=>{{
      if(event.key==='Escape'){{photoPreview.hidden=true;document.getElementById('noteReference').hidden=true;}}
    }});
    const storageKey = '{storage_key}';
    const catalogKey=storageKey+':synced-photos-v1';
    try {{
      const cached=JSON.parse(localStorage.getItem(catalogKey)||'[]');
      if(Array.isArray(cached))for(const item of cached)if(item.id&&!model.items.some(p=>p.id===item.id))model.items.push(item);
    }}catch{{}}
    const notesStorageKey = '{notes_key}';
    const viewStorageKey = storageKey + ':view';
    const wallZoom = document.getElementById('wallZoom');
    const fixedPhotoSize = 3.4;
    try {{
      const savedView = JSON.parse(localStorage.getItem(viewStorageKey) || '{{}}');
      if (Number.isFinite(savedView.zoom)) wallZoom.value = savedView.zoom;
    }} catch {{}}
    function applyView() {{
      wall.style.width = wallZoom.value + '%';
      wall.style.setProperty('--photo-size', model.grid ? (80 / model.grid.columns) * fixedPhotoSize / 3 : fixedPhotoSize);
      if (model.grid) {{
        wall.classList.add('grid-layout');
        wall.style.setProperty('--grid-columns', model.grid.columns);
        wall.style.setProperty('--grid-rows', model.grid.rows);
        if (!wall.classList.contains('reference-view')) wall.style.aspectRatio = model.grid.columns + ' / ' + model.grid.rows;
      }}
      document.getElementById('wallZoomValue').value = wallZoom.value + '%';
    }}
    applyView();
    wallZoom.addEventListener('input', () => {{
        applyView();
        localStorage.setItem(viewStorageKey, JSON.stringify({{zoom: Number(wallZoom.value)}}));
      }});
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
      window.dispatchEvent(new Event('wall-edit'));
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
      window.dispatchEvent(new Event('wall-edit'));
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
      localStorage.setItem(viewStorageKey, JSON.stringify({{zoom:100}}));
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
    applyView();
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
    function renderPhoto(item) {{
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
      card.tabIndex=0;card.setAttribute('aria-label','放大照片：'+item.title);
      card.addEventListener('keydown',event=>{{if(event.target===card && ['Enter',' '].includes(event.key)){{event.preventDefault();openPhotoPreview(item);}}}});
      card.addEventListener('click',event=>{{if(window.wallReadOnly && !event.target.closest('button'))openPhotoPreview(item);}});
      card.addEventListener('pointerdown', (event) => {{
        if(event.target.closest('button') || event.button !== 0) return;
        if(window.wallReadOnly)return;
        event.preventDefault();
        let moved=false;
        const original={{x:item.x,y:item.y,alignmentStatus:item.alignmentStatus}};
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
          if(Math.hypot(moveEvent.clientX-start.clientX,moveEvent.clientY-start.clientY)>5)moved=true;
          if(!moved)return;
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
          if(!moved) {{
            Object.assign(item,original);
            if(fromPending){{card.classList.add('pending-photo');document.getElementById('pendingPhotos').appendChild(card);}}
            applyPosition(card,item);updatePendingCount();
            if(endEvent.type!=='pointercancel')openPhotoPreview(item);
            return;
          }}
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
    for(const item of model.items)renderPhoto(item);
    function addSyncedPhotos(photos) {{
      let added=0;
      const cached=JSON.parse(localStorage.getItem(catalogKey)||'[]');
      for(const source of photos){{
        if(!source.id||!source.image||model.items.some(p=>p.id===source.id))continue;
        const item={{...source,x:50,y:50,rotation:0,alignmentStatus:'unmatched'}};
        model.items.push(item);cached.push(item);renderPhoto(item);added++;
      }}
      localStorage.setItem(catalogKey,JSON.stringify(cached));updatePendingCount();
      return added;
    }}
    updatePendingCount();
    function selectNote(note, element) {{
      photoPreview.hidden=true;
      document.querySelectorAll('.wall-note.selected').forEach(node => node.classList.remove('selected'));
      selectedNote = {{ note, element }};
      element.classList.add('selected');
      noteText.value = note.text || '';
      noteColor.value = note.color || '#e9ff51';
      const reference=document.getElementById('noteReference');
      reference.hidden=false;
      document.getElementById('noteReferenceImage').hidden=!note.sourceImage;
      document.getElementById('noteReferenceText').textContent=note.text || '空白便利貼';
      document.getElementById('noteReferenceStatus').textContent='';
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
      const content = document.createElement('span');
      content.className = 'note-content';
      content.contentEditable = window.wallReadOnly ? 'false' : 'plaintext-only';
      content.setAttribute('role','textbox');
      content.setAttribute('aria-label','便利貼文字');
      content.textContent = note.text || (uncertain ? '待辨識' : '');
      const remove = document.createElement('button');
      remove.type='button';remove.className='note-delete';remove.textContent='−';
      remove.disabled=!!window.wallReadOnly;
      remove.title='刪除便利貼';remove.setAttribute('aria-label','刪除便利貼');
      remove.addEventListener('pointerdown',event=>event.stopPropagation());
      remove.addEventListener('click',event=>{{
        event.stopPropagation();
        if(window.wallReadOnly)return;
        model.wallNotes=model.wallNotes.filter(n=>n.id!==note.id);
        sticky.remove();selectedNote=null;noteText.value='';
        document.getElementById('noteReference').hidden=true;
        saveNotes();
      }});
      sticky.append(content,remove);
      sticky.title=note.text+(uncertain?'（部分文字待確認）':'');
      sticky.addEventListener('click', (event) => {{
        event.stopPropagation();
        selectNote(note, sticky);
      }});
      sticky.addEventListener('input', () => {{
        if(window.wallReadOnly)return;
        note.text = content.textContent;
        noteText.value = note.text;
        note.uncertain = false;
        sticky.classList.remove('uncertain');
        saveNotes();
      }});
      sticky.addEventListener('pointerdown', (event) => {{
        if (event.detail > 1) return;
        event.stopPropagation();
        selectNote(note, sticky);
        if(window.wallReadOnly)return;
        if (event.target === content && document.activeElement === content) return;
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
          content.focus({{preventScroll:true}});
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
      const rect = wall.getBoundingClientRect();
      const centerY = Math.max(0, Math.min(100, ((Math.max(0,rect.top)+Math.min(innerHeight,rect.bottom))/2-rect.top)/rect.height*100));
      const note = {{ id: crypto.randomUUID(), text: '', x: 50, y: centerY, color: noteColor.value || '#e9ff51' }};
      model.wallNotes.push(note);
      const element = renderNote(note);
      selectNote(note, element);
      saveNotes();
      element.querySelector('.note-content').focus({{preventScroll:true}});
    }});
    noteText.addEventListener('input', () => {{
      if (!selectedNote) return;
      selectedNote.note.text = noteText.value;
      selectedNote.note.useTranscript = true;
      selectedNote.element.classList.remove('source-note');
      selectedNote.note.uncertain = false;
      selectedNote.element.classList.remove('uncertain');
      selectedNote.element.querySelector('.note-content').textContent = noteText.value;
      saveNotes();
    }});
    noteColor.addEventListener('input', () => {{
      if (!selectedNote) return;
      selectedNote.note.color = noteColor.value;
      selectedNote.note.useTranscript=true;
      selectedNote.element.classList.remove('source-note');
      selectedNote.element.style.background = noteColor.value;
      saveNotes();
    }});
    document.getElementById('exportPositions').addEventListener('click', () => {{
      const payload = {{
        storageKey,
        notesStorageKey,
        grid: model.grid || null,
        updatedAt: new Date().toISOString(),
        positions: Object.fromEntries(model.items.map(item => [item.id, {{ x: Number(item.x.toFixed(2)), y: Number(item.y.toFixed(2)), placed: item.alignmentStatus !== 'unmatched' }}])),
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
      event.currentTarget.querySelector('span').textContent = active ? '返回數位牆' : '對照實體牆';
    }});
  </script>
  <script>
    {{
      const sync = document.createElement('script');
      sync.src = './shared-sync.js';
      document.body.appendChild(sync);
    }}
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
