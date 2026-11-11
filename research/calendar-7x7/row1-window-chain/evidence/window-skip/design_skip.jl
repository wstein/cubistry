#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# design_skip.jl: UNTRUSTED. Root month = first month of WINDOW_MONTHS (identity pose; optional ROOT=YYYY-MM asserts it; root front surfaces are never frozen). row1-window-print/design.jl with (a) the explicit month list WINDOW_MONTHS (months.jl), (b) optional seeding SEED_PRINT/SEED_FRAC/SEED_SALT, (c) FREEZE_MATCHES=front-matches.tsv of the seed print: every surface that is a front in those matches keeps its class., (d) FREE_KEY/IN_FRAC: freeze all but one body class.
# UNTRUSTED bounded print designer. Native Julia/Flix witness checks decide.
# Uses the repo's coupled front-matching SMT relaxation with explicit band art.
include(joinpath(@__DIR__,"months.jl"))
const WLIB=length(ARGS)>=2 ? ARGS[2] : get(ENV,"Z3LIB","")
const WINDOW_Z3LIB=abspath(WLIB)
function window_z3(smt;timeout_ms=parse(Int,get(ENV,"SMT_TIMEOUT_MS","45000")))
    cfg=ccall((:Z3_mk_config,WINDOW_Z3LIB),Ptr{Cvoid},())
    ctx=ccall((:Z3_mk_context,WINDOW_Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},),cfg)
    ccall((:Z3_del_config,WINDOW_Z3LIB),Cvoid,(Ptr{Cvoid},),cfg)
    solver=ccall((:Z3_mk_solver,WINDOW_Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},),ctx)
    ccall((:Z3_solver_inc_ref,WINDOW_Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid}),ctx,solver)
    params=ccall((:Z3_mk_params,WINDOW_Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},),ctx)
    ccall((:Z3_params_inc_ref,WINDOW_Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid}),ctx,params)
    key=ccall((:Z3_mk_string_symbol,WINDOW_Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},Cstring),ctx,"timeout")
    ccall((:Z3_params_set_uint,WINDOW_Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid},Ptr{Cvoid},Cuint),ctx,params,key,timeout_ms)
    ccall((:Z3_solver_set_params,WINDOW_Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid},Ptr{Cvoid}),ctx,solver,params)
    ccall((:Z3_solver_from_string,WINDOW_Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid},Cstring),ctx,solver,smt)
    @assert ccall((:Z3_get_error_code,WINDOW_Z3LIB),Cuint,(Ptr{Cvoid},),ctx)==0 "untrusted SMT parser error"
    started=time_ns();status=ccall((:Z3_solver_check,WINDOW_Z3LIB),Cint,(Ptr{Cvoid},Ptr{Cvoid}),ctx,solver)
    elapsed=(time_ns()-started)/1e9
    values=Dict{String,Int}();reason=""
    if status==1
        model=ccall((:Z3_solver_get_model,WINDOW_Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},Ptr{Cvoid}),ctx,solver)
        ccall((:Z3_model_inc_ref,WINDOW_Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid}),ctx,model)
        n=ccall((:Z3_model_get_num_consts,WINDOW_Z3LIB),Cuint,(Ptr{Cvoid},Ptr{Cvoid}),ctx,model)
        for i in 0:Int(n)-1
            decl=ccall((:Z3_model_get_const_decl,WINDOW_Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},Ptr{Cvoid},Cuint),ctx,model,i)
            symbol=ccall((:Z3_get_decl_name,WINDOW_Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},Ptr{Cvoid}),ctx,decl)
            name=unsafe_string(ccall((:Z3_get_symbol_string,WINDOW_Z3LIB),Cstring,(Ptr{Cvoid},Ptr{Cvoid}),ctx,symbol))
            startswith(name,"p_") || continue
            ast=ccall((:Z3_model_get_const_interp,WINDOW_Z3LIB),Ptr{Cvoid},(Ptr{Cvoid},Ptr{Cvoid},Ptr{Cvoid}),ctx,model,decl)
            value=Ref{UInt64}(0)
            @assert ccall((:Z3_get_numeral_uint64,WINDOW_Z3LIB),Bool,(Ptr{Cvoid},Ptr{Cvoid},Ref{UInt64}),ctx,ast,value)
            values[name]=Int(value[])
        end
        ccall((:Z3_model_dec_ref,WINDOW_Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid}),ctx,model)
    elseif status==0
        reason=unsafe_string(ccall((:Z3_solver_get_reason_unknown,WINDOW_Z3LIB),Cstring,(Ptr{Cvoid},Ptr{Cvoid}),ctx,solver))
    end
    ccall((:Z3_params_dec_ref,WINDOW_Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid}),ctx,params)
    ccall((:Z3_solver_dec_ref,WINDOW_Z3LIB),Cvoid,(Ptr{Cvoid},Ptr{Cvoid}),ctx,solver)
    ccall((:Z3_del_context,WINDOW_Z3LIB),Cvoid,(Ptr{Cvoid},),ctx)
    (;status,elapsed,values,reason)
