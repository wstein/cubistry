// Independent Flix checker for the HSM seconds-first raw-input profile.
//
// Profile document: proof-checkers/HSM-PROFILE.md.  Additive to the frozen issue-74
// contract: Counter.flix, Geometry.flix, Conformance.flix and the pinned corpus are
// untouched; only the command dispatch in Main.flix learned `hsm` and `hsm-conformance`.
//
// Written independently of the Julia implementation (proof-checkers/julia/Hsm.jl) and
// of every Python verifier.  Model: 24 outward facelets of the 2x2x2 lattice, eight rigid
// corners with 24 poses each, 18 face turns (a half turn is 1 HTM).  Physical replay of the
// saved words uses full (position, normal, up) sticker frames; distances and graphs use a
// facelet-permutation model that is tied back to those frames.  All names are prefixed
// `hsm` because every Flix source file shares one namespace.
import java.lang.IllegalArgumentException

enum HsmState with Eq { case HS(Vector[Vec], Vector[Vec], Vector[Vec]) }

type alias HsmLat = { fPos = Vector[Int32], fNrm = Vector[Int32], fIdx = Vector[Int32], mf = Vector[Int32] }

type alias HsmEng = { lat = HsmLat, trip = Vector[Int32], ptr = Vector[Int32], posOf = Vector[Int32],
                      tw = Vector[Int32], atp = Vector[Int32], dist = Vector[Int32],
                      cornerOf = Vector[Int32], localOf = Vector[Int32], members = Vector[Int32] }

enum HsmPrint { case HP(Vector[Int32], Vector[Vec], Vector[Vec], Vector[Vec], Vector[String], Vector[Int32]) }

type alias HsmMode = { letter = String, maximum = Int32, direction = Int32, cap = Int32, nodes = Int32, edges = Int32,
                       numer = Int64, denom = Int64, periodHtm = Int32, periodEdges = Int32, maxHtm = Int32,
                       setup = List[Int32], frames = HsmState, steps = List[(Int32, Int32, List[Int32])] }

type alias HsmReplay = { costs = List[Int32], poses = List[Vector[Int32]], seen = Set[Int32],
                         invHtm = Int32, invMax = Int32, invNot = Int32 }

def hsmAt(v: Vector[Int32], i: Int32): Int32 = Vector.get(i, v)
def hsmFront(): Vector[Vec] = Vector#{Vec.V(-1, 1, 1), Vec.V(1, 1, 1), Vec.V(-1, -1, 1), Vec.V(1, -1, 1)}
def hsmZ(): Vec = Vec.V(0, 0, 1)
def hsmY(): Vec = Vec.V(0, 1, 0)
def hsmMaxTokens(): Int32 = 64
def hsmMaxSteps(): Int32 = 100000

