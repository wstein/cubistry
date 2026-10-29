module IndependentProof
using JSON, SHA
const CHAIN_PIN = "e051e2f4a14293dbeecc7cf123b914481bdcc0c2452c156e099102f1eeb07a88"
const MANIFEST_PIN = "c0d0fa2fc6d692c7c89e436fe5a2670503d8a8a6c86a2cc0d1397be983832e01"
const V3 = NTuple{3,Int}
struct Invalid <: Exception
    code::String
    message::String
end
Base.showerror(io::IO,e::Invalid)=print(io,e.code,": ",e.message)
need(ok,message;code="INVALID") = ok || throw(Invalid(code,message))
struct Sticker
    id::Int
    cubie::Int
    p::V3
    n::V3
    up::V3
    image::String
end
key(s::Sticker)=(s.id,s.cubie,s.p,s.n,s.up,s.image)
Base.:(==)(a::Sticker,b::Sticker)=key(a)==key(b)
const AXES=Set((sign*(i==1),sign*(i==2),sign*(i==3)) for i in 1:3 for sign in (-1,1))
dot3(a,b)=sum(a[i]*b[i] for i in 1:3)
cross3(a,b)=(a[2]*b[3]-a[3]*b[2],a[3]*b[1]-a[1]*b[3],a[1]*b[2]-a[2]*b[1])
function integer(value,lo,hi)
    need(value isa Integer && !(value isa Bool),"JSON integer token required")
    need(lo<=value<=hi,"integer range")
    Int(value)
end
function vec(value)
    need(value isa AbstractVector && length(value)==3,"three-component vector required")
    Tuple(integer(v,-1,1) for v in value)
end
function scalar_string(value)
    need(value isa AbstractString && isvalid(value),"Unicode scalar string required")
    need(all(c->!(0xd800<=UInt32(c)<=0xdfff),value),"unpaired surrogate")
    String(value)
end
function validate_strings(value)
    if value isa AbstractString
        scalar_string(value)
    elseif value isa AbstractDict
        for (k,v) in value;scalar_string(k);validate_strings(v);end
    elseif value isa AbstractVector
        for v in value;validate_strings(v);end
    end
end
function read_json(path)
    bytes=read(path);need(length(bytes)<=16*1024*1024,"JSON byte limit")
    raw=String(bytes);need(isvalid(raw),"invalid UTF-8")
    in_string=false;escaped=false;number_length=0;depth=0
    for b in codeunits(raw)
        if in_string
            if escaped;escaped=false
            elseif b==0x5c;escaped=true
            elseif b==0x22;in_string=false
            end
        elseif b==0x22
            in_string=true;number_length=0
        else
            if b==0x7b || b==0x5b;depth+=1;need(depth<=64,"JSON nesting limit")
            elseif b==0x7d || b==0x5d;depth-=1;need(depth>=0,"invalid container closure")
            end
            numeric=(0x30<=b<=0x39)||b in (0x2d,0x2b,0x2e,0x65,0x45)
            if number_length>0 && numeric;number_length+=1
            elseif (0x30<=b<=0x39)||b==0x2d;number_length=1
            else;number_length=0
            end
            need(number_length<=128,"JSON numeric-token limit")
        end
    end
    value=try
        JSON.parse(raw;duplicate_keys=:error,allownan=false,maxdepth=64)
    catch error
        throw(Invalid("INVALID_JSON",sprint(showerror,error)))
    end
    validate_strings(value)
    value,bytes2hex(sha256(raw))
end
function field(obj,name)
    need(obj isa AbstractDict && haskey(obj,name),"required field "*name)
    obj[name]
end
function stickers(rows,size)
    count=size==2 ? 24 : 54;lastbody=size==2 ? 7 : 25
    need(rows isa AbstractVector && length(rows)==count,"complete sticker count")
    [Sticker(integer(field(s,"id"),0,count-1),integer(field(s,"cubie"),0,lastbody),
             vec(field(s,"p")),vec(field(s,"n")),vec(field(s,"up")),scalar_string(field(s,"image"))) for s in rows]
end
function groups(state)
    result=Dict{Int,Vector{Sticker}}()
    for s in state;push!(get!(result,s.cubie,Sticker[]),s);end
    result
