import java.lang.IllegalArgumentException

type alias Vec = (Int32,Int32,Int32)
type alias Art = (String,Int32,String)
type alias Perm = Vector[Int32]
enum Rot with Eq { case R(Int32,Int32,Int32,Int32,Int32,Int32) }
enum Pose with Eq { case P(Int32,Vec,Vec,Vec) }
enum Sticker with Eq { case S(Int32,Int32,Vec,Vec,Vec,String,String) }
enum Goal with Eq { case G(Int32,Int32,List[(String,String)]) }

def require(ok: Bool,reason: String): Unit \ IO = if(ok) () else throw new IllegalArgumentException(reason)
def at(xs: List[a],i: Int32): a \ IO = match xs {
    case x::rest  =>  if(i==0) x else at(rest,i-1)
    case Nil  =>  throw new IllegalArgumentException("list index")
}
def integer(s: String): Int32 \ IO = {
    let digits=String.toList(s);
    let valid=List.length(digits)>0 and List.count(c  ->  List.memberOf(c,String.toList("0123456789-")),digits)==List.length(digits);
    require(valid,"invalid integer");
    match Int32.fromString(s) {
        case Some(n)  =>  { require("${n}"==s,"noncanonical integer");n }
        case None  =>  throw new IllegalArgumentException("integer range")
    }
}
def lines(raw: String): List[String] \ IO = {
    require(not String.contains(substr="\r",raw),"CR forbidden in canonical TSV");
    let parts=String.splitOn(substr="\n",raw);
    match List.reverse(parts) {
        case ""::rest  =>  {let rows=List.reverse(rest);require(List.count(s  ->  s=="",rows)==0,"empty input line");rows}
        case _  =>  throw new IllegalArgumentException("input requires final LF")
    }
}
def fields(s: String): List[String] = String.splitOn(substr="\t",s)
def vector(s: String): Vec \ IO = match String.splitOn(substr=",",s) {
    case x::y::z::Nil  =>  (integer(x),integer(y),integer(z))
    case _  =>  throw new IllegalArgumentException("vector requires3 fields")
}
def component(v: Vec,a: Int32): Int32 = {let(x,y,z)=v;if(a==0) x else if(a==1) y else z}
def add(v: Vec,w: Vec): Vec = {let(x,y,z)=v;let(a,b,c)=w;(x+a,y+b,z+c)}
def scale(k: Int32,v: Vec): Vec = {let(x,y,z)=v;(k*x,k*y,k*z)}
def dot(v: Vec,w: Vec): Int32 = {let(x,y,z)=v;let(a,b,c)=w;x*a+y*b+z*c}
def cross(v: Vec,w: Vec): Vec = {let(x,y,z)=v;let(a,b,c)=w;(y*c-z*b,z*a-x*c,x*b-y*a)}
// Exact finite membership at untrusted vector ingress. Squared Int32 norm is
// UNSOUND here: 65536^2 wraps to zero and could accept (65536,1,0).
def unit(v: Vec): Bool = List.memberOf(v,List#{(-1,0,0),(1,0,0),(0,-1,0),(0,1,0),(0,0,-1),(0,0,1)})

def rotations(): List[Rot] =
    List.flatMap(a  ->  List.flatMap(b  ->  if(a==b) Nil else {
        let c=3-a-b;let inv=(if(a>b)1 else 0)+(if(a>c)1 else 0)+(if(b>c)1 else 0);
        let parity=if(Int32.modulo(inv,2)==0)1 else -1;
        List.flatMap(sx  ->  List.map(sy  ->  Rot.R(a,b,c,sx,sy,parity*sx*sy),List#{-1,1}),List#{-1,1})
    },List.range(0,3)),List.range(0,3))
def rotate(v: Vec,r: Rot): Vec = match r {case Rot.R(a,b,c,x,y,z)  =>  (x*component(v,a),y*component(v,b),z*component(v,c))}
def quarter(v: Vec,axis: Int32): Vec = {
    let(x,y,z)=v;
    if(axis==1) (x,-z,y) else if(axis==2) (z,y,-x) else (-y,x,z)
}
def bodyKey(p: Vec): Vec \ IO = at(List.sort(List.map(r  ->  rotate(p,r),rotations())),0)
def homes(): List[Vec] = List.filter(v  ->  {let(x,y,z)=v;Int32.max(Int32.abs(x),Int32.max(Int32.abs(y),Int32.abs(z)))==3},
    List.flatMap(x  ->  List.flatMap(y  ->  List.map(z  ->  (x,y,z),List.range(-3,4)),List.range(-3,4)),List.range(-3,4)))
def normals(p: Vec): List[Vec] = List.map(a  ->  {
    let s=if(component(p,a)>0)1 else -1;
    if(a==0)(s,0,0) else if(a==1)(0,s,0) else(0,0,s)
},List.filter(a  ->  Int32.abs(component(p,a))==3,List.range(0,3)))
def orbit(row: Int32,col: Int32): (Int32,Int32) \ IO = {
    let x=col-4;let y=4-row;
    at(List.sort(List#{(x,y),(-y,x),(-x,-y),(y,-x)}),0)
}
def orbitAngle(row: Int32,col: Int32): Int32 \ IO = {
    let key=orbit(row,col);
    let x=col-4;let y=4-row;
    at(List.filter(q  ->  at(List#{(x,y),(-y,x),(-x,-y),(y,-x)},q)==key,List.range(0,4)),0)
}
def cells(): List[(Int32,Int32)] = List.flatMap(r  ->  List.map(c  ->  (r,c),List.range(1,8)),List.range(1,8))

def leap(y: Int32): Bool = Int32.modulo(y,4)==0 and (Int32.modulo(y,100) != 0 or Int32.modulo(y,400)==0)
def monthDays(y: Int32,m: Int32): Int32 = if(m==2) {if(leap(y))29 else 28}
    else if(List.memberOf(m,List#{4,6,9,11}))30 else 31
def offset(y: Int32,m: Int32): Int32 = {
    let p=y-1;
    Int32.modulo(365*p+p/4-p/100+p/400+List.foldLeft((a,k) -> a+monthDays(y,k),0,List.range(1,m))+1,7)
}
def calendarMonths(): List[(Int32,Int32)] = List.flatMap(y  ->  List.map(m  ->  (y,m),List.range(1,13)),List.range(2026,2100))
def dateCell(off: Int32,d: Int32): (Int32,Int32) = {
    let index=off+d-1;let w=index/7;(if(w==5)3 else w+3,Int32.modulo(index,7)+1)
}
def monthWord(m: Int32): String \ IO = at(List#{"JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"},m-1)
def header(c: Int32): String \ IO = at(List#{"SUN","MON","TUE","WED","THU","FRI","SAT"},c-1)
def weekend(c: Int32): Bool = c==1 or c==7
def goalCell(y: Int32,m: Int32,row: Int32,col: Int32): (String,String) \ IO = {
    if(row==1) {
        let start=if(m<=9)5 else 1;
        if(col>=start and col<=start+2) ("${at(String.toList(monthWord(m)),col-start)}","month") else("","blank")
    } else if(row==2) (header(col),if(weekend(col))"red" else"weekday")
    else match List.filter(d  ->  dateCell(offset(y,m),d)==(row,col),List.range(1,monthDays(y,m)+1)) {
        case Nil  =>  ("","blank")
        case d::Nil  =>  ("${d}"+(if((offset(y,m)+d-1)/7==5)"↶" else""),if(weekend(col))"red" else"dark")
        case _  =>  throw new IllegalArgumentException("overflow target collision")
    }
}
def goal(y: Int32,m: Int32): Goal \ IO = Goal.G(y,m,List.map(p  ->  {let(r,c)=p;goalCell(y,m,r,c)},cells()))
def goalBoard(g: Goal): List[(String,String)] = match g {case Goal.G(_,_,board) => board}
def representatives(): List[Goal] \ IO = List.reverse(List.foldLeft((seen,p)  ->  {
    let(y,m)=p;let g=goal(y,m);
    if(List.count(old  ->  goalBoard(old)==goalBoard(g),seen)>0)seen else g::seen
},Nil,calendarMonths()))

def halfChar(c: Char): Option[Char] = match c {
    case '6' => Some('9')
    case '9' => Some('6')
    case _  =>  if(List.memberOf(c,String.toList("01258HNSXZ")))Some(c) else None
}
def halfWord(s: String): Option[String] = List.foldLeft((acc,c) -> match(acc,halfChar(c)) {
    case(Some(a),Some(b)) => Some(a+"${b}")
    case _ => None
},Some(""),List.reverse(String.toList(s)))
// Optic normalizer preserves actual angle, INCLUDING core stickers.
def optic(raw: String,angle: Int32,ink: String): Art \ IO = {
    let s=String.replace(src="I",dst="1",String.replace(src="O",dst="0",raw));
    if(s=="") ("",0,"blank") else if(s=="0") (s,0,ink)
    else match halfWord(s) {
        case None  =>  (s,angle,ink)
        case Some(h)  =>  at(List.sort(List#{(s,angle,ink),(h,Int32.modulo(angle+2,4),ink)}),0)
    }
}
// This additional core quotient is for the INVENTORY LOWER BOUND only.
def lowerArt(raw: String,ink: String,row: Int32,col: Int32): Art \ IO = {
    if(orbit(row,col)==(0,0)) at(List.sort(List.map(q  ->  optic(raw,q,ink),List.range(0,4))),0)
    else optic(raw,orbitAngle(row,col),ink)
}
def upAngle(up: Vec): Int32 \ IO =
    at(List.map(p  ->  {let(i,_)=p;i},List.filter(p  ->  {let(_,v)=p;v==up},List.zipWithIndex(List#{(0,1,0),(-1,0,0),(0,-1,0),(1,0,0)}))),0)
