import java.lang.{Exception,System,IllegalArgumentException}
import java.io.File
import java.nio.file.Files
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.HexFormat

enum Step with Eq {case M(Int32,Int32)}
enum Edge {case E(Int32,Int32,Int32,Int32,Int32,Int32,String,String,List[Step])}
enum CalendarChain {case C(Int32,Int32,Int32,String,List[Edge])}
def read(path: String): String \ IO = Files.readString(new File(path).toPath(),StandardCharsets.UTF_8)
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
def checkFront(state: Vector[Sticker],year: Int32,month: Int32): Unit \ IO = List.forEach(cell -> {
    let(r,c)=cell;
    let matches=List.filter(s -> {let Sticker.S(_,_,pos,n,_,_,_)=s;pos==(c-4,4-r,3) and n==(0,0,1)},Vector.toList(state));
    require(List.length(matches)==1,"one sticker per front cell");
    let Sticker.S(_,_,_,_,up,text,ink)=at(matches,0);
    let(want,wantInk)=goalCell(year,month,r,c);
    require(optic(text,upAngle(up),ink)==optic(want,0,wantInk),"actual front art/orientation mismatch")
},cells())
def metrics(steps: List[Step]): (Int32,Int32,Int32,Int32) = {
    let htm=List.count(step -> {let Step.M(g,_)=step;Int32.modulo(g,7)!=0},steps);
    let rotations=List.length(steps)-htm;
    let qtm=List.foldLeft((n,step) -> {let Step.M(g,q)=step;n+(if(Int32.modulo(g,7)==0)0 else if(q==2)2 else 1)},0,steps);
    let rotationQtm=List.foldLeft((n,step) -> {let Step.M(g,q)=step;n+(if(Int32.modulo(g,7)!=0)0 else if(q==2)2 else 1)},0,steps);
    (htm,qtm,rotations,rotationQtm)
}
def runChain(root: String,geometry: String,dagPath: String,path: String): Unit \ IO = {
    let CalendarChain.C(source,sy,sm,sourceHash,edges)=readChain(read(path));
    let printRaw=read(root+"/physical-print.tsv");
    require(digest(printRaw)=="b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931","immutable PR99 physical printing hash");
    let printing=readPrint(printRaw);let poses=derivedPoses();
    validatePoseFile(read(geometry+"/pose-points.tsv"),poses);validateMoves(read(geometry+"/moves.tsv"));
    let reps=representatives();validateTargets(read(root+"/targets.tsv"),reps);
    require(goalBoard(at(reps,source-1))==goalBoard(goal(sy,sm)),"source root calendar must match declared actual source month");
    let results=readDag(read(dagPath),poses,false);
    let start=match Map.get(source,results) {
        case Some(p) => p
        case None => throw new IllegalArgumentException("source root absent from legal DAG")
    };
    let initial=liftState(start,printing,poses);checkFront(initial,sy,sm);
    require(fullDigest(initial)==sourceHash,"initial full physical source SHA mismatch");
    println("source-sha256\t${sourceHash}");
    let(end,final,_,_)=List.foldLeft((current,pair) -> {
        let(index,edge)=pair;let Edge.E(year,month,h,q,r,rq,ss,ds,steps)=edge;
        let(before,state,previousYear,previousMonth)=current;
        let(ny,nm)=if(previousMonth==12)(previousYear+1,1)else(previousYear,previousMonth+1);
        require((year,month)==(ny,nm),"edges must be consecutive chronological months");
        require(fullDigest(state)==ss,"edge source hash must equal retained complete physical state");
        require(metrics(steps)==(h,q,r,rq),"declared HTM/QTM/rotation metrics differ from raw moves");
        let(after,direct)=List.foldLeft((poseState,step) -> {
            let(p,s)=poseState;(compose(p,stepPerm(step,poses)),directStep(step,s))
        },(before,state),steps);
        let lifted=liftState(after,printing,poses);
        require(lifted==direct,"pose replay agrees with direct294-sticker physical replay");
        checkFront(lifted,year,month);
        require(fullDigest(lifted)==ds,"edge destination full physical SHA mismatch");
        let(inversePose,inverseDirect)=List.foldLeft((poseState,step) -> {
            let(p,s)=poseState;let inv=inverseStep(step);
            (compose(p,stepPerm(inv,poses)),directStep(inv,s))
        },(after,direct),List.reverse(steps));
        require(inversePose==before and inverseDirect==state,"edge inverse must restore exact physical source");
        println("edge\t${index+1}\t${year}\t${month}\t${ss}\t${ds}");
        println("metrics\t${index+1}\t${h}\t${q}\t${r}\t${rq}\t${List.length(steps)}");
        (after,direct,year,month)
    },(start,initial,sy,sm),List.zipWithIndex(edges));
    let allSteps=List.flatMap(edge -> {let Edge.E(_,_,_,_,_,_,_,_,steps)=edge;steps},edges);
    let(backPose,backDirect)=List.foldLeft((poseState,step) -> {
        let(p,s)=poseState;let inv=inverseStep(step);
        (compose(p,stepPerm(inv,poses)),directStep(inv,s))
    },(end,final),List.reverse(allSteps));
    require(backPose==start and backDirect==initial,"full chain inverse restores exact initial physical state");
    println("endpoint-sha256\t${fullDigest(final)}");
    println("status\tVALID_CONTINUOUS_CHAIN\t${List.length(edges)}\t218\t294\t49")
}
def parserSelftest(): Unit \ IO = {
    let hash="0000000000000000000000000000000000000000000000000000000000000000";
    let valid="cubistry.calendar7.chain.v1\nsource\t2\t2026\t2\t${hash}\nedge\t2026\t3\t1\t1\t0\t0\t${hash}\t${hash}\nmove\t4\t1\nend\nedge\t2026\t4\t1\t1\t0\t0\t${hash}\t${hash}\nmove\t5\t1\nend\nfinish\n";
    let CalendarChain.C(source,y,m,h,edges)=readChain(valid);
    require(source==2 and y==2026 and m==2 and h==hash and List.length(edges)==2,"positive chain parser control");
    let bad=List#{
        String.replace(src="source\t2",dst="source\t0",valid),
        String.replace(src="source\t2",dst="source\t02",valid),
        String.replace(src="source\t2",dst="source\t2147483648",valid),
        String.replace(src="source\t2\t2026",dst="source\t2\t2025",valid),
        String.replace(src="2026\t3",dst="2100\t3",valid),
        String.replace(src="2026\t3",dst="2026\t13",valid),
        String.replace(src="move\t4",dst="move\t22",valid),
        String.replace(src="move\t4\t1",dst="move\t4\t0",valid),
        String.replace(src="move\t4\t1",dst="move\t4\t-2147483648",valid),
        String.replace(src="3\t1\t1\t0\t0",dst="3\t-1\t1\t0\t0",valid),
        String.replace(src=hash,dst="ABC",valid),
        String.replace(src="\n",dst="\r\n",valid),
        valid+"\n",
        valid+"finish\n",
        String.replace(src="end\n",dst="",valid),
        String.replace(src="finish\n",dst="finish",valid),
        "cubistry.calendar7.chain.v1\nsource\t2\t2026\t2\t${hash}\nfinish\n",
        "cubistry.calendar7.chain.v1\nsource\t2\t2026\t2\t${hash}\nedge\t2026\t3\t0\t0\t0\t0\t${hash}\t${hash}\nend\nfinish\n"
    };
    List.forEach(raw -> {
        let accepted=try {let _ = readChain(raw);true} catch {case _: Exception => false};
        require(not accepted,"negative chain parser control must be rejected")
    },bad);
    println("selftest\tCHAIN_PARSER_1_POSITIVE_18_NEGATIVE\tPASS")
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case "chain"::root::geometry::dag::path::Nil => runChain(root,geometry,dag,path)
            case "parse"::path::Nil => {let _ = readChain(read(path));println("status\tVALID_CHAIN_SYNTAX_ONLY")}
            case "selftest"::Nil => parserSelftest()
            case "selftest"::root::geometry::Nil => {parserSelftest();physicalSelftest(root,geometry)}
            case _ => throw new IllegalArgumentException("chain EVIDENCE GEOMETRY DAG CHAIN | parse CHAIN | selftest EVIDENCE GEOMETRY")
        }
    } catch {case ex: Exception => {println("invalid\t"+ex.toString());System.exit(1)}}
})
