import java.lang.IllegalArgumentException

// Isolated physical profile: fixed 555555555111 month schedule, DE, marked
// sixth-week overflow arrows, the previously declared optimistic art profile.
enum PhysRotation { case R(Int32,Int32,Int32,Int32,Int32,Int32) }
enum PhysTarget { case T(Int32,Int32,List[(String,Int32,String)],List[(String,Int32,String)]) }
def component3(p: (Int32,Int32,Int32),axis: Int32): Int32 = {
    let(x,y,z)=p;if(axis==0) x else if(axis==1) y else z
}
def physRotations(): List[PhysRotation] =
    List.flatMap(a -> List.flatMap(b -> {
        if(a==b) Nil else {
            let c=3-a-b;
            let inversions=(if(a>b) 1 else 0)+(if(a>c) 1 else 0)+(if(b>c) 1 else 0);
            let parity=if(Int32.modulo(inversions,2)==0) 1 else -1;
            List.flatMap(sx -> List.map(sy -> PhysRotation.R(a,b,c,sx,sy,parity*sx*sy),List#{-1,1}),List#{-1,1})
        }
    },List.range(0,3)),List.range(0,3))
def physRotate(p: (Int32,Int32,Int32),rot: PhysRotation): (Int32,Int32,Int32) = match rot {
    case PhysRotation.R(a,b,c,sx,sy,sz) => (sx*component3(p,a),sy*component3(p,b),sz*component3(p,c))
}
def physSurfaceKey(p: (Int32,Int32,Int32),n: (Int32,Int32,Int32)): (Int32,Int32) \ IO = {
    let points=List.map(rot -> {let(x,y,_)=physRotate(p,rot);(x,y)},List.filter(rot -> physRotate(n,rot)==(0,0,1),physRotations()));
    require(List.length(points)==4,"four rotations transport a normal to front");
    at(List.sort(points),0)
}
def physGeometry(): Unit \ IO = {
    require(List.length(physRotations())==24,"24 proper signed permutations");
    let bodies=List.distinct(List.map(rot -> physRotate((3,3,1),rot),physRotations()));
    require(List.length(bodies)==24,"wing orbit has24 bodies");
    List.forEach(p -> {
        let keys=List.map(axis -> {
            let sign=if(component3(p,axis)>0) 1 else -1;
            let normal=if(axis==0) (sign,0,0) else if(axis==1) (0,sign,0) else (0,0,sign);
            physSurfaceKey(p,normal)
        },List.filter(axis -> Int32.abs(component3(p,axis))==3,List.range(0,3)));
        require(List.sort(keys)==List#{(-3,-1),(-3,1)},"each wing has one A and one B sticker")
    },bodies);
    List.forEach(p -> {let(r,c)=p;
        require(physSurfaceKey((c-4,4-r,3),(0,0,1))==orbit(r,c),"3D front normalization agrees with native C4")
    },cells())
}
def physicalRaw(y: Int32,m: Int32,r: Int32,c: Int32): (String,String) \ IO = {
    if(r==1) {
        let start=if(m<=9) 5 else 1;
        if(c>=start and c<=start+2) ("${at(String.toList(monthWord(true,m)),c-start)}","month")
        else ("","blank")
    } else if(r==2) (at(headers(true),c-1),if(red(true,c)) "red" else "weekday")
    else {
        let dates=List.filter(d -> dateCell(offset(true,y,m),d)==(r,c),List.range(1,days(y,m)+1));
        match dates {
            case Nil => ("","blank")
            case d::Nil => {
                let overflow=(offset(true,y,m)+d-1)/7==5;
                ("${d}"+(if(overflow) "↶" else ""),if(red(true,c)) "red" else "dark")
            }
            case _ => throw new IllegalArgumentException("physical target date collision")
        }
    }
}
def physicalGlyph(y: Int32,m: Int32,r: Int32,c: Int32): (String,Int32,String) \ IO = {
    let(g,ink)=physicalRaw(y,m,r,c);
    if(g=="") ("",0,"blank") else orientedArt(g,ink,r,c)
}
def physTargets(): List[PhysTarget] \ IO =
    List.map(p -> {
        let(y,m)=p;
        let a=List.map(cell -> {let(r,c)=cell;physicalGlyph(y,m,r,c)},List.filter(cell -> {let(r,c)=cell;orbit(r,c)==(-3,-1)},cells()));
        let b=List.map(cell -> {let(r,c)=cell;physicalGlyph(y,m,r,c)},List.filter(cell -> {let(r,c)=cell;orbit(r,c)==(-3,1)},cells()));
        PhysTarget.T(y,m,a,b)
    },months())
def targetSide(t: PhysTarget,side: Int32): List[(String,Int32,String)] = match t {
    case PhysTarget.T(_,_,a,b) => if(side==0) a else b
}
def physCount(art: (String,Int32,String),t: PhysTarget,side: Int32): Int32 = List.count(g -> g==art,targetSide(t,side))
def physPeak(art: (String,Int32,String),targets: List[PhysTarget],side: Int32): Int32 =
    List.foldLeft((a,t) -> Int32.max(a,physCount(art,t,side)),0,targets)
def physicalDeProof(): Unit \ IO = {
    physGeometry();
    let targets=physTargets();
    let classesA=List.sort(List.distinct(List.flatMap(t -> targetSide(t,0),targets)));
    let classesB=List.sort(List.distinct(List.flatMap(t -> targetSide(t,1),targets)));
    let blank=("",0,"blank");
    List.forEach(p -> {
        let(side,classes)=p;
        let peaks=List.map(g -> physPeak(g,targets,side),classes);
        let total=List.foldLeft((a,b) -> a+b,0,peaks);
        require(total==24 and List.length(classes)==23,"tight DE wing inventory:22 nonblank singles and2 blanks");
        List.forEach(g -> {
            let peak=physPeak(g,targets,side);
            require(peak==(if(g==blank) 2 else 1),"every nonblank has unique physical copy");
            let(text,angle,ink)=g;
            println("physical-class\t${side}\t${text}\t${angle}\t${ink}\t${peak}")
        },classes);
        println("physical-quota\t${side}\t${total}")
    },List#{(0,classesA),(1,classesB)});
    let nov=at(List.filter(t -> match t {case PhysTarget.T(y,m,_,_) => y==2026 and m==11},targets),0);
    let allowed=List.filter(g -> {
        let peak=physPeak(g,targets,0);
        let witnesses=List.filter(t -> physCount(g,t,0)==peak and physCount(blank,t,1)==2,targets);
        let(text,angle,ink)=g;
        match witnesses {
            case t::_ => {
                let PhysTarget.T(y,m,_,_)=t;
                println("physical-exclusion\t${text}\t${angle}\t${ink}\t${peak}\t${y}\t${m}\t${physCount(g,t,0)}\t${physCount(blank,t,1)}");false
            }
            case Nil => {
                println("physical-allowed\t${text}\t${angle}\t${ink}\t${peak}\t${physCount(g,nov,0)}");true
            }
        }
    },classesA);
    require(List.length(allowed)==3,"exactly3 possible A partners for either B blank");
    require(List.count(g -> physCount(g,nov,0)==physPeak(g,targets,0),allowed)==List.length(allowed),"Nov target exhausts every allowed A partner");
    require(physCount(blank,nov,1)>0,"Nov target requires B blank");
    // Any piece bearing a B blank must have an allowed A art. All copies of
    // every such A art must face front in Nov. A wing cannot expose both
    // perpendicular stickers on the front. Thus no B blank can face front.
    println("physical-obstruction\t2026\t11\t${physCount(blank,nov,1)}\t${List.length(classesA)-List.length(allowed)}\t${List.length(allowed)}");
    println("physical-result\tDE_FIXED_MARKED_PROFILE_REJECTED_BY_NECESSARY_WING_COUPLING")
}


def physArtId(g: (String,Int32,String),classes: List[(String,Int32,String)]): Int32 =
    List.foldLeft((a,p) -> {let(i,art)=p;if(art==g) i+1 else a},0,List.zipWithIndex(classes))
def physicalCertificate(targets: List[PhysTarget],classesA: List[(String,Int32,String)],classesB: List[(String,Int32,String)]): String \ IO = {
    let blank=("",0,"blank");
    let header="cubistry.calendar7.blank-obstruction.v1\nscope\tDE\t2026\t2099\t555555555111\tmarked-overflow\tno-year\ncoupling\tA\t-3\t-1\tB\t-3\t1\t24\n";
    let inventory=List.foldLeft((acc,p) -> {
        let(side,name,classes)=p;
        let rows=List.foldLeft((out,g) -> {
            let(text,angle,ink)=g;
            out+"class\t${name}\t${physArtId(g,classes)}\t${text}\t${angle}\t${ink}\t${physPeak(g,targets,side)}\n"
        },"",classes);
        acc+"inventory\t${name}\t24\t${List.length(classes)}\n"+rows
    },"",List#{(0,"A",classesA),(1,"B",classesB)});
    let exclusions=List.foldLeft((acc,g) -> {
        let peak=physPeak(g,targets,0);
        let witnesses=List.filter(t -> physCount(g,t,0)==peak and physCount(blank,t,1)==2,targets);
        let id=physArtId(g,classesA);
        acc+(match witnesses {
            case Nil => "allowed-partner\t${id}\n"
            case t::_ => {let PhysTarget.T(y,m,_,_)=t;
                "excluded-partner\t${id}\t${y}\t${m}\t${physCount(g,t,0)}\t${physCount(blank,t,1)}\n"
            }
        })
    },"",classesA);
    let nov=at(List.filter(t -> match t {case PhysTarget.T(y,m,_,_) => y==2026 and m==11},targets),0);
    let obstruction="obstruction\t2026\t11\t${physArtId(blank,classesB)}\t${physCount(blank,nov,1)}\n";
    let positions=List.filter(p -> {let(r,c)=p;let key=orbit(r,c);key==(-3,-1) or key==(-3,1)},cells());
    let rows=List.foldLeft((acc,p) -> {
        let(r,c)=p;
        let sideA=orbit(r,c)==(-3,-1);
        let(g,ink)=physicalRaw(2026,11,r,c);
        let art=physicalGlyph(2026,11,r,c);
        let id=physArtId(art,if(sideA) classesA else classesB);
        acc+"obstruction-cell\t${if(sideA) "A" else "B"}\t${r}\t${c}\t${id}\t${g}\t${ink}\n"
    },"",positions);
    header+inventory+exclusions+obstruction+rows
}
def physicalDeCheck(raw: String): Unit \ IO = {
    let targets=physTargets();
    let classesA=List.sort(List.distinct(List.flatMap(t -> targetSide(t,0),targets)));
    let classesB=List.sort(List.distinct(List.flatMap(t -> targetSide(t,1),targets)));
    require(raw==physicalCertificate(targets,classesA,classesB),"INVALID physical DE certificate: differs from native independent regeneration");
    physicalDeProof();
    println("physical-certificate\tVALID_NATIVE_REGENERATION_AND_NECESSARY_COUPLING_OBSTRUCTION")
}
