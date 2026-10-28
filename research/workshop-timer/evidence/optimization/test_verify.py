"""Certificate negative controls, including legal but non-shortest paths."""
import hashlib
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
        self.assertEqual([r['maxHTM'] for r in result['runs']], [5, 5])
        self.assertEqual(result['globalPrintOptimality'], 'UNKNOWN')

    def test_legal_but_nonshortest_transition(self):
        self.mutate(lambda d: d['runs'][0]['optimized']['words'].__setitem__(1, "R R' " + d['runs'][0]['optimized']['words'][1]))

    def test_missing_transition(self):
        self.mutate(lambda d: d['runs'][0]['optimized']['words'].pop())

    def test_false_move_count(self):
        self.mutate(lambda d: d['runs'][0]['optimized'].update(total=1))

    def test_wrong_digit(self):
        self.mutate(lambda d: d['runs'][0]['printing'][0].update(image='9'))

    def test_false_baseline_count(self):
        self.mutate(lambda d: d['runs'][0]['baselineDirect'].update(total=1))

    def test_false_bfs_census(self):
        self.mutate(lambda d: d['bfs'].update(states=1))

    def test_wrong_maximum_setup(self):
        self.mutate(lambda d: None, lambda s: s['runs'][0].update(maximumWord='R'))

    def test_vector_nets_have_24_stickers(self):
        for tag in ('19m50', '59m50'):
            root = ET.parse(HERE / f'{tag}-print.svg').getroot()
            rectangles = root.findall('.//{http://www.w3.org/2000/svg}rect')
            self.assertEqual(len(rectangles), 24)
            self.assertTrue(all(r.attrib['width'] == r.attrib['height'] == '20' for r in rectangles))


if __name__ == '__main__':
    unittest.main()
