#!/usr/bin/env julia
# Native physical replay. GAP/group-order/membership claims are not trusted.
include(joinpath(@__DIR__,"prepare_physical.jl"))

const PointPerm=Vector{UInt16}
const AXIS_UNITS=[ntuple(j->i==j ? sign : 0,3) for i in 1:3 for sign in (-1,1)]
identity_perm()=UInt16.(1:264)
function canonical_integer(s)
    @assert occursin(r"^(0|[1-9][0-9]*|-[1-9][0-9]*)$",s) "Noncanonical integer"
    parse(Int,s)
end
compose(a,b)=b[a] # GAP right-action convention: apply a, then b.
function invert(p)
    result=similar(p)
    for i in eachindex(p);result[p[i]]=i;end
    result
end
function signed_perm(regs,ref)
    ref==0 && return identity_perm()
    value=regs[abs(ref)]
    ref<0 ? invert(value) : value
end

function read_physical(path)
    raw=read(path,String)
    @assert isvalid(raw) && endswith(raw,"\n") && !occursin('\r',raw)
    lines=split(raw,'\n';keepempty=true)[1:end-1]
    @assert first(lines)=="sticker\tpiece\thome\tnormal\tup\ttext\tink"
    homes=all_homes();source=Any[]
    vec(s)=tuple(canonical_integer.(split(s,','))...)
    for (i,line) in enumerate(lines[2:end])
        f=split(line,'\t';keepempty=true);@assert length(f)==7
        id=canonical_integer(f[1]);piece=canonical_integer(f[2]);p=vec(f[3]);n=vec(f[4]);up=vec(f[5])
        @assert id==i && 1<=piece<=218 && homes[piece]==p
        @assert n in normal_faces(p) && up in AXIS_UNITS
        @assert sum(n.*up)==0
        g=String(f[6]);ink=String(f[7]);@assert isempty(g)==(ink=="blank")
        push!(source,(piece=piece,home=p,normal=n,up=up,text=g,ink=ink))
    end
    expected=[(p,n) for p in homes for n in normal_faces(p)]
    @assert [(s.home,s.normal) for s in source]==expected && length(source)==294
    source
end

function decode_physical(source,perm,action)
    @assert sort(perm)==UInt16.(1:264)
    rotations=Dict{V3,Rotation}()
    for home in all_homes()
        points=findall(p->p[1]==home,action.points)
        start=action.points[first(points)];finish=action.points[perm[first(points)]]
        r=only(filter(r->pose_rotate(start,r)==finish,ROTATIONS))
        @assert all(pose_rotate(action.points[i],r)==action.points[perm[i]] for i in points) "Nonrigid physical piece"
        rotations[home]=r
    end
    @assert length(unique(rotate(home,r) for (home,r) in rotations))==218
    state=[(id=id,piece=s.piece,pos=rotate(s.home,rotations[s.home]),
        normal=rotate(s.normal,rotations[s.home]),up=rotate(s.up,rotations[s.home]),text=s.text,ink=s.ink)
        for (id,s) in enumerate(source)]
    for s in state
        @assert s.normal in normal_faces(s.pos) && sum(s.normal.*s.up)==0
    end
    @assert length(unique((s.pos,s.normal) for s in state))==294
    state
end

function validate_front(state,target)
    front=filter(s->s.normal==FRONT_NORMAL,state)
    @assert length(front)==49
    for r in 1:7,c in 1:7
        pos=(c-4,4-r,3)
        s=only(filter(s->s.pos==pos,front))
        angle=only(findall(==(s.up),IMAGE_UPS))-1
        g,ink=target.board[r,c]
        @assert image_normal(s.text,angle,s.ink)==image_normal(g,0,ink) "Front image mismatch at $(r),$(c)"
    end
end

function state_digest(state)
    io=IOBuffer()
    for s in state
        println(io,join([s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink],'\t'))
    end
    bytes2hex(sha256(take!(io)))
end

