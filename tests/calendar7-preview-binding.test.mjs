// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseState } from '../src/apps/calendar7/graph.ts';
import { stateDigest } from '../src/apps/calendar7/engine.ts';
import { previewForDate, stateForDate, wrongStickerIndices } from '../src/apps/calendar7/anydate.ts';
import { mountCalendar7 } from '../src/apps/calendar7/mount.ts';
import { fakeRoot, setup, settle, fakeStage } from './helpers/calendar7-mount.mjs';
// The any-date preview binding is independent of the chain; it is tested on the former names demo data (window May 2026 to June 2027, several best-effort months).
const start = parseState(JSON.parse(readFileSync('public/calendar7/names-demo/state.v1.json','utf8')));
const wanted = (year,month) => stateForDate(previewForDate(start,year,month),year,month);

test('display-only first configure uses an isolated actual target pose, preserving the root and shown state', async () => {
  const originalRoot = stateDigest(start.printing,start.pose), target = wanted(2026,2);
  const root = fakeRoot(), stage = fakeStage(), configure = stage.configure;
  let firstDigest;
  stage.configure = (...args) => { firstDigest ??= stateDigest(args[0],args[1]);configure(...args);args[1].up[1] = args[1].up[1] === 1 ? -1 : 1; };
  const {env} = setup({createStage:async()=>stage,dir:"names-demo"});
  const instance = await mountCalendar7(root,new URLSearchParams('year=2026&month=2'),env);
  await settle(root,'2026-02');
  const configured = stage.configs[0], shown = stage.shows.at(-1), id = wrongStickerIndices(target.pose,target.wrong)[0];
  assert.equal(firstDigest,stateDigest(start.printing,target.pose),'first paint must use the target state');
  assert.deepEqual([...configured.pose.up.slice(id*3,id*3+3)],[...target.pose.up.slice(id*3,id*3+3)],'annotation must use the actual quarter-turned target');
  assert.notEqual(configured.pose,shown,'configure receives an isolated view pose');
  assert.equal(stateDigest(configured.printing,shown),stateDigest(start.printing,target.pose));
  assert.equal(stateDigest(start.printing,start.pose),originalRoot);
  instance.dispose();
});

test('the same wrong sticker with a different target up vector rebinds its annotation', async () => {
  const first = wanted(2026,1), second = wanted(2030,8);
  assert.deepEqual(wrongStickerIndices(first.pose,first.wrong),wrongStickerIndices(second.pose,second.wrong));
  const root = fakeRoot(), {env,stage} = setup({dir:"names-demo"});
  const instance = await mountCalendar7(root,new URLSearchParams('year=2026&month=1'),env);
  await settle(root,'2026-01');
  root.date(2030,8);await settle(root,'2030-08');
  assert.equal(stage.configs.length,2,'same ids cannot reuse an annotation from another image orientation');
  assert.equal(stateDigest(stage.configs[1].printing,stage.configs[1].pose),stateDigest(start.printing,second.pose));
  instance.dispose();
});
