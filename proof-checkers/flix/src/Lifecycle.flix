import java.lang.System
import java.io.File
import java.nio.file.Files

/// Initial I/O preflight retains no parsed certificate or completed math result.
/// Every complete conformance invocation rereads and reparses the original files.
def preflight(root: String): Int64 \ IO = {
    let path=root+"/proof-checkers/conformance/manifest.json";
    require(shaFile(path)==manifestPin(),"ERROR: conformance manifest pin mismatch");
    let manifest=readJson(path);
    let cases=array(field(manifest,"cases"));
    require(List.length(cases)==195,"ERROR: expected 195 input files");
    let paths=List.map(row -> {
        let file=root+"/"+text(field(row,"path"));
        require(shaFile(file)==text(field(row,"sha256")),"ERROR: preflight fixture hash mismatch");
        file
    },cases);
    let kernel=root+"/"+text(field(field(manifest,"kernel"),"path"));
    require(shaFile(kernel)==text(field(field(manifest,"kernel"),"sha256")),"ERROR: preflight kernel hash mismatch");
    let chain=root+"/proof-checkers/conformance/counter-chain.json";
    require(shaFile(chain)==chainPin(),"ERROR: preflight chain hash mismatch");
    let allPaths=List.append(paths,List#{path,kernel,chain,root+"/proof-checkers/conformance-pin.json"});
    List.foldLeft((total,file) -> total+Files.size(new File(file).toPath()),0i64,allPaths)
}

def phase(record: J): Unit \ IO = {
    System.out.println("CUBISTRY_PHASE "+json(record));
    System.out.flush()
}

def millis(started: Int64): J \ IO = J.Float(Float64.toString(Int64.toFloat64(System.nanoTime()-started)/1000000.0f64))

def lifecycleCommand(root: String): Unit \ IO = {
    phase(object(List#{("event",J.Str("READY"))}));
    let loadStart=System.nanoTime();
    let bytes=preflight(root);
    let loadElapsed=millis(loadStart);
    phase(object(List#{("event",J.Str("LOAD")),("elapsedMs",loadElapsed),("files",intJ(199)),("bytes",J.Int(Int64.toString(bytes))),("scope",J.Str("raw-input integrity preflight; no semantic result cache"))}));
    foreach (iteration <- List.range(0,4)) {
        let started=System.nanoTime();
        let result=conformance(root,None);
        let elapsed=millis(started);
        phase(object(List#{("event",J.Str("RESULT")),("iteration",intJ(iteration)),("elapsedMs",elapsed),("valid",field(result,"valid")),("negativeControls",intJ(integer(field(result,"counterRejected"))+integer(field(result,"geometryRejected")))),("counterCases",field(result,"counterCases")),("counterAccepted",field(result,"counterAccepted")),("counterRejected",field(result,"counterRejected")),("geometryCases",field(result,"geometryCases")),("geometryAccepted",field(result,"geometryAccepted")),("geometryRejected",field(result,"geometryRejected")),("kernelReferences",field(result,"kernelReferences")),("centerGenerators",field(result,"centerGenerators")),("chainedTransitionsPerFormat",field(result,"chainedTransitionsPerFormat")),("checksum",field(result,"fullStateAggregateSHA256"))}))
    };
    phase(object(List#{("event",J.Str("DONE"))}))
}
