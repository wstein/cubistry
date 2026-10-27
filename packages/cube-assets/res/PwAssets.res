// Pure, reusable asset DTO/reference validation and lossless JSON codec.
// Fetch, DOM SVG inspection, fonts and pixel lifetimes intentionally stay TS.
open PwCore
let limits = deepFreeze({
  "count": 64,
  "bytesPerFile": 262144,
  "totalBytes": 4194304,
  "pixelsPerSide": 1024,
  "decodedPixels": 8388608,
  "textCodePoints": 512,
  "timeoutMs": 10000,
})
let color = value =>
  switch value {
  | JSON.String(s) => /^#[0-9a-fA-F]{6}$/->RegExp.test(s)
  | _ => false
  }
let hash = value =>
  switch value {
  | JSON.String(s) => /^[0-9a-f]{64}$/->RegExp.test(s)
  | _ => false
  }
let safeAssetPath = value => {
  let valid = switch value {
  | JSON.String(s) =>
    s->String.length <= 256 &&
    /^\/[A-Za-z0-9_/-]+\.(svg|png|webp|woff2)$/->RegExp.test(s) &&
    !(s->String.includes("//"))
  | _ => false
  }
  demand(valid, "Asset URL must be a bounded same-origin static path")
  string(value)
}
@val external codepoints: string => array<string> = "Array.from"
let validateAssets = (value, prints: array<print>) => {
  let a = record(value, "assets")
  demand(
    field(a, "schema") == JSON.String("cubistry.assets") && field(a, "version") == JSON.Number(1.0),
    "Unsupported asset schema/version",
  )
  let list = name => {
    let items = array(field(a, name))
    demand(items->Array.length <= 64, "Invalid " ++ name ++ " list")
    items->Array.map(item => record(item, name))
  }
  let fonts = list("fonts")
  let materials = list("materials")
  let documents = list("documents")
  let images = list("images")
  fonts->Array.forEach(f => {
    let family = field(f, "family")
    let weight = field(f, "weight")
    let license = field(f, "license")
    demand(
      identifier(field(f, "id")) &&
      field(f, "format") == JSON.String("woff2") &&
      hash(field(f, "sha256")) &&
      switch family {
      | JSON.String(s) => /^[A-Za-z][A-Za-z0-9 _-]{0,63}$/->RegExp.test(s)
      | _ => false
      } &&
      switch weight {
      | JSON.Number(n) => integer(n) && n >= 100.0 && n <= 900.0
      | _ => false
      } &&
      switch license {
      | JSON.String(s) => s->String.length <= 128
      | _ => false
      },
      "Invalid font metadata",
    )
    demand(safeAssetPath(field(f, "url"))->String.endsWith(".woff2"), "Font URL/format mismatch")
  })
  materials->Array.forEach(m => {
    demand(
      identifier(field(m, "id")) &&
      color(field(m, "color")) &&
      switch field(m, "roughness") {
      | JSON.Number(n) => finite(n) && n >= 0.0 && n <= 1.0
      | _ => false
      },
      "Invalid material",
    )
  })
  documents->Array.forEach(d => {
    let fontId = field(d, "fontId")
    demand(
      identifier(field(d, "id")) &&
      switch field(d, "text") {
      | JSON.String(s) =>
        codepoints(s)->Array.length <= 512 && s->String.split("\n")->Array.length <= 16
      | _ => false
      } &&
      identifier(fontId) &&
      fonts->Array.some(f => field(f, "id") == fontId) &&
      color(field(d, "color")) &&
      color(field(d, "background")),
      "Invalid text/font reference",
    )
    ["width", "height", "fontSize", "minFontSize", "lineHeight"]->Array.forEach(k => {
      demand(
        switch field(d, k) {
        | JSON.Number(n) => integer(n) && n > 0.0 && n <= 1024.0
        | _ => false
        },
        "Invalid text " ++ k,
      )
    })
    demand(
      number(field(d, "minFontSize")) <= number(field(d, "fontSize")),
      "Invalid text font-size range",
    )
  })
  images->Array.forEach(i => {
    demand(identifier(field(i, "id")), "Invalid image ID")
    switch field(i, "kind") {
    | JSON.String("color") => demand(color(field(i, "color")), "Invalid flat image color")
    | JSON.String("image") =>
      let format = field(i, "format")
      demand(
        (format == JSON.String("svg") ||
        format == JSON.String("png") ||
        format == JSON.String("webp")) && hash(field(i, "sha256")),
        "Unsupported image format or missing integrity hash",
      )
      demand(
        safeAssetPath(field(i, "url"))->String.endsWith("." ++ string(format)),
        "Image URL/format mismatch",
      )
    | JSON.String("text") =>
      let docId = field(i, "documentId")
      demand(identifier(docId), "Invalid text-document reference type")
      let doc = documents->Array.find(d => field(d, "id") == docId)
      demand(Option.isSome(doc), "Invalid text image reference/crop")
      let crop = array(field(i, "crop"))
      demand(
        crop->Array.length == 4 &&
          crop->Array.every(v =>
            switch v {
            | JSON.Number(n) => integer(n)
            | _ => false
            }
          ),
        "Invalid text image reference/crop",
      )
      let x = number(Array.getUnsafe(crop, 0))
      let y = number(Array.getUnsafe(crop, 1))
      let w = number(Array.getUnsafe(crop, 2))
      let h = number(Array.getUnsafe(crop, 3))
      let d = doc->Option.getOrThrow
      demand(
        x >= 0.0 &&
        y >= 0.0 &&
        w > 0.0 &&
        h > 0.0 &&
        x +. w <= number(field(d, "width")) &&
        y +. h <= number(field(d, "height")),
        "Text crop exceeds document",
      )
    | _ => JsError.throwWithMessage("Unsupported asset kind")
    }
  })
  [
    ("font", fonts),
    ("material", materials),
    ("document", documents),
    ("image", images),
  ]->Array.forEach(((name, items)) =>
    demand(unique(items->Array.map(i => field(i, "id"))), "Duplicate " ++ name ++ " ID")
  )
  prints->Array.forEach(p =>
    p.stickers->Array.forEach(s =>
      demand(
        images->Array.some(i => field(i, "id") == JSON.String(s.assetId)) &&
          materials->Array.some(m => field(m, "id") == JSON.String(s.materialId)),
        "Unresolved physical sticker asset/material",
      )
    )
  )
  deepFreeze(clone(value))
}
let serializeDesignState = (rawPrint, rawState, rawAssets) => {
  let print = validatePrint(rawPrint)
  let state = validateState(rawState, print)
  let assets = validateAssets(rawAssets, [print])
  JSON.stringify(
    json({
      "schema": "cubistry.design-state",
      "version": 1,
      "print": print,
      "state": state,
      "assets": assets,
    }),
  )
}
let parseDesignState = text => {
  demand(text->String.length <= 2097152, "Design-state JSON exceeds limit")
  let raw = record(JSON.parseOrThrow(text), "design-state")
  demand(
    field(raw, "schema") == JSON.String("cubistry.design-state") &&
      field(raw, "version") == JSON.Number(1.0),
    "Unsupported design-state schema/version",
  )
  let print = validatePrint(field(raw, "print"))
  let state = validateState(field(raw, "state"), print)
  let assets = validateAssets(field(raw, "assets"), [print])
  deepFreeze({"print": print, "state": state, "assets": assets})
}
