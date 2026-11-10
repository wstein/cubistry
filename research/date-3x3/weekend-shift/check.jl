# SPDX-License-Identifier: AGPL-3.0-or-later
# Independent raw-input transport inventory and reserved-corner obstruction.
using JSON, SHA, Dates
need(x,s)=x || error(s)
function rawjson(path;allow_model_booleans=false)
 raw=read(path,String);need(isvalid(raw) && ncodeunits(raw)<=16*1024*1024,"raw UTF-8/size")
 x=JSON.parse(raw;duplicate_keys=:error,allownan=false,maxdepth=64)
 function types(x)
  if x isa AbstractDict;foreach(types,values(x))
  elseif x isa AbstractVector;foreach(types,x)
  elseif x isa Number;need((allow_model_booleans && x isa Bool) || (x isa Integer && !(x isa Bool)),"integer JSON numbers")
  elseif x isa AbstractString;need(isvalid(x) && all(c->!(0xd800<=UInt32(c)<=0xdfff),x),"Unicode scalar strings")
  end
 end
 types(x);x
end
root=ARGS[1];cert=rawjson(ARGS[2]);model=rawjson(joinpath(root,"model.json");allow_model_booleans=true)
pins=Dict("model.json"=>"4f6aebe0784d83d823c3f4316384c7280cc3bf5917a18a4d6abec12fdc9ddb2b","weekdays.tsv"=>"b3f586b0245e7a3947c7e10bf7b087c4d5bad259eef263dc6fff2fe6d9a67044","months.tsv"=>"df2de9ee2db42ccff03e7512be05c50dc740d3223d1203622684af902abd0f74","baseline-print.tsv"=>"608a6a525a3723394e2c54c7151157b97c3ac753f1f30cf4435a748828978e64")
for (name,key) in [("model.json","modelSHA256"),("weekdays.tsv","weekdaySHA256"),("months.tsv","monthSHA256"),("baseline-print.tsv","baselineSHA256")]
 need(bytes2hex(sha256(read(joinpath(root,name))))==pins[name]==cert[key],"exact raw input pin: $name")
end
need(cert["schema"]=="cubistry.german-weekend-shift-corner-certificate" && cert["version"]==1 && cert["claim"]=="UNSAT","certificate schema/claim")
rows(name)=split.(readlines(joinpath(root,name)),'\t';keepempty=true)
wd=rows("weekdays.tsv");mo=rows("months.tsv");bp=rows("baseline-print.tsv")
need(wd[1]==["weekday","name","left","middle","right","ink"] && length(wd)==8 && all(length(r)==6 for r in wd),"weekday table")
need(mo[1]==["month","left","middle","right"] && length(mo)==13 && all(length(r)==4 for r in mo),"month table")
need(bp[1]==["id","cubie","p","n","up","image","slot"] && length(bp)==55,"baseline table")
vec(s)=Tuple(parse.(Int,split(s,',')))
dot(a,b)=sum(a.*b);cross(a,b)=(a[2]*b[3]-a[3]*b[2],a[3]*b[1]-a[1]*b[3],a[1]*b[2]-a[2]*b[1])
inv(p,n,u)=(dot(p,u),dot(p,cross(n,u)))
geometry=Dict{Int,Vector{Tuple}}()
for (i,r) in enumerate(bp[2:end])
 need(length(r)==7 && parse(Int,r[1])==i-1,"baseline sticker ids")
 p,n,u=vec.(r[3:5]);need(all(length(v)==3 && all(abs(x)<=1 for x in v) for v in (p,n,u)),"lattice")
 need(dot(n,n)==dot(u,u)==1 && dot(n,u)==0 && dot(p,n)==1,"sticker frame")
 body=get!(geometry,parse(Int,r[2]),Tuple[]);push!(body,(p,n,u,r[6]))
end
need(length(geometry)==26 && all(length(unique(s[1] for s in body))==1 for body in values(geometry)),"rigid cubies")
need(length(Set((s[1],s[2]) for body in values(geometry) for s in body))==54,"unique sticker planes")
capacity=Dict(k=>sum(length(b) for b in values(geometry) if count(!iszero,b[1][1])==n) for (k,n) in [("corner",3),("edge",2),("center",1)])
need(capacity==Dict("corner"=>24,"edge"=>24,"center"=>6),"physical pools")
# Rotation closure witnesses the invariant independently of the source's slot metadata.
q(v,a)=a==1 ? (v[1],-v[3],v[2]) : a==2 ? (v[3],v[2],-v[1]) : (-v[2],v[1],v[3])
frontp(i)=((i-1)%3-1,1-(i-1)÷3,1)
for i in [1,3,7,9]
 initial=(frontp(i),(0,0,1),(0,1,0));poses=Set([initial]);todo=[initial]
 while !isempty(todo)
  s=pop!(todo)
  for a in 1:3
   t=Tuple(q(v,a) for v in s);need(inv(t...)==inv(initial...),"proper rotation invariant")
   if !(t in poses);push!(poses,t);push!(todo,t);end
  end
 end
 need(length(poses)==24,"24 proper rotations")
 upright=Set(p for (p,n,u) in poses if n==(0,0,1) && u==(0,1,0))
 need(upright==Set([frontp(i)]),"one upright cell per transported nonblank face")
 need(length(Set(p for (p,n,u) in poses if n==(0,0,1)))==4,"blank reaches all four corner cells")
