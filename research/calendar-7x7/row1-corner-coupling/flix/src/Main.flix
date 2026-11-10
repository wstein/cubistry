// SPDX-License-Identifier: AGPL-3.0-or-later
// Independently derives a corner-body obstruction from the raw month layout.
import java.lang.{Exception, IllegalArgumentException, System}

type alias CFrame = (Vec,Vec,Vec,Int32)
def cornerAnchorContradiction(required: Int32,bodies: Int32,faces: Int32,peak: Int32,present: Int32,total: Int32): Bool \ IO = {
    require(bodies>0 and faces>0 and present>=0 and present<=total,"valid finite body and target counts");
    required==bodies*faces and peak==1 and total>0 and present==total and required-1>(bodies-1)*faces
}
def coupledLemmaTests(): Unit \ IO = {
    let cases=List#{
        (24,8,3,1,91,91,true),(23,8,3,1,91,91,false),(21,8,3,1,21,21,false),
        (25,8,3,1,91,91,false),(24,8,3,2,91,91,false),(24,8,3,1,90,91,false),
        (24,8,3,1,0,91,false),(24,8,3,1,0,0,false),(8,8,1,1,10,10,false),
        (3,1,3,1,1,1,true),(4,2,2,1,10,10,true)
    };
    List.forEach(p -> {
        let(i,test)=p;let(a,b,c,d,e,f,want)=test;
        require(cornerAnchorContradiction(a,b,c,d,e,f)==want,"lemma test ${i+1}")
    },List.zipWithIndex(cases));
    println("lemma-tests\t11\tPASS");println("mutations: not run (opt-in)")
}
def coupledCells(): List[(Int32,Int32)] = List#{(1,1),(1,7),(7,1),(7,7)}
def coupledMonthWords(): List[String] = List#{"JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"}
def coupledLabels(raw: String): List[List[String]] \ IO = {
    let rs=lines(raw);
    require(List.length(rs)==13 and at(rs,0)=="month\tcol1\tcol2\tcol3\tcol4\tcol5\tcol6\tcol7","layout header and twelve rows");
    List.map(pair -> {
        let(i,row)=pair;let fs=fields(row);
        require(List.length(fs)==8 and at(fs,0)=="${i+1}","ordered unique month rows");
        let ss=List.drop(1,fs);
        require(List.forAll(s -> List.forAll(c -> List.memberOf(c,String.toList("ABCDEFGHIJKLMNOPQRSTUVWXYZ")),String.toList(s)),ss),"uppercase labels");
        require(at(ss,0)!="" and List.forAll(s -> s=="",List.drop(3,ss)),"names in columns one to three");
        require(List.foldLeft((a,b) -> a+b,"",ss)==at(coupledMonthWords(),i),"full English month name");
        ss
    },List.zipWithIndex(List.drop(1,rs)))
}
def coupledOptic(g: String,a: Int32,ink: String): Art \ IO = {
    let q=Int32.modulo(a,4);
    if(g=="") {
        require(ink=="band" or ink=="blank","empty artwork ink");
        if(ink=="band") ("",q,"band") else ("",0,"blank")
    } else opticR(HalfRule.Strict,g,q,ink)
}
def coupledArt(g: String,ink: String,row: Int32,col: Int32): Art \ IO = coupledOptic(g,orbitAngle(row,col),ink)
def coupledGoals(labels: List[List[String]],profile: String,domain: String,oldRoot: String): List[Goal] \ IO =
    coupledGoalsN(labels,profile,domain,oldRoot,21)
