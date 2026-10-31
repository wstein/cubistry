#!/usr/bin/env julia
# UNTRUSTED candidate generator; only check_stacked.jl and flix/ decide acceptance.
# Keeps every PR #99 legal state: blanks the overflow (↶) surfaces and reprints, as
# the stacked pair, whichever surface the old state puts on each folded cell.
include(joinpath(@__DIR__,"stacked_common.jl"))
function generate(dag_path,variant,out)
    goals=stacked_goals(variant);proof=replay_dag(dag_path)
    old_path=joinpath(@__DIR__,"..","english","evidence","physical-print.tsv")
    rows=strict_lines(old_path);source=read_physical(old_path);art=Dict{Int,String}()
    for (id,s) in enumerate(source);endswith(s.text,"↶") && (art[id]="");end
    for id in 1:91
        state=decode_physical(source,signed_perm(proof.registers,proof.targets[id]),proof.action)
        for r in 3:7,c in 1:7
            text,ink=goals[id].board[r,c];p=parse_stacked(text);isnothing(p) && continue
            s=only(filter(s->s.pos==(c-4,4-r,3) && s.normal==FRONT_NORMAL,state))
            if s.text in (string(p[1]),string(p[2])) && s.ink==ink
                @assert get(art,s.id,text)==text;art[s.id]=text
            else
                println(stderr,"no reprint for target $id cell $r,$c (old surface shows '$(s.text)')")
            end
        end
    end
    open(out,"w") do io
        println(io,rows[1])
        for (id,line) in enumerate(rows[2:end])
            f=split(line,'\t';keepempty=true)
            haskey(art,id) && (f[6]=art[id];f[7]=isempty(art[id]) ? "blank" : f[7])
            println(io,join(f,'\t'))
        end
    end
    println(join(sort!(["$(id)=$(isempty(t) ? "blank" : t)" for (id,t) in art]),' '))
end
generate(ARGS...)
