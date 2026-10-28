"""Regression and adversarial checks for retained-candidate cycle accounting."""
import copy
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from compare import ROOT, compare, render


class ComparisonControls(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = compare()

    def test_saved_artifacts_match_actual_replay(self):
        self.assertEqual(json.loads(json.dumps(self.report)),
                         json.loads((ROOT / 'comparison/results.json').read_text()))
        self.assertEqual(render(self.report), (ROOT / 'comparison/README.md').read_text())

    def test_independently_computed_cycle_totals(self):
        # Independently recorded before reviewing the comparison implementation.
        expected = {
            'initial': {'H': (78, 40, 197), 'S': (78, 40, 198), 'M': (80, 38, 196)},
            'intermediate': {'H': (76, 38, 185), 'S': (77, 37, 188), 'M': (75, 37, 190)},
            'final': {'H': (81, 39, 195), 'S': (80, 40, 197), 'M': (80, 37, 202)},
        }
        self.assertEqual({c['candidate'] for c in self.report['candidates']}, set(expected))
        for candidate in self.report['candidates']:
            for row in candidate['rows']:
                observed = tuple(row['cycles'][str(limit)]['totalHTM'] for limit in (23, 11, 59))
                self.assertEqual(observed, expected[candidate['candidate']][row['letter']])
                for limit in (23, 11, 59):
                    cycle = row['cycles'][str(limit)]
                    self.assertEqual(cycle['transitions'], limit + 1)
                    self.assertEqual(cycle['totalHTM'], cycle['forwardHTM'] + cycle['wrapHTM'])
                    self.assertEqual(cycle['meanHTM'], cycle['totalHTM'] / (limit + 1))
                    self.assertFalse(cycle['sameFullPoseAfterWrap'])
            for limit in (23, 11, 59):
                aggregate = candidate['aggregates'][str(limit)]
                total = sum(row['cycles'][str(limit)]['totalHTM'] for row in candidate['rows'])
                self.assertEqual(aggregate['totalHTM'], total)
                self.assertEqual(aggregate['transitions'], 3 * (limit + 1))
                self.assertEqual(aggregate['meanHTM'], total / (3 * (limit + 1)))

    def test_missing_candidate_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / 'candidates'
            shutil.copytree(ROOT / 'comparison/candidates', directory)
            (directory / 'initial.json').unlink()
            with self.assertRaises(AssertionError):
                compare(directory)

    def test_corrupt_candidates_are_rejected(self):
        baseline = json.loads((ROOT / 'comparison/candidates/final.json').read_text())
        controls = {
            'missing display': lambda d: d['routes'][0]['increments'].pop(),
            'missing letter': lambda d: d['routes'].pop(),
            'wrong wrap': lambda d: d['routes'][0].update(from23To00=''),
            'padded wrap': lambda d: d['routes'][0].update(
                from11To00=d['routes'][0]['from11To00'] + " R R'"),
            'boolean version': lambda d: d.update(version=True),
        }
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / 'candidates'
            shutil.copytree(ROOT / 'comparison/candidates', directory)
            for name, mutate in controls.items():
                with self.subTest(name=name):
                    candidate = copy.deepcopy(baseline)
                    mutate(candidate)
                    (directory / 'final.json').write_text(json.dumps(candidate))
                    with self.assertRaises((AssertionError, KeyError, TypeError, ValueError)):
                        compare(directory)


if __name__ == '__main__':
    unittest.main()
