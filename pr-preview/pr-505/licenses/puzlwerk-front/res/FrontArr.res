// Typed arrays with plain index access (compiles to a[i]); callers check the bounds.
type u8 = Uint8Array.t
type i32 = Int32Array.t

@new external makeU8: int => u8 = "Uint8Array"
@new external makeI32: int => i32 = "Int32Array"
@new external u8OfArray: array<int> => u8 = "Uint8Array"
@new external i32OfArray: array<int> => i32 = "Int32Array"
@get_index external gu: (u8, int) => int = ""
@set_index external su: (u8, int, int) => unit = ""
@get_index external gi: (i32, int) => int = ""
@set_index external si: (i32, int, int) => unit = ""
@send external fillU8: (u8, int) => unit = "fill"
@val @scope("performance") external now: unit => float = "now"

// Bit operations on 32-bit integers (the compiler primitives; the Pervasives names are deprecated).
@val @scope("Atomics") external atomicsLoad: (i32, int) => int = "load"

// A cancel flag: the first element of an Int32Array (a SharedArrayBuffer view in a worker) is nonzero.
let cancelRequested = (c: option<i32>): bool =>
  switch c {
  | Some(a) => atomicsLoad(a, 0) != 0
  | None => false
  }

external band: (int, int) => int = "%andint"
external bor: (int, int) => int = "%orint"
external bxor: (int, int) => int = "%xorint"
external shl: (int, int) => int = "%lslint"
external shr: (int, int) => int = "%lsrint"
