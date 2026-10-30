# Clock framing and studio bounds

The previous clock reused the whole row sphere (radius about 4.79) for camera fitting, floor placement, and shadow coverage. A horizontal row does not need that vertical extent in its default view.

The replacement keeps three conservative per-cube legal-turn spheres centered at the existing H–M–S placements. Camera distance fits that union in the default presentation at the current viewport aspect. During rotation the camera stays fixed: one continuous uniform presentation scale, capped at one, contains orientations that would otherwise overflow. This trades apparent size at tall orientations for containment; it does not change local puzzle geometry or the rigid arrangement. Explicit zoom retains its existing meaning.

The floor follows the final scaled union's vertical minimum, with clearance measured in scaled cube units. Shadow coverage is independently fitted in the directional light frame, including depth through the receiver. Local layer turns stay inside the same spheres and therefore do not pump the framing or floor. Clock-only opt-in leaves single-cube studio defaults intact.

This work is stacked on PR 121's shared Smart Rubber Band controller. It does not change that controller, canonical states, legal pivots, materials, or solver behavior. Source and numerical tests are separate from native browser and owner visual acceptance, which remain pending. No browser tests or deployment are authorized for this change.
