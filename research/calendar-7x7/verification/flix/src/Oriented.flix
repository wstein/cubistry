// Independent implementation of the explicitly specified optimistic font profile.
// Every token stores artwork in the same reference position as its coordinate.
def quarterTo(x: Int32,y: Int32,key: (Int32,Int32),q: Int32): Int32 =
    if ((x,y)==key) q else quarterTo(-y,x,key,q+1)
def halfChar(c: Char): Option[Char] = match c {
    case '6' => Some('9')
    case '9' => Some('6')
    case _ => if (List.memberOf(c,String.toList("01258HNSXZ"))) Some(c) else None
}
def halfWord(s: String): Option[String] =
    List.foldLeft((acc,c) -> match (acc,halfChar(c)) {
        case (Some(a),Some(b)) => Some(a+"${b}")
        case _ => None
    },Some(""),List.reverse(String.toList(s)))
def orientedArt(raw: String,ink: String,r: Int32,c: Int32): (String,Int32,String) \ IO = {
    let s=String.replace(src="I",dst="1",String.replace(src="O",dst="0",raw));
    let key=orbit(r,c);
    if (s=="0") (s,0,ink) else {
        let q=quarterTo(c-4,4-r,key,0);
        let turns=if (key==(0,0)) List.range(0,4) else List#{q};
        let variants=List.flatMap(a -> match halfWord(s) {
            case None => List#{(s,a,ink)}
            case Some(h) => List#{(s,a,ink),(h,Int32.modulo(a+2,4),ink)}
        },turns);
        at(List.sort(variants),0)
    }
}
def orientedBase(de: Bool,upper: Int32): List[((Int32,Int32),(String,Int32,String))] \ IO =
    List.flatMap(p -> {
        let (y,m)=p;
        let dt=List.map(d -> {
            let (r,c)=dateCell(offset(de,y,m),d);
            (orbit(r,c),orientedArt("${d}",if(red(de,c)) "red" else "dark",r,c))
        },List.range(1,days(y,m)+1));
        let hd=List.map(c -> (orbit(2,c),orientedArt(at(headers(de),c-1),if(red(de,c)) "red" else "weekday",2,c)),List.range(1,8));
        List.append(dt,hd)
    },List.filter(p -> {let(y,_)=p;y<=upper},months()))

def orientationBoundary(inks: List[String]): Unit \ IO = {
    List.forEach(upper -> List.forEach(de -> {
        let base=orientedBase(de,upper);
        let targets=List.filter(p -> {let(y,_)=p;y<=upper},months());
        let blankBase=List.map(key -> (key,List.foldLeft((a,p) -> {let(y,m)=p;Int32.max(a,blanks(de,y,m,key))},0,targets)),orbits());
        let combinations=List.flatMap(i -> List.flatMap(j -> List.map(k -> (i,j,k),List.range(j+1,8)),List.range(i+1,7)),List.range(1,6));
        let counts=List.map(cols -> {
            let (i,j,k)=cols;
            List.foldLeft((sum,start) -> {
                if (List.memberOf(start,List#{i,j,k}) or List.memberOf(start+1,List#{i,j,k})) sum
                else sum+List.foldLeft((n,ink) -> n+List.foldLeft((total,prefix) -> {
                    let occupied=List#{i,j,k,start,start+1};
                    let quote=start-1;
                    if (prefix and (quote<1 or List.memberOf(quote,occupied))) total
                    else {
                        let topOccupied=if (prefix) quote::occupied else occupied;
                        let monthLabels=List.flatMap(m -> List.map(p -> {
                            let (index,c)=p;
                            (orbit(1,c),orientedArt("${at(String.toList(monthWord(de,m)),index)}","month",1,c))
                        },List#{(0,i),(1,j),(2,k)}),List.range(1,13));
                        let yearLabels=List.flatMap(y -> List.map(p -> {
                            let (c,d)=p;(orbit(1,c),orientedArt("${d}",ink,1,c))
                        },List#{(start,Int32.modulo(y,100)/10),(start+1,Int32.modulo(y,10))}),List.range(2026,upper+1));
                        let prefixLabels=if (prefix) List#{(orbit(1,quote),orientedArt("'","prefix",1,quote))} else Nil;
                        let allLabels=List.append(base,List.append(monthLabels,List.append(yearLabels,prefixLabels)));
                        let bounds=List.map(p -> {
                            let (key,b)=p;
                            let unique=List.distinct(List.map(a -> {let(_,s)=a;s},List.filter(a -> {let(k0,_)=a;k0==key},allLabels)));
                            let blank=b+List.count(c -> orbit(1,c)==key and not List.memberOf(c,topOccupied),List.range(1,8));
                            (key,List.length(unique),blank,if(key==(0,0)) 6 else 24)
                        },blankBase);
                        let pass=List.count(p -> {let(_,n0,b,c)=p;n0+b>c},bounds)==0;
                        if (pass) {
                            println("oriented-pass\t${if(de) "DE" else "EN"}\t${upper}\t${i},${j},${k}\t${start},${start+1}\t${ink}\t${prefix}");
                            List.forEach(p -> {let((x,y),n0,b,c)=p;
                                println("oriented-orbit\t${if(de) "DE" else "EN"}\t${upper}\t${i},${j},${k}\t${start},${start+1}\t${ink}\t${prefix}\t${x}\t${y}\t${n0}\t${b}\t${c}")
                            },bounds)
                        } else ();
                        total+(if(pass) 1 else 0)
                    }
                },0,List#{true,false}),0,inks)
            },0,List.range(1,7))
        },combinations);
        let n=List.foldLeft((a,b) -> a+b,0,counts);
        println("oriented-boundary\t${if(de) "DE" else "EN"}\t${upper}\t${n}")
    },List#{true,false}),List#{2030,2031})
}
