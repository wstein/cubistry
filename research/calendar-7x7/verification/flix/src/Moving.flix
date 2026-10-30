import java.lang.IllegalArgumentException
// Month-dependent position, with exactly three uppercase glyph stickers per
// month. Blank demand is conditioned on the SAME month/year target state.
enum MovingOrbit {
    case M((Int32,Int32), List[(String,Int32,String)],
        List[List[List[(String,Int32,String)]]], List[Int32], List[Int32])
}
def movingPrepare(de: Bool): List[MovingOrbit] \ IO = {
    let base=orientedBase(de,2099);
    List.map(key -> {
        let baseArts=List.distinct(List.map(p -> {let(_,a)=p;a},List.filter(p -> {let(k,_)=p;k==key},base)));
        let monthArts=List.map(m -> List.map(start -> {
            let chars=String.toList(monthWord(de,m));
            List.map(i -> orientedArt("${at(chars,i)}","month",1,start+i),
                List.filter(i -> orbit(1,start+i)==key,List.range(0,3)))
        },List.range(1,6)),List.range(1,13));
        let monthBlank=List.map(m -> List.foldLeft((a,y) -> Int32.max(a,blanks(de,y,m,key)),0,List.range(2026,2100)),List.range(1,13));
        let topBlank=List.map(start -> List.count(c -> orbit(1,c)==key and (c<start or c>start+2),List.range(1,8)),List.range(1,6));
        MovingOrbit.M(key,baseArts,monthArts,monthBlank,topBlank)
    },orbits())
}
// Return separate base/month counts, full nonblank count, state-correct blank
// maximum, and geometric capacity. Month ink differs from other inks.
def movingDemand(profile: MovingOrbit,starts: List[Int32]): (Int32,Int32,Int32,Int32,Int32) \ IO = match profile {
    case MovingOrbit.M(key,base,monthArts,monthBlank,topBlank) => {
        let month=List.distinct(List.flatMap(p -> {let(start,choices)=p;at(choices,start-1)},List.zip(starts,monthArts)));
        let n=List.length(List.distinct(List.append(base,month)));
        let b=List.foldLeft((a,p) -> {let(start,dateBlank)=p;Int32.max(a,dateBlank+at(topBlank,start-1))},0,List.zip(starts,monthBlank));
        (List.length(base),List.length(month),n,b,if(key==(0,0)) 6 else 24)
    }
}
def movingPass(profiles: List[MovingOrbit],starts: List[Int32]): Bool \ IO = match profiles {
    case Nil => true
    case p::rest => {let(_,_,n,b,c)=movingDemand(p,starts);n+b<=c and movingPass(rest,starts)}
}
def groupAssignments(groups: Int32): List[List[Int32]] =
    if(groups==0) List#{Nil}
    else List.flatMap(start -> List.map(rest -> start::rest,groupAssignments(groups-1)),List.range(1,6))
def startDigit(c: Char): Int32 \ IO = match c {
    case '1' => 1
    case '2' => 2
    case '3' => 3
    case '4' => 4
    case '5' => 5
    case _ => throw new IllegalArgumentException("invalid moving start digit")
}
def movingRows(raw: String): List[(String,Bool,List[Int32])] \ IO = {
    let lines=List.filter(s -> s != "",String.splitOn(substr="\n",raw));
    require(raw==List.foldLeft((a,b) -> a+b+"\n","",lines),"moving TSV requires LF and nonempty rows");
    List.map(line -> match String.splitOn(substr="\t",line) {
        case name::lang::"2099"::digits::Nil => {
            require(name != "" and (lang=="DE" or lang=="EN"),"moving TSV name/language");
            require(String.length(digits)==12,"moving schedule requires twelve starts");
            (name,lang=="DE",List.map(startDigit,String.toList(digits)))
        }
        case _ => throw new IllegalArgumentException("invalid moving TSV row")
    },lines)
}
def movingScreen(raw: String): Unit \ IO = {
    let rows=movingRows(raw);
    List.forEach(de -> {
        let profiles=movingPrepare(de);
        List.forEach(record -> {
            let(name,_,starts)=record;
            let pass=movingPass(profiles,starts);
            println("moving-layout\t${name}\t${if(de) "DE" else "EN"}\t2099\t${pass}");
            List.forEach(profile -> {
                let MovingOrbit.M((x,y),_,_,_,_)=profile;
                let(base,month,n,b,c)=movingDemand(profile,starts);
                println("moving-orbit\t${name}\t${if(de) "DE" else "EN"}\t2099\t${x}\t${y}\t${base}\t${month}\t${n}\t${b}\t${c}")
            },profiles)
        },List.filter(p -> {let(_,d,_)=p;d==de},rows));
        List.forEach(groupSize -> {
            let choices=groupAssignments(12/groupSize);
            let winners=List.filter(groups -> movingPass(profiles,List.flatMap(start -> List.repeat(groupSize,start),groups)),choices);
            println("moving-family\t${if(de) "DE" else "EN"}\t${groupSize}\t${List.length(choices)}\t${List.length(winners)}");
            List.forEach(groups -> {
                let digits=List.foldLeft((a,start) -> a+List.foldLeft((s,_) -> s+"${start}","",List.range(0,groupSize)),"",groups);
                println("moving-family-pass\t${if(de) "DE" else "EN"}\t${groupSize}\t${digits}")
            },winners)
        },List#{6,3,2})
    },List#{true,false})
}
