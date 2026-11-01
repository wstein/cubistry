// Independent native Flix checker for the 2x2x2 r2c1 (0-9) counter.
// Vector model: each sticker carries (position, outward normal, up) and is rotated by
// face turns; the tracked four-front-corner graph is rebuilt here by BFS.
// Usage: java -jar flix.jar PRINT.tsv MODE ROUTES.tsv SETUP.tsv   (MODE = closed | wrap1)
import java.lang.{Exception,System,IllegalArgumentException}
import java.io.File
import java.nio.file.Files
import java.nio.charset.StandardCharsets

type alias Vec = (Int32,Int32,Int32)
type alias Sticker = (Vec,Vec,String,Vec)
type alias Pose = (Vec,Vec,Vec)

def read(path: String): String \ IO = Files.readString(new File(path).toPath(),StandardCharsets.UTF_8)
def require(ok: Bool,msg: String): Unit \ IO = if (ok) () else throw new IllegalArgumentException(msg)
def at(xs: List[a],i: Int32): a \ IO = match xs {
    case x :: rest => if (i == 0) x else at(rest,i - 1)
    case Nil => throw new IllegalArgumentException("list index")
}
def lines(raw: String): List[String] = match List.reverse(String.splitOn(substr = "\n",raw)) {
    case "" :: rest => List.reverse(rest)
    case all => List.reverse(all)
}
def fields(s: String): List[String] = String.splitOn(substr = "\t",s)
def int(s: String): Int32 \ IO = {
    let ok = String.length(s) > 0 and List.forAll(c -> List.memberOf(c,String.toList("0123456789-")),String.toList(s));
    require(ok,"bad integer: " + s);
    match Int32.fromString(s) {
        case Some(n) => { require("${n}" == s,"bad integer: " + s); n }
        case None => throw new IllegalArgumentException("bad integer: " + s)
    }
}
def vecStr(v: Vec): String = match v { case (x,y,z) => "${x},${y},${z}" }
def vec3(s: String): Vec \ IO = match String.splitOn(substr = ",",s) {
    case a :: b :: c :: Nil => {
        let v = (int(a),int(b),int(c));
        match v { case (x,y,z) => require(x >= -1 and x <= 1 and y >= -1 and y <= 1 and z >= -1 and z <= 1,"vector component out of range: " + s) };
        v
    }
    case _ => throw new IllegalArgumentException("vector needs 3 fields: " + s)
}
def dot(a: Vec,b: Vec): Int32 = match (a,b) { case ((x,y,z),(p,q,r)) => x * p + y * q + z * r }
def cross(a: Vec,b: Vec): Vec = match (a,b) { case ((a1,a2,a3),(b1,b2,b3)) => (a2 * b3 - a3 * b2,a3 * b1 - a1 * b3,a1 * b2 - a2 * b1) }
def isUnit(v: Vec): Bool = match v { case (x,y,z) => (if (x != 0) 1 else 0) + (if (y != 0) 1 else 0) + (if (z != 0) 1 else 0) == 1 }
def isCorner(v: Vec): Bool = match v { case (x,y,z) => Int32.abs(x) == 1 and Int32.abs(y) == 1 and Int32.abs(z) == 1 }
def cw(v: Vec,a: Vec): Vec = {
    let d = dot(v,a);
    match (cross(a,v),a) { case ((c1,c2,c3),(a1,a2,a3)) => (d * a1 - c1,d * a2 - c2,d * a3 - c3) }
}
def cwN(v: Vec,a: Vec,q: Int32): Vec = if (q <= 0) v else cwN(cw(v,a),a,q - 1)

