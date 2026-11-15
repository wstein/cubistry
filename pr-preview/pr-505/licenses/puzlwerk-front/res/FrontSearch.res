// The front-goal search: IDA* over the 18 face turns, bounded by the nine group tables and the center twist table
// (ida.rs, front.rs, exact.rs). One call builds the tables, searches and returns; nothing is cached.
open FrontArr

type outcome =
  | Found({moves: string, rotation: string, nodes: float, tablesMs: float})
  | SearchBudget({nodes: float})
  | SearchCancelled({nodes: float})
  | TableCancelledOut({permille: int})
  | TableBudgetOut({permille: int})
  | NoRoute(string)
  | Invalid(string)

let faceLetters = "URFDLB"
let faceIndex = (s: string): int => faceLetters->String.indexOf(s)

// ---- the cubie model of the start (cubie.rs set_from_facelet and verify); None = not a cube
type cubie = {ca: array<int>, ea: array<int>}

let cubieOfFacelets = (letters: string): option<cubie> => {
  let chars = String.split(letters, "")
  if Array.length(chars) != 54 {
    None
  } else {
    let centers = [4, 13, 22, 31, 40, 49]->Array.map(i => chars[i]->Option.getUnsafe)
    let f = chars->Array.map(ch => centers->Array.findIndex(c => c == ch))
    let counts = Array.make(~length=6, 0)
    let bad = ref(false)
    Array.forEach(f, x =>
      if x < 0 {
        bad := true
      } else {
        counts[x] = counts[x]->Option.getUnsafe + 1
      }
    )
    if bad.contents || Array.some(counts, n => n != 9) {
      None
    } else {
      let cf = (slot, k) => FrontData.cornerFacelet[slot * 3 + k]->Option.getUnsafe
      let ef = (slot, k) => FrontData.edgeFacelet[slot * 2 + k]->Option.getUnsafe
      let ca = Array.make(~length=8, 0)
      let ea = Array.make(~length=12, 0)
      let fail = ref(false)
      for i in 0 to 7 {
        let o = ref(0)
        while (
          o.contents < 3 &&
          f[cf(i, o.contents)]->Option.getUnsafe != 0 &&
          f[cf(i, o.contents)]->Option.getUnsafe != 3
        ) {
          o := o.contents + 1
        }
        let at = k => f[cf(i, mod(o.contents + k, 3))]->Option.getUnsafe
        let (c0, c1, c2) = (at(0), at(1), at(2))
        let found = ref(false)
        for j in 0 to 7 {
          if !found.contents && c0 == cf(j, 0) / 9 && c1 == cf(j, 1) / 9 && c2 == cf(j, 2) / 9 {
            ca[i] = mod(o.contents, 3)->shl(3)->bor(j)
            found := true
          }
        }
        if !found.contents {
          fail := true
        }
      }
      for i in 0 to 11 {
        let a = f[ef(i, 0)]->Option.getUnsafe
        let b = f[ef(i, 1)]->Option.getUnsafe
        let found = ref(false)
        for j in 0 to 11 {
          if !found.contents {
            if a == ef(j, 0) / 9 && b == ef(j, 1) / 9 {
              ea[i] = j->shl(1)
              found := true
            } else if a == ef(j, 1) / 9 && b == ef(j, 0) / 9 {
              ea[i] = j->shl(1)->bor(1)
              found := true
            }
          }
        }
        if !found.contents {
          fail := true
        }
      }
      fail.contents ? None : Some({ca, ea})
    }
  }
}

// Parity of a permutation given as slot -> value (swaps = sum of cycle lengths - 1)
let permParity = (perm: array<int>): int => {
  let n = Array.length(perm)
  let seen = Array.make(~length=n, false)
  let swaps = ref(0)
  for s in 0 to n - 1 {
    let at = ref(s)
    let len = ref(0)
    while !(seen[at.contents]->Option.getUnsafe) {
      seen[at.contents] = true
      at := perm[at.contents]->Option.getUnsafe
      len := len.contents + 1
    }
    swaps := swaps.contents + max(len.contents, 1) - 1
  }
  mod(swaps.contents, 2)
}

