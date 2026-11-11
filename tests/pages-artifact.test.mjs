import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLICATION_PATH} from '../scripts/pages/publication.mjs';
const workflow=readFileSync('.github/workflows/pages-publish.yml','utf8');
const publish=readFileSync('scripts/pages/publish.mjs','utf8');
// Every step that starts with "- " and uses upload-pages-artifact, with its `with:` block.
const steps=[...workflow.matchAll(/^ {6}- (?:if: .*\n {8})?uses: actions\/upload-pages-artifact@[^\n]*\n(?: {8,}[^\n]*\n)*/gm)].map(m=>m[0]);

test('the receipt is a dotfile, which upload-pages-artifact drops unless include-hidden-files is set',()=>{
  assert.match(PUBLICATION_PATH,/^\./);
});
test('both publisher uploads package combined-site with include-hidden-files: true',()=>{
  assert.equal(steps.length,2);
  for(const step of steps){
    assert.match(step,/^ {10}path: combined-site$/m);
    assert.match(step,/^ {10}include-hidden-files: true$/m,`missing include-hidden-files in:\n${step}`);
  }
});
test('prepare writes the receipt at PUBLICATION_PATH inside the uploaded directory',()=>{
  assert.match(publish,/writeFile\(`combined-site\/\$\{PUBLICATION_PATH\}`,/);
});
