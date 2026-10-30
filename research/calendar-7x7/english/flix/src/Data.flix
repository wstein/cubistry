import java.lang.IllegalArgumentException

def vecText(v: Vec): String = {let(x,y,z)=v;"${x},${y},${z}"}
def readPrint(raw: String): Vector[Sticker] \ IO = {
    let records=match lines(raw) {
        case "sticker\tpiece\thome\tnormal\tup\ttext\tink"::rest => rest
        case _ => throw new IllegalArgumentException("physical print header")
    };
    require(List.length(records)==294,"print must have294 stickers");
    let expected=List.flatMap(p -> List.map(n -> (p,n),normals(p)),homes());
    let stickers=List.map(p -> {
        let(index,row)=p;
        match fields(row) {
            case id::piece::pos::normal::up::g::ink::Nil => {
                let sid=integer(id);let pid=integer(piece);let home=vector(pos);let n=vector(normal);let u=vector(up);
                require(sid==index+1,"sticker IDs must be consecutive");
                require((home,n)==at(expected,index),"sticker home or outward normal differs from independently derived surface");
                require(pid>=1 and pid<=218 and at(homes(),pid-1)==home,"piece ID/home mismatch");
                // Reject every unbounded coordinate before any dot/cross/frame arithmetic.
                require(unit(u),"printed actual up must be one of six signed coordinate axes");
                require(dot(u,n)==0,"printed actual up must be tangent to its validated normal");
                require((g=="" and ink=="blank") or (g != "" and List.memberOf(ink,List#{"dark","red","weekday","month"})),"glyph/ink profile");
                Sticker.S(sid,pid,home,n,u,g,ink)
            }
            case _ => throw new IllegalArgumentException("physical print row shape")
        }
    },List.zipWithIndex(records));
    require(List.length(homes())==218,"derived218 cubies");
    List.toVector(stickers)
}
def derivedPoses(): Vector[Pose] \ IO = {
    let refs=List.sort(List.distinct(List.map(bodyKey,homes())));
    require(List.length(refs)==11,"derived11 body orbits");
    let poses=List.flatMap(p -> {
        let(index,home)=p;
        let frames=List.sort(List.map(r -> (rotate(home,r),rotate((-1,0,0),r),rotate((0,1,0),r)),rotations()));
        require(List.length(List.distinct(frames))==24,"each orbit carries24 oriented poses");
        List.map(frame -> {let(pos,n,u)=frame;Pose.P(index+1,pos,n,u)},frames)
    },List.zipWithIndex(refs));
    require(List.length(poses)==264,"derived264 poses");
    List.toVector(poses)
}
def validatePoseFile(raw: String,poses: Vector[Pose]): Unit \ IO = {
    let expected="point\torbit\tbody\tnormal\tup\n"+List.foldLeft((acc,p) -> {
        let(index,pose)=p;let Pose.P(o,body,n,u)=pose;
        acc+"${index+1}\t${o}\t${vecText(body)}\t${vecText(n)}\t${vecText(u)}\n"
    },"",List.zipWithIndex(Vector.toList(poses)));
    require(raw==expected,"pose file differs from independently derived264 proper-rotation poses")
}
def validateMoves(raw: String): Unit \ IO = {
    let expected="generator\taxis\tlayer\tquarter_turn\n"+List.foldLeft((s,p) -> {
        let(i,axis,layer)=p;s+"${i}\t${axis}\t${layer}\t1\n"
    },"",List.flatMap(axis -> List.map(p -> {let(i,l)=p;((axis-1)*7+i+1,axis,l)},List.zipWithIndex(List#{"-3","-2","-1","1","2","3","all"})),List.range(1,4)));
    require(raw==expected,"moves differ from21 independent legal layer/wholecube generators")
}
def findPose(pose: Pose,poses: Vector[Pose]): Int32 \ IO =
    at(List.map(p -> {let(i,_)=p;i},List.filter(p -> {let(_,x)=p;x==pose},List.zipWithIndex(Vector.toList(poses)))),0)
def generator(index: Int32,poses: Vector[Pose]): Perm \ IO = {
    require(index>=1 and index<=21,"generator index must be1..21");
    let axis=(index-1)/7+1;let slot=Int32.modulo(index-1,7);
    let layer=at(List#{-3,-2,-1,1,2,3,0},slot);
    Vector.map(pose -> {
        let Pose.P(o,p,n,u)=pose;
        if(slot==6 or component(p,axis-1)==layer) findPose(Pose.P(o,quarter(p,axis),quarter(n,axis),quarter(u,axis)),poses)
        else findPose(pose,poses)
    },poses)
}
def frameMap(v: Vec,n: Vec,u: Vec,nn: Vec,uu: Vec): Vec =
    add(add(scale(dot(v,n),nn),scale(dot(v,u),uu)),scale(dot(v,cross(n,u)),cross(nn,uu)))
def validateTargets(raw: String,reps: List[Goal]): Unit \ IO = {
    require(List.length(reps)==91,"independent calendar has91 representative fronts");
    let expected="target\tyear\tmonth\n"+List.foldLeft((s,p) -> {
        let(i,g)=p;let Goal.G(y,m,_)=g;s+"${i+1}\t${y}\t${m}\n"
    },"",List.zipWithIndex(reps));
    require(raw==expected,"target representatives differ from independent888-month first-occurrence coverage");
    require(List.length(calendarMonths())==888,"888 months covered");
    List.forEach(p -> {let(y,m)=p;let b=goalBoard(goal(y,m));require(List.count(g -> goalBoard(g)==b,reps)==1,"each calendar month maps to exactly one representative")},calendarMonths())
}
def inventoryLowerBound(reps: List[Goal]): Int32 \ IO = {
    let keys=List.sort(List.distinct(List.map(p -> {let(r,c)=p;orbit(r,c)},cells())));
    List.foldLeft((total,key) -> {
        let perTarget=List.map(g -> List.flatMap(p -> {
            let((r,c),(text,ink))=p;
            if(orbit(r,c)==key and text != "") List#{lowerArt(text,ink,r,c)} else Nil
        },List.zip(cells(),goalBoard(g))),reps);
        let classes=List.distinct(List.flatMap(x -> x,perTarget));
        let peaks=List.map(art -> List.foldLeft((peak,arts) -> Int32.max(peak,List.count(g -> g==art,arts)),0,perTarget),classes);
        let n=List.foldLeft((a,b) -> a+b,0,peaks);
        let(x,y)=key;println("lower-orbit\t${x}\t${y}\t${List.length(classes)}\t${n}");total+n
    },0,keys)
}
def validateFrontMatches(raw: String,printing: Vector[Sticker],poses: Vector[Pose],reps: List[Goal]): Unit \ IO = {
    let records=match lines(raw) {
        case "target\tyear\tmonth\trow\tcolumn\tsource-piece\ttarget-point\tsource-point"::rest => rest
        case _ => throw new IllegalArgumentException("front matches header")
    };
    require(List.length(records)==91*49,"exactly91*49 front matches required");
    let parsed=List.map(row -> match fields(row) {
        case target::year::month::r::c::piece::tp::sp::Nil => (integer(target),integer(year),integer(month),integer(r),integer(c),integer(piece),integer(tp),integer(sp))
        case _ => throw new IllegalArgumentException("front match row shape")
    },records);
    List.forEach(target -> {
        let Goal.G(y,m,_)=at(reps,target-1);
        let rows=List.filter(p -> {let(t,_,_,_,_,_,_,_)=p;t==target},parsed);
        require(List.length(rows)==49,"target has49 matched front cells");
        require(List.length(List.distinct(List.map(p -> {let(_,_,_,_,_,pid,_,_)=p;pid},rows)))==49,"front pieces must be distinct");
        List.forEach(pair -> {
            let(i,record)=pair;let(t,yy,mm,r,c,pid,tp,sp)=record;
            require(t==target and yy==y and mm==m and (r,c)==at(cells(),i),"front match ordering/year/month/cell");
            require(pid>=1 and pid<=218 and tp>=1 and tp<=264 and sp>=1 and sp<=264,"front match IDs");
            let Pose.P(o,home,n,u)=Vector.get(sp-1,poses);let Pose.P(oo,pos,nn,uu)=Vector.get(tp-1,poses);
            require(o==oo and home==at(homes(),pid-1) and pos==(c-4,4-r,3),"source/target piece pose");
            let firstTarget=at(List.map(poseEntry -> {let(poseIndex,_)=poseEntry;poseIndex+1},List.filter(poseEntry -> {
                let(_,pose)=poseEntry;let Pose.P(_,body,_,_)=pose;body==pos
            },List.zipWithIndex(Vector.toList(poses)))),0);
            require(tp==firstTarget,"front target-point must be first lexicographic pose for its target body");
            require(frameMap(home,n,u,nn,uu)==pos,"proper frame rotation transports body");
            let front=List.filter(sticker -> {
                let Sticker.S(_,piece,_,normal,_,_,_)=sticker;
                piece==pid and frameMap(normal,n,u,nn,uu)==(0,0,1)
            },Vector.toList(printing));
            require(List.length(front)==1,"pose exposes exactly one sticker on front");
            let Sticker.S(_,_,_,_,up,text,ink)=at(front,0);
            let actualUp=frameMap(up,n,u,nn,uu);
            let(g,wantInk)=goalCell(y,m,r,c);
            require(optic(text,upAngle(actualUp),ink)==optic(g,0,wantInk),"actual physical sticker optics fail target (including core up)")
        },List.zipWithIndex(rows))
    },List.range(1,92));
    println("front-matches\t91\t4459\tVALID_SINGLE_PIECE_POSES_ONLY")
}
