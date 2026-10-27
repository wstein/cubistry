// ReScript owns notation, rigid cubie transitions, sticker frames and targets.
open PwCore
type presentation = {from: state, to: state, move: move}
let layer = face =>
  switch face {
  | "R" => (0, 1.0, -1)
  | "L" => (0, -1.0, 1)
  | "U" => (1, 1.0, -1)
  | "D" => (1, -1.0, 1)
  | "F" => (2, 1.0, -1)
  | "B" => (2, -1.0, 1)
  | _ => JsError.throwWithMessage("Unsupported legal move")
  }
let faceLayers = {
  "R": (0, 1.0, -1),
  "L": (0, -1.0, 1),
  "U": (1, 1.0, -1),
  "D": (1, -1.0, 1),
  "F": (2, 1.0, -1),
  "B": (2, -1.0, 1),
}
let coordinate = ((x, y, z): vec, axis) =>
  switch axis {
  | 0 => x
  | 1 => y
  | _ => z
  }
let rotations: array<rotation> =
  axes->Array.flatMap(x =>
    axes->Array.filter(y => dot(x, y) == 0.0)->Array.map(y => [x, y, cross(x, y)])
  )
let positions: array<vec> =
  [-1.0, 1.0]->Array.flatMap(x =>
    [-1.0, 1.0]->Array.flatMap(y => [-1.0, 1.0]->Array.map(z => (x, y, z)))
  )
let quarter = ((x, y, z): vec, axis) =>
  cleanVec(
    switch axis {
    | 0 => (x, -.z, y)
    | 1 => (z, y, -.x)
    | 2 => (-.y, x, z)
    | _ => JsError.throwWithMessage("Invalid rotation axis")
    },
  )
let parseMove = raw => {
  let text = switch raw {
  | JSON.String(s) => s
  | _ => JsError.throwWithMessage("Move must be a string")
  }
  demand(/^[RLUDFB](2|')?$/->RegExp.test(text), "Unsupported move notation")
  let face = text->String.slice(~start=0, ~end=1)
  deepFreeze({face, turns: text->String.endsWith("2") ? 2 : text->String.endsWith("'") ? -1 : 1})
}
let validateMove = raw => {
  let o = record(raw, "move")
  let face = string(field(o, "face"))
  let turns = int(field(o, "turns"))
  let _ = layer(face)
  demand(turns == 1 || turns == 2 || turns == -1, "Unsupported legal move")
  deepFreeze({face, turns})
}
let parseAlg = raw => {
  let s = string(raw)
  demand(s->String.length <= 4096, "Invalid or excessive algorithm")
  let s = s->String.trim
  deepFreeze(
    s == ""
      ? []
      : s
        ->String.splitByRegExp(/\s+/)
        ->Array.map(v => parseMove(JSON.String(v->Option.getOrThrow))),
  )
}
let serializeMove = (m: move) => {
  let _ = validateMove(json(m))
  m.face ++ (m.turns == 2 ? "2" : m.turns == -1 ? "'" : "")
}
let inverseMoves = (moves: array<move>) =>
  deepFreeze(
    moves->Array.toReversed->Array.map(m => {face: m.face, turns: m.turns == 2 ? 2 : -m.turns}),
  )
let turnVector = (v: vec, move: move) => {
  let (axis, _, direction) = layer(move.face)
  let out = ref(v)
  for _ in 1 to mod(move.turns * direction + 4, 4) {
    out := quarter(out.contents, axis)
  }
  out.contents
}
let initialState = (print: print) =>
  validateState(
    json({
      schema: "cubistry.state",
      version: 1,
      printId: print.id,
      topology: print.topology,
      cubies: print.cubies->Array.map(c => {id: c.id, position: c.position, orientation: identity}),
    }),
    print,
  )
let applyMove = (state: state, raw: move) => {
  let move = validateMove(json(raw))
  let (axis, which, _) = layer(move.face)
  demand(state.topology.size == 2, "Only size 2 mechanics are implemented")
  deepFreeze({
    ...state,
    cubies: state.cubies->Array.map(c =>
      coordinate(c.position, axis) != which
        ? c
        : {
            ...c,
            position: turnVector(c.position, move),
            orientation: c.orientation->Array.map(v => turnVector(v, move)),
          }
    ),
  })
}
let applyMoves = (state: state, moves: array<move>) => moves->Array.reduce(state, applyMove)
let stickerPoses = (print: print, state: state): array<pose> => {
  demand(state.printId == print.id, "State/print mismatch")
  deepFreeze(
    print.stickers->Array.map(s => {
      let c = state.cubies->Array.find(c => c.id == s.cubie)->Option.getOrThrow
      {
        id: s.id,
        cubie: s.cubie,
        p: c.position,
        n: rotate(s.normal, c.orientation),
        up: rotate(s.up, c.orientation),
        assetId: s.assetId,
        materialId: s.materialId,
      }
    }),
  )
}
let matchesTarget = (print: print, state: state, target: target) => {
  let poses = stickerPoses(print, state)
  target.facelets->Array.every(f =>
    poses->Array.some(s => {
      if !eq(s.p, f.position) || !eq(s.n, f.normal) || s.assetId != f.assetId {
        false
      } else if f.matching != Some("equivalent") {
        eq(s.up, f.up)
      } else {
        let source = print.stickers->Array.find(v => v.id == s.id)->Option.getOrThrow
        source.equivalentQuarterTurns->Array.some(
          q => {
            let up = ref(s.up)
            for _ in 1 to q {
              up := cross(s.n, up.contents)
            }
            eq(up.contents, f.up)
          },
        )
      }
    })
  )
}
let presentMove = (state: state, move: move): presentation =>
  deepFreeze({from: state, to: applyMove(state, move), move})
let validatePresentation = (p: presentation, print: print) => {
  let from = validateState(json(p.from), print)
  let to = validateState(json(p.to), print)
  let move = validateMove(json(p.move))
  demand(
    stateEquals(applyMove(from, move), to),
    "Move presentation is not a legal state transition",
  )
  deepFreeze({from, to, move})
}
// The explicit legacy facelet transport uses the same ReScript rotation function.
@val external assign: (dict<JSON.t>, dict<JSON.t>) => dict<JSON.t> = "Object.assign"
let legacyMove = (raw: array<JSON.t>, notation) => {
  let move = parseMove(JSON.String(notation))
  let (axis, which, _) = layer(move.face)
  raw->Array.map(s => {
    let o = record(s, "legacy sticker")
    let p = readVec(field(o, "p"))
    if coordinate(p, axis) != which {
      s
    } else {
      let result = assign(Dict.make(), o)
      result->Dict.set("p", json(turnVector(p, move)))
      result->Dict.set("n", json(turnVector(readVec(field(o, "n")), move)))
      result->Dict.set("up", json(turnVector(readVec(field(o, "up")), move)))
      JSON.Object(result)
    }
  })
}
let capabilities = deepFreeze({
  "supportedSizes": [2],
  "notation": "single-layer outer-face R L U D F B with prime/2",
  "wideMoves": false,
  "sliceMoves": false,
  "wholeCubeMoveNotation": false,
  "search": false,
})
