// SPDX-License-Identifier: AGPL-3.0-or-later
// Independently reads the raw label table and builds oriented peak demands.
import java.lang.{Exception, IllegalArgumentException, System}

def nameRows(raw: String): List[List[String]] \ IO = {
    let rows=lines(raw);
    require(List.length(rows)==13 and at(rows,0)=="month\tcol1\tcol2\tcol3\tcol4\tcol5\tcol6\tcol7","layout header and twelve months");
    List.map(p -> {
        let(i,row)=p;let f=fields(row);
        require(List.length(f)==8 and at(f,0)=="${i+1}","one ordered row per month");
        let labels=List.drop(1,f);
        require(List.forAll(t -> List.forAll(c -> List.memberOf(c,String.toList("ABCDEFGHIJKLMNOPQRSTUVWXYZ")),String.toList(t)),labels),"uppercase labels only");
        require(at(labels,0)!="" and List.forAll(t -> t=="",List.drop(3,labels)),"names only in columns 1..3");
        labels
    },List.zipWithIndex(List.drop(1,rows)))
}
def nameArt(text: String,ink: String,row: Int32,col: Int32): Art \ IO = {
    let angles=if(orbit(row,col)==(0,0)) List.range(0,4) else List#{orbitAngle(row,col)};
    at(List.sort(List.map(q -> opticR(HalfRule.Strict,text,q,ink),angles)),0)
}
def namesInventory(path: String,layout: String,oldRoot: String): Unit \ IO = {
    let raw=read(path);let labels=nameRows(raw);
    require(layout=="scheme-a" or layout=="names","unknown layout");
    require(nameArt("29","red",7,1)!=nameArt("29","red",7,7),"corner 29 transport differs");
    require(nameArt("O","month",1,1)!=nameArt("0","month",1,1),"O is not zero");
    require(nameArt("N","month",1,1)!=nameArt("N","month",7,7),"N is not half-turn neutral");
    require(nameArt("O","month",1,1)!=nameArt("O","month",7,7),"O is not rotation neutral");
    require(nameArt("OC","month",1,1)!=nameArt("OC","month",7,7),"multi-letter labels are upright");
    let reps=representatives();validateTargets(read(oldRoot+"/targets.tsv"),reps);
    let original=stackedGoals("F31=bfold,S30=bfold,S31=bfold;H=555555555222",reps);
    let shapes=List.map(g -> {let Goal.G(y,m,_)=g;(m,offset(y,m),monthDays(y,m))},original);
    require(List.length(List.distinct(shapes))==91,"91 display shapes");
    require(List.forAll(y -> List.forAll(m -> List.memberOf((m,offset(y,m),monthDays(y,m)),shapes),List.range(1,13)),List.range(1900,2100)),"2400 months covered by the 91 display shapes");
    let goals=List.map(g -> {
        let Goal.G(y,m,board)=g;
        if(layout=="scheme-a") g else Goal.G(y,m,List.map(p -> {
            let(i,cell)=p;
            if(i>=7) cell else {let t=at(at(labels,m-1),i);(t,if(t=="") "blank" else "month")}
        },List.zipWithIndex(board)))
    },original);
    require(List.length(goals)==91 and List.length(List.distinct(List.map(goalBoard,goals)))==91,"91 distinct displays");
    println("input\t${stackSha(raw)}\t${layout}\tstrict\t91\t1900-01\t2099-12\t2400");
    let keys=List.sort(List.distinct(List.map(p -> {let(r,c)=p;orbit(r,c)},cells())));
    let reserves=List.map(key -> {
        let per=List.map(g -> List.flatMap(p -> {
            let((r,c),(text,ink))=p;
            if(orbit(r,c)!=key) Nil else List#{if(text=="") ("",0,"blank") else nameArt(text,ink,r,c)}
        },List.zip(cells(),goalBoard(g))),goals);
        let classes=List.sort(List.distinct(List.flatten(per)));
        let peaks=List.map(a -> (a,List.foldLeft((n,items) -> Int32.max(n,List.count(x -> x==a,items)),0,per)),classes);
        let printed=List.foldLeft((n,p) -> {let((text,_,_),count)=p;if(text=="") n else n+count},0,peaks);
        let blank=List.foldLeft((n,p) -> {let((text,_,_),count)=p;if(text=="") count else n},0,peaks);
        let cap=if(key==(0,0)) 6 else 24;let reserve=cap-printed-blank;let(x,y)=key;
        println("orbit\t${x}\t${y}\t${printed}\t${blank}\t${cap}\t${reserve}");
        List.forEach(p -> {let((text,q,ink),count)=p;println("class\t${x}\t${y}\t${text}\t${q}\t${ink}\t${count}")},peaks);
        reserve
    },keys);
    let over=List.count(n -> n<0,reserves);let verdict=if(over==0) "NOT_OBSTRUCTED" else "OBSTRUCTED";
    println("inventory\t${verdict}\t${over}\tphysical=UNKNOWN")
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {match Sys.Env.getArgs() {
        case path::layout::oldRoot::Nil => namesInventory(path,layout,oldRoot)
        case _ => throw new IllegalArgumentException("LAYOUT_TSV scheme-a|names ORIGINAL_EVIDENCE")
    }} catch {case e: Exception => {println("INVALID\t${e.getMessage()}");System.exit(1)}}
})
