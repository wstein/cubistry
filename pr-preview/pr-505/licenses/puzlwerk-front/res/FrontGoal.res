// The front goal as views (goal.rs): one view per whole-cube rotation, each a set of accepted (piece, orientation)
// pairs per constrained slot plus a condition on the six center twists. Same order, same dropping, same duplicate rule.
open FrontArr

type view = {
  rot: int, // the rotation this view came from
  cSlot: array<int>,
  cBits: array<int>, // bit piece * 3 + twist
  eSlot: array<int>,
  eBits: array<int>, // bit piece * 2 + flip
  twist: array<int>, // per face, bit k = twist k accepted
}

type compiled = {
  count: int,
  cN: i32, // corner slots constrained per view
  cSlotA: i32, // view * 8 + i
  cBitsA: i32,
  eN: i32,
  eSlotA: i32, // view * 12 + i
  eBitsA: i32,
  twA: i32, // view * 6 + g
}

type t = {
  views: array<view>,
  candidates: array<view>, // every valid view before the duplicate rule, in rotation order (for the final rotation)
  hasTwist: bool,
  c: compiled,
}

let every = 54
let freeTwist = 15

// masks: 54 x 54 bytes, row p = accepted stickers at position p; src maps a position to its row (the rotation)
let viewOf = (masks: u8, cnt: array<int>, src: array<int>): option<view> => {
  let okCenters = ref(true)
  for face in 0 to 5 {
    let center = face * 9 + 4
    if gu(masks, src[center]->Option.getUnsafe * 54 + center) == 0 {
      okCenters := false
    }
  }
  if !okCenters.contents {
    None
  } else {
    let cs = []
    let cb = []
    let es = []
    let eb = []
    let dead = ref(false)
    for slot in 0 to 7 {
      let h = k => FrontData.cornerFacelet[slot * 3 + k]->Option.getUnsafe
      let free = ref(true)
      for k in 0 to 2 {
        if cnt[src[h(k)]->Option.getUnsafe]->Option.getUnsafe != every {
          free := false
        }
      }
      if !free.contents {
        let bits = ref(0)
        for piece in 0 to 7 {
          for tw in 0 to 2 {
            let fits = ref(true)
            for k in 0 to 2 {
              let shown = FrontData.cornerFacelet[piece * 3 + mod(k + 3 - tw, 3)]->Option.getUnsafe
              if gu(masks, src[h(k)]->Option.getUnsafe * 54 + shown) == 0 {
                fits := false
              }
            }
            if fits.contents {
              bits := bits.contents->bor(1->shl(piece * 3 + tw))
            }
          }
        }
        if bits.contents == 0 {
          dead := true
        } else {
          cs->Array.push(slot)
          cb->Array.push(bits.contents)
        }
      }
    }
    for slot in 0 to 11 {
      let h = k => FrontData.edgeFacelet[slot * 2 + k]->Option.getUnsafe
      let free = ref(true)
      for k in 0 to 1 {
        if cnt[src[h(k)]->Option.getUnsafe]->Option.getUnsafe != every {
          free := false
        }
      }
      if !free.contents {
        let bits = ref(0)
        for piece in 0 to 11 {
          for fl in 0 to 1 {
            let fits = ref(true)
            for k in 0 to 1 {
              let shown = FrontData.edgeFacelet[piece * 2 + mod(k + fl, 2)]->Option.getUnsafe
              if gu(masks, src[h(k)]->Option.getUnsafe * 54 + shown) == 0 {
                fits := false
              }
            }
            if fits.contents {
              bits := bits.contents->bor(1->shl(piece * 2 + fl))
            }
          }
        }
        if bits.contents == 0 {
          dead := true
        } else {
          es->Array.push(slot)
          eb->Array.push(bits.contents)
        }
      }
    }
    if dead.contents {
      None
    } else {
      Some({
        rot: 0,
        cSlot: cs,
        cBits: cb,
        eSlot: es,
        eBits: eb,
        twist: Array.make(~length=6, freeTwist),
      })
    }
  }
}

