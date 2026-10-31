import java.lang.{Exception,System,IllegalArgumentException}
import java.io.File
import java.nio.file.Files
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.HexFormat

def read(path: String): String \ IO = Files.readString(new File(path).toPath(),StandardCharsets.UTF_8)
def dualSha(text: String): String \ IO = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)))
def dualTable(raw: String): Map[Int32,List[(String,Int32)]] \ IO = {
    require(lines(raw)==List#{"cubistry.calendar7.dual-oriented.v1","pair\t255\t8\t0\t1\t1","pair\t281\t31\t0\t24\t1"},"exact declared quarter-turn artwork profile");
    Map#{255=>List#{("8",0),("1",1)},281=>List#{("31",0),("24",1)}}
}
def dualActive(components: List[(String,Int32)],angle: Int32,ink: String): List[String] \ IO = {
    let values=List.filter(wanted -> List.exists(component -> {
        let(text,turn)=component;optic(text,Int32.modulo(angle+turn,4),ink)==optic(wanted,0,ink)
    },components),List.map(Int32.toString,List.range(1,32)));
    require(List.length(values)<=1,"at most one date label may be upright/active");values
}
def dualMatch(id: Int32,text: String,ink: String,angle: Int32,wanted: (String,String),table: Map[Int32,List[(String,Int32)]]): Bool \ IO = {
    let(g,color)=wanted;
    match Map.get(id,table) {
        case None => optic(text,angle,ink)==optic(g,0,color)
        case Some(components) => dualActive(components,angle,ink)==List#{g} and ink==color
    }
}
def dualPrint(raw: String,oldRaw: String,table: Map[Int32,List[(String,Int32)]]): Vector[Sticker] \ IO = {
    require(dualSha(oldRaw)=="b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931","unchanged PR99 printing provenance");
    let source=readPrint(raw);let old=readPrint(oldRaw);
    List.forEach(index -> {
        let Sticker.S(id,piece,pos,n,u,g,ink)=Vector.get(index,source);
        let Sticker.S(oldid,oldpiece,oldpos,oldn,oldu,oldg,oldink)=Vector.get(index,old);
        require((id,piece,pos,n,u)==(oldid,oldpiece,oldpos,oldn,oldu),"all source identities, cubies and source frames immutable");
        let expected=if(id==16 or id==40)("","blank")else if(id==255)("DUAL_1_8","dark")else if(id==281)("DUAL_24_31","red")else(oldg,oldink);
        require((g,ink)==expected,"only four declared new-candidate surfaces may change artwork");
        match Map.get(id,table) {
            case None => ()
            case Some(components) => List.forEach(q -> {let _ = dualActive(components,q,ink);()},List.range(0,4))
        }
    },List.range(0,294));
    require(List.count(s -> match s { case Sticker.S(_,_,_,_,_,g,_) => g != "" },Vector.toList(source))==238,"new candidate must have 238 nonblank surfaces");source
}
def dualStateText(state: Vector[Sticker]): String = List.foldLeft((acc,s) -> {
    let Sticker.S(id,pid,pos,n,u,text,ink)=s;
    acc+"${id}\t${pid}\t${vecText(pos)}\t${vecText(n)}\t${vecText(u)}\t${text}\t${ink}\n"
},"",Vector.toList(state))
def dualFront(state: Vector[Sticker],year: Int32,month: Int32,table: Map[Int32,List[(String,Int32)]]): Unit \ IO =
    List.forEach(cell -> {
        let(r,c)=cell;let matches=List.filter(s -> {let Sticker.S(_,_,p,n,_,_,_)=s;p==(c-4,4-r,3) and n==(0,0,1)},Vector.toList(state));
        require(List.length(matches)==1,"one physical front surface per target cell");
        let Sticker.S(id,_,_,_,up,text,ink)=at(matches,0);
        require(dualMatch(id,text,ink,upAngle(up),goalCell(year,month,r,c),table),"selected date/ordinary artwork must match exact target including orientation")
    },cells())
def dualRow(state: Vector[Sticker]): String \ IO = {
    let row=List.map(c -> {
        let matches=List.filter(s -> {let Sticker.S(_,_,p,n,_,_,_)=s;p==(c-4,2,3) and n==(0,0,1)},Vector.toList(state));
        require(List.length(matches)==1,"row2 physical surface coverage");at(matches,0)
    },List.range(1,8));
    dualSha(dualStateText(List.toVector(row)))
}
def checkDual(printPath: String,artPath: String,dagPath: String,oldRoot: String,geometry: String): Unit \ IO = {
    let table=dualTable(read(artPath));let source=dualPrint(read(printPath),read(oldRoot+"/physical-print.tsv"),table);
    let poses=derivedPoses();let reps=representatives();
    validatePoseFile(read(geometry+"/pose-points.tsv"),poses);validateMoves(read(geometry+"/moves.tsv"));validateTargets(read(oldRoot+"/targets.tsv"),reps);
    List.forEach(c -> {
        let wanted=goalCell(2026,1,2,c);
        let candidates=List.flatMap(s -> {
            let Sticker.S(id,_,_,_,_,text,ink)=s;
            List.map(q -> (id,q),List.filter(q -> dualMatch(id,text,ink,q,wanted,table),List.range(0,4)))
        },Vector.toList(source));
        require(List.length(candidates)==1,"one immutable oriented weekday surface");
        let(id,q)=at(candidates,0);require(q==0,"weekday upright");println("dual-weekday\t${c}\t${id}")
    },List.range(1,8));
    let results=readDag(read(dagPath),poses,true);
    let rows=List.map(id -> {
        let p=match Map.get(id,results){case Some(value)=>value case None=>throw new IllegalArgumentException("missing complete target")};
        let state=liftState(p,source,poses);let Goal.G(y,m,_)=at(reps,id-1);
        dualFront(state,y,m,table);let signature=dualRow(state);let full=dualSha(dualStateText(state));
        println("dual-state\t${id}\t${full}\t${signature}");signature
    },List.range(1,92));
    require(List.length(List.distinct(rows))==1,"exact row2 physical identities and poses preserved at all91 endpoints");
    let signature=at(rows,0);
    println("dual-summary\tSAT_SCOPED_ORIENTATION_SELECTION\t238\t56\t91\t888\t${signature}")
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case printing::art::dag::oldRoot::geometry::Nil => checkDual(printing,art,dag,oldRoot,geometry)
            case _ => throw new IllegalArgumentException("PRINT ART DAG ORIGINAL_EVIDENCE GEOMETRY")
        }
    } catch {case ex: Exception => {println("invalid\t"+ex.toString());System.exit(1)}}
})