// cubie.rs verify: every piece once, flips even, twists a multiple of 3, corner and edge parity equal
let verify = (c: cubie): bool => {
  let emask = ref(0)
  let flips = ref(0)
  Array.forEach(c.ea, v => {
    emask := emask.contents->bor(1->shl(v->shr(1)))
    flips := flips.contents + band(v, 1)
  })
  let cmask = ref(0)
  let twists = ref(0)
  Array.forEach(c.ca, v => {
    cmask := cmask.contents->bor(1->shl(band(v, 7)))
    twists := twists.contents + v->shr(3)
  })
  emask.contents == 0xfff &&
  mod(flips.contents, 2) == 0 &&
  cmask.contents == 0xff &&
  mod(twists.contents, 3) == 0 &&
  permParity(c.ca->Array.map(v => band(v, 7))) == permParity(c.ea->Array.map(v => v->shr(1)))
}

// ---- the search
type search = {
  c: FrontGoal.compiled,
  t: FrontTables.t,
  cp: u8,
  co: u8,
  ep: u8,
  eo: u8,
  tw: i32,
  gc: i32, // level * 9 + group: the four digits of the group, one per byte
  path: i32,
  cfrom: u8,
  cadd: u8,
  efrom: u8,
  eadd: u8,
  twistDist: u8,
  hasTwist: bool,
  nGroups: int,
  lazyBound: bool,
  maxNodes: float,
  deadline: float,
  onSearch: option<(float, int) => bool>, // nodes, depth every 65,536 nodes; false cancels
  cancel: option<i32>,
  // nodes is a float (exact to 2^53); tick counts to 65,536 for the clock, the observer and the cancel flag
  mutable nodes: float,
  mutable tick: int,
  mutable depth: int,
  mutable stopped: bool,
  mutable cancelled: bool,
}

// the flat index of group j after turn m from flat index f
let stepGroup = (s: search, j: int, f: int, m: int): int => {
  let b = (j * FrontTables.turns + m) * 576
  gi(s.t.pa, b + mod(f, 576)) + gi(s.t.pb, b + f / 576)
}

// the best bound of the child: the twist table and the nine group tables, as the maximum (ida.rs Bound::value)
let childValue = (s: search, d: int, m: int): int => {
  let best = ref(0)
  if s.hasTwist {
    best := gu(s.twistDist, FrontTables.twistStep(gi(s.tw, d), m))
  }
  for j in 0 to s.nGroups - 1 {
    let at = stepGroup(s, j, gi(s.gc, d * 9 + j), m)
    si(s.gc, (d + 1) * 9 + j, at)
    let v = gu(s.t.dist, j * FrontTables.states + at)
    if v > best.contents {
      best := v
    }
  }
  best.contents
}

// The same decision with an early exit: stops at the first table that reaches `left` (the child is pruned then and its
// coordinates are not used). Returns a value >= left exactly when childValue does.
let childValueLazy = (s: search, d: int, m: int, left: int): int => {
  let best = ref(0)
  if s.hasTwist {
    best := gu(s.twistDist, FrontTables.twistStep(gi(s.tw, d), m))
  }
  let j = ref(0)
  while best.contents < left && j.contents < s.nGroups {
    let at = stepGroup(s, j.contents, gi(s.gc, d * 9 + j.contents), m)
    si(s.gc, (d + 1) * 9 + j.contents, at)
    let v = gu(s.t.dist, j.contents * FrontTables.states + at)
    if v > best.contents {
      best := v
    }
    j := j.contents + 1
  }
  best.contents
}

let allowed = (f: int, g: int): bool => !(g == f || (f >= 3 && g == f - 3))

// Every 65,536 nodes: the cancel flag, the deadline, the observer. True ends the search.
let atBoundary = (s: search): bool =>
  if cancelRequested(s.cancel) {
    s.cancelled = true
    true
  } else if now() >= s.deadline {
    true
  } else {
    switch s.onSearch {
    | Some(f) =>
      if f(s.nodes, s.depth) {
        false
      } else {
        s.cancelled = true
        true
      }
    | None => false
    }
  }

