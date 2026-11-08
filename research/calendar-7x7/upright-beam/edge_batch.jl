# SPDX-License-Identifier: AGPL-3.0-or-later
# UNTRUSTED candidate generator (verify_edges.jl / verify_smoke.jl decide).
#   edge_batch.jl MODE OUT_TSV [key=value ...] -- args
# MODE pairs: edges FROM_ID TO_ID given as "pairs=1:2,3:4,..." ; each starts from the ROOT word state of FROM.
# MODE smoke: "n=4": 4 consecutive months from 2028-01 on one retained state (chain_smoke.jl format).
const HERE=@__DIR__
const CAL=joinpath(HERE,"..")
include(joinpath(CAL,"pure-split-states","pure_common.jl"))
include(joinpath(CAL,"global-search","search.jl"))
include(joinpath(CAL,"upright-feasibility","strict_rule.jl"))
const G=GlobalSearch
apply_strict_rule!(Main,G.M.P,G.M.V)
include(joinpath(HERE,"beam2.jl"))
DAG=get(ENV,"DAG","/tmp/dag-all.tsv")
PRINT=joinpath(CAL,"upright-feasibility","evidence","print-strict-upright.tsv")
MOVES=joinpath(CAL,"upright-moves","evidence","moves-strict.tsv")
function main(args)
    mode=args[1];out=args[2];opts=Dict(split(x,'=')[1]=>split(x,'=')[2] for x in args[3:end])
    corew=parse(Float64,get(opts,"corew","100"));fd=parse(Int,get(opts,"finish_depth","3"))
    rest=[k*"="*v for (k,v) in opts if !(k in ("pairs","n","corew","finish_depth","nsnap","tight","catalog","finish"))]
    params0,spec,_=G.parse_options(rest)
    w=copy(params0.orbit_weights);w[11]=corew
    params=G.Params(lambda=params0.lambda,width=params0.width,fanout=params0.fanout,maxdepth=params0.maxdepth,patience=params0.patience,strict=params0.strict,prune_incumbent=params0.prune_incumbent,orbit_weights=w)
    goals=stacked_goals(PURE_VARIANT)
    proof=G.P.replay_dag(DAG);action=proof.action;a=G.M.Algebra(action)
    gens=[UInt16.(g) for g in action.generators]
    source=G.P.read_physical(PRINT)
    rootword=Dict(parse(Int,split(l,'\t')[1])=>parse.(Int,split(split(l,'\t')[6],',')) for l in readlines(MOVES)[2:end])
    t0=time()
    lib=G.build_library(action,a,spec)
    catalogs=G.P.chain_catalogues(action)
    get(opts,"catalog","1")=="1" && (lib=merge_macros(lib,catalog_macros(catalogs,action,gens)))
    index=build_index(lib);cats=orbit_cats(catalogs,gens)
    println(stderr,"setup ",round(time()-t0;digits=1)," s, library ",length(lib))
    nsnap=parse(Int,get(opts,"nsnap","6"))
    function target_of(id);(year=goals[id].year,month=goals[id].month,board=goals[id].board);end
    open(out,"w") do log
        if mode=="pairs"
            println(log,"from_id\tto_id\tfrom_year\tfrom_month\tto_year\tto_month\thtm\tseconds\tmethod\tword")
            for pr in split(opts["pairs"],',')
                from,to=parse.(Int,split(pr,':'))
                start=G.P.macro_word_perm(rootword[from],gens);t=time()
                r=solve_edge(source,start,target_of(to),action,a,gens,lib,index,cats,params;finish_depth=fd,nsnap,tight=get(opts,"tight","1")=="1",finish=get(opts,"finish","1")=="1")
                dt=round(time()-t;digits=1)
                println(log,join([from,to,goals[from].year,goals[from].month,goals[to].year,goals[to].month,r.htm,dt,isnothing(r.word) ? "UNKNOWN" : r.method,isnothing(r.word) ? "-" : join(r.word,',')],'\t'));flush(log)
                println(stderr,"edge ",from,"->",to," htm=",r.htm," ",r.method," ",dt," s status=",r.status," stall=",r.stall)
            end
        else
            n=parse(Int,opts["n"])
            idof=Dict(join(string.(g.board),"|")=>i for (i,g) in enumerate(goals))
            months=[(2028,1)];for i in 1:n;y,m=months[end];push!(months,m==12 ? (y+1,1) : (y,m+1));end
            ids=[idof[join(string.(stacked_board(y,m,PURE_VARIANT)),"|")] for (y,m) in months]
            state=G.P.macro_word_perm(rootword[ids[1]],gens)
            println(log,"from\tto\tfrom_id\tto_id\tmethod\thtm\tseconds\tword")
            for i in 1:n
                y,m=months[i+1];t=time()
                r=solve_edge(source,state,(year=y,month=m,board=goals[ids[i+1]].board),action,a,gens,lib,index,cats,params;finish_depth=fd,nsnap,tight=get(opts,"tight","1")=="1",finish=get(opts,"finish","1")=="1")
                dt=round(time()-t;digits=1)
                isnothing(r.word) && (println(log,join([months[i],months[i+1],ids[i],ids[i+1],"UNKNOWN",-1,dt,"-"],'\t'));break)
                state=r.state
                println(log,join(["$(months[i][1])-$(months[i][2])","$y-$m",ids[i],ids[i+1],r.method,r.htm,dt,join(r.word,',')],'\t'));flush(log)
                println(stderr,"smoke ",months[i],"->",months[i+1]," htm=",r.htm," ",r.method," ",dt," s")
            end
        end
    end
end
main(ARGS)
