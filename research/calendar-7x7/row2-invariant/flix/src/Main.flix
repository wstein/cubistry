import java.lang.{Exception,System,IllegalArgumentException}
import java.io.File
import java.nio.file.Files
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.HexFormat

enum RowSpec with Eq {case C(Int32,Int32,Vec,Vec,Vec)}
def read(path: String): String \ IO = Files.readString(new File(path).toPath(),StandardCharsets.UTF_8)
def rowSha(text: String): String \ IO = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)))
def rowSpecs(raw: String): List[RowSpec] \ IO = {
    let body=match lines(raw) {
        case "cubistry.calendar7.row2-endpoint.v1"::"printing-sha256\tb2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931"::"dag-sha256\tef2071eceb3f7e1934c4b67684613044e38d0446f16e86f4d0ba112ddc9f9f24"::rest => rest
        case _ => throw new IllegalArgumentException("row2 certificate header and immutable input pins")
    };
    require(List.length(body)==7,"exactly seven certificate columns");
    List.map(pair -> {
        let(index,line)=pair;let col=index+1;
        match fields(line) {
            case "column"::c::sid::pid::p::n::u::Nil => {
                let id=integer(sid);let piece=integer(pid);let pos=vector(p);let normal=vector(n);let up=vector(u);
                require(integer(c)==col and id>=1 and id<=294 and piece>=1 and piece<=218,"certificate column/sticker/cubie bounds");
                require(pos==(col-4,2,3) and normal==(0,0,1) and up==(0,1,0),"row2 exact front position, normal and upright pose");
                RowSpec.C(id,piece,pos,normal,up)
            }
            case _ => throw new IllegalArgumentException("certificate column record shape")
        }
    },List.zipWithIndex(body))
}
def rowUnique(printing: Vector[Sticker],reps: List[Goal],specs: List[RowSpec]): Unit \ IO = {
    List.forEach(pair -> {
        let(index,spec)=pair;let col=index+1;let RowSpec.C(id,piece,_,_,_)=spec;
        let wanted=goalCell(2026,1,2,col);let(g,ink)=wanted;
        require(List.forAll(goalValue -> {let Goal.G(y,m,_)=goalValue;goalCell(y,m,2,col)==wanted},reps),"weekday target fixed across all representative months");
        let candidates=List.flatMap(sticker -> {
            let Sticker.S(sid,_,_,_,_,text,color)=sticker;
            List.map(q -> (sid,q),List.filter(q -> optic(text,q,color)==optic(g,0,ink),List.range(0,4)))
        },Vector.toList(printing));
        require(candidates==List#{(id,0)},"weekday must match one immutable physical surface and one upright angle");
        let Sticker.S(_,pid,_,_,_,text,color)=Vector.get(id-1,printing);
        require(pid==piece,"weekday belongs to declared immutable cubie");
        println("row2-unique\t${col}\t${id}\t${pid}\t${text}\t${color}\t0")
    },List.zipWithIndex(specs))
}
def rowStateText(state: Vector[Sticker]): String = List.foldLeft((acc,s) -> {
    let Sticker.S(id,pid,pos,n,u,text,ink)=s;
    acc+"${id}\t${pid}\t${vecText(pos)}\t${vecText(n)}\t${vecText(u)}\t${text}\t${ink}\n"
},"",Vector.toList(state))
def rowSignature(state: Vector[Sticker],specs: List[RowSpec]): String \ IO = {
    let stickers=List.map(spec -> {
        let RowSpec.C(id,piece,pos,normal,up)=spec;let s=Vector.get(id-1,state);
        let Sticker.S(sid,pid,p,n,u,_,_)=s;
        require((sid,pid,p,n,u)==(id,piece,pos,normal,up),"row2 physical identity or full sticker pose changed at endpoint");s
    },specs);
    rowSha(rowStateText(List.toVector(stickers)))
}
def rowFront(state: Vector[Sticker],year: Int32,month: Int32): Unit \ IO =
    List.forEach(cell -> {
        let(r,c)=cell;
        let matches=List.filter(s -> {let Sticker.S(_,_,p,n,_,_,_)=s;p==(c-4,4-r,3) and n==(0,0,1)},Vector.toList(state));
        require(List.length(matches)==1,"exactly one front sticker per cell");
        let Sticker.S(_,_,_,_,u,g,ink)=at(matches,0);let(wanted,color)=goalCell(year,month,r,c);
        require(optic(g,upAngle(u),ink)==optic(wanted,0,color),"calendar target artwork and orientation")
    },cells())
def rowRoot(id: Int32,roots: Map[Int32,Perm]): Perm \ IO = match Map.get(id,roots) {
    case Some(p) => p
    case None => throw new IllegalArgumentException("missing source root")
}
def rowMoves(records: List[String],p: Perm,counts: (Int32,Int32,Int32,Int32),poses: Vector[Pose]): (List[String],Perm,(Int32,Int32,Int32,Int32)) \ IO = match records {
    case "end"::rest => (rest,p,counts)
    case line::rest => match fields(line) {
        case "move"::g::q::Nil => {
            let gen=integer(g);let turns=integer(q);require(gen>=1 and gen<=21 and List.memberOf(turns,List#{-1,1,2}),"legal primitive generator and exponent");
            let base=generator(gen,poses);let step=if(turns== -1)inverse(base)else if(turns==2)compose(base,base)else base;
            let(h,qt,r,rq)=counts;let count=Int32.abs(turns);
            let next=if(Int32.modulo(gen,7)==0)(h,qt,r+1,rq+count)else(h+1,qt+count,r,rq);
            rowMoves(rest,compose(p,step),next,poses)
        }
        case _ => throw new IllegalArgumentException("chain move record or end expected")
    }
    case Nil => throw new IllegalArgumentException("unterminated chain edge")
}
def rowEdges(records: List[String],p: Perm,year: Int32,month: Int32,edges: Int32,inputHash: String,printing: Vector[Sticker],poses: Vector[Pose],specs: List[RowSpec]): Int32 \ IO = match records {
    case "finish"::Nil => {require(edges>=2,"continuous chain needs two edges");edges}
    case line::rest => match fields(line) {
        case "edge"::yy::mm::hh::qq::rr::rqq::sourceHash::endHash::Nil => {
            let y=integer(yy);let m=integer(mm);let nextDate=if(month==12)(year+1,1)else(year,month+1);
            require((y,m)==nextDate and y>=2026 and y<=2099,"consecutive chronological months within research domain");
            require(rowSha(rowStateText(liftState(p,printing,poses)))==sourceHash,"chain retains exact previous full physical source");
            let(more,next,counts)=rowMoves(rest,p,(0,0,0,0),poses);
            require(counts==(integer(hh),integer(qq),integer(rr),integer(rqq)),"declared HTM/QTM and rotation metrics");
            let state=liftState(next,printing,poses);let full=rowSha(rowStateText(state));require(full==endHash,"chain actual complete state hash");
            rowFront(state,y,m);let signature=rowSignature(state,specs);
            println("row2-chain-end\t${inputHash}\t${edges+1}\t${y}\t${m}\t${full}\t${signature}");
            rowEdges(more,next,y,m,edges+1,inputHash,printing,poses,specs)
        }
        case _ => throw new IllegalArgumentException("chain edge or final finish record expected")
    }
    case Nil => throw new IllegalArgumentException("missing final finish record")
}
def rowChain(raw: String,roots: Map[Int32,Perm],printing: Vector[Sticker],poses: Vector[Pose],specs: List[RowSpec]): Int32 \ IO = match lines(raw) {
    case "cubistry.calendar7.chain.v1"::source::rest => match fields(source) {
        case "source"::root::yy::mm::hash::Nil => {
            let id=integer(root);let y=integer(yy);let m=integer(mm);require(y>=2026 and y<=2099 and m>=1 and m<=12,"source calendar date");
            let p=rowRoot(id,roots);let state=liftState(p,printing,poses);let full=rowSha(rowStateText(state));require(full==hash,"source root actual full hash");
            rowFront(state,y,m);let signature=rowSignature(state,specs);let inputHash=rowSha(raw);
            println("row2-chain-start\t${inputHash}\t${y}\t${m}\t${full}\t${signature}");
            rowEdges(rest,p,y,m,0,inputHash,printing,poses,specs)
        }
        case _ => throw new IllegalArgumentException("chain source record shape")
    }
    case _ => throw new IllegalArgumentException("raw continuous chain header")
}
def checkRow2(certificate: String,dagPath: String,root: String,geometry: String,chains: List[String]): Unit \ IO = {
    let specs=rowSpecs(read(certificate));let printRaw=read(root+"/physical-print.tsv");let dagRaw=read(dagPath);
    require(rowSha(printRaw)=="b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931","immutable PR99 print hash");
    require(rowSha(dagRaw)=="ef2071eceb3f7e1934c4b67684613044e38d0446f16e86f4d0ba112ddc9f9f24","immutable PR99 legal witness hash");
    let printing=readPrint(printRaw);let poses=derivedPoses();let reps=representatives();
    validatePoseFile(read(geometry+"/pose-points.tsv"),poses);validateMoves(read(geometry+"/moves.tsv"));validateTargets(read(root+"/targets.tsv"),reps);
    rowUnique(printing,reps,specs);
    let roots=readDag(dagRaw,poses,true);
    let signatures=List.map(id -> {
        let p=rowRoot(id,roots);let state=liftState(p,printing,poses);let Goal.G(y,m,_)=at(reps,id-1);rowFront(state,y,m);
        let full=rowSha(rowStateText(state));let signature=rowSignature(state,specs);
        println("row2-root\t${id}\t${full}\t${signature}");signature
    },List.range(1,92));
    require(List.length(List.distinct(signatures))==1,"same row2 full physical pose in all91 states");
    let total=List.foldLeft((n,path) -> n+rowChain(read(path),roots,printing,poses,specs),0,chains);
    let count=List.length(chains);let signature=at(signatures,0);
    println("row2-summary\tSAT_SCOPED_ENDPOINT_IDENTITY\t7\t91\t888\t${count}\t${total}\t${signature}")
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case certificate::dag::root::geometry::chains => checkRow2(certificate,dag,root,geometry,chains)
            case _ => throw new IllegalArgumentException("CERTIFICATE DAG EVIDENCE GEOMETRY [CHAIN ...]")
        }
    } catch {case ex: Exception => {println("invalid\t"+ex.toString());System.exit(1)}}
})