def parseRow(acc: (List[Sticker],List[(Vec,Vec)],Int32),r: String): (List[Sticker],List[(Vec,Vec)],Int32) \ IO = match acc {
    case (sts,seen,i) => match fields(r) {
        case f0 :: f1 :: f2 :: f3 :: f4 :: Nil => {
            require(f0 == "${i}","sticker ids must be 0..23 in order");
            let p = vec3(f1);
            let n = vec3(f2);
            require(isCorner(p),"position must be a corner");
            require(isUnit(n),"normal must be a unit axis");
            require(dot(p,n) == 1,"normal must point outward from its corner");
            require(not List.memberOf((p,n),seen),"facelet printed twice");
            require(f3 == "blank" or List.memberOf(f3,List.map(d -> "${d}",List.range(0,10))),"artwork must be blank or 0-9");
            if (f3 == "blank") {
                require(f4 == "-","blank stickers carry no up vector");
                (List.append(sts,(p,n,f3,(0,0,0)) :: Nil),(p,n) :: seen,i + 1)
            } else {
                let u = vec3(f4);
                require(isUnit(u) and dot(u,n) == 0,"up must be a unit axis tangent to the sticker");
                (List.append(sts,(p,n,f3,u) :: Nil),(p,n) :: seen,i + 1)
            }
        }
        case _ => throw new IllegalArgumentException("print row fields")
    }
}
def readPrint(path: String): List[Sticker] \ IO = match lines(read(path)) {
    case h :: rows => {
        require(h == "sticker\tposition\tnormal\tartwork\tup","print header");
        match List.foldLeft(parseRow,(Nil,Nil,0),rows) {
            case (sts,_,_) => { require(List.length(sts) == 24,"print needs 24 stickers"); sts }
        }
    }
    case Nil => throw new IllegalArgumentException("print header")
}

def faceAxis(c: Char): Option[Vec] = match c {
    case 'R' => Some((1,0,0))
    case 'L' => Some((-1,0,0))
    case 'U' => Some((0,1,0))
    case 'D' => Some((0,-1,0))
    case 'F' => Some((0,0,1))
    case 'B' => Some((0,0,-1))
    case _ => None
}
def parseMove(m: String): (Vec,Int32) \ IO = match String.toList(m) {
    case c :: Nil => match faceAxis(c) {
        case Some(a) => (a,1)
        case None => throw new IllegalArgumentException("bad move " + m)
    }
    case c :: s :: Nil => match faceAxis(c) {
        case Some(a) => if (s == '2') (a,2) else if (s == '\'') (a,3) else throw new IllegalArgumentException("bad move suffix " + m)
        case None => throw new IllegalArgumentException("bad move " + m)
    }
    case _ => throw new IllegalArgumentException("bad move " + m)
}
def parseWord(w: String): List[(Vec,Int32)] \ IO = if (w == "") Nil else List.map(parseMove,String.splitOn(substr = " ",w))
def touchesR2C1(mv: (Vec,Int32)): Bool = match mv { case (a,_) => dot((-1,-1,1),a) > 0 }
def invMove(m: String): String = match String.toList(m) {
    case c :: Nil => "${c}'"
    case c :: '\'' :: Nil => "${c}"
    case _ => m
}
def invWord(w: String): String = String.intercalate(" ",List.reverse(List.map(invMove,String.splitOn(substr = " ",w))))
def turn(state: List[Pose],mv: (Vec,Int32)): List[Pose] = match mv {
    case (a,q) => List.map(pose -> match pose {
        case (p,n,u) => if (dot(p,a) > 0) (cwN(p,a,q),cwN(n,a,q),cwN(u,a,q)) else (p,n,u)
    },state)
}
def play(state: List[Pose],word: List[(Vec,Int32)]): List[Pose] = List.foldLeft(turn,state,word)

def cells(): List[Vec] = (-1,1,1) :: (1,1,1) :: (-1,-1,1) :: (1,-1,1) :: Nil
def cellName(k: Int32): String = if (k == 0) "UL" else if (k == 1) "UR" else if (k == 2) "LL" else "LR"
def required(v: Int32): List[String] = "blank" :: "blank" :: "${v}" :: "blank" :: Nil
def artOf(print: List[Sticker],s: Int32): String \ IO = match at(print,s) { case (_,_,a,_) => a }

def checkDisplay(print: List[Sticker],state: List[Pose],v: Int32,ctx: String): Unit \ IO = {
    let need = required(v);
    List.forEach(k -> {
        let c = at(cells(),k);
        let idx = List.filter(s -> match at(state,s) { case (p,n,_) => p == c and n == (0,0,1) },List.range(0,24));
        require(List.length(idx) == 1,"cell occupancy");
        let s = at(idx,0);
        let got = artOf(print,s);
        let nk = at(need,k);
        require(got == nk,ctx + ": " + cellName(k) + " shows " + got + " (sticker ${s}), display ${v} needs " + nk);
        match at(state,s) {
            case (_,_,u) => if (nk == "blank") () else require(u == (0,1,0),ctx + ": " + cellName(k) + " sticker ${s} glyph " + got + " not upright (up " + vecStr(u) + ")")
        }
    },List.range(0,4))
}

