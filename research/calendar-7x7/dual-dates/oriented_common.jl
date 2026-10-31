# Experimental quarter-turn selection profile; not the simultaneous two-week layout.
include(joinpath(@__DIR__,"..","english","replay_legal.jl"))
const DUAL_DAYS=string.(1:31)
function read_dual_art(path)
    rows=strict_lines(path);@assert rows[1]=="cubistry.calendar7.dual-oriented.v1" && length(rows)==3
    table=Dict{Int,Vector{Tuple{String,Int}}}()
    for line in rows[2:end]
        f=split(line,'\t');@assert length(f)==6 && f[1]=="pair"
        id=canonical_integer(f[2]);@assert 1<=id<=294 && !haskey(table,id)
        a,b=String(f[3]),String(f[5]);qa,qb=canonical_integer(f[4]),canonical_integer(f[6])
        @assert a in DUAL_DAYS && b in DUAL_DAYS && a!=b && qa in 0:3 && qb in 0:3
        table[id]=[(a,qa),(b,qb)]
    end
    @assert table==Dict(255=>[("8",0),("1",1)],281=>[("31",0),("24",1)])
    table
end
function dual_active(id,angle,ink,table)
    matches=String[]
    for wanted in DUAL_DAYS
        if any(image_normal(text,mod(angle+turn,4),ink)==image_normal(wanted,0,ink) for (text,turn) in table[id])
            push!(matches,wanted)
        end
    end
    @assert length(matches)<=1 "Two date labels cannot be active simultaneously in this selection profile"
    matches
end
function dual_match(s,angle,wanted,table)
    if haskey(table,s.id)
        active=dual_active(s.id,angle,s.ink,table)
        return length(active)==1 && active[1]==wanted[1] && s.ink==wanted[2]
    end
    image_normal(s.text,angle,s.ink)==image_normal(wanted[1],0,wanted[2])
end
function read_candidate_print(path,table)
    source=read_physical(path)
    old=read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
    for id in 1:294
        s=source[id];before=old[id]
        @assert (s.piece,s.home,s.normal,s.up)==(before.piece,before.home,before.normal,before.up)
        expected=id in (16,40) ? ("","blank") : id==255 ? ("DUAL_1_8","dark") : id==281 ? ("DUAL_24_31","red") : (before.text,before.ink)
        @assert (s.text,s.ink)==expected
        haskey(table,id) && foreach(q->dual_active(id,q,s.ink,table),0:3)
    end
    @assert count(s->!isempty(s.text),source)==238
    source
end
function dual_front(state,target,table)
    for r in 1:7,c in 1:7
        s=only(filter(s->s.pos==(c-4,4-r,3) && s.normal==FRONT_NORMAL,state))
        angle=findfirst(==(s.up),IMAGE_UPS)-1
        @assert dual_match(s,angle,target.board[r,c],table) "Dual-profile front mismatch at $r,$c"
    end
end
function dual_row2(state)
    row=[only(filter(s->s.pos==(c-4,2,3) && s.normal==FRONT_NORMAL,state)) for c in 1:7]
    io=IOBuffer()
    for s in row;println(io,join([s.id,s.piece,join(s.pos,','),join(s.normal,','),join(s.up,','),s.text,s.ink],'\t'));end
    bytes2hex(sha256(take!(io)))
end
function check_oriented(print_path,art_path,dag_path)
    table=read_dual_art(art_path);source=read_candidate_print(print_path,table)
    proof=replay_dag(dag_path);goals=physical_targets("EN");row=nothing
    for c in 1:7
        wanted=goals[1].board[2,c]
        candidates=[(s.id,q) for (id,raw) in enumerate(source) for q in 0:3
            for s in [(id=id,text=raw.text,ink=raw.ink)] if dual_match(s,q,wanted,table)]
        @assert length(candidates)==1 && last(only(candidates))==0
        println("dual-weekday\t",c,'\t',first(only(candidates)))
    end
    for id in 1:91
        p=signed_perm(proof.registers,proof.targets[id]);state=decode_physical(source,p,proof.action)
        dual_front(state,goals[id],table);signature=dual_row2(state)
        isnothing(row) ? (row=signature) : (@assert row==signature)
        println("dual-state\t",id,'\t',state_digest(state),'\t',signature)
    end
    println("dual-summary\tSAT_SCOPED_ORIENTATION_SELECTION\t238\t56\t91\t888\t",row)
end
