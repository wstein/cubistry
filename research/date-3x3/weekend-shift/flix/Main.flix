// SPDX-License-Identifier: AGPL-3.0-or-later
// Independent proper-rotation inventory and reserved-corner certificate checker.
import java.security.MessageDigest
import java.util.HexFormat
import java.nio.charset.StandardCharsets
import java.lang.{Exception,System,IllegalArgumentException}
type alias V = (Int32,Int32,Int32)
def at(xs: List[a],i: Int32): a \ IO = match xs {case x::rest => if(i==0)x else at(rest,i-1) case Nil => throw new IllegalArgumentException("index")}
def unwrap(x: Option[a]): a \ IO = match x {case Some(v)=>v case None=>throw new IllegalArgumentException("missing")}
def sha(s: String): String \ IO = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)))
def ni(j: J,k: String): Int32 \ IO = integer(field(j,k))
def ints(j: J): List[Int32] \ IO = List.map(integer,array(j))
def row(s: String): List[String] = String.splitOn(substr="\t",s)
def rows(path: String): List[List[String]] \ IO = List.map(row,String.splitOn(substr="\n",String.trim(readText(path))))
def iv(s: String): Int32 \ IO = unwrap(Int32.fromString(s))
def vec(s: String): V \ IO = {let ns=List.map(iv,String.splitOn(substr=",",s));require(List.length(ns)==3,"vector length");(at(ns,0),at(ns,1),at(ns,2))}
def dot(a: V,b: V): Int32 = {let(x,y,z)=a;let(u,v,w)=b;x*u+y*v+z*w}
def cross(a: V,b: V): V = {let(x,y,z)=a;let(u,v,w)=b;(y*w-z*v,z*u-x*w,x*v-y*u)}
def add(a: V,b: V): V = {let(x,y,z)=a;let(u,v,w)=b;(x+u,y+v,z+w)}
def scale(k: Int32,a: V): V = {let(x,y,z)=a;(k*x,k*y,k*z)}
def inv(p: V,n: V,u: V): (Int32,Int32) = (dot(p,u),dot(p,cross(n,u)))
def pos(i: Int32): V = (Int32.modulo(i,3)-1,1-i/3,1)
def coord(v: V): Int32 = {let(x,y,z)=v;(if(x==0)0 else 1)+(if(y==0)0 else 1)+(if(z==0)0 else 1)}
def pool(i: Int32): String = if(i==4)"center" else if(List.memberOf(i,List#{0,2,6,8}))"corner" else "edge"
def transform(v: V,n: V,u: V): V = {let(x,y,z)=v;add(add(scale(x,cross(u,n)),scale(y,u)),scale(z,n))}
def dayCount(y: Int32,m: Int32): Int32 = if(m==2){if(Int32.modulo(y,4)==0 and (Int32.modulo(y,100) != 0 or Int32.modulo(y,400)==0))29 else 28}else if(List.memberOf(m,List#{4,6,9,11}))30 else 31
def weekday(y: Int32,m: Int32,d: Int32): Int32 \ IO = {let a=if(m<3)y-1 else y;Int32.modulo(a+a/4-a/100+a/400+at(List#{0,3,2,5,0,3,5,1,4,6,2,4},m-1)+d+6,7)}
def texts(wd: List[List[String]],mo: List[List[String]],w: Int32,m: Int32,d: Int32): List[String] \ IO = {
 let wr=at(wd,w);let mr=at(mo,m-1);List#{at(wr,2),at(wr,3),at(wr,4),"","${d/10}","${Int32.modulo(d,10)}",at(mr,1),at(mr,2),at(mr,3)}
}
def role(wd: List[List[String]],w: Int32,i: Int32): String \ IO = if(i<3)at(at(wd,w),5)else if(i<6)"day"else"month"
def art(model: J,wd: List[List[String]],w: Int32,i: Int32,s: String): String \ IO = {
 if(s=="")""else {let r=field(model,role(wd,w,i));let(a,b)=inv(pos(i),(0,0,1),(0,1,0));s+":"+text(field(r,"color"))+":${ni(r,"weight")}:${a}:${b}"}
}
def main(): Unit \ IO = Sys.Env.runWithIO(() -> {try {
 let args=Sys.Env.getArgs();require(List.length(args)==2,"input directory certificate");let root=at(args,0);let cert=readJson(at(args,1));let model=readJson(root+"/model.json");
 let pins=List#{("model.json","modelSHA256","4f6aebe0784d83d823c3f4316384c7280cc3bf5917a18a4d6abec12fdc9ddb2b"),("weekdays.tsv","weekdaySHA256","b3f586b0245e7a3947c7e10bf7b087c4d5bad259eef263dc6fff2fe6d9a67044"),("months.tsv","monthSHA256","df2de9ee2db42ccff03e7512be05c50dc740d3223d1203622684af902abd0f74"),("baseline-print.tsv","baselineSHA256","608a6a525a3723394e2c54c7151157b97c3ac753f1f30cf4435a748828978e64")};
 List.forEach(p -> {let(name,key,pin)=p;require(sha(readText(root+"/"+name))==pin and text(field(cert,key))==pin,"exact raw input pin")},pins);
 require(text(field(cert,"schema"))=="cubistry.german-weekend-shift-corner-certificate" and ni(cert,"version")==1 and text(field(cert,"claim"))=="UNSAT","certificate schema/claim");
 let wdAll=rows(root+"/weekdays.tsv");let moAll=rows(root+"/months.tsv");let bpAll=rows(root+"/baseline-print.tsv");
 require(at(wdAll,0)==List#{"weekday","name","left","middle","right","ink"} and List.length(wdAll)==8 and List.forAll(r -> List.length(r)==6,wdAll),"weekday table");
 require(at(moAll,0)==List#{"month","left","middle","right"} and List.length(moAll)==13 and List.forAll(r -> List.length(r)==4,moAll),"month table");
 require(at(bpAll,0)==List#{"id","cubie","p","n","up","image","slot"} and List.length(bpAll)==55,"baseline table");let wd=List.drop(1,wdAll);let mo=List.drop(1,moAll);
 let bs=List.map(t -> {let(i,r)=t;require(List.length(r)==7 and iv(at(r,0))==i,"baseline ids");let p=vec(at(r,2));let n=vec(at(r,3));let u=vec(at(r,4));require(dot(n,n)==1 and dot(u,u)==1 and dot(n,u)==0 and dot(p,n)==1,"frame");(iv(at(r,1)),p,n,u,at(r,5))},List.zipWithIndex(List.drop(1,bpAll)));
 let bodies=List.distinct(List.map(t -> {let(b,_,_,_,_)=t;b},bs));require(List.length(bodies)==26,"26 bodies");
 List.forEach(b -> {let group=List.filter(t -> {let(c,_,_,_,_)=t;c==b},bs);let positions=List.distinct(List.map(t -> {let(_,p,_,_,_)=t;p},group));require(List.length(positions)==1,"rigid cubies");let p=at(positions,0);require(List.length(group)==coord(p),"complete body faces")},bodies);
 require(List.length(List.distinct(List.map(t -> {let(_,p,n,_,_)=t;(p,n)},bs)))==54,"unique planes");
 let capacity=List.map(k -> List.count(t -> {let(_,p,_,_,_)=t;coord(p)==k},bs),List#{3,2,1});require(capacity==List#{24,24,6},"physical pools");
 let dirs=List#{(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)};let frames=List.flatMap(n -> List.map(u -> (n,u),List.filter(u -> dot(n,u)==0,dirs)),dirs);require(List.length(frames)==24,"24 proper frames");
 List.forEach(i -> {let p=pos(i);let poses=List.map(f -> {let(n,u)=f;(transform(p,n,u),transform((0,0,1),n,u),transform((0,1,0),n,u))},frames);require(List.forAll(t -> {let(a,b,c)=t;inv(a,b,c)==inv(p,(0,0,1),(0,1,0))},poses),"rotation invariant");let upright=List.distinct(List.map(t -> {let(a,_,_)=t;a},List.filter(t -> {let(_,n,u)=t;n==(0,0,1) and u==(0,1,0)},poses)));require(upright==List#{p},"single upright cell");require(List.length(List.distinct(List.map(t -> {let(a,_,_)=t;a},List.filter(t -> {let(_,n,_)=t;n==(0,0,1)},poses))))==4,"neutral blank corner transport")},List#{0,2,6,8});
 let ns=List.distinct(List.map(t -> {let(_,p,n,u,_)=t;inv(p,n,u)},List.filter(t -> {let(_,_,_,_,s)=t;s=="N"},bs)));require(List.sort(ns)==List#{(-1,-1),(-1,1)},"baseline N has two transported classes");
 let distinct=List.map(c -> List.length(List.distinct(List.map(r -> at(r,c),wd))),List#{2,3,4});require(distinct==List#{4,4,3} and ints(field(cert,"weekdayDistinctIncludingBlank"))==distinct,"weekday counts include blank");
 let source=List.flatMap(y -> List.flatMap(m -> List.map(d -> (weekday(y,m,d),m,d),List.range(1,dayCount(y,m)+1)),List.range(1,13)),List.range(2000,2400));let targets=List.sort(List.distinct(source));require(List.length(source)==146097 and List.length(targets)==2562 and ni(cert,"dates")==146097 and ni(cert,"targets")==2562,"domain and target count");
 let boards=List.map(t -> {let(w,m,d)=t;(w,texts(wd,mo,w,m,d))},targets);
 let expectedRows=List.map(t -> {let(w,m,d)=t;let ss=texts(wd,mo,w,m,d);let cells=List.map(i -> {let s=at(ss,i);s+":"+(if(s=="")"blank"else role(wd,w,i))},List.range(0,9));List.flatten(List#{List#{"${w}","${m}","${d}"},cells})},targets);
 let retained=rows(root+"/targets.tsv");require(sha(readText(root+"/targets.tsv"))==text(field(cert,"targetSHA256")),"raw target hash binding");require(at(retained,0)==List.flatten(List#{List#{"weekday","month","day"},List.map(i -> "cell${i}",List.range(0,9))}) and List.length(retained)==2563 and List.sort(List.drop(1,retained))==List.sort(expectedRows),"all raw targets match independent reconstruction");
 List.forEach(b -> {let(_,ss)=b;require(List.count(i -> at(ss,i)=="",List#{0,2,6,8})==1,"every target needs blank corner")},boards);
 let keys=List#{"corner","edge","center"};let demands=List.map(k -> List.length(List.distinct(List.flatMap(b -> {let(w,ss)=b;List.flatMap(i -> {let s=at(ss,i);if(pool(i)==k and s != "")List#{art(model,wd,w,i,s)}else Nil},List.range(0,9))},boards))),keys);
 let blanks=List.map(k -> List.foldLeft((peak,b) -> {let(_,ss)=b;Int32.max(peak,List.count(i -> pool(i)==k and at(ss,i)=="",List.range(0,9)))},0,boards),keys);
 require(demands==List#{23,21,4} and blanks==List#{1,1,0},"oriented pool demand");List.forEach(p -> {let(i,k)=p;require(ni(field(cert,"mandatoryNonblankByPool"),k)==at(demands,i) and ni(field(cert,"blankPeakByPool"),k)==at(blanks,i),"certificate demand")},List.zipWithIndex(keys));
 let slots=List.map(i -> List.length(List.distinct(List.flatMap(b -> {let(w,ss)=b;let s=at(ss,i);if(s=="")Nil else List#{art(model,wd,w,i,s)}},boards))),List#{0,2,6,8});require(slots==List#{3,2,8,10} and ints(field(cert,"cornerClassesBySlot"))==slots,"per-cell classes");
 let faces=at(capacity,0);let mandatory=at(demands,0);require(ni(cert,"cornerFaces")==faces and ni(cert,"cornerBodies")==8 and ni(cert,"cornerFacesPerBody")==3,"corner geometry binding");require(faces-mandatory==1 and ni(cert,"maximumBlankFaces")==1,"at most one blank");
 require(text(field(cert,"zeroBlankCase"))=="Every target requires a blank corner","zero blanks");let one=field(cert,"oneBlankCase");require(ni(one,"reservedBodies")==1 and ni(one,"remainingFaces")==faces-3 and ni(one,"requiredNonblankClasses")==mandatory and faces-3<mandatory,"one reserved blank body leaves too few faces");let two=field(cert,"twoOrMoreBlankCase");require(ni(two,"minimumFaces")==mandatory+2 and ni(two,"availableFaces")==faces and mandatory+2>faces,"two blank budget");
 println("UNSAT\tdates=146097\ttargets=2562\tcorner=23+1/24\tedge=21+1/24\tcenter=4+0/6\tcornerSlots=3,2,8,10\treservedCornerLeaves=21<23\tscope=German-shifted-weekend-strict-upright")
} catch {case e: Exception => {println("INVALID: "+e.toString());System.exit(1)}} })
