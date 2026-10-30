import java.lang.{Exception,System,IllegalArgumentException}
import java.io.File
import java.nio.file.Files
import java.nio.charset.StandardCharsets

def read(path: String): String \ IO = Files.readString(new File(path).toPath(),StandardCharsets.UTF_8)
def dataCommand(root: String,geometry: String): Unit \ IO = {
    let printing=readPrint(read(root+"/physical-print.tsv"));
    let poses=derivedPoses();
    validatePoseFile(read(geometry+"/pose-points.tsv"),poses);
    validateMoves(read(geometry+"/moves.tsv"));
    let reps=representatives();validateTargets(read(root+"/targets.tsv"),reps);
    let lower=inventoryLowerBound(reps);
    let nonblank=List.count(s -> {let Sticker.S(_,_,_,_,_,g,_)=s;g != ""},Vector.toList(printing));
    require(lower==240 and nonblank==240,"physical printing and independently derived nonblank lower bound must equal240");
    println("inventory\t294\t240\t54\tLOWER_BOUND_240_PRINT_COUNT_240");
    validateFrontMatches(read(root+"/front-matches.tsv"),printing,poses,reps);
    println("status\tVALID_DATA_AND_MINIMUM_COUNT\tPHYSICAL_FEASIBILITY_UNKNOWN_PENDING_LEGAL_SLP")
}
def legalCommand(root: String,geometry: String,dagPath: String,complete: Bool): Unit \ IO = {
    dataCommand(root,geometry);
    let printing=readPrint(read(root+"/physical-print.tsv"));let poses=derivedPoses();let reps=representatives();
    let results=readDag(read(dagPath),poses,complete);
    List.forEach(target -> match Map.get(target,results) {
        case None => require(not complete,"missing target result")
        case Some(p) => replayGoal(target,p,printing,poses,reps)
    },List.range(1,92));
    if(complete)println("status\tVALID_91_LEGAL_FULL_PHYSICAL_REPLAYS_888_MONTHS\t240_NONBLANK_EQUALS_NATIVE_LOWER_BOUND")
    else println("status\tVALID_PARTIAL_LEGAL_REPLAYS_ONLY\tFULL_PHYSICAL_SAT_UNKNOWN")
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case "data"::root::geometry::Nil => dataCommand(root,geometry)
            case "legal"::root::geometry::dagPath::Nil => legalCommand(root,geometry,dagPath,true)
            case "partial"::root::geometry::dagPath::Nil => legalCommand(root,geometry,dagPath,false)
            case "selftest"::root::geometry::Nil => physicalSelftest(root,geometry)
            case "dag"::geometry::dagPath::Nil => {let poses=derivedPoses();validatePoseFile(read(geometry+"/pose-points.tsv"),poses);let result=readDag(read(dagPath),poses,true);require(Map.size(result)==91,"91 DAG roots");println("status\tVALID_LEGAL_DAG_ONLY_NO_TARGET_CLAIM")}
            case _ => throw new IllegalArgumentException("expected data EVIDENCE_DIR GEOMETRY_DIR")
        }
    } catch {case ex: Exception => {println("invalid\t"+ex.toString());System.exit(1)}}
})
