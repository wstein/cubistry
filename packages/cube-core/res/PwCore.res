// PuzWerk domain implementation. Runtime topology is size 2 only.
// Signed integer geometry preserves the same F=+Z,U=+Y,R=+X convention as
// Cubistry's protected Geometry.res research implementation (not its 5x5 topology).
type vec = (float, float, float)
type rotation = array<vec>
type topology = {kind: string, size: int}
type move = {face: string, turns: int}
type sourceCubie = {id: int, position: vec}
type sourceSticker = {
  id: int,
  cubie: int,
  normal: vec,
  up: vec,
  assetId: string,
  materialId: string,
  equivalentQuarterTurns: array<int>,
}
type print = {
  schema: string,
  version: int,
  id: string,
  topology: topology,
  cubies: array<sourceCubie>,
  stickers: array<sourceSticker>,
}
type cubieState = {id: int, position: vec, orientation: rotation}
type state = {
  schema: string,
  version: int,
  printId: string,
  topology: topology,
  cubies: array<cubieState>,
}
type pose = {id: int, cubie: int, p: vec, n: vec, up: vec, assetId: string, materialId: string}
type facelet = {position: vec, normal: vec, assetId: string, up: vec, matching?: string}
type target = {schema: string, version: int, facelets: array<facelet>}
@val external freeze: 'a => 'a = "Object.freeze"
@val external frozen: 'a => bool = "Object.isFrozen"
@val external values: 'a => array<JSON.t> = "Object.values"
@val external clone: 'a => 'a = "structuredClone"
external json: 'a => JSON.t = "%identity"
@val external finite: float => bool = "Number.isFinite"
@val external integer: float => bool = "Number.isInteger"
let demand = (condition, message) =>
  if !condition {
    JsError.throwWithMessage(message)
  }
let rec freezeJson = value => {
  switch json(value) {
  | JSON.Array(_) | JSON.Object(_) =>
    if !frozen(value) {
      values(value)->Array.forEach(v => {
        let _ = freezeJson(v)
      })
      let _ = freeze(value)
    }
  | _ => ()
  }
  value
}
let deepFreeze = value => {
  let _ = freezeJson(json(value))
  value
}
let axes: array<vec> = [
  (1.0, 0.0, 0.0),
  (-1.0, 0.0, 0.0),
  (0.0, 1.0, 0.0),
  (0.0, -1.0, 0.0),
  (0.0, 0.0, 1.0),
  (0.0, 0.0, -1.0),
]
let identity: rotation = [(1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)]
let eq = ((x, y, z): vec, (a, b, c): vec) => x == a && y == b && z == c
let dot = ((x, y, z): vec, (a, b, c): vec) => x *. a +. y *. b +. z *. c
let cross = ((x, y, z): vec, (a, b, c): vec): vec => (
  y *. c -. z *. b,
  z *. a -. x *. c,
  x *. b -. y *. a,
)
let clean = n => n == 0.0 ? 0.0 : n
let cleanVec = ((x, y, z): vec): vec => (clean(x), clean(y), clean(z))
let rotate = ((x, y, z): vec, r: rotation): vec => {
  let (a, b, c) = Array.getUnsafe(r, 0)
  let (d, e, f) = Array.getUnsafe(r, 1)
  let (g, h, i) = Array.getUnsafe(r, 2)
  cleanVec((x *. a +. y *. d +. z *. g, x *. b +. y *. e +. z *. h, x *. c +. y *. f +. z *. i))
}
let record = (value: JSON.t, name) =>
  switch value {
  | JSON.Object(d) => d
  | _ => JsError.throwWithMessage("Invalid " ++ name)
  }
let field = (o, key) => o->Dict.get(key)->Option.getOr(JSON.Null)
let string = value =>
  switch value {
  | JSON.String(s) => s
  | _ => JsError.throwWithMessage("Expected string")
  }
let number = value =>
  switch value {
  | JSON.Number(n) if finite(n) => n
  | _ => JsError.throwWithMessage("Expected finite number")
  }
let int = value => {
  let n = number(value)
  demand(integer(n) && n >= -2147483648.0 && n <= 2147483647.0, "Expected bounded integer")
  Int.fromFloat(n)
}
let array = value =>
  switch value {
  | JSON.Array(a) => a
  | _ => JsError.throwWithMessage("Expected array")
  }
let identifier = value =>
  switch value {
  | JSON.String(s) => /^[A-Za-z0-9_-]{1,96}$/->RegExp.test(s)
  | _ => false
  }
let vec = value =>
  switch value {
  | JSON.Array(a) =>
    a->Array.length == 3 &&
      a->Array.every(v =>
        switch v {
        | JSON.Number(n) => finite(n)
        | _ => false
        }
      )
  | _ => false
  }
