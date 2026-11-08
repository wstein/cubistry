// SPDX-License-Identifier: AGPL-3.0-or-later
// Flix replay of the strict upright move words (research/calendar-7x7/upright-moves).
// It reads the print itself, rebuilds the 91 front boards from the calendar rules itself
// (month letters scheme A, Sunday-first weekdays, split labels d/(d+7) for six-week
// months), applies the words on the 294 stickers with its own move geometry, recomputes
// the HTM and applies the selected half-turn rule through opticR of Core.flix.
// It shares no code with the Julia checkers.
//   replay RULE PRINT MOVES_TSV    RULE = strict | legacy; exit 1 unless all 91 are accepted
//   selftest                       self-test of both rules (exit 1 on any failure)
// Uses only Core.flix of ../../english/flix (see build.sh).
import java.io.File
import java.lang.{Exception,System,IllegalArgumentException}
import java.nio.file.Files
import java.nio.charset.StandardCharsets

def read(path: String): String \ IO = Files.readString(new File(path).toPath(),StandardCharsets.UTF_8)

def ruleName(rule: HalfRule): String = match rule {
    case HalfRule.Legacy => "legacy"
    case HalfRule.Strict => "strict"
}
def parseRule(s: String): HalfRule \ IO =
    if(s=="legacy") HalfRule.Legacy else if(s=="strict") HalfRule.Strict
    else throw new IllegalArgumentException("rule must be legacy or strict")

// ---- print: 294 stickers (id, piece, home, normal, up, text, ink) ----------------------
def readStickers(raw: String): List[Sticker] \ IO = {
    let records=match lines(raw) {
        case "sticker\tpiece\thome\tnormal\tup\ttext\tink"::rest => rest
        case _ => throw new IllegalArgumentException("print header")
    };
    require(List.length(records)==294,"print must have 294 stickers");
    List.map(p -> {
        let(index,row)=p;
        match fields(row) {
            case id::piece::pos::normal::up::g::ink::Nil => {
                let sid=integer(id);
                require(sid==index+1,"sticker IDs must be consecutive");
                Sticker.S(sid,integer(piece),vector(pos),vector(normal),vector(up),g,ink)
            }
            case _ => throw new IllegalArgumentException("print row shape")
        }
    },List.zipWithIndex(records))
}

// ---- the front board of one month ------------------------------------------------------
def boardOf(y: Int32,m: Int32): List[(String,String)] \ IO = {
    let off=offset(y,m);let n=monthDays(y,m);
    let weeks=(off+n-1)/7+1;
    let s0=if(m<=9)5 else 2;
    List.map(p -> {
        let(r,c)=p;
        if(r==1) {
            if(c>=s0 and c<=s0+2) ("${at(String.toList(monthWord(m)),c-s0)}","month") else ("","blank")
        } else if(r==2) (header(c),if(weekend(c))"red" else "weekday")
        else {
            let hits=List.filter(d -> {
                let w=(off+d-1)/7;
                Int32.modulo(off+d-1,7)+1==c and w+3==r and (weeks<=5 or w<5)
            },List.range(1,n+1));
            match hits {
                case Nil => ("","blank")
                case d::Nil => {
                    let w=(off+d-1)/7;
                    let text=if(weeks>5 and w==4 and d+7<=n) "${d}/${d+7}" else "${d}";
                    (text,if(weekend(c))"red" else "dark")
                }
                case _ => throw new IllegalArgumentException("date cell collision")
            }
        }
    },cells())
}
def displayBoards(): List[List[(String,String)]] \ IO =
    List.distinct(List.map(p -> {let(y,m)=p;boardOf(y,m)},calendarMonths()))

