"""Independent universal-bound and recurrent full-state regression controls."""
import copy
import json
import tempfile
import unittest
from pathlib import Path

from verify_periodic import ROOT, fixed_letter_bound, validate


class RecurrentControls(unittest.TestCase):
    def test_universal_fixed_letter_bound(self):
        lemma = fixed_letter_bound()
        self.assertEqual(lemma['fullGraphStates'], 9072)
        self.assertEqual(lemma['fixedLetterSourceStates'], 378)
        self.assertEqual(lemma['maximumHTM'], 5)
        self.assertEqual(lemma['distanceHistogram'], {0: 1, 1: 6, 2: 29, 3: 118, 4: 180, 5: 44})

    def test_valid_periodic_certificate_and_saved_result(self):
        result = validate(ROOT / 'periodic/witness.json')
        self.assertEqual(json.loads(json.dumps(result)),
                         json.loads((ROOT / 'periodic/verification.json').read_text()))
        self.assertEqual(len(result['modes']), 18)
        self.assertEqual(result['maximumCountingHTM'], 5)

    def test_corrupt_periodic_certificates_are_rejected(self):
        baseline = json.loads((ROOT / 'periodic/witness.json').read_text())
        self.assertGreater(baseline['modes'][0]['periodStart'], 0)
        controls = {
            'different immutable print': lambda d: d['printing'][0].update(image='X'),
            'missing mode': lambda d: d['modes'].pop(),
            'boolean range': lambda d: d['modes'][0].update(maximum=True),
            'wrong numeric order': lambda d: d['modes'][0]['steps'][0].update(to=11),
            'long nonshortest motion': lambda d: d['modes'][0]['steps'][0].update(
                word=d['modes'][0]['steps'][0]['word'] + " R R' R R'"),
            'display closure without full-state closure': lambda d: d['modes'][0].update(periodStart=0),
            'empty period': lambda d: d['modes'][0].update(periodStart=len(d['modes'][0]['steps'])),
            'wrong maximum': lambda d: d['modes'][0].update(maximumHTM=4),
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'corrupt.json'
            for name, mutate in controls.items():
                with self.subTest(name=name):
                    witness = copy.deepcopy(baseline)
                    mutate(witness)
                    path.write_text(json.dumps(witness))
                    with self.assertRaises((AssertionError, KeyError, TypeError, ValueError)):
                        validate(path)


if __name__ == '__main__':
    unittest.main()
