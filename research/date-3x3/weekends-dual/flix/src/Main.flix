// SPDX-License-Identifier: AGPL-3.0-or-later
// Independent arithmetic Gregorian and finite edge-body proof checker.
import java.security.MessageDigest
import java.util.HexFormat
import java.nio.charset.StandardCharsets
import java.lang.{Exception,System,IllegalArgumentException}
def unwrap(o: Option[a]): a \ IO = match o { case Some(x) => x case None => throw new IllegalArgumentException("missing value") }
def at(xs: List[a],i: Int32): a \ IO = match xs { case x::rest => if(i==0) x else at(rest,i-1) case Nil => throw new IllegalArgumentException("list index") }
def sha(s: String): String \ IO = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)))
def strs(j: J): List[String] \ IO = List.map(text,array(j))
def num(j: J,k: String): Int32 \ IO = integer(field(j,k))
def days(y: Int32,m: Int32): Int32 = if(m==2) {if(Int32.modulo(y,4)==0 and (Int32.modulo(y,100)!=0 or Int32.modulo(y,400)==0)) 29 else 28} else if(List.memberOf(m,List#{4,6,9,11})) 30 else 31
def label(y: Int32,m: Int32,d: Int32): (String,String,String) \ IO = {
 let a=if(m<3)y-1 else y;
 let w=Int32.modulo(a+a/4-a/100+a/400+at(List#{0,3,2,5,0,3,5,1,4,6,2,4},m-1)+d+6,7);
 let chars=List#{"O","I","I","O","R","A","O"};
 ("weekday:"+at(chars,w)+":"+(if(w>=5)"weekend" else "regularWeekday"),"month:"+at(List#{"A","E","Ä","P","A","U","U","U","E","K","O","E"},m-1),"units:${Int32.modulo(d,10)}")
}
def trip(j: J): (String,String,String) \ IO = {let xs=strs(j);require(List.length(xs)==3,"triple");(at(xs,0),at(xs,1),at(xs,2))}
def counts(j: J): List[Int32] \ IO = List.map(integer,array(j))
def main(): Unit \ IO = Sys.Env.runWithIO(() -> { try {
 let args=Sys.Env.getArgs();require(List.length(args)==2,"model certificate arguments");
 let raw=readText(at(args,0));let model=parseJson(raw);let cert=readJson(at(args,1));
 require(List.memberOf(sha(raw),List#{"c66142c64a2aa55d4c46b1a3367288d9cfeb88b3dcdb95c314912f907f7c3770","6f5a56ed87c844aeaaf24175409927f0dfe4f58b80024f878687c87da07f33cb"}),"exact immutable source or requested model");
 require(text(field(cert,"modelSHA256"))==sha(raw),"certificate model binding");
 require(text(field(cert,"schema"))=="cubistry.calendar-weekend-edge-certificate" and num(cert,"version")==1 and text(field(cert,"status"))=="UNSAT","certificate schema");
 let allDates=List.flatMap(y -> List.flatMap(m -> List.map(d -> label(y,m,d),List.range(1,days(y,m)+1)),List.range(1,13)),List.range(2000,2400));
 let observed=List.distinct(allDates);
 let fields=List#{List.sort(List.distinct(List.map(t -> {let(a,_,_)=t;a},observed))),List.sort(List.distinct(List.map(t -> {let(_,b,_)=t;b},observed))),List.sort(List.distinct(List.map(t -> {let(_,_,c)=t;c},observed)))};
 require(List.map(List.length,fields)==List#{5,7,10},"field sizes");
 let product=List.flatMap(a -> List.flatMap(b -> List.map(c -> (a,b,c),at(fields,2)),at(fields,1)),at(fields,0));
 require(List.sort(observed)==List.sort(product) and List.length(product)==350,"complete product");
 require(List.length(allDates)==146097 and num(cert,"sourceDates")==146097 and num(cert,"productSize")==350,"domain counts");
 require(List.map(k -> strs(field(field(cert,"fields"),k)),List#{"weekday","month","units"})==fields,"retained fields");
 let reps=List.map(row -> {
  let ds=String.splitOn({substr="-"},text(field(row,"date")));
  require(List.length(ds)==3,"date format");let ns=List.map(s -> unwrap(Int32.fromString(s)),ds);let y=at(ns,0);let m=at(ns,1);let d=at(ns,2);
  require(y>=2000 and y<2400 and m>=1 and m<=12 and d>=1 and d<=days(y,m),"representative domain");
  let t=trip(field(row,"labels"));require(t==label(y,m,d),"representative accurate");t
 },array(field(cert,"coverage")));
 require(List.length(reps)==350 and List.sort(reps)==List.sort(product),"complete unique representatives");
 // All 22 images differ: same glyph O has three distinct fixed inks.
 let inks=List.map(k -> text(field(field(model,k),"color")),List#{"regularWeekday","weekend","month","day"});
 require(List.length(List.distinct(inks))==4 and List.length(List.flatten(fields))==22,"distinct permanent images");
 let cases=field(cert,"edgeBlankCases");require(text(field(cases,"zero"))=="No blank front edge can be shown","zero blanks");
 List.forEach(k -> {let c=field(cases,k);require(num(c,"remainingFaces")==22 and counts(field(c,"fieldCounts"))==List#{5,7,10},"removed blank body");require(List.exists(n -> Int32.modulo(n,2)==1,List.map(List.length,fields)),"odd pairing")},List#{"one","twoOnOneBody"});
 let labels=List.flatten(fields);let pairs=List.flatMap(p -> {let(i,a)=p;List.map(b -> List.sort(List#{a,b}),List.drop(i+1,labels))},List.zipWithIndex(labels));
 let checked=List.map(row -> {
  let ps=strs(field(row,"otherLabels"));require(List.length(ps)==2 and at(ps,0) != at(ps,1),"distinct pair");
  let ix=List.map(p -> fst(unwrap(List.find(t -> List.memberOf(p,snd(t)),List.zipWithIndex(fields)))),ps);let a=at(ix,0);let b=at(ix,1);
  let ns=if(a==b) List.map(p -> {let(i,n)=p;n-(if(i==a)2 else 0)},List.zipWithIndex(List.map(List.length,fields))) else List.map(List.length,fields);
  if(a==b) require(List.exists(n -> Int32.modulo(n,2)==1,ns),"remaining odd pairing") else require(List.exists(t -> {let(x,y,z)=t;List.memberOf(at(ps,0),List#{x,y,z}) and List.memberOf(at(ps,1),List#{x,y,z})},product),"simultaneous blank partners");
  require(counts(field(row,"remainingFieldCounts"))==ns,"remaining counts");(List.sort(ps),a != b)
  },array(field(cases,"twoOnDifferentBodies")));
 require(List.sort(List.map(fst,checked))==List.sort(pairs) and List.length(pairs)==231,"exhaustive partner pairs");
 let last=field(cases,"threeOrMore");require(num(last,"minimumMandatoryFaces")==25 and num(last,"availableFaces")==24 and 22+3>24,"three blank budget");
 let cross=List.count(snd,checked);let parity=List.length(checked)-cross;
 println("UNSAT\tdates=146097\tcombinations=350\timages=22\tpairs=231\tcross=${cross}\tparity=${parity}\tscope=German-A-fixed-layout-and-styles")
} catch {case e: Exception => {println("INVALID: "+e.toString());System.exit(1)}} })
