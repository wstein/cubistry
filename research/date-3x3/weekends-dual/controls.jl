# SPDX-License-Identifier: AGPL-3.0-or-later
using JSON
root=@__DIR__; base=JSON.parsefile(joinpath(root,"requested-certificate.json"));model=read(joinpath(root,"requested-model.json"),String)
oldmodel=JSON.parsefile(joinpath(root,"model.json"));newmodel=JSON.parse(model)
@assert oldmodel["weekend"]["weight"]==800 && newmodel["weekend"]["weight"]==600
@assert newmodel["scope"]==replace(oldmodel["scope"],"red and weight 800"=>"red and weight 600 (unchanged font weight)")
newmodel["weekend"]["weight"]=800;newmodel["scope"]=oldmodel["scope"];@assert newmodel==oldmodel
oldcert=JSON.parsefile(joinpath(root,"certificate.json"));newcert=deepcopy(base);newcert["modelSHA256"]=oldcert["modelSHA256"];@assert newcert==oldcert
fixtures=[("valid",identity,true), ("missing-coverage",c->pop!(c["coverage"]),false), ("wrong-date",c->(c["coverage"][1]["date"]="2000-01-02"),false), ("missing-pair",c->pop!(c["edgeBlankCases"]["twoOnDifferentBodies"]),false),("duplicate-pair",c->(c["edgeBlankCases"]["twoOnDifferentBodies"][2]=deepcopy(c["edgeBlankCases"]["twoOnDifferentBodies"][1])),false),("wrong-parity-count",c->(c["edgeBlankCases"]["twoOnDifferentBodies"][1]["remainingFieldCounts"][1]=4),false),("wrong-budget",c->(c["edgeBlankCases"]["threeOrMore"]["availableFaces"]=25),false),("float-version",c->(c["version"]=1.0),false),("wrong-model-binding",c->(c["modelSHA256"]="0"^64),false)]
mkpath(joinpath(root,"controls"));julia=joinpath(Sys.BINDIR,"julia"); java=get(ENV,"JAVA","java")
project=get(ENV,"JULIA_PROJECT",root); jar=get(ENV,"FLIX_JAR",joinpath(root,"flix/artifact/flix.jar"))
function check(name,path,expect,modelpath=joinpath(root,"requested-model.json"))
 commands=[("julia",`$julia --startup-file=no --project=$project $(joinpath(root,"check.jl")) $modelpath $path`),("flix",`$java -Xmx768m -jar $jar $modelpath $path`)]
 for (checker,cmd) in commands
  out=joinpath(root,"controls","$name.$checker.stdout");err=joinpath(root,"controls","$name.$checker.stderr")
  p=open(out,"w") do o; open(err,"w") do e; run(pipeline(ignorestatus(cmd),stdout=o,stderr=e));end;end
  accepted=success(p);println("$name\t$checker\texit=$(p.exitcode)\texpected=$(expect ? "accept" : "reject")")
  accepted==expect || error("dissent: $name $checker")
 end
end
for (name,change,expect) in fixtures
 c=deepcopy(base);change(c);path=joinpath(root,"controls","$name.json");write(path,JSON.json(c));check(name,path,expect)
end
badmodel=joinpath(root,"controls","wrong-ink-model.json");write(badmodel,replace(model,"#ba302c"=>"#25343e"));check("wrong-ink",joinpath(root,"certificate.json"),false,badmodel)
raw=read(joinpath(root,"certificate.json"),String);dup=joinpath(root,"controls","duplicate-key.json");write(dup,replace(raw,"\"version\": 1,"=>"\"version\": 1, \"version\": 1,"));check("duplicate-key",dup,false)
check("source-valid",joinpath(root,"certificate.json"),true,joinpath(root,"model.json"))
println("controls=12 checks=24 expected-valid=4 expected-invalid=20 exact-requested-derivation=pass")
