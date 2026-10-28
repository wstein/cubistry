"""Negative controls for independent H/S/M witness acceptance."""
import copy
import json
import tempfile
import unittest
from pathlib import Path

from verify import validate

ROOT = Path(__file__).resolve().parent


class WitnessControls(unittest.TestCase):
    def test_valid_witness(self):
        self.assertEqual(validate(ROOT / 'witness.json')['status'], 'SAT')

    def test_corruptions_are_rejected(self):
        baseline = json.loads((ROOT / 'witness.json').read_text())
        corruptions = {
            'wrong puzzle': lambda d: d.update(puzzle='3x3x3'),
            'wrong version': lambda d: d.update(version=2),
            'missing sticker': lambda d: d['printing'].pop(),
            'duplicate sticker ID': lambda d: d['printing'][0].update(id=d['printing'][1]['id']),
            'boolean sticker ID': lambda d: d['printing'][0].update(id=False),
            'invalid frame': lambda d: d['printing'][0].update(up=[0, 0, 0]),
            'reprinted letters': lambda d: [s.update(image='H') for s in d['printing']
                                          if s['image'] in 'SM'],
            'missing number': lambda d: d['routes'][0]['increments'].pop(),
            'missing letter': lambda d: d['routes'].pop(),
            'duplicate letter': lambda d: d['routes'][1].update(letter='H'),
            'illegal move': lambda d: d['routes'][0].update(setup='x'),
            'wrong settled state': lambda d: d['routes'][0].update(setup=''),
            'wrong reset': lambda d: d['routes'][0].update(from23To00=''),
            'wrong 11 reset': lambda d: d['routes'][0].update(from11To00=''),
            'padded nonshortest reset': lambda d: d['routes'][0].update(
                from23To00=d['routes'][0]['from23To00'] + " R R'"),
            'padded nonshortest 11 reset': lambda d: d['routes'][0].update(
                from11To00=d['routes'][0]['from11To00'] + " R R'"),
            'wrong metrics': lambda d: d['metrics'].update(totalIncrementHTM=0),
            'wrong BFS': lambda d: d['bfs'].update(states=1),
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'corrupt.json'
            for name, mutate in corruptions.items():
                with self.subTest(name=name):
                    data = copy.deepcopy(baseline)
                    mutate(data)
                    path.write_text(json.dumps(data))
                    with self.assertRaises((AssertionError, KeyError, TypeError, ValueError)):
                        validate(path)


if __name__ == '__main__':
    unittest.main()