// Whether the corner permutation a view fixes is even; None when a corner slot is open or accepts several pieces.
let cornerParityEven = (v: view): option<bool> => {
  if Array.length(v.cSlot) != 8 {
    None
  } else {
    let perm = Array.make(~length=8, 0)
    let bad = ref(false)
    Array.forEachWithIndex(v.cSlot, (slot, i) => {
      let bits = v.cBits[i]->Option.getUnsafe
      let n = ref(0)
      let last = ref(0)
      for p in 0 to 7 {
        if bits->shr(p * 3)->band(7) != 0 {
          n := n.contents + 1
          last := p
        }
      }
      if n.contents == 1 {
        perm[slot] = last.contents
      } else {
        bad := true
      }
    })
    if bad.contents {
      None
    } else {
      let seen = Array.make(~length=8, false)
      let swaps = ref(0)
      for start in 0 to 7 {
        let at = ref(start)
        let length = ref(0)
        while !(seen[at.contents]->Option.getUnsafe) {
          seen[at.contents] = true
          at := perm[at.contents]->Option.getUnsafe
          length := length.contents + 1
        }
        swaps := swaps.contents + max(length.contents, 1) - 1
      }
      Some(mod(swaps.contents, 2) == 0)
    }
  }
}

let parityPossible = (v: view): bool =>
  switch cornerParityEven(v) {
  | None => true
  | Some(even) =>
    let reach = ref((true, false))
    Array.forEach(v.twist, mask => {
      let evenT = mask->band(5) != 0
      let oddT = mask->band(10) != 0
      let (r0, r1) = reach.contents
      let n0 = ref(false)
      let n1 = ref(false)
      if r0 {
        n0 := n0.contents || evenT
        n1 := n1.contents || oddT
      }
      if r1 {
        n1 := n1.contents || evenT
        n0 := n0.contents || oddT
      }
      reach := (n0.contents, n1.contents)
    })
    let (r0, r1) = reach.contents
    even ? r0 : r1
  }

let viewKey = (v: view): string =>
  Array.join(Array.map(v.cSlot, x => Int.toString(x)), ",") ++
  "/" ++
  Array.join(Array.map(v.cBits, x => Int.toString(x)), ",") ++
  "/" ++
  Array.join(Array.map(v.eSlot, x => Int.toString(x)), ",") ++
  "/" ++
  Array.join(Array.map(v.eBits, x => Int.toString(x)), ",") ++
  "/" ++
  Array.join(Array.map(v.twist, x => Int.toString(x)), ",")

let compile = (views: array<view>): compiled => {
  let n = Array.length(views)
  let c = {
    count: n,
    cN: makeI32(max(n, 1)),
    cSlotA: makeI32(max(n, 1) * 8),
    cBitsA: makeI32(max(n, 1) * 8),
    eN: makeI32(max(n, 1)),
    eSlotA: makeI32(max(n, 1) * 12),
    eBitsA: makeI32(max(n, 1) * 12),
    twA: makeI32(max(n, 1) * 6),
  }
  Array.forEachWithIndex(views, (v, i) => {
    si(c.cN, i, Array.length(v.cSlot))
    Array.forEachWithIndex(v.cSlot, (s, k) => {
      si(c.cSlotA, i * 8 + k, s)
      si(c.cBitsA, i * 8 + k, v.cBits[k]->Option.getUnsafe)
    })
    si(c.eN, i, Array.length(v.eSlot))
    Array.forEachWithIndex(v.eSlot, (s, k) => {
      si(c.eSlotA, i * 12 + k, s)
      si(c.eBitsA, i * 12 + k, v.eBits[k]->Option.getUnsafe)
    })
    Array.forEachWithIndex(v.twist, (m, g) => si(c.twA, i * 6 + g, m))
  })
  c
}

