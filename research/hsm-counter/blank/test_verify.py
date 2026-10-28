"""Regression and adversarial checks for the corrected real-blank requirement."""
import copy
import json
import tempfile
import unittest
from pathlib import Path

from verify import ROOT, validate


class RealBlankControls(unittest.TestCase):
    def test_complete_canonical_periods_and_counterexample(self):
        result = validate(ROOT / 'witness.json')
        self.assertEqual(json.loads(json.dumps(result)), json.loads((ROOT / 'verification.json').read_text()))
        self.assertEqual(result['distinctDisplays'], 180)
        self.assertEqual(result['canonicalMaximumHTM'], 5)
        self.assertEqual(len(result['canonicalModes']), 18)
        self.assertEqual(result['independentFourCornerGraph']['globalMaximumHTM'], 6)
        counterexample = result['sixMoveArbitraryJumpExample']
        self.assertEqual((counterexample['sourceLetter'], counterexample['sourceValue'],
                          counterexample['targetValue'], counterexample['minimumHTM']), ('H', 0, 34, 6))
        self.assertEqual(len(counterexample['legalSixMoveTargetWord'].split()), 6)

    def test_blank_orientation_remains_physically_unprinted(self):
        witness = json.loads((ROOT / 'witness.json').read_text())
        for sticker in witness['printing']:
            if sticker['image'] == '':
                sticker['up'] = [-component for component in sticker['up']]
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'blank-up.json'
            path.write_text(json.dumps(witness))
            self.assertEqual(validate(path, search_counterexample=False)['canonicalMaximumHTM'], 5)

    def test_corruptions_are_rejected(self):
        baseline = json.loads((ROOT / 'witness.json').read_text())
        controls = {
            'no physical blank': lambda d: [s.update(image='0') for s in d['printing'] if s['image'] == ''],
            'wrong nonblank frame': lambda d: d['printing'][0].update(
                up=[-component for component in d['printing'][0]['up']]),
            'duplicate sticker identity': lambda d: d['printing'][0].update(id=1),
            'missing canonical mode': lambda d: d['modes'].pop(),
            'empty period': lambda d: d['modes'][0].update(periodStart=len(d['modes'][0]['steps'])),
            'visible-only period closure': lambda d: d['modes'][0].update(periodStart=0),
            'incorrect displayed order': lambda d: d['modes'][0]['steps'][0].update(to=11),
            'illegal movement': lambda d: d['modes'][0]['steps'][0].update(word='x'),
            'padded nonshortest movement': lambda d: d['modes'][0]['steps'][0].update(
                word=d['modes'][0]['steps'][0]['word'] + " R R'"),
            'wrong claimed canonical maximum': lambda d: d.update(maximumHTM=6),
        }
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'corrupt.json'
            for name, mutate in controls.items():
                with self.subTest(name=name):
                    witness = copy.deepcopy(baseline)
                    mutate(witness)
                    path.write_text(json.dumps(witness))
                    with self.assertRaises((AssertionError, KeyError, TypeError, ValueError)):
                        validate(path, search_counterexample=False)


if __name__ == '__main__':
    unittest.main()
