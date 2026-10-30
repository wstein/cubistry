// Current approved compact month: one capital on sticker A, one immutable
// two-letter lowercase suffix on adjacent sticker B; no printed year.
def compactSuffix(raw: String,r: Int32,c: Int32): (String,Int32,String) =
    (raw,quarterTo(c-4,4-r,orbit(r,c),0),"month")
def compactMonthScreen(firstTwo: Bool): Unit \ IO = {
    let tag=if(firstTwo) "compact-prefix" else "compact";
    List.forEach(upper -> List.forEach(de -> {
        let targets=List.filter(p -> {let(y,_)=p;y<=upper},months());
        let base=orientedBase(de,upper);
        let blankBase=List.map(key -> (key,List.foldLeft((a,p) -> {let(y,m)=p;Int32.max(a,blanks(de,y,m,key))},0,targets)),orbits());
        List.forEach(start -> {
            let monthLabels=List.flatMap(m -> {
                let chars=String.toList(monthWord(de,m));
                let capital="${at(chars,0)}";
                let middle=String.toLowerCase("${at(chars,1)}");
                let last=String.toLowerCase("${at(chars,2)}");
                let left=if(firstTwo) compactSuffix(capital+middle,1,start)
                    else orientedArt(capital,"month",1,start);
                let right=compactSuffix(if(firstTwo) last else middle+last,1,start+1);
                List#{(orbit(1,start),left),(orbit(1,start+1),right)}
            },List.range(1,13));
            let allLabels=List.append(base,monthLabels);
            let bounds=List.map(p -> {
                let(key,b)=p;
                let unique=List.distinct(List.map(a -> {let(_,s)=a;s},List.filter(a -> {let(k0,_)=a;k0==key},allLabels)));
                let blank=b+List.count(c -> orbit(1,c)==key and c != start and c != start+1,List.range(1,8));
                (key,List.length(unique),blank,if(key==(0,0)) 6 else 24)
            },blankBase);
            let violated=List.count(p -> {let(_,n,b,c)=p;n+b>c},bounds);
            println("${tag}-layout\t${if(de) "DE" else "EN"}\t2026\t${upper}\t${start},${start+1}\t${start==1}\t${violated}");
            List.forEach(p -> {let((x,y),n,b,c)=p;
                println("${tag}-orbit\t${if(de) "DE" else "EN"}\t2026\t${upper}\t${start},${start+1}\t${x}\t${y}\t${n}\t${b}\t${c}")
            },bounds)
        },List.range(1,7))
    },List#{true,false}),List#{2026,2099})
}