let readVec = value => {
  demand(vec(value), "Invalid vector")
  let a = array(value)
  (number(Array.getUnsafe(a, 0)), number(Array.getUnsafe(a, 1)), number(Array.getUnsafe(a, 2)))
}
let axis = value => vec(value) && axes->Array.some(v => eq(v, readVec(value)))
let corner = value =>
  vec(value) &&
  array(value)->Array.every(v => {
    let n = number(v)
    n == -1.0 || n == 1.0
  })
let topology = value => {
  let o = record(value, "topology")
  demand(
    field(o, "kind") == JSON.String("cube") && field(o, "size") == JSON.Number(2.0),
    "Unsupported topology: only cube size 2 is implemented",
  )
  deepFreeze({kind: "cube", size: 2})
}
let properRotation = value =>
  switch value {
  | JSON.Array(a) =>
    a->Array.length == 3 &&
    a->Array.every(axis) &&
    eq(
      cross(readVec(Array.getUnsafe(a, 0)), readVec(Array.getUnsafe(a, 1))),
      readVec(Array.getUnsafe(a, 2)),
    ) &&
    dot(readVec(Array.getUnsafe(a, 0)), readVec(Array.getUnsafe(a, 1))) == 0.0
  | _ => false
  }
let readRotation = value => {
  demand(properRotation(value), "Invalid rotation")
  array(value)->Array.map(readVec)
}
let unique = a => a->Array.everyWithIndex((v, i) => a->Array.findIndex(x => x == v) == i)
let vecKey = v => JSON.stringify(json(v))
let validatePrint = value => {
  let o = record(value, "print")
  demand(
    field(o, "schema") == JSON.String("cubistry.print") && field(o, "version") == JSON.Number(1.0),
    "Unsupported print schema/version",
  )
  let topology = topology(field(o, "topology"))
  let id = field(o, "id")
  demand(identifier(id), "Invalid print ID")
  let rawCubies = array(field(o, "cubies"))
  let rawStickers = array(field(o, "stickers"))
  demand(rawCubies->Array.length == 8, "A 2x2 print needs eight cubies")
  demand(rawStickers->Array.length == 24, "A 2x2 print needs 24 stickers")
  let cubies: array<sourceCubie> = rawCubies->Array.map(raw => {
    let c = record(raw, "source cubie")
    let id = int(field(c, "id"))
    demand(id >= 0 && id < 8 && corner(field(c, "position")), "Invalid source cubie")
    {id, position: readVec(field(c, "position"))}
  })
  demand(
    unique(cubies->Array.map(c => c.id)) && unique(cubies->Array.map(c => vecKey(c.position))),
    "Source cubies must occupy distinct positions and IDs",
  )
  let stickers: array<sourceSticker> = rawStickers->Array.map(raw => {
    let s = record(raw, "source sticker")
    let id = int(field(s, "id"))
    let cubie = {
      demand(
        switch field(s, "cubie") {
        | JSON.Number(n) => integer(n)
        | _ => false
        },
        "Sticker cubie ID must be an integer",
      )
      int(field(s, "cubie"))
    }
    demand(id >= 0 && id < 24, "Invalid or duplicate sticker ID")
    demand(cubie >= 0 && cubie < 8, "Sticker cubie ID must be an integer")
    let p = cubies->Array.find(c => c.id == cubie)->Option.getOrThrow
    let normal = field(s, "normal")
    let up = field(s, "up")
    demand(
      axis(normal) &&
      axis(up) &&
      dot(readVec(normal), readVec(up)) == 0.0 &&
      dot(p.position, readVec(normal)) == 1.0,
      "Invalid source sticker frame",
    )
    demand(
      identifier(field(s, "assetId")) && identifier(field(s, "materialId")),
      "Invalid sticker asset/material reference",
    )
    let sym = array(field(s, "equivalentQuarterTurns"))->Array.map(int)
    let sorted = sym->Array.toSorted((a, b) => Int.toFloat(a - b))
    demand(
      unique(sym) && (sorted == [0] || sorted == [0, 2] || sorted == [0, 1, 2, 3]),
      "Invalid optical symmetry",
    )
    {
      id,
      cubie,
      normal: readVec(normal),
      up: readVec(up),
      assetId: string(field(s, "assetId")),
      materialId: string(field(s, "materialId")),
      equivalentQuarterTurns: sym,
    }
  })
  demand(unique(stickers->Array.map(s => s.id)), "Invalid or duplicate sticker ID")
  demand(
    unique(stickers->Array.map(s => Int.toString(s.cubie) ++ vecKey(s.normal))),
    "Duplicate physical source face",
  )
  deepFreeze({schema: "cubistry.print", version: 1, id: string(id), topology, cubies, stickers})
}
let validateState = (value, print: print) => {
  let o = record(value, "state")
  demand(
    field(o, "schema") == JSON.String("cubistry.state") && field(o, "version") == JSON.Number(1.0),
    "Unsupported state schema/version",
  )
  let _ = topology(field(o, "topology"))
  demand(
    field(o, "printId") == JSON.String(print.id),
    "State does not belong to this immutable print",
  )
  let rawCubies = array(field(o, "cubies"))
  demand(rawCubies->Array.length == 8, "State needs eight cubies")
  let cubies: array<cubieState> = rawCubies->Array.map(raw => {
    let c = record(raw, "cubie state")
    let id = int(field(c, "id"))
    demand(
      id >= 0 && id < 8 && corner(field(c, "position")) && properRotation(field(c, "orientation")),
      "Invalid physical cubie state",
    )
    let position = readVec(field(c, "position"))
    let orientation = readRotation(field(c, "orientation"))
    let source = print.cubies->Array.find(c => c.id == id)->Option.getOrThrow
    demand(
      eq(rotate(source.position, orientation), position),
      "Cubie orientation and position disagree",
    )
    {id, position, orientation}
  })
  demand(
    unique(cubies->Array.map(c => c.id)) && unique(cubies->Array.map(c => vecKey(c.position))),
    "Two physical cubies cannot share a position or ID",
  )
  let twist = cubies->Array.reduce(0, (sum, c) => {
    let source = print.cubies->Array.find(s => s.id == c.id)->Option.getOrThrow
    let (_, sy, _) = source.position
    let ud = rotate((0.0, sy, 0.0), c.orientation)
    let (x, y, z) = c.position
    let order =
      x *. y *. z == 1.0
        ? [(0.0, y, 0.0), (x, 0.0, 0.0), (0.0, 0.0, z)]
        : [(0.0, y, 0.0), (0.0, 0.0, z), (x, 0.0, 0.0)]
    let index = order->Array.findIndex(n => eq(n, ud))
    demand(index >= 0, "Invalid corner twist frame")
    sum + index
  })
  demand(mod(twist, 3) == 0, "Unreachable size-2 corner twist sum")
  deepFreeze({
    schema: "cubistry.state",
    version: 1,
    printId: print.id,
    topology: print.topology,
    cubies: cubies->Array.toSorted((a, b) => Int.toFloat(a.id - b.id)),
  })
}
let validateTarget = value => {
  let o = record(value, "target")
  let a = array(field(o, "facelets"))
  demand(
    field(o, "schema") == JSON.String("cubistry.target") &&
    field(o, "version") == JSON.Number(1.0) &&
    a->Array.length > 0 &&
    a->Array.length <= 24,
    "Invalid target schema or facelet count",
  )
  let facelets: array<facelet> = a->Array.map(raw => {
    let f = record(raw, "target facelet")
    let p = field(f, "position")
    let n = field(f, "normal")
    let u = field(f, "up")
    let matching = f->Dict.get("matching")->Option.map(string)
    demand(
      corner(p) &&
      axis(n) &&
      axis(u) &&
      dot(readVec(n), readVec(u)) == 0.0 &&
      dot(readVec(p), readVec(n)) == 1.0 &&
      identifier(field(f, "assetId")) &&
      (matching == None || matching == Some("exact") || matching == Some("equivalent")),
      "Invalid target facelet",
    )
    {
      position: readVec(p),
      normal: readVec(n),
      up: readVec(u),
      assetId: string(field(f, "assetId")),
      ?matching,
    }
  })
  demand(
    unique(facelets->Array.map(f => vecKey(f.position) ++ vecKey(f.normal))),
    "Duplicate target position",
  )
  deepFreeze({schema: "cubistry.target", version: 1, facelets})
}
let stateEquals = (a: state, b: state) =>
  a.printId == b.printId &&
  a.topology == b.topology &&
  a.cubies->Array.length == b.cubies->Array.length &&
  a.cubies->Array.every(c =>
    b.cubies->Array.some(d =>
      c.id == d.id && eq(c.position, d.position) && c.orientation == d.orientation
    )
  )
