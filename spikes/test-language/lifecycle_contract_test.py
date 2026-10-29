"""Reject incomplete or inconsistent lifecycle measurements."""
import contextlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from lifecycle_driver import observe


class LifecycleContracts(unittest.TestCase):
    def run_events(self, events):
        code = "import json; events=" + repr(events) + "; [print('CUBISTRY_PHASE '+json.dumps(e),flush=True) for e in events]"
        with tempfile.TemporaryDirectory() as temporary, contextlib.redirect_stdout(io.StringIO()):
            return observe([sys.executable, "-c", code], Path(temporary) / "capture", "protocol-test")

    def events(self):
        return [{"event": "READY"}] + [
            {"event": "RESULT", "iteration": i, "checksum": "same-full-state", "values": 100, "negativeControls": 10}
            for i in range(4)] + [{"event": "DONE"}]

    def test_complete_sequence(self):
        self.assertEqual(self.run_events(self.events())["exitCode"], 0)

    def test_truncated_calls_rejected(self):
        events = self.events()
        del events[-2]
        with self.assertRaises(RuntimeError):
            self.run_events(events)

    def test_early_done_rejected(self):
        events = self.events()
        events.insert(1, events.pop())
        with self.assertRaises(ValueError):
            self.run_events(events)

    def test_coverage_drift_rejected(self):
        events = self.events()
        events[2]["negativeControls"] = 9
        with self.assertRaises(ValueError):
            self.run_events(events)

    def test_no_controls_rejected(self):
        events = self.events()
        for event in events[1:-1]:
            event["negativeControls"] = 0
        with self.assertRaises(ValueError):
            self.run_events(events)

    def test_changed_state_rejected(self):
        events = self.events()
        events[2]["checksum"] = "different-state"
        with self.assertRaises(ValueError):
            self.run_events(events)


if __name__ == "__main__":
    unittest.main()