end
function source_valid(state,size)
    facecount=size==2 ? 24 : 54;bodycount=size==2 ? 8 : 26
    need(sort([s.id for s in state])==collect(0:facecount-1),"distinct source IDs")
    levels=size==2 ? (-1,1) : (-1,0,1)
    expected=Set((p,n) for p in Iterators.product(levels,levels,levels) for n in AXES if dot3(p,n)==1)
    need(Set((s.p,s.n) for s in state)==expected,"complete outward facelet lattice")
    for s in state
        need(s.n in AXES && s.up in AXES && dot3(s.n,s.up)==0,"rigid signed-axis tangent frame")
    end
    bybody=groups(state)
    need(sort(collect(keys(bybody)))==collect(0:bodycount-1),"distinct source bodies")
    occupied=Set{V3}()
    for body in values(bybody)
        p=body[1].p
        need(all(s->s.p==p,body),"one position per body")
        need(length(body)==(size==2 ? 3 : count(!=(0),p)),"whole physical body")
        push!(occupied,p)
    end
    need(length(occupied)==bodycount,"distinct body positions")
    bybody
end
function quarter(v,axis)
    a=ntuple(i->Int(i==axis),3);c=cross3(a,v);d=dot3(a,v)
    ntuple(i->c[i]+a[i]*d,3)
end
function rotated(v,axis,q)
    for _ in 1:mod(q,4);v=quarter(v,axis);end
    v
end
function is_separator(c)
    x=UInt32(c)
    9<=x<=13 || 28<=x<=32 || x in (0x85,0xa0,0x1680,0x2028,0x2029,0x202f,0x205f,0x3000) || 0x2000<=x<=0x200a
end
function moves(word;whole=false)
    scalar_string(word);need(ncodeunits(word)<=16384,"move-word byte limit")
    ts=String.(split(word,is_separator;keepempty=false));need(length(ts)<=1024,"move-token limit")
    pattern=whole ? r"^[RLUDFBxyz](2|')?$" : r"^[RLUDFB](2|')?$"
    need(all(t->occursin(pattern,t),ts),"explicit legal move notation required")
    ts
end
const LAYERS=Dict('R'=>(1,1),'L'=>(1,-1),'U'=>(2,1),'D'=>(2,-1),'F'=>(3,1),'B'=>(3,-1),'x'=>(1,0),'y'=>(2,0),'z'=>(3,0))
function apply_tokens(state,ts)
    for token in ts
        axis,layer=LAYERS[first(token)];amount=endswith(token,"2") ? 2 : endswith(token,"'") ? -1 : 1
        q=-(layer==0 ? 1 : layer)*amount
        state=[layer==0 || s.p[axis]==layer ? Sticker(s.id,s.cubie,rotated(s.p,axis,q),rotated(s.n,axis,q),rotated(s.up,axis,q),s.image) : s for s in state]
    end
    state
end
apply_word(state,word)=apply_tokens(state,moves(word;whole=true))
inverse_tokens(ts)=[endswith(t,"2") ? t : endswith(t,"'") ? t[1:end-1] : t*"'" for t in reverse(ts)]
function canonical_string(s)
    io=IOBuffer();write(io,'"')
    for c in s
        x=UInt32(c)
        if c=='"';write(io,"\\\"")
        elseif c=='\\';write(io,"\\\\")
        elseif x in (8,9,10,12,13);write(io,Dict(8=>"\\b",9=>"\\t",10=>"\\n",12=>"\\f",13=>"\\r")[Int(x)])
        elseif x<32 || x>=127
            if x<=0xffff;write(io,"\\u"*string(x;base=16,pad=4))
            else
                y=x-0x10000;write(io,"\\u"*string(0xd800+(y>>10);base=16,pad=4)*"\\u"*string(0xdc00+(y&0x3ff);base=16,pad=4))
            end
        else;write(io,c)
        end
    end
    write(io,'"');String(take!(io))
end
vwire(v)="["*join(v,",")*"]"
function state_wire(state)
    "["*join(("["*string(s.id)*","*string(s.cubie)*","*vwire(s.p)*","*vwire(s.n)*","*vwire(s.up)*","*canonical_string(s.image)*"]" for s in sort(state;by=s->s.id)),",")*"]"
end
state_hash(state)=bytes2hex(sha256(state_wire(state)))
function show_counter(state,value,padded)
    expected=["title-left","title-right",!padded && value<10 ? " " : string(div(value,10)),string(mod(value,10))]
    for (p,image) in zip([(-1,1,1),(1,1,1),(-1,-1,1),(1,-1,1)],expected)
        face=filter(s->s.p==p && s.n==(0,0,1),state)
        need(length(face)==1 && face[1].image==image,"immutable counter target")
        need(image==" " || face[1].up==(0,1,0),"upright counter print")
    end