// accepted: nine arrays of home facelet numbers; centerUp: the front center picture stands upright
let make = (accepted: array<array<int>>, centerUp: bool): t => {
  let masks = makeU8(54 * 54)
  fillU8(masks, 1)
  // front positions 18..26 take their lists
  let cnt = Array.make(~length=54, 54)
  for i in 0 to 8 {
    let p = 18 + i
    for s in 0 to 53 {
      su(masks, p * 54 + s, 0)
    }
    Array.forEach(accepted[i]->Option.getUnsafe, id => su(masks, p * 54 + id, 1))
    let n = ref(0)
    for s in 0 to 53 {
      n := n.contents + gu(masks, p * 54 + s)
    }
    cnt[p] = n.contents
  }
  let want = Array.make(~length=6, freeTwist)
  if centerUp {
    want[2] = 1
  }
  let candidates = []
  for r in 0 to 23 {
    let src = Array.fromInitializer(~length=54, p => FrontData.rotMap[r * 54 + p]->Option.getUnsafe)
    switch viewOf(masks, cnt, src) {
    | None => ()
    | Some(v) =>
      let twist = Array.fromInitializer(~length=6, g => {
        let dest = FrontData.rotDest[r * 6 + g]->Option.getUnsafe
        let add = FrontData.rotAdd[r * 6 + g]->Option.getUnsafe
        let w = want[dest]->Option.getUnsafe
        let acc = ref(0)
        for k in 0 to 3 {
          if w->shr(band(k + add, 3))->band(1) == 1 {
            acc := acc.contents->bor(1->shl(k))
          }
        }
        acc.contents
      })
      let v = {...v, rot: r, twist}
      if parityPossible(v) {
        candidates->Array.push(v)
      }
    }
  }
  let seen = Dict.make()
  let views = []
  Array.forEach(candidates, v => {
    let k = viewKey(v)
    if Dict.get(seen, k) == None {
      Dict.set(seen, k, true)
      views->Array.push(v)
    }
  })
  {
    views,
    candidates,
    hasTwist: Array.some(views, v => Array.some(v.twist, m => m != freeTwist)),
    c: compile(views),
  }
}

let isImpossible = (g: t) => Array.length(g.views) == 0

let twistOk = (c: compiled, v: int, tw: int): bool => {
  let ok = ref(true)
  for g in 0 to 5 {
    if gi(c.twA, v * 6 + g)->shr(tw->shr(2 * g)->band(3))->band(1) == 0 {
      ok := false
    }
  }
  ok.contents
}

// Whether the position (cp co ep eo at offsets, tw) meets view v of c
let isMetAt = (
  c: compiled,
  v: int,
  cp: u8,
  co: u8,
  cb: int,
  ep: u8,
  eo: u8,
  eb: int,
  tw: int,
): bool => {
  let ok = ref(true)
  let i = ref(0)
  let n = gi(c.cN, v)
  while ok.contents && i.contents < n {
    let s = gi(c.cSlotA, v * 8 + i.contents)
    let bits = gi(c.cBitsA, v * 8 + i.contents)
    if bits->shr(gu(cp, cb + s) * 3 + gu(co, cb + s))->band(1) == 0 {
      ok := false
    }
    i := i.contents + 1
  }
  let j = ref(0)
  let m = gi(c.eN, v)
  while ok.contents && j.contents < m {
    let s = gi(c.eSlotA, v * 12 + j.contents)
    let bits = gi(c.eBitsA, v * 12 + j.contents)
    if bits->shr(gu(ep, eb + s) * 2 + gu(eo, eb + s))->band(1) == 0 {
      ok := false
    }
    j := j.contents + 1
  }
  ok.contents && twistOk(c, v, tw)
}

let isMet = (c: compiled, cp: u8, co: u8, cb: int, ep: u8, eo: u8, eb: int, tw: int): bool => {
  let found = ref(false)
  let v = ref(0)
  while !found.contents && v.contents < c.count {
    if isMetAt(c, v.contents, cp, co, cb, ep, eo, eb, tw) {
      found := true
    }
    v := v.contents + 1
  }
  found.contents
}
