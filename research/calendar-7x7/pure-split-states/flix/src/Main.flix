// Flix port of check_pure.jl (structural port; see README for common-mode risks).
// Reuses the unchanged English Core/Data/Dag modules and the copied PR #145 Stacked.flix.
import java.lang.{Exception,System,IllegalArgumentException}

def pureVariant(): String = "F31=bfold,S30=bfold,S31=bfold;H=555555555222"
// (orbit key, class) supplied by a surface: the class it shows upright on the one front
// cell of its orbit where it is upright; blank surfaces supply the blank class.
def surfaceClass(s: Sticker): ((Int32,Int32),(String,String,String)) \ IO = {
    let Sticker.S(_,_,home,n,u,text,ink)=s;
    let hits=List.flatMap(cell -> {
        let(r,c)=cell;let pos=(c-4,4-r,3);
        List.flatMap(rot -> {
            if(rotate(home,rot)==pos and rotate(n,rot)==(0,0,1)) {
                if(text=="") List#{(orbit(r,c),("","0","blank"))}
                else if(upAngle(rotate(u,rot))==0) {let(x,q,i)=lowerArt(text,ink,r,c);List#{(orbit(r,c),(x,"${q}",i))}}
                else Nil
            } else Nil
        },rotations())
    },cells());
    match hits {
        case h::_ => h
        case Nil => throw new IllegalArgumentException("surface reaches no front cell upright")
    }
}
def pureRequirement(goals: List[Goal],key: (Int32,Int32)): List[((String,String,String),Int32)] \ IO = {
    let perGoal=List.map(g -> List.flatMap(q -> {
        let((r,c),(t,ink))=q;
        if(orbit(r,c)==key) List#{if(t=="") ("","0","blank") else {let(x,a,i)=lowerArt(t,ink,r,c);(x,"${a}",i)}} else Nil
    },List.zip(cells(),goalBoard(g))),goals);
    let classes=List.sort(List.distinct(List.flatten(perGoal)));
    List.map(cls -> (cls,List.foldLeft((m,xs) -> Int32.max(m,List.count(y -> y==cls,xs)),0,perGoal)),classes)
}
def printSupply(source: Vector[Sticker],goals: List[Goal]): Int32 \ IO = {
    let supplied=List.map(surfaceClass,Vector.toList(source));
    let keys=List.sort(List.distinct(List.map(p -> {let(r,c)=p;orbit(r,c)},cells())));
    List.foldLeft((short,key) -> {
        let req=pureRequirement(goals,key);
        let have=List.flatMap(p -> {let(k,a)=p;if(k==key) List#{a} else Nil},supplied);
        let need=List.foldLeft((acc,p) -> {let((_,_,i),v)=p;if(i=="blank") acc else acc+v},0,req);
        let blank=List.foldLeft((acc,p) -> {let((_,_,i),v)=p;if(i=="blank") acc+v else acc},0,req);
        let printed=List.count(a -> {let(_,_,i)=a;i != "blank"},have);
        let blanks=List.count(a -> {let(_,_,i)=a;i=="blank"},have);
        let missing=List.foldLeft((acc,p) -> {let(cls,v)=p;acc+Int32.max(0,v-List.count(a -> a==cls,have))},0,req);
        let(x,y)=key;
        println("pure-print-orbit\t${x}\t${y}\t${need}\t${blank}\t${printed}\t${blanks}\t${missing}");
        short+missing
    },0,keys)
}
def vecShow(v: (Int32,Int32,Int32)): String = {let(a,b,c)=v;"(${a}, ${b}, ${c})"}
def checkPure(printPath: String,dagPath: String,targets: String,oldRoot: String,geometry: String): Unit \ IO = {
    let oldRaw=read(oldRoot+"/physical-print.tsv");
    require(stackSha(oldRaw)=="b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931","unchanged PR99 printing provenance");
    let old=readPrint(oldRaw);let source=readPrint(read(printPath));
    List.forEach(i -> {
        let Sticker.S(id,piece,home,n,u,text,ink)=Vector.get(i,old);
        let Sticker.S(_,piece2,home2,n2,u2,text2,ink2)=Vector.get(i,source);
        require((piece,home,n)==(piece2,home2,n2),"surface identity changed");
        if((text,ink,u)==(text2,ink2,u2)) () else {
            let upNote=if(u==u2) "same-up" else "new-up";
            println("pure-print-change\t${id}\t${text}\t${ink}\t${text2}\t${ink2}\t${upNote}")
        }
    },List.range(0,294));
    let poses=derivedPoses();let reps=representatives();
    validatePoseFile(read(geometry+"/pose-points.tsv"),poses);validateMoves(read(geometry+"/moves.tsv"));validateTargets(read(oldRoot+"/targets.tsv"),reps);
    let goals=stackedGoals(pureVariant(),reps);
    let ids=if(targets=="all") List.range(1,92) else List.map(integer,String.splitOn(substr=",",targets));
    require(List.length(ids)>0 and List.length(List.distinct(ids))==List.length(ids) and List.forAll(i -> i>=1 and i<=91,ids),"TARGETS must be distinct ids 1..91 or all");
    let short=printSupply(source,goals);
    let results=readDag(read(dagPath),poses,true);
    let outcomes=List.map(id -> {
        let p=match Map.get(id,results){case Some(v) => v case None => throw new IllegalArgumentException("missing complete target")};
        let state=liftState(p,source,poses);let Goal.G(y,m,board)=at(goals,id-1);
        let cell=frontFailure(state,board,"strict");let ok=cell=="-\t-\t-\t-";
        let status=if(ok) "PASS" else "FAIL";
        println("pure-target\t${id}\t${y}\t${m}\t${status}\t${cell}\t${stackSha(stateText(state))}");
        (id,ok)
    },ids);
    let failed=List.flatMap(o -> {let(id,ok)=o;if(ok) Nil else List#{id}},outcomes);
    let nf=List.length(failed);
    let printed=List.count(s -> {let Sticker.S(_,_,_,_,_,g,_)=s;g != ""},Vector.toList(source));
    let verdict=if(nf==0 and short==0) "ACCEPT" else "REJECT";
    println("pure-summary\t${verdict}\t${List.length(ids)-nf}\t${nf}\t${short}\t${printed}");
    require(short==0,"print misses required class copies");
    require(nf==0,"${nf} of ${List.length(ids)} states fail the pure-split front")
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case "matchability"::printing::oldRoot::Nil => matchability(printing,oldRoot)
            case "chain"::printing::dag::path::oldRoot::geometry::Nil => runPureChain(printing,dag,path,oldRoot,geometry)
            case printing::dag::targets::oldRoot::geometry::Nil => checkPure(printing,dag,targets,oldRoot,geometry)
            case _ => throw new IllegalArgumentException("PRINT DAG TARGETS ORIGINAL_EVIDENCE GEOMETRY | matchability PRINT ORIGINAL_EVIDENCE | chain PRINT DAG CHAIN ORIGINAL_EVIDENCE GEOMETRY")
        }
    } catch {case ex: Exception => {println("invalid\t"+ex.toString());System.exit(1)}}
})

// Cubie-level front matchability (design check): for each display and body orbit, the
// number of front cells left unmatched by a maximum matching of cells to cubies.
def cellOptions(source: Vector[Sticker],home: (Int32,Int32,Int32),r: Int32,c: Int32,want: (String,String)): Bool \ IO = {
    let pos=(c-4,4-r,3);let(g,wi)=want;
    let stickers=List.filter(s -> {let Sticker.S(_,_,h,_,_,_,_)=s;h==home},Vector.toList(source));
    List.exists(rot -> rotate(home,rot)==pos and List.exists(s -> {
        let Sticker.S(_,_,_,n,u,text,ink)=s;
        rotate(n,rot)==(0,0,1) and optic(text,upAngle(rotate(u,rot)),ink)==optic(g,0,wi)
    },stickers),rotations())
}
def augment(c: Int32,adj: Map[Int32,List[Int32]],owner: Map[Int32,Int32],seen: Set[Int32]): (Bool,Map[Int32,Int32],Set[Int32]) =
    tryHomes(c,Map.getWithDefault(c,Nil,adj),adj,owner,seen)
def tryHomes(c: Int32,hs: List[Int32],adj: Map[Int32,List[Int32]],owner: Map[Int32,Int32],seen: Set[Int32]): (Bool,Map[Int32,Int32],Set[Int32]) = match hs {
    case Nil => (false,owner,seen)
    case h::rest =>
        if(Set.memberOf(h,seen)) tryHomes(c,rest,adj,owner,seen)
        else {
            let seen2=Set.insert(h,seen);
            match Map.get(h,owner) {
                case None => (true,Map.insert(h,c,owner),seen2)
                case Some(c2) => {
                    let(ok,owner2,seen3)=augment(c2,adj,owner,seen2);
                    if(ok) (true,Map.insert(h,c,owner2),seen3) else tryHomes(c,rest,adj,owner2,seen3)
                }
            }
        }
}
def unmatchedCount(source: Vector[Sticker],board: List[(String,String)]): Int32 \ IO = {
    let keys=List.distinct(List.map(bodyKey,homes()));
    List.foldLeft((total,key) -> {
        let hs=List.toVector(List.filter(h -> bodyKey(h)==key,homes()));
        let cs=List.filter(q -> {let((r,c),_)=q;bodyKey((c-4,4-r,3))==key},List.zip(cells(),board));
        let adj=List.foldLeft((m,q) -> {
            let(i,((r,c),want))=q;
            Map.insert(i,List.filter(j -> cellOptions(source,Vector.get(j,hs),r,c,want),List.range(0,Vector.length(hs))),m)
        },Map.empty(),List.zipWithIndex(cs));
        let(_,missing)=List.foldLeft((acc,i) -> {
            let(owner,miss)=acc;let(ok,owner2,_)=augment(i,adj,owner,Set.empty());
            if(ok) (owner2,miss) else (owner,miss+1)
        },(Map.empty(),0),List.range(0,List.length(cs)));
        total+missing
    },0,keys)
}
def matchability(printPath: String,oldRoot: String): Unit \ IO = {
    let reps=representatives();validateTargets(read(oldRoot+"/targets.tsv"),reps);
    let goals=stackedGoals(pureVariant(),reps);let source=readPrint(read(printPath));
    let bad=List.foldLeft((n,q) -> {
        let(i,g)=q;let Goal.G(y,m,board)=g;let u=unmatchedCount(source,board);
        if(u>0) {println("pure-unmatched\t${i+1}\t${y}\t${m}\t${u}");n+1} else n
    },0,List.zipWithIndex(goals));
    println("pure-matchability\t${bad}");
    require(bad==0,"${bad} displays have no cubie-level front matching")
}

// Chain verifier for the pure split (same replay as ../../continuous/flix, parametrized
// for the new print and the pure-split displays under the strict stacked rule).
def pureFront(state: Vector[Sticker],y: Int32,m: Int32,what: String): Unit \ IO =
    require(frontFailure(state,stackedBoard(pureVariant(),y,m),"strict")=="-\t-\t-\t-",what)
def runPureChain(printPath: String,dagPath: String,path: String,oldRoot: String,geometry: String): Unit \ IO = {
    let CalendarChain.C(source,sy,sm,sourceHash,edges)=readChain(read(path));
    let oldRaw=read(oldRoot+"/physical-print.tsv");
    require(digest(oldRaw)=="b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931","unchanged PR99 printing provenance");
    let old=readPrint(oldRaw);let printing=readPrint(read(printPath));
    List.forEach(i -> {
        let Sticker.S(_,a,b,c,_,_,_)=Vector.get(i,old);let Sticker.S(_,a2,b2,c2,_,_,_)=Vector.get(i,printing);
        require((a,b,c)==(a2,b2,c2),"surface identity changed")
    },List.range(0,294));
    let poses=derivedPoses();
    validatePoseFile(read(geometry+"/pose-points.tsv"),poses);validateMoves(read(geometry+"/moves.tsv"));
    let reps=representatives();validateTargets(read(oldRoot+"/targets.tsv"),reps);
    let goals=stackedGoals(pureVariant(),reps);
    require(goalBoard(at(goals,source-1))==stackedBoard(pureVariant(),sy,sm),"source root display must match declared source month");
    let results=readDag(read(dagPath),poses,false);
    let start=match Map.get(source,results) {
        case Some(p) => p
        case None => throw new IllegalArgumentException("source root absent from legal DAG")
    };
    let initial=liftState(start,printing,poses);pureFront(initial,sy,sm,"source front");
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
        pureFront(lifted,year,month,"edge front");
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
