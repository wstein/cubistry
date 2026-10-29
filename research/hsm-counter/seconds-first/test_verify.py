"""Regression, certificate, and adversarial checks for the seconds-first print."""
import copy
import json
import tempfile
import unittest
from fractions import Fraction
from pathlib import Path

from verify import EXPECTED_MODES as CERTIFIED, ROOT, Engine, certify, source_state, universal, validate


def load(name):
    return json.loads((ROOT / name).read_text())


class SecondsFirst(unittest.TestCase):
    def test_complete_acceptance_matches_saved_verification(self):
        result = validate(ROOT / 'witness.json', CERTIFIED)
        self.assertEqual(json.loads(json.dumps(result)), load('verification.json'))
        modes = {(m['letter'], m['maximum'], m['direction']): m for m in result['modes']}
        self.assertLessEqual(modes[('M', 59, 1)]['maximumHTM'], 5)
        self.assertLessEqual(modes[('M', 59, -1)]['maximumHTM'], 5)
        self.assertEqual(len(result['optimalityCertificates']), 8)

    def test_baseline_print_acceptance_matches_saved_verification(self):
        result = validate(ROOT / 'baseline-witness.json', CERTIFIED)
        self.assertEqual(json.loads(json.dumps(result)), load('baseline-verification.json'))

    def test_new_print_beats_certified_baseline_optimum(self):
        new, old = load('verification.json'), load('baseline-verification.json')
        lap = lambda r, d: Fraction(next(m for m in r['modes']
                                        if (m['letter'], m['direction']) == ('S', d))['perLapHTM'])
        self.assertLess(lap(new, 1), lap(old, 1))
        self.assertLess(lap(new, -1), lap(old, -1))

    def test_suboptimal_mean_claim_is_rejected_by_certificate(self):
        witness = load('witness.json')
        engine = Engine(source_state(witness['printing']))
        mode = copy.deepcopy(next(m for m in witness['modes'] if (m['letter'], m['maximum']) == ('H', 11)))
        mode['optimalMeanHTM'] = str(Fraction(mode['optimalMeanHTM']) + Fraction(1, 1000))
        with self.assertRaises(AssertionError):
            certify(engine, mode)

    def test_universal_prover_finds_real_counterexamples(self):
        witness = load('witness.json')
        engine = Engine(source_state(witness['printing']))
        self.assertTrue(universal(engine)['holds'])
        tight = universal(engine, limit=4)
        self.assertFalse(tight['holds'])

    def test_corruptions_are_rejected(self):
        baseline = load('witness.json')
        glyph = next(i for i, s in enumerate(baseline['printing']) if s['image'] in '0123456789' and s['image'])

        def other_word(d):
            step = d['modes'][0]['steps'][0]
            first = step['word'].split()[0]
            face = 'U' if first[0] != 'U' else 'D'
            step['word'] = ' '.join([face] + step['word'].split()[1:])

        def drop_last_lap(d):
            mode = next(m for m in d['modes'] if len(m['steps']) > m['maximum'] + 1)
            mode['steps'] = mode['steps'][:-(mode['maximum'] + 1)]

        def swap_start_corners(d):
            frames = d['modes'][0]['periodStartFrames']
            for i in range(3):
                a, b = frames[i], frames[i + 3]
                for k in ('p', 'n', 'up'):
                    a[k], b[k] = b[k], a[k]

        def swap_units_glyphs(d):
            units = [s for s in d['printing'] if s['slot'] == 3]
            a, b = next((x, y) for x in units for y in units if x['image'] != y['image'])
            a['image'], b['image'] = b['image'], a['image']

        controls = {
            'swapped units glyphs': swap_units_glyphs,
            'corrupt sticker glyph': lambda d: d['printing'][glyph].update(
                image=str((int(d['printing'][glyph]['image']) + 1) % 6)),
            'corrupt sticker orientation': lambda d: d['printing'][glyph].update(
                up=[-v for v in d['printing'][glyph]['up']]),
            'no physical blank': lambda d: [s.update(image='0', slot=2) for s in d['printing'] if s['image'] == ''],
            'duplicate sticker identity': lambda d: d['printing'][0].update(id=1),
            'corrupt move': other_word,
            'illegal move token': lambda d: d['modes'][0]['steps'][0].update(word='x'),
            'padded nonshortest move': lambda d: d['modes'][0]['steps'][0].update(
                word=d['modes'][0]['steps'][0]['word'] + " B B'"),
            'hidden pose changed by back turn': lambda d: d['modes'][0].update(setup=d['modes'][0]['setup'] + ' B'),
            'visible-only period closure': drop_last_lap,
            'corrupt period start pose': lambda d: d['modes'][0]['periodStartFrames'][0].update(
                up=[-v for v in d['modes'][0]['periodStartFrames'][0]['up']]),
            'swapped period start corners': swap_start_corners,
            'incorrect displayed order': lambda d: d['modes'][0]['steps'][0].update(to=2),
            'missing mode': lambda d: d['modes'].pop(),
            'dishonest period total': lambda d: d['modes'][0].update(periodHTM=d['modes'][0]['periodHTM'] - 1),
            'dishonest mean': lambda d: d['modes'][0].update(
                optimalMeanHTM=str(Fraction(d['modes'][0]['optimalMeanHTM']) - Fraction(1, 60))),
            'dishonest maximum': lambda d: d['modes'][2].update(maximumHTM=d['modes'][2]['maximumHTM'] - 1),
        }
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'corrupt.json'
            for name, mutate in controls.items():
                with self.subTest(name=name):
                    witness = copy.deepcopy(baseline)
                    mutate(witness)
                    path.write_text(json.dumps(witness))
                    with self.assertRaises((AssertionError, KeyError, TypeError, ValueError)):
                        validate(path)


if __name__ == '__main__':
    unittest.main()