// ---------------------------------------------------------------- moves
def hsmAxisOf(m: Int32): Int32 = hsmAt(Vector#{0, 0, 1, 1, 2, 2}, m / 3)
def hsmSideOf(m: Int32): Int32 = if (Int32.modulo(m / 3, 2) == 0) 1 else -1
def hsmQuarters(m: Int32): Int32 = {
    let amount = match Int32.modulo(m, 3) { case 0 => 1 case 1 => 2 case _ => -1 };
    -hsmSideOf(m) * amount
}
def hsmTokenOf(m: Int32): String =
    Vector.get(m / 3, Vector#{"R", "L", "U", "D", "F", "B"}) + Vector.get(Int32.modulo(m, 3), Vector#{"", "2", "'"})
def hsmTokenMove(t: String): Int32 = match List.find(m -> hsmTokenOf(m) == t, List.range(0, 18)) {
    case Some(m) => m
    case None => -1
}
def hsmParseWord(word: String): List[Int32] \ IO =
    if (word == "") Nil else {
        let ts = String.splitOn({substr = " "}, word);
        require(List.length(ts) <= hsmMaxTokens(), "move word token limit");
        List.map(t -> {
            let m = hsmTokenMove(t);
            require(m >= 0, "explicit legal single-space-separated move notation required");
            m
        }, ts)
    }
def hsmInvMove(m: Int32): Int32 = (m / 3) * 3 + (match Int32.modulo(m, 3) { case 0 => 2 case 1 => 1 case _ => 0 })
def hsmInvWord(ms: List[Int32]): List[Int32] = List.map(hsmInvMove, List.reverse(ms))

// ---------------------------------------------------------------- lattice
def hsmPosVec(i: Int32): Vec =
    Vec.V(if (i >= 4) 1 else -1, if (Int32.modulo(i / 2, 2) == 1) 1 else -1, if (Int32.modulo(i, 2) == 1) 1 else -1)
def hsmNrmVec(k: Int32): Vec = {
    let s = if (Int32.modulo(k, 2) == 1) 1 else -1;
    match k / 2 { case 0 => Vec.V(s, 0, 0) case 1 => Vec.V(0, s, 0) case _ => Vec.V(0, 0, s) }
}
def hsmPosIndex(v: Vec): Int32 =
    (if (coordinate(v, 0) > 0) 4 else 0) + (if (coordinate(v, 1) > 0) 2 else 0) + (if (coordinate(v, 2) > 0) 1 else 0)
def hsmNrmIndex(v: Vec): Int32 = {
    let a = if (coordinate(v, 0) != 0) 0 else if (coordinate(v, 1) != 0) 1 else 2;
    a * 2 + (if (coordinate(v, a) > 0) 1 else 0)
}
def hsmPairs(): List[(Int32, Int32)] =
    List.flatMap(p -> List.map(k -> (p, k), List.filter(k -> dot(hsmPosVec(p), hsmNrmVec(k)) == 1, List.range(0, 6))),
                 List.range(0, 8))
def hsmBuildLat(): HsmLat = {
    let pairs = List.toVector(hsmPairs());
    let fPos = Vector.map(fst, pairs);
    let fNrm = Vector.map(snd, pairs);
    let fIdx = Vector.init(i -> match Vector.indexOf((i / 6, Int32.modulo(i, 6)), pairs) {
        case Some(k) => k
        case None => -1
    }, 48);
    let mf = Vector.init(i -> {
        let m = i / 24;
        let f = Int32.modulo(i, 24);
        let p = hsmPosVec(hsmAt(fPos, f));
        let n = hsmNrmVec(hsmAt(fNrm, f));
        let a = hsmAxisOf(m);
        if (coordinate(p, a) == hsmSideOf(m)) {
            let q = hsmQuarters(m);
            hsmAt(fIdx, hsmPosIndex(rotate(p, a, q)) * 6 + hsmNrmIndex(rotate(n, a, q)))
        } else f
    }, 18 * 24);
    { fPos = fPos, fNrm = fNrm, fIdx = fIdx, mf = mf }
}
def hsmFacelet(lat: HsmLat, p: Vec, n: Vec): Int32 = hsmAt(lat#fIdx, hsmPosIndex(p) * 6 + hsmNrmIndex(n))
def hsmFaceletPos(lat: HsmLat, f: Int32): Vec = hsmPosVec(hsmAt(lat#fPos, f))
def hsmFaceletNrm(lat: HsmLat, f: Int32): Vec = hsmNrmVec(hsmAt(lat#fNrm, f))

def hsmKeyOf(a: Int32, b: Int32, c: Int32, d: Int32): Int32 = ((a * 24 + b) * 24 + c) * 24 + d
def hsmKeyMove(lat: HsmLat, m: Int32, k: Int32): Int32 = {
    let mv = f -> hsmAt(lat#mf, m * 24 + f);
    hsmKeyOf(mv(k / 13824), mv(Int32.modulo(k / 576, 24)), mv(Int32.modulo(k / 24, 24)), mv(Int32.modulo(k, 24)))
}

// ---------------------------------------------------------------- print
def hsmExactKeys(j: J, names: List[String], what: String): Unit \ IO = match j {
    case J.Obj(xs) => {
        let ks = List.map(fst, xs);
        require(List.length(ks) == List.length(names) and List.forAll(n -> List.memberOf(n, ks), names),
                what + " must have exactly the keys " + String.intercalate(",", List.sort(names)))
    }
    case _ => throw new IllegalArgumentException(what + " must be an object")
}
def hsmInt(j: J, lo: Int32, hi: Int32): Int32 \ IO = {
    let v = integer(j);
    require(v >= lo and v <= hi, "integer range");
    v
}
def hsmStr(j: J): String \ IO = text(j)
def hsmGlyphChars(): String = "0123456789HSM"

def hsmParsePrint(rows: J): HsmPrint \ IO = {
    let xs = array(rows);
    require(List.length(xs) == 24, "exactly 24 immutable stickers");
    let front = hsmFront();
    let stickers = List.map(row -> {
        hsmExactKeys(row, List#{"id", "cubie", "p", "n", "up", "image", "slot"}, "sticker");
        (hsmInt(field(row, "id"), 0, 23), hsmInt(field(row, "cubie"), 0, 7), vec(field(row, "p")), vec(field(row, "n")),
         vec(field(row, "up")), hsmStr(field(row, "image")), hsmInt(field(row, "slot"), 0, 3))
    }, xs);
    foreach (t <- List.zipWithIndex(stickers)) {
        let (id, _, p, n, u, im, slot) = snd(t);
        let i = fst(t);
        require(id == i, "ordered unique physical identities");
        require(nonzero(p) == 3, "body position is a cube corner");
        require(axis(n) and axis(u) and dot(p, n) == 1 and dot(n, u) == 0, "outward tangent sticker frame");
        require(im == "" or (String.length(im) == 1 and String.contains({substr = im}, hsmGlyphChars())), "fixed glyph or real blank");
        if (im == "") require(slot == 0, "blank artwork is used only upper-left") else {
            let f = Vector.get(slot, front);
            require((dot(p, u), dot(p, cross(u, n))) == (coordinate(f, 1), coordinate(f, 0)), "exact nonblank upright slot class");
            if (im == "H" or im == "S" or im == "M") require(slot == 1, "letters are upright only upper-right") else {
                require(slot == 2 or slot == 3, "digits are upright only lower-left or lower-right");
                require(slot != 2 or List.memberOf(im, List#{"0", "1", "2", "3", "4", "5"}), "tens glyph range")
            }
        }
    };
    let lat = hsmBuildLat();
    let faces = List.sort(List.map(t -> match t { case (_, _, p, n, _, _, _) => hsmFacelet(lat, p, n) }, stickers));
    require(faces == List.range(0, 24), "complete 24-facelet lattice");
    foreach (c <- List.range(0, 8)) {
        let g = List.filter(t -> match t { case (_, b, _, _, _, _, _) => b == c }, stickers);
        require(List.length(g) == 3, "eight rigid corners");
        let ps = List.map(t -> match t { case (_, _, p, _, _, _, _) => p }, g);
        require(List.forAll(p -> p == List.get(0, ps), ps), "eight rigid corners")
    };
    let bodies = List.distinct(List.map(t -> match t { case (_, _, p, _, _, _, _) => p }, stickers));
    require(List.length(bodies) == 8, "eight distinct body positions");
    let kinds = List.map(t -> match t { case (_, _, _, _, _, im, slot) => hsmKind(im, slot) }, stickers);
    let required = List.append(List#{"blank", "letter:H", "letter:S", "letter:M"},
        List.append(List.map(d -> "tens:" + Int32.toString(d), List.range(0, 6)), List.map(d -> "units:" + Int32.toString(d), List.range(0, 10))));
    require(List.forAll(k -> List.memberOf(k, kinds), required), "every blank, letter, tens and units glyph is printed");
    HsmPrint.HP(Vector.init(i -> match List.get(i, stickers) { case (_, b, _, _, _, _, _) => b }, 24),
                Vector.init(i -> match List.get(i, stickers) { case (_, _, p, _, _, _, _) => p }, 24),
                Vector.init(i -> match List.get(i, stickers) { case (_, _, _, n, _, _, _) => n }, 24),
                Vector.init(i -> match List.get(i, stickers) { case (_, _, _, _, u, _, _) => u }, 24),
                Vector.init(i -> match List.get(i, stickers) { case (_, _, _, _, _, im, _) => im }, 24),
                Vector.init(i -> match List.get(i, stickers) { case (_, _, _, _, _, _, s) => s }, 24))
}
def hsmKind(im: String, slot: Int32): String =
    if (im == "") "blank" else if (im == "H" or im == "S" or im == "M") "letter:" + im
    else if (slot == 2) "tens:" + im else "units:" + im

def hsmCubie(pr: HsmPrint, i: Int32): Int32 = match pr { case HsmPrint.HP(c, _, _, _, _, _) => Vector.get(i, c) }
def hsmP(pr: HsmPrint, i: Int32): Vec = match pr { case HsmPrint.HP(_, p, _, _, _, _) => Vector.get(i, p) }
def hsmN(pr: HsmPrint, i: Int32): Vec = match pr { case HsmPrint.HP(_, _, n, _, _, _) => Vector.get(i, n) }
def hsmU(pr: HsmPrint, i: Int32): Vec = match pr { case HsmPrint.HP(_, _, _, u, _, _) => Vector.get(i, u) }
def hsmImage(pr: HsmPrint, i: Int32): String = match pr { case HsmPrint.HP(_, _, _, _, im, _) => Vector.get(i, im) }
def hsmSlot(pr: HsmPrint, i: Int32): Int32 = match pr { case HsmPrint.HP(_, _, _, _, _, s) => Vector.get(i, s) }

def hsmPrintCode(pr: HsmPrint): String = {
    let tok = i -> {
        let im = hsmImage(pr, i);
        if (im == "") "_" else if (im == "H" or im == "S" or im == "M") im
        else (if (hsmSlot(pr, i) == 2) "T" else "U") + im
    };
    String.intercalate(" | ", List.map(c -> String.intercalate(" ", List.map(tok, List.filter(i -> hsmCubie(pr, i) == c, List.range(0, 24)))), List.range(0, 8)))
}
def hsmSource(pr: HsmPrint): HsmState =
    HsmState.HS(Vector.init(i -> hsmP(pr, i), 24), Vector.init(i -> hsmN(pr, i), 24), Vector.init(i -> hsmU(pr, i), 24))

// ---------------------------------------------------------------- engine
def hsmTriple(a: Int32, b: Int32, c: Int32): Int32 = a * 576 + b * 24 + c
def hsmTripleGet(t: Int32, j: Int32): Int32 = if (j == 0) t / 576 else if (j == 1) Int32.modulo(t / 24, 24) else Int32.modulo(t, 24)
def hsmTripleMove(lat: HsmLat, m: Int32, t: Int32): Int32 = {
    let mv = f -> hsmAt(lat#mf, m * 24 + f);
    hsmTriple(mv(hsmTripleGet(t, 0)), mv(hsmTripleGet(t, 1)), mv(hsmTripleGet(t, 2)))
}

// Breadth-first closure of one rigid corner under all 18 turns; returns its 24 pose codes.
def hsmClosure(lat: HsmLat, home: Int32): Vector[Int32] = region rc {
    let list = MutList.empty(rc);
    MutList.push(home, list);
    hsmClosureLoop(lat, 0, list);
    MutList.toVector(list)
}
def hsmClosureLoop(lat: HsmLat, i: Int32, list: MutList[Int32, r]): Unit \ r =
    if (i >= MutList.size(list)) () else {
        let t = MutList.get(i, list);
        foreach (m <- List.range(0, 18)) {
            let nt = hsmTripleMove(lat, m, t);
            if (MutList.memberOf(nt, list)) () else MutList.push(nt, list)
        };
        hsmClosureLoop(lat, i + 1, list)
    }

// Counter-clockwise twist: steps from the y-facing sticker to the sticker that faces y at home.
def hsmTwistOf(lat: HsmLat, t: Int32, homeY: Int32): Int32 = {
    let p = hsmFaceletPos(lat, hsmTripleGet(t, 0));
    let nrm = j -> hsmFaceletNrm(lat, hsmTripleGet(t, j));
    let u = match List.find(j -> coordinate(nrm(j), 1) != 0, List#{0, 1, 2}) { case Some(j) => j case None => 0 };
    let others = List.filter(j -> j != u, List#{0, 1, 2});
    let s1 = match List.find(j -> dot(cross(nrm(u), nrm(j)), p) > 0, others) { case Some(j) => j case None => -1 };
    let s2 = match List.find(j -> j != s1, others) { case Some(j) => j case None => -1 };
    if (homeY == u) 0 else if (homeY == s1) 1 else if (homeY == s2) 2 else -1
}

def hsmBuildEngine(pr: HsmPrint): HsmEng \ IO = {
    let lat = hsmBuildLat();
    let members = Vector.init(k -> List.get(Int32.modulo(k, 3), List.filter(i -> hsmCubie(pr, i) == k / 3, List.range(0, 24))), 24);
    let cornerOf = Vector.init(i -> hsmCubie(pr, i), 24);
    let localOf = Vector.init(i -> match List.findLeft(k -> hsmAt(members, hsmCubie(pr, i) * 3 + k) == i, List#{0, 1, 2}) { case Some(k) => k case None => -1 }, 24);
    let homes = List.map(c -> hsmTriple(hsmFacelet(lat, hsmP(pr, hsmAt(members, c * 3)), hsmN(pr, hsmAt(members, c * 3))),
                                         hsmFacelet(lat, hsmP(pr, hsmAt(members, c * 3 + 1)), hsmN(pr, hsmAt(members, c * 3 + 1))),
                                         hsmFacelet(lat, hsmP(pr, hsmAt(members, c * 3 + 2)), hsmN(pr, hsmAt(members, c * 3 + 2)))), List.range(0, 8));
    let closures = List.map(h -> hsmClosure(lat, h), homes);
    foreach (c <- closures) { require(Vector.length(c) == 24, "each rigid corner has 24 poses") };
    let trip = Vector.init(i -> Vector.get(Int32.modulo(i, 24), List.get(i / 24, closures)), 8 * 24);
    let ptr = Vector.init(i -> {
        let k = Int32.modulo(i, 24);
        let m = Int32.modulo(i / 24, 18);
        let c = i / (24 * 18);
        match Vector.indexOf(hsmTripleMove(lat, m, hsmAt(trip, c * 24 + k)), List.get(c, closures)) { case Some(x) => x case None => -1 }
    }, 8 * 18 * 24);
    let posOf = Vector.init(i -> hsmPosIndex(hsmFaceletPos(lat, hsmTripleGet(hsmAt(trip, i), 0))), 8 * 24);
    let homeYs = List.map(h -> match List.find(j -> coordinate(hsmFaceletNrm(lat, hsmTripleGet(h, j)), 1) != 0, List#{0, 1, 2}) { case Some(j) => j case None => -1 }, homes);
    let tw = Vector.init(i -> hsmTwistOf(lat, hsmAt(trip, i), List.get(i / 24, homeYs)), 8 * 24);
    let atp = Vector.init(i -> {
        let c = i / 24;
        let pos = Int32.modulo(i / 3, 8);
        List.get(Int32.modulo(i, 3), List.filter(k -> hsmAt(posOf, c * 24 + k) == pos, List.range(0, 24)))
    }, 8 * 8 * 3);
    // Twist invariant: every face turn changes the total twist of the eight corners by 0 mod 3.
    foreach (m <- List.range(0, 18)) {
        let deltas = List.map(pos -> {
            let ds = List.flatMap(c -> List.map(k -> {
                    let nk = hsmAt(ptr, (c * 18 + m) * 24 + k);
                    (hsmAt(posOf, c * 24 + k), Int32.modulo(hsmAt(tw, c * 24 + nk) - hsmAt(tw, c * 24 + k), 3))
                }, List.filter(k -> hsmAt(posOf, c * 24 + k) == pos, List.range(0, 24))), List.range(0, 8));
            let dv = List.map(snd, ds);
            require(List.forAll(d -> d == List.get(0, dv), dv), "twist change depends only on the position");
            List.get(0, dv)
        }, List.range(0, 8));
        require(Int32.modulo(List.sum(deltas), 3) == 0, "every face turn preserves total twist mod 3")
    };
    foreach (c <- List.range(0, 8)) { require(hsmAt(tw, c * 24) == 0, "source pose has twist zero") };
    let dist = hsmDistances(lat);
    { lat = lat, trip = trip, ptr = ptr, posOf = posOf, tw = tw, atp = atp, dist = dist,
      cornerOf = cornerOf, localOf = localOf, members = members }
}

// Four-sticker distance table over ordered facelets of four distinct corners (goal: the four front cells).
def hsmDistances(lat: HsmLat): Vector[Int32] \ IO = region rc {
    let dist = Array.repeat(rc, 24 * 24 * 24 * 24, 255);
    let queue = Array.repeat(rc, 136080, 0);
    let goal = hsmKeyOf(hsmFacelet(lat, Vec.V(-1, 1, 1), hsmZ()), hsmFacelet(lat, Vec.V(1, 1, 1), hsmZ()),
                        hsmFacelet(lat, Vec.V(-1, -1, 1), hsmZ()), hsmFacelet(lat, Vec.V(1, -1, 1), hsmZ()));
    Array.put(0, goal, dist);
    Array.put(goal, 0, queue);
    let total = hsmBfs(lat, 0, 1, dist, queue);
    require(total == 24 * 21 * 18 * 15, "every ordered four-corner placement is covered");
    Array.toVector(dist)
}
def hsmBfs(lat: HsmLat, head: Int32, tail: Int32, dist: Array[Int32, r], queue: Array[Int32, r]): Int32 \ IO + r =
    if (head >= tail) tail else {
        let k = Array.get(head, queue);
        let d = Array.get(k, dist);
        let tail2 = List.foldLeft((t, m) -> {
            let b = hsmKeyMove(lat, m, k);
            if (Array.get(b, dist) == 255) {
                Array.put(d + 1, b, dist);
                require(t < 136080, "four-corner placement count exceeds 136080");
                Array.put(b, t, queue);
                t + 1
            } else t
        }, tail, List.range(0, 18));
        hsmBfs(lat, head + 1, tail2, dist, queue)
    }

// ---------------------------------------------------------------- physical frames
def hsmTurnVec(v: Vec, p: Vec, a: Int32, side: Int32, q: Int32): Vec = if (coordinate(p, a) == side) rotate(v, a, q) else v
def hsmTurn(st: HsmState, ms: List[Int32]): HsmState = List.foldLeft((s, m) -> match s {
    case HsmState.HS(p, n, u) => {
        let a = hsmAxisOf(m);
        let side = hsmSideOf(m);
        let q = hsmQuarters(m);
        HsmState.HS(Vector.map(x -> hsmTurnVec(x, x, a, side, q), p),
                    Vector.mapWithIndex((i, x) -> hsmTurnVec(x, Vector.get(i, p), a, side, q), n),
                    Vector.mapWithIndex((i, x) -> hsmTurnVec(x, Vector.get(i, p), a, side, q), u))
    }
}, st, ms)

def hsmFacelets(lat: HsmLat, st: HsmState): Vector[Int32] = match st {
    case HsmState.HS(p, n, _) => Vector.mapWithIndex((i, x) -> hsmFacelet(lat, x, Vector.get(i, n)), p)
}

def hsmShowDisplay(pr: HsmPrint, st: HsmState, letter: String, value: Int32): Unit \ IO = match st {
    case HsmState.HS(p, n, u) => {
        let expected = Vector#{"", letter, Int32.toString(value / 10), Int32.toString(Int32.modulo(value, 10))};
        foreach (cell <- List.range(0, 4)) {
            let hits = List.filter(i -> Vector.get(i, p) == Vector.get(cell, hsmFront()) and Vector.get(i, n) == hsmZ(), List.range(0, 24));
            require(List.length(hits) == 1, "exactly one visible sticker per display cell");
            let i = List.get(0, hits);
            require(hsmImage(pr, i) == Vector.get(cell, expected), "exact real-blank/fixed-glyph display");
            require(Vector.get(cell, expected) == "" or Vector.get(i, u) == hsmY(), "nonblank glyph upright")
        }
    }
}

// ---------------------------------------------------------------- display options and distances
def hsmGlyphMatch(pr: HsmPrint, i: Int32, cell: Int32, letter: String, tens: String, units: String): Bool =
    if (cell == 0) hsmImage(pr, i) == ""
    else if (cell == 1) hsmImage(pr, i) == letter
    else if (cell == 2) hsmSlot(pr, i) == 2 and hsmImage(pr, i) == tens
    else hsmSlot(pr, i) == 3 and hsmImage(pr, i) == units

def hsmOptions(pr: HsmPrint, letter: String, value: Int32): List[(Int32, Int32, Int32, Int32)] \ IO = {
    let tens = Int32.toString(value / 10);
    let units = Int32.toString(Int32.modulo(value, 10));
    let lists = List.map(cell -> List.filter(i -> hsmGlyphMatch(pr, i, cell, letter, tens, units), List.range(0, 24)), List.range(0, 4));
    let l0 = List.get(0, lists);
    let l1 = List.get(1, lists);
    let l2 = List.get(2, lists);
    let l3 = List.get(3, lists);
    let out = List.flatMap(a -> List.flatMap(b -> List.flatMap(c -> List.flatMap(d ->
        if (List.length(List.distinct(List#{hsmCubie(pr, a), hsmCubie(pr, b), hsmCubie(pr, c), hsmCubie(pr, d)})) == 4) List#{(a, b, c, d)} else Nil,
        l3), l2), l1), l0);
    require(not List.isEmpty(out), "some distinct physical corner selection exists");
    out
}

// Minimum four-sticker distance over all options and the sorted distinct keys attaining it.
def hsmCost(eng: HsmEng, fac: Vector[Int32], opts: List[(Int32, Int32, Int32, Int32)]): (Int32, List[Int32]) \ IO = {
    let keys = List.map(o -> match o { case (a, b, c, d) => hsmKeyOf(Vector.get(a, fac), Vector.get(b, fac), Vector.get(c, fac), Vector.get(d, fac)) }, opts);
    let ds = List.map(k -> hsmAt(eng#dist, k), keys);
    let best = match List.minimum(ds) { case Some(x) => x case None => 255 };
    require(best < 255, "reachable display");
    (best, List.sort(List.distinct(List.filter(k -> hsmAt(eng#dist, k) == best, keys))))
}
def hsmShortest(eng: HsmEng, pr: HsmPrint, st: HsmState, letter: String, value: Int32): Int32 \ IO =
    fst(hsmCost(eng, hsmFacelets(eng#lat, st), hsmOptions(pr, letter, value)))

def hsmPoseOf(eng: HsmEng, st: HsmState): Vector[Int32] = {
    let fac = hsmFacelets(eng#lat, st);
    Vector.init(c -> {
        let t = hsmTriple(Vector.get(hsmAt(eng#members, c * 3), fac), Vector.get(hsmAt(eng#members, c * 3 + 1), fac), Vector.get(hsmAt(eng#members, c * 3 + 2), fac));
        match List.find(k -> hsmAt(eng#trip, c * 24 + k) == t, List.range(0, 24)) { case Some(k) => k case None => -1 }
    }, 8)
}

// ---------------------------------------------------------------- universal bound
// A counterexample is a legal assignment of poses to corners for which every physical
// selection of a display lies farther than `limit`.
def hsmUniversal(eng: HsmEng, pr: HsmPrint, limit: Int32): Option[(String, Int32)] \ IO = {
    let far = List.filter(k -> hsmAt(eng#dist, k) > limit and hsmAt(eng#dist, k) < 255, List.range(0, 331776));
    let combos = List.flatMap(l -> List.map(v -> (l, v), List.range(0, 60)), List#{"H", "S", "M"});
    List.foldLeft((acc, lv) -> match acc {
        case Some(_) => acc
        case None => hsmUniversalDisplay(eng, pr, limit, far, fst(lv), snd(lv))
    }, None, combos)
}

def hsmPoseKey(eng: HsmEng, poses: Array[Int32, r], o: (Int32, Int32, Int32, Int32)): Int32 \ r = {
    let f = s -> {
        let c = hsmAt(eng#cornerOf, s);
        hsmTripleGet(hsmAt(eng#trip, c * 24 + Array.get(c, poses)), hsmAt(eng#localOf, s))
    };
    match o { case (a, b, c, d) => hsmKeyOf(f(a), f(b), f(c), f(d)) }
}
def hsmOptionCorners(eng: HsmEng, o: (Int32, Int32, Int32, Int32)): List[Int32] = match o {
    case (a, b, c, d) => List#{hsmAt(eng#cornerOf, a), hsmAt(eng#cornerOf, b), hsmAt(eng#cornerOf, c), hsmAt(eng#cornerOf, d)}
}
def hsmPlaced(poses: Array[Int32, r], cs: List[Int32]): Bool \ r = List.forAll(c -> Array.get(c, poses) >= 0, cs)

def hsmUniversalDisplay(eng: HsmEng, pr: HsmPrint, limit: Int32, far: List[Int32], letter: String, value: Int32): Option[(String, Int32)] \ IO = region rc {
    let opts = hsmOptions(pr, letter, value);
    let corners = List.map(o -> hsmOptionCorners(eng, o), opts);
    let first = List.get(0, corners);
    let count = c -> List.count(cs -> List.memberOf(c, cs), corners);
    let relevant = List.toVector(List.sortBy(c -> (if (List.memberOf(c, first)) 0 else 1, -count(c), c), List.distinct(List.flatMap(cs -> cs, corners))));
    let poses = Array.repeat(rc, 8, -1);
    let o0 = List.get(0, opts);
    let found = List.exists(k -> {
        foreach (c <- List.range(0, 8)) { Array.put(-1, c, poses) };
        let digits = List#{k / 13824, Int32.modulo(k / 576, 24), Int32.modulo(k / 24, 24), Int32.modulo(k, 24)};
        let stickers = match o0 { case (a, b, c, d) => List#{a, b, c, d} };
        foreach (sf <- List.zip(stickers, digits)) {
            let s = fst(sf);
            let c = hsmAt(eng#cornerOf, s);
            match List.find(p -> hsmTripleGet(hsmAt(eng#trip, c * 24 + p), hsmAt(eng#localOf, s)) == snd(sf), List.range(0, 24)) {
                case Some(p) => Array.put(p, c, poses)
                case None => ()
            }
        };
        let blocked = List.exists(oc -> hsmPlaced(poses, snd(oc)) and hsmAt(eng#dist, hsmPoseKey(eng, poses, fst(oc))) <= limit, List.zip(opts, corners));
        if (blocked) false else hsmSearch(eng, opts, corners, relevant, 4, limit, poses)
    }, far);
    if (found) Some((letter, value)) else None
}

def hsmSearch(eng: HsmEng, opts: List[(Int32, Int32, Int32, Int32)], corners: List[List[Int32]], relevant: Vector[Int32],
              depth: Int32, limit: Int32, poses: Array[Int32, r]): Bool \ IO + r =
    if (depth >= Vector.length(relevant)) {
        Vector.length(relevant) < 8 or Int32.modulo(List.sum(List.map(c -> hsmAt(eng#tw, c * 24 + Array.get(c, poses)), List.range(0, 8))), 3) == 0
    } else {
        let c = hsmAt(relevant, depth);
        let used = List.map(d -> hsmAt(eng#posOf, d * 24 + Array.get(d, poses)), List.filter(d -> Array.get(d, poses) >= 0, List.range(0, 8)));
        hsmTryPose(eng, opts, corners, relevant, depth, limit, poses, c, used, 0)
    }

def hsmTryPose(eng: HsmEng, opts: List[(Int32, Int32, Int32, Int32)], corners: List[List[Int32]], relevant: Vector[Int32],
               depth: Int32, limit: Int32, poses: Array[Int32, r], c: Int32, used: List[Int32], k: Int32): Bool \ IO + r =
    if (k >= 24) false
    else if (List.memberOf(hsmAt(eng#posOf, c * 24 + k), used)) hsmTryPose(eng, opts, corners, relevant, depth, limit, poses, c, used, k + 1)
    else {
        Array.put(k, c, poses);
        let ok = not List.exists(oc -> List.memberOf(c, snd(oc)) and hsmPlaced(poses, snd(oc)) and hsmAt(eng#dist, hsmPoseKey(eng, poses, fst(oc))) <= limit, List.zip(opts, corners));
        if (ok and hsmSearch(eng, opts, corners, relevant, depth + 1, limit, poses)) true
        else {
            Array.put(-1, c, poses);
            hsmTryPose(eng, opts, corners, relevant, depth, limit, poses, c, used, k + 1)
        }
    }

// ---------------------------------------------------------------- fractions
def hsmDigits(s: String): Bool =
    String.length(s) >= 1 and String.length(s) <= 9 and List.forAll(Char.isDigit, String.toList(s))
    and (String.length(s) == 1 or String.charAt(0, s) != '0')
def hsmGcd(a: Int64, b: Int64): Int64 = if (b == 0i64) a else hsmGcd(b, Int64.modulo(a, b))
def hsmI64(s: String): Int64 = Option.getWithDefault(0i64, Int64.fromString(s))
def hsmFraction(j: J, what: String): (Int64, Int64) \ IO = {
    let parts = String.splitOn({substr = "/"}, text(j));
    require(List.length(parts) == 1 or List.length(parts) == 2, what + " must be a canonical fraction");
    require(List.forAll(hsmDigits, parts), what + " must be a canonical fraction");
    let num = hsmI64(List.get(0, parts));
    let den = if (List.length(parts) == 2) hsmI64(List.get(1, parts)) else 1i64;
    require(den >= 1i64 and hsmGcd(num, den) == 1i64 and (List.length(parts) == 1 or den > 1i64), what + " must be in lowest terms");
    (num, den)
}
def hsmFracString(num: Int64, den: Int64): String = {
    let g = hsmGcd(num, den);
    let n = num / g;
    let d = den / g;
    if (d == 1i64) Int64.toString(n) else Int64.toString(n) + "/" + Int64.toString(d)
}

// ---------------------------------------------------------------- modes
def hsmVecStrict(j: J): Vec \ IO = vec(j)

def hsmParseFrames(j: J): HsmState \ IO = {
    let xs = array(j);
    require(List.length(xs) == 24, "explicit 24-sticker period start pose");
    let rows = List.map(f -> {
        hsmExactKeys(f, List#{"id", "p", "n", "up"}, "frame");
        (hsmInt(field(f, "id"), 0, 23), hsmVecStrict(field(f, "p")), hsmVecStrict(field(f, "n")), hsmVecStrict(field(f, "up")))
    }, xs);
    require(List.map(r -> match r { case (id, _, _, _) => id }, rows) == List.range(0, 24), "frames ordered by sticker id");
    HsmState.HS(Vector.init(i -> match List.get(i, rows) { case (_, p, _, _) => p }, 24),
                Vector.init(i -> match List.get(i, rows) { case (_, _, n, _) => n }, 24),
                Vector.init(i -> match List.get(i, rows) { case (_, _, _, u) => u }, 24))
}

def hsmParseMode(m: J): HsmMode \ IO = {
    hsmExactKeys(m, List#{"letter", "maximum", "direction", "htmCap", "graphNodes", "graphEdges", "certificatePasses",
                          "optimalMeanHTM", "periodHTM", "periodEdges", "maximumHTM", "appPolicy13", "setup",
                          "periodStart", "periodStartFrames", "steps"}, "mode");
    let letter = text(field(m, "letter"));
    require(letter == "H" or letter == "S" or letter == "M", "letter H, S or M");
    let maximum = hsmInt(field(m, "maximum"), 0, 1000);
    require(maximum == 11 or maximum == 23 or maximum == 59, "range 11, 23 or 59");
    let direction = hsmInt(field(m, "direction"), -1, 1);
    require(direction == 1 or direction == -1, "direction +1 or -1");
    let cap = hsmInt(field(m, "htmCap"), 1, 6);
    require(letter != "M" or cap <= 5, "M edges are capped at five HTM");
    let policy = field(m, "appPolicy13");
    hsmExactKeys(policy, List#{"preperiodEdges", "periodEdges", "periodHTM", "maximumHTM"}, "appPolicy13");
    foreach (name <- List#{"preperiodEdges", "periodEdges", "periodHTM", "maximumHTM"}) { require(hsmInt(field(policy, name), 0, 1000000000) >= 0, "appPolicy13 integers") };
    require(hsmInt(field(m, "periodStart"), 0, 0) == 0, "period starts at the setup pose");
    let frames = hsmParseFrames(field(m, "periodStartFrames"));
    let rawSteps = array(field(m, "steps"));
    require(not List.isEmpty(rawSteps) and List.length(rawSteps) <= hsmMaxSteps(), "nonempty bounded period");
    let steps = List.map(s -> {
        hsmExactKeys(s, List#{"from", "to", "word"}, "step");
        let w = hsmParseWord(text(field(s, "word")));
        require(not List.isEmpty(w), "every edge moves");
        (hsmInt(field(s, "from"), 0, 59), hsmInt(field(s, "to"), 0, 59), w)
    }, rawSteps);
    let (numer, denom) = hsmFraction(field(m, "optimalMeanHTM"), "optimalMeanHTM");
    { letter = letter, maximum = maximum, direction = direction, cap = cap,
      nodes = hsmInt(field(m, "graphNodes"), 1, 1000000000), edges = hsmInt(field(m, "graphEdges"), 1, 1000000000),
      numer = numer, denom = denom, periodHtm = hsmInt(field(m, "periodHTM"), 1, 1000000000),
      periodEdges = hsmInt(field(m, "periodEdges"), 1, 1000000000), maxHtm = hsmInt(field(m, "maximumHTM"), 1, 6),
      setup = hsmParseWord(text(field(m, "setup"))), frames = frames, steps = steps }
}

def hsmReplay(eng: HsmEng, pr: HsmPrint, md: HsmMode, start: HsmState): HsmReplay \ IO = {
    let n = md#maximum + 1;
    let st0 = hsmTurn(start, md#setup);
    hsmShowDisplay(pr, st0, md#letter, 0);
    require(st0 == md#frames, "saved period start pose equals the replayed setup pose for every sticker frame");
    require(Int32.modulo(List.length(md#steps), n) == 0, "full laps");
    let (stEnd, valueEnd, costsRev, posesRev, seen) = List.foldLeft((acc, step) -> {
        let (st, value, costs, poses, seen) = acc;
        let (frm, to, word) = step;
        let target = Int32.modulo(value + md#direction, n);
        require(frm == value and to == target, "exact modular order");
        let c = List.length(word);
        require(c == hsmShortest(eng, pr, st, md#letter, target), "shortest legal edge from the actual full source pose");
        let st2 = hsmTurn(st, word);
        hsmShowDisplay(pr, st2, md#letter, target);
        require(hsmTurn(st2, hsmInvWord(word)) == st, "every full physical edge inverse");
        (st2, target, c :: costs, hsmPoseOf(eng, st) :: poses, Set.insert(target, seen))
    }, (st0, 0, Nil, Nil, Set#{0}), md#steps);
    require(valueEnd == 0 and stEnd == st0, "exact 24-sticker full-period closure");
    let costs = List.reverse(costsRev);
    let maxc = List.foldLeft(Int32.max, 0, costs);
    let total = List.sum(costs);
    require(maxc <= md#cap, "mode HTM ceiling");
    require(md#maxHtm == maxc and md#periodHtm == total and md#periodEdges == List.length(costs), "honest period metrics");
    require(md#numer * Int32.toInt64(md#periodEdges) == md#denom * Int32.toInt64(md#periodHtm), "honest exact period mean");
    // The same period run backwards, each edge inverted, must close the full pose and show every display.
    let (stInv, valueInv, invSum, invMax, invNot) = List.foldLeft((acc, step) -> {
        let (st, value, sum, mx, notShort) = acc;
        let (frm, to, word) = step;
        require(value == to, "inverse traversal order");
        let iw = hsmInvWord(word);
        let len = List.length(iw);
        let ns = if (len != hsmShortest(eng, pr, st, md#letter, frm)) 1 else 0;
        let st2 = hsmTurn(st, iw);
        hsmShowDisplay(pr, st2, md#letter, frm);
        (st2, frm, sum + len, Int32.max(mx, len), notShort + ns)
    }, (st0, 0, 0, 0, 0), List.reverse(md#steps));
    require(valueInv == 0 and stInv == st0, "inverse traversal closes the full pose");
    { costs = costs, poses = List.reverse(posesRev), seen = seen, invHtm = invSum, invMax = invMax, invNot = invNot }
}

// ---------------------------------------------------------------- minimum-mean certificate
def hsmPerms4(xs: List[Int32]): List[List[Int32]] =
    List.flatMap(a -> List.flatMap(b -> List.flatMap(c -> List.flatMap(d ->
        if (List.length(List.distinct(List#{a, b, c, d})) == 4) List#{List#{a, b, c, d}} else Nil, xs), xs), xs), xs)

def hsmCodeArr(poses: Array[Int32, r]): Int64 \ r =
    List.foldLeft((x, c) -> x * 24i64 + Int32.toInt64(Array.get(c, poses)), 0i64, List#{7, 6, 5, 4, 3, 2, 1, 0})
def hsmCodeVec(poses: Vector[Int32]): Int64 =
    List.foldLeft((x, c) -> x * 24i64 + Int32.toInt64(hsmAt(poses, c)), 0i64, List#{7, 6, 5, 4, 3, 2, 1, 0})

def hsmWords(eng: HsmEng, memo: MutHashMap[List[Int32], List[List[Int32]], r], rem: Int32, keys: List[Int32]): List[List[Int32]] \ r =
    if (rem == 0) List#{Nil} else {
        let mk = rem :: keys;
        match MutHashMap.get(mk, memo) {
            case Some(w) => w
            case None => {
                let out = List.flatMap(m -> {
                    let nxt = List.sort(List.distinct(List.filter(b -> hsmAt(eng#dist, b) == rem - 1, List.map(k -> hsmKeyMove(eng#lat, m, k), keys))));
                    if (List.isEmpty(nxt)) Nil else List.map(w -> m :: w, hsmWords(eng, memo, rem - 1, nxt))
                }, List.range(0, 18));
                MutHashMap.put(mk, out, memo);
                out
            }
        }
    }

def hsmRelax(i: Int32, e: Int32, stop: Int32, w: Int64, succ: Vector[Int32], active: Vector[Int32],
             pot: Array[Int64, r], parent: Array[Int32, r], changed: Bool): Bool \ r =
    if (e >= stop) changed else {
        let j = hsmAt(succ, e);
        if (hsmAt(active, j) == 1 and w + Array.get(j, pot) < Array.get(i, pot)) {
            Array.put(w + Array.get(j, pot), i, pot);
            Array.put(j, i, parent);
            hsmRelax(i, e + 1, stop, w, succ, active, pot, parent, true)
        } else hsmRelax(i, e + 1, stop, w, succ, active, pot, parent, changed)
    }

def hsmPassLoop(oi: Int32, order: Vector[Int32], start: Vector[Int32], succ: Vector[Int32], costv: Vector[Int32],
                active: Vector[Int32], pot: Array[Int64, r], parent: Array[Int32, r], num: Int64, den: Int64, changed: Bool): Bool \ r =
    if (oi >= Vector.length(order)) changed else {
        let i = hsmAt(order, oi);
        if (hsmAt(active, i) == 0) hsmPassLoop(oi + 1, order, start, succ, costv, active, pot, parent, num, den, changed)
        else {
            let w = den * Int32.toInt64(hsmAt(costv, i)) - num;
            let c2 = hsmRelax(i, hsmAt(start, i), hsmAt(start, i + 1), w, succ, active, pot, parent, changed);
            hsmPassLoop(oi + 1, order, start, succ, costv, active, pot, parent, num, den, c2)
        }
    }

def hsmWalk(x: Int32, color: Array[Int32, r], parent: Array[Int32, r]): Int32 \ r =
    if (x >= 0 and Array.get(x, color) == 0) {
        Array.put(1, x, color);
        hsmWalk(Array.get(x, parent), color, parent)
    } else x
def hsmPaint(x: Int32, color: Array[Int32, r], parent: Array[Int32, r]): Unit \ r =
    if (x >= 0 and Array.get(x, color) == 1) {
        Array.put(2, x, color);
        hsmPaint(Array.get(x, parent), color, parent)
    } else ()
def hsmHasCycle(s0: Int32, total: Int32, color: Array[Int32, r], parent: Array[Int32, r]): Bool \ r =
    if (s0 >= total) false else {
        let stop = hsmWalk(s0, color, parent);
        if (stop >= 0 and Array.get(stop, color) == 1) true
        else {
            hsmPaint(s0, color, parent);
            hsmHasCycle(s0 + 1, total, color, parent)
        }
    }

def hsmBellmanFord(pass: Int32, order: Vector[Int32], start: Vector[Int32], succ: Vector[Int32], costv: Vector[Int32],
                   active: Vector[Int32], pot: Array[Int64, r], parent: Array[Int32, r], color: Array[Int32, r], num: Int64, den: Int64): Unit \ IO + r = {
    if (pass > 20000) throw new IllegalArgumentException("ERROR: potentials did not converge") else ();
    let changed = hsmPassLoop(0, order, start, succ, costv, active, pot, parent, num, den, false);
    if (not changed) () else {
        if (Int32.modulo(pass, 8) == 0) {
            foreach (i <- List.range(0, Vector.length(costv))) { Array.put(0, i, color) };
            require(not hsmHasCycle(0, Vector.length(costv), color, parent), "a recurrent shortest-edge schedule with a lower mean exists")
        } else ();
        hsmBellmanFord(pass + 1, order, start, succ, costv, active, pot, parent, color, num, den)
    }
}

def hsmCertify(eng: HsmEng, pr: HsmPrint, md: HsmMode, rp: HsmReplay): (Int32, Int32) \ IO = region rc {
    let n = md#maximum + 1;
    let lat = eng#lat;
    let opts = Vector.init(v -> hsmOptions(pr, md#letter, v), n);
    let goals = List.map(cell -> hsmFacelet(lat, Vector.get(cell, hsmFront()), hsmZ()), List#{0, 1, 2, 3});
    let goalPose = (s, cell) -> {
        let c = hsmAt(eng#cornerOf, s);
        match List.find(k -> hsmTripleGet(hsmAt(eng#trip, c * 24 + k), hsmAt(eng#localOf, s)) == List.get(cell, goals), List.range(0, 24)) {
            case Some(k) => k
            case None => -1
        }
    };
    let frontPositions = List.map(p -> hsmPosIndex(p), List.map(c -> Vector.get(c, hsmFront()), List#{0, 1, 2, 3}));
    let freePos = List.filter(p -> not List.memberOf(p, frontPositions), List.range(0, 8));
    let perms = hsmPerms4(freePos);
    let index: MutHashMap[Int64, Int32, _] = MutHashMap.empty(rc);
    let nodePoses = MutList.empty(rc);
    let layers = MutList.empty(rc);
    let t = Array.repeat(rc, 8, -1);
    foreach (v <- List.range(0, n)) {
        foreach (o <- Vector.get(v, opts)) {
            foreach (c <- List.range(0, 8)) { Array.put(-1, c, t) };
            let stickers = match o { case (a, b, c, d) => List#{a, b, c, d} };
            foreach (cs <- List.zipWithIndex(stickers)) {
                Array.put(goalPose(snd(cs), fst(cs)), hsmAt(eng#cornerOf, snd(cs)), t)
            };
            let rest = List.filter(c -> Array.get(c, t) < 0, List.range(0, 8));
            require(List.length(rest) == 4, "four hidden corners");
            foreach (perm <- perms) {
                foreach (x <- List.range(0, 81)) {
                    foreach (q <- List.range(0, 4)) {
                        let digit = Int32.modulo(x / (hsmPow3(q)), 3);
                        Array.put(hsmAt(eng#atp, (List.get(q, rest) * 8 + List.get(q, perm)) * 3 + digit), List.get(q, rest), t)
                    };
                    let twist = List.sum(List.map(c -> hsmAt(eng#tw, c * 24 + Array.get(c, t)), List.range(0, 8)));
                    if (Int32.modulo(twist, 3) == 0) {
                        let code = hsmCodeArr(t);
                        if (MutHashMap.memberOf(code, index)) () else {
                            MutHashMap.put(code, MutList.size(layers), index);
                            foreach (c <- List.range(0, 8)) { MutList.push(Array.get(c, t), nodePoses) };
                            MutList.push(v, layers)
                        }
                    } else ()
                }
            }
        }
    };
    let total = MutList.size(layers);
    // Shortest words, memoised by (remaining length, set of live four-sticker keys).
    let memo: MutHashMap[List[Int32], List[List[Int32]], _] = MutHashMap.empty(rc);
    let costv = Array.repeat(rc, total, 0);
    let startL = MutList.empty(rc);
    let succL = MutList.empty(rc);
    let cur = Array.repeat(rc, 8, 0);
    let tmp = Array.repeat(rc, 8, 0);
    foreach (i <- List.range(0, total)) {
        foreach (c <- List.range(0, 8)) { Array.put(MutList.get(i * 8 + c, nodePoses), c, cur) };
        let v = MutList.get(i, layers);
        let nv = Int32.modulo(v + md#direction, n);
        let fac = Vector.init(s -> {
            let c = hsmAt(eng#cornerOf, s);
            hsmTripleGet(hsmAt(eng#trip, c * 24 + Array.get(c, cur)), hsmAt(eng#localOf, s))
        }, 24);
        let (d, keys) = hsmCost(eng, fac, Vector.get(nv, opts));
        Array.put(d, i, costv);
        let ends = List.foldLeft((acc, w) -> {
            foreach (c <- List.range(0, 8)) { Array.put(Array.get(c, cur), c, tmp) };
            foreach (m <- w) {
                foreach (c <- List.range(0, 8)) { Array.put(hsmAt(eng#ptr, (c * 18 + m) * 24 + Array.get(c, tmp)), c, tmp) }
            };
            Set.insert(hsmCodeArr(tmp), acc)
        }, Set#{}, hsmWords(eng, memo, d, keys));
        MutList.push(MutList.size(succL), startL);
        foreach (code <- Set.toList(ends)) {
            match MutHashMap.get(code, index) {
                case Some(j) => MutList.push(j, succL)
                case None => throw new IllegalArgumentException("every shortest-edge endpoint is an enumerated display node")
            }
        }
    };
    MutList.push(MutList.size(succL), startL);
    let start = MutList.toVector(startL);
    let succ = MutList.toVector(succL);
    require(total == md#nodes and Vector.length(succ) == md#edges, "independent graph size equals the published size");
    // The saved period must be a cycle of this graph.
    let posesV = List.toVector(rp#poses);
    let costsV = List.toVector(rp#costs);
    foreach (k <- List.range(0, Vector.length(posesV))) {
        let a = MutHashMap.get(hsmCodeVec(Vector.get(k, posesV)), index);
        let b = MutHashMap.get(hsmCodeVec(Vector.get(Int32.modulo(k + 1, Vector.length(posesV)), posesV)), index);
        match (a, b) {
            case (Some(i), Some(j)) => {
                require(List.exists(e -> hsmAt(succ, e) == j, List.range(hsmAt(start, i), hsmAt(start, i + 1))), "saved edge is a graph edge");
                require(Array.get(i, costv) == Vector.get(k, costsV), "saved edge cost equals the graph cost")
            }
            case _ => throw new IllegalArgumentException("saved poses are enumerated display nodes")
        }
    };
    // Dual certificate: Bellman-Ford potentials for weights den*cost - num on nodes of cost <= cap.
    let costF = Array.toVector(costv);
    let active = Vector.init(i -> if (Vector.get(i, costF) <= md#cap) 1 else 0, total);
    let layerV = MutList.toVector(layers);
    let order = List.toVector(List.sortBy(i -> if (md#direction == 1) -Vector.get(i, layerV) else Vector.get(i, layerV), List.range(0, total)));
    let pot = Array.repeat(rc, total, 0i64);
    let parent = Array.repeat(rc, total, -1);
    let color = Array.repeat(rc, total, 0);
    hsmBellmanFord(1, order, start, succ, costF, active, pot, parent, color, md#numer, md#denom);
    foreach (i <- List.range(0, total)) {
        if (hsmAt(active, i) == 1) {
            foreach (e <- List.range(hsmAt(start, i), hsmAt(start, i + 1))) {
                let j = hsmAt(succ, e);
                if (hsmAt(active, j) == 1)
                    require(md#denom * Int32.toInt64(Vector.get(i, costF)) - md#numer + Array.get(j, pot) - Array.get(i, pot) >= 0i64, "exact dual feasibility of every edge")
                else ()
            }
        } else ()
    };
    (total, Vector.length(succ))
}
def hsmPow3(q: Int32): Int32 = if (q == 0) 1 else if (q == 1) 3 else if (q == 2) 9 else 27

// ---------------------------------------------------------------- top level
def hsmTriples(ms: List[HsmMode]): List[(String, Int32, Int32)] = List.map(m -> (m#letter, m#maximum, m#direction), ms)
def hsmRequiredModes(): List[(String, Int32, Int32)] =
    List#{("S", 59, 1), ("S", 59, -1), ("M", 59, 1), ("M", 59, -1), ("H", 23, 1), ("H", 23, -1), ("H", 11, 1), ("H", 11, -1)}

def hsmCheck(j: J, inputSha: String): J \ IO = {
    require(match optional(j, "schema") { case Some(J.Str(s)) => s == "cubistry.hsm-seconds-first" case _ => false }, "UNSUPPORTED: unsupported HSM witness schema");
    hsmExactKeys(j, List#{"schema", "version", "label", "printCode", "universalArbitrarySourceHTM", "printing", "modes"}, "witness");
    require(match field(j, "version") { case J.Int(s) => s == "1" case _ => false }, "UNSUPPORTED: unsupported witness version");
    require(String.length(text(field(j, "label"))) >= 0, "label must be a string");
    require(hsmInt(field(j, "universalArbitrarySourceHTM"), 0, 100) == 6, "the profile publishes the six-HTM universal bound");
    let pr = hsmParsePrint(field(j, "printing"));
    require(text(field(j, "printCode")) == hsmPrintCode(pr), "printCode equals the printed stickers");
    let eng = hsmBuildEngine(pr);
    let diameter = Vector.foldLeft((a, d) -> if (d < 255 and d > a) d else a, 0, eng#dist);
    require(diameter == 7, "single-target four-corner graph diameter seven");
    match hsmUniversal(eng, pr, 6) {
        case Some((l, v)) => throw new IllegalArgumentException("universal six-HTM bound fails for display " + l + Int32.toString(v))
        case None => ()
    };
    let src = hsmSource(pr);
    let fromPrint = List.map(lv -> hsmShortest(eng, pr, src, fst(lv), snd(lv)),
                             List.flatMap(l -> List.map(v -> (l, v), List.range(0, 60)), List#{"H", "S", "M"}));
    let maxFromPrint = List.foldLeft(Int32.max, 0, fromPrint);
    require(maxFromPrint <= 6, "all 180 exact displays reachable from the print");
    let rawModes = array(field(j, "modes"));
    require(not List.isEmpty(rawModes) and List.length(rawModes) <= 18, "bounded nonempty mode list");
    let modes = List.map(hsmParseMode, rawModes);
    let triples = hsmTriples(modes);
    require(List.length(List.distinct(triples)) == List.length(triples), "distinct modes");
    require(List.forAll(t -> List.memberOf(t, triples), hsmRequiredModes()), "the eight seconds-first modes are present");
    let replays = List.map(m -> hsmReplay(eng, pr, m, src), modes);
    let shown = List.foldLeft((acc, mr) -> {
        let (m, r) = mr;
        List.foldLeft((a, v) -> Set.insert((m#letter, v), a), acc, Set.toList(r#seen))
    }, Set#{}, List.zip(modes, replays));
    require(List.forAll(v -> Set.memberOf(("S", v), shown) and Set.memberOf(("M", v), shown), List.range(0, 60))
            and List.forAll(v -> Set.memberOf(("H", v), shown), List.range(0, 24)), "all S, M and H 00-23 displays physically witnessed");
    let order = List.sortBy(i -> (List.get(i, modes))#maximum, List.range(0, List.length(modes)));
    let certs = List.map(i -> (i, hsmCertify(eng, pr, List.get(i, modes), List.get(i, replays))), order);
    let rows = List.map(i -> {
        let m = List.get(i, modes);
        let r = List.get(i, replays);
        let (gn, ge) = match List.find(c -> fst(c) == i, certs) { case Some(c) => snd(c) case None => (-1, -1) };
        let laps = List.length(r#costs) / (m#maximum + 1);
        object(List#{("letter", J.Str(m#letter)), ("maximum", intJ(m#maximum)), ("direction", intJ(m#direction)), ("htmCap", intJ(m#cap)),
                     ("periodEdges", intJ(List.length(r#costs))), ("laps", intJ(laps)), ("periodHTM", intJ(m#periodHtm)),
                     ("maximumHTM", intJ(m#maxHtm)), ("meanHTM", J.Str(hsmFracString(m#numer, m#denom))),
                     ("perLapHTM", J.Str(hsmFracString(Int32.toInt64(m#periodHtm), Int32.toInt64(laps)))),
                     ("setupHTM", intJ(List.length(m#setup))), ("graphNodes", intJ(gn)), ("graphEdges", intJ(ge)),
                     ("minimumMeanCertified", J.Bool(true)),
                     ("inverseTraversal", object(List#{("periodHTM", intJ(r#invHtm)), ("maximumHTM", intJ(r#invMax)), ("edgesNotShortest", intJ(r#invNot))}))})
    }, List.range(0, List.length(modes)));
    let countOf = l -> Set.size(Set.filter(x -> fst(x) == l, shown));
    object(List#{("valid", J.Bool(true)), ("status", J.Str("VALID")), ("profile", J.Str("cubistry.hsm-seconds-first")),
                 ("profileVersion", intJ(1)), ("inputSHA256", J.Str(inputSha)), ("printCode", J.Str(text(field(j, "printCode")))),
                 ("fourStickerPlacements", intJ(Vector.count(d -> d < 255, eng#dist))), ("fourStickerDiameter", intJ(diameter)),
                 ("universalBound", object(List#{("claimedHTM", intJ(6)), ("holds", J.Bool(true)), ("displays", intJ(180)), ("maxFromPrintHTM", intJ(maxFromPrint))})),
                 ("modes", J.Arr(rows)),
                 ("displaysWitnessed", object(List#{("S", intJ(countOf("S"))), ("M", intJ(countOf("M"))), ("H", intJ(countOf("H")))})),
                 ("claims", object(List#{("globalPrintOptimality", J.Str("UNKNOWN")), ("conditionalLowerBound168", J.Str("NOT_CHECKED")),
                                         ("wrapMinimaPerCycle", J.Str("NOT_CERTIFIED")), ("appPolicy13Figures", J.Str("NOT_CHECKED")),
                                         ("certificatePasses", J.Str("INFORMATIONAL"))}))})
}

def hsmCommand(path: String): Unit \ IO = {
    let raw = readJson(path);
    println(json(hsmCheck(raw, shaFile(path))))
}
