// Flix port of the stacked dual-label checker. Structural port of check_stacked.jl:
// it reuses the unchanged English Core/Data/Dag modules (calendar, optics, print
// reader, pose action, legal DAG replay) and re-implements only the new semantics.
import java.lang.{Exception,System,IllegalArgumentException}
import java.io.File
import java.nio.file.Files
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.HexFormat

def read(path: String): String \ IO = Files.readString(new File(path).toPath(),StandardCharsets.UTF_8)
def stackSha(text: String): String \ IO = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)))

def pairsOf(variant: String): List[(Int32,Int32)] \ IO =
    if(variant=="A" or variant=="W") List#{(1,8),(24,31)}
    else if(variant=="B") List#{(23,30),(24,31)}
    else throw new IllegalArgumentException("variant must be A, B or W")

// "a/b" with a,b written as 1..99 without leading zeros; anything else is not stacked.
def datePart(s: String): Option[Int32] = {
    let cs=String.toList(s);
    let digits=List.forAll(c -> List.memberOf(c,String.toList("0123456789")),cs);
    if(List.length(cs)<1 or List.length(cs)>2 or not digits) None
    else match cs {
        case '0'::_ => None
        case _ => Int32.fromString(s)
    }
}
def stackedParse(text: String): Option[(Int32,Int32)] = match String.splitOn(substr="/",text) {
    case a::b::Nil => match (datePart(a),datePart(b)) {
        case (Some(x),Some(y)) => Some((x,y))
        case _ => None
    }
    case _ => None
}

// Where one date of month (y,m) lands on the new front, if anywhere: (row,text).
def placement(variant: String,off: Int32,n: Int32,d: Int32): Option[(Int32,String)] = {
    let w=(off+d-1)/7;let weeks=(off+n-1)/7+1;
    if(weeks<=5) Some((w+3,"${d}"))
    else if(variant=="A" and off==6) {
        if(w==0) None else Some((w+2,if(d==8)"1/8" else "${d}"))
    } else {
        if(w==5) None else Some((w+3,if(w==4 and d+7<=n)"${d}/${d+7}" else "${d}"))
    }
}
def stackedCell(variant: String,y: Int32,m: Int32,row: Int32,col: Int32): (String,String) \ IO = {
    if(row<=2 or variant=="W") goalCell(y,m,row,col)
    else {
        let off=offset(y,m);let n=monthDays(y,m);
        let hits=List.flatMap(d -> match placement(variant,off,n,d) {
            case Some((r,text)) => if(r==row and Int32.modulo(off+d-1,7)+1==col) List#{text} else Nil
            case None => Nil
        },List.range(1,n+1));
        match hits {
            case Nil => ("","blank")
            case text::Nil => {
                match stackedParse(text) {
                    case Some(p) => require(List.memberOf(p,pairsOf(variant)),"fold produced an undeclared pair")
                    case None => ()
                };
                (text,if(weekend(col))"red" else "dark")
            }
            case _ => throw new IllegalArgumentException("fold collision")
        }
    }
}
def stackedBoard(variant: String,y: Int32,m: Int32): List[(String,String)] \ IO =
    List.map(p -> {let(r,c)=p;stackedCell(variant,y,m,r,c)},cells())

