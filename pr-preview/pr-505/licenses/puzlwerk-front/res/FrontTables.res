// The pruning tables of the front goal: nine four-cubie group tables (groups.rs) and the center twist table (twist.rs).
// An entry is the breadth-first distance to the nearest abstract goal; the ranking of the cubies and the nine groups are
// those of groups.rs, so the bounds, and with them the node counts, are those of the Rust engine.
open FrontArr

let digits = 24
let states = 331776 // 24^4
let unseen = 255
let turns = 18

// ---- the gate of the table build: its own deadline and the progress in thousandths (gate.rs)
type gate = {
  deadline: float, // ms on the performance clock; infinity = none
  mutable index: int,
  mutable count: int,
  mutable last: int, // -1 = none
  observer: option<int => bool>, // progress in thousandths, strictly rising; false cancels
  cancel: option<i32>, // a nonzero first element cancels
}

exception TableBudget(int)
exception TableCancelled(int)

let makeGate = (budgetMs: float, observer, cancel) => {
  deadline: budgetMs == 0.0 ? infinity : now() +. budgetMs,
  index: 0,
  count: 1,
  last: -1,
  observer,
  cancel,
}

let gateStage = (g: gate, index, count) => {
  g.index = index
  g.count = max(count, 1)
}

let gateCheck = (g: gate, local: int) => {
  let overall = (g.index * 1000 + min(local, 1000)) / g.count
  let overall = max(overall, max(g.last, 0))
  if cancelRequested(g.cancel) {
    g.last = overall
    throw(TableCancelled(overall))
  }
  if now() >= g.deadline {
    g.last = overall
    throw(TableBudget(overall))
  }
  if g.last < 0 || overall > g.last {
    g.last = overall
    switch g.observer {
    | Some(f) =>
      if !f(overall) {
        throw(TableCancelled(overall))
      }
    | None => ()
    }
  }
}

// Reports the end of the build (1000) unless it was reported.
let gateFinish = (g: gate) =>
  if g.last != 1000 {
    g.last = 1000
    switch g.observer {
    | Some(f) => ignore(f(1000))
    | None => ()
    }
  }

// ---- the cubies each group tracks: (orbit, rank); orbit 0 = corner, 1 = edge
let groups: array<array<(int, int)>> = [
  [(0, 0), (0, 1), (0, 2), (0, 3)],
  [(0, 4), (0, 5), (0, 6), (0, 7)],
  [(1, 0), (1, 1), (1, 2), (1, 3)],
  [(1, 4), (1, 5), (1, 6), (1, 7)],
  [(1, 8), (1, 9), (1, 10), (1, 11)],
  [(0, 0), (0, 1), (1, 0), (1, 1)],
  [(0, 2), (0, 3), (1, 2), (1, 3)],
  [(0, 0), (0, 1), (0, 2), (1, 0)],
  [(1, 0), (1, 1), (1, 2), (0, 0)],
]

// The pieces of an orbit, the ones the views need most first: each constrained slot gives its weight
// 1 / (pieces it accepts) to each piece it accepts; ties by piece number (groups.rs `ranked`).
let ranked = (goal: FrontGoal.t, orbit: int): array<int> => {
  let (n, width) = orbit == 0 ? (8, 3) : (12, 2)
  let score = Array.make(~length=n, 0.0)
  let mask = 1->shl(width) - 1
  Array.forEach(goal.views, v => {
    let bitsList = orbit == 0 ? v.cBits : v.eBits
    Array.forEach(bitsList, bits => {
      let accepted = []
      for p in 0 to n - 1 {
        if bits->shr(p * width)->band(mask) != 0 {
          accepted->Array.push(p)
        }
      }
      let w = 1.0 /. Int.toFloat(Array.length(accepted))
      Array.forEach(accepted, p => score[p] = score[p]->Option.getUnsafe +. w)
    })
  })
  let pieces = Array.fromInitializer(~length=n, i => i)
  Array.toSorted(pieces, (a, b) => {
    let sa = score[a]->Option.getUnsafe
    let sb = score[b]->Option.getUnsafe
    if sb > sa {
      1.0
    } else if sb < sa {
      -1.0
    } else {
      Int.toFloat(a - b)
    }
  })
}

