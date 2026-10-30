// Yearless design: exactly three left-to-right month glyphs; four top blanks.
// The calendar/year ranges are state coverage, not printed year fields.
def yearlessScreen(): Unit \ IO = {
    List.forEach(upper -> List.forEach(de -> {
        let base=orientedBase(de,upper);
        let targets=List.filter(p -> {let(y,_)=p;y<=upper},months());
        let blankBase=List.map(key -> (key,List.foldLeft((a,p) -> {let(y,m)=p;Int32.max(a,blanks(de,y,m,key))},0,targets)),orbits());
        let combinations=List.flatMap(i -> List.flatMap(j -> List.map(k -> (i,j,k),List.range(j+1,8)),List.range(i+1,7)),List.range(1,6));
        List.forEach(cols -> {
            let (i,j,k)=cols;
            let monthLabels=List.flatMap(m -> List.map(p -> {
                let(index,c)=p;
                (orbit(1,c),orientedArt("${at(String.toList(monthWord(de,m)),index)}","month",1,c))
            },List#{(0,i),(1,j),(2,k)}),List.range(1,13));
            let allLabels=List.append(base,monthLabels);
            let bounds=List.map(p -> {
                let(key,b)=p;
                let unique=List.distinct(List.map(a -> {let(_,s)=a;s},List.filter(a -> {let(k0,_)=a;k0==key},allLabels)));
                let blank=b+List.count(c -> orbit(1,c)==key and not List.memberOf(c,List#{i,j,k}),List.range(1,8));
                (key,List.length(unique),blank,if(key==(0,0)) 6 else 24)
            },blankBase);
            let violated=List.count(p -> {let(_,n,b,c)=p;n+b>c},bounds);
            let contiguous=j==i+1 and k==j+1;
            println("yearless-layout\t${if(de) "DE" else "EN"}\t2026\t${upper}\t${i},${j},${k}\t${contiguous}\t${violated}");
            List.forEach(p -> {let((x,y),n,b,c)=p;
                println("yearless-orbit\t${if(de) "DE" else "EN"}\t2026\t${upper}\t${i},${j},${k}\t${x}\t${y}\t${n}\t${b}\t${c}")
            },bounds)
        },combinations)
    },List#{true,false}),List#{2026,2099})
}
