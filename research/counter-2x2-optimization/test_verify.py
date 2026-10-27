"""Certificate negative controls, including legal but non-shortest paths."""
import hashlib
import csv
import re
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('optimized_verifier', HERE / 'verify.py')
V = importlib.util.module_from_spec(spec)
spec.loader.exec_module(V)


class OptimizationTests(unittest.TestCase):
    def mutate(self, change, setup_change=None):
        data = json.loads((HERE / 'optimized.json').read_text())
        setups = json.loads((HERE / 'setups.json').read_text())
        change(data)
        with tempfile.TemporaryDirectory() as directory:
            candidate = Path(directory) / 'candidate.json'
            startup = Path(directory) / 'setups.json'
            candidate.write_text(json.dumps(data))
            setups['candidateSHA256'] = hashlib.sha256(candidate.read_bytes()).hexdigest()
            if setup_change:
                setup_change(setups)
            startup.write_text(json.dumps(setups))
            with self.assertRaises(AssertionError):
                V.check(candidate, startup)

    def test_full_proof(self):
        result = V.check(HERE / 'optimized.json')
        self.assertEqual(result['status'], 'SAT')
        self.assertEqual(result['maximumHTM'], 5)
        self.assertTrue(result['titleImagesFixed'])
        self.assertEqual(result['globalPrintOptimality'], 'UNKNOWN')

    def test_legal_but_nonshortest_transition(self):
        self.mutate(lambda d: d['runs'][0]['optimized']['words'].__setitem__(1, "R R' " + d['runs'][0]['optimized']['words'][1]))

    def test_missing_transition(self):
        self.mutate(lambda d: d['runs'][0]['optimized']['words'].pop())

    def test_false_move_count(self):
        self.mutate(lambda d: d['runs'][0]['optimized'].update(total=1))

    def test_wrong_digit(self):
        self.mutate(lambda d: d['runs'][0]['printing'][0].update(image='9'))

    def test_changed_title_fragment(self):
        self.mutate(lambda d: d['runs'][0]['printing'][0].update(image='other-title'))

    def test_false_baseline_count(self):
        self.mutate(lambda d: d['runs'][0]['baselineDirect'].update(total=1))

    def test_false_bfs_census(self):
        self.mutate(lambda d: d['bfs'].update(states=1))

    def test_wrong_maximum_setup(self):
        self.mutate(lambda d: None, lambda s: s['runs'][0].update(maximumWord='R'))

    def test_exported_print_frames(self):
        data = json.loads((HERE / 'optimized.json').read_text())
        printing = {s['id']: s for s in data['runs'][0]['printing']}
        bases = {'U':((0,1,0),(1,0,0),(0,0,-1)), 'L':((-1,0,0),(0,0,1),(0,1,0)),
                 'F':((0,0,1),(1,0,0),(0,1,0)), 'R':((1,0,0),(0,0,-1),(0,1,0)),
                 'B':((0,0,-1),(-1,0,0),(0,1,0)), 'D':((0,-1,0),(1,0,0),(0,0,1))}
        with (HERE / 'stickers.csv').open() as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 24)
        for row in rows:
            sticker = printing[int(row['sticker'])]
            n, right, up = bases[row['face']]
            x, y = int(row['column'])*2-3, 3-int(row['row'])*2
            self.assertEqual([x*right[i]+y*up[i]+n[i] for i in range(3)], sticker['p'])
            self.assertEqual(list(n), sticker['n'])
            rotated = [up, right, tuple(-v for v in up), tuple(-v for v in right)][int(row['clockwiseDegrees'])//90]
            self.assertEqual(list(rotated), sticker['up'])
            self.assertEqual(row['image'], sticker['image'])
        root = ET.parse(HERE / 'counter-print.svg').getroot()
        rotations = [int(re.search(r'rotate\((\d+)\)', g.attrib['transform'])[1]) for g in root.findall('{http://www.w3.org/2000/svg}g')]
        ordered = sorted(rows, key=lambda row: (list(bases).index(row['face']), int(row['sticker'])))
        self.assertEqual(rotations, [int(row['clockwiseDegrees']) for row in ordered])

    def test_vector_nets_have_24_stickers(self):
        for name in ('counter-print.svg',):
            root = ET.parse(HERE / name).getroot()
            rectangles = root.findall('.//{http://www.w3.org/2000/svg}rect')
            self.assertEqual(len(rectangles), 24)
            self.assertTrue(all(r.attrib['width'] == r.attrib['height'] == '20' for r in rectangles))


if __name__ == '__main__':
    unittest.main()
