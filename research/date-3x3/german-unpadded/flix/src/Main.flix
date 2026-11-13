// SPDX-License-Identifier: AGPL-3.0-or-later
// Independent Flix implementation: physical replay of the German 3x3 date witnesses and the W / slice checks.
// Written without reference to the Julia sources; the printed report is compared byte for byte with Julia.
import java.nio.file.Files
import java.io.File
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.HexFormat
import java.lang.{Exception, System}

type alias V = (Int32, Int32, Int32)
type alias Stk = (V, V, V)

def unwrapInt(s: String): Int32 = match Int32.fromString(s) { case Some(n) => n case None => bug!("integer expected") }
def vec(s: String): V = match List.map(unwrapInt, String.splitOn({substr = " "}, s)) {
    case x :: y :: z :: Nil => (x, y, z)
    case _ => bug!("vector expected")
}
def readLines(path: String): List[String] \ IO = {
    let txt = Files.readString(new File(path).toPath(), StandardCharsets.UTF_8);
    List.filter(l -> String.length(l) > 0, String.splitOn({substr = "\n"}, txt))
}
def sha(s: String): String \ IO = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)))

// geometry: right-hand quarter rotation about axis a
def quarter(a: Int32, v: V): V = {
    let (x, y, z) = v;
    if (a == 1) (x, 0 - z, y) else if (a == 2) (z, y, 0 - x) else (0 - y, x, z)
}
def rotv(v: V, a: Int32, q: Int32): V = match Int32.modulo(q, 4) {
    case 0 => v
    case 1 => quarter(a, v)
    case 2 => quarter(a, quarter(a, v))
    case _ => quarter(a, quarter(a, quarter(a, v)))
}
// base letter: (axis, layer, quarter turns); layer 9 = all layers
def base(c: Char): (Int32, Int32, Int32) = match c {
    case 'R' => (1, 1, -1)
    case 'L' => (1, -1, 1)
    case 'M' => (1, 0, 1)
    case 'x' => (1, 9, -1)
    case 'U' => (2, 1, -1)
    case 'D' => (2, -1, 1)
    case 'E' => (2, 0, 1)
    case 'y' => (2, 9, -1)
    case 'F' => (3, 1, -1)
    case 'B' => (3, -1, 1)
    case 'S' => (3, 0, -1)
    case 'z' => (3, 9, -1)
    case _ => bug!("illegal token")
}
def component(v: V, a: Int32): Int32 = { let (x, y, z) = v; if (a == 1) x else if (a == 2) y else z }
def turnOf(t: String): (Int32, Int32, Int32) = {
    let (a, l, q) = base(String.charAt(0, t));
    let k = if (String.length(t) == 1) 1 else if (String.charAt(1, t) == '2') 2 else -1;
    (a, l, q * k)
}
def applyTok(t: String, s: Stk): Stk = {
    let (a, l, q) = turnOf(t);
    let (p, n, u) = s;
    if (l != 9 and component(p, a) != l) s else (rotv(p, a, q), rotv(n, a, q), rotv(u, a, q))
}
def replay(toks: List[String], st: List[Stk]): List[Stk] = List.foldLeft((acc, t) -> List.map(s -> applyTok(t, s), acc), st, toks)
def invTok(t: String): String =
    if (String.length(t) == 1) t + "'" else if (String.charAt(1, t) == '2') t else String.charAt(0, t) |> Char.toString
