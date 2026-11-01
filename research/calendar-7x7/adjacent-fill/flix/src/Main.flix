// Flix port of check_adjacent.jl (static capacity of adjacent-month display sets).
// Structural port: it reuses the unchanged English Core/Data modules (calendar,
// optics and inventory artwork classes, PR #99 target representatives).
import java.lang.{Exception,System,IllegalArgumentException}
import java.io.File
import java.nio.file.Files
import java.nio.charset.StandardCharsets

def read(path: String): String \ IO = Files.readString(new File(path).toPath(),StandardCharsets.UTF_8)
def adjKeys(): List[String] = List#{"lead","trail","six"}
def adjChoices(k: String): List[String] =
    if(k=="lead") List#{"blank","prev"} else if(k=="trail") List#{"blank","next"} else List#{"overflow","earlylate"}
def baselineSpec(): String = "lead=blank,trail=blank,six=overflow"
def parseAdj(spec: String): List[String] \ IO = {
    let parts=String.splitOn(substr=",",spec);
    require(List.length(parts)==3,"display set needs lead=..,trail=..,six=..");
    let choices=List.map(q -> {
        let(i,part)=q;
        match String.splitOn(substr="=",part) {
            case k::v::Nil => {
                require(k==at(adjKeys(),i),"unknown or misplaced display-set key");
                require(List.memberOf(v,adjChoices(k)),"unknown choice for display-set key");
                v
            }
            case _ => throw new IllegalArgumentException("unknown or misplaced display-set key")
        }
    },List.zipWithIndex(parts));
    require(not (at(choices,0)=="prev" and at(choices,2)=="overflow"),"incoherent: overflow marks need empty row-3 cells, so they cannot be combined with lead=prev");
    choices
}
def allAdj(): List[String] =
    List.flatMap(a -> List.flatMap(b -> List.map(c -> "lead=${a},trail=${b},six=${c}",adjChoices("six")),adjChoices("trail")),adjChoices("lead"))
def prevLength(y: Int32,m: Int32): Int32 = if(m==1) 31 else monthDays(y,m-1)
def isSix(y: Int32,m: Int32): Bool = (offset(y,m)+monthDays(y,m)-1)/7+1==6
def adjCell(ch: List[String],y: Int32,m: Int32,late: Bool,row: Int32,col: Int32): (String,String) \ IO = {
    if(row<=2 or (isSix(y,m) and at(ch,2)=="overflow")) goalCell(y,m,row,col)
    else {
        let off=offset(y,m);let n=monthDays(y,m);
        let k=7*(if(late) 1 else 0)+(row-3)*7+(col-1)-off+1;
        let ink=if(weekend(col)) "red" else "dark";
        if(k>=1 and k<=n) ("${k}",ink)
        else if(k<1) {if(at(ch,0)=="prev") ("${prevLength(y,m)+k}",ink) else ("","blank")}
        else {if(at(ch,1)=="next") ("${k-n}",ink) else ("","blank")}
    }
}
def adjBoard(ch: List[String],y: Int32,m: Int32,late: Bool): List[(String,String)] \ IO =
    List.map(p -> {let(r,c)=p;adjCell(ch,y,m,late,r,c)},cells())
