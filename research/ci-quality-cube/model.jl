module QualityModel

using JSON, SHA

export POSITIONS, FRONT, FRONTPOS, REFS, POSES, MOVES, TRANS, identity_pose,
    corner_orientation, rotate, transpose3, rank4, unrank4, build_graph,
    distances, shortest_word, apply_word, print_definition, front_tiles,
    primitive_checks, writejson, readjson, target_index, MOVE_INVERSE, physical_state

const V3 = NTuple{3,Int}
const R3 = NTuple{3,V3} # columns, matching the existing physical contract
const X = (1,0,0); const Y = (0,1,0); const Z = (0,0,1)
const AXES = (X,(-1,0,0),Y,(0,-1,0),Z,(0,0,-1))
const POSITIONS = [(x,y,z) for x in (-1,1) for y in (-1,1) for z in (-1,1)]
const FRONT = [(-1,1,1),(1,1,1),(-1,-1,1),(1,-1,1)]
const FRONTPOS = [findfirst(==(p), POSITIONS) for p in FRONT]
dot3(a,b) = sum(a[i]*b[i] for i in 1:3)
cross3(a,b) = (a[2]*b[3]-a[3]*b[2],a[3]*b[1]-a[1]*b[3],a[1]*b[2]-a[2]*b[1])
rotate(M::R3,v::V3)::V3 = ntuple(i -> sum(M[j][i]*v[j] for j in 1:3),3)
transpose3(M::R3)::R3 = ntuple(i -> ntuple(j -> M[j][i],3),3)
mul(A::R3,B::R3)::R3 = ntuple(i -> rotate(A,B[i]),3)
const ROTATIONS = [R3((x,y,cross3(x,y))) for x in AXES for y in AXES if dot3(x,y)==0]
const REFS = [first(M for M in ROTATIONS if rotate(M,(1,1,1))==p) for p in POSITIONS]
const C = (Y,Z,X)
const C2 = mul(C,C)
const POWERS = ((X,Y,Z), C, C2)
const POSES = [mul(REFS[p],POWERS[t+1]) for p in 1:8 for t in 0:2]
const POSEINDEX = Dict(M=>i for (i,M) in enumerate(POSES))
const FACE = (("R",1,1,-1),("L",1,-1,1),("U",2,1,-1),
              ("D",2,-1,1),("F",3,1,-1),("B",3,-1,1))
const MOVES = [f*(n==1 ? "" : n==2 ? "2" : "'") for (f,_,_,_) in FACE for n in 1:3]
const MOVE_INVERSE = [3,2,1,6,5,4,9,8,7,12,11,10,15,14,13,18,17,16]
pose_position(q::Int) = (q-1)÷3+1
pose_twist(q::Int) = (q-1)%3
identity_pose() = [3(p-1)+1 for p in 1:8]
corner_orientation(body::Int,q::Int) = mul(POSES[q],transpose3(REFS[body]))
function quarter(v::V3,axis::Int)::V3
    x,y,z=v
    axis==1 ? (x,-z,y) : axis==2 ? (z,y,-x) : (-y,x,z)
end
function transition(q::Int,m::Int)
    _,axis,layer,direction = FACE[(m-1)÷3+1]
    POSITIONS[pose_position(q)][axis]==layer || return q
    amount=mod(((m-1)%3+1)*direction,4)
    M=POSES[q]
    for _ in 1:amount
        M=ntuple(i -> quarter(M[i],axis),3)
    end
    POSEINDEX[M]
end
const TRANS = [transition(q,m) for q in 1:24, m in 1:18]

"""Rank four ordered distinct-position poses; no global rotation quotient."""
function rank4(q::NTuple{4,Int})
    bits=0; pindex=0; trank=0
    for i in 1:4
        p=pose_position(q[i])-1
        (bits & (1<<p))==0 || error("repeated partial corner position")
        digit=p-count_ones(bits & ((1<<p)-1))
        pindex=pindex*(9-i)+digit
        bits |= 1<<p
        trank=3trank+pose_twist(q[i])
    end
    pindex*81+trank+1
end
function unrank4(index::Int)::NTuple{4,Int}
    1<=index<=136080 || error("partial rank outside range")
    pindex,trank=divrem(index-1,81)
    digits=zeros(Int,4); twists=zeros(Int,4)
    for i in 4:-1:1
        pindex,digits[i]=divrem(pindex,9-i)
        trank,twists[i]=divrem(trank,3)
    end
    available=collect(0:7)
    result=zeros(Int,4)
    for i in 1:4
        result[i]=3splice!(available,digits[i]+1)+twists[i]+1
    end
    Tuple(result)
