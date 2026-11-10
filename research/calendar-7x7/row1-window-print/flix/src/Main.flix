// SPDX-License-Identifier: AGPL-3.0-or-later
// Raw immutable printing and rigid front matching verifier; no solver dependency.
import java.lang.{Exception, IllegalArgumentException, System}

def windowReadPrint(raw: String): Vector[Sticker] \ IO = {
    let records=match lines(raw) {
        case "sticker\tpiece\thome\tnormal\tup\ttext\tink"::rest => rest
        case _ => throw new IllegalArgumentException("294-surface print header")
    };
    require(List.length(records)==294,"294 fixed print surfaces");
    let expected=List.flatMap(pair -> {let(i,h)=pair;List.map(n -> (i+1,h,n),normals(h))},List.zipWithIndex(homes()));
    let source=List.map(pair -> {
        let(i,row)=pair;
        match fields(row) {
            case id::pid::hp::np::up::text::ink::Nil => {
                let sid=integer(id);let piece=integer(pid);let h=vector(hp);let n=vector(np);let u=vector(up);
                require(sid==i+1 and (piece,h,n)==at(expected,i),"fixed physical surface geometry and identity");
                require(unit(u) and dot(u,n)==0,"axis-aligned tangent print up");
                require((text=="" and (ink=="band" or ink=="blank")) or (text != "" and List.memberOf(ink,List#{"month","weekday","red","dark"})),"print text/ink profile");
                Sticker.S(sid,piece,h,n,u,text,ink)
            }
            case _ => throw new IllegalArgumentException("physical print row shape")
        }
    },List.zipWithIndex(records));
    require(List.length(List.distinct(List.map(s -> {let Sticker.S(_,_,h,_,_,_,_)=s;h},source)))==218,"218 printed physical bodies");
    List.toVector(source)
}
def windowCheck(layoutPath: String,printPath: String,matchesPath: String,oldRoot: String): Unit \ IO = {
    let rawLayout=read(layoutPath);let labels=coupledLabels(rawLayout);
    let goals=coupledGoals(labels,"names-band","window",oldRoot);
    let rawPrint=read(printPath);let printing=windowReadPrint(rawPrint);
    let rawMatches=read(matchesPath);
    let records=match lines(rawMatches) {
        case "target\tyear\tmonth\trow\tcolumn\tpiece\tx-image\ty-image\tz-image"::rest => rest
        case _ => throw new IllegalArgumentException("21 complete front matches")
    };
    require(List.length(goals)==21 and List.length(records)==21*49,"21 complete front matches");
    let rs=rotations();require(List.length(rs)==24,"24 proper rotations");
    List.forEach(r -> require(cross(rotate((1,0,0),r),rotate((0,1,0),r))==rotate((0,0,1),r),"proper rotation only"),rs);
    println("input\t${stackSha(rawLayout)}\t${stackSha(rawPrint)}\t${stackSha(rawMatches)}");
    println("printing\t294\t218\t21\t1029");
    List.forEach(pair -> {
        let(i,g)=pair;let Goal.G(y,m,board)=g;
        let matches=List.map(cell -> {
            let(r,c)=cell;
            match fields(at(records,i*49+(r-1)*7+c-1)) {
                case target::yy::mm::rr::cc::piece::xx::xy::xz::Nil => {
                    let pid=integer(piece);
                    require((integer(target),integer(yy),integer(mm),integer(rr),integer(cc))==(i+1,y,m,r,c),"match ordering and target date");
                    require(pid>=1 and pid<=218,"physical body ID");
                    let basis=(vector(xx),vector(xy),vector(xz));
                    let rotationsFound=List.filter(q -> (rotate((1,0,0),q),rotate((0,1,0),q),rotate((0,0,1),q))==basis,rs);
                    require(List.length(rotationsFound)==1,"one proper rigid body rotation");
                    let rot=at(rotationsFound,0);let home=at(homes(),pid-1);let pos=(c-4,4-r,3);
                    require(rotate(home,rot)==pos,"rigid body reaches its declared front position");
                    let visible=List.filter(s -> {
                        let Sticker.S(_,p,_,n,_,_,_)=s;p==pid and rotate(n,rot)==(0,0,1)
                    },Vector.toList(printing));
                    require(List.length(visible)==1,"one front surface per rigid body");
                    let Sticker.S(_,_,_,_,u,text,ink)=at(visible,0);let actualUp=rotate(u,rot);
                    let(t,wi)=at(board,(r-1)*7+c-1);
                    require(coupledOptic(text,upAngle(actualUp),ink)==coupledOptic(t,0,wi),"exact upright front artwork including band line");
                    (pid,"${pid};${vecText(pos)};0,0,1;${vecText(actualUp)};${text};${ink}\n")
                }
                case _ => throw new IllegalArgumentException("front match row shape")
            }
        },cells());
        require(List.length(List.distinct(List.map(p -> {let(pid,_)=p;pid},matches)))==49,"one distinct physical body per front cell");
        let snapshot=List.foldLeft((s,p) -> {let(_,text)=p;s+text},"",matches);
        println("target\t${i+1}\t${y}\t${m}\t49\t${stackSha(snapshot)}")
    },List.zipWithIndex(goals));
    println("verdict\tSAT\tfixed-print-rigid-front-matching\t21\t1029\tlegal-states=UNKNOWN\tchain=NOT_RUN")
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {match Sys.Env.getArgs() {
        case layout::printing::matches::oldRoot::Nil => windowCheck(layout,printing,matches,oldRoot)
        case _ => throw new IllegalArgumentException("LAYOUT_TSV PRINT_TSV FRONT_MATCHES_TSV ORIGINAL_EVIDENCE")
    }} catch {case e: Exception => {println("INVALID\t${e.getMessage()}");System.exit(1)}}
})