def checkR2C1Untouched(print: List[Sticker],state: List[Pose],v: Int32,ctx: String): Unit \ IO = {
    let idx = List.filter(s -> match at(state,s) { case (p,n,_) => p == (-1,-1,1) and n == (0,0,1) },List.range(0,24));
    require(List.length(idx) == 1,"cell occupancy");
    let s = at(idx,0);
    let got = artOf(print,s);
    match at(state,s) {
        case (_,_,u) => require(got == "${v}" and u == (0,1,0),ctx + ": preparing move disturbed r2c1 digit ${v}")
    }
}

def checkPrepFrames(print: List[Sticker],state: List[Pose],preps: List[(Vec,Int32)],v: Int32,rowIdx: Int32,stepIdx: Int32): Unit \ IO = match preps {
    case Nil => ()
    case mv :: rest => {
        let nxt = turn(state,mv);
        checkR2C1Untouched(print,nxt,v,"row ${rowIdx} prep ${stepIdx}");
        checkPrepFrames(print,nxt,rest,v,rowIdx,stepIdx + 1)
    }
}

def units(): List[Vec] = (1,0,0) :: (-1,0,0) :: (0,1,0) :: (0,-1,0) :: (0,0,1) :: (0,0,-1) :: Nil
def rots(): List[(Vec,Vec,Vec)] = List.flatMap(ex -> List.flatMap(ey -> if (dot(ex,ey) == 0) (ex,ey,cross(ex,ey)) :: Nil else Nil,units()),units())
def applyR(r: (Vec,Vec,Vec),v: Vec): Vec = match (r,v) {
    case (((a1,a2,a3),(b1,b2,b3),(c1,c2,c3)),(x,y,z)) => (a1 * x + b1 * y + c1 * z,a2 * x + b2 * y + c2 * z,a3 * x + b3 * y + c3 * z)
}
def acceptable(art: String,pose: Pose,c: Vec,need: String): Bool \ IO =
    if (art != need) false else if (need == "blank") true else match pose {
        case (p,n,u) => {
            let rs = List.filter(r -> applyR(r,p) == c and applyR(r,n) == (0,0,1),rots());
            require(List.length(rs) == 1,"rotation uniqueness");
            applyR(at(rs,0),u) == (0,1,0)
        }
    }
def fidx(p: Vec,n: Vec): Int32 = match (p,n) {
    case ((x,y,z),(a,b,_)) => {
        let pos = (if (x > 0) 1 else 0) + (if (y > 0) 2 else 0) + (if (z > 0) 4 else 0);
        pos * 3 + (if (a != 0) 0 else if (b != 0) 1 else 2)
    }
}
def tkey(t: List[(Vec,Vec)]): Int32 = List.foldLeft((acc,pn) -> match pn { case (p,n) => acc * 24 + fidx(p,n) },0,t)
def allMoves(): List[(Vec,Int32)] = List.flatMap(a -> List.map(q -> (a,q),List.range(1,4)),units())
def turnPN(pn: (Vec,Vec),mv: (Vec,Int32)): (Vec,Vec) = match (pn,mv) {
    case ((p,n),(a,q)) => if (dot(p,a) > 0) (cwN(p,a,q),cwN(n,a,q)) else (p,n)
}
def expand(acc: (Map[Int32,Int32],List[List[(Vec,Vec)]]),t: List[(Vec,Vec)],d: Int32): (Map[Int32,Int32],List[List[(Vec,Vec)]]) =
    List.foldLeft((acc2,mv) -> match acc2 {
        case (dm,nx) => {
            let s = List.map(pn -> turnPN(pn,mv),t);
            let k = tkey(s);
            if (Map.memberOf(k,dm)) (dm,nx) else (Map.insert(k,d + 1,dm),s :: nx)
        }
    },acc,allMoves())
def bfs(frontier: List[List[(Vec,Vec)]],dist: Map[Int32,Int32],d: Int32): Map[Int32,Int32] =
    if (List.isEmpty(frontier)) dist else match List.foldLeft((acc,t) -> expand(acc,t,d),(dist,Nil),frontier) {
        case (dm,nx) => bfs(nx,dm,d + 1)
    }
