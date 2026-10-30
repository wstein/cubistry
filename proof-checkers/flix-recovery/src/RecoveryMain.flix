// Independent recovery proof. Native geometry/enumeration reused from merged Hsm.flix.
// No Julia recovery source, computed output, production mechanics or Python verifier used.
import java.lang.{Exception, IllegalArgumentException, System}
import java.nio.charset.MalformedInputException
import com.fasterxml.jackson.core.JsonProcessingException

// Canonical bounded words. Each live key tracks one physical glyph assignment.
// Distance lower bounds are exact for visible placements; slots encode uprightness.
// Same-face reductions and ordered commuting opposites preserve minimum endpoints.
def recProgress(message: String): Unit \ IO = {
    System.err.println(message); System.err.flush()
}

def recWords(eng: HsmEng, memo: MutHashMap[List[Int32], List[List[Int32]], r], rem: Int32,
             previous: Int32, keys: List[Int32]): List[List[Int32]] \ r =
    if (rem == 0) { if (List.exists(k -> hsmAt(eng#dist, k) == 0, keys)) List#{Nil} else Nil }
    else {
        let mk = rem :: previous :: keys;
        match MutHashMap.get(mk, memo) {
            case Some(ws) => ws
            case None => {
                let ws = List.flatMap(m -> {
                    let face = m / 3;
                    if (face == previous or (previous >= 0 and face / 2 == previous / 2 and face < previous)) Nil else {
                        let nk = List.sort(List.distinct(List.filter(k -> hsmAt(eng#dist, k) <= rem - 1,
                                  List.map(k -> hsmKeyMove(eng#lat, m, k), keys))));
                        if (List.isEmpty(nk)) Nil else List.map(w -> m :: w, recWords(eng, memo, rem - 1, face, nk))
                    }
                }, List.range(0, 18));
                MutHashMap.put(mk, ws, memo); ws
            }
        }
    }

type alias RecGraph = { poses = Vector[Int32], layers = Vector[Int32], starts = Vector[Int32],
                         ends = Vector[Int32], costs = Vector[Int32], shortest = Vector[Int32],
                         codes = Vector[Int64] }

def recGraph(eng: HsmEng, pr: HsmPrint, letter: String, maximum: Int32, direction: Int32): RecGraph \ IO = region rc {
    let n = maximum + 1;
    let lat = eng#lat;
    let opts = Vector.init(v -> hsmOptions(pr, letter, v), n);
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
    let memo: MutHashMap[List[Int32], List[List[Int32]], _] = MutHashMap.empty(rc);
    let startL = MutList.empty(rc);
    let succL = MutList.empty(rc);
    let costsL = MutList.empty(rc);
    let shortestL = MutList.empty(rc);
    let codesL = MutList.empty(rc);
    let cur = Array.repeat(rc, 8, 0);
    let tmp = Array.repeat(rc, 8, 0);
    recProgress("GRAPH " + letter + Int32.toString(maximum) + " direction=" + Int32.toString(direction) + " nodes=" + Int32.toString(total));
    foreach (i <- List.range(0, total)) {
        foreach (c <- List.range(0, 8)) { Array.put(MutList.get(i * 8 + c, nodePoses), c, cur) };
        MutList.push(hsmCodeArr(cur), codesL);
        let nv = Int32.modulo(MutList.get(i, layers) + direction, n);
        let keys = List.sort(List.distinct(List.map(o -> hsmPoseKey(eng, cur, o), Vector.get(nv, opts))));
        let d = List.foldLeft((a, k) -> Int32.min(a, hsmAt(eng#dist, k)), 255, keys);
        require(d >= 1 and d <= 6, "every next display has shortest distance one through six");
        MutList.push(d, shortestL);
        let bound = if (d <= 5) 5 else 6;
        let endpoints: MutHashMap[Int64, Int32, _] = MutHashMap.empty(rc);
        foreach (len <- List.range(d, bound + 1)) {
            let live = List.filter(k -> hsmAt(eng#dist, k) <= len, keys);
            foreach (word <- recWords(eng, memo, len, -1, live)) {
                foreach (c <- List.range(0, 8)) { Array.put(Array.get(c, cur), c, tmp) };
                foreach (m <- word) {
                    foreach (c <- List.range(0, 8)) {
                        Array.put(hsmAt(eng#ptr, (c * 18 + m) * 24 + Array.get(c, tmp)), c, tmp)
                    }
                };
                let code = hsmCodeArr(tmp);
                if (MutHashMap.memberOf(code, endpoints)) () else MutHashMap.put(code, len, endpoints)
            }
        };
        MutList.push(MutList.size(succL), startL);
        foreach (pair <- MutHashMap.toList(endpoints)) {
            let (code, cost) = pair;
            match MutHashMap.get(code, index) {
                case Some(j) => {
                    require(MutList.get(j, layers) == nv, "endpoint has exact next display");
                    MutList.push(j, succL); MutList.push(cost, costsL)
                }
                case None => throw new IllegalArgumentException("every bounded endpoint is an enumerated full pose")
            }
        };
        require(MutHashMap.size(endpoints) > 0, "nonempty outgoing edges");
        if (Int32.modulo(i + 1, 25000) == 0) recProgress("GRAPH progress=" + Int32.toString(i + 1) + " edges=" + Int32.toString(MutList.size(succL))) else ()
    };
    MutList.push(MutList.size(succL), startL);
    { poses = MutList.toVector(nodePoses), layers = MutList.toVector(layers), starts = MutList.toVector(startL),
      ends = MutList.toVector(succL), costs = MutList.toVector(costsL), shortest = MutList.toVector(shortestL), codes = MutList.toVector(codesL) }
}

// Native binary minimum heap, using exact packed integer triples. The radix
// bounds follow from an optimal positive-cost simple path having < nodeCount edges.
def recHeapUp(i: Int32, heap: MutList[(Int64, Int32), r]): Unit \ r =
    if (i == 0) () else {
        let p = (i - 1) / 2;
        if (fst(MutList.get(i, heap)) < fst(MutList.get(p, heap))) {
            let a = MutList.get(i, heap); let b = MutList.get(p, heap);
            MutList.put(b, i, heap); MutList.put(a, p, heap); recHeapUp(p, heap)
        } else ()
    }
def recHeapDown(i: Int32, heap: MutList[(Int64, Int32), r]): Unit \ r = {
    let left = i * 2 + 1;
    if (left >= MutList.size(heap)) () else {
        let right = left + 1;
        let child = if (right < MutList.size(heap) and fst(MutList.get(right, heap)) < fst(MutList.get(left, heap))) right else left;
        if (fst(MutList.get(child, heap)) < fst(MutList.get(i, heap))) {
            let a = MutList.get(i, heap); let b = MutList.get(child, heap);
            MutList.put(b, i, heap); MutList.put(a, child, heap); recHeapDown(child, heap)
        } else ()
    }
}
def recPush(item: (Int64, Int32), heap: MutList[(Int64, Int32), r]): Unit \ r = {
    MutList.push(item, heap); recHeapUp(MutList.size(heap) - 1, heap)
}
def recPop(heap: MutList[(Int64, Int32), r]): (Int64, Int32) \ r = {
    let out = MutList.get(0, heap);
    let last = MutList.pop(heap) |> Option.getWithDefault((0i64, -1));
    if (MutList.size(heap) > 0) { MutList.put(last, 0, heap); recHeapDown(0, heap) } else ();
    out
}
def recDijkstra(heap: MutList[(Int64, Int32), r], dist: Array[Int64, r], heads: Array[Int32, r],
                next: Array[Int32, r], sources: Array[Int32, r], weights: Vector[Int32], unit: Int64, above: Int64): Unit \ r =
    if (MutList.size(heap) == 0) () else {
        let (cost, node) = recPop(heap);
        if (cost == Array.get(node, dist)) recIncoming(Array.get(node, heads), cost, heap, dist, next, sources, weights, unit, above) else ();
        recDijkstra(heap, dist, heads, next, sources, weights, unit, above)
    }
def recIncoming(e: Int32, cost: Int64, heap: MutList[(Int64, Int32), r], dist: Array[Int64, r],
                next: Array[Int32, r], sources: Array[Int32, r], weights: Vector[Int32], unit: Int64, above: Int64): Unit \ r =
    if (e < 0) () else {
        let i = Array.get(e, sources);
        let htm = hsmAt(weights, e);
        let candidate = cost + unit + Int32.toInt64(htm) + (if (htm > 5) above else 0i64);
        if (candidate < Array.get(i, dist)) { Array.put(candidate, i, dist); recPush((candidate, i), heap) } else ();
        recIncoming(Array.get(e, next), cost, heap, dist, next, sources, weights, unit, above)
    }
def recDistances(graph: RecGraph, goalCodes: List[Int64]): Vector[Int64] \ IO = region rc {
    let n = Vector.length(graph#layers);
    let edgeCount = Vector.length(graph#ends);
    let heads = Array.repeat(rc, n, -1); let next = Array.repeat(rc, edgeCount, -1); let sources = Array.repeat(rc, edgeCount, -1);
    foreach (i <- List.range(0, n)) {
        foreach (e <- List.range(hsmAt(graph#starts, i), hsmAt(graph#starts, i + 1))) {
            let j = hsmAt(graph#ends, e);
            Array.put(i, e, sources); Array.put(Array.get(j, heads), e, next); Array.put(e, j, heads)
        }
    };
    let dist = Array.repeat(rc, n, 9223372036854775807i64);
    let heap = MutList.empty(rc);
    let goals = List.foldLeft((acc, code) -> Set.insert(code, acc), Set#{}, goalCodes);
    let count = Vector.count(c -> Set.memberOf(c, goals), graph#codes);
    require(count == List.length(goalCodes), "every distinct period goal is in the full graph");
    foreach (i <- List.range(0, n)) {
        if (Set.memberOf(Vector.get(i, graph#codes), goals)) { Array.put(0i64, i, dist); recPush((0i64, i), heap) } else ()
    };
    let unit = Int32.toInt64(n) * 6i64 + 1i64;
    let above = (Int32.toInt64(n) + 1i64) * unit;
    recDijkstra(heap, dist, heads, next, sources, graph#costs, unit, above);
    Array.toVector(dist)
}

// Decimal equality is decided from raw token digits, never floating point.
// Normal form is significant ASCII digits and a base-ten exponent.
def recDropZero(xs: List[Char]): List[Char] = match xs {
    case '0' :: rest => recDropZero(rest)
    case _ => xs
}
def recDecimal(token: String): (String, Int32) \ IO = {
    let negative = String.startsWith({prefix = "-"}, token);
    let body = if (negative) String.dropLeft(1, token) else token;
    let ep = String.splitOn({substr = "e"}, String.toLowerCase(body));
    require(List.length(ep) <= 2, "decimal exponent");
    let mantissa = List.get(0, ep);
    let mp = String.splitOn({substr = "."}, mantissa);
    let fractional = if (List.length(mp) == 2) String.length(List.get(1, mp)) else 0;
    let digits = recDropZero(String.toList(String.intercalate("", mp)));
    if (List.isEmpty(digits)) ("0", 0) else {
        require(not negative, "meanSteps nonnegative");
        let exp = if (List.length(ep) == 1) 0 else {
            let t = List.get(1, ep);
            let clean = if (String.startsWith({prefix = "+"}, t)) String.dropLeft(1, t) else t;
            match Int32.fromString(clean) {
                case Some(v) => { require(v >= -10000 and v <= 10000, "meanSteps finite bounded decimal"); v }
                case None => throw new IllegalArgumentException("meanSteps exponent out of range")
            }
        };
        let significant = List.reverse(recDropZero(List.reverse(digits)));
        (String.intercalate("", List.map(Char.toString, significant)), exp - fractional + List.length(digits) - List.length(significant))
    }
}
def recMeanToken(j: J, scaled: Int64): Unit \ IO = {
    let token = match j { case J.Int(s) => s case J.Float(s) => s case _ => throw new IllegalArgumentException("meanSteps requires JSON number") };
    require(recDecimal(token) == recDecimal(Int64.toString(scaled) + "e-4"), "meanSteps differs from exact nearest ties-to-even four-place mean")
}
def recRoundMean(sum: Int64, count: Int64): Int64 = {
    let numerator = sum * 10000i64;
    let q = numerator / count; let remainder = Int64.modulo(numerator, count);
    q + (if (remainder * 2i64 > count or (remainder * 2i64 == count and Int64.modulo(q, 2i64) == 1i64)) 1i64 else 0i64)
}
def recFour(scaled: Int64): String = {
    let tail = Int64.toString(Int64.modulo(scaled, 10000i64));
    Int64.toString(scaled / 10000i64) + "." + String.repeat(4 - String.length(tail), "0") + tail
}
def recHistogram(xs: Vector[Int32]): J = {
    let keys = List.sort(List.distinct(Vector.toList(xs)));
    object(List.map(k -> (Int32.toString(k), intJ(Vector.count(x -> x == k, xs))), keys))
}
def recCheckHistogram(raw: J, computed: J): Unit \ IO = {
    let pairs = match raw { case J.Obj(xs) => xs case _ => throw new IllegalArgumentException("histogram object") };
    foreach (pair <- pairs) {
        require(hsmDigits(fst(pair)), "canonical nonnegative ASCII histogram key");
        require(hsmInt(snd(pair), 1, 1000000000) >= 1, "positive histogram count")
    };
    let sorted = object(List.sortBy(pair -> Option.getWithDefault(-1, Int32.fromString(fst(pair))), pairs));
    require(sorted == computed, "recomputed histogram equals raw claim")
}

def recReplaySamples(eng: HsmEng, pr: HsmPrint, graph: RecGraph, distances: Vector[Int64], goals: List[Int64],
                     row: J, maximumSteps: Int32): J \ IO = region rc {
    let samples = array(field(row, "samples"));
    require(List.length(samples) >= 2 and List.length(samples) <= 100000, "at least two bounded sample rows");
    let index: MutHashMap[Int64, Int32, _] = MutHashMap.empty(rc);
    foreach (i <- List.range(0, Vector.length(graph#codes))) { MutHashMap.put(Vector.get(i, graph#codes), i, index) };
    let letter = text(field(row, "letter")); let maximum = integer(field(row, "maximum")); let direction = integer(field(row, "direction"));
    let goalSet = List.foldLeft((acc, code) -> Set.insert(code, acc), Set#{}, goals);
    let nodeOf = st -> {
        let code = hsmCodeVec(hsmPoseOf(eng, st));
        match MutHashMap.get(code, index) { case Some(i) => i case None => throw new IllegalArgumentException("sample full pose is enumerated") }
    };
    let n = Vector.length(graph#layers);
    let unit = Int32.toInt64(n) * 6i64 + 1i64;
    let above = (Int32.toInt64(n) + 1i64) * unit;
    let total = List.sum(List.map(pair -> {
        let (sample, ordinal) = pair;
        hsmExactKeys(sample, List#{"fromValue", "setupFromSolved", "steps", "words"}, "recovery sample");
        let value = hsmInt(field(sample, "fromValue"), 0, maximum);
        let setup = hsmParseWord(text(field(sample, "setupFromSolved")));
        let start = hsmTurn(hsmSource(pr), setup);
        hsmShowDisplay(pr, start, letter, value);
        require(hsmTurn(start, hsmInvWord(setup)) == hsmSource(pr), "sample setup inverse restores full print");
        let stepCount = hsmInt(field(sample, "steps"), 0, n);
        let words = List.map(w -> hsmParseWord(text(w)), array(field(sample, "words")));
        require(List.length(words) == stepCount and (ordinal != 0 or stepCount == maximumSteps), "honest sample step count and first attains maximum");
        let (last, lastValue, cost, allMoves) = List.foldLeft((acc, word) -> {
            let (st, v, cost, allMoves) = acc;
            let source = nodeOf(st);
            require(not Set.memberOf(Vector.get(source, graph#codes), goalSet), "no intermediate sample pose is already a period goal");
            let targetValue = Int32.modulo(v + direction, maximum + 1);
            let len = List.length(word);
            require(len >= 1 and (len <= 5 or (hsmAt(graph#shortest, source) == 6 and len == 6)), "sample edge bounded or forced shortest six");
            let target = hsmTurn(st, word);
            hsmShowDisplay(pr, target, letter, targetValue);
            require(hsmTurn(target, hsmInvWord(word)) == st, "sample edge inverse restores every physical frame");
            let destination = nodeOf(target);
            require(List.exists(e -> hsmAt(graph#ends, e) == destination and hsmAt(graph#costs, e) <= len,
                    List.range(hsmAt(graph#starts, source), hsmAt(graph#starts, source + 1))), "sample endpoint appears in exhaustive graph");
            (target, targetValue, cost + unit + Int32.toInt64(len) + (if (len > 5) above else 0i64), List.append(allMoves, word))
        }, (start, value, 0i64, Nil), words);
        require(lastValue == Int32.modulo(value + stepCount * direction, maximum + 1), "sample modular sequence");
        require(Set.memberOf(Vector.get(nodeOf(last), graph#codes), goalSet), "sample final full pose is a selected period goal");
        require(Vector.get(nodeOf(start), distances) == cost, "sample exact triple equals independently computed lexicographic optimum");
        require(hsmTurn(last, hsmInvWord(allMoves)) == start, "complete sample inverse restores every physical frame");
        stepCount
    }, List.map(pair -> (snd(pair), fst(pair)), List.zipWithIndex(samples))));
    object(List#{("samples", intJ(List.length(samples))), ("steps", intJ(total)), ("edgeInverses", intJ(total)), ("fullInverses", intJ(List.length(samples)))})
}

def recRow(eng: HsmEng, pr: HsmPrint, row: J, md: HsmMode, rp: HsmReplay): J \ IO = {
    let letter = text(field(row, "letter")); let maximum = integer(field(row, "maximum")); let direction = integer(field(row, "direction"));
    let graph = recGraph(eng, pr, letter, maximum, direction);
    let goals = List.map(hsmCodeVec, rp#poses);
    require(List.length(List.distinct(goals)) == List.length(goals), "distinct application goals");
    let distances = recDistances(graph, goals);
    let n = Vector.length(graph#layers); let unit = Int32.toInt64(n) * 6i64 + 1i64; let above = (Int32.toInt64(n) + 1i64) * unit;
    let unreachable = Vector.count(d -> d == 9223372036854775807i64, distances);
    require(unreachable == 0, "every settled source can reach the period");
    let steps = Vector.map(d -> Int64.truncateToInt32(Int64.modulo(d, above) / unit), distances);
    let aboveSteps = Vector.map(d -> Int64.truncateToInt32(d / above), distances);
    let htms = Vector.map(d -> Int64.truncateToInt32(Int64.modulo(d, unit)), distances);
    let forced = Vector.count(d -> d > 5, graph#shortest);
    foreach (i <- List.range(0, n)) {
        require(hsmAt(aboveSteps, i) <= 1 and (hsmAt(aboveSteps, i) == 1) == (hsmAt(graph#shortest, i) > 5), "exactly forced sources need one above-limit edge")
    };
    let maxSteps = Vector.foldLeft(Int32.max, 0, steps);
    let maxHTM = Vector.foldLeft(Int32.max, 0, htms);
    let sum = Vector.foldLeft((acc, x) -> acc + Int32.toInt64(x), 0i64, steps);
    let rounded = recRoundMean(sum, Int32.toInt64(n));
    let countPairs = List#{("graphNodes", n), ("edgesAtMostLimitOrForced", Vector.length(graph#ends)), ("periodNodes", List.length(goals)),
                          ("unreachable", unreachable), ("poseWithoutEdgeAtMostLimit", forced), ("maximumSteps", maxSteps), ("maximumRecoveryHTM", maxHTM)};
    foreach (pair <- countPairs) {
        require(integer(field(row, fst(pair))) == snd(pair), "recomputed " + fst(pair) + " equals raw claim")
    };
    let sh = recHistogram(steps); let ah = recHistogram(aboveSteps);
    recCheckHistogram(field(row, "stepsHistogram"), sh); recCheckHistogram(field(row, "edgesAboveLimitHistogram"), ah);
    recMeanToken(field(row, "meanSteps"), rounded);
    let sample = recReplaySamples(eng, pr, graph, distances, goals, row, maxSteps);
    recProgress("DONE " + letter + Int32.toString(maximum) + " direction=" + Int32.toString(direction));
    object(List#{("letter", J.Str(letter)), ("maximum", intJ(maximum)), ("direction", intJ(direction)), ("sourceDirection", intJ(md#direction)),
                 ("traversal", J.Str(text(field(row, "traversal")))), ("graphNodes", intJ(n)), ("edgesAtMostLimitOrForced", intJ(Vector.length(graph#ends))),
                 ("periodNodes", intJ(List.length(goals))), ("unreachable", intJ(unreachable)), ("poseWithoutEdgeAtMostLimit", intJ(forced)),
                 ("stepsHistogram", sh), ("edgesAboveLimitHistogram", ah), ("maximumSteps", intJ(maxSteps)),
                 ("meanStepsExact", J.Str(hsmFracString(sum, Int32.toInt64(n)))) , ("meanStepsFourPlaces", J.Str(recFour(rounded))),
                 ("maximumRecoveryHTM", intJ(maxHTM)), ("sampleReplay", sample)})
}

def recCheck(recovery: J, witness: J, recoverySha: String, modesSha: String, selected: Int32): J \ IO = {
    require(match optional(recovery, "schema") { case Some(J.Str(s)) => s == "cubistry.hsm-seconds-first-recovery" case _ => false }, "UNSUPPORTED: recovery schema");
    require(match optional(recovery, "version") { case Some(J.Int(s)) => s == "1" case _ => false }, "UNSUPPORTED: recovery version");
    hsmExactKeys(recovery, List#{"schema", "version", "label", "printCode", "edgeLimitHTM", "objective", "modes"}, "recovery");
    let _ = text(field(recovery, "label"));
    require(integer(field(recovery, "edgeLimitHTM")) == 5, "recovery edge limit five");
    require(text(field(recovery, "objective")) == "lexicographic: edges above the limit, steps, HTM", "recovery exact objective");
    require(match optional(witness, "schema") { case Some(J.Str(s)) => s == "cubistry.hsm-seconds-first-modes" case _ => false }, "UNSUPPORTED: all-mode witness schema");
    require(match optional(witness, "version") { case Some(J.Int(s)) => s == "1" case _ => false }, "UNSUPPORTED: all-mode witness version");
    hsmExactKeys(witness, List#{"schema", "version", "label", "printCode", "universalArbitrarySourceHTM", "printing", "modes", "edgeLimitHTM", "appModes"}, "all-mode witness");
    let _ = text(field(witness, "label"));
    require(integer(field(witness, "universalArbitrarySourceHTM")) == 6 and integer(field(witness, "edgeLimitHTM")) == 5, "witness fixed bound fields");
    let pr = hsmParsePrint(field(witness, "printing"));
    require(text(field(recovery, "printCode")) == hsmPrintCode(pr) and text(field(witness, "printCode")) == hsmPrintCode(pr), "both raw inputs bind the immutable physical print");
    let modes = List.map(hsmParseMode, array(field(witness, "modes")));
    require(List.length(modes) == 18 and List.length(List.distinct(hsmTriples(modes))) == 18 and List.forAll(t -> List.memberOf(t, hsmTriples(modes)), hsmAllModes()), "exactly all 18 source modes");
    require(List.forAll(m -> (m#cap == 5 or m#cap == 6) and m#maxHtm <= 5, modes), "all-mode period caps");
    let rows = array(field(recovery, "modes"));
    require(List.length(rows) == 18, "exactly 18 recovery rows");
    foreach (pair <- List.zip(rows, hsmAllModes())) {
        let (row, identity) = pair;
        hsmExactKeys(row, List#{"letter", "maximum", "direction", "sourceDirection", "traversal", "graphNodes", "edgesAtMostLimitOrForced", "periodNodes", "unreachable", "poseWithoutEdgeAtMostLimit", "stepsHistogram", "edgesAboveLimitHistogram", "maximumSteps", "meanSteps", "maximumRecoveryHTM", "samples"}, "recovery row");
        require((text(field(row, "letter")), integer(field(row, "maximum")), integer(field(row, "direction"))) == identity, "ordered 18 recovery identities");
        foreach (name <- List#{"graphNodes", "edgesAtMostLimitOrForced", "periodNodes", "unreachable", "poseWithoutEdgeAtMostLimit", "maximumSteps", "maximumRecoveryHTM"}) {
            let _ = hsmInt(field(row, name), 0, 1000000000); ()
        };
        let _ = hsmInt(field(row, "sourceDirection"), -1, 1);
        let _ = text(field(row, "traversal"));
        let _ = array(field(row, "samples"));
        match field(row, "meanSteps") { case J.Int(_) => () case J.Float(_) => () case _ => require(false, "meanSteps JSON number") }
    };
    recProgress("RAW parsed; rebuilding native corner engine and replaying all periods");
    let eng = hsmBuildEngine(pr);
    let replays = List.map(m -> hsmReplay(eng, pr, m, hsmSource(pr)), modes);
    let apps = hsmCheckApps(field(witness, "appModes"), modes, replays, 5);
    foreach (row <- rows) {
        let key = (text(field(row, "letter")), integer(field(row, "maximum")), integer(field(row, "direction")));
        let app = match List.find(a -> (text(field(a, "letter")), integer(field(a, "maximum")), integer(field(a, "direction"))) == key, apps) {
            case Some(a) => a case None => throw new IllegalArgumentException("application mode missing")
        };
        require(field(row, "sourceDirection") == field(app, "sourceDirection") and field(row, "traversal") == field(app, "traversal"), "recovery selection and traversal match recomputed application rule")
    };
    let summaries = List.map(pair -> {
        let (_i, row) = pair;
        let si = hsmModeIndex(modes, (text(field(row, "letter")), integer(field(row, "maximum")), integer(field(row, "sourceDirection"))));
        recRow(eng, pr, row, List.get(si, modes), List.get(si, replays))
    }, List.filter(pair -> selected < 0 or fst(pair) == selected, List.zipWithIndex(rows)));
    let partial = selected >= 0;
    object(List#{("valid", J.Bool(not partial)), ("status", J.Str(if (partial) "UNKNOWN" else "VALID")), ("profile", J.Str("cubistry.hsm-seconds-first-recovery")),
                 ("profileVersion", intJ(1)), ("recoveryInputSHA256", J.Str(recoverySha)), ("modesInputSHA256", J.Str(modesSha)),
                 ("printSHA256", J.Str(hsmPrintDigest(pr))), ("edgeLimitHTM", intJ(5)), ("modes", J.Arr(summaries)),
                 ("claims", object(List#{("recoveryReturnOntoPeriod", J.Str(if (partial) "PARTIAL" else "VERIFIED")), ("globalPrintOptimality", J.Str("UNKNOWN")),
                     ("runtimeReachabilityOfForcedPoses", J.Str("NOT_CHECKED")), ("minimumMeanPeriodCertificates", J.Str("NOT_CHECKED"))}))})
}

def recFailure(status: String, reason: String, code: Int32): Unit \ IO = {
    println(json(object(List#{("valid", J.Bool(false)), ("status", J.Str(status)), ("reason", J.Str(reason))})));
    System.exit(code)
}
// Small native graphs exercise all three priority levels independently of raw claims.
def recSelfTests(): Unit \ IO = {
    let graph = { poses = Vector#{}, layers = Vector#{0, 0, 0, 0, 0, 0, 0, 0, 0},
                  starts = Vector#{0, 0, 2, 3, 5, 6, 8, 9, 10, 11},
                  ends = Vector#{0, 2, 0, 4, 0, 0, 6, 7, 0, 0, 0},
                  costs = Vector#{6, 5, 5, 1, 5, 1, 1, 2, 5, 1, 6}, shortest = Vector#{0, 5, 5, 1, 1, 1, 5, 1, 6},
                  codes = Vector#{0i64, 1i64, 2i64, 3i64, 4i64, 5i64, 6i64, 7i64, 8i64} };
    let d = recDistances(graph, List#{0i64});
    require(Vector.get(1, d) == 120i64, "native lex trap: prefer zero above-limit edges over fewer steps");
    require(Vector.get(3, d) == 60i64, "native lex trap: prefer fewer steps over fewer HTM");
    require(Vector.get(5, d) == 113i64, "native lex trap: minimize HTM when first two costs tie");
    require(Vector.get(8, d) == 611i64, "native lex trap: forced six edge retains first component");
    require(recRoundMean(1i64, 32i64) == 312i64 and recRoundMean(3i64, 32i64) == 938i64,
            "exact decimal tie-to-even on both parity sides");
    require(recRoundMean(1i64, 20000i64) == 0i64 and recRoundMean(3i64, 20000i64) == 2i64, "tiny exact decimal ties");
    recMeanToken(J.Float("3.120000000000000000000000000000e-2"), 312i64);
    recMeanToken(J.Float("-0e-999999999999999999999999999999999"), 0i64);
    require(recFour(312i64) == "0.0312" and recFour(10000i64) == "1.0000", "four-place rendering");
    let rejects = try { recMeanToken(J.Float("0.0312000000000000000000000000000000001"), 312i64); false }
                  catch { case _: IllegalArgumentException => true };
    require(rejects, "nonzero far-decimal tail cannot round into exact equality");
    println("{\"valid\":true,\"status\":\"VALID\",\"nativeSelfTests\":10}")
}

def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
        case "--self-test" :: Nil => recSelfTests()
        case _ => {
        let (r, w, selected) = match Sys.Env.getArgs() {
            case r :: w :: Nil => (r, w, -1)
            case "--mode" :: i :: r :: w :: Nil => {
                let k = Option.getWithDefault(-1, Int32.fromString(i)); require(k >= 0 and k < 18, "mode index 0..17"); (r, w, k)
            }
            case _ => throw new IllegalArgumentException("UNSUPPORTED: expected [--mode INDEX] RECOVERY.json MODES.json")
        };
        let recovery = readJson(r); let witness = readJson(w);
        println(json(recCheck(recovery, witness, shaFile(r), shaFile(w), selected)))
        }
        }
    } catch {
        case ex: JsonProcessingException => recFailure("INVALID_JSON", ex.toString(), 1)
        case ex: MalformedInputException => recFailure("INVALID_JSON", ex.toString(), 1)
        case ex: IllegalArgumentException => {
            let reason = ex.toString();
            if (reason.contains("UNSUPPORTED:")) recFailure("UNSUPPORTED", reason, 2)
            else if (reason.contains("ERROR:")) recFailure("ERROR", reason, 3)
            else recFailure(if (reason.contains("INVALID_JSON:")) "INVALID_JSON" else "INVALID", reason, 1)
        }
        case ex: Exception => recFailure("ERROR", ex.toString(), 3)
    }
})
