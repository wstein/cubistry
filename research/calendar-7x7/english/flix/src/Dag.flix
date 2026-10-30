import java.security.MessageDigest
import java.util.HexFormat
import java.nio.charset.StandardCharsets
import java.lang.IllegalArgumentException

type alias SignedPerm = (Perm,Perm)
enum DagState {case D(Map[Int32,SignedPerm],Map[Int32,Perm],Int32,Int32,Int32)}
def permIdentity(): Perm = Vector.range(0,264)
// GAP OnRight: a*b maps i to b[a[i]].
def compose(a: Perm,b: Perm): Perm = Vector.map(i -> Vector.get(i,b),a)
def inverse(p: Perm): Perm = region rc {
    let array=Array.repeat(rc,264,0);
    List.forEach(i -> Array.put(i,Vector.get(i,p),array),List.range(0,264));
    Array.toVector(array)
}
def permutation(p: Perm): Bool = Vector.length(p)==264 and List.sort(Vector.toList(p))==List.range(0,264)
def signed(ref: Int32,registers: Map[Int32,SignedPerm]): SignedPerm \ IO = {
    if(ref==0) (permIdentity(),permIdentity()) else {
        require(ref > -2147483648,"signed reference overflow");
        let id=Int32.abs(ref);
        match Map.get(id,registers) {
            case None  =>  throw new IllegalArgumentException("DAG reference must be an earlier defined node")
            case Some(pair)  =>  {let(p,inv)=pair;if(ref>0)(p,inv)else(inv,p)}
        }
    }
}
def readDag(raw: String,poses: Vector[Pose],complete: Bool): Map[Int32,Perm] \ IO = {
    let body=match lines(raw) {
        case "cubistry.calendar7.legal-dag.v1\t264\t21"::rest  =>  rest
        case _  =>  throw new IllegalArgumentException("legal DAG header requires264 poses and21 original legal generators")
    };
    let result=List.foldLeft((state,line) -> {
        let DagState.D(registers,results,last,seeds,products)=state;
        match fields(line) {
            case "generator"::idText::originalText::Nil  =>  {
                let id=integer(idText);let original=integer(originalText);
                require(seeds<21 and products==0 and id==seeds+1 and original==id,"DAG seeds must be exactly original21 legal generators in order");
                let p=generator(original,poses);let inv=inverse(p);
                require(permutation(p) and compose(compose(compose(p,p),p),p)==permIdentity(),"original generator is a legal quarter turn of order4");
                require(compose(p,inv)==permIdentity() and compose(inv,p)==permIdentity(),"generator inverse selfcheck");
                DagState.D(Map.insert(id,(p,inv),registers),results,id,seeds+1,products)
            }
            case "product"::idText::leftText::rightText::Nil  =>  {
                let id=integer(idText);let l=integer(leftText);let r=integer(rightText);
                require(seeds==21 and id==last+1 and Map.size(results)==0,"DAG products contiguous after21 seeds and before results");
                let(lp,li)=signed(l,registers);let(rp,ri)=signed(r,registers);
                let p=compose(lp,rp);let inv=compose(ri,li);
                if(Int32.modulo(products+1,10000)==0)println("dag-progress\t${products+1}")else();
                DagState.D(Map.insert(id,(p,inv),registers),results,id,seeds,products+1)
            }
            case "result"::targetText::refText::Nil  =>  {
                let target=integer(targetText);let ref=integer(refText);
                require(seeds==21 and target>=1 and target<=91,"DAG target index must be1..91 after21 seeds");
                require(match Map.get(target,results){case None => true case Some(_) => false},"duplicate DAG target");
                let(p,inv)=signed(ref,registers);
                require(permutation(p) and compose(p,inv)==permIdentity() and compose(inv,p)==permIdentity(),"result permutation/inverse validity");
                DagState.D(registers,Map.insert(target,p,results),last,seeds,products)
            }
            case _  =>  throw new IllegalArgumentException("unknown DAG record or malformed fields")
        }
    },DagState.D(Map.empty(),Map.empty(),0,0,0),body);
    let DagState.D(_,results,_,seeds,products)=result;
    require(seeds==21 and (if(complete) Map.size(results)==91 else Map.size(results)>0),"complete witness requires91 roots; partial witness requires at least one root");
    println("dag\t21\t${products}\t${Map.size(results)}\tONLY_ORIGINAL_LEGAL_GENERATORS");
    results
}
def liftState(p: Perm,printing: Vector[Sticker],poses: Vector[Pose]): Vector[Sticker] \ IO = {
    let frames=List.toVector(List.map(home -> {
        let indices=List.map(pair -> {let(i,_)=pair;i},List.filter(pair -> {let(_,pose)=pair;let Pose.P(_,pos,_,_)=pose;pos==home},List.zipWithIndex(Vector.toList(poses))));
        require(List.length(indices)>0,"physical home represented by oriented pose action");
        let source=at(indices,0);
        let Pose.P(o,_,n,u)=Vector.get(source,poses);
        let Pose.P(oo,pos,nn,uu)=Vector.get(Vector.get(source,p),poses);
        require(o==oo and frameMap(home,n,u,nn,uu)==pos,"legal result preserves body orbit and proper orientation");
        List.forEach(i -> {
            let Pose.P(_,_,sn,su)=Vector.get(i,poses);
            let Pose.P(so,sp,tn,tu)=Vector.get(Vector.get(i,p),poses);
            require(so==o and sp==pos,"same home cubie has consistent final position for every pose representative");
            List.forEach(v -> require(frameMap(v,sn,su,tn,tu)==frameMap(v,n,u,nn,uu),"lifted physical rotation independent of home pose representative"),List#{(1,0,0),(0,1,0),(0,0,1)})
        },indices);
        (home,pos,n,u,nn,uu)
    },homes()));
    require(List.sort(List.map(frame -> {let(_,pos,_,_,_,_)=frame;pos},Vector.toList(frames)))==homes(),"all218 physical cubies permuted without collision or loss");
    let moved=Vector.map(sticker -> {
        let Sticker.S(id,pid,home,normal,up,text,ink)=sticker;
        let(old,pos,n,u,nn,uu)=Vector.get(pid-1,frames);
        require(old==home,"source sticker belongs to its physical cubie");
        let newNormal=frameMap(normal,n,u,nn,uu);let newUp=frameMap(up,n,u,nn,uu);
        require(List.memberOf(newNormal,normals(pos)) and unit(newUp) and dot(newUp,newNormal)==0,"all294 sticker normals and actual ups remain physical");
        Sticker.S(id,pid,pos,newNormal,newUp,text,ink)
    },printing);
    let surfaces=List.map(s -> {let Sticker.S(_,_,pos,n,_,_,_)=s;(pos,n)},Vector.toList(moved));
    require(List.sort(surfaces)==List.sort(List.flatMap(home -> List.map(n -> (home,n),normals(home)),homes())),"all294 surface sticker locations covered exactly once");
    moved
}
def replayGoal(target: Int32,p: Perm,printing: Vector[Sticker],poses: Vector[Pose],reps: List[Goal]): Unit \ IO = {
    let moved=liftState(p,printing,poses);
    let Goal.G(year,month,_)=at(reps,target-1);
    List.forEach(cell -> {
        let(r,c)=cell;
        let candidates=List.filter(s -> {let Sticker.S(_,_,pos,n,_,_,_)=s;pos==(c-4,4-r,3) and n==(0,0,1)},Vector.toList(moved));
        require(List.length(candidates)==1,"exactly one physical sticker on each front cell");
        let Sticker.S(_,_,_,_,up,text,ink)=at(candidates,0);
        let(g,wantInk)=goalCell(year,month,r,c);
        require(optic(text,upAngle(up),ink)==optic(g,0,wantInk),"legal replay actual front optics mismatch target INCLUDING actual core up")
    },cells());
    let serialized=List.foldLeft((acc,s) -> {
        let Sticker.S(id,pid,pos,n,u,text,ink)=s;
        acc+"${id}\t${pid}\t${vecText(pos)}\t${vecText(n)}\t${vecText(u)}\t${text}\t${ink}\n"
    },"",Vector.toList(moved));
    let digest=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(serialized.getBytes(StandardCharsets.UTF_8)));
    println("state-sha256\t${target}\t${digest}");
    println("legal-target\t${target}\t${year}\t${month}\t218\t294\t49\tPASS")
}

