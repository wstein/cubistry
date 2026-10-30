include(joinpath(@__DIR__,"algebra.jl"))
@eval Minimax begin
struct Action
    key::NTuple{24,UInt8}
    inverse::NTuple{24,Int}
    word::Vector{Int}
    cost::Int
end
struct Node
    occupants::NTuple{24,UInt16}
    cost::Int
    path::Vector{Int}
end

function extra_seeds!(raw,action,a;seed_budget=46656)
    legal=[i for i in 1:21 if i%7!=0]
    setups=[([x,y,-x],P.macro_word_perm([x,y,-x],a.generators))
        for x in legal for y in legal if div(x-1,7)!=div(y-1,7)]
    attempts=0;improved=zeros(Int,10)
    for (wa,pa) in setups,(wb,pb) in setups
        attempts>=seed_budget && break
        attempts+=1
        p=P.compose(P.compose(P.compose(pa,pb),P.invert(pa)),P.invert(pb))
        affected=[k for k in 1:11 if any(p[i]!=i for i in (24k-23):24k)]
        length(affected)==1 || continue
        k=only(affected);k in (4,7,10) || continue
        count(i->p[i]!=i,(24k-23):24k)==(k==4 ? 6 : 3) || continue
        key=Tuple(UInt8.(p[(24k-23):24k].-(24k-24)))
        word=simplify(vcat(wa,wb,P.macro_inverse(wa),P.macro_inverse(wb)),a)
        old=get(raw[k],key,nothing)
        if isnothing(old) || (htm(word),length(word),word)<(htm(old),length(old),old)
            raw[k][key]=word;improved[k]+=1
        end
    end
    println("seeds12\t",attempts,'\t',join(improved,','))
end

function cached_catalogues(action,a;relax_budget=0,seed_budget=0)
    @assert relax_budget>=0 && seed_budget>=0
    raw=P.chain_catalogues(action);alphabet=P.chain_alphabet(action)
    seed_budget>0 && extra_seeds!(raw,action,a;seed_budget)
    for k in 1:10
        for key in sort!(collect(keys(raw[k])))
            raw[k][key]=simplify(raw[k][key],a)
        end
        if relax_budget>0 && k in (4,7,10)
            localgens=[Tuple(Int.(g[(24k-23):24k].-(24k-24))) for g in alphabet.generators]
            localbacks=[invperm(collect(g)) for g in localgens]
            queue=sort!(collect(keys(raw[k]));by=key->(htm(raw[k][key]),key))
            cursor=1;attempts=0;improved=0
            while cursor<=length(queue) && attempts<relax_budget
                key=queue[cursor];cursor+=1
                for g in 1:24,s in (1,-1)
                    g in (7,14,21) && continue
                    attempts>=relax_budget && break
                    attempts+=1
                    setup=s==1 ? localgens[g] : localbacks[g]
                    back=s==1 ? localbacks[g] : localgens[g]
                    next=ntuple(i->UInt8(back[key[setup[i]]]),24)
                    sw=s==1 ? alphabet.words[g] : P.macro_inverse(alphabet.words[g])
                    word=simplify(vcat(sw,raw[k][key],P.macro_inverse(sw)),a)
                    old=raw[k][next]
                    if (htm(word),length(P.macro_moves(word)),word)<(htm(old),length(P.macro_moves(old)),old)
                        raw[k][next]=word;push!(queue,next);improved+=1
                    end
                end
            end
            println("relax\t",k,'\t',attempts,'\t',improved)
        end
    end
    [[Action(key,Tuple(invperm(Int.(collect(key)))),w,htm(w))
        for (key,w) in sort!(collect(raw[k]);by=x->(htm(x[2]),length(P.macro_moves(x[2])),x[2],x[1]))] for k in 1:10]
end

function greedy(occupants,constraints,actions)
    score(v)=count(v[i] in allowed for (i,allowed) in constraints)
    path=Int[];cost=0;current=occupants
    for _ in 1:24
        before=score(current);before==length(constraints) && return Node(current,cost,path)
        best=0;gain=before;price=typemax(Int)
        for (j,c) in enumerate(actions)
            after=count(current[c.inverse[i]] in allowed for (i,allowed) in constraints)
            if after>gain || (after==gain && after>before && c.cost<price)
                best=j;gain=after;price=c.cost
            end
        end
        best==0 && return nothing
        c=actions[best];current=ntuple(i->current[c.inverse[i]],24)
        push!(path,best);cost+=c.cost
    end
    nothing
end
path_word(path,actions)=reduce(vcat,(actions[i].word for i in path);init=Int[])

