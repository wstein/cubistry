import com.fasterxml.jackson.core.{JsonFactory, JsonParser, StreamReadConstraints}
import java.lang.{IllegalArgumentException, Exception}
import java.io.{File, IOException}
import java.nio.file.Files
import java.nio.charset.StandardCharsets

/// Raw numeric spellings remain separate integer/floating token variants.
enum J with Eq, ToString {
    case Null,
    Bool(Bool),
    Int(String),
    Float(String),
    Str(String),
    Arr(List[J]),
    Obj(List[(String, J)])
}

def require(ok: Bool, why: String): Unit \ IO =
    if (ok) () else throw new IllegalArgumentException(why)

def hex4(n: Int32): String = {
    let h = "0123456789abcdef";
    Char.toString(String.charAt(n / 4096,h))
        + Char.toString(String.charAt(Int32.modulo(n / 256,16),h))
        + Char.toString(String.charAt(Int32.modulo(n / 16,16),h))
        + Char.toString(String.charAt(Int32.modulo(n,16),h))
}

def escaped(c: Char): String = {
    let n = Char.toBmpCodePoint(c);
    match n {
        case 34 => "\\\""
        case 92 => "\\\\"
        case 8 => "\\b"
        case 9 => "\\t"
        case 10 => "\\n"
        case 12 => "\\f"
        case 13 => "\\r"
        case _ => if (n < 32 or n >= 127) "\\u" + hex4(n) else Char.toString(c)
    }
}

def jsonString(s: String): String = "\"" + String.intercalate("",List.map(escaped,String.toList(s))) + "\""

def scalarString(s: String, i: Int32): Unit \ IO =
    if (i >= String.length(s)) () else {
        let c = Char.toBmpCodePoint(String.charAt(i,s));
        if (c >= 0xD800 and c <= 0xDBFF) {
            require(i + 1 < String.length(s),"INVALID_JSON: unpaired high surrogate");
            let d = Char.toBmpCodePoint(String.charAt(i+1,s));
            require(d >= 0xDC00 and d <= 0xDFFF,"INVALID_JSON: unpaired high surrogate");
            scalarString(s,i+2)
        } else {
            require(c < 0xDC00 or c > 0xDFFF,"INVALID_JSON: unpaired low surrogate");
            scalarString(s,i+1)
        }
    }


def json(j: J): String = match j {
    case J.Null => "null"
    case J.Bool(b) => if (b) "true" else "false"
    case J.Int(s) => s
    case J.Float(s) => s
    case J.Str(s) => jsonString(s)
    case J.Arr(xs) => "[" + String.intercalate(",", List.map(json,xs)) + "]"
    case J.Obj(xs) => "{" + String.intercalate(",", List.map(kv -> {
        let (k,v) = kv; jsonString(k) + ":" + json(v)
    }, xs)) + "}"
}

def field(j: J, name: String): J \ IO = match j {
    case J.Obj(xs) => match List.find(kv -> fst(kv)==name,xs) {
        case Some((_,value)) => value
        case None => throw new IllegalArgumentException("missing field: " + name)
    }
    case _ => throw new IllegalArgumentException("expected object")
}

def optional(j: J, name: String): Option[J] = match j {
    case J.Obj(xs) => List.map(snd, List.filter(kv -> fst(kv)==name,xs)) |> List.head
    case _ => None
}

def array(j: J): List[J] \ IO = match j {
    case J.Arr(xs) => xs
    case _ => throw new IllegalArgumentException("expected array")
}

def text(j: J): String \ IO = match j {
    case J.Str(s) => s
    case _ => throw new IllegalArgumentException("expected string")
}

def integer(j: J): Int32 \ IO = match j {
    case J.Int(s) => match Int32.fromString(s) {
        case Some(n) => n
        case None => throw new IllegalArgumentException("integer outside Int32 range")
    }
    case _ => throw new IllegalArgumentException("expected integer JSON token")
}

def flag(j: J): Bool \ IO = match j {
    case J.Bool(b) => b
    case _ => throw new IllegalArgumentException("expected boolean")
}

def parseValue(p: JsonParser, depth: Int32): J \ IO = {
    require(depth <= 64, "INVALID_JSON: JSON nesting exceeds 64");
    match p.currentTokenId() {
        case 1 => parseObject(p,depth,Nil)
        case 3 => parseArray(p,depth,Nil)
        case 6 => { let s = p.getText(); scalarString(s,0); J.Str(s) }
        case 7 => { let s=p.getText(); require(String.length(s)<=128,"INVALID_JSON: numeric token exceeds 128 bytes"); J.Int(s) }
        case 8 => { let s=p.getText(); require(String.length(s)<=128,"INVALID_JSON: numeric token exceeds 128 bytes"); J.Float(s) }
        case 9 => J.Bool(true)
        case 10 => J.Bool(false)
        case 11 => J.Null
        case _ => throw new IllegalArgumentException("INVALID_JSON: unexpected JSON token")
    }
}

def parseObject(p: JsonParser, depth: Int32, xs: List[(String,J)]): J \ IO = {
    let _ = p.nextToken();
    if (p.currentTokenId()==2) J.Obj(List.reverse(xs)) else {
        require(p.currentTokenId()==5,"INVALID_JSON: expected JSON object key");
        let name = p.getText();
        scalarString(name,0);
        require(not List.exists(kv -> fst(kv)==name,xs),"INVALID_JSON: duplicate JSON object key");
        let _ = p.nextToken();
        let value = parseValue(p,depth+1);
        parseObject(p,depth,(name,value)::xs)
    }
}

def parseArray(p: JsonParser, depth: Int32, xs: List[J]): J \ IO = {
    let _ = p.nextToken();
    if (p.currentTokenId()==4) J.Arr(List.reverse(xs)) else {
        let value = parseValue(p,depth+1);
        parseArray(p,depth,value::xs)
    }
}

def parseJson(raw: String): J \ IO = {
    require(Vector.length(String.toBytes(raw))<=16777216,"INVALID_JSON: input exceeds 16 MiB");
    let limits = StreamReadConstraints.builder().maxNestingDepth(64).maxNumberLength(128).maxNameLength(16777216).maxStringLength(16777216).build();
    let factory = new JsonFactory();
    let _ = factory.setStreamReadConstraints(limits);
    let parser = factory.createParser(raw);
    try {
        let _ = parser.nextToken();
        let value = parseValue(parser,0);
        let _ = parser.nextToken();
        require(parser.currentTokenId()==0,"INVALID_JSON: trailing JSON root");
        parser.close();
        value
    } catch {
        case ex: Exception => { parser.close(); throw ex }
    }
}

def readText(path: String): String \ IO = {
    let p = new File(path).toPath();
    require(Files.size(p) <= 16777216i64,"INVALID_JSON: input exceeds 16 MiB");
    Files.readString(p,StandardCharsets.UTF_8)
}

def readJson(path: String): J \ IO = parseJson(readText(path))
