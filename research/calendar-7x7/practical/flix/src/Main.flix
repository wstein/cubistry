import java.lang.{Exception,System,IllegalArgumentException}
import java.io.File
import java.nio.file.Files
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.HexFormat

enum Step with Eq {case M(Int32,Int32)}
enum Transition {case T(Int32,Int32,Int32,List[Step])}
def read(path: String): String \ IO = Files.readString(new File(path).toPath(),StandardCharsets.UTF_8)
def digest(raw: String): String \ IO = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)))
def readTransition(raw: String): Transition \ IO = match lines(raw) {
    case "cubistry.calendar7.practical.v1"::s::d::rest => {
        let source=match fields(s) {
            case "source"::id::Nil => integer(id)
            case _ => throw new IllegalArgumentException("source row")
        };
        let(y,m)=match fields(d) {
            case "destination"::year::month::Nil => (integer(year),integer(month))
            case _ => throw new IllegalArgumentException("destination row")
        };
        require(source>=1 and source<=91,"source target ID1..91");
        require(y>=2026 and y<=2099 and m>=1 and m<=12,"destination month in2026..2099");
        require(List.length(rest)<=100000,"bounded100000-move certificate");
        let steps=List.map(row -> match fields(row) {
            case "move"::g::q::Nil => {
                let gen=integer(g);let turns=integer(q);
                require(gen>=1 and gen<=21,"generator1..21");
                require(List.memberOf(turns,List#{-1,1,2}),"quarter exponent must be-1,1,2");
                Step.M(gen,turns)
            }
            case _ => throw new IllegalArgumentException("move row")
        },rest);
        Transition.T(source,y,m,steps)
    }
    case _ => throw new IllegalArgumentException("transition header/source/destination")
}
def stepPerm(step: Step,poses: Vector[Pose]): Perm \ IO = {
    let Step.M(g,q)=step;let p=generator(g,poses);
    if(q==1)p else if(q==2)compose(p,p)else inverse(p)
}
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
    require(optic(text,upAngle(up),ink)==optic(want,0,wantInk),"destination actual front art/orientation mismatch")
},cells())
def runTransition(root: String,geometry: String,dagPath: String,path: String): Unit \ IO = {
    let printRaw=read(root+"/physical-print.tsv");
    require(digest(printRaw)=="b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931","immutable PR99 physical printing hash");
    let printing=readPrint(printRaw);let poses=derivedPoses();
    validatePoseFile(read(geometry+"/pose-points.tsv"),poses);validateMoves(read(geometry+"/moves.tsv"));
    let reps=representatives();validateTargets(read(root+"/targets.tsv"),reps);
    let Transition.T(source,year,month,steps)=readTransition(read(path));
    let results=readDag(read(dagPath),poses,false);
    let start=match Map.get(source,results) {
        case Some(p) => p
        case None => throw new IllegalArgumentException("source root absent from legal DAG")
    };
    let Goal.G(sy,sm,_)=at(reps,source-1);
    let initial=liftState(start,printing,poses);checkFront(initial,sy,sm);
    let(end,direct)=List.foldLeft((pair,step) -> {
        let(p,state)=pair;
        (compose(p,stepPerm(step,poses)),directStep(step,state))
    },(start,initial),steps);
    let lifted=liftState(end,printing,poses);
    require(lifted==direct,"pose replay agrees with direct294-sticker physical replay");
    checkFront(lifted,year,month);
    let back=List.foldLeft((p,step) -> compose(p,inverse(stepPerm(step,poses))),end,List.reverse(steps));
    require(back==start,"inverse transition restores exact physical source");
    let htm=List.count(step -> {let Step.M(g,_)=step;Int32.modulo(g,7)!=0},steps);
    let rotations=List.length(steps)-htm;
    let qtm=List.foldLeft((n,step) -> {let Step.M(g,q)=step;n+(if(Int32.modulo(g,7)==0)0 else if(q==2)2 else 1)},0,steps);
    let rotationQtm=List.foldLeft((n,step) -> {let Step.M(g,q)=step;n+(if(Int32.modulo(g,7)!=0)0 else if(q==2)2 else 1)},0,steps);
    println("source-sha256\t${fullDigest(initial)}");
    println("endpoint-sha256\t${fullDigest(lifted)}");
    println("metrics\t${htm}\t${qtm}\t${rotations}\t${rotationQtm}\t${List.length(steps)}");
    println("status\tVALID_EXECUTABLE_TRANSITION\t218\t294\t49")
}
def parserSelftest(): Unit \ IO = {
    let valid="cubistry.calendar7.practical.v1\nsource\t2\ndestination\t2026\t3\nmove\t7\t-1\nmove\t4\t2\n";
    let Transition.T(id,y,m,steps)=readTransition(valid);
    require(id==2 and y==2026 and m==3 and steps==List#{Step.M(7,-1),Step.M(4,2)},"transition parser positive control");
    let bad=List#{
        String.replace(src="source\t2",dst="source\t0",valid),
        String.replace(src="source\t2",dst="source\t02",valid),
        String.replace(src="source\t2",dst="source\t2147483648",valid),
        String.replace(src="2026\t3",dst="2100\t3",valid),
        String.replace(src="2026\t3",dst="2026\t13",valid),
        String.replace(src="move\t7",dst="move\t22",valid),
        String.replace(src="move\t7\t-1",dst="move\t7\t0",valid),
        String.replace(src="move\t7\t-1",dst="move\t7\t-2147483648",valid),
        String.replace(src="\n",dst="\r\n",valid),
        valid+"\n",
        valid+"source\t2\n",
        "cubistry.calendar7.practical.v1\nsource\t2\ndestination\t2026\t3"
    };
    List.forEach(raw -> {
        let accepted=try {let _ = readTransition(raw);true} catch {case _: Exception => false};
        require(not accepted,"negative parser control must be rejected")
    },bad);
    println("selftest\tTRANSITION_PARSER_1_POSITIVE_12_NEGATIVE\tPASS")
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case "transition"::root::geometry::dag::path::Nil => runTransition(root,geometry,dag,path)
            case "parse"::path::Nil => {let _ = readTransition(read(path));println("status\tVALID_TRANSITION_SYNTAX_ONLY")}
            case "selftest"::Nil => parserSelftest()
            case "selftest"::root::geometry::Nil => {parserSelftest();physicalSelftest(root,geometry)}
            case _ => throw new IllegalArgumentException("transition EVIDENCE GEOMETRY DAG SEQUENCE | parse SEQUENCE | selftest")
        }
    } catch {case ex: Exception => {println("invalid\t"+ex.toString());System.exit(1)}}
})
