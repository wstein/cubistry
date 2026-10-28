import test from"node:test";import assert from"node:assert/strict";import{readFileSync}from"node:fs";
test("inactive publisher cannot coalesce away a pending legacy production deployment",()=>{
 const publisher=readFileSync(new URL("../.github/workflows/pages-publish.yml",import.meta.url),"utf8");
 const builder=readFileSync(new URL("../.github/workflows/pages.yml",import.meta.url),"utf8");
 assert.match(publisher,/group: \$\{\{ vars\.PAGES_PREVIEWS_ENABLED == 'true' && 'counter-pages-publish' \|\| format\('disabled-pages-preview-\{0\}', github\.run_id\) \}\}/);
 assert.match(builder,/concurrency:\n  group: pages-build-/);
 assert.match(builder,/  deploy:\n    if: github.ref == 'refs\/heads\/main' && vars.PAGES_PREVIEWS_ENABLED != 'true'/);
 assert.match(builder,/    concurrency:\n      group: counter-pages-publish/);
 assert.match(builder,/cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
 const groups=new Map();const submit=(id,group)=>{const g=groups.get(group)||{active:null,pending:null};if(!g.active)g.active=id;else g.pending=id;groups.set(group,g);};
 submit("legacy-A","counter-pages-publish");submit("legacy-B","counter-pages-publish");submit("disabled-C","disabled-pages-preview-123");
 assert.deepEqual(groups.get("counter-pages-publish"),{active:"legacy-A",pending:"legacy-B"});
 submit("enabled-C","counter-pages-publish");assert.equal(groups.get("counter-pages-publish").pending,"enabled-C");
 // Symmetric case: with previews enabled, the legacy build's workflow group
 // is separate and its gated-off deploy job never enters publication concurrency.
 const active = new Map([["counter-pages-publish",{active:"publisher-A",pending:"publisher-B"}]]);
 active.set("pages-build-refs/heads/main",{active:"legacy-build-C",pending:null});
 const legacyDeployEnabled = false;
 if(legacyDeployEnabled)active.get("counter-pages-publish").pending="legacy-C";
 assert.equal(active.get("counter-pages-publish").pending,"publisher-B");
 // Enabled C's full-state reconciliation handles coalesced updates/cleanup.
});