def invWord(ws: List[String]): List[String] = List.map(invTok, List.reverse(ws))
def words(s: String): List[String] = List.filter(t -> String.length(t) > 0, String.splitOn({substr = " "}, s))
def nonzeros(p: V): Int32 = { let (x, y, z) = p; (if (x != 0) 1 else 0) + (if (y != 0) 1 else 0) + (if (z != 0) 1 else 0) }
def countOuter(ts: List[String]): Int32 = List.count(t -> List.memberOf(String.charAt(0, t), List#{'R', 'L', 'U', 'D', 'F', 'B'}), ts)
def countRot(ts: List[String]): Int32 = List.count(t -> List.memberOf(String.charAt(0, t), List#{'x', 'y', 'z'}), ts)
def countSlice(ts: List[String]): Int32 = List.count(t -> List.memberOf(String.charAt(0, t), List#{'M', 'E', 'S'}), ts)

// print: stickers by id with image
def loadPrint(path: String): List[(Stk, String)] \ IO =
    List.map(line -> match String.splitOn({substr = "\t"}, line) {
        case _ :: p :: n :: u :: img :: Nil => ((vec(p), vec(n), vec(u)), String.dropLeft(1, img))
        case _ => bug!("printing line")
    }, readLines(path))
// target: (weekday, day, month, prelude, word, correction)
def loadTargets(path: String): List[(Int32, Int32, Int32, List[String], List[String], List[String])] \ IO =
    List.map(line -> match String.splitOn({substr = "\t"}, line) {
        case d :: a :: b :: c :: Nil => match List.map(unwrapInt, String.splitOn({substr = " "}, d)) {
            case w :: dd :: m :: Nil => (w, dd, m, words(String.dropLeft(1, a)), words(String.dropLeft(1, b)), words(String.dropLeft(1, c)))
            case _ => bug!("date triple")
        }
        case _ => bug!("target line")
    }, readLines(path))

def at(xs: List[a], i: Int32): a = match List.nth(i, xs) { case Some(x) => x case None => bug!("index") }
def weekdayNames(): List[String] = List#{"MO", "DI", "MI", "DO", "FR", "SA", "SO"}
def monthNames(): List[String] = List#{"JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"}
def expectedCells(w: Int32, d: Int32, m: Int32, padded: Bool): List[String] = {
    let wd = String.toList(at(weekdayNames(), w));
    let mo = String.toList(at(monthNames(), m - 1));
    let tens = if (d >= 10) Int32.toString(d / 10) else if (padded) "0" else "";
    List#{Char.toString(at(wd, 0)), Char.toString(at(wd, 1)), "", "", tens, Int32.toString(Int32.modulo(d, 10)),
          Char.toString(at(mo, 0)), Char.toString(at(mo, 1)), Char.toString(at(mo, 2))}
}
// front cells: (image, upright-or-blank) for the nine front positions, row by row
def frontCells(st: List[Stk], img: List[String]): List[(String, Bool)] = {
    let zipped = List.zip(st, img);
    let spots = List.flatMap(y -> List.map(x -> (x, y, 1), List#{-1, 0, 1}), List#{1, 0, -1});
    List.map(spot -> match List.find(e -> { let ((p, n, _), _) = e; p == spot and n == (0, 0, 1) }, zipped) {
        case Some(((_, _, u), im)) => (im, im == "" or u == (0, 1, 0))
        case None => bug!("no front sticker")
    }, spots)
}
def cellsOk(fc: List[(String, Bool)], cells: List[String]): Bool =
    List.forAll(e -> { let ((im, up), c) = e; im == c and up }, List.zip(fc, cells))

// Gregorian 2000..2399: (weekday 0 = Monday, day, month)
def daysIn(y: Int32, m: Int32): Int32 =
    if (m == 2) { if (Int32.modulo(y, 4) == 0 and (Int32.modulo(y, 100) != 0 or Int32.modulo(y, 400) == 0)) 29 else 28 }
    else if (List.memberOf(m, List#{4, 6, 9, 11})) 30 else 31
def weekdayOf(y: Int32, m: Int32, d: Int32): Int32 = {
    let a = if (m < 3) y - 1 else y;
    Int32.modulo(a + a / 4 - a / 100 + a / 400 + at(List#{0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4}, m - 1) + d + 6, 7)
}
def patterns(): List[(Int32, Int32, Int32)] = {
    let all = List.flatMap(y -> List.flatMap(m -> List.map(d -> (weekdayOf(y, m, d), d, m), List.range(1, daysIn(y, m) + 1)), List.range(1, 13)), List.range(2000, 2400));
    Set.toList(List.foldLeft((s, t) -> Set.insert(t, s), Set#{}, all))
}
def sortedBy(xs: List[(Int32, Int32, Int32)]): List[(Int32, Int32, Int32)] = List.sort(xs)

def boolStr(b: Bool): String = if (b) "true" else "false"

def reportMode(printPath: String, targetPath: String, mode: String): Unit \ IO = {
    let pr = loadPrint(printPath);
    let st0 = List.map(fst, pr);
    let img = List.map(snd, pr);
    let tg = loadTargets(targetPath);
    let padded = mode == "padded";
    let pats = patterns();
    let got = List.map(t -> { let (w, d, m, _, _, _) = t; (w, d, m) }, tg);
    let sameSet = sortedBy(got) == sortedBy(pats);
    let centers = String.intercalate("", List.map(e -> { let ((p, _, _), im) = e; if (nonzeros(p) == 1) (if (im == "") "_" else im) else "" }, pr));
    let head = List#{
        "PRINT stickers=${List.length(pr)} centers=${centers}",
        "PATTERNS expected=${List.length(pats)} listed=${List.length(got)} sameSet=${boolStr(sameSet)}"
    };
    let rows = List.map(t -> {
        let (w, d, m, a, b, c) = t;
        let toks = a ::: b ::: c;
        let st = replay(toks, st0);
        let cells = expectedCells(w, d, m, padded);
        let ok = cellsOk(frontCells(st, img), cells) and replay(invWord(toks), st) == st0;
        (ok, "T ${w} ${d} ${m} ${String.intercalate("|", cells)} outer=${countOuter(toks)} rot=${countRot(toks)}", countOuter(toks), countRot(toks))
    }, tg);
    let bad = List.count(r -> { let (ok, _, _, _) = r; not ok }, rows);
    let good = List.filter(r -> { let (ok, _, _, _) = r; ok }, rows);
    let outers = List.map(r -> { let (_, _, o, _) = r; o }, good);
    let rots = List.map(r -> { let (_, _, _, x) = r; x }, good);
    let summary = "SUMMARY mode=${mode} targets=${List.length(tg)} failed=${bad} outerMin=${List.foldLeft(Int32.min, 1000, outers)} outerMax=${List.foldLeft(Int32.max, 0, outers)} outerSum=${List.sum(outers)} maxRotationsPerTarget=${List.foldLeft(Int32.max, 0, rots)}";
    let lines = head ::: List.map(r -> { let (_, l, _, _) = r; l }, good) ::: List#{summary};
    let text = String.intercalate("\n", lines) + "\n";
    println(String.intercalate("\n", lines));
    println("REPORT-SHA256 ${sha(text)}");
    if (bad != 0 or not sameSet) System.exit(1) else ()
}

// ---------- invariants: parity, slice words, W ----------
def inversions(p: List[Int32]): Int32 = {
    let idx = List.zip(List.range(0, List.length(p)), p);
    List.count(e -> { let ((i, a), (j, b)) = e; i < j and a > b }, List.flatMap(x -> List.map(y -> (x, y), idx), idx))
}
def parityOf(p: List[Int32]): Int32 = Int32.modulo(inversions(p), 2)
def cubieParity(k: Int32, word: List[String], st0: List[Stk]): Int32 = {
    let homes = List.sort(List.distinct(List.filter(p -> nonzeros(p) == k, List.map(s -> { let (p, _, _) = s; p }, st0))));
    let fin = replay(word, st0);
    let pairs = List.filter(e -> { let ((p, _, _), _) = e; nonzeros(p) == k }, List.zip(st0, fin));
    let ixOf = (p: V) -> match List.find(e -> { let (_, h) = e; h == p }, List.zipWithIndex(homes)) { case Some((i, _)) => i case None => bug!("cubie") };
    let perm = List.map(i -> match List.find(e -> { let ((p, _, _), _) = e; ixOf(p) == i }, pairs) {
        case Some((_, (q, _, _))) => ixOf(q)
        case None => bug!("perm")
    }, List.range(0, List.length(homes)));
    parityOf(perm)
}
def rotationWords(): List[String] = List#{"", "x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2", "x y", "x y'", "x y2", "x z", "x z'", "x z2",
    "y' x'", "y' x2", "y' z2", "z x'", "z x2", "z y", "z y2", "z' x'"}
def sliceTokens(): List[String] = List#{"M", "M'", "M2", "E", "E'", "E2", "S", "S'", "S2"}
def sliceWords(len: Int32): List[List[String]] =
    if (len == 0) List#{Nil} else List.flatMap(rest -> List.map(t -> t :: rest, sliceTokens()), sliceWords(len - 1))
def reverseWord(w: List[String]): List[String] = List.reverse(w)

def frontOk(noncenterIdx: List[Int32], s0: List[Stk], s1: List[Stk], img: List[String], w: Int32, d: Int32, m: Int32): Bool = {
    let same = List.forAll(i -> at(s0, i) == at(s1, i), noncenterIdx);
    same and cellsOk(frontCells(s1, img), expectedCells(w, d, m, false))
}
def centerName(p: V): String = match p {
    case (1, 0, 0) => "R"
    case (-1, 0, 0) => "L"
    case (0, 1, 0) => "U"
    case (0, -1, 0) => "D"
    case (0, 0, 1) => "F"
    case _ => "B"
}
def vecStr(v: V): String = { let (x, y, z) = v; "(${x}, ${y}, ${z})" }

def wcheckMode(printPath: String, targetPath: String, wtext: String): Unit \ IO = {
    let pr = loadPrint(printPath);
    let st0 = List.map(fst, pr);
    let img = List.map(snd, pr);
    let tg = loadTargets(targetPath);
    let wd = words(wtext);
    let parityLines = List.map(r -> {
        let w = words(r);
        "ROT ${if (r == "") "-" else r} ${cubieParity(3, w, st0)} ${cubieParity(2, w, st0)}"
    }, rotationWords());
    let ee = List.count(r -> r != "" and cubieParity(3, words(r), st0) == 0 and cubieParity(2, words(r), st0) == 0, rotationWords());
    let d1 = List.filter(t -> { let (_, d, _, _, _, _) = t; d < 10 }, tg);
    let routes = List.map(t -> { let (w, d, m, a, b, c) = t; (w, d, m, replay(a ::: b ::: c, st0)) }, d1);
    let noncenter = List.filter(i -> { let (p, _, _) = at(st0, i); nonzeros(p) != 1 }, List.range(0, List.length(st0)));
    let sliceLines = List.flatMap(len -> {
        let ws = sliceWords(len);
        let results = List.map(w -> (w, replay(w, st0)), ws);
        let restored = List.filter(e -> { let (_, s) = e; List.forAll(i -> at(s, i) == at(st0, i), noncenter) }, results);
        let pure = List.filter(e -> { let (_, s) = e; s != st0 }, restored);
        let head = "SLICE length=${len} words=${List.length(ws)} cornersEdgesRestored=${List.length(restored)} pureCenterNontrivial=${List.length(pure)}";
        let detail = if (len == 4) List.sort(List.map(e -> {
                let (w, _) = e;
                let cnt = List.count(r -> { let (a, b, c, s0) = r; frontOk(noncenter, s0, replay(w, s0), img, a, b, c) }, routes);
                "SLICEWORD ${String.intercalate(" ", w)} blankFront=${cnt}/${List.length(routes)}"
            }, pure)) else Nil;
        head :: detail
    }, List#{1, 2, 3, 4});
    let finals = List.map(r -> { let (a, b, c, s0) = r; (frontOk(noncenter, s0, replay(wd, s0), img, a, b, c), replay(wd, s0)) }, routes);
    let nok = List.count(fst, finals);
    let glyph = List.map(f -> { let (_, s1) = f; match List.find(e -> { let (_, im) = e; im == "0" }, List.zip(s1, img)) {
        case Some(((p, _, u), _)) => "${centerName(p)} up=${vecStr(u)}"
        case None => bug!("glyph")
    } }, finals);
    let kinds = List.sort(List.distinct(glyph));
    let glyphLines = List.map(k -> "GLYPH0 ${k} ${List.count(g -> g == k, glyph)}", kinds);
    let wl = "WCHECK W=${String.intercalate(" ", wd)} outer=${countOuter(wd)} rotations=${countRot(wd)} slices=${countSlice(wd)} targets=${List.length(routes)} ok=${nok}";
    let lines = ("PARITY corner/edge permutation parity of the 24 rotations (0 even, 1 odd)" :: parityLines) ::: List#{"ROT-EVEN-EVEN-NONIDENTITY ${ee}"} ::: sliceLines ::: (wl :: glyphLines);
    let text = String.intercalate("\n", lines) + "\n";
    println(String.intercalate("\n", lines));
    println("REPORT-SHA256 ${sha(text)}");
    if (nok != List.length(routes)) System.exit(1) else ()
}

def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    match Sys.Env.getArgs() {
        case "report" :: p :: t :: mode :: Nil => reportMode(p, t, mode)
        case "wcheck" :: p :: t :: w :: Nil => wcheckMode(p, t, w)
        case _ => { println("usage: report PRINTING TARGETS padded|unpadded | wcheck PRINTING TARGETS \"W\""); System.exit(2) }
    }
})
