"""Negative controls for the timer certificate's independent verifier."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('timer_verify', HERE / 'verify.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class TimerCertificateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.witness = json.loads((HERE / 'witness.json').read_text())

    def reject(self, mutate):
        data = copy.deepcopy(self.witness)
        mutate(data)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'tampered.json'
            path.write_text(json.dumps(data))
            with self.assertRaises(AssertionError):
                verifier.check(path)

    def test_full_certificate(self):
        result = verifier.check(HERE / 'witness.json')
        self.assertEqual(result['settledDisplays'], 360)
        self.assertEqual(result['upperBound']['status'], 'UNSAT')

    def test_missing_target(self):
        self.reject(lambda d: d['witnesses'].pop(90))

    def test_false_minute_metadata(self):
        self.reject(lambda d: d['witnesses'][90].update(minute=14))

    def test_illegal_move(self):
        self.reject(lambda d: d['witnesses'][90].update(word='X'))

    def test_false_legal_word(self):
        self.reject(lambda d: d['witnesses'][90].update(word='R'))

    def test_rotated_permanent_ink(self):
        self.reject(lambda d: d['printing'][0].update(up=[-v for v in d['printing'][0]['up']]))

    def test_incomplete_cubie_geometry(self):
        self.reject(lambda d: d['printing'][0].update(p=d['printing'][3]['p']))

    def test_changed_permanent_digit(self):
        self.reject(lambda d: d['printing'][0].update(image='9'))

    def test_slot_annotations_are_not_evidence(self):
        data = copy.deepcopy(self.witness)
        for sticker in data['printing']:
            sticker['slot'] = 999
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'annotations.json'
            path.write_text(json.dumps(data))
            self.assertEqual(verifier.check(path)['status'], 'SAT')


if __name__ == '__main__':
    unittest.main()