end
function check_counter(data,chain)
    need(field(data,"schema") isa Integer && !(data["schema"] isa Bool) && data["schema"]==1 && field(data,"puzzle")=="2x2x2","unsupported counter format";code="UNSUPPORTED")
    source=stickers(field(data,"printing"),2);source_valid(source,2)
    declared=stickers(field(data,"unpaddedPrinting"),2);source_valid(declared,2)
    unpadded=[Sticker(s.id,s.cubie,s.p,s.n,s.up,s.cubie<4 && s.image=="0" ? " " : s.image) for s in source]
    need(declared==unpadded && sum(source .!= unpadded)==1,"one declared immutable unpadded print")
    witnesses=field(data,"witnesses");need(witnesses isa AbstractVector && length(witnesses)==100,"all witnesses")
    need([integer(field(w,"value"),0,99) for w in witnesses]==collect(0:99),"ordered witness values")
    words=[moves(field(w,"word")) for w in witnesses];states=Vector{Sticker}[]
    for value in 0:99
        state=apply_tokens(source,words[value+1]);show_counter(state,value,true)
        need(apply_tokens(state,inverse_tokens(words[value+1]))==source,"counter inverse full state")
        show_counter(apply_tokens(unpadded,words[value+1]),value,false);push!(states,state)
    end
    need(length(chain)==801 && all(x->x isa Integer && !(x isa Bool) && 0<=x<=99,chain),"pinned 801-value chain")
    for (printing,padded) in [(source,true),(unpadded,false)]
        state=apply_tokens(printing,words[1]);current=0
        for value in chain[2:end]
            state=apply_tokens(state,vcat(inverse_tokens(words[current+1]),words[value+1]));show_counter(state,value,padded)
            need(state==apply_tokens(printing,words[value+1]),"chained full state differs");current=value
        end
    end
    need(8*3==24 && (8-2)*3==18 && 10*2==20 && 9*2+1+1==20,"fixed upper-body proof premises")
    bad=copy(source);j=findfirst(s->s.image=="title-left",bad);s=bad[j];bad[j]=Sticker(s.id,s.cubie,s.p,s.n,ntuple(i->-s.up[i],3),s.image)
    rejected=false
    for value in 0:99
        try;show_counter(apply_tokens(bad,words[value+1]),value,true)
        catch e;e isa Invalid || rethrow();rejected=true;break
        end
    end
    need(rejected,"actual rotated-title tamper must reject")
    canonical="["*join((state_wire(s) for s in states),",")*"]"
    Dict("valid"=>true,"status"=>"VALID","values"=>100,"inverseChecks"=>100,"chainedTransitionsPerFormat"=>800,
         "hubOrderedTransitions"=>10000,"fixedBodyPremises"=>true,"rotatedTitleRejected"=>true,
         "canonicalStateSHA256"=>bytes2hex(sha256(canonical)),"canonicalStates"=>[JSON.parse(state_wire(s)) for s in states])
end
const NORMALS=Dict('U'=>(0,1,0),'L'=>(-1,0,0),'F'=>(0,0,1),'R'=>(1,0,0),'B'=>(0,0,-1),'D'=>(0,-1,0))
const CORNER_FACES=[('U','R','F'),('U','F','L'),('U','L','B'),('U','B','R'),('D','F','R'),('D','L','F'),('D','B','L'),('D','R','B')]
const EDGE_FACES=[('U','R'),('U','F'),('U','L'),('U','B'),('D','R'),('D','F'),('D','L'),('D','B'),('F','R'),('F','L'),('B','L'),('B','R')]
face_position(fs)=ntuple(i->sum(NORMALS[f][i] for f in fs),3)
const CORNER_POS=face_position.(CORNER_FACES)
const EDGE_POS=face_position.(EDGE_FACES)
const CENTER_FACES=['U','L','F','R','B','D']
function rotations()
    result=NTuple{3,V3}[]
    for x in AXES,y in AXES
        dot3(x,y)==0 || continue
        push!(result,(x,y,cross3(x,y)))
    end
    need(length(Set(result))==24,"proper rotation group")
    result
end
const ROTATIONS=rotations()
rotate(R,v)=ntuple(i->sum(R[j][i]*v[j] for j in 1:3),3)
transform(s,R)=Sticker(s.id,s.cubie,rotate(R,s.p),rotate(R,s.n),rotate(R,s.up),s.image)
parity(p)=mod(sum(Int(p[i]>p[j]) for i in eachindex(p) for j in i+1:length(p)),2)
function check_state(data;include_state=true)
    need(field(data,"schema")=="cubistry.marked-3x3.v1","unsupported marked-cube format";code="UNSUPPORTED")
    source=stickers(field(data,"printing"),3)
    actual=stickers(field(data,"state"),3)
    check_state_parts(source,actual,data;include_state=include_state)