end
nrows=[r for r in bp[2:end] if r[6]=="N"]
need(Set(inv(vec(r[3]),vec(r[4]),vec(r[5])) for r in nrows)==Set([(-1,1),(-1,-1)]),"baseline brown N has two transported classes")
weekday=[r[3:5] for r in wd[2:end]];months=[r[2:4] for r in mo[2:end]]
need([length(Set(r[c] for r in weekday)) for c in 1:3]==cert["weekdayDistinctIncludingBlank"]==[4,4,3],"weekday distinct counts include blank")
function board(d)
 w=dayofweek(d);m=month(d);n=day(d)
 text=vcat(weekday[w],["",string(n÷10),string(n%10)],months[m])
 role=vcat(fill(wd[w+1][6],3),fill("day",3),fill("month",3))
 [(text[i],text[i]=="" ? "blank" : role[i]) for i in 1:9]
end
pool(i)=i==5 ? "center" : i in [1,3,7,9] ? "corner" : "edge"
function art(cell,i)
 text,role=cell
 text=="" && return ("blank",)
 ink=model[role]["color"];weight=model[role]["weight"]
 (text,ink,weight,inv(frontp(i),(0,0,1),(0,1,0))...)
end
classes=Dict(k=>Set{Tuple}() for k in keys(capacity));blankpeak=Dict(k=>0 for k in keys(capacity));slots=Dict(i=>Set{Tuple}() for i in [1,3,7,9]);targets=Set{Tuple{Int,Int,Int}}();rawtargets=Set{String}();sourceDates=0
for d in Date(2000):Day(1):Date(2399,12,31)
 b=board(d);blankcounts=Dict(k=>0 for k in keys(capacity))
 push!(rawtargets,join(vcat(string.([dayofweek(d)-1,month(d),day(d)]),[text*":"*role for (text,role) in b]),'\t'))
 for i in 1:9
  a=art(b[i],i);p=pool(i)
  if a==("blank",);blankcounts[p]+=1
  else;push!(classes[p],a);haskey(slots,i) && push!(slots[i],a)
  end
 end
 need(blankcounts["corner"]==1,"every target requires a blank corner")
 for k in keys(capacity);blankpeak[k]=max(blankpeak[k],blankcounts[k]);end
 push!(targets,(dayofweek(d)-1,month(d),day(d)));global sourceDates+=1
end
need(sourceDates==cert["dates"]==146097 && length(targets)==cert["targets"]==2562,"full Gregorian cycle and distinct target coverage")
raw=read(joinpath(root,"targets.tsv"),String);retained=split(chomp(raw),'\n')
need(bytes2hex(sha256(raw))==cert["targetSHA256"],"raw target hash binding")
need(retained[1]==join(vcat(["weekday","month","day"],["cell$i" for i in 0:8]),'\t') && length(retained)==2563 && Set(retained[2:end])==rawtargets,"all 2562 raw targets match independent reconstruction")
nonblank=Dict(k=>length(v) for (k,v) in classes)
need(nonblank==Dict("corner"=>23,"edge"=>21,"center"=>4)==cert["mandatoryNonblankByPool"],"transported nonblank demand")
need(blankpeak==Dict("corner"=>1,"edge"=>1,"center"=>0)==cert["blankPeakByPool"],"neutral blank peak")
need([length(slots[i]) for i in [1,3,7,9]]==cert["cornerClassesBySlot"]==[3,2,8,10],"corner slot demand")
faces=capacity["corner"];mandatory=nonblank["corner"];bodies=count(b->length(b)==3,values(geometry));bodyfaces=3
need(cert["cornerFaces"]==faces && cert["cornerBodies"]==bodies && cert["cornerFacesPerBody"]==bodyfaces,"corner geometry binding")
need(faces-mandatory==cert["maximumBlankFaces"]==1,"at most one blank face")
need(cert["zeroBlankCase"]=="Every target requires a blank corner","zero-blank case")
one=cert["oneBlankCase"];need(one["reservedBodies"]==1 && one["remainingFaces"]==faces-bodyfaces && one["requiredNonblankClasses"]==mandatory && faces-bodyfaces<mandatory,"reserved blank corner cannot carry unique mandatory nonblank art")
two=cert["twoOrMoreBlankCase"];need(two["minimumFaces"]==mandatory+2 && two["availableFaces"]==faces && mandatory+2>faces,"two blank faces exceed budget")
println("UNSAT\tdates=$sourceDates\ttargets=$(length(targets))\tcorner=23+1/24\tedge=21+1/24\tcenter=4+0/6\tcornerSlots=3,2,8,10\treservedCornerLeaves=21<23\tscope=German-shifted-weekend-strict-upright")