def trackedBfs(): Map[Int32,Int32] = {
    let start = List.map(c -> (c,(0,0,1)),cells());
    bfs(start :: Nil,Map.insert(tkey(start),0,Map.empty()),0)
}
def shortest(dist: Map[Int32,Int32],print: List[Sticker],state: List[Pose],v: Int32): Int32 \ IO = {
    let need = required(v);
    let cands = List.map(k -> List.flatMap(s -> {
        let pose = at(state,s);
        if (acceptable(artOf(print,s),pose,at(cells(),k),at(need,k))) match pose { case (p,n,_) => fidx(p,n) :: Nil } else Nil
    },List.range(0,24)),List.range(0,4));
    let keys = List.flatMap(a -> List.flatMap(b -> List.flatMap(c -> List.map(d -> ((a * 24 + b) * 24 + c) * 24 + d,at(cands,3)),at(cands,2)),at(cands,1)),at(cands,0));
    List.foldLeft((best,k) -> match Map.get(k,dist) {
        case Some(x) => if (x < best) x else best
        case None => best
    },Int32.maxValue(),keys)
}

def checkEdge(print: List[Sticker],dist: Map[Int32,Int32],mode: String,acc: (List[Pose],List[List[Pose]],List[(Int32,Int32,Int32,Int32)]),row: (Int32,String)): (List[Pose],List[List[Pose]],List[(Int32,Int32,Int32,Int32)]) \ IO = match (acc,row) {
    case ((state,seen,stats),(i,r)) => {
        let f = fields(r);
        require(List.length(f) == 14 and at(f,0) == mode and at(f,1) == "${i}","route row ${i}");
        let v = i;
        let w = Int32.modulo(i + 1,10);
        require(at(f,2) == "${v}" and at(f,3) == "${w}","route row ${i} labels");
        let inc = parseWord(at(f,4));
        let dec = parseWord(at(f,9));
        require(int(at(f,5)) == List.length(inc) and int(at(f,10)) == List.length(dec),"row ${i}: claimed HTM differs from word length");
        require(at(f,9) == invWord(at(f,4)),"row ${i}: decrement is not the exact inverse word");

        let incT = List.count(touchesR2C1,inc);
        let incP = List.length(inc) - incT;
        let decT = List.count(touchesR2C1,dec);
        let decP = List.length(dec) - decT;
        require(incT == 1,"row ${i}: increment must use exactly 1 move touching r2c1 (got ${incT})");
        require(incP >= 0 and incP <= 2,"row ${i}: increment allows at most 2 preparing moves (got ${incP})");
        require(int(at(f,6)) == incP and int(at(f,7)) == incT,"row ${i}: claimed inc_prep/inc_touch mismatch");
        require(int(at(f,11)) == decP and int(at(f,12)) == decT,"row ${i}: claimed dec_prep/dec_touch mismatch");

        let lastMv = at(inc,List.length(inc) - 1);
        let preps = List.take(List.length(inc) - 1,inc);
        require(touchesR2C1(lastMv) and List.forAll(m -> not touchesR2C1(m),preps),"row ${i}: preparing moves must precede the r2c1 touching move");
        let incToks = String.splitOn(substr = " ",at(f,4));
        let lastTok = at(incToks,List.length(incToks) - 1);
        if (mode == "constL-closed" or mode == "constL-wrap1")
            require(lastTok == "L","row ${i}: constant-L mode requires final touching move L (got " + lastTok + ")")
        else if (mode == "9L1D-closed" or mode == "9L1D-wrap1") {
            let wantT = if (i < 9) "L" else "D";
            require(lastTok == wantT,"row ${i}: 9L1D mode requires final touching move " + wantT + " (got " + lastTok + ")")
        } else ();
        checkPrepFrames(print,state,preps,v,i,1);

        let si = shortest(dist,print,state,w);
        require(si != Int32.maxValue(),"row ${i}: target display ${w} is unreachable from the actual state");
        require(int(at(f,8)) == si,"row ${i}: claimed increment shortest " + at(f,8) + " but exact distance is ${si}");
        require(List.length(inc) >= si,"row ${i}: impossible");

        let next = play(state,inc);
        checkDisplay(print,next,w,"increment ${v}->${w}");

        let sd = shortest(dist,print,next,v);
        require(sd != Int32.maxValue(),"row ${i}: target display ${v} is unreachable from the actual state");
        require(int(at(f,13)) == sd,"row ${i}: claimed decrement shortest " + at(f,13) + " but exact distance is ${sd}");

        let back = play(next,dec);
        require(back == state,"row ${i}: decrement does not restore the exact previous state");
        checkDisplay(print,back,v,"decrement ${w}->${v}");

        let h = List.length(inc);
        println("edge\t" + mode + "\t${v}\t${w}\t" + at(f,4) + "\t${h}\t${incP}\t${incT}\t${si}\t${sd}");
        let seen2 = if (List.memberOf(state,seen)) seen else state :: seen;
        (next,seen2,List.append(stats,(h,incP,if (h == si) 1 else 0,if (List.length(dec) == sd) 1 else 0) :: Nil))
    }
}