// windowMonths counts the window months from May 2026; the default window ends in January 2028 (21 months).
def coupledGoalsN(labels: List[List[String]],profile: String,domain: String,oldRoot: String,windowMonths: Int32): List[Goal] \ IO = {
    require(windowMonths>=1 and windowMonths<=885,"window end lies within May 2026 to January 2100");
    require(profile=="names-band" or profile=="names" or profile=="scheme-a","known profile");
    require(domain=="all" or domain=="window","known domain");
    let reps=representatives();validateTargets(read(oldRoot+"/targets.tsv"),reps);
    let originals=if(domain=="all") {
        let gs=stackedGoals("F31=bfold,S30=bfold,S31=bfold;H=555555555222",reps);
        let shapes=List.map(g -> {let Goal.G(y,m,_)=g;(m,offset(y,m),monthDays(y,m))},gs);
        require(List.length(List.distinct(shapes))==91,"91 display shapes");
        require(List.forAll(y -> List.forAll(m -> List.memberOf((m,offset(y,m),monthDays(y,m)),shapes),List.range(1,13)),List.range(1900,2100)),"2400-month shape coverage");
        gs
    } else {
        let gs=List.map(i -> {
            let y=2026+(i+4)/12;let m=Int32.modulo(i+4,12)+1;
            Goal.G(y,m,stackedBoard("F31=bfold,S30=bfold,S31=bfold;H=555555555222",y,m))
        },List.range(0,windowMonths));
        require(List.length(gs)==windowMonths,"${windowMonths} window months");gs
    };
    List.map(g -> {
        let Goal.G(y,m,board)=g;
        if(profile=="scheme-a") g else Goal.G(y,m,List.map(pair -> {
            let(i,cell)=pair;
            if(i>=7) cell else {
                let t=at(at(labels,m-1),i);
                (t,if(t=="") {if(profile=="names-band") "band" else "blank"} else "month")
            }
        },List.zipWithIndex(board)))
    },originals)
}
def coupledHomes(): List[Vec] = List.flatMap(x -> List.flatMap(y -> List.map(z -> (x,y,z),List#{-3,3}),List#{-3,3}),List#{-3,3})
def coupledGeometry(): List[CFrame] \ IO = {
    let hs=coupledHomes();let rs=rotations();
    require(List.length(hs)==8 and List.length(rs)==24,"eight corners and 24 rotations");
    require(List.length(List.distinct(List.map(r -> (rotate((1,0,0),r),rotate((0,1,0),r),rotate((0,0,1),r)),rs)))==24,"24 distinct proper frames");
    List.forEach(r -> require(cross(rotate((1,0,0),r),rotate((0,1,0),r))==rotate((0,0,1),r),"proper rotation only"),rs);
    let frontCount=List.foldLeft((sum,h) -> {
        let ns=normals(h);require(List.length(ns)==3,"three faces per corner");
        sum+List.foldLeft((n,r) -> {
            let p=rotate(h,r);let count=List.count(v -> rotate(v,r)==(0,0,1),ns);
            require(count==(if(component(p,2)==3)1 else 0),"one visible face per front corner body");
            n+count
        },0,rs)
    },0,hs);
    let axes=List#{(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)};
    let frames=List.flatMap(h -> List.flatMap(n -> List.map(u -> {
        let phases=List.flatMap(r -> {
            if(rotate(n,r)!=(0,0,1)) Nil else {
                let p=rotate(h,r);let rr=4-component(p,1);let cc=component(p,0)+4;
                require(component(p,2)==3 and List.memberOf((rr,cc),coupledCells()),"corner front position");
                List#{Int32.modulo(upAngle(rotate(u,r))+orbitAngle(rr,cc),4)}
            }
        },rs);
        require(List.length(phases)==4 and List.length(List.distinct(phases))==1,"one canonical phase per physical face");
        (h,n,u,at(phases,0))
    },List.filter(u -> dot(n,u)==0,axes)),normals(h)),hs);
    require(List.length(frames)==96 and frontCount==96,"96 corner up frames and front body poses");
    frames
}
def coupledClosure(g: String,ink: String): List[(String,String)] = {
    let base=List#{(g,ink)};
    if(g=="") base else match halfWordR(HalfRule.Strict,g) {
        case None => base
        case Some(h) => List.distinct(List.append(base,List#{(h,ink)}))
    }
}
def coupledOptics(tags: List[(String,String)]): Int32 \ IO = {
    require(coupledOptic("",0,"band")!=coupledOptic("",1,"band"),"band line is asymmetric");
    require(coupledOptic("",0,"band")!=coupledOptic("",0,"blank"),"band differs from blank");
    require(coupledOptic("29",0,"red")!=coupledOptic("29",3,"red"),"red 29 transport remains distinct");
    require(coupledOptic("6",0,"red")==coupledOptic("9",2,"red"),"strict six-nine twin");
    require(coupledOptic("O",0,"month")!=coupledOptic("0",0,"month"),"no letter-digit alias");
    require(coupledOptic("O",0,"month")!=coupledOptic("O",2,"month"),"upright O");
    let samples=List.distinct(List.append(tags,List#{("0","red"),("6","red"),("9","red"),("O","month")}));
    let checks=List.flatMap(tag -> {
        let(g,ink)=tag;
        List.flatMap(src -> {let(s,si)=src;List.flatMap(a -> {
            if(coupledOptic(s,a,si)!=coupledOptic(g,0,ink)) Nil else List.map(shift -> {
                require(coupledOptic(s,a+shift,si)==coupledOptic(g,shift,ink),"optical equivalence is rotation-congruent");()
            },List.range(0,4))
        },List.range(0,4))},coupledClosure(g,ink))
    },samples);
    List.length(checks)
}
def coupledCheck(path: String,profile: String,domain: String,oldRoot: String): Unit \ IO = {
    let raw=read(path);let labels=coupledLabels(raw);let gs=coupledGoals(labels,profile,domain,oldRoot);
    require(List.forAll(g -> {let Goal.G(y,m,_)=g;y>=2000 and m>=1 and m<=12 and (y<2100 or (y==2100 and m==1))},gs),"targets lie within requested extended domain");
    let frames=coupledGeometry();let hs=coupledHomes();
    let per=List.map(g -> List.map(cell -> {
        let(r,c)=cell;let(t,ink)=at(goalBoard(g),(r-1)*7+c-1);coupledArt(t,ink,r,c)
    },coupledCells()),gs);
    let classes=List.sort(List.distinct(List.flatten(per)));
    let peaks=List.map(a -> (a,List.foldLeft((peak,xs) -> Int32.max(peak,List.count(x -> x==a,xs)),0,per)),classes);
    let tags=List.distinct(List.flatMap(g -> List.map(cell -> {
        let(r,c)=cell;at(goalBoard(g),(r-1)*7+c-1)
    },coupledCells()),gs));
    let opticChecks=coupledOptics(tags);
    require(coupledArt("29","red",7,1)!=coupledArt("29","red",7,7),"red 29 corner transport");
    let capacity=List.length(hs)*3;let required=List.foldLeft((n,p) -> {let(_,v)=p;n+v},0,peaks);
    println("input\t${stackSha(raw)}\t${profile}\t${domain}\t${List.length(gs)}");
    println("subset\t2000-01\t2100-01\t${List.length(gs)}");
    println("geometry\t24\t${List.length(hs)}\t3\t${capacity}\t${List.length(frames)}\t96\t${opticChecks}");
    List.forEach(frame -> {let(h,n,u,phase)=frame;println("frame\t${vecText(h)}\t${vecText(n)}\t${vecText(u)}\t${phase}")},frames);
    List.forEach(pair -> {
        let(i,g)=pair;let Goal.G(y,m,_)=g;
        let arts=List.map(a -> {let(t,q,ink)=a;"${t}~${q}~${ink}"},at(per,i));
        let text=List.foldLeft((s,p) -> {let(j,t)=p;s+(if(j==0)"" else"\t")+t},"",List.zipWithIndex(arts));
        println("target\t${i+1}\t${y}\t${m}\t${text}")
    },List.zipWithIndex(gs));
    List.forEach(pair -> {
        let((text,q,ink),peak)=pair;let a=(text,q,ink);
        let first=at(List.flatMap(p -> {let(i,xs)=p;if(List.count(x -> x==a,xs)==peak) List#{i+1} else Nil},List.zipWithIndex(per)),0);
        println("class\t${text}\t${q}\t${ink}\t${peak}\t${first}")
    },peaks);
    let anchors=List.filter(p -> {let(a,peak)=p;peak==1 and List.forAll(xs -> List.count(x -> x==a,xs)==1,per)},peaks);
    println("demand\t${List.length(classes)}\t${required}\t${capacity}");
    List.forEach(p -> {
        let((t,q,ink),_)=p;let availableOther=(List.length(hs)-1)*3;let neededOther=required-1;
        let present=List.count(xs -> List.memberOf((t,q,ink),xs),per);
        let applies=cornerAnchorContradiction(required,List.length(hs),3,1,present,List.length(gs));
        let status=if(applies)"CONTRADICTION" else"INAPPLICABLE";
        println("anchor\t${t}\t${q}\t${ink}\t1\t${List.length(gs)}\t${neededOther}\t${availableOther}\t${status}")
    },anchors);
    let obstructed=List.exists(p -> {let(a,peak)=p;cornerAnchorContradiction(required,List.length(hs),3,peak,List.count(xs -> List.memberOf(a,xs),per),List.length(gs))},anchors);
    let verdict=if(obstructed)"UNSAT" else"UNKNOWN";
    let reason=if(obstructed)"unique-always-visible-face" else"lemma-not-applicable";
    println("verdict\t${verdict}\tfixed-print-corner-body-matching\t${reason}")
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {match Sys.Env.getArgs() {
        case "self-test"::Nil => coupledLemmaTests()
        case path::profile::domain::oldRoot::Nil => coupledCheck(path,profile,domain,oldRoot)
        case _ => throw new IllegalArgumentException("LAYOUT_TSV names-band|names|scheme-a all|window ORIGINAL_EVIDENCE")
    }} catch {case e: Exception => {println("INVALID\t${e.getMessage()}");System.exit(1)}}
})
