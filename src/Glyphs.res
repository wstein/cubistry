// One shared printing convention for both locales. These are equivalences
// of the same glyph, never reinterpretations (such as 6 becoming 9).
let quarterTurns = glyph => switch glyph {
| "0" | " " => [0, 1, 2, 3] // centered circle / empty sticker
| "O" | "I" | "─" => [0, 2] // centered ellipse / vertical bar / horizontal bar
| _ => [0] // only the upright pose is used by the construction
}