end
# FRONTIER EXPERIMENT: optional seed print; hash-selected SEED_FRAC of faces are frozen to the seed artwork class.
const SEED_PATH=get(ENV,"SEED_PRINT","");const SEED_FRAC=parse(Float64,get(ENV,"SEED_FRAC","1.0"));const SEED_SALT=parse(Int,get(ENV,"SEED_SALT","0"))
const SEED=Dict{Tuple{V3,V3},Tuple{String,Int,String}}()
function load_seed()
    isempty(SEED_PATH) && return
    for s in window_read_print(SEED_PATH);SEED[(s.home,s.normal)]=window_surface_class(s)[2];end
end
const VIS=Set{Tuple{V3,V3}}()
function load_visible(path)
    src=window_read_print(SEED_PATH);rows=readlines(path)[2:end];homes=all_homes();byhome=Dict(h=>filter(s->s.home==h,src) for h in homes)
    pv(s)=tuple((parse(Int,v) for v in split(s,','))...)
    for l in rows
        f=split(l,'\t');b=tuple((pv(s) for s in f[7:9])...)
        rot=only(filter(q->(rotate((1,0,0),q),rotate((0,1,0),q),rotate((0,0,1),q))==b,ROTATIONS))
        fr=only(filter(s->rotate(s.normal,rot)==FRONT_NORMAL,byhome[homes[parse(Int,f[6])]]));push!(VIS,(fr.home,fr.normal))
    end
end
# CLASS_FRACS=x,y,z:f;x,y,z:f frozen fraction per body class (classes not listed are fully frozen); overrides FREE_KEY.
const CLASS_FRACS=Dict{String,Float64}(split(t,':')[1]=>parse(Float64,split(t,':')[2]) for t in split(get(ENV,"CLASS_FRACS",""),';';keepempty=false))
const FREE_KEY=get(ENV,"FREE_KEY","");const IN_FRAC=parse(Float64,get(ENV,"IN_FRAC","0.0"))
# FREE_KEY=x,y,z[;x,y,z...]: every body outside these body classes is frozen to the seed; inside it IN_FRAC of the faces (hash) is frozen.
# The root month (first month of WINDOW_MONTHS) is the identity pose: its 49 front surfaces carry the root board and are never frozen to the seed.
root_front(h,n)=h[3]==3 && n==FRONT_NORMAL
function frozen_face(h,n)
    haskey(SEED,(h,n)) || return false
    root_front(h,n) && return false
    if !isempty(CLASS_FRACS);return (hash((h,n,SEED_SALT))%10000)<round(Int,get(CLASS_FRACS,join(bodykey(h),','),1.0)*10000);end
    if !isempty(FREE_KEY);return !(join(bodykey(h),',') in split(FREE_KEY,';')) || (hash((h,n,SEED_SALT))%10000)<round(Int,IN_FRAC*10000);end
    (h,n) in VIS || (hash((h,n,SEED_SALT))%10000)<round(Int,SEED_FRAC*10000)
