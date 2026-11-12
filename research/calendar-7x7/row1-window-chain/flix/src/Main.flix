// SPDX-License-Identifier: AGPL-3.0-or-later
// Independent native direct294/pose264 retained-state chain replay.
import java.lang.{Exception, IllegalArgumentException, System}

// E(year,month,metrics,source,end,moves,wrong cells,Hall sets); wrong cells and Hall sets exist only in chain v2.
enum WEdge { case E(Int32,Int32,(Int32,Int32,Int32,Int32),String,String,List[(Int32,Int32)],List[(Int32,Int32)],List[List[(Int32,Int32)]]) }
def cellIdx(cell: (Int32,Int32)): Int32 = {let(r,c)=cell;r*7+c}
def cellsIncreasing(cs: List[(Int32,Int32)]): Bool =
    if(List.length(cs)<2) true else List.forAll(p -> {let(a,b)=p;cellIdx(a)<cellIdx(b)},List.zip(List.take(List.length(cs)-1,cs),List.drop(1,cs)))
def cellOk(cell: (Int32,Int32)): Bool = {let(r,c)=cell;r>=1 and r<=7 and c>=1 and c<=7}
def cellsText(cs: List[(Int32,Int32)]): String = List.foldLeft((acc,p) -> {let(i,cell)=p;let(r,c)=cell;acc+(if(i==0) "" else ";")+"${r},${c}"},"",List.zipWithIndex(cs))
// optional "wrong" and "hall" records (v2 only) between the edge line and its moves
def wExtras(v2: Bool,rows: List[String],wrong: List[(Int32,Int32)],halls: List[List[(Int32,Int32)]]): (List[(Int32,Int32)],List[List[(Int32,Int32)]],List[String]) \ IO = match rows {
    case line::rest => match fields(line) {
        case "wrong"::rr::cc::Nil => {
            require(v2,"edge record");require(halls==Nil,"wrong record after hall record");let cell=(integer(rr),integer(cc));
            require(cellOk(cell) and cellsIncreasing(List.append(wrong,cell::Nil)),"wrong cells strictly increasing in the 7x7 front");
            wExtras(v2,rest,List.append(wrong,cell::Nil),halls)
        }
        case "hall"::cs::Nil => {
            require(v2,"edge record");
            let cells=List.map(t -> match String.splitOn(substr=",",t) {
                case a::b::Nil => (integer(a),integer(b))
                case _ => throw new IllegalArgumentException("hall cell")
            },String.splitOn(substr=";",cs));
            require(List.forAll(cellOk,cells) and cellsIncreasing(cells),"hall cells strictly increasing in the 7x7 front");
            wExtras(v2,rest,wrong,List.append(halls,cells::Nil))
        }
        case _ => (wrong,halls,rows)
    }
    case Nil => (wrong,halls,rows)
}
// Window end "YYYY-MM" from May 2026 to January 2100 as the month count from May 2026.
def wEnd(text: String): Int32 \ IO = {
    let digits=List.append(String.toList(String.slice(start=0,end=4,text)),String.toList(String.slice(start=5,end=7,text)));
    require(String.length(text)==7 and String.slice(start=4,end=5,text)=="-" and List.forAll(c -> List.memberOf(c,String.toList("0123456789")),digits),"window end is YYYY-MM");
    let y=match Int32.fromString(String.slice(start=0,end=4,text)) {case Some(n) => n case None => 0};
    let m=match Int32.fromString(String.slice(start=5,end=7,text)) {case Some(n) => n case None => 0};
    let n=(y-2026)*12+m-4;
    require(m>=1 and m<=12 and n>=1 and (y<2100 or (y==2100 and m==1)),"window end lies within May 2026 to January 2100");
    n
}
def wHash(s: String): Bool = String.length(s)==64 and List.forAll(c -> List.memberOf(c,String.toList("0123456789abcdef")),String.toList(s))
def wMoves(rows: List[String],acc: List[(Int32,Int32)]): (List[(Int32,Int32)],List[String]) \ IO = match rows {
    case "end"::rest => (List.reverse(acc),rest)
    case line::rest => match fields(line) {
        case "move"::gg::qq::Nil => {
            let g=integer(gg);let q=integer(qq);
            require(g>=1 and g<=21 and List.memberOf(q,List#{-1,1,2}),"legal generator and exponent; no middle slice");
            require(List.length(acc)<100000,"bounded edge moves");wMoves(rest,(g,q)::acc)
        }
        case _ => throw new IllegalArgumentException("move record")
    }
    case Nil => throw new IllegalArgumentException("missing edge end")
}
def wEdges(v2: Bool,count: Int32,rows: List[String],acc: List[WEdge]): List[WEdge] \ IO = match rows {
    case "finish"::Nil => {require(List.length(acc)==count-1,"exactly ${count-1} chronological edges");List.reverse(acc)}
    case line::rest => match fields(line) {
        case "edge"::yy::mm::hh::qq::rr::rq::sh::eh::Nil => {
            let y=integer(yy);let m=integer(mm);let h=integer(hh);let q=integer(qq);let r=integer(rr);let rotq=integer(rq);
            require(h>=0 and h<=100000 and q>=0 and q<=200000 and r>=0 and r<=100000 and rotq>=0 and rotq<=200000,"bounded nonnegative metrics");
            require(wHash(sh) and wHash(eh),"canonical edge digest");
            let(wrong,halls,afterExtras)=wExtras(v2,rest,Nil,Nil);
            let(moves,remaining)=wMoves(afterExtras,Nil);require(List.length(acc)<count-1,"at most ${count-1} edges");
            wEdges(v2,count,remaining,WEdge.E(y,m,(h,q,r,rotq),sh,eh,moves,wrong,halls)::acc)
        }
        case _ => throw new IllegalArgumentException("edge record")
    }
    case Nil => throw new IllegalArgumentException("missing chain finish")
}
// Free-start block of chain.v3: "start\tN" followed by N move records (the moves from the identity pose to the first state).
def wTake(n: Int32,rows: List[String],acc: List[(Int32,Int32)]): (List[(Int32,Int32)],List[String]) \ IO =
    if(n==0) (List.reverse(acc),rows) else match rows {
        case line::rest => match fields(line) {
            case "move"::gg::qq::Nil => {
                let g=integer(gg);let q=integer(qq);
                require(g>=1 and g<=21 and List.memberOf(q,List#{-1,1,2}),"legal start move");wTake(n-1,rest,(g,q)::acc)
            }
            case _ => throw new IllegalArgumentException("start move record")
        }
        case Nil => throw new IllegalArgumentException("start moves")
    }
def wStart(v3: Bool,rows: List[String]): (Option[List[(Int32,Int32)]],List[String]) \ IO = match rows {
    case line::rest => match fields(line) {
        case "start"::nn::Nil => {
            require(v3,"free start block needs chain.v3");let n=integer(nn);require(n>=0 and n<=100000,"bounded start moves");
            let(ms,remaining)=wTake(n,rest,Nil);(Some(ms),remaining)
        }
        case _ => (None,rows)
    }
    case Nil => (None,rows)
}
def wRead(count: Int32,raw: String,start: (Int32,Int32)): (String,List[WEdge],Bool,Option[List[(Int32,Int32)]]) \ IO = {
    require(String.length(raw)<=16000000,"bounded chain input");
    match lines(raw) {
        case header::source::rest => match fields(source) {
            case "source"::r::y::m::h::Nil => {
                let(sy,sm)=start;require((integer(r),integer(y),integer(m))==(sm,sy,sm),"identity root record is the root month");require(wHash(h),"root digest");
                require(header=="cubistry.calendar7.chain.v1" or header=="cubistry.calendar7.chain.v2" or header=="cubistry.calendar7.chain.v3","chain header and trailer");
                let v2=header != "cubistry.calendar7.chain.v1";
                let(startMoves,afterStart)=wStart(header=="cubistry.calendar7.chain.v3",rest);
                let edges=wEdges(v2,count,afterStart,Nil);
                let total=List.foldLeft((n,e) -> {let WEdge.E(_,_,_,_,_,moves,_,_)=e;n+List.length(moves)},0,edges);
                require(total<=100000,"bounded total moves");(h,edges,v2,startMoves)
            }
            case _ => throw new IllegalArgumentException("source record")
        }
        case _ => throw new IllegalArgumentException("chain header and trailer")
    }
}
// Cells (row,column) of the front that do not show the board (strict optics); empty for an exact month.
def wMismatch(st: Vector[Sticker],g: Goal): List[(Int32,Int32)] \ IO = List.filter(cell -> {
    let(r,c)=cell;
    let found=List.filter(s -> {let Sticker.S(_,_,p,n,_,_,_)=s;p==(c-4,4-r,3) and n==(0,0,1)},Vector.toList(st));
    require(List.length(found)==1,"one front sticker per cell");
    let Sticker.S(_,_,_,_,u,text,ink)=at(found,0);let(t,wi)=at(goalBoard(g),(r-1)*7+c-1);
    coupledOptic(text,upAngle(u),ink) != coupledOptic(t,0,wi)
},cells())
// Body h can serve a front cell exactly: some rigid rotation brings it to the cell and its visible face shows the wanted art.
def wServe(src: List[Sticker],h: Vec,pos: Vec,want: (String,String)): Bool \ IO = List.exists(rot -> {
    if(rotate(h,rot) != pos) false else {
        let faces=List.filter(s -> {let Sticker.S(_,_,sh,n,_,_,_)=s;sh==h and rotate(n,rot)==(0,0,1)},src);
        match faces {
            case s::Nil => {
                let Sticker.S(_,_,_,_,u,text,ink)=s;let(t,wi)=want;
                coupledOptic(text,upAngle(rotate(u,rot)),ink)==coupledOptic(t,0,wi)
            }
            case _ => false
        }
    }
},rotations())
// Hall witnesses (see check.jl): sets X of one body class with |X|-|N(X)| = number of wrong cells inside X; disjoint; they cover all wrong cells.
def wHall(source: Vector[Sticker],g: Goal,wrong: List[(Int32,Int32)],halls: List[List[(Int32,Int32)]]): Unit \ IO = {
    require(halls != Nil,"best-effort month needs Hall witnesses");
    let src=Vector.toList(source);
    let used=List.foldLeft((acc,x) -> {
        require(x != Nil and List.forAll(cell -> not List.memberOf(cell,acc),x),"disjoint nonempty Hall sets");
        let keys=List.distinct(List.map(cell -> {let(r,c)=cell;bodyKey((c-4,4-r,3))},x));
        require(List.length(keys)==1,"Hall set inside one body class");
        let hs=List.filter(h -> bodyKey(h)==at(keys,0),homes());
        let n=List.count(h -> List.exists(cell -> {let(r,c)=cell;wServe(src,h,(c-4,4-r,3),at(goalBoard(g),(r-1)*7+c-1))},x),hs);
        let d=List.length(x)-n;
        require(d>=1,"Hall set has a deficiency");
        require(List.count(w -> List.memberOf(w,x),wrong)==d,"wrong cells in a Hall set equal its deficiency");
        List.append(acc,x)
    },Nil,halls);
    require(List.forAll(w -> List.memberOf(w,used),wrong),"Hall sets cover every wrong cell")
}
// The 29 rule (argument 29 after the junction digests; CAL7_BEST_EFFORT_29=1 in the Julia checkers): the best-effort edge has exactly one wrong cell, (7,1) or (7,7),
// and its front sticker shows the digit 29 (text 29, ink red, upright).
def w29(st: Vector[Sticker],wrong: List[(Int32,Int32)]): Unit \ IO = {
    require(wrong==(7,1)::Nil or wrong==(7,7)::Nil,"best-effort wrong cell shows the digit 29: one wrong cell, (7,1) or (7,7)");
    let(r,c)=at(wrong,0);
    let found=List.filter(s -> {let Sticker.S(_,_,p,n,_,_,_)=s;p==(c-4,4-r,3) and n==(0,0,1)},Vector.toList(st));
    require(List.length(found)==1,"one front sticker per cell");
    let Sticker.S(_,_,_,_,u,text,ink)=at(found,0);
    require(text=="29" and ink=="red" and upAngle(u)==0,"best-effort wrong cell shows the digit 29: text 29, ink red, upright")
}
def wMove(st: Vector[Sticker],g: Int32,q: Int32): Vector[Sticker] \ IO =
    List.foldLeft((s,_) -> Vector.map(x -> directQuarter(x,g),s),st,List.range(0,if(q== -1)3 else q))
def wPose(p: Perm,g: Int32,q: Int32,gens: List[Perm]): Perm \ IO =
    List.foldLeft((s,_) -> compose(s,at(gens,g-1)),p,List.range(0,if(q== -1)3 else q))
def wInverse(q: Int32): Int32 = if(q==2)2 else -q
def wText(st: Vector[Sticker]): String = List.foldLeft((acc,s) -> {
    let Sticker.S(id,pid,p,n,u,g,ink)=s;
    acc+"${id}\t${pid}\t${vecText(p)}\t${vecText(n)}\t${vecText(u)}\t${g}\t${ink}\n"
},"",Vector.toList(st))
def wFront(st: Vector[Sticker],g: Goal): Bool \ IO = List.forAll(cell -> {
    let(r,c)=cell;
    let found=List.filter(s -> {let Sticker.S(_,_,p,n,_,_,_)=s;p==(c-4,4-r,3) and n==(0,0,1)},Vector.toList(st));
    if(List.length(found)!=1) false else {
        let Sticker.S(_,_,_,_,u,text,ink)=at(found,0);let(t,wi)=at(goalBoard(g),(r-1)*7+c-1);
        coupledOptic(text,upAngle(u),ink)==coupledOptic(t,0,wi)
    }
},cells())
def wSelf(st: Vector[Sticker],g: Goal,poses: Vector[Pose],gens: List[Perm],pose0: Perm,src: Vector[Sticker]): Unit \ IO = {
    // the first of the start month: first board cell with text "1"
    let ones=List.filter(p -> {let(_,x)=p;let(t,_)=x;t=="1"},List.zipWithIndex(goalBoard(g)));
let oneIndex=match ones {case (i,_)::_ => i case Nil => throw new IllegalArgumentException("start month shows a 1")};
    let onePos=(Int32.modulo(oneIndex,7)-3,4-(oneIndex/7+1),3);
    List.forEach(index -> List.forEach(q -> {
        let s=wMove(st,index,q);let p=wPose(pose0,index,q,gens);
        require(s==liftState(p,src,poses),"single-move direct294/pose264 agreement");
        require(wMove(s,index,wInverse(q))==st,"single-move inverse")
    },List#{-1,1,2}),List.range(1,22));
    let badOne=Vector.map(s -> {let Sticker.S(id,p,p0,n,u,text,ink)=s;
        if(p0==onePos and n==(0,0,1)) Sticker.S(id,p,p0,n,scale(-1,u),text,ink) else s
    },st);
    require(not wFront(badOne,g),"strict upside-down one rejected");
    let aliased=Vector.map(s -> {let Sticker.S(id,p,p0,n,u,_,ink)=s;
        if(p0==onePos and n==(0,0,1)) Sticker.S(id,p,p0,n,u,"I",ink) else s
    },st);
    require(not wFront(aliased,g),"I is not one");
    let band=Vector.map(s -> {let Sticker.S(id,p,p0,n,_,text,ink)=s;
        if(p0==(3,3,3) and n==(0,0,1)) Sticker.S(id,p,p0,n,(-1,0,0),text,ink) else s
    },st);
    require(not wFront(band,g),"band quarter turn rejected");
    let blank=Vector.map(s -> {let Sticker.S(id,p,p0,n,u,text,_)=s;
        if(p0==(3,3,3) and n==(0,0,1)) Sticker.S(id,p,p0,n,u,text,"blank") else s
    },st);
    require(not wFront(blank,g),"band is not blank");
    println("selfcheck\t63\tdirect-pose-inverse\t4\tstrict-optics\tPASS")
}
def wMetrics(moves: List[(Int32,Int32)]): (Int32,Int32,Int32,Int32) = List.foldLeft((acc,m) -> {
    let(h,q,r,rq)=acc;let(g,e)=m;
    if(Int32.modulo(g,7)==0)(h,q,r+1,rq+Int32.abs(e)) else(h+1,q+Int32.abs(e),r,rq)
},(0,0,0,0),moves)
// monthsFile "" selects the window end endText; otherwise the explicit month list (the chain root is rootText, default its first month) pinned by monthsPin.
// layoutPin "" keeps the built-in layout pin; a window-local layout is pinned by passing its SHA-256.
// rootText "" keeps the first month of the list as the root; otherwise it is the root month YYYY-MM (1900-01 .. 2100-01) whose board the
// identity pose shows; if it differs from the first member of the list the chain gets one extra root edge from the identity pose to it.
// joinStart / joinEnd: "" for none, else 64 hex or "identity": the digest the start (end) state of the chain must have (stage junction).
def wJoin(t: String): String \ IO = {require(t=="" or t=="identity" or wHash(t),"junction digest is 64 hex or identity");t}
def wVerify(layout: String,printing: String,chain: String,states: String,oldRoot: String,endText: String,printPin: String,monthsFile: String,monthsPin: String,layoutPin: String,rootText: String,joinStart: String,joinEnd: String,rule: String): Unit \ IO = {
    require(rule=="" or rule=="29","rule is 29 or empty");require(wJoin(joinStart)==joinStart and wJoin(joinEnd)==joinEnd,"junction digests are checked");
    let rawLayout=read(layout);let rawPrint=read(printing);let rawChain=read(chain);
    let layoutSHA=if(layoutPin=="" or layoutPin=="-") "c5671d7551295fc62dff5cf73fce31bfd774ee90865e7dc384b073d0b22844db" else layoutPin;
    let listed=if(monthsFile=="") Nil else monthListRead(monthsFile,monthsPin);
    require(rootText=="" or monthsFile != "","a root month other than the first member needs a month list");
    let rootMonth=if(rootText=="") (if(monthsFile=="") (2026,5) else at(listed,0)) else monthRowFrom(rootText,monthIndex((1900,1)),"root month lies within 1900-01 to 2100-01","root month is YYYY-MM");
    let rooted=monthsFile != "" and rootMonth != at(listed,0);
    let chainMonths=if(rooted) rootMonth::listed else listed;
    let count=if(monthsFile=="") wEnd(endText) else List.length(chainMonths);
    // The 21-month print stays pinned; a longer window needs its own print SHA-256 as the last argument.
    let printSHA=if(monthsFile=="" and endText=="2028-01")"0cb44a28c4bf84c25616fc248f9565df2e49e41feb479225e43166b1b8a2d127" else printPin;
    require(stackSha(rawLayout)==layoutSHA,"new layout pin");require(stackSha(rawPrint)==printSHA,"new immutable print pin");
    let goals=if(monthsFile=="") coupledGoalsN(coupledLabels(rawLayout),"names-band","window",oldRoot,count) else coupledGoalsM(coupledLabels(rawLayout),"names-band",oldRoot,chainMonths);
    let ms=List.map(g -> {let Goal.G(y,m,_)=g;(y,m)},goals);
    let flags=List.map(p -> {let(i,pr)=p;let(a,b)=pr;if(i==0 and rooted) "\tROOTEDGE" else if(monthIndex(b)-monthIndex(a)>1) "\tBRIDGE" else ""},List.zipWithIndex(List.zip(List.take(count-1,ms),List.drop(1,ms))));
    let source=windowReadPrint(rawPrint);let poses=derivedPoses();let gens=List.map(i -> generator(i,poses),List.range(1,22));
    let(root,edges,v2,startMoves)=wRead(count,rawChain,at(ms,0));
    let free=match startMoves {case Some(_) => true case None => false};
    require(not (free and rooted),"a free start has no root edge");
    require(source==liftState(permIdentity(),source,poses),"identity pose");
    let identityDigest=stackSha(wText(source));
    let sm0=match startMoves {case Some(l) => l case None => Nil};
    let st0=List.foldLeft((s,mv) -> {let(g,q)=mv;wMove(s,g,q)},source,sm0);
    let p0=List.foldLeft((p,mv) -> {let(g,q)=mv;wPose(p,g,q,gens)},permIdentity(),sm0);
    require(st0==liftState(p0,source,poses) and wFront(st0,at(goals,0)),if(free) "free start front is the first member" else "identity root front");
    wSelf(st0,at(goals,0),poses,gens,p0,source);
    require(stackSha(wText(st0))==root,"root digest");
    let stateHeader="sticker\tpiece\tposition\tnormal\tup\ttext\tink\n";
    require(read(states+"/state-01.tsv")==stateHeader+wText(st0),"root full-state snapshot");
    println("input\t${layoutSHA}\t${printSHA}\t${stackSha(rawChain)}");
    if(monthsFile != "") println(monthListLine(monthsPin,listed)) else ();
    let(sy,sm)=at(ms,0);println("root\t${sy}\t${sm}\t${root}");
    if(free) println("start\tfree\t${List.length(sm0)}\t${root}") else ();
    if(joinStart != "") {require(root==(if(joinStart=="identity") identityDigest else joinStart),"start junction digest");println("join\tstart\t${root}")} else ();
    let result=List.foldLeft((acc,pair) -> {
        let(st,perm,allMoves,total,nbest)=acc;let(i,edge)=pair;
        let WEdge.E(y,m,declared,sh,eh,moves,wrong,halls)=edge;let goal=at(goals,i+1);let Goal.G(yy,mm,_)=goal;
        require((y,m)==(yy,mm),"chronological month adjacency");require(stackSha(wText(st))==sh,"edge source continuity");
        let metrics=wMetrics(moves);require(metrics==declared,"exact HTM QTM and rotation metrics");
        let next=List.foldLeft((s,mv) -> {let(g,q)=mv;wMove(s,g,q)},st,moves);
        let nextp=List.foldLeft((p,mv) -> {let(g,q)=mv;wPose(p,g,q,gens)},perm,moves);
        require(next==liftState(nextp,source,poses),"direct294/pose264 retained-state agreement");
        require(stackSha(wText(next))==eh,"edge end digest");
        let mism=wMismatch(next,goal);require(mism==wrong,"strict month front including band line");
        if(mism==Nil) require(halls==Nil,"Hall witnesses without wrong cells") else wHall(source,goal,mism,halls);
        if(rule=="29" and mism != Nil) w29(next,mism) else ();
        let index=i+2;let suffix=if(index<10)"0${index}" else"${index}";
        require(read(states+"/state-${suffix}.tsv")==stateHeader+wText(next),"complete immutable-art state snapshot");
        let back=List.foldLeft((s,mv) -> {let(g,q)=mv;wMove(s,g,wInverse(q))},next,List.reverse(moves));
        let backp=List.foldLeft((p,mv) -> {let(g,q)=mv;wPose(p,g,wInverse(q),gens)},nextp,List.reverse(moves));
        require(back==st and backp==perm,"edge inverse restores full state");
        let(h,q,r,rq)=metrics;let(th,tq,tr,trq)=total;
        println("edge\t${i+1}\t${y}\t${m}\t${h}\t${q}\t${r}\t${rq}\t${sh}\t${eh}\tPASS${at(flags,i)}${if(mism==Nil) "" else "\tBEST_EFFORT\t${List.length(mism)}\t${cellsText(mism)}"}");
        (next,nextp,List.append(allMoves,moves),(th+h,tq+q,tr+r,trq+rq),if(mism==Nil) nbest else nbest+1)
    },(st0,p0,Nil,(0,0,0,0),0),List.zipWithIndex(edges));
    let(final,_,allMoves,total,nbest)=result;
    let Goal.G(lastYear,lastMonth,_)=at(goals,count-1);
    let WEdge.E(edgeYear,edgeMonth,_,_,_,_,_,_)=at(edges,count-2);
    require(List.length(goals)==count and List.length(edges)==count-1 and (edgeYear,edgeMonth)==(lastYear,lastMonth) and (monthsFile != "" or (lastYear*12+lastMonth)-(2026*12+5)==count-1),"window end matches the last chain edge");
    if(joinEnd != "") {let fd=stackSha(wText(final));require(fd==(if(joinEnd=="identity") identityDigest else joinEnd),"end junction digest");println("join\tend\t${fd}")} else ();
    let restored=List.foldLeft((s,mv) -> {let(g,q)=mv;wMove(s,g,wInverse(q))},final,List.reverse(allMoves));
    require(restored==st0,"whole-chain inverse restores all 294 surfaces");
    let(h,q,r,rq)=total;
    if(v2) println("status\texact\t${count-1-nbest}\tbest_effort\t${nbest}") else ();
    println("summary\t${count}\t${count-1}\t${h}\t${q}\t${r}\t${rq}\t${if(monthsFile=="") endText else "list:${monthText(at(ms,count-1))}"}\tINVERSE_PASS");
    println("verdict\t${if(nbest==0) "SAT" else "BEST_EFFORT"}\tlegal-retained-state-window-chain\t${count}\t${count-1}")
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {match Sys.Env.getArgs() {
        case layout::printing::chain::states::oldRoot::Nil => wVerify(layout,printing,chain,states,oldRoot,"2028-01","","","","","","","","")
        case layout::printing::chain::states::oldRoot::endText::printPin::Nil => wVerify(layout,printing,chain,states,oldRoot,endText,printPin,"","","","","","","")
        case layout::printing::chain::states::oldRoot::"months"::monthsFile::monthsPin::printPin::Nil => wVerify(layout,printing,chain,states,oldRoot,"",printPin,monthsFile,monthsPin,"","","","","")
        case layout::printing::chain::states::oldRoot::"months"::monthsFile::monthsPin::printPin::layoutPin::Nil => wVerify(layout,printing,chain,states,oldRoot,"",printPin,monthsFile,monthsPin,layoutPin,"","","","")
        case layout::printing::chain::states::oldRoot::"months"::monthsFile::monthsPin::printPin::layoutPin::rootText::Nil => wVerify(layout,printing,chain,states,oldRoot,"",printPin,monthsFile,monthsPin,layoutPin,rootText,"","","")
        case layout::printing::chain::states::oldRoot::"months"::monthsFile::monthsPin::printPin::layoutPin::rootText::joinStart::joinEnd::Nil => wVerify(layout,printing,chain,states,oldRoot,"",printPin,monthsFile,monthsPin,layoutPin,if(rootText=="-") "" else rootText,if(joinStart=="-") "" else joinStart,if(joinEnd=="-") "" else joinEnd,"")
        case layout::printing::chain::states::oldRoot::"months"::monthsFile::monthsPin::printPin::layoutPin::rootText::joinStart::joinEnd::rule::Nil => wVerify(layout,printing,chain,states,oldRoot,"",printPin,monthsFile,monthsPin,layoutPin,if(rootText=="-") "" else rootText,if(joinStart=="-") "" else joinStart,if(joinEnd=="-") "" else joinEnd,if(rule=="-") "" else rule)
        case _ => throw new IllegalArgumentException("LAYOUT PRINT CHAIN STATES_DIRECTORY ORIGINAL_EVIDENCE [WINDOW_END PRINT_SHA256 | months MONTHS_FILE MONTHS_SHA256 PRINT_SHA256 [LAYOUT_SHA256|- [ROOT_MONTH|- [JOIN_START|- JOIN_END|- [29|-]]]]]")
    }} catch {case e: Exception => {println("INVALID\t${e.getMessage()}");System.exit(1)}}
})