type plan = array<array<(int, int)>> // per group: four (orbit, piece)

let planGroups = (goal: FrontGoal.t, count: int): plan => {
  let corners = ranked(goal, 0)
  let edges = ranked(goal, 1)
  let chosen = switch count {
  | 2 => [0, 2]
  | 4 => [0, 2, 3, 5]
  | _ => [0, 1, 2, 3, 4, 5, 6, 7, 8]
  }
  Array.map(chosen, g =>
    Array.map(groups[g]->Option.getUnsafe, ((orbit, rank)) => (
      orbit,
      (orbit == 0 ? corners : edges)[rank]->Option.getUnsafe,
    ))
  )
}

// where each digit goes under each turn: index m * 24 + digit
let digitTable = (orbit: int): u8 => {
  let tab = makeU8(turns * digits)
  for m in 0 to turns - 1 {
    if orbit == 0 {
      for t in 0 to 7 {
        let from = FrontData.cfrom[m * 8 + t]->Option.getUnsafe
        let add = FrontData.cadd[m * 8 + t]->Option.getUnsafe
        for o in 0 to 2 {
          su(tab, m * digits + from * 3 + o, t * 3 + mod(o + add, 3))
        }
      }
    } else {
      for t in 0 to 11 {
        let from = FrontData.efrom[m * 12 + t]->Option.getUnsafe
        let add = FrontData.eadd[m * 12 + t]->Option.getUnsafe
        for o in 0 to 1 {
          su(tab, m * digits + from * 2 + o, t * 2 + bxor(o, add))
        }
      }
    }
  }
  tab
}

type t = {
  n: int, // group tables built
  orbit: i32, // group * 4 + i
  piece: i32,
  pa: i32,
  pb: i32,
  dist: u8, // group * states + flat
  twist: option<u8>, // 4096 entries, present only when a view conditions a twist
  twistStep: bool,
}

exception Unsatisfiable

