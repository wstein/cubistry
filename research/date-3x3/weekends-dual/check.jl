# SPDX-License-Identifier: AGPL-3.0-or-later
# Independent finite edge obstruction, using Julia Dates for the Gregorian domain.
using JSON, SHA, Dates
need(x,s)=x || error(s)
modelraw=read(ARGS[1]); model=JSON.parse(String(copy(modelraw));duplicate_keys=:error,allownan=false,maxdepth=64); cert=JSON.parse(read(ARGS[2],String);duplicate_keys=:error,allownan=false,maxdepth=64)
function integer_policy(x)
 if x isa AbstractDict; foreach(integer_policy,values(x))
 elseif x isa AbstractVector; foreach(integer_policy,x)
 elseif x isa Number; need(x isa Integer && !(x isa Bool),"integer JSON numeric tokens only")
 end
end
integer_policy(cert)
need(bytes2hex(sha256(modelraw)) in ["c66142c64a2aa55d4c46b1a3367288d9cfeb88b3dcdb95c314912f907f7c3770","6f5a56ed87c844aeaaf24175409927f0dfe4f58b80024f878687c87da07f33cb"],"exact immutable source or requested model")
need(cert["modelSHA256"]==bytes2hex(sha256(modelraw)),"certificate model binding")
need(cert["schema"]=="cubistry.calendar-weekend-edge-certificate" && cert["version"]==1 && cert["status"]=="UNSAT","certificate schema")
function labels(d)
 w=dayofweek(d); word=model["weekdays"][w]; monthword=model["months"][month(d)]
 ("weekday:$(collect(word)[2]):$(w>=6 ? "weekend" : "regularWeekday")","month:$(collect(monthword)[2])","units:$(day(d)%10)")
end
observed=Set(labels(d) for d in Date(2000):Day(1):Date(2399,12,31))
fields=[sort!(unique([t[i] for t in observed])) for i in 1:3]
need(length.(fields)==[5,7,10],"field sizes")
product=Set((a,b,c) for a in fields[1] for b in fields[2] for c in fields[3])
need(observed==product && length(product)==350,"complete product")
need(cert["sourceDates"]==146097 && cert["productSize"]==350,"domain counts")
need([cert["fields"][k] for k in ["weekday","month","units"]]==fields,"retained fields")
reps=Set{Tuple{String,String,String}}()
for row in cert["coverage"]
 d=Date(row["date"]);need(Date(2000)<=d<Date(2400),"representative domain"); t=Tuple(row["labels"])
 need(t==labels(d) && !(t in reps),"representative unique and accurate");push!(reps,t)
end
need(reps==product,"retained complete coverage")
# Actual permanent art identity is (glyph, ink, weight); roles alone never alias.
arts=Set{Tuple{Char,String,Int}}()
for (i,word) in enumerate(model["weekdays"])
 s=model[i>=6 ? "weekend" : "regularWeekday"];push!(arts,(collect(word)[2],s["color"],s["weight"]))
end
for word in model["months"]
 s=model["month"];push!(arts,(collect(word)[2],s["color"],s["weight"]))
end
for n in '0':'9'
 s=model["day"];push!(arts,(n,s["color"],s["weight"]))
end
need(length(arts)==22,"22 different permanent images")
cases=cert["edgeBlankCases"]
need(cases["zero"]=="No blank front edge can be shown","zero blanks")
for k in ["one","twoOnOneBody"]
 need(cases[k]["remainingFaces"]==22 && cases[k]["fieldCounts"]==[5,7,10],"removed blank body")
 need(any(isodd,length.(fields)),"same-field pairing impossible")
end
alllabels=vcat(fields...); fieldof=Dict(label=>i for (i,f) in enumerate(fields) for label in f)
seen=Set{Tuple{String,String}}(); cross=0;parity=0
for row in cases["twoOnDifferentBodies"]
 pair=row["otherLabels"];need(length(pair)==2 && pair[1]!=pair[2] && all(haskey(fieldof,p) for p in pair),"valid pair")
 key=Tuple(sort(pair));need(!(key in seen),"unique pair");push!(seen,key)
 a,b=[fieldof[p] for p in pair];counts=length.(fields)
 if a!=b
  need(any(t->pair[1] in t && pair[2] in t, product),"both blank partners simultaneous");global cross+=1
 else
  counts[a]-=2;need(any(isodd,counts),"remaining pairing impossible");global parity+=1
 end
 need(row["remainingFieldCounts"]==counts,"exact remaining counts")
end
need(seen==Set(Tuple(sort([a,b])) for (i,a) in enumerate(alllabels) for b in alllabels[i+1:end]),"all partner pairs")
need(cases["threeOrMore"]["minimumMandatoryFaces"]==25 && cases["threeOrMore"]["availableFaces"]==24 && length(arts)+3>24,"three blank budget")
println("UNSAT\tdates=146097\tcombinations=350\timages=22\tpairs=$(length(seen))\tcross=$cross\tparity=$parity\tscope=German-A-fixed-layout-and-styles")