let rec dfs = (s: search, d: int, left: int, last: int): bool => {
  s.nodes = s.nodes +. 1.0
  s.tick = s.tick + 1
  let boundary = s.tick == 65536
  if boundary {
    s.tick = 0
  }
  if s.nodes > s.maxNodes || (boundary && atBoundary(s)) {
    s.stopped = true
    false
  } else if left == 0 {
    FrontGoal.isMet(s.c, s.cp, s.co, d * 8, s.ep, s.eo, d * 12, gi(s.tw, d))
  } else {
    let found = ref(false)
    let g = ref(0)
    while !found.contents && !s.stopped && g.contents < 6 {
      if allowed(last, g.contents) {
        let q = ref(0)
        while !found.contents && !s.stopped && q.contents < 3 {
          let m = g.contents * 3 + q.contents
          if (s.lazyBound ? childValueLazy(s, d, m, left) : childValue(s, d, m)) < left {
            // step the position to level d + 1
            let pb = d * 8
            let nb = (d + 1) * 8
            for t in 0 to 7 {
              let from = gu(s.cfrom, m * 8 + t)
              su(s.cp, nb + t, gu(s.cp, pb + from))
              let x = gu(s.co, pb + from) + gu(s.cadd, m * 8 + t)
              su(s.co, nb + t, x >= 3 ? x - 3 : x)
            }
            let pe = d * 12
            let ne = (d + 1) * 12
            for t in 0 to 11 {
              let from = gu(s.efrom, m * 12 + t)
              su(s.ep, ne + t, gu(s.ep, pe + from))
              su(s.eo, ne + t, bxor(gu(s.eo, pe + from), gu(s.eadd, m * 12 + t)))
            }
            si(s.tw, d + 1, FrontTables.twistStep(gi(s.tw, d), m))
            si(s.path, d, m)
            if dfs(s, d + 1, left - 1, g.contents) {
              found := true
            }
          }
          q := q.contents + 1
        }
      }
      g := g.contents + 1
    }
    found.contents
  }
}

let moveWord = (path: i32, n: int): string => {
  let parts = Array.fromInitializer(~length=n, i => {
    let m = gi(path, i)
    String.charAt(faceLetters, m / 3) ++ (mod(m, 3) == 0 ? "" : mod(m, 3) == 1 ? "2" : "'")
  })
  Array.join(parts, " ")
}

let rotationWord = (goal: FrontGoal.t, s: search, level: int): string => {
  let hit = ref(-1)
  Array.forEach(goal.candidates, v =>
    if hit.contents < 0 {
      let one = FrontGoal.compile([v])
      if FrontGoal.isMet(one, s.cp, s.co, level * 8, s.ep, s.eo, level * 12, gi(s.tw, level)) {
        hit := v.rot
      }
    }
  )
  FrontData.rotShort[hit.contents]->Option.getUnsafe
}

let tableNote = (n: int, hasTwist: bool, ms: float): string =>
  `${Int.toString(
      n * FrontTables.states / 1048576,
    )} MB of tables: no corner table, no edge table, ${Int.toString(n)} group tables${hasTwist
      ? ", the center twists"
      : ""}, built in ${Float.toFixed(ms /. 1000.0, ~digits=1)} s`

