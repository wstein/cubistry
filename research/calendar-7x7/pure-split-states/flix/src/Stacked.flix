// Copied from PR #145 (research/calendar7-stacked-dual-labels at 50fa8b2), dual-stacked/flix/src/Main.flix,
// with its main() removed; the source file's SHA-256 is recorded in ../../README.md.
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

// Mixed layouts "F31=<choice>,S30=<choice>,S31=<choice>"; see stacked_common.jl.
def mixTypes(): List[String] = List#{"F31","S30","S31"}
def mixChoices(t: String): List[String] =
    if(t=="F31") List#{"keep","bfold"} else if(t=="S30") List#{"keep","bfold","afold"} else List#{"keep","bfold","bfold30","afold","bfold31"}
// Optional month-letter placement "<mix>;H=<12 start columns 1..5>"; see stacked_common.jl.
def startDigit(c: Char): Int32 = if(c=='1') 1 else if(c=='2') 2 else if(c=='3') 3 else if(c=='4') 4 else 5
def headerStarts(variant: String): List[Int32] \ IO = match String.splitOn(substr=";",variant) {
    case _::Nil => List.map(m -> if(m<=9) 5 else 1,List.range(1,13))
    case _::h::Nil => match String.toList(h) {
        case 'H'::'='::rest => {
            require(List.length(rest)==12 and List.forAll(c -> List.memberOf(c,String.toList("12345")),rest),"month-letter placement must be H= and 12 start columns 1..5");
            List.map(startDigit,rest)
        }
        case _ => throw new IllegalArgumentException("month-letter placement must be H= and 12 start columns 1..5")
    }
    case _ => throw new IllegalArgumentException("at most one ';H=' suffix")
}
def baseVariant(variant: String): String = match String.splitOn(substr=";",variant) {case v::_ => v case Nil => variant}
def parseMix(variant: String): List[String] \ IO = {
    let _ = headerStarts(variant);
    let parts=String.splitOn(substr=",",baseVariant(variant));
    require(List.length(parts)==3,"mixed layout needs F31=..,S30=..,S31=..");
    List.map(q -> {
        let(i,part)=q;
        match String.splitOn(substr="=",part) {
            case k::v::Nil => {
                require(k==at(mixTypes(),i),"unknown or misplaced month type");
                require(List.memberOf(v,mixChoices(k)),"unknown choice for month type");
                v
            }
            case _ => throw new IllegalArgumentException("unknown or misplaced month type")
        }
    },List.zipWithIndex(parts))
}
def allMixes(): List[String] =
    List.append(
        List.flatMap(a -> List.flatMap(b -> List.map(c -> "F31=${a},S30=${b},S31=${c}",List.filter(c -> c != "bfold31",mixChoices("S31"))),mixChoices("S30")),mixChoices("F31")),
        List.flatMap(a -> List.map(b -> "F31=${a},S30=${b},S31=bfold31",mixChoices("S30")),mixChoices("F31")))
def pairsOf(variant: String): List[(Int32,Int32)] \ IO =
    if(variant=="A" or variant=="W") List#{(1,8),(24,31)}
    else if(variant=="B") List#{(23,30),(24,31)}
    else if(String.contains(substr="=",variant)) {
        let ch=parseMix(variant);let f=at(ch,0);let s30=at(ch,1);let s31=at(ch,2);
        let a=if(List.memberOf("afold",ch)) List#{(1,8)} else Nil;
        let b=if(s30=="bfold" or s31=="bfold" or s31=="bfold30") List#{(23,30)} else Nil;
        let c=if(f=="bfold" or s31=="bfold" or s31=="bfold31") List#{(24,31)} else Nil;
        List.append(List.append(a,b),c)
    }
    else throw new IllegalArgumentException("variant must be A, B, W or a mixed layout")
