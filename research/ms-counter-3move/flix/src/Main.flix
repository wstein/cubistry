// Native Flix checker for the M/S counter witness (cubistry.ms-counter.v1).
//
// Provenance: adapted from research/hm-counter-3move/flix/src/Main.flix at
// commit 9ca9f9e9fe6043cdec584c5394ef92a8634a487d (sticker geometry, Rodrigues
// turns, display check and tracked-sticker graph are reused; the run/period
// logic is new). Written independently of the Julia checker and of the
// generator. It turns every sticker frame with integer Rodrigues quarter
// turns, replays each setup and every increment of the M and S runs over the
// claimed period, checks the blank upper-left sticker and upright glyphs at
// every display, the exact full-state return at the period boundary (and the
// minimality of the period), the exact inverse decrement traversal, and
// rebuilds the tracked front-sticker graph (4 tracked stickers for "blank")
// for the claimed lower bounds.
import java.lang.{Exception,System,IllegalArgumentException}
import java.io.File
import java.nio.file.Files
import java.security.MessageDigest
import java.util.HexFormat

type alias Vec = (Int32,Int32,Int32)
type alias Pose = (Vec,Vec,Vec)
type alias Mv = (Int32,Int32,Int32)
enum Stk with Eq { case S(Int32,Int32,Vec,Vec,Vec,Char) }

