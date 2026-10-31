// Native Flix checker for the H/M counter witness (cubistry.hm-counter.v1).
// Written independently of the Julia checker and of the generator. It turns
// every sticker frame with integer Rodrigues quarter turns, replays setups,
// increments, exact inverse decrements and the 11->00 reset, checks exact
// full-state closure, and rebuilds the tracked front-sticker graph (3 tracked
// stickers for "free", 4 for "blank") for the claimed lower bounds.
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
            case ch::Nil => {require(List.memberOf(ch,String.toList("HMS0123456789_")),"glyph alphabet");ch}
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

def runChain(rows: List[String],letter: Char,n: Int32,blank: Bool,st0: List[Stk],k: Int32,
             maps: List[Map[Pose,Int32]],dist: Vector[Int32]): (List[String],List[Int32],List[String]) \ IO = {
    let (setupText,rest0)=match rows {
        case r::more => match fieldsOf(r) {
            case "setup"::l::w::Nil => {require(l=="${letter}","setup row for ${letter}");(w,more)}
            case _ => throw new IllegalArgumentException("setup row for ${letter}")
        }
        case Nil => throw new IllegalArgumentException("setup row for ${letter}")
    };
    let setup=parseWord(setupText);
    let start=doWord(st0,setup);
    checkShow(start,wanted(letter,0,blank),"${letter}00 after setup");
    // forward
    let (state,states,words,lens,lbs,rest)=List.foldLeft((acc,v) -> match acc {
        case (s,ss,ws,ls,bs,rr) => {
            let nv=Int32.modulo(v+1,n);
            match rr {
                case r::more => match fieldsOf(r) {
                    case "edge"::l::a::b::wt::lbt::Nil => {
                        require(l=="${letter}" and a=="${v}" and b=="${nv}","edge row ${letter} ${v}");
                        let w=parseWord(wt);
                        let lb=lowerBound(k,maps,dist,s,wanted(letter,nv,blank));
                        require(natural(lbt)==lb,"claimed lower bound differs for ${letter} ${v}->${nv}");
                        require(List.length(w)>=lb,"word shorter than graph distance for ${letter} ${v}->${nv}");
                        let nxt=doWord(s,w);
                        checkShow(nxt,wanted(letter,nv,blank),"${letter} ${v}->${nv}");
                        require(doWord(nxt,invWord(w))==s,"full-state edge inverse");
                        (nxt,if(nv==0) ss else nxt::ss,w::ws,List.length(w)::ls,lb::bs,more)
                    }
                    case _ => throw new IllegalArgumentException("edge row ${letter} ${v}")
                }
                case Nil => throw new IllegalArgumentException("edge row ${letter} ${v}")
            }
        }
    },(start,start::Nil,Nil,Nil,Nil,rest0),List.range(0,n));
    require(state==start,"closure: ${letter} wrap must return to the exact start state");
    let fstates=List.reverse(states);
    let fwords=List.reverse(words);
    // decrement: exact inverse traversal from 00
    let _ = List.foldLeft((s,v) -> {
        let d=doWord(s,invWord(at(fwords,v)));
        require(d==at(fstates,v),"exact full-state decrement replay ${letter}");
        checkShow(d,wanted(letter,v,blank),"decrement ${letter} to ${v}");
        d
    },start,List.reverse(List.range(0,n)));
    let ls=List.reverse(lens);let bs=List.reverse(lbs);
    let tight=List.count(p -> match p { case (a,b) => a==b },List.zip(ls,bs));
    let total=List.foldLeft((a,b) -> a+b,0,ls);
    let mx=List.foldLeft((a,b) -> Int32.max(a,b),0,ls);
    let lbtotal=List.foldLeft((a,b) -> a+b,0,bs);
    let lbmax=List.foldLeft((a,b) -> Int32.max(a,b),0,bs);
    let out=List#{
        "chain\t${letter}\tedges\t${n}\ttotal\t${total}\tmax\t${mx}\thist\t${histText(ls)}\tlbtotal\t${lbtotal}\tlbmax\t${lbmax}\ttight\t${tight}\tclosure\texact",
        "decrement\t${letter}\tedges\t${n}\tinverse\texact",
        "setup\t${letter}\thtm\t${List.length(setup)}\tword\t${setupText}"
    };
    if(letter=='H') match rest {
        case r::more => match fieldsOf(r) {
            case "reset"::"H"::"11"::"0"::wt::lbt::Nil => {
                let w=parseWord(wt);
                let h11=at(fstates,11);
                let lb=lowerBound(k,maps,dist,h11,wanted('H',0,blank));
                require(natural(lbt)==lb,"claimed reset lower bound differs");
                let after=doWord(h11,w);
                checkShow(after,wanted('H',0,blank),"reset 11->00");
                require(after==start,"reset 11->00 must reach the exact H00 start state");
                require(doWord(start,invWord(w))==h11,"reset inverse returns to H11");
                (List.append(out,"reset\tH\t11\t0\thtm\t${List.length(w)}\tlb\t${lb}\texact"::Nil),List.append(ls,List.length(w)::Nil),more)
            }
            case _ => throw new IllegalArgumentException("reset row")
        }
        case Nil => throw new IllegalArgumentException("reset row")
    } else (out,ls,rest)
}