// Display style of one month: plain (five weeks), wrap, bottom, bottom30, top.
def monthStyle(variant: String,off: Int32,n: Int32): String \ IO =
    if((off+n-1)/7+1<=5) "plain"
    else {
        let kind=if(off==5 and n==31) 0 else if(off==6 and n==30) 1 else if(off==6 and n==31) 2 else -1;
        require(kind>=0,"unexpected six-week month");
        if(variant=="W") "wrap" else if(variant=="B") "bottom" else if(variant=="A") {if(off==6) "top" else "bottom"}
        else {
            let c=at(parseMix(variant),kind);
            if(c=="keep") "wrap" else if(c=="bfold") "bottom" else if(c=="bfold30") "bottom30" else if(c=="bfold31") "bottom31" else "top"
        }
    }

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
def placement(style: String,n: Int32,off: Int32,d: Int32): Option[(Int32,String)] = {
    let w=(off+d-1)/7;
    if(style=="plain") Some((w+3,"${d}"))
    else if(style=="top") {
        if(w==0) None else Some((w+2,if(d==8)"1/8" else "${d}"))
    } else if(w==5) {
        if((style=="bottom30" and d==31) or (style=="bottom31" and d==30)) Some((3,"${d}↶")) else None
    } else Some((w+3,if(w==4 and d+7<=n and not (style=="bottom30" and d+7==31) and not (style=="bottom31" and d+7==30))"${d}/${d+7}" else "${d}"))
}
def stackedCell(variant: String,y: Int32,m: Int32,row: Int32,col: Int32): (String,String) \ IO = {
    let off=offset(y,m);let n=monthDays(y,m);
    let style=monthStyle(variant,off,n);
    if(row==1 and String.contains(substr=";",variant)) {
        let st=at(headerStarts(variant),m-1);
        if(col>=st and col<=st+2) ("${at(String.toList(monthWord(m)),col-st)}","month") else ("","blank")
    }
    else if(row<=2 or style=="wrap") goalCell(y,m,row,col)
    else {
        let hits=List.flatMap(d -> match placement(style,n,off,d) {
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
        let Sticker.S(sid,_,_,_,up,text,ink)=at(hits,0);
        let angle=upAngle(up);
        if(stackedMatch(text,ink,angle,want,mode)) Nil else {
            let why=match stackedParse(text) {
                case None => "plain-mismatch"
                case Some(_) => if(angle != 0 and stackedMatch(text,ink,0,want,mode)) "stacked-not-upright" else "stacked-mismatch"
            };
            List#{"${r},${c}\t${sid}\t${angle}\t${why}"}
        }
    },List.zip(cells(),board));
    match failing {case x::_ => x case Nil => "-\t-\t-\t-"}
}
def contextUses(state: Vector[Sticker],board: List[(String,String)]): Int32 \ IO =
    List.count(q -> {
        let((r,c),(want,_))=q;
        let hits=List.filter(s -> {let Sticker.S(_,_,p,n,_,_,_)=s;p==(c-4,4-r,3) and n==(0,0,1)},Vector.toList(state));
        require(List.length(hits)==1,"one physical front surface per cell");
        let Sticker.S(_,_,_,_,_,text,_)=at(hits,0);
        match stackedParse(text) {case Some(_) => text != want case None => false}
    },List.zip(cells(),board))
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
    let oldBoards=List.map(p -> {let(yy,mm)=p;goalBoard(goal(yy,mm))},calendarMonths());
    let months=List.map(rep -> List.count(b -> b==goalBoard(rep),oldBoards),reps);
    println("stacked-profile\t${variant}\t${mode}\t888\t91\t${folded}");
    List.forEach(q -> {
        let(i,g)=q;let Goal.G(y,m,board)=g;
        List.forEach(e -> {
            let((r,c),(t,ink))=e;
            match stackedParse(t) {
                case Some(_) => println("stacked-fold\t${i+1}\t${y}\t${m}\t${at(months,i)}\t${r},${c}\t${t}\t${ink}")
                case None => ()
            }
        },List.zip(cells(),board))
    },List.zipWithIndex(goals));
    println("stacked-print\t${printed}\t${294-printed}\t${blanked}\t${stacked}");
    let lower=inventoryLowerBound(goals);
    println("stacked-lower-bound-strict\t${variant}\t${lower}");
    let results=readDag(read(dagPath),poses,true);
    let outcomes=List.map(id -> {
        let p=match Map.get(id,results){case Some(value)=>value case None=>throw new IllegalArgumentException("missing complete target")};
        let state=liftState(p,source,poses);let Goal.G(y,m,board)=at(goals,id-1);
        let cell=frontFailure(state,board,mode);
        let uses=contextUses(state,board);
        let shown=List.flatMap(s -> {let Sticker.S(sid,_,_,n,_,_,_)=s;if(n==(0,0,1)) List#{sid} else Nil},Vector.toList(state));
        let status=if(cell=="-\t-\t-\t-")"PASS" else "FAIL";
        println("stacked-target\t${id}\t${y}\t${m}\t${status}\t${cell}\t${at(months,id-1)}\t${uses}\t${stackSha(stateText(state))}");
        (id,cell=="-\t-\t-\t-",shown)
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
// Inventory obstruction for ANY print (necessary condition); see stacked_inventory in Julia.
def invGroup(g: String,ink: String,r: Int32,c: Int32,variant: String,mode: String): String \ IO = {
    let t=String.replace(src="I",dst="1",String.replace(src="O",dst="0",g));
    let hits=if(mode=="context") List.filter(p -> {let(a,b)=p;t=="${a}" or t=="${b}" or t=="${a}/${b}"},pairsOf(variant)) else Nil;
    match hits {
        case (a,b)::_ => "pair\t${a}\t${b}\t${ink}"
        case Nil => {let(x,q,i)=lowerArt(g,ink,r,c);"art\t${x}\t${q}\t${i}"}
    }
}
def stackedInventory(variant: String,mode: String,oldRoot: String,showClasses: Bool): Unit \ IO = {
    require(mode=="strict" or mode=="context","mode must be strict or context");
    let _ = pairsOf(variant);
    let reps=representatives();validateTargets(read(oldRoot+"/targets.tsv"),reps);
    let goals=stackedGoals(variant,reps);
    let keys=List.sort(List.distinct(List.map(p -> {let(r,c)=p;orbit(r,c)},cells())));
    let rows=List.map(key -> {
        let perGoal=List.map(g -> {
            let inOrbit=List.filter(q -> {let((r,c),_)=q;orbit(r,c)==key},List.zip(cells(),goalBoard(g)));
            let blanks=List.count(q -> {let(_,(t,_))=q;t==""},inOrbit);
            let groups=List.flatMap(q -> {let((r,c),(t,ink))=q;if(t=="") Nil else List#{invGroup(t,ink,r,c,variant,mode)}},inOrbit);
            (groups,blanks)
        },goals);
        let classes=List.sort(List.distinct(List.flatMap(x -> {let(gs,_)=x;gs},perGoal)));
        let need=List.foldLeft((acc,cls) -> acc+List.foldLeft((m,x) -> {let(gs,_)=x;Int32.max(m,List.count(y -> y==cls,gs))},0,perGoal),0,classes);
        let blanks=List.foldLeft((m,x) -> {let(_,b)=x;Int32.max(m,b)},0,perGoal);
        let cap=if(key==(0,0))6 else 24;let slack=cap-need-blanks;let(x,y)=key;
        println("stacked-orbit\t${variant}\t${mode}\t${x}\t${y}\t${need}\t${blanks}\t${cap}\t${slack}");
        if(showClasses) List.forEach(cls -> {
            let peak=List.foldLeft((m,z) -> {let(gs,_)=z;Int32.max(m,List.count(w -> w==cls,gs))},0,perGoal);
            println("stacked-class\t${variant}\t${mode}\t${x}\t${y}\t${cls}\t${peak}")
        },classes) else ();
        (need,slack,"(${x},${y})")
    },keys);
    let total=List.foldLeft((a,p) -> {let(n,_,_)=p;a+n},0,rows);
    let negative=List.count(p -> {let(_,s,_)=p;s<0},rows);
    let over=List.flatMap(p -> {let(_,s,k)=p;if(s<0) List#{k} else Nil},rows);
    let overText=if(List.length(over)==0) "-" else List.foldLeft((a,k) -> if(a=="") k else a+" "+k,"",over);
    let core=List.sort(List.distinct(List.map(g -> {let(t,_)=at(goalBoard(g),24);t},goals)));
    println("stacked-core-cell\t${variant}\t${List.foldLeft((a,t) -> if(a=="") t else a+","+t,"",core)}");
    let verdict=if(negative==0)"NOT_OBSTRUCTED" else "OBSTRUCTED";
    println("stacked-inventory\t${variant}\t${mode}\t${total}\t${verdict}\t${negative}\t${overText}")
}