// ---- own move geometry (generators 1..21: axis, layer -3..-1,1..3, 7 = whole cube) -------
def turnOnce(g: Int32,s: Sticker): Sticker = {
    let axis=(g-1)/7+1;
    let slot=Int32.modulo(g-1,7);
    let layer=if(slot<3) slot-3 else slot-2;
    let Sticker.S(id,piece,pos,n,u,text,ink)=s;
    if(slot==6 or component(pos,axis-1)==layer)
        Sticker.S(id,piece,quarter(pos,axis),quarter(n,axis),quarter(u,axis),text,ink)
    else s
}
def applyMove(g: Int32,state: List[Sticker]): List[Sticker] = {
    let a=Int32.abs(g);
    let times=if(g>0)1 else 3;
    List.foldLeft((st,_k) -> List.map(s -> turnOnce(a,s),st),state,List.range(0,times))
}
// HTM: merge adjacent equal generators (net quarter turns mod 4); rotations are free.
def pushRun(a: Int32,t: Int32,rest: List[(Int32,Int32)]): List[(Int32,Int32)] = {
    let q=Int32.modulo(t+4,4);
    if(q==0) rest else (a,q)::rest
}
def htmOf(word: List[Int32]): Int32 = {
    let runs=List.foldLeft((stack,g) -> {
        let a=Int32.abs(g);let t=if(g>0)1 else -1;
        match stack {
            case (b,u)::rest => if(b==a) pushRun(a,u+t,rest) else pushRun(a,t,stack)
            case Nil => pushRun(a,t,stack)
        }
    },Nil,word);
    List.count(p -> {let(a,_)=p;Int32.modulo(a,7) != 0},runs)
}