def require(ok: Bool,reason: String): Unit \ IO = if(ok) () else throw new IllegalArgumentException(reason)
def readBytes(path: String): Array[Int8,Static] \ IO = Files.readAllBytes(new File(path).toPath())
def sha256(bytes: Array[Int8,Static]): String \ IO = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes))
def at(xs: List[a],i: Int32): a \ IO = match xs {
    case x::rest => if(i==0) x else at(rest,i-1)
    case Nil => throw new IllegalArgumentException("list index")
}
def digits(s: String): Bool = String.length(s)>0 and List.forAll(c -> c>='0' and c<='9',String.toList(s))
def natural(s: String): Int32 \ IO = {
    require(digits(s) and String.length(s)<=6,"integer field");
    match Int32.fromString(s) {
        case Some(n) => n
        case None => throw new IllegalArgumentException("integer field")
    }
}
def signed(s: String): Int32 \ IO = match String.toList(s) {
    case '-'::rest => 0-natural(List.foldLeft((a,c) -> a+"${c}","",rest))
    case _ => natural(s)
}
def vec(s: String): Vec \ IO = match String.splitOn(substr=",",s) {
    case x::y::z::Nil => (signed(x),signed(y),signed(z))
    case _ => throw new IllegalArgumentException("vector arity")
}
def dot(a: Vec,b: Vec): Int32 = match (a,b) { case ((x,y,z),(u,v,w)) => x*u+y*v+z*w }
def cross(a: Vec,b: Vec): Vec = match (a,b) { case ((x,y,z),(u,v,w)) => (y*w-z*v,z*u-x*w,x*v-y*u) }
def comp(v: Vec,a: Int32): Int32 = match v { case (x,y,z) => if(a==0) x else if(a==1) y else z }
def unitVec(v: Vec): Bool = List.memberOf(v,List#{(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)})
def axisVec(a: Int32): Vec = if(a==0) (1,0,0) else if(a==1) (0,1,0) else (0,0,1)

// Rodrigues: v cos + (e x v) sin + e (e.v)(1-cos), k quarter turns about e
def turn(v: Vec,e: Vec,k: Int32): Vec = {
    let q=Int32.modulo(k,4);
    let c=if(q==0) 1 else if(q==2) -1 else 0;
    let s=if(q==1) 1 else if(q==3) -1 else 0;
    let x=cross(e,v);
    let d=dot(e,v);
    match (v,x,e) {
        case ((v1,v2,v3),(x1,x2,x3),(e1,e2,e3)) =>
            (v1*c+x1*s+e1*d*(1-c),v2*c+x2*s+e2*d*(1-c),v3*c+x3*s+e3*d*(1-c))
    }
}

def parseMove(t: String): Mv \ IO = {
    let cs=String.toList(t);
    let face=match cs { case f::_ => f case Nil => ' ' };
    let amt=match cs {
        case _::Nil => 1
        case _::'2'::Nil => 2
        case _::'\''::Nil => -1
        case _ => {require(false,"illegal move token");0}
    };
    match face {
        case 'R' => (0,1,amt)
        case 'L' => (0,-1,amt)
        case 'U' => (1,1,amt)
        case 'D' => (1,-1,amt)
        case 'F' => (2,1,amt)
        case 'B' => (2,-1,amt)
        case _ => {require(false,"illegal move token");(0,0,0)}
    }
}
def parseWord(w: String): List[Mv] \ IO = if(w=="-") Nil else List.map(parseMove,String.splitOn(substr=" ",w))
def invWord(w: List[Mv]): List[Mv] = List.reverse(List.map(m -> match m { case (a,s,q) => (a,s,if(q==2) 2 else 0-q) },w))

def moveStk(m: Mv,x: Stk): Stk = match (m,x) {
    case ((a,s,q),Stk.S(id,c,p,n,u,g)) =>
        if(comp(p,a)==s) {
            let e=axisVec(a);let k=0-s*q;
            Stk.S(id,c,turn(p,e,k),turn(n,e,k),turn(u,e,k),g)
        } else x
}
def doWord(st: List[Stk],w: List[Mv]): List[Stk] = List.foldLeft((s,m) -> List.map(x -> moveStk(m,x),s),st,w)

def cells(): List[Vec] = List#{(-1,1,1),(1,1,1),(-1,-1,1),(1,-1,1)}
def digitChar(d: Int32): Char \ IO = at(String.toList("0123456789"),d)
def wanted(letter: Char,v: Int32,blank: Bool): List[Char] \ IO =
    List#{if(blank) '_' else '?',letter,digitChar(v/10),digitChar(Int32.modulo(v,10))}

def checkShow(st: List[Stk],want: List[Char],what: String): Unit \ IO =
    List.forEach(k -> {
        let w=at(want,k);
        if(w=='?') () else {
            let cell=at(cells(),k);
            let seen=List.filter(x -> match x { case Stk.S(_,_,p,n,_,_) => p==cell and n==(0,0,1) },st);
            require(List.length(seen)==1,"exactly one visible sticker per cell");
            match at(seen,0) {
                case Stk.S(_,_,_,_,u,g) =>
                    if(w=='_') require(g=='_',"upper-left cell must show a blank sticker at "+what)
                    else {
                        require(g==w,"wrong glyph at cell ${k+1} for "+what);
                        require(u==(0,1,0),"glyph not upright at cell ${k+1} for "+what)
                    }
            }
        }
    },List.range(0,4))

def readSticker(row: String): Stk \ IO = match String.splitOn(substr="\t",row) {
    case "sticker"::i::c::ps::ns::us::gs::Nil => {
        let p=vec(ps);let n=vec(ns);let u=vec(us);
        require(List.forAll(a -> Int32.abs(comp(p,a))==1,List.range(0,3)),"corner position");
        require(unitVec(n) and unitVec(u) and dot(p,n)==1 and dot(n,u)==0,"outward tangent frame");
        let g=match String.toList(gs) {
            case ch::Nil => {require(List.memberOf(ch,String.toList("MS0123456789_")),"glyph alphabet");ch}
            case _ => {require(false,"glyph alphabet");' '}
        };
        Stk.S(natural(i),natural(c),p,n,u,g)
    }
    case _ => throw new IllegalArgumentException("sticker row shape")
}
def readPrint(rows: List[String]): List[Stk] \ IO = {
    require(List.length(rows)==24,"exactly 24 sticker rows");
    let st=List.map(readSticker,rows);
    let ids=List.sort(List.map(x -> match x { case Stk.S(i,_,_,_,_,_) => i },st));
    require(ids==List.range(0,24),"unique sticker ids 0..23");
    let facelets=List.toSet(List.map(x -> match x { case Stk.S(_,_,p,n,_,_) => (p,n) },st));
    require(Set.size(facelets)==24,"complete 24-facelet lattice");
    List.forEach(c -> {
        let ps=List.map(x -> match x { case Stk.S(_,_,p,_,_,_) => p },List.filter(x -> match x { case Stk.S(_,cc,_,_,_,_) => cc==c },st));
        require(List.length(ps)==3 and Set.size(List.toSet(ps))==1,"eight rigid three-sticker corners")
    },List.range(0,8));
    require(Set.size(List.toSet(List.map(x -> match x { case Stk.S(_,_,p,_,_,_) => p },st)))==8,"distinct corner positions");
    List.sortWith((a,b) -> match (a,b) { case (Stk.S(i,_,_,_,_,_),Stk.S(j,_,_,_,_,_)) => Order.compare(i,j) },st)
}

// ---- tracked-sticker graph ----
def allMoves(): List[Mv] = List.flatMap(f -> match f { case (a,s) => List.map(q -> (a,s,q),List#{1,2,-1}) },
    List#{(0,1),(0,-1),(1,1),(1,-1),(2,1),(2,-1)})
def poseMove(m: Mv,pose: Pose): Pose = match (m,pose) {
    case ((a,s,q),(p,n,u)) => if(comp(p,a)==s) {
        let e=axisVec(a);let k=0-s*q;(turn(p,e,k),turn(n,e,k),turn(u,e,k))
    } else pose
}
def orbitOf(seed: Pose): List[Pose] = {
    def grow(seen: List[Pose],todo: List[Pose]): List[Pose] = match todo {
        case Nil => List.reverse(seen)
        case x::rest => {
            let fresh=List.filter(y -> not List.memberOf(y,seen),List.distinct(List.map(m -> poseMove(m,x),allMoves())));
            let fresh2=List.filter(y -> not List.memberOf(y,seen),fresh);
            grow(List.append(List.reverse(fresh2),seen),List.append(rest,fresh2))
        }
    };
    grow(seed::Nil,seed::Nil)
}
def slotsFor(k: Int32): List[Int32] = if(k==4) List#{0,1,2,3} else List#{1,2,3}
def pow24(k: Int32): Int32 = List.foldLeft((a,_) -> a*24,1,List.range(0,k))
def encode(t: List[Int32]): Int32 = List.foldLeft((a,x) -> a*24+x,0,t)

// returns (pose index maps per slot, distance vector)
def buildGraph(k: Int32): (List[Map[Pose,Int32]],Vector[Int32]) \ IO = {
    let orbits=List.map(slot -> orbitOf((at(cells(),slot),(0,0,1),(0,1,0))),slotsFor(k));
    List.forEach(o -> require(List.length(o)==24,"24 poses per tracked slot"),orbits);
    let maps=List.map(o -> List.foldLeft((m,p) -> match p { case (i,pose) => Map.insert(pose,i,m) },Map.empty(),List.zipWithIndex(o)),orbits);
    let moves=allMoves();
    // trans: per slot, Vector indexed by pose*18+move
    let trans=List.map(pair -> match pair { case (o,m) =>
        List.toVector(List.flatMap(pose -> List.map(mv -> match Map.get(poseMove(mv,pose),m) {
            case Some(i) => i
            case None => -1
        },moves),o)) },List.zip(orbits,maps));
    let size=pow24(k);
    let dist=region rc {
        let d=Array.repeat(rc,size,-1);
        let queue=Array.repeat(rc,size,0);
        let start=encode(List.map(_ -> 0,slotsFor(k)));
        Array.put(0,start,d);
        Array.put(start,0,queue);
        def loop(head: Int32,tail: Int32): Unit \ rc = if(head>=tail) () else {
            let code=Array.get(head,queue);
            let dd=Array.get(code,d);
            let parts=List.reverse(List.map(j -> Int32.modulo(code/pow24(j),24),List.range(0,k)));
            let newTail=List.foldLeft((t,mi) -> {
                let nxt=encode(List.map(pr -> match pr { case (tr,pi) => Vector.get(pi*18+mi,tr) },List.zip(trans,parts)));
                if(Array.get(nxt,d)<0) {Array.put(dd+1,nxt,d);Array.put(nxt,t,queue);t+1} else t
            },tail,List.range(0,18));
            loop(head+1,newTail)
        };
        loop(0,1);
        Array.toVector(d)
    };
    (maps,dist)
}

def lowerBound(k: Int32,maps: List[Map[Pose,Int32]],dist: Vector[Int32],st: List[Stk],want: List[Char]): Int32 \ IO = {
    let cands=List.map(pair -> match pair { case (slot,m) => {
        let w=at(want,slot);
        List.flatMap(x -> match x { case Stk.S(_,c,p,n,u,g) =>
            if(w=='_' and g=='_')
                List.flatMap(t -> if(dot(t,n) != 0) Nil else match Map.get((p,n,t),m) { case Some(i) => (c,i)::Nil case None => Nil },
                    List#{(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)})
            else if(w != '_' and g==w) match Map.get((p,n,u),m) { case Some(i) => (c,i)::Nil case None => Nil }
            else Nil
        },st)
    } },List.zip(slotsFor(k),maps));
    def combos(rest: List[List[(Int32,Int32)]],used: List[Int32],acc: List[Int32]): Int32 = match rest {
        case Nil => {
            let dd=Vector.get(encode(List.reverse(acc)),dist);
            if(dd<0) 1000 else dd
        }
        case opts::more => List.foldLeft((best,o) -> match o { case (c,i) =>
            if(List.memberOf(c,used)) best else Int32.min(best,combos(more,c::used,i::acc)) },1000,opts)
    };
    let best=combos(cands,Nil,Nil);
    require(best<1000,"a reachable matching selection exists");
    best
}

def histText(lens: List[Int32]): String =
    String.intercalate(",",List.map(d -> "${d}:${List.count(x -> x==d,lens)}",List.range(0,7)))
def fieldsOf(row: String): List[String] = String.splitOn(substr="\t",row)

def runChain(rows: List[String],letter: Char,blank: Bool,st0: List[Stk],k: Int32,
             maps: List[Map[Pose,Int32]],dist: Vector[Int32]): (List[String],List[Int32],List[String]) \ IO = {
    let (setupText,p,rest0)=match rows {
        case r::more => match fieldsOf(r) {
            case "run"::l::"setup"::w::"period"::ps::Nil => {
                require(l=="${letter}","run row for ${letter}");
                let pcs=String.toList(ps);
                require(digits(ps) and String.length(ps)<=3 and (match pcs { case '0'::_ => false case _ => true }),"period must be a positive integer");
                (w,natural(ps),more)
            }
            case _ => throw new IllegalArgumentException("run row for ${letter}")
        }
        case Nil => throw new IllegalArgumentException("run row for ${letter}")
    };
    let n=60*p;
    let setup=parseWord(setupText);
    let start=doWord(st0,setup);
    checkShow(start,wanted(letter,0,blank),"${letter}00 after setup");
    // forward over the whole period
    let (state,states,words,lens,lbs,rest)=List.foldLeft((acc,i) -> match acc {
        case (s,ss,ws,ls,bs,rr) => {
            let v=Int32.modulo(i,60);
            let nv=Int32.modulo(v+1,60);
            match rr {
                case r::more => match fieldsOf(r) {
                    case "edge"::l::it::a::b::wt::lbt::Nil => {
                        require(l=="${letter}" and it=="${i}" and a=="${v}" and b=="${nv}","edge row ${letter} ${i}");
                        let w=parseWord(wt);
                        let lb=lowerBound(k,maps,dist,s,wanted(letter,nv,blank));
                        require(natural(lbt)==lb,"claimed lower bound differs for ${letter} edge ${i} (${v}->${nv})");
                        require(List.length(w)>=lb,"word shorter than graph distance for ${letter} edge ${i} (${v}->${nv})");
                        let nxt=doWord(s,w);
                        checkShow(nxt,wanted(letter,nv,blank),"${letter} edge ${i} (${v}->${nv})");
                        require(doWord(nxt,invWord(w))==s,"full-state edge inverse");
                        if(nv==0 and i<n-1) require(nxt != start,"period boundary: ${letter} returns to the start state before the claimed period") else ();
                        (nxt,if(i<n-1) nxt::ss else ss,w::ws,List.length(w)::ls,lb::bs,more)
                    }
                    case _ => throw new IllegalArgumentException("edge row ${letter} ${i}")
                }
                case Nil => throw new IllegalArgumentException("edge row ${letter} ${i}")
            }
        }
    },(start,start::Nil,Nil,Nil,Nil,rest0),List.range(0,n));
    require(state==start,"period boundary: ${letter} run does not return to the exact start state after the claimed period");
    let fstates=List.toVector(List.reverse(states));
    let fwords=List.toVector(List.reverse(words));
    // decrement: exact inverse traversal of the period from 00
    let _ = List.foldLeft((s,i) -> {
        let d=doWord(s,invWord(Vector.get(i,fwords)));
        require(d==Vector.get(i,fstates),"exact full-state decrement replay ${letter}");
        checkShow(d,wanted(letter,Int32.modulo(i,60),blank),"decrement ${letter} to edge ${i} source");
        d
    },start,List.reverse(List.range(0,n)));
    let ls=List.reverse(lens);
    let bs=List.reverse(lbs);
    let tight=List.count(pr -> match pr { case (a,b) => a==b },List.zip(ls,bs));
    let total=List.foldLeft((a,b) -> a+b,0,ls);
    let mx=List.foldLeft((a,b) -> Int32.max(a,b),0,ls);
    let lbtotal=List.foldLeft((a,b) -> a+b,0,bs);
    let lbmax=List.foldLeft((a,b) -> Int32.max(a,b),0,bs);
    let out=List#{
        "run\t${letter}\tperiod\t${p}\trunin\t0\tedges\t${n}\ttotal\t${total}\tmax\t${mx}\thist\t${histText(ls)}\tlbtotal\t${lbtotal}\tlbmax\t${lbmax}\ttight\t${tight}",
        "decrement\t${letter}\tedges\t${n}\tinverse\texact",
        "setup\t${letter}\thtm\t${List.length(setup)}\tword\t${setupText}"
    };
    (out,ls,rest)
}

def validate(path: String): String \ IO = {
    let bytes=readBytes(path);
    let text=Files.readString(new File(path).toPath());
    require(not String.contains(substr="\r",text),"CR forbidden");
    require(String.endsWith(suffix="\n",text),"final LF required");
    let rows=String.splitOn(substr="\n",String.dropRight(1,text));
    require(List.forAll(r -> r != "",rows),"empty line");
    require(at(rows,0)=="cubistry.ms-counter.v1","schema header");
    let blank=match fieldsOf(at(rows,1)) {
        case "profile"::"free"::Nil => false
        case "profile"::"blank"::Nil => true
        case _ => throw new IllegalArgumentException("profile row")
    };
    require(at(rows,2)=="letters\tMS","letters row must be exactly MS");
    let st0=readPrint(List.slice(start=3,end=27,rows));
    if(blank) require(List.exists(x -> match x { case Stk.S(_,_,_,_,_,g) => g=='_' },st0),"blank profile needs a blank sticker") else ();
    let k=if(blank) 4 else 3;
    let (maps,dist)=buildGraph(k);
    let reach=List.filter(d -> d>=0,Vector.toList(dist));
    let maxd=List.foldLeft((a,b) -> Int32.max(a,b),0,reach);
    let graphLine="graph\t${List.length(reach)}\t"+String.intercalate(",",List.map(d -> "${d}:${List.count(x -> x==d,reach)}",List.range(0,maxd+1)));
    let (mOut,mLens,rest1)=runChain(List.drop(27,rows),'M',blank,st0,k,maps,dist);
    let (sOut,sLens,rest2)=runChain(rest1,'S',blank,st0,k,maps,dist);
    let all=List.append(mLens,sLens);
    let mx=List.foldLeft((a,b) -> Int32.max(a,b),0,all);
    let total=List.foldLeft((a,b) -> a+b,0,all);
    match rest2 {
        case c::"end"::Nil => match fieldsOf(c) {
            case "claim"::"maxEdgeHTM"::v::Nil => require(natural(v)==mx,"claimed maximum edge HTM differs from replay")
            case _ => throw new IllegalArgumentException("claim row")
        }
        case _ => throw new IllegalArgumentException("claim row")
    };
    let header=List#{"cubistry.ms-counter.receipt.v1","witness-sha256\t"+sha256(bytes),"profile\t"+(if(blank) "blank" else "free"),graphLine};
    let tail=List#{"transitions\t${List.length(all)}\ttotal\t${total}\tmax\t${mx}\thist\t${histText(all)}","verdict\tACCEPT"};
    String.intercalate("\n",List.append(List.append(List.append(header,mOut),sOut),tail))
}

def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case path::Nil => println(validate(path))
            case _ => throw new IllegalArgumentException("usage: WITNESS")
        }
    } catch {
        case ex: IllegalArgumentException => {println("REJECT\t"+ex.getMessage());System.exit(1)}
    }
})