function replay_dag(path;require_full=true)
    raw=read(path,String)
    @assert isvalid(raw) && endswith(raw,"\n") && !occursin('\r',raw)
    lines=split(raw,'\n';keepempty=true)[1:end-1]
    @assert first(lines)=="cubistry.calendar7.legal-dag.v1\t264\t21"
    action=pose_action();registers=PointPerm[];targets=Dict{Int,Int}()
    for line in lines[2:end]
        f=split(line,'\t';keepempty=true)
        if f[1]=="generator"
            @assert length(f)==3
            id=canonical_integer(f[2]);gen=canonical_integer(f[3])
            @assert id==length(registers)+1 && id==gen && 1<=gen<=21 && isempty(targets)
            push!(registers,UInt16.(action.generators[gen]))
        elseif f[1]=="product"
            @assert length(f)==4
            id,a,b=canonical_integer.(f[2:4])
            @assert length(registers)>=21 && id==length(registers)+1 && abs(a)<id && abs(b)<id && isempty(targets)
            push!(registers,compose(signed_perm(registers,a),signed_perm(registers,b)))
        elseif f[1]=="result"
            @assert length(f)==3
            id,ref=canonical_integer.(f[2:3])
            @assert length(registers)>=21 && 1<=id<=91 && !haskey(targets,id) && abs(ref)<=length(registers)
            targets[id]=ref
        else
            error("Unknown legal DAG record")
        end
    end
    @assert !isempty(targets)
    require_full && @assert sort!(collect(keys(targets)))==collect(1:91)
    (;action,registers,targets)
end

function nonblank_lower_bound(goals)
    required=Dict{Tuple{Int,Int},Dict{Tuple{String,Int,String},Int}}()
    for target in goals
        simultaneous=Dict{Tuple{Int,Int},Dict{Tuple{String,Int,String},Int}}()
        for r in 1:7,c in 1:7
            g,ink=target.board[r,c];isempty(g) && continue
            k=orbit(r,c);a=artwork(g,ink,r,c)
            counts=get!(simultaneous,k,Dict{Tuple{String,Int,String},Int}())
            counts[a]=get(counts,a,0)+1
        end
        for (k,counts) in simultaneous
            minima=get!(required,k,Dict{Tuple{String,Int,String},Int}())
            for (a,n) in counts;minima[a]=max(get(minima,a,0),n);end
        end
    end
    sum(sum(values(counts)) for counts in values(required))
end

function strict_lines(path)
    raw=read(path,String)
    @assert isvalid(raw) && endswith(raw,"\n") && !occursin('\r',raw)
    split(raw,'\n';keepempty=true)[1:end-1]
end

function validate_metadata(source,goals,action,dir)
    expected="target\tyear\tmonth\n"*join(["$id\t$(t.year)\t$(t.month)\n" for (id,t) in enumerate(goals)])
    @assert read(joinpath(dir,"targets.tsv"),String)==expected "Target coverage metadata mismatch"
    geometry=joinpath(@__DIR__,"..","en-physical-review")
    poses="point\torbit\tbody\tnormal\tup\n"*join([join([i,cld(i,24),join(p,','),join(n,','),join(u,',')],'\t')*"\n"
        for (i,(p,n,u)) in enumerate(action.points)])
    @assert read(joinpath(geometry,"pose-points.tsv"),String)==poses
    moves="generator\taxis\tlayer\tquarter_turn\n"*join([join([i,axis,layer==99 ? "all" : string(layer),1],'\t')*"\n"
        for (i,(axis,layer)) in enumerate(action.moves)])
    @assert read(joinpath(geometry,"moves.tsv"),String)==moves
    lines=strict_lines(joinpath(dir,"front-matches.tsv"))
    @assert first(lines)=="target\tyear\tmonth\trow\tcolumn\tsource-piece\ttarget-point\tsource-point"
    @assert length(lines)==1+91*49
    homes=all_homes();byhome=Dict(h=>filter(s->s.home==h,source) for h in homes)
    used=Set{Int}()
    for (index,line) in enumerate(lines[2:end])
        fields=split(line,'\t';keepempty=true);@assert length(fields)==8
        id,year,month,row,col,piece,tp,sp=canonical_integer.(fields)
        expected_id=div(index-1,49)+1;cell=mod(index-1,49)
        @assert id==expected_id && row==div(cell,7)+1 && col==mod(cell,7)+1
        target=goals[id];@assert year==target.year && month==target.month
        col==1 && row==1 && empty!(used)
        @assert 1<=piece<=218 && !(piece in used);push!(used,piece)
        @assert 1<=tp<=264 && 1<=sp<=264
        target_pose=action.points[tp];source_pose=action.points[sp]
        @assert source_pose[1]==homes[piece] && target_pose[1]==(col-4,4-row,3)
        @assert tp==findfirst(p->p[1]==target_pose[1],action.points)
        rotation=only(filter(r->pose_rotate(source_pose,r)==target_pose,ROTATIONS))
        @assert rotation in piece_options(byhome[homes[piece]],homes[piece],target_pose[1],target.board[row,col])
    end
