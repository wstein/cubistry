// Original implementation; coordinate/normal approach informed by CubeLab.
// Coordinates centered at the core; F=+Z, U=+Y, R=+X.
type vec = (int, int, int)
type sticker = {id: int, position: vec, normal: vec, up: vec}

let rotate = ((x, y, z): vec, axis: int): vec =>
  switch axis {
  | 0 => (x, -z, y)
  | 1 => (z, y, -x)
  | _ => (-y, x, z)
  }
let coordinate = ((x, y, z): vec, axis) =>
  switch axis {
  | 0 => x
  | 1 => y
  | _ => z
  }
let facelet = (face, row, col): (vec, vec, vec) =>
  switch face {
  | 0 => ((col - 2, 2, row - 2), (0, 1, 0), (0, 0, -1)) // U
  | 1 => ((col - 2, -2, 2 - row), (0, -1, 0), (0, 0, 1)) // D
  | 2 => ((col - 2, 2 - row, 2), (0, 0, 1), (0, 1, 0)) // F
  | 3 => ((2 - col, 2 - row, -2), (0, 0, -1), (0, 1, 0)) // B
  | 4 => ((2, 2 - row, 2 - col), (1, 0, 0), (0, 1, 0)) // R
  | _ => ((-2, 2 - row, col - 2), (-1, 0, 0), (0, 1, 0)) // L
  }
let solved = () =>
  Array.fromInitializer(~length=150, id => {
    let (position, normal, up) = facelet(id / 25, mod(id, 25) / 5, mod(id, 5))
    {id, position, normal, up}
  })

// Central slices are omitted: core frame is fixed. The twelve noncentral
// single-layer quarter turns generate the ordinary 5x5 move group.
let turn = (state: array<sticker>, axis, layer) => {
  assert(axis >= 0 && axis <= 2 && layer >= -2 && layer <= 2 && layer != 0)
  state->Array.map(s =>
    coordinate(s.position, axis) == layer
      ? {
          ...s,
          position: rotate(s.position, axis),
          normal: rotate(s.normal, axis),
          up: rotate(s.up, axis),
        }
      : s
  )
}

let orbit = ((x, y, z): vec) => {
  let a = abs(x)
  let b = abs(y)
  let c = abs(z)
  let boundaries = (a == 2 ? 1 : 0) + (b == 2 ? 1 : 0) + (c == 2 ? 1 : 0)
  if boundaries == 3 {
    "corners"
  } else if boundaries == 2 {
    a == 1 || b == 1 || c == 1 ? "wings" : "middleEdges"
  } else if a + b + c == 4 {
    "diagonalCenters"
  } else if a + b + c == 3 {
    "axialCenters"
  } else {
    "fixedCenters"
  }
}
