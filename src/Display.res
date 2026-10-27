// Calendar inputs use Monday=0 and January=0. Locale spelling is intentional.
let weekdaysDE = ["MON", "DIE", "MIT", "DON", "FRE", "SAM", "SON"]
let weekdaysEN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
let monthsDE = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"]
let monthsEN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

let two = n => (n < 10 ? "0" : "") ++ Int.toString(n)

let rowsWithDayPadding = (language, weekday, day, month, year, minute, spacePadDay) => {
  let weekdays = language == "DE" ? weekdaysDE : weekdaysEN
  let months = language == "DE" ? monthsDE : monthsEN
  [
    weekdays->Array.getUnsafe(weekday) ++ "  ",
    (spacePadDay && day < 10 ? " " ++ Int.toString(day) : two(day)) ++ months->Array.getUnsafe(month),
    " " ++ Int.toString(year),
    "─────",
    two(minute / 60) ++ ":" ++ two(mod(minute, 60)),
  ]
}

// Preserve the original zero-padded specification for existing experiments.
let rows = (language, weekday, day, month, year, minute) =>
  rowsWithDayPadding(language, weekday, day, month, year, minute, false)

// Names describe physical piece orbits, not merely facelet positions.
let orbit = (row, col) => {
  let x = abs(col - 2)
  let y = abs(row - 2)
  switch (x, y) {
  | (2, 2) => "corners"
  | (2, 1) | (1, 2) => "wings"
  | (2, 0) | (0, 2) => "middleEdges"
  | (1, 1) => "diagonalCenters"
  | (1, 0) | (0, 1) => "axialCenters"
  | _ => "fixedCenters"
  }
}