end

function check_data(dir;print_path=joinpath(dir,"physical-print.tsv"))
    source=read_physical(print_path);goals=physical_targets("EN");action=pose_action()
    @assert length(goals)==91
    lower=nonblank_lower_bound(goals);actual=count(s->!isempty(s.text),source)
    @assert actual==lower==240 "Actual print must attain the independently computed nonblank bound"
    validate_metadata(source,goals,action,dir)
    (;source,goals,action)
end

function main_replay(path;require_full=true,print_path=joinpath(@__DIR__,"evidence","physical-print.tsv"))
    data=check_data(dirname(print_path);print_path);source=data.source;goals=data.goals
    proof=replay_dag(path;require_full)
    hashes=String[];perms=PointPerm[]
    checked_ids=sort!(collect(keys(proof.targets)))
    for id in checked_ids
        goal=goals[id]
        p=signed_perm(proof.registers,proof.targets[id]);state=decode_physical(source,p,proof.action)
        validate_front(state,goal);push!(hashes,state_digest(state));push!(perms,p)
    end
    # A->B->C->A returns the EXACT physical state of A, including hidden pieces.
    if length(perms)>=3
        a,b,c=perms[1:3]
        ab=compose(invert(a),b);bc=compose(invert(b),c);ca=compose(invert(c),a)
        @assert compose(compose(compose(a,ab),bc),ca)==a
    end
    dir=joinpath(@__DIR__,"evidence")
    variant=abspath(print_path)!=abspath(joinpath(dir,"physical-print.tsv"))
    suffix=bytes2hex(sha256(read(print_path)))[1:12]*"-"*bytes2hex(sha256(read(path)))[1:12]
    receipt=variant || !require_full ? "julia-variant-$suffix-state-hashes.tsv" : "julia-state-hashes.tsv"
    open(joinpath(dir,receipt),"w") do io
        println(io,"target\tstate-sha256")
        for (i,h) in zip(checked_ids,hashes);println(io,"$i\t$h");end
    end
    println("PASS native Julia: one immutable294-sticker printing;",length(perms)," legal complete physical states; exact glyphs,ink,normals,up and source identities preserved.")
    println("PASS: actual240nonblank surfaces attain the native per-art multiplicity lower bound240.")
    length(perms)>=3 && println("PASS exact chained transition A→B→C→A.")
    println("Full domaincoverage and independent Flix confirmation remain required gates.")
end

function selftest_replay()
    a=pose_action();id=identity_perm()
    source=read_physical(joinpath(@__DIR__,"evidence","physical-print.tsv"))
    original=state_digest(decode_physical(source,id,a))
    for g in a.generators
        p=UInt16.(g)
        @assert compose(p,invert(p))==id
        @assert compose(compose(p,p),compose(p,p))==id
        @assert state_digest(decode_physical(source,compose(p,invert(p)),a))==original
        decode_physical(source,p,a)
    end
    println("PASS:21 legal generators, inverse/four-turn identities, full294-sticker rigid-state lift.")
end

if abspath(PROGRAM_FILE)==(@__FILE__)
    if ARGS==["--self-test"];selftest_replay()
    elseif length(ARGS)==2 && ARGS[1]=="--data";check_data(ARGS[2]);println("PASS native data, coverage, orientation and minimum printing checks.")
    elseif length(ARGS)==2 && ARGS[1]=="--partial";main_replay(ARGS[2];require_full=false)
    elseif length(ARGS)==3 && ARGS[1]=="--printing";main_replay(ARGS[3];print_path=ARGS[2])
    else;@assert length(ARGS)==1;main_replay(only(ARGS));end
end
