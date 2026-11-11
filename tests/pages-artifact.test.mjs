import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLICATION_PATH} from '../scripts/pages/publication.mjs';
const workflow=readFileSync('.github/workflows/pages-publish.yml','utf8');
const publish=readFileSync('scripts/pages/publish.mjs','utf8');
// Split into steps (lines starting with six spaces and "- "), keep those that use upload-pages-artifact.
const steps=workflow.split(/^(?= {6}- )/m).filter(s=>/^ {6}- [\s\S]*?uses: actions\/upload-pages-artifact@/.test(s));
const withBlock=step=>step.match(/^ {8}with:\n((?: {10,}[^\n]*\n?)*)/m)?.[1]??'';

test('the receipt is a dotfile, which upload-pages-artifact drops unless include-hidden-files is set',()=>{
  assert.match(PUBLICATION_PATH,/^\./);
});
test('every upload-pages-artifact use is a parsed step',()=>{
  assert.equal(steps.length,2);
  assert.equal(workflow.split('upload-pages-artifact@').length-1,steps.length);
});
test('each upload packages combined-site with include-hidden-files: true inside its with: block',()=>{
  for(const step of steps){
    const block=withBlock(step);
    assert.match(block,/^ {10}path: combined-site$/m);
    assert.match(block,/^ {10}include-hidden-files: true$/m,`missing include-hidden-files in with: of:\n${step}`);
  }
});
test('prepare writes the receipt at PUBLICATION_PATH inside the uploaded directory',()=>{
  assert.match(publish,/writeFile\(`combined-site\/\$\{PUBLICATION_PATH\}`,/);
});