function orbit_search(occupants,constraints,actions,a; width=8,maxdepth=6,budget=150000,weight=2)
    @assert width>=0 && maxdepth>=0 && budget>=0 && weight>0
    score(v)=count(v[i] in allowed for (i,allowed) in constraints)
    total=length(constraints);incumbent=greedy(occupants,constraints,actions)
    best=isnothing(incumbent) ? nothing : simplify(path_word(incumbent.path,actions),a)
    bound=isnothing(best) ? typemax(Int) : htm(best)
    width==0 && return best
    score(occupants)==total && return Int[]
    beam=[Node(occupants,0,Int[])];seen=Dict(occupants=>0);attempts=0
    cheapest=minimum(c.cost for c in actions)
    for _ in 1:maxdepth
        pool=Dict{NTuple{24,UInt16},Node}()
        for n in beam,(j,c) in enumerate(actions)
            attempts>=budget && break
            attempts+=1;cost=n.cost+c.cost;cost>bound && continue
            next=ntuple(i->n.occupants[c.inverse[i]],24)
            get(seen,next,typemax(Int))<=cost && continue
            seen[next]=cost;path=vcat(n.path,j)
            matched=score(next)
            if matched==total
                word=simplify(path_word(path,actions),a);price=htm(word)
                better=isnothing(best) || price<bound ||
                    (price==bound && (length(word)<length(best) ||
                    (length(word)==length(best) && (weight==1 ? word<best : word>best))))
                if better
                    best=word;bound=price
                end
            elseif cost<bound
                pool[next]=Node(next,cost,path)
            end
        end
        isempty(pool) && break
        rank(n)=(n.cost+weight*cld(total-score(n.occupants),3)*cheapest,n.cost,-score(n.occupants),n.occupants)
        nodes=sort!(collect(values(pool));by=rank)
        beam=nodes[1:min(width,length(nodes))]
        attempts>=budget && break
    end
    best
end

function solve_month(source,start,target,action,cache,a; width=8,budget=150000,weight=2)
    prefix=P.chain_core_prefix(source,start,target,action)
    state=prefix.state;word=copy(prefix.word)
    for k in 1:10
        constraints=P.macro_front_constraints(source,target,action,k)
        occupants=Tuple(P.invert(state)[(24k-23):24k])
        selected=orbit_search(occupants,constraints,cache[k],a;width,budget,weight)
        isnothing(selected) && error("UNKNOWN SEARCH_BUDGET_EXHAUSTED orbit=$k width=$width budget=$budget")
        state=P.compose(state,P.macro_word_perm(selected,a.generators));append!(word,selected)
    end
    P.validate_front(P.decode_physical(source,state,action),target)
    (;word=improve_word(word,a),state)
end

function generate(dag,out;relax_budget=0,seed_budget=0,width=8,budget=150000)
    mkpath(out);proof=P.replay_dag(dag);action=proof.action;a=Algebra(action)
    source=P.read_physical(joinpath(@__DIR__,"..","english","evidence","physical-print.tsv"))
    cache=cached_catalogues(action,a;relax_budget,seed_budget)
    open(joinpath(out,"attempts.tsv"),"w") do log
        println(log,"chain\tedge\tstatus\thtm\tseconds\treason")
        for i in (3,2,1,4)
            input=V.read_chain(joinpath(@__DIR__,"..","continuous","evidence","chain-$i.moves.tsv"))
            state=P.signed_perm(proof.registers,proof.targets[input.root]);words=Vector{Int}[];hashes=Tuple{String,String}[]
            for (j,e) in enumerate(input.edges)
                started=time_ns();before=P.state_digest(P.decode_physical(source,state,action))
                try
                    result=solve_month(source,state,P.macro_calendar_target(e.year,e.month),action,cache,a;width,budget)
                    @assert P.compose(state,P.macro_word_perm(result.word,a.generators))==result.state
                    state=result.state;after=P.state_digest(P.decode_physical(source,state,action))
                    push!(words,result.word);push!(hashes,(before,after))
                    println(log,join((i,j,"CANDIDATE",htm(result.word),(time_ns()-started)/1e9,"native verification required"),'\t'));flush(log)
                catch ex
                    println(log,join((i,j,"UNKNOWN","",(time_ns()-started)/1e9,replace(sprint(showerror,ex),'\n'=>' ')),'\t'));flush(log)
                    break
                end
            end
            length(words)==length(input.edges) && export_chain(joinpath(out,"chain-$i.moves.tsv"),input,words,action;hashes)
        end
    end
    println("cache_retained_bytes\t",Base.summarysize(cache))
end
end
if abspath(PROGRAM_FILE)==@__FILE__
    @assert length(ARGS) in (5,6) "DAG OUT RELAX_BUDGET BEAM_WIDTH EXPANSION_BUDGET [SEED_BUDGET]"
    Minimax.generate(ARGS[1],ARGS[2];relax_budget=parse(Int,ARGS[3]),width=parse(Int,ARGS[4]),budget=parse(Int,ARGS[5]),seed_budget=length(ARGS)==6 ? parse(Int,ARGS[6]) : 0)
end
