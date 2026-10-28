"""Independent physical-witness controls for four fragment calendar prints."""
import copy
import json
import tempfile
import unittest
from pathlib import Path

from verify_witness import ROOT, validate, verify_center_helpers


class DateWitnessControls(unittest.TestCase):
    def test_all_four_complete_physical_witnesses(self):
        for identity in ('de-2', 'de-3', 'en-2', 'en-3'):
            with self.subTest(candidate=identity):
                result = validate(ROOT / 'witnesses' / (identity + '.json'))
                expected = json.loads((ROOT / 'independent' / (identity + '.json')).read_text())
                self.assertEqual(json.loads(json.dumps(result)), expected)
                self.assertEqual(result['status'], 'SAT')
                self.assertEqual(result['datePatternsVerified'], 2562)

    def test_visible_center_helpers_restore_noncenter_frames(self):
        result = verify_center_helpers()
        self.assertEqual([row['htm'] for row in result['helpers']], [18, 20, 18])
        self.assertTrue(result['noncenterFramesRestored'])

    def test_unprinted_blank_up_is_not_an_artwork_constraint(self):
        witness = json.loads((ROOT / 'witnesses/de-2.json').read_text())
        count = 0
        for sticker in witness['printing']:
            if sticker['image'] == '':
                sticker['up'] = [-value for value in sticker['up']]
                count += 1
        self.assertGreater(count, 0)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'blank-up.json'
            path.write_text(json.dumps(witness))
            self.assertEqual(validate(path)['status'], 'SAT')

    def test_corrupt_witnesses_are_rejected(self):
        baseline = json.loads((ROOT / 'witnesses/de-2.json').read_text())
        self.assertTrue(baseline['targets'][0]['centerCorrection'])
        controls = {
            'wrong schema': lambda d: d.update(schema='other'),
            'boolean version': lambda d: d.update(version=True),
            'missing sticker': lambda d: d['printing'].pop(),
            'duplicate sticker ID': lambda d: d['printing'][0].update(id=1),
            'boolean sticker ID': lambda d: d['printing'][0].update(id=False),
            'invalid frame': lambda d: d['printing'][0].update(up=[0, 0, 0]),
            'changed immutable image': lambda d: d['printing'][0].update(image='X'),
            'wrong source slot': lambda d: d['printing'][0].update(slot=8),
            'invalid body identity': lambda d: d['printing'][0].update(cubie=1),
            'missing target': lambda d: d['targets'].pop(),
            'duplicate date pattern': lambda d: d['targets'].__setitem__(1, copy.deepcopy(d['targets'][0])),
            'invalid Gregorian day': lambda d: d['targets'][0].update(day=30, month=2),
            'boolean date': lambda d: d['targets'][0].update(weekday=False),
            'lost leading zero': lambda d: d['targets'][0]['cells'].__setitem__(4, ''),
            'wrong row layout': lambda d: d['targets'][0].update(
                cells=d['targets'][0]['cells'][:3] + d['targets'][0]['cells'][6:] + d['targets'][0]['cells'][3:6]),
            'illegal outer word': lambda d: d['targets'][0].update(word="R2'"),
            'whole rotation hidden in face word': lambda d: d['targets'][0].update(word='x'),
            'face turn hidden in prelude': lambda d: d['targets'][0].update(prelude='R'),
            'missing visible-center correction': lambda d: d['targets'][0].update(centerCorrection=''),
            'false completeness': lambda d: d.update(complete=False),
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
