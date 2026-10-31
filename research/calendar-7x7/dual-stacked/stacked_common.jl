# Stacked dual-label semantics for the English 7x7 month calendar (research only).
# One printed surface carries two dates stacked ("23/30"); both are visible at once.
# Reuses the unchanged native English geometry, printing reader and legal-DAG replay.
include(joinpath(@__DIR__,"..","english","replay_legal.jl"))

const PR99_PRINT_SHA="b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931"
# A, B: six-week months folded with stacked cells. W: PR #99 wrap layout unchanged,
# stacked surfaces only as context-read substitutes (the PR #128 pairs).
const VARIANT_PAIRS=Dict("A"=>[(1,8),(24,31)],"B"=>[(23,30),(24,31)],"W"=>[(1,8),(24,31)])
const MODES=("strict","context")
red_column(c)=c==1 || c==7

stacked_text(a,b)="$(a)/$(b)"
function parse_stacked(text)
    m=match(r"^([1-9][0-9]?)/([1-9][0-9]?)$",text)
    isnothing(m) && return nothing
    (parse(Int,m[1]),parse(Int,m[2]))
end

# Old (PR #99) front board of one month: sixth-week dates wrap into row 3 with a mark.
function wrapped_board(y,m)
    a=Matrix{Tuple{String,String}}(undef,7,7)
    for c in 1:7
        start=m<=9 ? 5 : 1
        a[1,c]=start<=c<=start+2 ? (string(MONTHS["EN"][m][c-start+1]),"month") : ("","blank")
        a[2,c]=(DAYS["EN"][c],red_column(c) ? "red" : "weekday")
        for r in 3:7;a[r,c]=("","blank");end
    end
    off=offset(y,m,"EN");n=daysinmonth(Date(y,m,1))
    for d in 1:n
        week,c=divrem(off+d-1,7);c+=1
        r=week==5 ? 3 : week+3
        @assert a[r,c]==("","blank") "wrap collision"
        a[r,c]=(week==5 ? "$(d)↶" : string(d),red_column(c) ? "red" : "dark")
    end
    a
end

# New front board: a six-week month is folded into five date rows with one or two
# stacked cells. Variant B folds the bottom (d-7/d in row 7). Variant A folds the
# top (1/8) for Saturday-start months and the bottom (24/31) otherwise.
function stacked_board(y,m,variant)
    @assert haskey(VARIANT_PAIRS,variant) "variant must be A or B"
    a=wrapped_board(y,m)
    variant=="W" && return a
    for r in 3:7,c in 1:7;a[r,c]=("","blank");end
    off=offset(y,m,"EN");n=daysinmonth(Date(y,m,1))
    weeks=div(off+n-1,7)+1
    top=weeks==6 && variant=="A" && off==6
    for d in 1:n
        week,c=divrem(off+d-1,7);c+=1;ink=red_column(c) ? "red" : "dark"
        if weeks<=5
            r=week+3;text=string(d)
        elseif top
            week==0 && continue                       # day 1 is printed with 8 below
            r=week+2;text=d==8 ? stacked_text(1,8) : string(d)
        else
            week==5 && continue                       # sixth week is printed under d-7
            r=week+3;text=week==4 && d+7<=n ? stacked_text(d,d+7) : string(d)
        end
        @assert a[r,c]==("","blank") "fold collision"
        a[r,c]=(text,ink)
    end
    for r in 3:7,c in 1:7
        p=parse_stacked(a[r,c][1])
        isnothing(p) || @assert p in VARIANT_PAIRS[variant] "fold produced an undeclared pair $(a[r,c][1])"
    end
    a
end

# 888 months -> the 91 PR #99 target ids (first occurrence order) and the new boards.
function stacked_goals(variant)
    old=physical_targets("EN");@assert length(old)==91
    index=Dict(join(string.(t.board),"|")=>i for (i,t) in enumerate(old))
    boards=Vector{Any}(nothing,91);months=0;per=zeros(Int,91)
    for y in 2026:2099,m in 1:12
        months+=1
        id=index[join(string.(wrapped_board(y,m)),"|")]
        per[id]+=1
        @assert wrapped_board(old[id].year,old[id].month)==old[id].board
        b=stacked_board(y,m,variant)
        isnothing(boards[id]) ? (boards[id]=b) : @assert boards[id]==b "one old target maps to two new boards"
    end
    @assert months==888 && all(!isnothing,boards)
    @assert length(unique(join.(string.(b) for b in boards)))==91 "new boards must be distinct"
    [(year=old[i].year,month=old[i].month,board=boards[i],months=per[i]) for i in 1:91]
