"""Controls for adjacent English dates, uniform weekdays and padding identity."""
import copy
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from verify_adjacent import ADJACENT, candidate_model, validate, validate_family


class AdjacentControls(unittest.TestCase):
    def test_complete_family_and_saved_acceptance(self):
        result = validate_family()
        saved = json.loads((ADJACENT / 'independent/verification.json').read_text())
        self.assertEqual(json.loads(json.dumps(result)), saved)
        self.assertEqual(result['physicalPrints'], 2)
        self.assertEqual(result['datePatternsVerified'], 10248)
        self.assertTrue(result['sameImmutablePrintAcrossPaddingModes'])

    def test_missing_padding_mode_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / 'witnesses'
            shutil.copytree(ADJACENT / 'witnesses', directory)
            (directory / 'en-adjacent-3-unpadded.json').unlink()
            with self.assertRaises(AssertionError):
                validate_family(directory)

    def test_nonuniform_weekday_candidate_is_rejected(self):
        candidate = json.loads((ADJACENT / 'constructive/en-adjacent-2.json').read_text())
        candidate['weekdayParts']['MO'] = ['M', 'O', '']
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'candidate.json'
            path.write_text(json.dumps(candidate))
            with self.assertRaises(AssertionError):
                candidate_model(path)

    def test_corrupt_adjacent_and_padding_targets_are_rejected(self):
        zero = json.loads((ADJACENT / 'witnesses/en-adjacent-2-zero.json').read_text())
        unpadded = json.loads((ADJACENT / 'witnesses/en-adjacent-2-unpadded.json').read_text())
        center_index = next(i for i, target in enumerate(zero['targets']) if target['centerCorrection'])
        double_digit = next(i for i, target in enumerate(unpadded['targets']) if target['day'] == 10)
        controls = {
            'spoofed padding mode': (zero, lambda d: d.update(paddingMode='unpadded')),
            'unknown padding mode': (zero, lambda d: d.update(paddingMode='optional')),
            'old gap between digits': (zero, lambda d: d['targets'][0]['cells'].__setitem__(slice(6, 9), ['0', '', '1'])),
            'leading zero on unpadded day': (unpadded, lambda d: d['targets'][0]['cells'].__setitem__(7, '0')),
            'missing tens on day ten': (unpadded, lambda d: d['targets'][double_digit]['cells'].__setitem__(7, '')),
            'missing visible-center fix': (zero, lambda d: d['targets'][center_index].update(centerCorrection='')),
            'changed fixed unit image': (zero, lambda d: d['printing'][0].update(image='X')),
            'missing complete target': (zero, lambda d: d['targets'].pop()),
            'illegal move': (zero, lambda d: d['targets'][0].update(word='M')),
        }
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'corrupt.json'
            for name, (baseline, mutate) in controls.items():
                with self.subTest(name=name):
                    witness = copy.deepcopy(baseline)
                    mutate(witness)
                    path.write_text(json.dumps(witness))
                    with self.assertRaises((AssertionError, KeyError, TypeError, ValueError)):
                        validate(path)


if __name__ == '__main__':
    unittest.main()