end
const CANONICAL = Tuple(3(p-1)+1 for p in FRONTPOS)
const GOAL = rank4(CANONICAL)
function target_index(source::NTuple{4,Int},twists::NTuple{4,Int})
    rank4(ntuple(i -> 3(pose_position(source[i])-1)+mod(pose_twist(source[i])-twists[i],3)+1,4))
end
function build_graph()
    graph=Matrix{Int32}(undef,18,136080)
    for i in 1:136080
        q=unrank4(i)
        for m in 1:18
            graph[m,i]=rank4(ntuple(k -> TRANS[q[k],m],4))
        end
    end
    graph
end
function distances(graph)
    d=fill(typemax(UInt8),136080); d[GOAL]=0
    queue=Vector{Int32}(undef,136080); queue[1]=GOAL
    head=1; tail=1
    while head<=tail
        index=queue[head];head+=1
        for m in 1:18
            next=graph[m,index]
            if d[next]==typemax(UInt8)
                d[next]=d[index]+1
                tail+=1;queue[tail]=next
            end
        end
    end
    tail==136080 || error("partial graph is not completely reached")
    d
end
function shortest_word(q::NTuple{4,Int},twists::NTuple{4,Int},graph,d)
    index=target_index(q,twists); word=Int[]
    while index!=GOAL
        m=findfirst(m -> d[graph[m,index]]+1==d[index],1:18)
        isnothing(m) && error("distance has no descending move")
        push!(word,m);index=graph[m,index]
    end
    word
end
apply_word(pose,word) = foldl((q,m) -> [TRANS[p,m] for p in q],word;init=copy(pose))

function primitive_checks()
    length(Set(POSES))==24 || error("pose catalog")
    for q in 1:24,m in 1:18
        TRANS[TRANS[q,m],MOVE_INVERSE[m]]==q || error("inverse move")
        p=pose_position(q);t=pose_twist(q)
        next=TRANS[q,m]
        delta=pose_twist(TRANS[3(p-1)+1,m])
        pose_twist(next)==mod(t+delta,3) || error("twist additivity")
    end
    true
end

const CATEGORIES = ("Build","Test","Analyze","Review")
const STATES = ("open","running","OK","error","blocked")
"""Each category owns two bodies; pattern entries are labels on target twists 0..2."""
function print_definition(pairs,patterns,id)
    sort(vcat([collect(p) for p in pairs]...))==collect(1:8) || error("category pairs must partition all bodies")
    stickers=Any[]
    for c in 1:4,a in 1:2,t in 0:2
        body=pairs[c][a]
        orientation=corner_orientation(body,3(FRONTPOS[c]-1)+t+1)
        inv=transpose3(orientation)
        state=patterns[c][3(a-1)+t+1]
        asset=state==0 ? "neutral" : "quality-$(lowercase(CATEGORIES[c]))-$(lowercase(STATES[state]))"
        push!(stickers,Dict("id"=>length(stickers),"cubie"=>body-1,
            "normal"=>rotate(inv,Z),"up"=>rotate(inv,Y),"assetId"=>asset,
            "materialId"=>"sticker","equivalentQuarterTurns"=>[0]))
    end
    Dict("schema"=>"cubistry.print","version"=>1,"id"=>id,
        "topology"=>Dict("kind"=>"cube","size"=>2),
        "cubies"=>[Dict("id"=>i-1,"position"=>p) for (i,p) in enumerate(POSITIONS)],
        "stickers"=>stickers)
end
function front_tiles(print,pose)
    result=Vector{Any}(undef,4)
    for (slot,p) in enumerate(FRONT)
        matches=Any[]
        for sticker in print["stickers"]
            body=sticker["cubie"]+1
            POSITIONS[pose_position(pose[body])]==p || continue
            O=corner_orientation(body,pose[body])
            rotate(O,Tuple(sticker["normal"]))==Z || continue
            push!(matches,Dict("id"=>sticker["id"],"assetId"=>sticker["assetId"],
                "up"=>rotate(O,Tuple(sticker["up"]))))
        end
        length(matches)==1 || error("front must contain exactly one sticker per slot")
        result[slot]=only(matches)
    end
    result
end
physical_state(print,pose)=Dict("schema"=>"cubistry.state","version"=>1,
    "printId"=>print["id"],"topology"=>print["topology"],
    "cubies"=>[Dict("id"=>body-1,"position"=>POSITIONS[pose_position(pose[body])],
        "orientation"=>corner_orientation(body,pose[body])) for body in 1:8])
writejson(path,value)=open(io -> write(io,JSON.json(value;pretty=2)*"\n"),path,"w")
readjson(path)=JSON.parsefile(path)

end
