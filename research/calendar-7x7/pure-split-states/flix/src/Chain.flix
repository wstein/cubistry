// Copied from ../../continuous/flix/src/Main.flix at base 7eaebaf (chain parser, step replay,
// digest, metrics); read/checkFront/runChain/selftests/main removed. Used by Main.flix.
import java.lang.{Exception,System,IllegalArgumentException}
import java.io.File
import java.nio.file.Files
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.HexFormat

enum Step with Eq {case M(Int32,Int32)}
enum Edge {case E(Int32,Int32,Int32,Int32,Int32,Int32,String,String,List[Step])}
enum CalendarChain {case C(Int32,Int32,Int32,String,List[Edge])}
def digest(raw: String): String \ IO = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)))
def sha(s: String): String \ IO = {
    require(String.length(s)==64 and List.count(c -> List.memberOf(c,String.toList("0123456789abcdef")),String.toList(s))==64,"canonical lowercase SHA256 required");s
}
def validMonth(y: Int32,m: Int32): Unit \ IO = require(y>=2026 and y<=2099 and m>=1 and m<=12,"month in2026..2099")
def readStep(row: String): Step \ IO = match fields(row) {
    case "move"::g::q::Nil => {
        let gen=integer(g);let turns=integer(q);
        require(gen>=1 and gen<=21,"generator1..21");
        require(List.memberOf(turns,List#{-1,1,2}),"quarter exponent must be-1,1,2");
        Step.M(gen,turns)
    }
    case _ => throw new IllegalArgumentException("move row")
}
def readMoves(rows: List[String],moves: List[Step],count: Int32): (List[Step],List[String]) \ IO = match rows {
    case "end"::rest => (List.reverse(moves),rest)
    case row::rest => {
        require(count<100000,"bounded100000moves per edge");
        readMoves(rest,readStep(row)::moves,count+1)
    }
    case Nil => throw new IllegalArgumentException("edge requires end")
}
def readEdges(rows: List[String],edges: List[Edge],count: Int32): List[Edge] \ IO = match rows {
    case "finish"::Nil => {require(count>=2,"chain requires at least two edges");List.reverse(edges)}
    case row::rest => {
        require(count<1000,"bounded1000edges per chain");
        match fields(row) {
            case "edge"::ys::ms::hs::qs::rs::rqs::ss::ds::Nil => {
                let y=integer(ys);let m=integer(ms);validMonth(y,m);
                let h=integer(hs);let q=integer(qs);let r=integer(rs);let rq=integer(rqs);
                require(h>=0 and h<=100000 and q>=0 and q<=200000 and r>=0 and r<=100000 and rq>=0 and rq<=200000,"bounded nonnegative declared metrics");
                let source=sha(ss);let destination=sha(ds);
                let(moves,remaining)=readMoves(rest,Nil,0);
                readEdges(remaining,Edge.E(y,m,h,q,r,rq,source,destination,moves)::edges,count+1)
            }
            case _ => throw new IllegalArgumentException("edge row or exact finish/EOF")
        }
    }
    case Nil => throw new IllegalArgumentException("chain requires finish")
}
def readChain(raw: String): CalendarChain \ IO = match lines(raw) {
    case "cubistry.calendar7.chain.v1"::s::rest => match fields(s) {
        case "source"::root::ys::ms::hash::Nil => {
            let id=integer(root);let y=integer(ys);let m=integer(ms);let source=sha(hash);
            require(id>=1 and id<=91,"source root1..91");validMonth(y,m);
            CalendarChain.C(id,y,m,source,readEdges(rest,Nil,0))
        }
        case _ => throw new IllegalArgumentException("source row")
    }
    case _ => throw new IllegalArgumentException("chain header/source")
}
def stepPerm(step: Step,poses: Vector[Pose]): Perm \ IO = {
    let Step.M(g,q)=step;let p=generator(g,poses);
    if(q==1)p else if(q==2)compose(p,p)else inverse(p)
}
def inverseStep(step: Step): Step = {let Step.M(g,q)=step;Step.M(g,if(q==2)2 else -q)}
def directStep(step: Step,state: Vector[Sticker]): Vector[Sticker] \ IO = {
    let Step.M(g,q)=step;
    List.foldLeft((s,_) -> Vector.map(sticker -> directQuarter(sticker,g),s),state,List.range(0,if(q== -1)3 else q))
}
def fullDigest(state: Vector[Sticker]): String \ IO = digest(List.foldLeft((acc,s) -> {
    let Sticker.S(id,pid,pos,n,u,text,ink)=s;
    acc+"${id}\t${pid}\t${vecText(pos)}\t${vecText(n)}\t${vecText(u)}\t${text}\t${ink}\n"
},"",Vector.toList(state)))
def metrics(steps: List[Step]): (Int32,Int32,Int32,Int32) = {
    let htm=List.count(step -> {let Step.M(g,_)=step;Int32.modulo(g,7)!=0},steps);
    let rotations=List.length(steps)-htm;
    let qtm=List.foldLeft((n,step) -> {let Step.M(g,q)=step;n+(if(Int32.modulo(g,7)==0)0 else if(q==2)2 else 1)},0,steps);
    let rotationQtm=List.foldLeft((n,step) -> {let Step.M(g,q)=step;n+(if(Int32.modulo(g,7)!=0)0 else if(q==2)2 else 1)},0,steps);
    (htm,qtm,rotations,rotationQtm)
}
