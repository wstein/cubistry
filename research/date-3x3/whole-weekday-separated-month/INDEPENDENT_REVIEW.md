# Independent capacity review

Reviewer: separate agent `calendar_optimizer_proof_review`, October 29, 2026.
The reviewer separately counted the German month alphabet and checked the
ordinary 3×3 corner/edge inventories without relying on the author's script.

Verdict: **UNSAT under the stated fixed-front and exact-image assumptions**.

- First-month letters: 8; last-month letters: 10; their union: 17,
  `{A,B,D,F,G,I,J,L,M,N,O,P,R,S,T,V,Z}`.
- Middle-month alphabet: 7, `{A,E,K,O,P,U,Ä}`.
- Corner weekday case: 7 whole labels + 17 month letters + blank = 25 > 24.
- Edge weekday case: 7 whole labels + 7 month letters + 10 units digits + blank
  at R2C1 = 25 > 24.

All required glyphs occur in the Gregorian domain. Crucial qualifications are
that unused top cells must be genuine blanks and upright glyph images are exact
identities (including O versus 0). If the other upper corner is unconstrained,
the corner blank count is unavailable and that case is not proved by this
argument. Other row/day arrangements and distributed weekdays remain outside
this review. No general German-calendar impossibility claim is made.