// The abstract goal of one group (groups.rs Acceptance), judged per placement with a few reads.
let seedsOf = (
  goal: FrontGoal.t,
  tracked: array<(int, int)>,
  dist: u8,
  off: int,
  gate: gate,
): int => {
  let nv = Array.length(goal.views)
  // per view and slot: the accepted bits, -1 = the view does not constrain the slot
  let cCon = makeI32(nv * 8)
  let eCon = makeI32(nv * 12)
  for i in 0 to nv * 8 - 1 {
    si(cCon, i, -1)
  }
  for i in 0 to nv * 12 - 1 {
    si(eCon, i, -1)
  }
  Array.forEachWithIndex(goal.views, (v, vi) => {
    Array.forEachWithIndex(v.cSlot, (s, k) => si(cCon, vi * 8 + s, v.cBits[k]->Option.getUnsafe))
    Array.forEachWithIndex(v.eSlot, (s, k) => si(eCon, vi * 12 + s, v.eBits[k]->Option.getUnsafe))
  })
  let cornerMask = ref(0)
  let edgeMask = ref(0)
  Array.forEach(tracked, ((orbit, piece)) =>
    if orbit == 0 {
      cornerMask := cornerMask.contents->bor(7->shl(piece * 3))
    } else {
      edgeMask := edgeMask.contents->bor(3->shl(piece * 2))
    }
  )
  // ok[i * 24 + d]: the views that do not reject tracked cubie i at digit d
  let ok = makeI32(4 * digits)
  Array.forEachWithIndex(tracked, ((orbit, piece), i) => {
    let width = orbit == 0 ? 3 : 2
    for d in 0 to digits - 1 {
      let slot = d / width
      let o = mod(d, width)
      let acc = ref(0)
      for v in 0 to nv - 1 {
        let bits = gi(orbit == 0 ? cCon : eCon, v * (orbit == 0 ? 8 : 12) + slot)
        if bits == -1 || bits->shr(piece * width + o)->band(1) == 1 {
          acc := acc.contents->bor(1->shl(v))
        }
      }
      si(ok, i * digits + d, acc.contents)
    }
  })
  let mustC = makeI32(max(nv, 1))
  let mustE = makeI32(max(nv, 1))
  Array.forEachWithIndex(goal.views, (v, vi) => {
    let mc = ref(0)
    Array.forEachWithIndex(v.cSlot, (s, k) =>
      if v.cBits[k]->Option.getUnsafe->band(0xFFFFFF->bxor(cornerMask.contents)) == 0 {
        mc := mc.contents->bor(1->shl(s))
      }
    )
    let me = ref(0)
    Array.forEachWithIndex(v.eSlot, (s, k) =>
      if v.eBits[k]->Option.getUnsafe->band(0xFFFFFF->bxor(edgeMask.contents)) == 0 {
        me := me.contents->bor(1->shl(s))
      }
    )
    si(mustC, vi, mc.contents)
    si(mustE, vi, me.contents)
  })
  let isCorner = Array.map(tracked, ((orbit, _)) => orbit == 0)
  let c0 = isCorner[0]->Option.getUnsafe
  let c1 = isCorner[1]->Option.getUnsafe
  let c2 = isCorner[2]->Option.getUnsafe
  let c3 = isCorner[3]->Option.getUnsafe
  let seeds = ref(0)
  let flat = ref(0)
  for d3 in 0 to digits - 1 {
    for d2 in 0 to digits - 1 {
      for d1 in 0 to digits - 1 {
        for d0 in 0 to digits - 1 {
          if mod(flat.contents, 4096) == 0 {
            gateCheck(gate, flat.contents * 300 / states)
          }
          let views =
            gi(ok, d0)
            ->band(gi(ok, digits + d1))
            ->band(gi(ok, 2 * digits + d2))
            ->band(gi(ok, 3 * digits + d3))
          if views != 0 {
            let corners =
              (c0 ? 1->shl(d0 / 3) : 0)
              ->bor(c1 ? 1->shl(d1 / 3) : 0)
              ->bor(c2 ? 1->shl(d2 / 3) : 0)
              ->bor(c3 ? 1->shl(d3 / 3) : 0)
            let edges =
              (c0 ? 0 : 1->shl(d0 / 2))
              ->bor(c1 ? 0 : 1->shl(d1 / 2))
              ->bor(c2 ? 0 : 1->shl(d2 / 2))
              ->bor(c3 ? 0 : 1->shl(d3 / 2))
            let hit = ref(false)
            let v = ref(0)
            while !hit.contents && v.contents < nv {
              if (
                views->shr(v.contents)->band(1) == 1 &&
                gi(mustC, v.contents)->band(bxor(corners, 0xFFFFFF)) == 0 &&
                gi(mustE, v.contents)->band(bxor(edges, 0xFFFFFF)) == 0
              ) {
                hit := true
              }
              v := v.contents + 1
            }
            if hit.contents {
              su(dist, off + flat.contents, 0)
              seeds := seeds.contents + 1
            }
          }
          flat := flat.contents + 1
        }
      }
    }
  }
  seeds.contents
}

// The center twists after turn m: face m / 3 gains m % 3 + 1 quarters (model.rs twist_step).
let twistStep = (tw: int, m: int): int => {
  let shift = 2 * (m / 3)
  let turned = band(tw->shr(shift)->band(3) + mod(m, 3) + 1, 3)
  tw->band(bxor(3->shl(shift), 0xFFFF))->bor(turned->shl(shift))
}

let twistTable = (goal: FrontGoal.t): option<u8> =>
  if !goal.hasTwist {
    None
  } else {
    let dist = makeU8(4096)
    fillU8(dist, unseen)
    let frontier = ref(makeI32(4096))
    let next = ref(makeI32(4096))
    let n = ref(0)
    for tw in 0 to 4095 {
      let met = ref(false)
      for v in 0 to goal.c.count - 1 {
        if FrontGoal.twistOk(goal.c, v, tw) {
          met := true
        }
      }
      if met.contents {
        su(dist, tw, 0)
        si(frontier.contents, n.contents, tw)
        n := n.contents + 1
      }
    }
    let level = ref(0)
    while n.contents > 0 {
      level := level.contents + 1
      let k = ref(0)
      for i in 0 to n.contents - 1 {
        let tw = gi(frontier.contents, i)
        for m in 0 to turns - 1 {
          let to = twistStep(tw, m)
          if gu(dist, to) == unseen {
            su(dist, to, level.contents)
            si(next.contents, k.contents, to)
            k := k.contents + 1
          }
        }
      }
      n := k.contents
      let tmp = frontier.contents
      frontier := next.contents
      next := tmp
    }
    Some(dist)
  }

