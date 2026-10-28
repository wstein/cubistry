"""Negative controls for the scoped, finite German weekend obstruction."""
import copy
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('weekend_checker', ROOT / 'verify-certificate.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class CertificateTests(unittest.TestCase):
    def setUp(self):
        self.model = json.loads((ROOT / 'model.json').read_text())
        self.cert = json.loads((ROOT / 'certificate.json').read_text())

    def check(self, mutate_model=None, mutate_cert=None):
        model, cert = copy.deepcopy(self.model), copy.deepcopy(self.cert)
        if mutate_model:
            mutate_model(model)
        if mutate_cert:
            mutate_cert(cert)
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            model_bytes = json.dumps(model, ensure_ascii=False).encode()
            cert['modelSHA256'] = hashlib.sha256(model_bytes).hexdigest()
            (directory / 'model.json').write_bytes(model_bytes)
            (directory / 'certificate.json').write_text(json.dumps(cert, ensure_ascii=False))
            return checker.verify(directory / 'model.json', directory / 'certificate.json')

    def test_complete_certificate(self):
        self.assertEqual(self.check()['status'], 'UNSAT')

    def test_missing_date_combination(self):
        with self.assertRaises(AssertionError):
            self.check(mutate_cert=lambda c: c['coverage'].pop())

    def test_wrong_representative(self):
        with self.assertRaises(AssertionError):
            self.check(mutate_cert=lambda c: c['coverage'][0].update(date='2100-02-29'))

    def test_missing_blank_pair(self):
        with self.assertRaises(AssertionError):
            self.check(mutate_cert=lambda c: c['edgeBlankCases']['twoOnDifferentBodies'].pop())

    def test_wrong_parity(self):
        with self.assertRaises(AssertionError):
            self.check(mutate_cert=lambda c: c['edgeBlankCases']['one'].update(fieldCounts=[4, 8, 10]))

    def test_changed_layout(self):
        with self.assertRaises(AssertionError):
            self.check(mutate_model=lambda m: m['front'].update(weekdayRight=2))

    def test_collapsed_palette(self):
        with self.assertRaises(AssertionError):
            self.check(mutate_model=lambda m: m['month'].update(color='#25343e'))

    def test_larger_edge_budget(self):
        with self.assertRaises(AssertionError):
            self.check(mutate_model=lambda m: m['geometry'].update(edgeBodies=13))

    def test_overstated_domain(self):
        with self.assertRaises(AssertionError):
            self.check(mutate_model=lambda m: m['domain'].update(untilExclusive='2401-01-01'))


if __name__ == '__main__':
    unittest.main()