end

# Read the candidate print; only these artwork changes against PR #99 are allowed:
# an overflow (↶) surface or a plain date of a declared pair may become blank, and a
# plain date a or b may become the
# stacked "a/b" of a declared pair with the same ink. Identities and frames are fixed.
function read_stacked_print(path,variant)
    old_path=joinpath(@__DIR__,"..","english","evidence","physical-print.tsv")
    @assert bytes2hex(sha256(read(old_path)))==PR99_PRINT_SHA "unchanged PR99 printing provenance"
    old=read_physical(old_path);source=read_physical(path)
    blanked=0;stacked=0
    for id in 1:294
        s=source[id];b=old[id]
        @assert (s.piece,s.home,s.normal,s.up)==(b.piece,b.home,b.normal,b.up) "surface identity or frame changed at $id"
        (s.text,s.ink)==(b.text,b.ink) && continue
        if isempty(s.text)
            paired=any(b.text in (string(p[1]),string(p[2])) for p in VARIANT_PAIRS[variant])
            @assert endswith(b.text,"↶") || paired "only overflow or paired-date surfaces may become blank (surface $id)"
            blanked+=1
        else
            p=parse_stacked(s.text)
            @assert !isnothing(p) && p in VARIANT_PAIRS[variant] "undeclared artwork change at surface $id"
            @assert b.text in (string(p[1]),string(p[2])) && s.ink==b.ink "stacked surface $id must replace one of its own dates in the same ink"
            stacked+=1
        end
    end
    (;source,blanked,stacked,printed=count(s->!isempty(s.text),source))
end

# Match rule. Plain and blank cells use the unchanged PR #99 optics. A stacked surface
# has no rotational symmetry: it must be upright and in the cell's ink. It matches its
# own stacked cell; in context mode it may also stand for either of its two dates.
function stacked_match(s,angle,want,mode)
    p=parse_stacked(s.text)
    if !isnothing(p)
        (angle==0 && s.ink==want[2]) || return false
        want[1]==s.text && return true
        return mode=="context" && want[1] in (string(p[1]),string(p[2]))
    end
    image_normal(s.text,angle,s.ink)==image_normal(want[1],0,want[2])
end

# Cells where an upright stacked surface stands for a single date (context use).
function context_uses(state,board)
    n=0
    for r in 1:7,c in 1:7
        s=only(filter(s->s.pos==(c-4,4-r,3) && s.normal==FRONT_NORMAL,state))
        !isnothing(parse_stacked(s.text)) && s.text!=board[r,c][1] && (n+=1)
    end
    n
end
function front_failure(state,board,mode)
    for r in 1:7,c in 1:7
        s=only(filter(s->s.pos==(c-4,4-r,3) && s.normal==FRONT_NORMAL,state))
        angle=findfirst(==(s.up),IMAGE_UPS)-1
        stacked_match(s,angle,board[r,c],mode) && continue
        p=parse_stacked(s.text)
        why=isnothing(p) ? "plain-mismatch" : (angle!=0 && stacked_match(s,0,board[r,c],mode)) ? "stacked-not-upright" : "stacked-mismatch"
        return "$r,$c\t$(s.id)\t$angle\t$why"
    end
    "-\t-\t-\t-"
end

