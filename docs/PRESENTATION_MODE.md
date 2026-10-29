# Presentation mode

The calendar and shared H–M–S clock have **Present** and **Reference view**
actions. Present hides editing controls and navigation while retaining the actual
cube viewport, digital date/time, synchronization status and errors. The existing
controllers, renderer and physical print stay mounted and continue running.

The action requests native browser fullscreen directly from the user's click.
If fullscreen is unsupported or rejected, the same presentation layout fills the
browser viewport. **Show controls** or **Escape** restores the regular layout;
focus returns to Present. Leaving native fullscreen through the browser also
restores controls. A delayed fullscreen request cannot reopen presentation after
it has been canceled.

Reference view changes the camera only. It restores the selected calendar's
shallow top/right view or the shared clock's row view, preserving the current
physical pose, selected print, requested target, speed and active legal sequence.
It is available during motion. Both clock lettering prints use the same action.

Responsive layout uses the available viewport and retains the existing camera
fitting. The non-production banner remains visible on PR previews and takes its
own layout space. Mobile browsers may provide the viewport layout without native
fullscreen. There is no automatic fullscreen on load, screen-wake lock or stored
presentation preference in this feature.

## Validation

```sh
npm run typecheck
npm run build
npm run test:e2e -- tests/browser/presentation.spec.mjs
npm run test:pr-preview -- tests/pages-infra/presentation.spec.mjs
```

Browser regressions exercise native fullscreen, both clock lettering prints,
calendar motion, desktop/mobile resizing, rejected and unavailable fullscreen,
Escape/focus restoration, delayed-request cancellation and the nested-preview
banner. The controls are hidden using layout styles; no physical state or
sticker image is rewritten to enter or leave presentation.
