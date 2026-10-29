import java.lang.{Exception, IllegalArgumentException}
import java.io.{File, PrintWriter}
import java.nio.charset.StandardCharsets
import java.nio.charset.MalformedInputException
import com.fasterxml.jackson.core.JsonProcessingException

enum Checked { case Counter(List[List[Sticker]]), Marked(J,List[Sticker],List[Int32],Bool) }

def manifestPin(): String = "c0d0fa2fc6d692c7c89e436fe5a2670503d8a8a6c86a2cc0d1397be983832e01"

def emitState(out: Option[PrintWriter], group: String, name: String, actual: J): Unit \ IO = match out {
    case None => ()
    case Some(w) => w.println(json(object(List#{("group",J.Str(group)),("name",J.Str(name)),("state",actual)})))
}


def caseConformance(row: J, root: String, chain: List[Int32], out: Option[PrintWriter]): J \ IO = {
    let group=text(field(row,"group"));
    let name=text(field(row,"name"));
    let relative=text(field(row,"path"));
    require(not relative.contains("..") and relative.startsWith("proof-checkers/conformance/"),"ERROR: unsafe corpus path");
    require(group == "counter" or group == "geometry","ERROR: unknown conformance group");
    let path=root+"/"+relative;
    let sourceHash=shaFile(path);
    require(sourceHash == text(field(row,"sha256")),"ERROR: fixture hash mismatch: "+name);
    let expected=flag(field(row,"expectedValid"));
    // Catch only expected semantic/parser rejection, never output-comparison or I/O failures.
    let outcome=try {
        let raw=readJson(path);
        let result=if (group == "counter") Checked.Counter(checkCounter(raw,chain)) else {
            let (actual,qs,matched)=checkState3(raw);
            Checked.Marked(raw,actual,qs,matched)
        };
        (Some(result),"")
    } catch {
        case ex: IllegalArgumentException => (None,ex.toString())
        case ex: JsonProcessingException => (None,ex.toString())
        case ex: MalformedInputException => (None,ex.toString())
    };
    let (accepted,reason)=outcome;
    let valid=match accepted { case None => false
        case Some(_) => true };
    require(valid == expected,"ERROR: unexpected conformance acceptance: "+group+"/"+name+" "+reason);
    let (digest,outer,whole)=match accepted {
        case None => ("",0,0)
        case Some(Checked.Counter(canonical)) => {
            let hash=shaText(json(J.Arr(List.map(wire,canonical))));
            require(hash == text(field(row,"canonicalStateSHA256")),"ERROR: counter canonical full-state digest mismatch");
            foreach (pair <- List.zipWithIndex(canonical)) {
                let (value,physical)=pair;
                match out { case None => ()
                    case Some(w) => w.println(json(object(List#{("group",J.Str("counter")),("name",J.Str(name)),("value",intJ(value)),("state",wire(physical))}))) }
            };
            (hash,0,0)
        }
        case Some(Checked.Marked(raw,actual,_,matched)) => {
            let hash=shaText(json(wire(actual)));
            require(hash == text(field(row,"expectedStateSHA256")),"ERROR: marked full-state digest mismatch");
            match optional(row,"expectedGoalMatches") {
                case Some(v) => require(matched == flag(v),"ERROR: optical goal comparison mismatch")
                case None => ()
            };
            let (htm,xyz)=match optional(row,"word") {
                case Some(J.Str(word)) => {
                    let printing=state(field(raw,"printing"),3);
                    let ms=moves(word,true);
                    require(apply(printing,ms) == actual,"ERROR: move replay differs from every declared frame");
                    require(apply(actual,inverse(ms)) == printing,"ERROR: move inverse did not restore reference frames");
                    (List.length(ms)-rotations(ms),rotations(ms))
                }
                case Some(J.Null) => (0,0)
                case None => (0,0)
                case _ => throw new IllegalArgumentException("ERROR: invalid manifest move word")
            };
            emitState(out,group,name,wire(actual));
            (hash,htm,xyz)
        }
    };
    object(List#{("group",J.Str(group)),("name",J.Str(name)),("sourceSHA256",J.Str(sourceHash)),("valid",J.Bool(valid)),("stateSHA256",J.Str(digest)),("outerHTM",intJ(outer)),("wholeRotations",intJ(whole)),("reason",J.Str(reason))})
}

def noncenters(xs: List[Sticker]): List[Sticker] = List.filter(s -> nonzero(pos(s))>1,xs)

def kernelItem(row: J, source: List[Sticker], group: String, index: Int32, out: Option[PrintWriter]): String \ IO = {
    let ms=moves(text(field(row,"word")),true);
    require(rotations(ms) == 0,"ERROR: center reference unexpectedly contains xyz");
    require(List.length(ms) == integer(field(row,"htm")),"ERROR: center reference move count mismatch");
    let actual=apply(source,ms);
    let qs=reachability(source,actual);
    let expected=six(field(row,if (group == "generator") "delta" else "o"),false);
    require(qs == expected,"center reference quarter indices mismatch");
    require(noncenters(actual) == noncenters(source),"center reference moved noncenter physical frames");
    require(apply(actual,inverse(ms)) == source,"center reference inverse failed full restoration");
    let digest=shaText(json(wire(actual)));
    require(digest == text(field(row,"expectedStateSHA256")),"center reference full-state digest mismatch");
    emitState(out,group,Int32.toString(index),wire(actual));
    digest
}

def conformance(root: String, out: Option[PrintWriter]): J \ IO = {
    let manifestPath=root+"/proof-checkers/conformance/manifest.json";
    require(shaFile(manifestPath) == manifestPin(),"ERROR: conformance manifest pin mismatch");
    let manifest=readJson(manifestPath);
    require(text(field(manifest,"schema")) == "cubistry.proof-conformance.v1","ERROR: unsupported conformance schema");
    let cases=array(field(manifest,"cases"));
    require(List.length(cases) == 195 and integer(field(manifest,"caseCount")) == 195,"ERROR: expected 195 named cases");
    require(integer(field(manifest,"counterCaseCount")) == 41 and integer(field(manifest,"geometryCaseCount")) == 154,"ERROR: conformance group counts changed");
    require(List.count(c -> text(field(c,"group")) == "counter",cases) == 41,"ERROR: counter names incomplete");
    require(List.count(c -> text(field(c,"group")) == "geometry",cases) == 154,"ERROR: geometry names incomplete");
    let pin=readJson(root+"/proof-checkers/conformance-pin.json");
    require(text(field(pin,"manifestSHA256")) == manifestPin(),"ERROR: declared conformance pin disagrees");
    foreach (group <- List#{"counter","geometry"}) {
        let names=List.sort(List.map(c -> text(field(c,"name")),List.filter(c -> text(field(c,"group")) == group,cases)));
        let declared=List.sort(List.map(text,array(field(pin,if (group == "counter") "counterCases" else "geometryCases"))));
        require(names == declared,"ERROR: missing or substituted declared case names");
        require(all(List.map(n -> List.count(x -> x == n,names) == 1,names)),"ERROR: duplicate conformance case name")
    };
    let chainInfo=field(manifest,"counterChain");
    require(text(field(chainInfo,"sha256")) == chainPin() and integer(field(chainInfo,"values")) == 801 and integer(field(chainInfo,"transitionsPerFormat")) == 800,"ERROR: chain contract changed");
    let chain=loadChain(root);
    let results=List.map(row -> caseConformance(row,root,chain,out),cases);
    let counterAccepted=List.count(r -> text(field(r,"group")) == "counter" and flag(field(r,"valid")),results);
    let geometryAccepted=List.count(r -> text(field(r,"group")) == "geometry" and flag(field(r,"valid")),results);
    require(counterAccepted == 2 and geometryAccepted == 129,"ERROR: accepted/rejected coverage changed");
    let kernelInfo=field(manifest,"kernel");
    let kernelPath=root+"/"+text(field(kernelInfo,"path"));
    require(shaFile(kernelPath) == text(field(kernelInfo,"sha256")),"ERROR: kernel input hash mismatch");
    require(integer(field(kernelInfo,"rows")) == 2048 and integer(field(kernelInfo,"generators")) == 36,"ERROR: kernel manifest counts changed");
    let kernel=readJson(kernelPath);
    require(text(field(kernel,"schema")) == "cubistry.center-kernel.v1","ERROR: unsupported kernel schema");
    let source=state(field(kernel,"printing"),3);
    let generators=array(field(kernel,"generators"));
    let rows=array(field(kernel,"rows"));
    require(List.length(generators) == 36 and List.length(rows) == 2048,"ERROR: kernel corpus is incomplete");
    let indices=List.map(row -> integer(field(row,"i")),rows);
    require(all(List.map(i -> List.count(j -> j == i,indices) == 1,indices)),"ERROR: duplicate kernel reference index");
    foreach (row <- rows) {
        let o=six(field(row,"o"),false);
        let encoded=sum(List.map(pair -> {
            let (i,x)=pair;
            x*List.get(i,List#{1,4,16,64,256,1024})
        },List.zipWithIndex(o)));
        require(integer(field(row,"i")) == encoded and Int32.modulo(sum(o),2) == 0,"ERROR: invalid kernel orientation index")
    };
    let generatorHashes=List.map(pair -> { let (i,row)=pair; kernelItem(row,source,"generator",i,out) },List.zipWithIndex(generators));
    let kernelHashes=List.map(row -> kernelItem(row,source,"kernel",integer(field(row,"i")),out),rows);
    let caseHashes=List.map(r -> text(field(r,"stateSHA256")),List.filter(r -> flag(field(r,"valid")),results));
    let allHashes=List.append(caseHashes,List.append(generatorHashes,kernelHashes));
    require(List.length(allHashes)==2215,"ERROR: full-state aggregate coverage changed");
    let checksum=shaText(String.intercalate("\n",allHashes));
    object(List#{("valid",J.Bool(true)),("status",J.Str("VALID")),("manifestSHA256",J.Str(manifestPin())),("counterCases",intJ(41)),("counterAccepted",intJ(counterAccepted)),("counterRejected",intJ(39)),("geometryCases",intJ(154)),("geometryAccepted",intJ(geometryAccepted)),("geometryRejected",intJ(25)),("kernelReferences",intJ(2048)),("centerGenerators",intJ(36)),("canonicalValuesPerCounter",intJ(100)),("inverseChecksPerCounter",intJ(100)),("chainedTransitionsPerFormat",intJ(800)),("checksum",J.Str(checksum)),("fullStateAggregateSHA256",J.Str(checksum)),("cases",J.Arr(results))})
}