def directQuarter(sticker: Sticker,index: Int32): Sticker \ IO = {
    let Sticker.S(id,pid,pos,n,u,text,ink)=sticker;
    let axis=(index-1)/7+1;let slot=Int32.modulo(index-1,7);let layer=at(List#{-3,-2,-1,1,2,3,0},slot);
    if(slot==6 or component(pos,axis-1)==layer) Sticker.S(id,pid,quarter(pos,axis),quarter(n,axis),quarter(u,axis),text,ink)
    else sticker
}
def physicalSelftest(root: String,geometry: String): Unit \ IO = {
    let printing=readPrint(read(root+"/physical-print.tsv"));let poses=derivedPoses();
    validatePoseFile(read(geometry+"/pose-points.tsv"),poses);validateMoves(read(geometry+"/moves.tsv"));
    require(liftState(permIdentity(),printing,poses)==printing,"identity replay preserves every actual sticker and up");
    List.forEach(index -> {
        let p=generator(index,poses);let inv=inverse(p);
        require(compose(p,inv)==permIdentity() and compose(inv,p)==permIdentity(),"both inverse compositions");
        require(compose(compose(p,p),compose(p,p))==permIdentity(),"four quarter turns identity");
        require(liftState(p,printing,poses)==Vector.map(s -> directQuarter(s,index),printing),"264 pose action lifts to direct294 sticker legal generator");
        require(liftState(inv,printing,poses)==Vector.map(s -> directQuarter(directQuarter(directQuarter(s,index),index),index),printing),"inverse lift equals three direct quarter turns")
    },List.range(1,22));
    let a=generator(1,poses);let b=generator(8,poses);
    require(compose(a,b) != compose(b,a),"test generators genuinely noncommute");
    require(liftState(compose(a,b),printing,poses)==Vector.map(s -> directQuarter(directQuarter(s,1),8),printing),"left-then-right composition convention verified physically");
    require(optic("6",1,"dark") != optic("6",0,"dark"),"actual core quarter orientation retained");
    require(optic("6",2,"dark")==optic("9",0,"dark"),"six-nine half-turn optics");
    require(optic("12",2,"dark")==optic("21",0,"dark"),"word half turn reverses glyph order");
    require(optic("30↶",2,"dark") != optic("30↶",0,"dark"),"overflow marker retains orientation");
    println("selftest\t21_LEGAL_GENERATORS_294_STICKERS\tINVERSES_FOURTURNS_NONCOMMUTING_COMPOSITION_CORE_OPTICS\tPASS")
}