def validate(path: String): String \ IO = {
    let bytes=readBytes(path);
    let text=Files.readString(new File(path).toPath());
    require(not String.contains(substr="\r",text),"CR forbidden");
    require(String.endsWith(suffix="\n",text),"final LF required");
    let rows=String.splitOn(substr="\n",String.dropRight(1,text));
    require(List.forAll(r -> r != "",rows),"empty line");
    if(at(rows,0)=="cubistry.hm-counter.v2") validate2(rows,bytes) else {
    require(at(rows,0)=="cubistry.hm-counter.v1","schema header");
    let blank=match fieldsOf(at(rows,1)) {
        case "profile"::"free"::Nil => false
        case "profile"::"blank"::Nil => true
        case _ => throw new IllegalArgumentException("profile row")
    };
    require(at(rows,2)=="letters\tHM","letters row must be exactly HM");
    let st0=readPrint(List.slice(start=3,end=27,rows));
    if(blank) require(List.exists(x -> match x { case Stk.S(_,_,_,_,_,g) => g=='_' },st0),"blank profile needs a blank sticker") else ();
    let k=if(blank) 4 else 3;
    let (maps,dist)=buildGraph(k);
    let reach=List.filter(d -> d>=0,Vector.toList(dist));
    let maxd=List.foldLeft((a,b) -> Int32.max(a,b),0,reach);
    let graphLine="graph\t${List.length(reach)}\t"+String.intercalate(",",List.map(d -> "${d}:${List.count(x -> x==d,reach)}",List.range(0,maxd+1)));
    let (mOut,mLens,rest1)=runChain(List.drop(27,rows),'M',60,blank,st0,k,maps,dist);
    let (hOut,hLens,rest2)=runChain(rest1,'H',24,blank,st0,k,maps,dist);
    let all=List.append(mLens,hLens);
    let mx=List.foldLeft((a,b) -> Int32.max(a,b),0,all);
    let total=List.foldLeft((a,b) -> a+b,0,all);
    match rest2 {
        case c::"end"::Nil => match fieldsOf(c) {
            case "claim"::"maxEdgeHTM"::v::Nil => require(natural(v)==mx,"claimed maximum edge HTM differs from replay")
            case _ => throw new IllegalArgumentException("claim row")
        }
        case _ => throw new IllegalArgumentException("claim row")
    };
    let header=List#{"cubistry.hm-counter.receipt.v1","witness-sha256\t"+sha256(bytes),"profile\t"+(if(blank) "blank" else "free"),graphLine};
    let tail=List#{"transitions\t${List.length(all)}\ttotal\t${total}\tmax\t${mx}\thist\t${histText(all)}","verdict\tACCEPT"};
    String.intercalate("\n",List.append(List.append(List.append(header,mOut),hOut),tail))
}
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

// ---- v2: blank profile, run-in (preperiod) + repeating full-state period ----
// "mode L range setup P Q" then P+Q rows "step L range from to word lb".
// The state after P steps must reappear exactly after P+Q steps; P and Q are
// whole laps. Decrement = exact inverse traversal of the period.
def runMode(rows: List[String],letter: Char,range: Int32,st0: List[Stk],
            maps: List[Map[Pose,Int32]],dist: Vector[Int32]): (List[String],List[Int32],List[Int32],List[String]) \ IO = {
    let n=range+1;
    let (setupText,p,q,rest0)=match rows {
        case r::more => match fieldsOf(r) {
            case "mode"::l::rg::w::ps::qs::Nil => {
                require(l=="${letter}" and rg=="${range}","mode row ${letter} ${range}");
                (w,natural(ps),natural(qs),more)
            }
            case _ => throw new IllegalArgumentException("mode row ${letter} ${range}")
        }
        case Nil => throw new IllegalArgumentException("mode row ${letter} ${range}")
    };
    require(Int32.modulo(p,n)==0 and Int32.modulo(q,n)==0 and q>0 and p+q<=100000,"preperiod and period must be whole laps");
    let setup=parseWord(setupText);
    let start=doWord(st0,setup);
    checkShow(start,wanted(letter,0,true),"${letter}${range} 00 after setup");
    let (_,states,words,lens,lbs,rest)=List.foldLeft((acc,j) -> match acc {
        case (s,ss,ws,ls,bs,rr) => {
            let v=Int32.modulo(j,n);
            let nv=Int32.modulo(v+1,n);
            match rr {
                case r::more => match fieldsOf(r) {
                    case "step"::l::rg::a::b::wt::lbt::Nil => {
                        require(l=="${letter}" and rg=="${range}" and a=="${v}" and b=="${nv}","step row ${letter}${range} ${j}");
                        let w=parseWord(wt);
                        let lb=lowerBound(4,maps,dist,s,wanted(letter,nv,true));
                        require(natural(lbt)==lb,"claimed lower bound differs for ${letter}${range} step ${j}");
                        require(List.length(w)>=lb,"word shorter than graph distance for ${letter}${range} step ${j}");
                        let nxt=doWord(s,w);
                        checkShow(nxt,wanted(letter,nv,true),"${letter}${range} step ${j}");
                        require(doWord(nxt,invWord(w))==s,"full-state edge inverse");
                        (nxt,nxt::ss,w::ws,List.length(w)::ls,lb::bs,more)
                    }
                    case _ => throw new IllegalArgumentException("step row ${letter}${range} ${j}")
                }
                case Nil => throw new IllegalArgumentException("step row ${letter}${range} ${j}")
            }
        }
    },(start,start::Nil,Nil,Nil,Nil,rest0),List.range(0,p+q));
    let fstates=List.toVector(List.reverse(states));
    let fwords=List.toVector(List.reverse(words));
    require(Vector.get(p+q,fstates)==Vector.get(p,fstates),"period boundary: state after preperiod+period must equal state after preperiod for ${letter}${range}");
    List.forEach(j -> require(Vector.get(p+j,fstates) != Vector.get(p,fstates),"period is not minimal for ${letter}${range}"),List.map(k -> k*n,List.range(1,q/n)));
    let _ = List.foldLeft((s,j) -> {
        let d=doWord(s,invWord(Vector.get(j,fwords)));
        require(d==Vector.get(j,fstates),"exact full-state decrement replay ${letter}${range}");
        checkShow(d,wanted(letter,Int32.modulo(j,n),true),"decrement ${letter}${range}");
        d
    },Vector.get(p,fstates),List.reverse(List.range(p,p+q)));
    let ls=List.reverse(lens);
    let bs=List.reverse(lbs);
    let pre=List.take(p,ls);
    let per=List.drop(p,ls);
    let perLb=List.drop(p,bs);
    let sum=xs -> List.foldLeft((a,b) -> a+b,0,xs);
    let mxOf=xs -> List.foldLeft((a,b) -> Int32.max(a,b),0,xs);
    let tight=List.count(pr -> match pr { case (a,b) => a==b },List.zip(per,perLb));
    let out=List#{
        "mode\t${letter}\t${range}\tsetup\t${List.length(setup)}\tpreperiod\t${p}\tperiod\t${q}\tlaps\t${q/n}",
        "period\t${letter}\t${range}\ttotal\t${sum(per)}\tmax\t${mxOf(per)}\thist\t${histText(per)}\tlbtotal\t${sum(perLb)}\ttight\t${tight}\tclosure\texact",
        "preperiod\t${letter}\t${range}\ttotal\t${sum(pre)}\tmax\t${mxOf(pre)}\thist\t${histText(pre)}",
        "decrement\t${letter}\t${range}\tinverse-of-period\texact"
    };
    (out,per,pre,rest)
}