// facelets: 54 letters URFDLB; twists: six numbers 0..3 (U R F D L B); accepted: nine lists of home facelets 0..53.
// tableMs <= 0: no table budget. maxMoves: the deepest route looked for.
let solve = (
  ~facelets: string,
  ~twists: array<int>,
  ~accepted: array<array<int>>,
  ~centerUp: bool,
  ~tableMs: float,
  ~searchMs: float,
  ~maxNodes: float,
  ~maxMoves: int,
  ~lazyBound: bool,
  ~onTables: option<int => bool>,
  ~onSearch: option<(float, int) => bool>,
  ~cancel: option<i32>,
): outcome =>
  switch cubieOfFacelets(facelets) {
  | None => Invalid("the start cube state is impossible")
  | Some(cube) if !verify(cube) => Invalid("the start cube state is impossible")
  | Some(cube) =>
    let twistSum = Array.reduce(twists, 0, (a, b) => a + b)
    let cornerEven = permParity(cube.ca->Array.map(v => band(v, 7))) == 0
    if (mod(twistSum, 2) == 0) != cornerEven {
      Invalid(
        "the center twists do not belong to this cube: their sum must have the parity of the corner permutation",
      )
    } else {
      let goal = FrontGoal.make(accepted, centerUp)
      if FrontGoal.isImpossible(goal) {
        NoRoute("no state meets the front goal in any rotation")
      } else {
        let gate = FrontTables.makeGate(tableMs <= 0.0 ? 0.0 : tableMs, onTables, cancel)
        // the position stacks: level 0 is the start
        let levels = maxMoves + 2
        let s0 = {
          c: goal.c,
          t: {
            FrontTables.n: 0,
            orbit: makeI32(1),
            piece: makeI32(1),
            pa: makeI32(1),
            pb: makeI32(1),
            dist: makeU8(1),
            twist: None,
            twistStep: false,
          },
          cp: makeU8(levels * 8),
          co: makeU8(levels * 8),
          ep: makeU8(levels * 12),
          eo: makeU8(levels * 12),
          tw: makeI32(levels),
          gc: makeI32(levels * 9),
          path: makeI32(levels),
          cfrom: u8OfArray(FrontData.cfrom),
          cadd: u8OfArray(FrontData.cadd),
          efrom: u8OfArray(FrontData.efrom),
          eadd: u8OfArray(FrontData.eadd),
          twistDist: makeU8(1),
          hasTwist: false,
          nGroups: 0,
          lazyBound,
          maxNodes,
          deadline: infinity,
          onSearch,
          cancel,
          nodes: 0.0,
          tick: 0,
          depth: 0,
          stopped: false,
          cancelled: false,
        }
        for t in 0 to 7 {
          su(s0.cp, t, band(cube.ca[t]->Option.getUnsafe, 7))
          su(s0.co, t, cube.ca[t]->Option.getUnsafe->shr(3))
        }
        for t in 0 to 11 {
          su(s0.ep, t, cube.ea[t]->Option.getUnsafe->shr(1))
          su(s0.eo, t, band(cube.ea[t]->Option.getUnsafe, 1))
        }
        let tw0 = ref(0)
        Array.forEachWithIndex(twists, (k, g) => tw0 := tw0.contents->bor(band(k, 3)->shl(2 * g)))
        si(s0.tw, 0, tw0.contents)
        if FrontGoal.isMet(goal.c, s0.cp, s0.co, 0, s0.ep, s0.eo, 0, tw0.contents) {
          Found({moves: "", rotation: rotationWord(goal, s0, 0), nodes: 0.0, tablesMs: 0.0})
        } else {
          let plan = FrontTables.planGroups(goal, 9)
          let t0 = now()
          switch try Ok(FrontTables.build(goal, plan, gate)) catch {
          | FrontTables.TableBudget(p) => Error(TableBudgetOut({permille: p}))
          | FrontTables.TableCancelled(p) => Error(TableCancelledOut({permille: p}))
          | FrontTables.Unsatisfiable =>
            Error(
              NoRoute(
                "unreachable: no state meets the target (the tracked cubies cannot be met by any cube)",
              ),
            )
          } {
          | Error(o) => o
          | Ok(tables) =>
            let tablesMs = now() -. t0
            let s = {
              ...s0,
              t: tables,
              twistDist: switch tables.twist {
              | Some(d) => d
              | None => makeU8(1)
              },
              hasTwist: goal.hasTwist,
              nGroups: tables.n,
              deadline: now() +. searchMs,
            }
            // packed group coordinates of the start
            for j in 0 to tables.n - 1 {
              let packed = ref(0)
              for i in 0 to 3 {
                let orbit = gi(tables.orbit, j * 4 + i)
                let piece = gi(tables.piece, j * 4 + i)
                let digit = ref(0)
                if orbit == 0 {
                  for slot in 0 to 7 {
                    if gu(s.cp, slot) == piece {
                      digit := slot * 3 + gu(s.co, slot)
                    }
                  }
                } else {
                  for slot in 0 to 11 {
                    if gu(s.ep, slot) == piece {
                      digit := slot * 2 + gu(s.eo, slot)
                    }
                  }
                }
                packed :=
                  packed.contents + digit.contents * [1, 24, 576, 13824][i]->Option.getUnsafe
              }
              si(s.gc, j, packed.contents)
            }
            // the first depth worth searching: the bound at the start
            let from = ref(0)
            if s.hasTwist {
              from := gu(s.twistDist, tw0.contents)
            }
            for j in 0 to tables.n - 1 {
              let v = gu(tables.dist, j * FrontTables.states + gi(s.gc, j))
              if v > from.contents {
                from := v
              }
            }
            let result = ref(None)
            let depth = ref(from.contents)
            while result.contents == None && depth.contents <= maxMoves {
              s.depth = depth.contents
              if dfs(s, 0, depth.contents, -1) {
                result :=
                  Some(
                    Found({
                      moves: moveWord(s.path, depth.contents),
                      rotation: rotationWord(goal, s, depth.contents),
                      nodes: s.nodes,
                      tablesMs,
                    }),
                  )
              } else if s.stopped {
                result :=
                  Some(
                    s.cancelled
                      ? SearchCancelled({nodes: s.nodes})
                      : SearchBudget({nodes: s.nodes}),
                  )
              } else {
                depth := depth.contents + 1
              }
            }
            switch result.contents {
            | Some(o) => o
            | None =>
              NoRoute(
                `no solution within ${Int.toString(
                    maxMoves,
                  )} moves: searched out, so the shortest answer is longer (${Float.toString(
                    s.nodes,
                  )} nodes; ${tableNote(tables.n, goal.hasTwist, tablesMs)}); raise --max-moves`,
              )
            }
          }
        }
      }
    }
  }