def fmtMean10(tot: Int32): String = {
    let w = tot / 10;
    let r = Int32.modulo(tot,10);
    "${w}.${r}"
}

def runCheck(printPath: String,mode: String,routesPath: String,setupPath: String): Unit \ IO = {
    let print = readPrint(printPath);
    require(mode == "closed" or mode == "wrap1" or mode == "constL-closed" or mode == "constL-wrap1" or mode == "9L1D-closed" or mode == "9L1D-wrap1","mode");
    let home = List.map(s -> match s { case (p,n,_,u) => (p,n,u) },print);
    let dist = trackedBfs();
    require(Map.size(dist) == 136080,"tracked graph size ${Map.size(dist)}");
    let diam = Map.foldLeft((m,x) -> if (x > m) x else m,0,dist);
    println("graph\ttracked-front-corners\t${Map.size(dist)}\tdiameter\t${diam}");

    let srows = lines(read(setupPath));
    require(List.length(srows) == 2 and at(srows,0) == "mode\tsetup\thtm","setup header");
    let sf = fields(at(srows,1));
    require(List.length(sf) == 3 and at(sf,0) == mode,"setup mode");
    let sw = parseWord(at(sf,1));
    require(int(at(sf,2)) == List.length(sw),"setup htm");
    let state0 = play(home,sw);
    checkDisplay(print,state0,0,"setup");
    println("setup\t" + mode + "\t" + (if (at(sf,1) == "") "(none)" else at(sf,1)) + "\t${List.length(sw)}");

    let rows = lines(read(routesPath));
    require(at(rows,0) == "mode\tstep\tfrom\tto\tincrement\tinc_htm\tinc_prep\tinc_touch\tinc_shortest\tdecrement\tdec_htm\tdec_prep\tdec_touch\tdec_shortest","routes header");
    require(List.length(rows) == 11,"routes need 10 edges");
    let body = List.zip(List.range(0,10),List.drop(1,rows));
    match List.foldLeft((acc,row) -> checkEdge(print,dist,mode,acc,row),(state0,Nil,Nil),body) {
        case (lastState,seen,stats) => {
            require(List.length(seen) == 10,"period states are not pairwise distinct");
            if (mode == "closed" or mode == "constL-closed" or mode == "9L1D-closed") require(lastState == state0,"cycle does not return to the exact full start state") else ();
            let closureTag = if (lastState == state0) "exact-closed" else "display-wrapped";
            let lens = List.map(x -> match x { case (h,_,_,_) => h },stats);
            let totalHtm = List.foldLeft((a,b) -> a + b,0,lens);
            let totalPrep = List.foldLeft((a,x) -> match x { case (_,p,_,_) => a + p },0,stats);
            let worst = List.foldLeft((a,b) -> if (b > a) b else a,0,lens);
            let incShort = List.foldLeft((a,x) -> match x { case (_,_,is,_) => a + is },0,stats);
            let decShort = List.foldLeft((a,x) -> match x { case (_,_,_,ds) => a + ds },0,stats);
            let hist = List.filter(p -> match p { case (_,c) => c > 0 },List.map(k -> (k,List.count(x -> x == k,lens)),List.range(1,16)));
            let hb = String.intercalate(",",List.map(p -> match p { case (k,c) => "${k}:${c}" },hist));
            println("summary\t" + mode + "\tedges=10\tmax_htm=${worst}\ttotal_htm=${totalHtm}\ttotal_prep=${totalPrep}\tmean_htm=" + fmtMean10(totalHtm) + "\thist=" + hb + "\tinc_shortest=${incShort}/10\tdec_shortest=${decShort}/10\tclosure=" + closureTag)
        }
    }
}

def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case p :: m :: r :: s :: Nil => runCheck(p,m,r,s)
            case _ => throw new IllegalArgumentException("usage: PRINT MODE ROUTES SETUP")
        }
    } catch {
        case e: Exception => {
            println("invalid\t" + e.getMessage());
            System.exit(1)
        }
    }
})
