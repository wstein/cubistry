// SPDX-License-Identifier: AGPL-3.0-or-later
// Independent native direct294/pose264 retained-state chain replay.
import java.lang.{Exception, IllegalArgumentException, System}

enum WEdge { case E(Int32,Int32,(Int32,Int32,Int32,Int32),String,String,List[(Int32,Int32)]) }
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
def wEdges(rows: List[String],acc: List[WEdge]): List[WEdge] \ IO = match rows {
    case "finish"::Nil => {require(List.length(acc)==20,"exactly 20 chronological edges");List.reverse(acc)}
    case line::rest => match fields(line) {
        case "edge"::yy::mm::hh::qq::rr::rq::sh::eh::Nil => {
            let y=integer(yy);let m=integer(mm);let h=integer(hh);let q=integer(qq);let r=integer(rr);let rotq=integer(rq);
            require(h>=0 and h<=100000 and q>=0 and q<=200000 and r>=0 and r<=100000 and rotq>=0 and rotq<=200000,"bounded nonnegative metrics");
            require(wHash(sh) and wHash(eh),"canonical edge digest");
            let(moves,remaining)=wMoves(rest,Nil);require(List.length(acc)<20,"at most 20 edges");
            wEdges(remaining,WEdge.E(y,m,(h,q,r,rotq),sh,eh,moves)::acc)
        }
        case _ => throw new IllegalArgumentException("edge record")
    }
    case Nil => throw new IllegalArgumentException("missing chain finish")
}
def wRead(raw: String): (String,List[WEdge]) \ IO = {
    require(String.length(raw)<=16000000,"bounded chain input");
    match lines(raw) {
        case "cubistry.calendar7.chain.v1"::source::rest => match fields(source) {
            case "source"::r::y::m::h::Nil => {
                require((integer(r),integer(y),integer(m))==(5,2026,5),"May 2026 identity root");require(wHash(h),"root digest");
                let edges=wEdges(rest,Nil);
                let count=List.foldLeft((n,e) -> {let WEdge.E(_,_,_,_,_,moves)=e;n+List.length(moves)},0,edges);
                require(count<=100000,"bounded total moves");(h,edges)
            }
            case _ => throw new IllegalArgumentException("source record")
        }
        case _ => throw new IllegalArgumentException("chain header and trailer")
    }
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
def wSelf(st: Vector[Sticker],g: Goal,poses: Vector[Pose],gens: List[Perm]): Unit \ IO = {
    List.forEach(index -> List.forEach(q -> {
        let s=wMove(st,index,q);let p=wPose(permIdentity(),index,q,gens);
        require(s==liftState(p,st,poses),"single-move direct294/pose264 agreement");
        require(wMove(s,index,wInverse(q))==st,"single-move inverse")
    },List#{-1,1,2}),List.range(1,22));
    let badOne=Vector.map(s -> {let Sticker.S(id,p,p0,n,u,text,ink)=s;
        if(p0==(2,1,3) and n==(0,0,1)) Sticker.S(id,p,p0,n,scale(-1,u),text,ink) else s
    },st);
    require(not wFront(badOne,g),"strict upside-down one rejected");
    let aliased=Vector.map(s -> {let Sticker.S(id,p,p0,n,u,_,ink)=s;
        if(p0==(2,1,3) and n==(0,0,1)) Sticker.S(id,p,p0,n,u,"I",ink) else s
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
def wVerify(layout: String,printing: String,chain: String,states: String,oldRoot: String): Unit \ IO = {
    let rawLayout=read(layout);let rawPrint=read(printing);let rawChain=read(chain);
    let layoutSHA="c5671d7551295fc62dff5cf73fce31bfd774ee90865e7dc384b073d0b22844db";
    let printSHA="0cb44a28c4bf84c25616fc248f9565df2e49e41feb479225e43166b1b8a2d127";
    require(stackSha(rawLayout)==layoutSHA,"new layout pin");require(stackSha(rawPrint)==printSHA,"new immutable print pin");
    let goals=coupledGoals(coupledLabels(rawLayout),"names-band","window",oldRoot);
    let source=windowReadPrint(rawPrint);let poses=derivedPoses();let gens=List.map(i -> generator(i,poses),List.range(1,22));
    let(root,edges)=wRead(rawChain);
    require(source==liftState(permIdentity(),source,poses) and wFront(source,at(goals,0)),"identity root front");
    wSelf(source,at(goals,0),poses,gens);
    require(stackSha(wText(source))==root,"root digest");
    let stateHeader="sticker\tpiece\tposition\tnormal\tup\ttext\tink\n";
    require(read(states+"/state-01.tsv")==stateHeader+wText(source),"root full-state snapshot");
    println("input\t${layoutSHA}\t${printSHA}\t${stackSha(rawChain)}");
    println("root\t2026\t5\t${root}");
    let result=List.foldLeft((acc,pair) -> {
        let(st,perm,allMoves,total)=acc;let(i,edge)=pair;
        let WEdge.E(y,m,declared,sh,eh,moves)=edge;let goal=at(goals,i+1);let Goal.G(yy,mm,_)=goal;
        require((y,m)==(yy,mm),"chronological month adjacency");require(stackSha(wText(st))==sh,"edge source continuity");
        let metrics=wMetrics(moves);require(metrics==declared,"exact HTM QTM and rotation metrics");
        let next=List.foldLeft((s,mv) -> {let(g,q)=mv;wMove(s,g,q)},st,moves);
        let nextp=List.foldLeft((p,mv) -> {let(g,q)=mv;wPose(p,g,q,gens)},perm,moves);
        require(next==liftState(nextp,source,poses),"direct294/pose264 retained-state agreement");
        require(stackSha(wText(next))==eh,"edge end digest");require(wFront(next,goal),"strict month front including band line");
        let index=i+2;let suffix=if(index<10)"0${index}" else"${index}";
        require(read(states+"/state-${suffix}.tsv")==stateHeader+wText(next),"complete immutable-art state snapshot");
        let back=List.foldLeft((s,mv) -> {let(g,q)=mv;wMove(s,g,wInverse(q))},next,List.reverse(moves));
        let backp=List.foldLeft((p,mv) -> {let(g,q)=mv;wPose(p,g,wInverse(q),gens)},nextp,List.reverse(moves));
        require(back==st and backp==perm,"edge inverse restores full state");
        let(h,q,r,rq)=metrics;let(th,tq,tr,trq)=total;
        println("edge\t${i+1}\t${y}\t${m}\t${h}\t${q}\t${r}\t${rq}\t${sh}\t${eh}\tPASS");
        (next,nextp,List.append(allMoves,moves),(th+h,tq+q,tr+r,trq+rq))
    },(source,permIdentity(),Nil,(0,0,0,0)),List.zipWithIndex(edges));
    let(final,_,allMoves,total)=result;
    let restored=List.foldLeft((s,mv) -> {let(g,q)=mv;wMove(s,g,wInverse(q))},final,List.reverse(allMoves));
    require(restored==source,"whole-chain inverse restores all 294 surfaces");
    let(h,q,r,rq)=total;
    println("summary\t21\t20\t${h}\t${q}\t${r}\t${rq}\t2028-01\tINVERSE_PASS");
    println("verdict\tSAT\tlegal-retained-state-window-chain\t21\t20")
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {match Sys.Env.getArgs() {
        case layout::printing::chain::states::oldRoot::Nil => wVerify(layout,printing,chain,states,oldRoot)
        case _ => throw new IllegalArgumentException("LAYOUT PRINT CHAIN STATES_DIRECTORY ORIGINAL_EVIDENCE")
    }} catch {case e: Exception => {println("INVALID\t${e.getMessage()}");System.exit(1)}}
})
