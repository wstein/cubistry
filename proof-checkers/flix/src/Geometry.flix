import java.lang.IllegalArgumentException

enum Vec with Eq, ToString { case V(Int32, Int32, Int32) }
enum Sticker with Eq, ToString { case S(Int32, Int32, Vec, Vec, Vec, String) }
enum Move with Eq, ToString { case M(Int32, Int32, Int32, Bool) }

def sid(s: Sticker): Int32 = match s { case Sticker.S(i,_,_,_,_,_) => i }
def body(s: Sticker): Int32 = match s { case Sticker.S(_,c,_,_,_,_) => c }
def pos(s: Sticker): Vec = match s { case Sticker.S(_,_,p,_,_,_) => p }
def normal(s: Sticker): Vec = match s { case Sticker.S(_,_,_,n,_,_) => n }
def up(s: Sticker): Vec = match s { case Sticker.S(_,_,_,_,u,_) => u }
def image(s: Sticker): String = match s { case Sticker.S(_,_,_,_,_,img) => img }
def coordinate(v: Vec, a: Int32): Int32 = match v { case Vec.V(x,y,z) => if (a == 0) x else if (a == 1) y else z }
def add(a: Vec,b: Vec): Vec = Vec.V(coordinate(a,0)+coordinate(b,0),coordinate(a,1)+coordinate(b,1),coordinate(a,2)+coordinate(b,2))
def scale(n: Int32,v: Vec): Vec = Vec.V(n*coordinate(v,0),n*coordinate(v,1),n*coordinate(v,2))
def dot(a: Vec,b: Vec): Int32 = coordinate(a,0)*coordinate(b,0)+coordinate(a,1)*coordinate(b,1)+coordinate(a,2)*coordinate(b,2)
def cross(a: Vec,b: Vec): Vec = Vec.V(coordinate(a,1)*coordinate(b,2)-coordinate(a,2)*coordinate(b,1),coordinate(a,2)*coordinate(b,0)-coordinate(a,0)*coordinate(b,2),coordinate(a,0)*coordinate(b,1)-coordinate(a,1)*coordinate(b,0))
def nonzero(v: Vec): Int32 = List.count(x -> x != 0,List#{coordinate(v,0),coordinate(v,1),coordinate(v,2)})
def axis(v: Vec): Bool = dot(v,v) == 1
def all(xs: List[Bool]): Bool = List.foldLeft((a,b) -> a and b,true,xs)
def sum(xs: List[Int32]): Int32 = List.foldLeft((a,b) -> a+b,0,xs)

def vec(j: J): Vec \ IO = {
    let xs = array(j);
    require(List.length(xs) == 3,"frame vector must have length 3");
    let ns = List.map(integer,xs);
    require(all(List.map(x -> x >= -1 and x <= 1,ns)),"coordinate outside {-1,0,1}");
    Vec.V(List.get(0,ns),List.get(1,ns),List.get(2,ns))
}

def parseSticker(j: J): Sticker \ IO = Sticker.S(integer(field(j,"id")),integer(field(j,"cubie")),vec(field(j,"p")),vec(field(j,"n")),vec(field(j,"up")),text(field(j,"image")))

def state(j: J, size: Int32): List[Sticker] \ IO = {
    let xs = List.sortBy(sid,List.map(parseSticker,array(j)));
    let count = if (size == 2) 24 else 54;
    let bodies = if (size == 2) 8 else 26;
    require(List.length(xs) == count,"wrong sticker count");
    require(List.map(sid,xs) == List.range(0,count),"missing or duplicate sticker identity");
    foreach (s <- xs) {
        require(body(s) >= 0 and body(s)<bodies,"body ID out of range");
        require(axis(normal(s)) and axis(up(s)) and dot(normal(s),up(s)) == 0,"invalid signed-axis tangent frame");
        require(dot(pos(s),normal(s)) == 1,"nonoutward facelet");
        require(if (size == 2) nonzero(pos(s)) == 3 else nonzero(pos(s)) >= 1,"invalid body position");
        require(List.count(t -> pos(t) == pos(s) and normal(t) == normal(s),xs) == 1,"duplicate facelet occupancy")
    };
    foreach (c <- List.range(0,bodies)) {
        let group = List.filter(s -> body(s) == c,xs);
        require(not List.isEmpty(group),"missing body identity");
        let p = pos(List.get(0,group));
        require(all(List.map(s -> pos(s) == p,group)),"split physical body");
        require(List.length(group) == nonzero(p),"wrong number of body faces");
        require(all(List.map(s -> pos(s) != p or body(s) == c,xs)),"two bodies share a position")
    };
    xs
}

def quarter(v: Vec,a: Int32): Vec = match v {
    case Vec.V(x,y,z) => if (a == 0) Vec.V(x,-z,y) else if (a == 1) Vec.V(z,y,-x) else Vec.V(-y,x,z)
}

def rotate(v: Vec,a: Int32,n: Int32): Vec = List.foldLeft((p,_) -> quarter(p,a),v,List.range(0,Int32.modulo(n,4)))

def move(token: String, whole: Bool): Move \ IO = {
    let n = String.length(token);
    require(n >= 1 and n <= 2,"illegal move token");
    let factor = if (n == 1) 1 else {
        let suffix = Char.toBmpCodePoint(String.charAt(1,token));
        require(suffix == 50 or suffix == 39,"illegal move suffix");
        if (suffix == 50) 2 else -1
    };
    match String.charAt(0,token) {
        case 'R' => Move.M(0,1,-factor,false)
        case 'L' => Move.M(0,-1,factor,false)
        case 'U' => Move.M(1,1,-factor,false)
        case 'D' => Move.M(1,-1,factor,false)
        case 'F' => Move.M(2,1,-factor,false)
        case 'B' => Move.M(2,-1,factor,false)
        case 'x' if whole => Move.M(0,0,-factor,true)
        case 'y' if whole => Move.M(1,0,-factor,true)
        case 'z' if whole => Move.M(2,0,-factor,true)
        case _ => throw new IllegalArgumentException("illegal move letter")
    }
}

def moves(word: String, whole: Bool): List[Move] \ IO = {
    require(Vector.length(String.toBytes(word)) <= 16384,"move word exceeds 16384 bytes");
    let clean = word.replaceAll("[\\u0009-\\u000d\\u001c-\\u0020\\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]"," ");
    let words = String.words(clean);
    require(List.length(words) <= 1024,"too many move tokens");
    List.map(t -> move(t,whole),words)
}

def turn(s: Sticker,m: Move): Sticker = match (s,m) {
    case (Sticker.S(i,c,p,n,u,img),Move.M(a,l,k,whole)) => if (whole or coordinate(p,a) == l) Sticker.S(i,c,rotate(p,a,k),rotate(n,a,k),rotate(u,a,k),img) else s
}

def apply(xs: List[Sticker], word: List[Move]): List[Sticker] = List.foldLeft((s,m) -> List.map(t -> turn(t,m),s),xs,word)
def inverse(ms: List[Move]): List[Move] = List.map(m -> match m { case Move.M(a,l,k,w) => Move.M(a,l,-k,w) },List.reverse(ms))
def rotations(ms: List[Move]): Int32 = List.count(m -> match m { case Move.M(_,_,_,w) => w },ms)

def vecWire(v: Vec): J = J.Arr(List.map(n -> J.Int(Int32.toString(n)),List#{coordinate(v,0),coordinate(v,1),coordinate(v,2)}))
def wire(xs: List[Sticker]): J = J.Arr(List.map(s -> J.Arr(List#{J.Int(Int32.toString(sid(s))),J.Int(Int32.toString(body(s))),vecWire(pos(s)),vecWire(normal(s)),vecWire(up(s)),J.Str(image(s))}),xs))

def mapFrame(v: Vec, sr: Vec,su: Vec,sn: Vec, ar: Vec,au: Vec,an: Vec): Vec =
    add(add(scale(dot(v,sr),ar),scale(dot(v,su),au)),scale(dot(v,sn),an))

def rigidBodies(source: List[Sticker], actual: List[Sticker]): Unit \ IO = {
    foreach (s <- source) {
        let a = List.get(sid(s),actual);
        require(body(s) == body(a) and image(s) == image(a),"body identity or immutable image changed")
    };
    foreach (c <- List.range(0,26)) {
        let group = List.filter(s -> body(s) == c,source);
        let s = List.get(0,group);
        let a = List.get(sid(s),actual);
        let sr = cross(up(s),normal(s));
        let ar = cross(up(a),normal(a));
        foreach (t <- group) {
            let b = List.get(sid(t),actual);
            let f = v -> mapFrame(v,sr,up(s),normal(s),ar,up(a),normal(a));
            require(f(pos(t)) == pos(b) and f(normal(t)) == normal(b) and f(up(t)) == up(b),"nonrigid or reflected body")
        }
    }
}

def atPosition(xs: List[Sticker], p: Vec): Sticker \ IO = match List.find(s -> pos(s) == p,xs) {
    case Some(s) => s
    case None => throw new IllegalArgumentException("missing body position")
}

def faceNormal(name: String): Vec = match name {
    case "U" => Vec.V(0,1,0)
    case "L" => Vec.V(-1,0,0)
    case "F" => Vec.V(0,0,1)
    case "R" => Vec.V(1,0,0)
    case "B" => Vec.V(0,0,-1)
    case "D" => Vec.V(0,-1,0)
    case _ => Vec.V(0,0,0)
}

def normalized(source: List[Sticker], actual: List[Sticker]): List[Sticker] \ IO = {
    let reference = List.map(faceNormal,List#{"R","U","F"});
    let cols = List.map(p -> pos(List.get(sid(atPosition(source,p)),actual)),reference);
    let cx=List.get(0,cols); let cy=List.get(1,cols); let cz=List.get(2,cols);
    require(axis(cx) and axis(cy) and axis(cz) and dot(cx,cy) == 0 and cross(cx,cy) == cz,"centers do not form a proper global frame");
    let norm = v -> Vec.V(dot(v,cx),dot(v,cy),dot(v,cz));
    foreach (s <- source) {
        if (nonzero(pos(s)) == 1) {
            let a=List.get(sid(s),actual);
            require(norm(pos(a)) == pos(s) and norm(normal(a)) == normal(s),"centers do not share one rigid frame")
        } else ()
    };
    List.map(s -> Sticker.S(sid(s),body(s),norm(pos(s)),norm(normal(s)),norm(up(s)),image(s)),actual)
}

def cornerFaces(): List[List[Vec]] = List.map(fs -> List.map(faceNormal,fs),List#{List#{"U","R","F"},List#{"U","F","L"},List#{"U","L","B"},List#{"U","B","R"},List#{"D","F","R"},List#{"D","L","F"},List#{"D","B","L"},List#{"D","R","B"}})
def edgeFaces(): List[List[Vec]] = List.map(fs -> List.map(faceNormal,fs),List#{List#{"U","R"},List#{"U","F"},List#{"U","L"},List#{"U","B"},List#{"D","R"},List#{"D","F"},List#{"D","L"},List#{"D","B"},List#{"F","R"},List#{"F","L"},List#{"B","L"},List#{"B","R"}})
def positionOf(fs: List[Vec]): Vec = List.foldLeft(add,Vec.V(0,0,0),fs)
def indexOf(v: Vec, xs: List[Vec]): Int32 = match List.find(p -> snd(p) == v,List.zipWithIndex(xs)) {
    case Some((i,_)) => i
    case None => -1
}

def permutation(source: List[Sticker], actual: List[Sticker], faces: List[List[Vec]]): List[Int32] \ IO = {
    let sources = List.map(fs -> body(atPosition(source,positionOf(fs))),faces);
    List.map(fs -> {
        let b=body(atPosition(actual,positionOf(fs)));
        match List.find(pair -> snd(pair) == b,List.zipWithIndex(sources)) {
            case Some((i,_)) => i
            case None => throw new IllegalArgumentException("piece class changed")
        }
    },faces)
}

def orientations(source: List[Sticker], actual: List[Sticker], faces: List[List[Vec]], perm: List[Int32]): List[Int32] \ IO =
    List.map(pair -> {
        let (destination,srcIndex)=pair;
        let srcFaces=List.get(srcIndex,faces);
        let srcP=positionOf(srcFaces);
        let ref=match List.find(s -> pos(s) == srcP and normal(s) == List.get(0,srcFaces),source) {
            case Some(s) => s
            case None => throw new IllegalArgumentException("missing orientation reference")
        };
        let a=List.get(sid(ref),actual);
        let orientation=indexOf(normal(a),List.get(destination,faces));
        require(orientation >= 0,"invalid oriented piece");
        orientation
    },List.zipWithIndex(perm))

def parity(perm: List[Int32]): Int32 = Int32.modulo(sum(List.map(pair -> {
    let (i,x)=pair;
    List.count(j -> j>i and x>List.get(j,perm),List.range(0,List.length(perm)))
},List.zipWithIndex(perm))),2)

def centerQuarters(source: List[Sticker], actual: List[Sticker]): List[Int32] \ IO = List.map(face -> {
    let n=faceNormal(face);
    let ref=atPosition(source,n);
    let a=List.get(sid(ref),actual);
    let axisIndex=if (coordinate(n,0) != 0) 0 else if (coordinate(n,1) != 0) 1 else 2;
    let sign=coordinate(n,axisIndex);
    match List.find(k -> rotate(up(ref),axisIndex,-sign*k) == up(a),List.range(0,4)) {
        case Some(k) => k
        case None => throw new IllegalArgumentException("invalid center up orientation")
    }
},List#{"U","L","F","R","B","D"})

def six(j: J, periods: Bool): List[Int32] \ IO = {
    let xs=List.map(integer,array(j));
    require(List.length(xs) == 6,"expected six center entries");
    require(all(List.map(n -> if (periods) n == 1 or n == 2 or n == 4 else n >= 0 and n <= 3,xs)),"invalid center index or period");
    xs
}

def reachability(source: List[Sticker], actual: List[Sticker]): List[Int32] \ IO = {
    rigidBodies(source,actual);
    let norm=normalized(source,actual);
    let cp=permutation(source,norm,cornerFaces());
    let ep=permutation(source,norm,edgeFaces());
    require(Int32.modulo(sum(orientations(source,norm,cornerFaces(),cp)),3) == 0,"corner twist sum");
    require(Int32.modulo(sum(orientations(source,norm,edgeFaces(),ep)),2) == 0,"edge flip sum");
    require(parity(cp) == parity(ep),"corner/edge permutation parity");
    let qs=centerQuarters(source,norm);
    require(Int32.modulo(sum(qs),2) == parity(cp),"physical center twist parity");
    qs
}

def checkState3(j: J): (List[Sticker],List[Int32],Bool) \ IO = {
    require(text(field(j,"schema")) == "cubistry.marked-3x3.v1","UNSUPPORTED: marked schema");
    let source=state(field(j,"printing"),3);
    let actual=state(field(j,"state"),3);
    let qs=reachability(source,actual);
    match optional(j,"centerTwists") {
        case Some(t) => require(six(t,false) == qs,"declared center twists disagree with full frames")
        case None => ()
    };
    let matched=match (optional(j,"centerGoal"),optional(j,"periods")) {
        case (None,None) => true
        case (Some(g),Some(p)) => {
            let goals=six(g,false); let ps=six(p,true);
            all(List.map(i -> Int32.modulo(List.get(i,qs)-List.get(i,goals),List.get(i,ps)) == 0,List.range(0,6)))
        }
        case _ => throw new IllegalArgumentException("centerGoal and periods must appear together")
    };
    (actual,qs,matched)
}
