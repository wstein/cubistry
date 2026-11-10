# SPDX-License-Identifier: AGPL-3.0-or-later
using JSON,SHA
source=ARGS[1];outroot=ARGS[2];ispath(outroot) && error("refusing to overwrite controls");mkpath(outroot)
checker=joinpath(@__DIR__,"check.jl");project=joinpath(@__DIR__,"../weekends-dual");java=get(ENV,"JAVA","java");jar=ENV["FLIX_JAR"];julia=joinpath(Sys.BINDIR,"julia")
fixtures=[("valid",(c,r)->nothing,true),("boolean-version",(c,r)->(c["version"]=true),false),("wrong-demand",(c,r)->(c["mandatoryNonblankByPool"]["corner"]=22),false),("wrong-slot-transport-count",(c,r)->(c["cornerClassesBySlot"][4]=9),false),("wrong-max-blank",(c,r)->(c["maximumBlankFaces"]=2),false),("wrong-reserved-body-budget",(c,r)->(c["oneBlankCase"]["remainingFaces"]=23),false),("missing-rebound-target",(c,r)->begin p=joinpath(r,"targets.tsv");lines=readlines(p);pop!(lines);write(p,join(lines,'\n')*"\n");c["targetSHA256"]=bytes2hex(sha256(read(p)));end,false),("changed-weekend-position",(c,r)->begin p=joinpath(r,"weekdays.tsv");write(p,replace(read(p,String),"5\tSA\t\tS\tA"=>"5\tSA\tS\tA\t"));c["weekdaySHA256"]=bytes2hex(sha256(read(p)));end,false)]
for (name,mutate,expected) in fixtures
 r=joinpath(outroot,name);mkpath(r)
 for f in ["model.json","weekdays.tsv","months.tsv","baseline-print.tsv","targets.tsv"];cp(joinpath(source,f),joinpath(r,f));end
 c=JSON.parsefile(joinpath(source,"certificate.json"));mutate(c,r);cert=joinpath(r,"certificate.json");write(cert,JSON.json(c))
 for (lang,cmd) in [("julia",`$julia --startup-file=no --project=$project $checker $r $cert`),("flix",`$java -Xmx768m -jar $jar $r $cert`)]
  p=open(joinpath(r,"$lang.stdout"),"w") do o;open(joinpath(r,"$lang.stderr"),"w") do e;run(pipeline(ignorestatus(cmd),stdout=o,stderr=e));end;end
  println("$name\t$lang\texit=$(p.exitcode)\texpected=$(expected ? "accept" : "reject")");flush(stdout)
  success(p)==expected || error("dissent: $name $lang")
 end
end
println("checks=16 accepted=2 rejected=14 dissent=0")
