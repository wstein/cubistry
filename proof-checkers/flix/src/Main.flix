import java.lang.{Exception, IllegalArgumentException, System}
import java.nio.charset.MalformedInputException
import com.fasterxml.jackson.core.JsonProcessingException
import java.io.{File, PrintWriter}
import java.nio.charset.StandardCharsets

def counterCommand(path: String, root: String): Unit \ IO = {
    let states=checkCounter(readJson(path),loadChain(root));
    println(json(counterResult(states,shaFile(path))))
}

def stateCommand(path: String): Unit \ IO = {
    let raw=readJson(path);
    let (actual,qs,matched)=checkState3(raw);
    let goal=match optional(raw,"centerGoal") { case None => J.Null
        case Some(_) => J.Bool(matched) };
    println(json(object(List#{("valid",J.Bool(true)),("status",J.Str("VALID")),("sourceSHA256",J.Str(shaFile(path))),("state",wire(actual)),("stateSHA256",J.Str(shaText(json(wire(actual))))),("centerTwists",J.Arr(List.map(intJ,qs))),("goalMatches",goal)})))
}

def conformanceCommand(root: String, destination: Option[String]): Unit \ IO = {
    let writer=match destination {
        case None => None
        case Some(path) => {
            require(not new File(path).exists(),"ERROR: export must be a new file");
            Some(new PrintWriter(new File(path),StandardCharsets.UTF_8))
        }
    };
    try {
        let result=conformance(root,writer);
        match writer { case Some(w) => { w.close(); require(not w.checkError(),"ERROR: full-state export write failed") }
            case None => () };
        println(json(result))
    } catch {
        case ex: Exception => {
            match writer { case Some(w) => { w.close(); require(not w.checkError(),"ERROR: full-state export write failed") }
                case None => () };
            throw new IllegalArgumentException("ERROR: conformance failed: "+ex.toString())
        }
    }
}

def emitFailure(status: String, reason: String, code: Int32): Unit \ IO = {
    println(json(object(List#{("valid",J.Bool(false)),("status",J.Str(status)),("reason",J.Str(reason))})));
    System.exit(code)
}

def main(): Unit \ IO = Sys.Env.runWithIO(() -> {
    try {
        match Sys.Env.getArgs() {
            case "counter" :: path :: Nil => counterCommand(path,".")
            case "counter" :: path :: root :: Nil => counterCommand(path,root)
            case "state3" :: path :: Nil => stateCommand(path)
            case "conformance" :: root :: Nil => conformanceCommand(root,None)
            case "conformance" :: root :: destination :: Nil => conformanceCommand(root,Some(destination))
            case "lifecycle" :: root :: Nil => lifecycleCommand(root)
            case "hsm" :: path :: Nil => hsmCommand(path)
            case "hsm-conformance" :: root :: Nil => hsmConformanceCommand(root)
            case _ => throw new IllegalArgumentException("UNSUPPORTED: expected counter, state3, conformance, or lifecycle")
        }
    } catch {
        case ex: JsonProcessingException => emitFailure("INVALID_JSON",ex.toString(),1)
        case ex: MalformedInputException => emitFailure("INVALID_JSON",ex.toString(),1)
        case ex: IllegalArgumentException => {
            let reason=ex.toString();
            if (reason.contains("ERROR:")) emitFailure("ERROR",reason,3)
            else if (reason.contains("UNSUPPORTED:")) emitFailure("UNSUPPORTED",reason,2)
            else emitFailure(if (reason.contains("INVALID_JSON:")) "INVALID_JSON" else "INVALID",reason,1)
        }
        case ex: Exception => emitFailure("ERROR",ex.toString(),3)
    }
})
