# SPDX-License-Identifier: AGPL-3.0-or-later
include(joinpath(@__DIR__,"..","row1-corner-coupling","check.jl"))
function window_art(text,ink,row,col)
    orbit(row,col)==(0,0) && return minimum(coupled_optic(text,q,ink) for q in 0:3)
    coupled_art(text,ink,row,col)
end
function window_surface_class(s)
    k=surfacekey(s.home,s.normal)
    candidates=Tuple{String,Int,String}[]
    for r in ROTATIONS
        rotate(s.normal,r)==FRONT_NORMAL || continue
        pos=rotate(s.home,r);row,col=4-pos[2],pos[1]+4
        angle=only(findall(==(rotate(s.up,r)),IMAGE_UPS))-1
        push!(candidates,coupled_optic(s.text,angle+coupled_angle(row,col),s.ink))
    end
    @assert length(candidates)==4
    if k!=(0,0)
        @assert length(unique(candidates))==1 "one surface artwork class"
    end
    k,minimum(candidates)
end
function window_read_print(path)
    lines=readlines(path)
    raw=read(path,String)
    @assert isvalid(raw) && !occursin('\r',raw) && endswith(raw,"\n") "canonical print TSV"
    @assert length(lines)==295 && lines[1]=="sticker\tpiece\thome\tnormal\tup\ttext\tink" "294-surface print header"
    homes=all_homes();expected=[(i,h,n) for (i,h) in enumerate(homes) for n in normal_faces(h)]
    axes=Set(IMAGE_UPS ∪ [(0,0,1),(0,0,-1)])
    parsevec(s)=begin x=split(s,',');@assert length(x)==3;tuple((canonical_integer(String(v)) for v in x)...);end
    source=Any[]
    for (id,line) in enumerate(lines[2:end])
        fs=String.(split(line,'\t';keepempty=true));@assert length(fs)==7
        sid,pid=canonical_integer(fs[1]),canonical_integer(fs[2])
        h,n,u=parsevec(fs[3]),parsevec(fs[4]),parsevec(fs[5])
        @assert sid==id && (pid,h,n)==expected[id] "fixed physical surface geometry and identity"
        @assert u in axes && sum(u.*n)==0 "axis-aligned tangent print up"
        text,ink=fs[6],fs[7]
        @assert isempty(text) ? ink in ("band","blank") : ink in ("month","weekday","red","dark") "print text/ink profile"
        push!(source,(id=sid,piece=pid,home=h,normal=n,up=u,text=text,ink=ink))
    end
    @assert length(source)==294 && length(unique(s.home for s in source))==218
    source
end
function window_piece_options(stickers,home,pos,wanted)
    wanted_image=coupled_optic(wanted[1],0,wanted[2])
    good=Rotation[]
    for r in ROTATIONS
        rotate(home,r)==pos || continue
        face=only(filter(s->rotate(s.normal,r)==FRONT_NORMAL,stickers))
        angle=only(findall(==(rotate(face.up,r)),IMAGE_UPS))-1
        coupled_optic(face.text,angle,face.ink)==wanted_image && push!(good,r)
    end
    good
end
function window_match(source,board)
    homes=all_homes();byhome=Dict(h=>filter(s->s.home==h,source) for h in homes)
    answer=Dict{Tuple{Int,Int},Tuple{Int,Rotation}}()
    for key in sort!(unique(bodykey(h) for h in homes))
        hs=[h for h in homes if bodykey(h)==key]
        cells=[(r,c) for r in 1:7 for c in 1:7 if bodykey((c-4,4-r,3))==key]
        options=[[window_piece_options(byhome[h],h,(c-4,4-r,3),board[r,c]) for h in hs] for (r,c) in cells]
        owner=zeros(Int,length(hs))
        function augment(slot,seen)
            for j in eachindex(hs)
                (seen[j] || isempty(options[slot][j])) && continue
                seen[j]=true
                if owner[j]==0 || augment(owner[j],seen)
                    owner[j]=slot;return true
                end
            end
            false
        end
        @assert all(augment(i,falses(length(hs))) for i in eachindex(cells)) "no whole-body front matching in $key"
        for j in eachindex(hs)
            owner[j]==0 && continue
            i=owner[j];answer[cells[i]]=(findfirst(==(hs[j]),homes),first(options[i][j]))
        end
    end
    @assert length(answer)==49 && length(unique(first(v) for v in values(answer)))==49
    answer
end
function window_match_check(layout_path,print_path,matches_path)
    raw_layout=read(layout_path,String);labels=coupled_labels(raw_layout)
    goals=coupled_goals(labels,"names-band","window")
    source=window_read_print(print_path)
    rows=readlines(matches_path)
    raw_matches=read(matches_path,String)
    @assert isvalid(raw_matches) && !occursin('\r',raw_matches) && endswith(raw_matches,"\n") "canonical match TSV"
    @assert length(rows)==1+length(goals)*49 && rows[1]=="target\tyear\tmonth\trow\tcolumn\tpiece\tx-image\ty-image\tz-image" "21 complete front matches"
    println("input\t",bytes2hex(sha256(codeunits(raw_layout))),'\t',bytes2hex(sha256(read(print_path))),'\t',bytes2hex(sha256(read(matches_path))))
    ml=month_list_line([(g.year,g.month) for g in goals]);isnothing(ml) || println(ml)
    println("printing\t294\t218\t",length(goals),"\t",49*length(goals))
    homes=all_homes();byhome=Dict(h=>filter(s->s.home==h,source) for h in homes)
    parsevec(s)=begin vs=split(s,',');@assert length(vs)==3;tuple((canonical_integer(String(v)) for v in vs)...);end
    for (id,g) in enumerate(goals)
        seen=Set{Int}();snapshot=IOBuffer()
        for r in 1:7,c in 1:7
            fs=String.(split(rows[1+(id-1)*49+(r-1)*7+c],'\t';keepempty=true));@assert length(fs)==9
            tid,y,m,rr,cc,pid=canonical_integer.(fs[1:6])
            @assert (tid,y,m,rr,cc)==(id,g.year,g.month,r,c) "match ordering and target date"
            @assert 1<=pid<=218 && !(pid in seen) "one distinct physical body per front cell"
            push!(seen,pid)
            basis=tuple((parsevec(s) for s in fs[7:9])...)
            rotations=filter(q->(rotate((1,0,0),q),rotate((0,1,0),q),rotate((0,0,1),q))==basis,ROTATIONS)
            @assert length(rotations)==1 "one proper rigid body rotation"
            rot=only(rotations)
            home=homes[pid];pos=(c-4,4-r,3)
            @assert rotate(home,rot)==pos "rigid body reaches its declared front position"
            front=only(filter(s->rotate(s.normal,rot)==FRONT_NORMAL,byhome[home]))
            up=rotate(front.up,rot);a=only(findall(==(up),IMAGE_UPS))-1
            @assert coupled_optic(front.text,a,front.ink)==coupled_optic(g.board[r,c][1],0,g.board[r,c][2]) "exact upright front artwork including band line"
            println(snapshot,pid,';',join(pos,','),";0,0,1;",join(up,','),';',front.text,';',front.ink)
        end
        @assert length(seen)==49
        println("target\t",id,'\t',g.year,'\t',g.month,"\t49\t",bytes2hex(sha256(take!(snapshot))))
    end
    println("verdict\tSAT\tfixed-print-rigid-front-matching\t",length(goals),"\t",49*length(goals),"\tlegal-states=UNKNOWN\tchain=NOT_RUN")
end
