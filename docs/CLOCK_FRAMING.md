# Clock framing and studio bounds

The previous clock reused the whole row sphere (radius about 4.79) for camera fitting, floor placement, and shadow coverage. A horizontal row does not need that vertical extent in its default view.

The replacement keeps three conservative per-cube legal-turn spheres centered at the existing H–M–S placements. Camera distance fits that union in the default presentation at the current viewport aspect. During rotation the camera stays fixed: one continuous uniform presentation scale, capped at one, contains orientations that would otherwise overflow. This trades apparent size at tall orientations for containment; it does not change local puzzle geometry or the rigid arrangement. Explicit zoom retains its existing meaning.

The floor follows the final scaled union's vertical minimum, with clearance measured in scaled cube units. Shadow coverage is independently fitted in the directional light frame, including depth through the receiver. Local layer turns stay inside the same spheres and therefore do not pump the framing or floor. Clock-only opt-in leaves single-cube studio defaults intact.

This work is stacked on PR 121's shared Smart Rubber Band controller. It does not change that controller, canonical states, legal pivots, materials, or solver behavior. Source and numerical tests are separate from native browser and owner visual acceptance, which remain pending. No browser tests or deployment are authorized for this change.

## Geometry and zoom policy

For each cube center `c` rotated into observer coordinates and legal-turn sphere radius `r`, fitting uses the support of the sphere against each perspective side plane: `d >= cz + (abs(cx) + r * hypot(1, tx)) / tx`, and the corresponding vertical expression. Here `tx` and `ty` include a 0.94 viewport margin. The cube radius is the existing shared `sqrt(3) * 1.001` bound, including seam overlap and every legal local turn. The maximum required distance over the three spheres gives the default camera distance. At another orientation, uniform scale is `min(1, defaultDistance / currentRequiredDistance)`. This is continuous and independent of the clock's local layer animations.

Explicit zoom multiplies camera distance after this normal-zoom containment calculation. Closer zoom intentionally permits cropping, as before; containment never cancels that user choice. Resizing recomputes the default fit. Ordinary rotation changes neither camera position nor camera quaternion, and does not enlarge the presentation above its normal scale. At tall orientations the entire arrangement becomes smaller while its local geometry, relative placements, and puzzle frames remain unchanged.

The final scaled sphere union supplies the floor's vertical support and the directional shadow camera's side/depth bounds before the same render. Receiver ray intersections share the caster's light-space horizontal coordinates. Depth additionally includes the receiver intersections. A tight square shadow projection preserves isotropic PCF filtering, with padding exceeding the cube-scaled filter radius plus one texel. The key direction, materials, 1024-square map, and single-cube defaults are unchanged. There is no mesh traversal or geometry allocation in the animation loop.

At aspect 1034/450 and the existing default pose, the new camera distance is about 9.30 versus the previous 21.40, floor height is about -1.90 versus -4.87, and shadow width is about 8.30 versus 18.30. These are source/numerical measurements, not a visual acceptance result. CubeAssembler's previously inspected fixed-view/model-rotation separation remains the reference; no new reference code or rendering framework is copied here.

## Verification and remaining acceptance

Run `node --test tests/clock-envelope.test.mjs tests/clock-framing.test.mjs tests/studio.test.mjs tests/viewer-rendering.test.mjs`, then `npm run typecheck`, `npm test`, and `npm run build`. The focused tests cover sphere support over viewport aspects and yaw/pitch/roll, continuity, exact current mesh vertices during legal layer turns, caster and receiver depth coverage, PCF margin, stable local-turn framing, and actual ClockStage gesture/coast/return/reset behavior with unchanged camera and canonical frames. Explicit zoom is checked through the production stage methods.

Existing projection diagnostics now sample the valid per-cube sphere union; the old whole-row AABB corners were outside that union. Their 0.96 screen threshold remains unchanged. The browser touch regression's rigid spacing is normalized by the presentation's uniform scale. Browser test source is maintained and syntax-checked only: E2E/Playwright/browser tests are **NOT RUN**. Owner checks remain required for desktop/mobile default readability, smooth size changes during free rotation, floor/shadow appearance, explicit zoom, and Smart Rubber Band return. No screenshots, recordings, merge, or deployment are provided by this change.