// ---- front rule: number of front cells that do not read as the board cell ---------------
def angleOf(up: Vec): Int32 =
    match List.filter(p -> {let(_,v)=p;v==up},List.zipWithIndex(List#{(0,1,0),(-1,0,0),(0,-1,0),(1,0,0)})) {
        case (i,_)::_ => i
        case Nil => -1
    }
def frontBad(rule: HalfRule,state: List[Sticker],board: List[(String,String)]): Int32 \ IO =
    List.foldLeft((bad,q) -> {
        let((r,c),(w,wi))=q;
        let hits=List.filter(s -> {let Sticker.S(_,_,pos,n,_,_,_)=s;pos==(c-4,4-r,3) and n==(0,0,1)},state);
        match hits {
            case s::Nil => {
                let Sticker.S(_,_,_,_,u,text,ink)=s;
                let a=angleOf(u);
                if(a<0) bad+1
                else if(opticR(rule,text,a,ink)==opticR(rule,w,0,wi)) bad else bad+1
            }
            case _ => throw new IllegalArgumentException("front cell must carry exactly one sticker")
        }
    },0,List.zip(cells(),board))

// ---- replay -----------------------------------------------------------------------------
def replay(rule: HalfRule,printPath: String,movesPath: String): Int32 \ IO = {
    let stickers=readStickers(read(printPath));
    let types=displayBoards();
    require(List.length(types)==91,"expected 91 distinct display boards");
    let rows=match lines(read(movesPath)) {
        case _::rest => rest
        case Nil => throw new IllegalArgumentException("moves header")
    };
    require(List.length(rows)==91,"need one word per display (91)");
    println("move-header\trule\tid\tyear\tmonth\tverdict\thtm\tbad_cells");
    let(fails,seen)=List.foldLeft((acc,row) -> {
        let(nf,seenSoFar)=acc;
        match fields(row) {
            case idS::yS::mS::status::htmS::wordS::_::Nil => {
                let id=integer(idS);let y=integer(yS);let m=integer(mS);
                let board=boardOf(y,m);
                require(List.memberOf(board,types) and not List.memberOf(board,seenSoFar),"display ${id} duplicates or is not one of the 91 boards");
                let found=status=="FOUND_GLOBAL" or status=="FOUND_ORBIT" or String.contains(substr="FOUND_HYBRID",status);
                let(verdict,h,bad)=if(found) {
                    let word=List.map(integer,String.splitOn(substr=",",wordS));
                    List.forEach(g -> require(g != 0 and Int32.abs(g)<=21,"generator outside 1..21 (no layer 0)"),word);
                    let state=List.foldLeft((st,g) -> applyMove(g,st),stickers,word);
                    require(List.length(List.distinct(List.map(s -> {let Sticker.S(_,_,p,n,_,_,_)=s;(p,n)},state)))==294,"state must keep 294 distinct surfaces");
                    let hh=htmOf(word);
                    let bb=frontBad(rule,state,board);
                    let vv=if(bb>0) "REJECT_FRONT" else if(hh != integer(htmS)) "REJECT_HTM_MISMATCH" else "ACCEPT";
                    (vv,hh,bb)
                } else ("REJECT_NO_WORD",-1,-1);
                println("move-check\t${ruleName(rule)}\t${id}\t${y}\t${m}\t${verdict}\t${h}\t${bad}");
                (nf+(if(verdict=="ACCEPT")0 else 1),board::seenSoFar)
            }
            case _ => throw new IllegalArgumentException("moves row shape")
        }
    },(0,Nil),rows);
    require(List.length(seen)==91,"91 distinct displays required");
    println("move-verdict\t${ruleName(rule)}\t${if(fails==0)"ACCEPT_ALL_91" else "REJECT"}\t${91-fails}\t${fails}");
    fails
}

// ---- self-test of the rule ---------------------------------------------------------------
def same(rule: HalfRule,a: String,qa: Int32,b: String,qb: Int32): Bool \ IO =
    opticR(rule,a,qa,"dark")==opticR(rule,b,qb,"dark")
def expect(name: String,rule: HalfRule,got: Bool,want: Bool): Int32 \ IO = {
    let ok=got==want;
    println("rule-selftest\t${ruleName(rule)}\t${name}\t${got}\t${if(ok)"PASS" else "FAIL"}");
    if(ok) 0 else 1
}
def selftestRule(rule: HalfRule): Int32 \ IO = {
    let strict=rule==HalfRule.Strict;
    expect("six-nine-half-turn",rule,same(rule,"6",2,"9",0),true) +
    expect("six-quarter-turn-differs",rule,same(rule,"6",1,"6",0),false) +
    expect("six-half-turn-not-upright",rule,same(rule,"6",2,"6",0),false) +
    expect("zero-any-turn",rule,same(rule,"0",1,"0",0),true) +
    expect("eight-half-turn",rule,same(rule,"8",2,"8",0),not strict) +
    expect("N-half-turn",rule,same(rule,"N",2,"N",0),not strict) +
    expect("12-vs-21-half-turn",rule,same(rule,"12",2,"21",0),not strict) +
    expect("letter-O-is-zero",rule,same(rule,"O",0,"0",0),not strict) +
    expect("letter-I-is-one",rule,same(rule,"I",0,"1",0),not strict) +
    expect("half-char-eight",rule,halfCharR(rule,'8')==Some('8'),not strict) +
    expect("half-char-zero",rule,halfCharR(rule,'0')==Some('0'),true) +
    expect("half-char-six",rule,halfCharR(rule,'6')==Some('9'),true) +
    expect("old-optic-is-legacy",rule,optic("O",0,"dark")==opticR(HalfRule.Legacy,"O",0,"dark") and halfChar('8')==halfCharR(HalfRule.Legacy,'8'),true)
}
def selftest(): Int32 \ IO = {
    let bad=selftestRule(HalfRule.Legacy)+selftestRule(HalfRule.Strict);
    println("rule-selftest-verdict\t${if(bad==0)"PASS" else "FAIL"}\t${bad}");
    bad
}

def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case "replay"::r::printPath::movesPath::Nil => {
                let fails=replay(parseRule(r),printPath,movesPath);
                if(fails != 0) System.exit(1) else ()
            }
            case "selftest"::Nil => {
                let bad=selftest();
                if(bad != 0) System.exit(1) else ()
            }
            case _ => throw new IllegalArgumentException("replay RULE PRINT MOVES_TSV | selftest")
        }
    } catch {case ex: Exception => {println("invalid\t"+ex.toString());System.exit(1)}}
})