// Builds the group tables of `plan` and the twist table. Raises TableBudget(permille) when the gate's deadline passes and
// Unsatisfiable when a table has no seed. `tablesMs` is the time of the build (the ranking, in `plan`, is not counted).
let build = (goal: FrontGoal.t, plan: plan, gate: gate): t => {
  let n = Array.length(plan)
  let dist = makeU8(n * states)
  fillU8(dist, unseen)
  // The coordinate of a group is its flat index f = p01 + 576 * p23 (p01 = digit0 + 24 * digit1, p23 likewise); a turn
  // maps f to pa[(group * 18 + m) * 576 + p01] + pb[(group * 18 + m) * 576 + p23], the two halves of the new index.
  let pa = makeI32(n * turns * 576)
  let pb = makeI32(n * turns * 576)
  let orbit = makeI32(n * 4)
  let piece = makeI32(n * 4)
  let cTab = digitTable(0)
  let eTab = digitTable(1)
  let frontier = ref(makeI32(states))
  let next = ref(makeI32(states))
  Array.forEachWithIndex(plan, (tracked, j) => {
    gateStage(gate, j, n)
    Array.forEachWithIndex(tracked, ((o, p), i) => {
      si(orbit, j * 4 + i, o)
      si(piece, j * 4 + i, p)
    })
    let tabOf = i => gi(orbit, j * 4 + i) == 0 ? cTab : eTab
    let (t0, t1, t2, t3) = (tabOf(0), tabOf(1), tabOf(2), tabOf(3))
    for m in 0 to turns - 1 {
      for p in 0 to 575 {
        let lo = mod(p, digits)
        let hi = p / digits
        si(
          pa,
          (j * turns + m) * 576 + p,
          gu(t0, m * digits + lo) + digits * gu(t1, m * digits + hi),
        )
        si(
          pb,
          (j * turns + m) * 576 + p,
          576 * (gu(t2, m * digits + lo) + digits * gu(t3, m * digits + hi)),
        )
      }
    }
    let off = j * states
    let seeds = seedsOf(goal, tracked, dist, off, gate)
    if seeds == 0 {
      throw(Unsatisfiable)
    }
    let m0 = states
    let cnt = ref(0)
    for f in 0 to states - 1 {
      if gu(dist, off + f) == 0 {
        si(frontier.contents, cnt.contents, f)
        cnt := cnt.contents + 1
      }
    }
    let level = ref(0)
    let done_ = ref(0)
    while cnt.contents > 0 {
      level := level.contents + 1
      let k = ref(0)
      for q in 0 to cnt.contents - 1 {
        let f = gi(frontier.contents, q)
        done_ := done_.contents + 1
        if mod(done_.contents, 4096) == 0 {
          gateCheck(gate, 300 + min(done_.contents * 700 / m0, 699))
        }
        let p01 = mod(f, 576)
        let p23 = f / 576
        for m in 0 to turns - 1 {
          let b = (j * turns + m) * 576
          let to = gi(pa, b + p01) + gi(pb, b + p23)
          if gu(dist, off + to) == unseen {
            su(dist, off + to, level.contents)
            si(next.contents, k.contents, to)
            k := k.contents + 1
          }
        }
      }
      cnt := k.contents
      let tmp = frontier.contents
      frontier := next.contents
      next := tmp
    }
    gateCheck(gate, 1000)
  })
  gateFinish(gate)
  {
    n,
    orbit,
    piece,
    pa,
    pb,
    dist,
    twist: twistTable(goal),
    twistStep: goal.hasTwist,
  }
}