// Distinct displays (first occurrence), number of PR #99 boards among them, months with two phases.
def adjDisplays(spec: String,reps: List[Goal]): (List[List[(String,String)]],Int32,Int32) \ IO = {
    let ch=parseAdj(spec);
    let all=List.flatMap(p -> {
        let(y,m)=p;
        if(isSix(y,m) and at(ch,2)=="earlylate") List#{adjBoard(ch,y,m,false),adjBoard(ch,y,m,true)} else List#{adjBoard(ch,y,m,false)}
    },calendarMonths());
    let boards=List.reverse(List.foldLeft((acc,b) -> if(List.memberOf(b,acc)) acc else b::acc,Nil,all));
    let old=List.map(goalBoard,reps);
    let unchanged=List.count(b -> List.memberOf(b,old),boards);
    let extra=List.count(p -> {let(y,m)=p;isSix(y,m) and at(ch,2)=="earlylate"},calendarMonths());
    (boards,unchanged,extra)
}
def orbitKeys(): List[(Int32,Int32)] \ IO = List.sort(List.distinct(List.map(p -> {let(r,c)=p;orbit(r,c)},cells())))
// Per orbit: (key, classes with peak, blank peak).
def adjOrbits(boards: List[List[(String,String)]]): List[((Int32,Int32),List[((String,Int32,String),Int32)],Int32)] \ IO =
    List.map(key -> {
        let perBoard=List.map(b -> {
            let inOrbit=List.filter(q -> {let((r,c),_)=q;orbit(r,c)==key},List.zip(cells(),b));
            let blanks=List.count(q -> {let(_,(t,_))=q;t==""},inOrbit);
            let arts=List.flatMap(q -> {let((r,c),(t,ink))=q;if(t=="") Nil else List#{lowerArt(t,ink,r,c)}},inOrbit);
            (arts,blanks)
        },boards);
        let classes=List.sort(List.distinct(List.flatMap(x -> {let(a,_)=x;a},perBoard)));
        let peaks=List.map(cls -> (cls,List.foldLeft((mx,x) -> {let(a,_)=x;Int32.max(mx,List.count(y -> y==cls,a))},0,perBoard)),classes);
        let blanks=List.foldLeft((mx,x) -> {let(_,z)=x;Int32.max(mx,z)},0,perBoard);
        (key,peaks,blanks)
    },orbitKeys())
def adjInventory(spec: String,reps: List[Goal],base: List[((Int32,Int32),List[((String,Int32,String),Int32)],Int32)]): Unit \ IO = {
    let(boards,unchanged,extra)=adjDisplays(spec,reps);
    let nb=List.length(boards);
    println("adjacent-displays\t${spec}\t${nb}\t${unchanged}\t${nb-unchanged}\t${extra}");
    let rows=List.map(q -> {
        let((x,y),peaks,blanks)=q;
        let need=List.foldLeft((a,p) -> {let(_,v)=p;a+v},0,peaks);
        let cap=if((x,y)==(0,0)) 6 else 24;let slack=cap-need-blanks;
        println("adjacent-orbit\t${spec}\t${x}\t${y}\t${need}\t${blanks}\t${cap}\t${slack}");
        let baseClasses=List.flatMap(bq -> {let(bk,bp,_)=bq;if(bk==(x,y)) List.map(p -> {let(c,_)=p;c},bp) else Nil},base);
        let mine=List.map(p -> {let(c,_)=p;c},peaks);
        List.forEach(p -> {
            let((g,a,ink),v)=p;
            if(List.memberOf((g,a,ink),baseClasses)) () else println("adjacent-newclass\t${spec}\t${x}\t${y}\t${g}\t${a}\t${ink}\t${v}")
        },peaks);
        List.forEach(c -> {
            let(g,a,ink)=c;
            if(List.memberOf(c,mine)) () else println("adjacent-goneclass\t${spec}\t${x}\t${y}\t${g}\t${a}\t${ink}")
        },baseClasses);
        (need,slack,"(${x},${y})")
    },adjOrbits(boards));
    let total=List.foldLeft((a,p) -> {let(n,_,_)=p;a+n},0,rows);
    let over=List.flatMap(p -> {let(_,s,k)=p;if(s<0) List#{k} else Nil},rows);
    let verdict=if(List.length(over)==0) "NOT_OBSTRUCTED" else "OBSTRUCTED";
    let overText=if(List.length(over)==0) "-" else List.foldLeft((a,k) -> if(a=="") k else a+" "+k,"",over);
    println("adjacent-inventory\t${spec}\t${total}\t${verdict}\t${List.length(over)}\t${overText}")
}
def baseOrbits(reps: List[Goal]): List[((Int32,Int32),List[((String,Int32,String),Int32)],Int32)] \ IO = {
    let(b,_,_)=adjDisplays(baselineSpec(),reps);adjOrbits(b)
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case "inventory"::spec::oldRoot::Nil => {
                let reps=representatives();validateTargets(read(oldRoot+"/targets.tsv"),reps);
                let _ = parseAdj(spec);
                adjInventory(spec,reps,baseOrbits(reps))
            }
            case "matrix"::oldRoot::Nil => {
                let reps=representatives();validateTargets(read(oldRoot+"/targets.tsv"),reps);
                let base=baseOrbits(reps);
                List.forEach(spec -> {
                    if(String.contains(substr="lead=prev",spec) and String.contains(substr="six=overflow",spec))
                        println("adjacent-incoherent\t${spec}\toverflow marks need empty row-3 cells")
                    else adjInventory(spec,reps,base)
                },allAdj())
            }
            case _ => throw new IllegalArgumentException("expected: inventory SPEC ORIGINAL_EVIDENCE | matrix ORIGINAL_EVIDENCE")
        }
    } catch {case ex: Exception => {println("invalid\t"+ex.toString());System.exit(1)}}
})