end
function window_problem(goals,hs)
    face_lists=[sort!(normal_faces(h);by=n->surfacekey(h,n)) for h in hs]
    nfaces=length(first(face_lists));@assert nfaces in (2,3)
    keys=sort!(unique(surfacekey(h,n) for h in hs for n in normal_faces(h)))
    @assert all([surfacekey(h,n) for n in ns]==[surfacekey(first(hs),n) for n in first(face_lists)] for (h,ns) in zip(hs,face_lists))
    cells=[(r,c,findfirst(==(orbit(r,c)),keys)) for r in 1:7 for c in 1:7 if orbit(r,c) in keys]
    categories=[sort!(unique([window_art(t.board[r,c]...,r,c) for t in goals for (r,c,k) in cells if k==i])) for i in eachindex(keys)]
    ids=[Dict(a=>i-1 for (i,a) in enumerate(xs)) for xs in categories]
    projected=unique([[(k,ids[k][window_art(t.board[r,c]...,r,c)]) for (r,c,k) in cells] for t in goals])
    width=maximum(max(1,ceil(Int,log2(length(xs)+1))) for xs in categories)
    bv(n)="(_ bv$n $width)";out=IOBuffer();println(out,"(set-logic QF_BV)")
    for (p,h) in enumerate(hs),f in 1:nfaces
        k=findfirst(==(surfacekey(h,face_lists[p][f])),keys)
        println(out,"(declare-const p_$(p)_$f (_ BitVec $width))")
        println(out,"(assert (bvult p_$(p)_$f ",bv(length(categories[k])),"))")
        if h[3]==3 && face_lists[p][f]==FRONT_NORMAL
            r,c=4-h[2],h[1]+4
            a=window_art(goals[1].board[r,c]...,r,c)
            println(out,"(assert (= p_$(p)_$f ",bv(ids[k][a]),"))")
        elseif frozen_face(h,face_lists[p][f]) && haskey(ids[k],SEED[(h,face_lists[p][f])])
            println(out,"(assert (= p_$(p)_$f ",bv(ids[k][SEED[(h,face_lists[p][f])]]),"))")
        end
    end
    # Piece/face sorting symmetry is deliberately absent: physical front faces
    # above are bound to the May 2026 identity root.
    for (t,slots) in enumerate(projected)
        bypiece=[String[] for _ in hs]
        for (s,(k,label)) in enumerate(slots)
            options=String[]
            for (p,h) in enumerate(hs),f in 1:nfaces
                surfacekey(h,face_lists[p][f])==keys[k] || continue
                x="x_$(t)_$(s)_$(p)_$f"
                println(out,"(declare-const $x Bool)")
                println(out,"(assert (=> $x (= p_$(p)_$f ",bv(label),")))")
                push!(options,x);push!(bypiece[p],x)
            end
            @assert !isempty(options)
            println(out,"(assert (or ",join(options,' '),"))")
            at_most_one(out,options,"aux_slot_$(t)_$s")
        end
        for (p,xs) in enumerate(bypiece);at_most_one(out,xs,"aux_piece_$(t)_$p");end
    end
    (;smt=String(take!(out)),keys,categories,hs,face_lists)
end
function window_place(surface,a,k)
    a==("",0,"blank") && return merge(surface,(text="",ink="blank"))
    cell=first((r,c) for r in 1:7 for c in 1:7 if orbit(r,c)==k && window_art(a[1],a[3],r,c)==a)
    pos=(cell[2]-4,4-cell[1],3)
    rot=first(q for q in ROTATIONS if rotate(surface.home,q)==pos && rotate(surface.normal,q)==FRONT_NORMAL)
    merge(surface,(text=a[1],ink=a[3],up=inverse_rotate(IMAGE_UPS[1],rot)))