end
function check_state_parts(source,actual,data;include_state=true)
    sg=source_valid(source,3)
    need(sort([s.id for s in actual])==collect(0:53),"complete actual IDs")
    byid=Dict(s.id=>s for s in actual);source_byid=Dict(s.id=>s for s in source)
    need(all(s->s.cubie==source_byid[s.id].cubie && s.image==source_byid[s.id].image,actual),"immutable body/image IDs")
    source_valid(actual,3)
    for body in values(sg)
        need(any(R->all(s->transform(s,R)==byid[s.id],body),ROTATIONS),"rigid proper body rotation")
    end
    centers=filter(s->count(!=(0),s.p)==1,source)
    R=findfirst(R->all(s->rotate(R,byid[s.id].p)==s.p && rotate(R,byid[s.id].n)==s.n,centers),ROTATIONS)
    need(R!==nothing,"centers do not form one rigid reference frame")
    normalized=[transform(s,ROTATIONS[R]) for s in actual];nm=Dict(s.id=>s for s in normalized);ng=groups(normalized)
    occupant=Dict(body[1].p=>id for (id,body) in ng)
    cp=Int[];co=Int[];ep=Int[];eo=Int[]
    for (p,faces) in zip(CORNER_POS,CORNER_FACES)
        body=sg[occupant[p]];srcidx=findfirst(==(body[1].p),CORNER_POS);need(srcidx!==nothing,"corner source class")
        push!(cp,srcidx);tag=only(filter(s->abs(s.n[2])==1,body));idx=findfirst(f->NORMALS[f]==nm[tag.id].n,faces)
        need(idx!==nothing,"corner orientation");push!(co,idx-1)
    end
    for (p,faces) in zip(EDGE_POS,EDGE_FACES)
        body=sg[occupant[p]];srcidx=findfirst(==(body[1].p),EDGE_POS);need(srcidx!==nothing,"edge source class")
        push!(ep,srcidx);firstnormal=NORMALS[EDGE_FACES[srcidx][1]];tag=only(filter(s->s.n==firstnormal,body));idx=findfirst(f->NORMALS[f]==nm[tag.id].n,faces)
        need(idx!==nothing,"edge orientation");push!(eo,idx-1)
    end
    need(mod(sum(co),3)==0,"corner twist sum")
    need(mod(sum(eo),2)==0,"edge flip sum")
    need(parity(cp)==parity(ep),"corner/edge permutation parity")
    center_twists=Int[]
    for face in CENTER_FACES
        n=NORMALS[face];s=only(filter(s->s.p==n && s.n==n,centers));axis,layer=LAYERS[face]
        q=findfirst(k->rotated(s.up,axis,-layer*k)==nm[s.id].up,0:3)
        need(q!==nothing,"center quarter orientation");push!(center_twists,q-1)
    end
    need(mod(sum(center_twists),2)==parity(cp),"physical center/corner parity")
    if haskey(data,"centerTwists")
        v=field(data,"centerTwists");need(v isa AbstractVector && length(v)==6,"six declared physical center twists")
        need([integer(x,0,3) for x in v]==center_twists,"declared twists contradict full frames")
    end
    goal=nothing
    if haskey(data,"centerGoal") || haskey(data,"periods")
        g=field(data,"centerGoal");p=field(data,"periods");need(g isa AbstractVector && p isa AbstractVector && length(g)==length(p)==6,"six optical goals/periods")
        g=[integer(x,0,3) for x in g];p=[integer(x,1,4) for x in p];need(all(x->x in (1,2,4),p),"optical periods 1/2/4")
        goal=all(mod(center_twists[i]-g[i],p[i])==0 for i in 1:6)
    end
    result=Dict{String,Any}("valid"=>true,"status"=>"VALID","centerTwists"=>center_twists,"goalMatches"=>goal,"cornerTwistSum"=>sum(co)%3,
        "edgeFlipSum"=>sum(eo)%2,"cornerParity"=>parity(cp),"edgeParity"=>parity(ep),"stateSHA256"=>state_hash(actual))
    include_state && (result["state"]=JSON.parse(state_wire(actual)))
    result
end
function invalid_result(error)
    error isa Invalid ? Dict("valid"=>false,"status"=>error.code,"reason"=>error.message) :
        Dict("valid"=>false,"status"=>"ERROR","reason"=>sprint(showerror,error))
end
include("Conformance.jl")
end
