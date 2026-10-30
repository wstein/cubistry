import java.lang.{IllegalArgumentException, Exception, System}
import java.nio.file.Files
import java.nio.charset.StandardCharsets
import java.io.File

def require(ok: Bool, message: String): Unit \ IO =
    if (ok) () else throw new IllegalArgumentException(message)

def leap(y: Int32): Bool = Int32.modulo(y,4) == 0 and (Int32.modulo(y,100) != 0 or Int32.modulo(y,400) == 0)
def days(y: Int32, m: Int32): Int32 =
    if (m == 2) { if (leap(y)) 29 else 28 }
    else if (m == 4 or m == 6 or m == 9 or m == 11) 30 else 31
// Number of completed days since Gregorian 0001-01-01, a Monday.
def weekday(y: Int32, m: Int32): Int32 = {
    let p = y - 1;
    Int32.modulo((365 * p + p / 4 - p / 100 + p / 400 +
        List.foldLeft((a, k) -> a + days(y,k), 0, List.range(1,m))),7)
}
def months(): List[(Int32, Int32)] =
    List.flatMap(y -> List.map(m -> (y,m), List.range(1,13)), List.range(2026,2100))

def validate(raw: String): Unit \ IO = {
    let expected = "cubistry.calendar7.months.v1\t2026\t2099\n" +
        List.foldLeft((a,b) -> a+b, "", List.map(p -> {
            let (y,m) = p;
            "${y}\t${m}\t${weekday(y,m)}\t${days(y,m)}\n"
        }, months()));
    // Exact canonical serialization rejects missing/duplicate/out-of-order records,
    // signs, spaces, alternate digits, bad UTF-8, CRLF, and missing final LF.
    require(raw == expected, "INVALID: calendar TSV differs from independent Gregorian census")
}

def orbit(row: Int32, col: Int32): (Int32, Int32) = {
    let x = col - 4; let y = 4 - row;
    match List.sort(List#{(x,y),(-y,x),(-x,-y),(y,-x)}) {
        case a :: _ => a
        case Nil => (99,99)
    }
}
def cells(): List[(Int32, Int32)] =
    List.flatMap(r -> List.map(c -> (r,c),List.range(1,8)),List.range(1,8))
def orbits(): List[(Int32,Int32)] =
    List.distinct(List.map(p -> { let (r,c)=p; orbit(r,c) },cells()))
def offset(de: Bool,y: Int32,m: Int32): Int32 =
    Int32.modulo(weekday(y,m) + (if (de) 0 else 1),7)
