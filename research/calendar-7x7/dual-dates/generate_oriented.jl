#!/usr/bin/env julia
# Untrusted candidate generator. New raw artifacts require independent native replay.
include(joinpath(@__DIR__,"oriented_common.jl"))
invword(w)=-reverse(w)
function word_perm(word,generators)
    p=identity_perm()
    for g in word;p=compose(p,g<0 ? invert(generators[-g]) : generators[g]);end
    p
end
function dual_catalogue(action,k)
    generators=[UInt16.(g) for g in action.generators]
    middle=vcat(14,[-i for (i,(axis,layer)) in enumerate(action.moves) if axis==2 && layer!=99])
    seed=k==1 ? [1,8,-1,13,1,-8,-1,-13] : vcat([1,10,-1],middle,[1,-10,-1],invword(middle))
    p=word_perm(seed,generators)
    @assert all(p[i]==i for i in 1:264 if !(24k-23<=i<=24k))
    key=Tuple(Int.(p[(24k-23):24k].-(24k-24)))
    catalog=Dict(key=>seed);queue=[key];cursor=1
    gs=[Int.(g[(24k-23):24k].-(24k-24)) for g in generators];backs=invperm.(gs)
    legal=[i for i in 1:21 if i%7!=0]
    while cursor<=length(queue)
        key=queue[cursor];cursor+=1
        for g in legal,s in (-1,1)
            setup=s==1 ? gs[g] : backs[g];back=s==1 ? backs[g] : gs[g]
            next=ntuple(i->back[key[setup[i]]],24);haskey(catalog,next)&&continue
            catalog[next]=vcat(s*g,catalog[key],-s*g);push!(queue,next)
        end
    end
    println(stderr,"catalog\t",k,'\t',length(catalog))
    sort!(collect(catalog);by=x->(length(x[2]),x[2],x[1]))
end
function dual_constraints(source,target,action,k,table)
    result=Tuple{Int,Set{UInt16}}[]
    for r in 1:7,c in 1:7
        pos=(c-4,4-r,3);bodykey(pos)==action.keys[k]||continue
        dest=findfirst(p->p[1]==pos,action.points);allowed=Set{UInt16}()
        for (id,s) in enumerate(source),rotation in ROTATIONS
            rotate(s.home,rotation)==pos && rotate(s.normal,rotation)==FRONT_NORMAL || continue
            q=findfirst(==(rotate(s.up,rotation)),IMAGE_UPS)-1
            dual_match((id=id,text=s.text,ink=s.ink),q,target.board[r,c],table)||continue
            origin=tuple((inverse_rotate(v,rotation) for v in action.points[dest])...)
            push!(allowed,UInt16(findfirst(==(origin),action.points)))
        end
        @assert !isempty(allowed)
        push!(result,(dest-24k+24,allowed))
    end
    result
end
function generate_oriented(old_dag,out)
    mkpath(out)
    old_print=joinpath(@__DIR__,"..","english","evidence","physical-print.tsv")
    lines=readlines(old_print)
    for id in (16,40,255,281)
        f=split(lines[id+1],'\t');text,ink=id in (16,40) ? ("","blank") : id==255 ? ("DUAL_1_8","dark") : ("DUAL_24_31","red")
        f[6]=text;f[7]=ink;lines[id+1]=join(f,'\t')
    end
    print_path=joinpath(out,"physical-print.tsv");write(print_path,join(lines,'\n')*"\n")
    art_path=joinpath(out,"dual-art.tsv");write(art_path,"cubistry.calendar7.dual-oriented.v1\npair\t255\t8\t0\t1\t1\npair\t281\t31\t0\t24\t1\n")
    table=read_dual_art(art_path);source=read_candidate_print(print_path,table)
    proof=replay_dag(old_dag);action=proof.action;generators=[UInt16.(g) for g in action.generators];goals=physical_targets("EN")
    catalogs=Dict(k=>dual_catalogue(action,k) for k in (1,10))
    roots=Int[];appended=String[];node=length(proof.registers)
    open(joinpath(out,"repairs.tsv"),"w") do repairs
        println(repairs,"target\tyear\tmonth\torbit\tquarter-turn-records\tword")
        for id in 1:91
            reference=proof.targets[id];state=signed_perm(proof.registers,reference)
            for k in (1,10)
                constraints=dual_constraints(source,goals[id],action,k,table)
                occupants=invert(state)[(24k-23):24k]
                all(occupants[i] in allowed for(i,allowed)in constraints)&&continue
                choice=findfirst(pair->begin
                    key,_=pair;back=invperm(collect(key));all(occupants[back[i]] in allowed for(i,allowed)in constraints)
                end,catalogs[k])
                @assert !isnothing(choice) "No isolated repair found for target $id orbit $k"
                _,word=catalogs[k][choice]
                state=compose(state,word_perm(word,generators))
                for g in word
                    node+=1;push!(appended,"product\t$node\t$reference\t$g");reference=node
                end
                println(repairs,join([id,goals[id].year,goals[id].month,k,length(word),join(word,',')],'\t'))
            end
            dual_front(decode_physical(source,state,action),goals[id],table)
            push!(roots,reference)
        end
    end
    old_lines=readlines(old_dag);prefix=filter(line->!startswith(line,"result\t"),old_lines)
    results=["result\t$id\t$(roots[id])" for id in 1:91]
    write(joinpath(out,"candidate-dag.tsv"),join(vcat(prefix,appended,results),'\n')*"\n")
    println("CANDIDATE\t238nonblank/56blank\t91states\t",length(appended),"appended legal primitive products")
    println("UNKNOWN until both native checkers independently accept the declared orientation-selection profile.")
end
if abspath(PROGRAM_FILE)==@__FILE__;@assert length(ARGS)==2;generate_oriented(ARGS...);end