let printEquals = (a: print, b: print) =>
  a.id == b.id &&
  a.topology == b.topology &&
  a.cubies->Array.length == b.cubies->Array.length &&
  a.stickers->Array.length == b.stickers->Array.length &&
  a.cubies->Array.every(c =>
    b.cubies->Array.some(d => c.id == d.id && eq(c.position, d.position))
  ) &&
  a.stickers->Array.every(s =>
    b.stickers->Array.some(t =>
      s.id == t.id &&
      s.cubie == t.cubie &&
      eq(s.normal, t.normal) &&
      eq(s.up, t.up) &&
      s.assetId == t.assetId &&
      s.materialId == t.materialId &&
      s.equivalentQuarterTurns->Array.toSorted((a, b) => Int.toFloat(a - b)) ==
        t.equivalentQuarterTurns->Array.toSorted((a, b) => Int.toFloat(a - b))
    )
  )
let targetEquals = (a: target, b: target) =>
  a.facelets->Array.length == b.facelets->Array.length &&
    a.facelets->Array.every(s =>
      b.facelets->Array.some(t =>
        eq(s.position, t.position) &&
        eq(s.normal, t.normal) &&
        eq(s.up, t.up) &&
        s.assetId == t.assetId &&
        s.matching->Option.getOr("exact") == t.matching->Option.getOr("exact")
      )
    )