def red(de: Bool,c: Int32): Bool = if (de) c >= 6 else c == 1 or c == 7
def dateCell(off: Int32,d: Int32): (Int32,Int32) = {
    let index = off+d-1; let week = index/7;
    (if (week == 5) 3 else week+3, Int32.modulo(index,7)+1)
}
def dateArt(d: Int32): String = if (d == 6 or d == 9) "6/9" else "${d}"
def at(xs: List[a], i: Int32): a \ IO = match xs {
    case x :: rest => if (i == 0) x else at(rest,i-1)
    case Nil => throw new IllegalArgumentException("index")
}
def monthWord(de: Bool,m: Int32): String \ IO = at(
    if (de) List#{"JAN","FEB","MÄR","APR","MAI","JUN","JUL","AUG","SEP","OKT","NOV","DEZ"}
    else List#{"JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"},m-1)
def headers(de: Bool): List[String] = if (de)
    List#{"MON","DIE","MIT","DON","FRE","SAM","SON"}
    else List#{"SUN","MON","TUE","WED","THU","FRI","SAT"}

def labels(de: Bool,y: Int32,m: Int32,start: Int32): List[((Int32,Int32),String)] \ IO = {
    let dt = List.map(d -> {
        let (r,c)=dateCell(offset(de,y,m),d);
        (orbit(r,c),dateArt(d)+(if (red(de,c)) ":red" else ":dark"))
    },List.range(1,days(y,m)+1));
    let hd = List.map(c -> (orbit(2,c),at(headers(de),c-1)+(if (red(de,c)) ":red" else ":weekday")),List.range(1,8));
    let chars = String.toList(monthWord(de,m));
    let mo = List.map(i -> (orbit(1,start+i),"${at(chars,i)}:green"),List.range(0,3));
    List.append(dt,List.append(hd,mo))
}
def blanks(de: Bool,y: Int32,m: Int32,key: (Int32,Int32)): Int32 = {
    let occupied=List.map(d -> dateCell(offset(de,y,m),d),List.range(1,days(y,m)+1));
    List.count(p -> { let (r,c)=p;
        r >= 3 and orbit(r,c) == key and not List.memberOf(p,occupied)
    },cells())
}
def census(de: Bool): Unit \ IO = {
    List.forEach(upper -> {
        let targets=List.filter(p -> {let (y,_)=p; y<=upper},months());
        let six=List.count(p -> {let (y,m)=p; offset(de,y,m)+days(y,m)>35},targets);
        let overflow=List.foldLeft((a,p) -> {let (y,m)=p;
            Int32.max(a,Int32.max(0,offset(de,y,m)+days(y,m)-35))},0,targets);
        println("census\t${if (de) "DE" else "EN"}\t${upper}\t${List.length(targets)}\t${six}\t${overflow}");
        List.forEach(start -> {
            let arts=List.flatMap(p -> {let (y,m)=p; labels(de,y,m,start)},targets);
            let violated=List.count(key -> {
                let unique=List.distinct(List.map(p -> {let (_,s)=p;s},List.filter(p -> {let (k,_)=p;k==key},arts)));
                let blank=List.foldLeft((a,p) -> {let (y,m)=p;Int32.max(a,blanks(de,y,m,key))},0,targets);
                let capacity=if (key==(0,0)) 6 else 24;
                let n=List.length(unique);
                let (ox,oy)=key;
                println("orbit\t${if (de) "DE" else "EN"}\t${upper}\t${start}\t${ox}\t${oy}\t${n}\t${blank}\t${capacity}");
                n+blank>capacity
            },orbits());
            println("layout\t${if (de) "DE" else "EN"}\t${upper}\t${start}\t${violated}")
        },List.range(1,6))
    },List#{2026,2027,2028,2029,2039,2099})
}

def geometryChecks(): Unit \ IO = {
    require(List.length(orbits()) == 13, "orbit partition");
    List.forEach(key -> {
        let front=List.count(p -> {let (r,c)=p;orbit(r,c)==key},cells());
        // Six cube faces, each with a fourfold local rotation orbit. Only the
        // center has a stabilizer of size four: 6*1 versus 6*4 stickers.
        require(front == (if (key==(0,0)) 1 else 4), "C4 orbit size")
    },orbits());
    List.forEach(de -> List.forEach(p -> {
        let (y,m)=p; let off=offset(de,y,m);
        let positions=List.map(d -> dateCell(off,d),List.range(1,days(y,m)+1));
        require(List.length(List.distinct(positions))==days(y,m), "overflow collision");
        List.forEach(d -> {
            let (r,c)=dateCell(off,d);
            require(r>=3 and r<=7 and c==Int32.modulo(off+d-1,7)+1, "overflow column")
        },List.range(1,days(y,m)+1))
    },months()),List#{true,false})
}

def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case "physical-de-check" :: path :: certificate :: Nil => {
                geometryChecks();
                validate(Files.readString(new File(path).toPath(),StandardCharsets.UTF_8));
                physicalDeCheck(Files.readString(new File(certificate).toPath(),StandardCharsets.UTF_8))
            }
            case "physical-de" :: path :: Nil => {
                geometryChecks();
                validate(Files.readString(new File(path).toPath(),StandardCharsets.UTF_8));
                physicalDeProof()
            }
            case "moving" :: path :: candidates :: Nil => {
                geometryChecks();
                validate(Files.readString(new File(path).toPath(),StandardCharsets.UTF_8));
                movingScreen(Files.readString(new File(candidates).toPath(),StandardCharsets.UTF_8))
            }
            case "compact-prefix" :: path :: Nil => {
                geometryChecks();
                validate(Files.readString(new File(path).toPath(),StandardCharsets.UTF_8));
                compactMonthScreen(true)
            }
            case "compact" :: path :: Nil => {
                geometryChecks();
                validate(Files.readString(new File(path).toPath(),StandardCharsets.UTF_8));
                compactMonthScreen(false)
            }
            case "yearless" :: path :: Nil => {
                geometryChecks();
                validate(Files.readString(new File(path).toPath(),StandardCharsets.UTF_8));
                yearlessScreen()
            }
            case "oriented-month" :: path :: Nil => {
                geometryChecks();
                validate(Files.readString(new File(path).toPath(),StandardCharsets.UTF_8));
                orientationBoundary(List#{"month"})
            }
            case "oriented" :: path :: Nil => {
                geometryChecks();
                validate(Files.readString(new File(path).toPath(),StandardCharsets.UTF_8));
                orientationBoundary(List#{"dark","red","year"})
            }
            case path :: Nil => {
                geometryChecks();
                validate(Files.readString(new File(path).toPath(),StandardCharsets.UTF_8));
                println("valid\tcubistry.calendar7.months.v1\t888");
                census(true); census(false)
            }
            case _ => require(false,"expected calendar-months.tsv path")
        }
    } catch {
        case ex: Exception => { println("invalid\t"+ex.toString()); System.exit(1) }
    }
})