def validate2(rows: List[String],bytes: Array[Int8,Static]): String \ IO = {
    require(at(rows,1)=="profile\tblank","v2 requires the blank profile");
    require(at(rows,2)=="letters\tHM","letters row must be exactly HM");
    let st0=readPrint(List.slice(start=3,end=27,rows));
    require(List.exists(x -> match x { case Stk.S(_,_,_,_,_,g) => g=='_' },st0),"blank profile needs a blank sticker");
    let (maps,dist)=buildGraph(4);
    let reach=List.filter(d -> d>=0,Vector.toList(dist));
    let maxd=List.foldLeft((a,b) -> Int32.max(a,b),0,reach);
    let graphLine="graph\t${List.length(reach)}\t"+String.intercalate(",",List.map(d -> "${d}:${List.count(x -> x==d,reach)}",List.range(0,maxd+1)));
    let (o1,per1,pre1,r1)=runMode(List.drop(27,rows),'M',59,st0,maps,dist);
    let (o2,per2,pre2,r2)=runMode(r1,'H',23,st0,maps,dist);
    let (o3,per3,pre3,r3)=runMode(r2,'H',11,st0,maps,dist);
    let per=List.append(List.append(per1,per2),per3);
    let pre=List.append(List.append(pre1,pre2),pre3);
    let mxOf=xs -> List.foldLeft((a,b) -> Int32.max(a,b),0,xs);
    let m=Int32.max(mxOf(per),mxOf(pre));
    match r3 {
        case c::"end"::Nil => match fieldsOf(c) {
            case "claim"::"maxEdgeHTM"::v::Nil => require(natural(v)==m,"claimed maximum edge HTM differs from replay")
            case _ => throw new IllegalArgumentException("claim row")
        }
        case _ => throw new IllegalArgumentException("claim row")
    };
    let header=List#{"cubistry.hm-counter.receipt.v2","witness-sha256\t"+sha256(bytes),"profile\tblank",graphLine};
    let tail=List#{"edges\tperiod\t${List.length(per)}\tmax\t${mxOf(per)}\thist\t${histText(per)}\tpreperiod\t${List.length(pre)}\tmax\t${mxOf(pre)}\thist\t${histText(pre)}","verdict\tACCEPT"};
    String.intercalate("\n",List.append(List.append(List.append(List.append(header,o1),o2),o3),tail))
}
