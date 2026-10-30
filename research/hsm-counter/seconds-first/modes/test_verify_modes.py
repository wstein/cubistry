"""Regression, certificate, and adversarial checks for the all-mode periods and recovery."""
import copy
import json
import tempfile
import unittest
from fractions import Fraction
from pathlib import Path

from verify_modes import EXPECTED, LIMIT, ROOT, sf, validate, with_cap

SMALL = (('H', 11, 1), ('H', 11, -1), ('M', 11, 1), ('M', 11, -1))


def load(name):
    return json.loads((ROOT / name).read_text())


def run(witness=None, recovery=None, certify=(), full=()):
    with tempfile.TemporaryDirectory() as tmp:
        w, r = Path(tmp) / 'w.json', Path(tmp) / 'r.json'
        w.write_text(json.dumps(witness if witness is not None else load('witness.json')))
        r.write_text(json.dumps(recovery if recovery is not None else load('recovery.json')))
        return validate(w, r, certify, full)


class AllModes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.saved = load('verification.json')
        cls.result = json.loads(json.dumps(validate(ROOT / 'witness.json', ROOT / 'recovery.json',
                                                    SMALL, SMALL[:1])))

    def test_acceptance_matches_saved_verification(self):
        for key in ('status', 'witnessSHA256', 'recoverySHA256', 'baseWitnessSHA256', 'printCode',
                    'ownPeriods', 'applicationModes', 'recovery', 'scope'):
            self.assertEqual(self.result[key], self.saved[key], key)
        saved = {(c['letter'], c['maximum'], c['direction']): c for c in self.saved['optimalityCertificates']}
        for c in self.result['optimalityCertificates']:
            self.assertEqual(c, saved[(c['letter'], c['maximum'], c['direction'])])
        full = {(c['letter'], c['maximum'], c['direction']): c for c in self.saved['recoveryRecomputed']}
        for c in self.result['recoveryRecomputed']:
            self.assertEqual(c, full[(c['letter'], c['maximum'], c['direction'])])

    def test_saved_verification_covers_every_mode(self):
        keys = lambda rows: [(r['letter'], r['maximum'], r['direction']) for r in rows]
        self.assertEqual(keys(self.saved['optimalityCertificates']), list(EXPECTED))
        self.assertEqual(keys(self.saved['recoveryRecomputed']), list(EXPECTED))
        self.assertEqual(keys(self.saved['applicationModes']), list(EXPECTED))

    def test_every_application_mode_is_at_most_five(self):
        for row in self.result['applicationModes']:
            self.assertLessEqual(row['maximumHTM'], LIMIT)
        for row in self.result['ownPeriods']:
            self.assertLessEqual(row['maximumHTM'], LIMIT)

    def test_first_published_periods_are_unchanged(self):
        base = json.loads((ROOT.parent / 'witness.json').read_text())
        new = {(m['letter'], m['maximum'], m['direction']): m for m in load('witness.json')['modes']}
        for m in base['modes']:
            key = (m['letter'], m['maximum'], m['direction'])
            if key != ('H', 11, -1):
                self.assertEqual(m, new[key], key)
        # The first-published H 00-11 -1 period has a six-HTM edge; this one does not.
        self.assertEqual(max(len(s['word'].split()) for m in base['modes'] if (m['letter'], m['maximum'],
                         m['direction']) == ('H', 11, -1) for s in m['steps']), 6)
        self.assertEqual(new[('H', 11, -1)]['maximumHTM'], 5)

    def test_suboptimal_mean_claim_is_rejected_by_certificate(self):
        witness = load('witness.json')
        engine = sf.Engine(sf.source_state(witness['printing']))
        mode = copy.deepcopy(next(m for m in witness['modes'] if (m['letter'], m['maximum'], m['direction'])
                                  == ('M', 11, -1)))
        mode['optimalMeanHTM'] = str(Fraction(mode['optimalMeanHTM']) + Fraction(1, 1000))
        with self.assertRaises(AssertionError):
            with_cap('M', mode['htmCap'], sf.certify, engine, mode)

    def test_corruptions_are_rejected(self):
        def mode(d, key):
            return next(m for m in d['modes'] if (m['letter'], m['maximum'], m['direction']) == key)

        def padded(word):
            return word + " U U'"

        def pad_own(d):
            step = next(s for s in mode(d, ('S', 23, 1))['steps'] if len(s['word'].split()) <= 3)
            step['word'] = padded(step['word'])

        def pad_recovery(r):
            sample = mode(r, ('S', 59, 1))['samples'][2]
            i = next(i for i, w in enumerate(sample['words']) if len(w.split()) >= 4)
            sample['words'][i] = padded(sample['words'][i])

        def flip_selection(d):
            app = mode({'modes': d['appModes']}, ('S', 59, -1))
            app.update(sourceDirection=-1, traversal='forward')

        def swap_units(d):
            units = [s for s in d['printing'] if s['slot'] == 3]
            a, b = next((x, y) for x in units for y in units if x['image'] != y['image'])
            a['image'], b['image'] = b['image'], a['image']

        witness_controls = {
            'own period edge not shortest': pad_own,
            'selection rule ignored': flip_selection,
            'application maximum understated': lambda d: mode({'modes': d['appModes']}, ('M', 23, 1)).update(
                maximumHTM=4),
            'application lap understated': lambda d: mode({'modes': d['appModes']}, ('H', 59, -1)).update(
                periodHTM=407),
            'dropped own period': lambda d: d['modes'].pop(5),
            'print changed': swap_units,
            'wrong schema': lambda d: d.update(schema='cubistry.hsm-seconds-first'),
            'period does not close': lambda d: mode(d, ('M', 11, 1))['steps'].pop(),
        }
        recovery_controls = {
            'recovery edge above five': pad_recovery,
            'recovery stops short': lambda r: mode(r, ('H', 23, 1))['samples'][3]['words'].pop(),
            'recovery step count understated': lambda r: mode(r, ('M', 59, 1)).update(maximumSteps=6),
            'histogram does not cover the graph': lambda r: mode(r, ('S', 11, -1))['stepsHistogram'].update(
                {'3': 1}),
            'forced poses hidden': lambda r: mode(r, ('M', 23, -1)).update(poseWithoutEdgeAtMostLimit=0),
            'wrong traversal': lambda r: mode(r, ('S', 23, -1)).update(traversal='forward'),
        }
        for name, mutate in witness_controls.items():
            d = load('witness.json')
            mutate(d)
            with self.subTest(name), self.assertRaises((AssertionError, KeyError, IndexError, StopIteration)):
                run(witness=d)
        for name, mutate in recovery_controls.items():
            r = load('recovery.json')
            mutate(r)
            with self.subTest(name), self.assertRaises((AssertionError, KeyError, IndexError, StopIteration)):
                run(recovery=r)

    def test_full_recovery_recount_rejects_a_wrong_table(self):
        r = load('recovery.json')
        m = next(m for m in r['modes'] if (m['letter'], m['maximum'], m['direction']) == ('H', 11, 1))
        m['maximumRecoveryHTM'] -= 1
        with self.assertRaises(AssertionError):
            run(recovery=r, full=(('H', 11, 1),))


if __name__ == '__main__':
    unittest.main()