end
function design_window(layout_path,out)
    @assert isfile(WINDOW_Z3LIB) "explicit native Z3 library"
    load_seed();haskey(ENV,"FREEZE_MATCHES") && load_visible(ENV["FREEZE_MATCHES"])
    labels=coupled_labels(read(layout_path,String));goals=coupled_goals(labels,"names-band","window")
    # ROOT=YYYY-MM (optional) states the intended root month and must equal the first month of WINDOW_MONTHS.
    haskey(ENV,"ROOT") && @assert parse_months(ENV["ROOT"])==[(goals[1].year,goals[1].month)] "ROOT is the first month of WINDOW_MONTHS"
    homes=all_homes();allkeys=sort!(unique(bodykey(h) for h in homes));mkpath(out)
    assigned=Dict{Tuple{V3,V3},Tuple{String,Int,String}}()
    version=unsafe_string(ccall((:Z3_get_full_version,WINDOW_Z3LIB),Cstring,()))
    failed=Ref(0)
    open(joinpath(out,"solver.tsv"),"w") do log
        println(log,"tool\tZ3\t",version,'\t',bytes2hex(sha256(read(WINDOW_Z3LIB))))
        # survey counter lives outside this block
        for (component,key) in enumerate(allkeys)
            # ONLY=x,y,z (survey): work on one body class only; the others count as not designed
            !isempty(get(ENV,"ONLY","")) && join(key,',')!=ENV["ONLY"] && (failed[]+=1;continue)
            hs=[h for h in homes if bodykey(h)==key]
            if length(normal_faces(first(hs)))==1
                k=surfacekey(first(hs),only(normal_faces(first(hs))))
                per=[[window_art(g.board[r,c]...,r,c) for r in 1:7 for c in 1:7 if orbit(r,c)==k] for g in goals]
                classes=sort!(unique(vcat(per...)));peaks=Dict(a=>maximum(count(==(a),xs) for xs in per) for a in classes)
                @assert sum(values(peaks))<=length(hs) "single-face component inventory"
                for h in hs
                    n=only(normal_faces(h))
                    if h[3]==3 && n==FRONT_NORMAL
                        r,c=4-h[2],h[1]+4;assigned[(h,n)]=window_art(goals[1].board[r,c]...,r,c)
                    end
                end
                for h in hs
                    n=only(normal_faces(h))
                    # RELEASE_SURPLUS=1: a frozen seed face is kept only while its artwork is still needed (peak not yet reached); default keeps all, as before
                    if frozen_face(h,n) && !haskey(assigned,(h,n)) && SEED[(h,n)] in classes && (get(ENV,"RELEASE_SURPLUS","")!="1" || count(g->get(assigned,(g,only(normal_faces(g))),nothing)==SEED[(h,n)],hs)<peaks[SEED[(h,n)]]);assigned[(h,n)]=SEED[(h,n)];end
                end
                free=[(h,only(normal_faces(h))) for h in hs if !haskey(assigned,(h,only(normal_faces(h))))]
                for a in classes
                    need=peaks[a]-count(h->get(assigned,(h,only(normal_faces(h))),nothing)==a,hs)
                    need=max(need,0);@assert need<=length(free) "free faces suffice"
                    for _ in 1:need;assigned[popfirst!(free)]=a;end
                end
                for s in free;assigned[s]=("",0,"blank");end
                println(log,"component\t",component,'\t',join(key,','),"\tDIRECT\t",sum(values(peaks)),'\t',length(hs))
            else
                problem=window_problem(goals,hs)
                write(joinpath(out,"component-$component.smt2"),problem.smt*"(check-sat)\n")
                result=window_z3(problem.smt)
                println(log,"component\t",component,'\t',join(key,','),'\t',result.status==1 ? "UNTRUSTED_SAT" : (result.status==-1 ? "UNSAT" : "UNKNOWN"),'\t',result.elapsed,'\t',result.reason);flush(log)
                if result.status!=1 && get(ENV,"CONTINUE","")=="1";failed[]+=1;continue;end   # survey mode: log every class, then stop without a print
                @assert result.status==1 "bounded untrusted designer did not find a print for $key"
                for (p,h) in enumerate(hs),f in eachindex(problem.face_lists[p])
                    n=problem.face_lists[p][f];k=findfirst(==(surfacekey(h,n)),problem.keys)
                    v=result.values["p_$(p)_$f"]
                    @assert 0<=v<length(problem.categories[k])
                    assigned[(h,n)]=problem.categories[k][v+1]
                end
            end
        end
    end
    failed[]>0 && (println("survey: ",failed[]," component(s) without an untrusted SAT; no print written");return)
    source=Any[]
    for (pid,h) in enumerate(homes),n in normal_faces(h)
        u=first(v for v in IMAGE_UPS ∪ [(0,0,1),(0,0,-1)] if sum(v.*n)==0)
        surface=(id=length(source)+1,piece=pid,home=h,normal=n,up=u,text="",ink="blank")
        a=assigned[(h,n)];s=window_place(surface,a,surfacekey(h,n))
        if h[3]==3 && n==FRONT_NORMAL
            r,c=4-h[2],h[1]+4;text,ink=goals[1].board[r,c]
            s=merge(s,(text=text,ink=ink,up=IMAGE_UPS[1]))
        end
        @assert window_surface_class(s)==(surfacekey(h,n),a) "extracted class matches actual rigid surface"
        push!(source,s)
    end
    @assert length(source)==294 && length(assigned)==294
    print_path=joinpath(out,"printing.tsv");matches_path=joinpath(out,"front-matches.tsv")
    open(print_path,"w") do io
        println(io,"sticker\tpiece\thome\tnormal\tup\ttext\tink")
        for s in source;println(io,join((s.id,s.piece,join(s.home,','),join(s.normal,','),join(s.up,','),s.text,s.ink),'\t'));end
    end
    open(matches_path,"w") do io
        println(io,"target\tyear\tmonth\trow\tcolumn\tpiece\tx-image\ty-image\tz-image")
        for (id,g) in enumerate(goals)
            matches=id==1 ? Dict((r,c)=>(findfirst(==((c-4,4-r,3)),homes),only(q for q in ROTATIONS if rotate((1,0,0),q)==(1,0,0) && rotate((0,1,0),q)==(0,1,0))) for r in 1:7 for c in 1:7) : window_match(source,g.board)
            for r in 1:7,c in 1:7
                pid,rot=matches[(r,c)]
                println(io,join((id,g.year,g.month,r,c,pid,join(rotate((1,0,0),rot),','),join(rotate((0,1,0),rot),','),join(rotate((0,0,1),rot),',')),'\t'))
            end
        end
    end
    # This is a separate raw witness replay, not trust in SMT assignment booleans.
    window_match_check(layout_path,print_path,matches_path)
end
get(ENV,"DESIGN_LIB","")=="1" || design_window(ARGS[1],abspath(ARGS[3]))