// 888 months -> the 91 PR #99 representatives; returns the 91 new goals in that order.
def stackedGoals(variant: String,reps: List[Goal]): List[Goal] \ IO = {
    let pairsSeen=List.map(p -> {
        let(y,m)=p;let old=goalBoard(goal(y,m));
        let ids=List.flatMap(q -> {let(i,g)=q;if(goalBoard(g)==old) List#{i} else Nil},List.zipWithIndex(reps));
        require(List.length(ids)==1,"each month maps to exactly one PR99 representative");
        (at(ids,0),stackedBoard(variant,y,m))
    },calendarMonths());
    require(List.length(pairsSeen)==888,"888 months");
    let goals=List.map(q -> {
        let(i,g)=q;let Goal.G(y,m,_)=g;
        let boards=List.distinct(List.flatMap(e -> {let(j,b)=e;if(j==i) List#{b} else Nil},pairsSeen));
        require(List.length(boards)==1,"one PR99 representative maps to exactly one new board");
        Goal.G(y,m,at(boards,0))
    },List.zipWithIndex(reps));
    require(List.length(List.distinct(List.map(goalBoard,goals)))==91,"new boards must be distinct");
    goals
}

def pairedDate(text: String,variant: String): Bool \ IO =
    List.exists(p -> {let(a,b)=p;text=="${a}" or text=="${b}"},pairsOf(variant))
def stackedPrint(raw: String,oldRaw: String,variant: String): (Vector[Sticker],Int32,Int32,Int32) \ IO = {
    require(stackSha(oldRaw)=="b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931","unchanged PR99 printing provenance");
    let source=readPrint(raw);let old=readPrint(oldRaw);
    let changes=List.map(index -> {
        let Sticker.S(id,piece,pos,n,u,g,ink)=Vector.get(index,source);
        let Sticker.S(oid,opiece,opos,on,ou,og,oink)=Vector.get(index,old);
        require((id,piece,pos,n,u)==(oid,opiece,opos,on,ou),"surface identity or frame changed");
        if((g,ink)==(og,oink)) 0
        else if(g=="") {
            require(String.contains(substr="↶",og) or pairedDate(og,variant),"only overflow or paired-date surfaces may become blank");1
        } else match stackedParse(g) {
            case Some((a,b)) => {
                require(List.memberOf((a,b),pairsOf(variant)),"undeclared artwork change");
                require((og=="${a}" or og=="${b}") and ink==oink,"stacked surface must replace one of its own dates in the same ink");2
            }
            case None => throw new IllegalArgumentException("undeclared artwork change")
        }
    },List.range(0,294));
    let printed=List.count(s -> {let Sticker.S(_,_,_,_,_,g,_)=s;g != ""},Vector.toList(source));
    (source,printed,List.count(x -> x==1,changes),List.count(x -> x==2,changes))
}

def stackedMatch(text: String,ink: String,angle: Int32,want: (String,String),mode: String): Bool \ IO = {
    let(g,wantInk)=want;
    match stackedParse(text) {
        case Some((a,b)) => angle==0 and ink==wantInk and (g==text or (mode=="context" and (g=="${a}" or g=="${b}")))
        case None => optic(text,angle,ink)==optic(g,0,wantInk)
    }
}
def frontFailure(state: Vector[Sticker],board: List[(String,String)],mode: String): String \ IO = {
    let failing=List.flatMap(q -> {
        let((r,c),want)=q;
        let hits=List.filter(s -> {let Sticker.S(_,_,p,n,_,_,_)=s;p==(c-4,4-r,3) and n==(0,0,1)},Vector.toList(state));
        require(List.length(hits)==1,"one physical front surface per cell");
        let Sticker.S(_,_,_,_,up,text,ink)=at(hits,0);
        if(stackedMatch(text,ink,upAngle(up),want,mode)) Nil else List#{"${r},${c}"}
    },List.zip(cells(),board));
    match failing {case x::_ => x case Nil => "-"}
}
def stateText(state: Vector[Sticker]): String = List.foldLeft((acc,s) -> {
    let Sticker.S(id,pid,pos,n,u,text,ink)=s;
    acc+"${id}\t${pid}\t${vecText(pos)}\t${vecText(n)}\t${vecText(u)}\t${text}\t${ink}\n"
},"",Vector.toList(state))

def checkStacked(printPath: String,dagPath: String,variant: String,mode: String,oldRoot: String,geometry: String): Unit \ IO = {
    require(mode=="strict" or mode=="context","mode must be strict or context");
    let _ = pairsOf(variant);
    let poses=derivedPoses();let reps=representatives();
    validatePoseFile(read(geometry+"/pose-points.tsv"),poses);validateMoves(read(geometry+"/moves.tsv"));validateTargets(read(oldRoot+"/targets.tsv"),reps);
    let goals=stackedGoals(variant,reps);
    let(source,printed,blanked,stacked)=stackedPrint(read(printPath),read(oldRoot+"/physical-print.tsv"),variant);
    let folded=List.count(g -> List.exists(cell -> {let(t,_)=cell;(match stackedParse(t) {case Some(_) => true case None => false})},goalBoard(g)),goals);
    println("stacked-profile\t${variant}\t${mode}\t888\t91\t${folded}");
    println("stacked-print\t${printed}\t${294-printed}\t${blanked}\t${stacked}");
    let lower=inventoryLowerBound(goals);
    println("stacked-lower-bound-strict\t${variant}\t${lower}");
    let results=readDag(read(dagPath),poses,true);
    let outcomes=List.map(id -> {
        let p=match Map.get(id,results){case Some(value)=>value case None=>throw new IllegalArgumentException("missing complete target")};
        let state=liftState(p,source,poses);let Goal.G(y,m,board)=at(goals,id-1);
        let cell=frontFailure(state,board,mode);
        let shown=List.flatMap(s -> {let Sticker.S(sid,_,_,n,_,_,_)=s;if(n==(0,0,1)) List#{sid} else Nil},Vector.toList(state));
        let status=if(cell=="-")"PASS" else "FAIL";
        println("stacked-target\t${id}\t${y}\t${m}\t${status}\t${cell}\t${stackSha(stateText(state))}");
        (id,cell=="-",shown)
    },List.range(1,92));
    let shownAll=List.distinct(List.flatMap(o -> {let(_,_,s)=o;s},outcomes));
    let hidden=List.count(s -> {let Sticker.S(sid,_,_,_,_,g,_)=s;g != "" and not List.memberOf(sid,shownAll)},Vector.toList(source));
    println("stacked-printed-never-on-front\t${hidden}");
    let failed=List.flatMap(o -> {let(id,ok,_)=o;if(ok) Nil else List#{id}},outcomes);
    let nf=List.length(failed);
    let verdict=if(nf==0)"ACCEPT" else "REJECT";
    println("stacked-summary\t${verdict}\t${variant}\t${mode}\t${91-nf}\t${nf}\t${printed}");
    require(nf==0,"${nf} of 91 legal DAG states fail the stacked front")
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case printing::dag::variant::mode::oldRoot::geometry::Nil => checkStacked(printing,dag,variant,mode,oldRoot,geometry)
            case _ => throw new IllegalArgumentException("PRINT DAG VARIANT MODE ORIGINAL_EVIDENCE GEOMETRY")
        }
    } catch {case ex: Exception => {println("invalid\t"+ex.toString());System.exit(1)}}
})