function check_stacked(print_path,dag_path,variant,mode)
    @assert haskey(VARIANT_PAIRS,variant) && mode in MODES "VARIANT must be A|B|W, MODE strict|context"
    goals=stacked_goals(variant);candidate=read_stacked_print(print_path,variant)
    folded=count(g->any(!isnothing(parse_stacked(g.board[r,c][1])) for r in 3:7,c in 1:7),goals)
    println("stacked-profile\t",variant,'\t',mode,"\t888\t91\t",folded)
    for (id,g) in enumerate(goals),r in 1:7,c in 1:7
        isnothing(parse_stacked(g.board[r,c][1])) || println("stacked-fold\t",id,'\t',g.year,'\t',g.month,'\t',g.months,'\t',r,',',c,'\t',g.board[r,c][1],'\t',g.board[r,c][2])
    end
    println("stacked-print\t",candidate.printed,'\t',294-candidate.printed,'\t',candidate.blanked,'\t',candidate.stacked)
    println("stacked-lower-bound-strict\t",variant,'\t',nonblank_lower_bound(goals))
    proof=replay_dag(dag_path);failed=Int[];shown=Set{Int}()
    for id in 1:91
        p=signed_perm(proof.registers,proof.targets[id]);state=decode_physical(candidate.source,p,proof.action)
        for s in state;s.normal==FRONT_NORMAL && s.pos[3]==3 && push!(shown,s.id);end
        cell=front_failure(state,goals[id].board,mode)
        cell=="-\t-\t-\t-" || push!(failed,id)
        println("stacked-target\t",id,'\t',goals[id].year,'\t',goals[id].month,'\t',cell=="-\t-\t-\t-" ? "PASS" : "FAIL",'\t',cell,'\t',goals[id].months,'\t',context_uses(state,goals[id].board),'\t',state_digest(state))
    end
    hidden=count(id->!isempty(candidate.source[id].text) && !(id in shown),1:294)
    println("stacked-printed-never-on-front\t",hidden)
    verdict=isempty(failed) ? "ACCEPT" : "REJECT"
    println("stacked-summary\t",verdict,'\t',variant,'\t',mode,'\t',91-length(failed),'\t',length(failed),'\t',candidate.printed)
    @assert isempty(failed) "$(length(failed)) of 91 legal DAG states fail the stacked front: targets $(join(failed,','))"
end

# Inventory obstruction for ANY print of the 294-surface model (necessary condition).
# In one display, the cells of an orbit that need artwork of one group must be shown
# by distinct surfaces printed in that group, and blank cells by distinct blank
# surfaces. strict: a group is one artwork class (the PR #99 bound). context: the
# plain dates a, b and the stacked a/b of a declared pair, in one ink, form one
# group (a stacked surface may serve any of them), which only weakens the bound.
function inventory_group(g,ink,r,c,variant,mode)
    if mode=="context"
        t=replace(g,'O'=>'0','I'=>'1')
        for (a,b) in VARIANT_PAIRS[variant]
            t in (string(a),string(b),stacked_text(a,b)) && return ("pair",string(a),string(b),ink)
        end
    end
    a=artwork(g,ink,r,c);("art",a[1],string(a[2]),a[3])
end
function stacked_inventory(variant,mode)
    @assert haskey(VARIANT_PAIRS,variant) && mode in MODES "VARIANT must be A|B|W, MODE strict|context"
    goals=stacked_goals(variant);total=0;negative=0
    for k in sort!(unique(orbit(r,c) for r in 1:7,c in 1:7))
        peak=Dict{NTuple{4,String},Int}();blanks=0
        for t in goals
            counts=Dict{NTuple{4,String},Int}();b=0
            for r in 1:7,c in 1:7
                orbit(r,c)==k || continue
                g,ink=t.board[r,c]
                if isempty(g);b+=1;continue;end
                key=inventory_group(g,ink,r,c,variant,mode);counts[key]=get(counts,key,0)+1
            end
            for (key,n) in counts;peak[key]=max(get(peak,key,0),n);end
            blanks=max(blanks,b)
        end
        need=sum(values(peak);init=0);slack=capacity(k)-need-blanks
        slack<0 && (negative+=1);total+=need
        println("stacked-orbit\t",variant,'\t',mode,'\t',k[1],'\t',k[2],'\t',need,'\t',blanks,'\t',capacity(k),'\t',slack)
    end
    core=sort!(unique(goals[id].board[4,4][1] for id in 1:91))
    println("stacked-core-cell\t",variant,'\t',join(core,','))
    println("stacked-inventory\t",variant,'\t',mode,'\t',total,'\t',negative==0 ? "NOT_OBSTRUCTED" : "OBSTRUCTED",'\t',negative)
end
