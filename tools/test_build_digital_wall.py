import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from build_digital_wall import build_wall_model, render_html


class DigitalWallModelTest(unittest.TestCase):
    def test_physical_alignment_covers_every_photo_without_guessing_unmatched(self):
        root = pathlib.Path(__file__).resolve().parent.parent
        model = json.loads((root / 'digital-wall/digital-wall-data.json').read_text())
        alignment = json.loads((root / 'digital-wall/wall-alignment.json').read_text())
        self.assertEqual(set(alignment['positions']), {item['id'] for item in model['items']})
        matched = [item for item in model['items'] if item['alignmentStatus'] == 'matched']
        self.assertEqual(len(matched), 147)
        for item in matched:
            self.assertGreater(item['featureInliers'], 6)
            self.assertGreater(item['w'], 0)
            self.assertGreaterEqual(item['y'] - item['h'] / 2, 0)
            self.assertLessEqual(item['y'] + item['h'] / 2, 100)
        sign = next(item for item in matched if item['title'] == '告示牌')
        self.assertAlmostEqual(sign['x'], 21, delta=1)
        self.assertAlmostEqual(sign['y'], 23.2, delta=1)
        self.assertIn(alignment['revision'], render_html(model))

    def test_extracts_taiwan_solution_photos_with_coordinates_and_notes(self):
        payload_path = pathlib.Path("/tmp/observation-on-the-road.json")
        payload = json.loads(payload_path.read_text())

        model = build_wall_model(payload)

        self.assertEqual(model["course"], "Observation on the Road")
        self.assertEqual(model["project"], "Taiwan Solution")
        self.assertGreaterEqual(len(model["items"]), 150)
        self.assertEqual(len(model["items"]), model["summary"]["photoCount"])
        self.assertGreaterEqual(model["summary"]["groupCount"], 6)

        first = model["items"][0]
        self.assertTrue(first["title"])
        self.assertTrue(first["image"].startswith("https://"))
        self.assertTrue(first["thumbnail"].endswith(".webp"))
        self.assertGreaterEqual(first["x"], 0)
        self.assertLessEqual(first["x"], 100)
        self.assertGreaterEqual(first["y"], 0)
        self.assertLessEqual(first["y"], 100)
        self.assertIn("notes", first)
        self.assertIsInstance(first["notes"], list)

    def test_photo_cards_do_not_include_database_tags_as_stickies(self):
        payload_path = pathlib.Path("/tmp/observation-on-the-road.json")
        payload = json.loads(payload_path.read_text())

        model = build_wall_model(payload)
        html = render_html(model)

        self.assertTrue(all(item["notes"] == [] for item in model["items"]))
        self.assertNotIn("className = 'sticky'", html)
        self.assertNotIn(".sticky", html)

    def test_vertical_axis_orders_refined_items_above_casual_items(self):
        payload = {
            "course": {"courseName": "Observation on the Road"},
            "projects": [
                {
                    "projectName": "Taiwan Solution",
                    "sourceDatabaseId": "db",
                }
            ],
            "studentWorks": [
                {
                    "id": "refined",
                    "assignmentName": "refined",
                    "sourceDatabaseId": "db",
                    "mainImage": "https://example.com/a.jpg",
                    "mainImageThumbnail": "https://example.com/a.webp",
                    "tags": ["好方便", "空間魔法師"],
                    "group": "A",
                },
                {
                    "id": "casual",
                    "assignmentName": "casual",
                    "sourceDatabaseId": "db",
                    "mainImage": "https://example.com/b.jpg",
                    "mainImageThumbnail": "https://example.com/b.webp",
                    "tags": ["硬要", "偽裝"],
                    "group": "B",
                },
            ],
        }

        model = build_wall_model(payload)
        by_id = {item["id"]: item for item in model["items"]}

        self.assertLess(by_id["refined"]["y"], by_id["casual"]["y"])

    def test_rendered_wall_sizes_white_backing_to_each_photo(self):
        model = {
            "course": "Observation on the Road",
            "project": "Taiwan Solution",
            "summary": {"photoCount": 1, "groupCount": 0},
            "items": [
                {
                    "id": "photo-1",
                    "title": "完整照片",
                    "group": "",
                    "members": [],
                    "image": "https://example.com/full.jpg",
                    "thumbnail": "https://example.com/full.webp",
                    "preview": "https://example.com/full.jpg",
                    "notes": [],
                    "x": 50,
                    "y": 50,
                    "rotation": 0,
                    "w": 4,
                    "h": 4,
                }
            ],
        }

        html = render_html(model)

        self.assertIn("height: auto", html)
        self.assertIn("aspect-ratio: auto", html)
        self.assertIn("object-fit: contain", html)
        self.assertIn("background: #fff", html)
        self.assertIn("aspect-ratio: 2.58 / 1", html)

    def test_wall_layout_keeps_most_photos_from_overlapping(self):
        payload_path = pathlib.Path("/tmp/observation-on-the-road.json")
        payload = json.loads(payload_path.read_text())

        model = build_wall_model(payload)
        items = model["items"]

        overlap_pairs = 0
        for index, item in enumerate(items):
            for other in items[index + 1 :]:
                x_overlap = abs(item["x"] - other["x"]) < (item["w"] + other["w"]) * 0.45
                y_overlap = abs(item["y"] - other["y"]) < (item["h"] + other["h"]) * 0.45
                if x_overlap and y_overlap:
                    overlap_pairs += 1

        self.assertLessEqual(overlap_pairs, 8)

    def test_model_includes_wall_sticky_notes_from_reference_photos(self):
        payload_path = pathlib.Path("/tmp/observation-on-the-road.json")
        payload = json.loads(payload_path.read_text())

        model = build_wall_model(payload)

        self.assertGreaterEqual(len(model["wallNotes"]), 30)
        self.assertTrue(any(note["text"] == "保護" for note in model["wallNotes"]))
        self.assertTrue(any(note["text"] == "無印良品" for note in model["wallNotes"]))
        self.assertTrue(any(note["text"] == "同意書" for note in model["wallNotes"]))
        for note in model["wallNotes"]:
            self.assertGreaterEqual(note["x"], 0)
            self.assertLessEqual(note["x"], 100)
            self.assertGreaterEqual(note["y"], 0)
            self.assertLessEqual(note["y"], 100)

    def test_uncertain_wall_notes_are_visually_marked(self):
        model = {
            "course": "Observation on the Road",
            "project": "Taiwan Solution",
            "summary": {"photoCount": 0, "groupCount": 0},
            "items": [],
            "wallNotes": [
                {"text": "待辨識", "x": 50, "y": 50, "color": "#e9ff51", "uncertain": True}
            ],
        }

        html = render_html(model)

        self.assertIn("wall-note uncertain", html)
        self.assertIn("模糊待確認", html)
        self.assertIn("border: 2px dashed", html)

    def test_reference_wall_layout_is_not_an_even_grid(self):
        payload_path = pathlib.Path("/tmp/observation-on-the-road.json")
        payload = json.loads(payload_path.read_text())

        model = build_wall_model(payload)
        items = model["items"]
        row_counts = {}
        for item in items:
            row = round(item["y"] / 8) * 8
            row_counts[row] = row_counts.get(row, 0) + 1

        self.assertGreaterEqual(len(set(row_counts.values())), 4)
        self.assertTrue(any(15 < item["x"] < 35 and 20 < item["y"] < 35 for item in items))
        self.assertTrue(any(42 < item["x"] < 63 and 8 < item["y"] < 18 for item in items))
        self.assertTrue(any(72 < item["x"] < 95 and 30 < item["y"] < 55 for item in items))
        self.assertTrue(any(48 < item["x"] < 72 and 70 < item["y"] < 90 for item in items))
        column_counts = {}
        for item in items:
            column = round(item["x"] / 2.5) * 2.5
            column_counts[column] = column_counts.get(column, 0) + 1
        self.assertLessEqual(max(column_counts.values()), 8)

    def test_reference_wall_preserves_source_photo_order_for_position_matching(self):
        payload_path = pathlib.Path("/tmp/observation-on-the-road.json")
        payload = json.loads(payload_path.read_text())
        project = next(project for project in payload["projects"] if project["projectName"] == "Taiwan Solution")
        expected_first = next(
            work
            for work in payload["studentWorks"]
            if work.get("sourceDatabaseId") == project["sourceDatabaseId"] and work.get("mainImage")
        )

        model = build_wall_model(payload)

        self.assertEqual(model["items"][0]["id"], expected_first["id"])
        self.assertLess(model["items"][0]["x"], 25)
        self.assertLess(model["items"][0]["y"], 20)

    def test_rendered_wall_supports_dragging_and_saving_positions(self):
        model = {
            "course": "Observation on the Road",
            "slug": "observation-on-the-road",
            "project": "Taiwan Solution",
            "summary": {"photoCount": 1, "groupCount": 0},
            "items": [
                {
                    "id": "photo-1",
                    "title": "可拖曳照片",
                    "group": "",
                    "members": [],
                    "image": "https://example.com/full.jpg",
                    "thumbnail": "https://example.com/full.webp",
                    "preview": "https://example.com/full.jpg",
                    "notes": [],
                    "x": 50,
                    "y": 50,
                    "rotation": 0,
                    "w": 4,
                    "h": 4,
                }
            ],
            "wallNotes": [],
        }

        html = render_html(model)

        self.assertIn("digital-wall-positions:observation-on-the-road:taiwan-solution", html)
        self.assertIn("pointerdown", html)
        self.assertIn("pointermove", html)
        self.assertIn("localStorage.setItem", html)
        self.assertIn("exportPositions", html)
        self.assertIn("Reset Positions", html)

    def test_rendered_wall_supports_editable_post_its(self):
        model = {
            "course": "Observation on the Road",
            "slug": "observation-on-the-road",
            "project": "Taiwan Solution",
            "summary": {"photoCount": 0, "groupCount": 0},
            "items": [],
            "wallNotes": [
                {"id": "note-1", "text": "保護", "x": 50, "y": 50, "color": "#e9ff51"}
            ],
        }

        html = render_html(model)

        self.assertIn("digital-wall-notes:observation-on-the-road:taiwan-solution", html)
        self.assertIn("addNote", html)
        self.assertIn("deleteNote", html)
        self.assertIn("noteText", html)
        self.assertIn("noteColor", html)
        self.assertIn("saveNotes", html)
        self.assertIn("contentEditable", html)


if __name__ == "__main__":
    unittest.main()
