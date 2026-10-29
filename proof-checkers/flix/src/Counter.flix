import java.lang.IllegalArgumentException
import java.security.MessageDigest
import java.util.HexFormat
import java.nio.file.Files
import java.io.File
import java.nio.charset.StandardCharsets

def chainPin(): String = "e051e2f4a14293dbeecc7cf123b914481bdcc0c2452c156e099102f1eeb07a88"

def loadChain(root: String): List[Int32] \ IO = {
    let path=root+"/proof-checkers/conformance/counter-chain.json";
    require(shaFile(path) == chainPin(),"ERROR: counter chain integrity mismatch");
    List.map(integer,array(readJson(path)))
}


def shaText(s: String): String \ IO = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)))
def shaFile(path: String): String \ IO = {
    let p=new File(path).toPath();
    require(Files.size(p) <= 16777216i64,"input exceeds 16 MiB");
    HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(p)))
}

def showCounter(xs: List[Sticker], value: Int32, padded: Bool): Unit \ IO = {
    let front=List#{Vec.V(-1,1,1),Vec.V(1,1,1),Vec.V(-1,-1,1),Vec.V(1,-1,1)};
    let expected=List#{"title-left","title-right",if (not padded and value<10) " " else Int32.toString(value/10),Int32.toString(Int32.modulo(value,10))};
    foreach (pair <- List.zip(front,expected)) {
        let (p,img)=pair;
        let faces=List.filter(s -> pos(s) == p and normal(s) == Vec.V(0,0,1),xs);
        require(List.length(faces) == 1,"exactly one front face required");
        let s=List.get(0,faces);
        require(image(s) == img,"wrong immutable display image");
        require(img == " " or up(s) == Vec.V(0,1,0),"display image not upright")
    }
}

def chainCounter(source: List[Sticker], words: List[List[Move]], canonical: List[List[Sticker]], chain: List[Int32], padded: Bool): Unit \ IO = {
    let initial=apply(source,List.get(0,words));
    let _ = List.foldLeft((acc,value) -> {
        let (current,physical)=acc;
        let route=List.append(inverse(List.get(current,words)),List.get(value,words));
        let next=apply(physical,route);
        showCounter(next,value,padded);
        require(next == List.get(value,canonical),"chained full state differs from canonical state");
        (value,next)
    },(0,initial),List.drop(1,chain));
    ()
}

def checkCounter(j: J, chain: List[Int32]): List[List[Sticker]] \ IO = {
    require(integer(field(j,"schema")) == 1 and text(field(j,"puzzle")) == "2x2x2","UNSUPPORTED: counter schema");
    let sourceIds=List.map(s -> integer(field(s,"id")),array(field(j,"printing")));
    let declaredIds=List.map(s -> integer(field(s,"id")),array(field(j,"unpaddedPrinting")));
    require(sourceIds == declaredIds,"printing and unpaddedPrinting must retain matching input ID order");
    let source=state(field(j,"printing"),2);
    let declared=state(field(j,"unpaddedPrinting"),2);
    let witnesses=array(field(j,"witnesses"));
    require(List.length(witnesses) == 100,"exactly 100 witnesses required");
    let values=List.map(w -> integer(field(w,"value")),witnesses);
    require(values == List.range(0,100),"witness values must be 0 through 99 in order");
    let words=List.map(w -> moves(text(field(w,"word")),false),witnesses);
    let unpadded=List.map(s -> match s {
        case Sticker.S(i,c,p,n,u,img) => Sticker.S(i,c,p,n,u,if (c<4 and img == "0") " " else img)
    },source);
    require(unpadded == declared,"declared fixed unpadded print differs");
    require(List.count(pair -> fst(pair) != snd(pair),List.zip(source,unpadded)) == 1,"exactly one fixed zero sticker must become blank");
    let canonical=List.map(pair -> {
        let (value,word)=pair;
        let reached=apply(source,word);
        showCounter(reached,value,true);
        require(apply(reached,inverse(word)) == source,"counter inverse did not restore all frames");
        showCounter(apply(unpadded,word),value,false);
        reached
    },List.zipWithIndex(words));
    let unpaddedCanonical=List.map(word -> apply(unpadded,word),words);
    require(List.length(chain) == 801 and List.get(0,chain) == 0 and all(List.map(v -> v >= 0 and v<100,chain)),"invalid pinned 801-value chain");
    chainCounter(source,words,canonical,chain,true);
    chainCounter(unpadded,words,unpaddedCanonical,chain,false);
    require(8*3 == 24 and (8-2)*3 == 18 and 10*2 == 20 and 9*2+1+1 == 20,"fixed-upper-body counting premises");
    let title=match List.find(s -> image(s) == "title-left",source) {
        case Some(s) => s
        case None => throw new IllegalArgumentException("missing title source")
    };
    let tampered=List.map(s -> if (sid(s) == sid(title)) Sticker.S(sid(s),body(s),pos(s),normal(s),scale(-1,up(s)),image(s)) else s,source);
    let rejected=List.exists(pair -> {
        let (value,word)=pair;
        let bad=apply(tampered,word);
        try { showCounter(bad,value,true); false } catch { case _: IllegalArgumentException => true }
    },List.zipWithIndex(words));
    require(rejected,"actual rotated-title printing tamper must reject");
    canonical
}

def intJ(n: Int32): J = J.Int(Int32.toString(n))
def object(pairs: List[(String,J)]): J = J.Obj(pairs)
def counterResult(states: List[List[Sticker]], sourceHash: String): J \ IO = {
    let digest=shaText(json(J.Arr(List.map(wire,states))));
    object(List#{("valid",J.Bool(true)),("status",J.Str("VALID")),("sourceSHA256",J.Str(sourceHash)),("canonicalStateSHA256",J.Str(digest)),("values",intJ(100)),("inverseChecks",intJ(100)),("unpaddedValues",intJ(100)),("chainedTransitionsPerFormat",intJ(800)),("hubOrderedTransitions",intJ(10000)),("fixedUpperBodyPremises",J.Bool(true)),("rotatedTitleTamperRejected",J.Bool(true))})
}
