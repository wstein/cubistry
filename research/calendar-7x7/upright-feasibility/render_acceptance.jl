#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Proof of the 91 front variants and the acceptance pages for the strict-upright print.
#  1. For every one of the 91 displays, a cubie-level matching (Kuhn) assigns one cubie
#     and one rotation to each of the 49 front cells such that the shown sticker is the
#     cell's text, upright. Only the digit 0 (any turn) and a single 6 for a 9 turned half
#     a turn may be turned; letters O and I are not 0 and 1; stacked "a/b" stickers are
#     upright and equal. The result is checked a second time by `shown_ok` below.
#  2. Writes evidence/front-matching.tsv and acceptance/index.html (inline SVG, Noto Sans
#     glyph outlines drawn as paths, diagonal split labels).
# This is a NECESSARY condition of a legal state (front matching only). It does not prove
# that the rest of the cube can be completed by legal moves; that is deferred.
#   render_acceptance.jl PRINT_NEW PRINT_OLD NotoSans-SemiBold.ttf OUT_DIR
include(joinpath(@__DIR__,"..","pure-split-states","pure_common.jl"))
include(joinpath(@__DIR__,"strict_rule.jl"))
apply_strict_rule!(Main)
include(joinpath(@__DIR__,"noto_font.jl"))
using Dates, Printf

const T=192.0
const PAPER="#fffdf6";const BLANK_PAPER="#d9d3c2";const PLASTIC="#23272e"
const INK=Dict("dark"=>"#1f2933","month"=>"#8a4a12","red"=>"#b3261e","weekday"=>"#2c4a6b")

# ---- front matching with the actual stickers -------------------------------------
function front_assignment(source,board)
    byhome=Dict(h=>filter(s->s.home==h,source) for h in all_homes())
    cells=Dict{Tuple{Int,Int},Any}()
    for key in unique(bodykey(h) for h in all_homes())
        hs=sort!([h for h in all_homes() if bodykey(h)==key])
        cs=[(r,c) for r in 1:7 for c in 1:7 if bodykey((c-4,4-r,3))==key]
        opts=[[piece_options(byhome[h],h,(c-4,4-r,3),board[r,c]) for h in hs] for (r,c) in cs]
        owner=Dict{Int,Int}()
        function aug(i,seen)
            for j in eachindex(hs)
                (j in seen || isempty(opts[i][j])) && continue
                push!(seen,j)
                if !haskey(owner,j) || aug(owner[j],seen);owner[j]=i;return true;end
            end
            false
        end
        for i in eachindex(cs);aug(i,Set{Int}()) || error("no matching for cell $(cs[i])");end
        for (j,i) in owner
            r,c=cs[i];rot=first(opts[i][j])
            face=only(filter(s->rotate(s.normal,rot)==FRONT_NORMAL,byhome[hs[j]]))
            angle=findfirst(==(rotate(face.up,rot)),IMAGE_UPS)-1
            cells[(r,c)]=(face=face,angle=angle,piece=face.piece,sid=findfirst(==(face),source))
        end
    end
    cells
end
# Independent re-check of one cell under the owner rule (does not use image_normal).
function shown_ok(text,angle,want,ink,wantink,stacked)
    ink==wantink || return false
    stacked && return angle==0 && text==want
    text=="0" && want=="0" && return true                 # digit 0: circular
    angle==0 && return text==want
    angle==2 && return (text=="6" && want=="9") || (text=="9" && want=="6")
    false
end

# ---- artwork as SVG ---------------------------------------------------------------
function glyph_path(F,ch)
    cs=F.outline(F.gid(ch));io=IOBuffer()
    for c in cs
        for (i,p) in enumerate(c);@printf(io,"%s%.0f %.0f",i==1 ? "M" : "L",p[1],p[2]);end
        print(io,"Z")
    end
    String(take!(io))
end
adv(F,ch)=F.adv(F.gid(ch))/F.upem
# Plain label, the rule of src/apps/calendar7/sticker-art.ts (T=192, text area 0.86 T)
function plain_layout(F,text)
    base=length(text)==1 ? 140.0 : length(text)==2 ? 110.0 : 80.0
    w=sum(adv(F,ch) for ch in text)
    size=floor(min(base,base*T*0.86/(w*base)))
    (size=size,x=T/2-w*size/2,y=T/2+size*(0.04+0.388))
end
# Diagonal split label: first number top left, slash middle, second bottom right.
function diag_layout(F,a,b;clear=0.04)
    U=F.upem
    function geom(s)
        function num(str);pts=Vector{Vector{Tuple{Float64,Float64}}}();x=0.0
            for ch in str;for c in F.outline(F.gid(ch));push!(pts,[((x*U+p[1])*s/U,p[2]*s/U) for p in c]);end;x+=adv(F,ch);end;pts;end
        bx(cs)=(minimum(p[1] for c in cs for p in c),maximum(p[1] for c in cs for p in c),
                minimum(p[2] for c in cs for p in c),maximum(p[2] for c in cs for p in c))
        n1=num(a);n2=num(b);sl=[[(p[1]*s/U,p[2]*s/U) for p in c] for c in F.outline(F.gid('/'))]
        b1=bx(n1);b2=bx(n2);bs=bx(sl)
        o1=(-b1[1],1-(b1[4]-b1[3])-b1[3]);o2=(1-(b2[2]-b2[1])-b2[1],-b2[3])
        om=(0.5-(bs[1]+bs[2])/2,0.5-(bs[3]+bs[4])/2)
        sh(cs,o)=[[(p[1]+o[1],p[2]+o[2]) for p in c] for c in cs]
        function mind(A,B);m=Inf
            for c1 in A,p in c1,c2 in B,q in c2;d=hypot(p[1]-q[1],p[2]-q[2]);d<m&&(m=d);end;m;end
        fits=(b1[2]-b1[1])<=1&&(b2[2]-b2[1])<=1&&(b1[4]-b1[3])+(b2[4]-b2[3])<=1
        (o1=o1,o2=o2,om=om,clear=min(mind(sh(n1,o1),sh(sl,om)),mind(sh(n2,o2),sh(sl,om))),fits=fits)
    end
    lo=0.05;hi=0.9
    for _ in 1:24;m=(lo+hi)/2;g=geom(m);(g.fits&&g.clear>=clear) ? (lo=m) : (hi=m);end
    g=geom(lo);(s=lo,g=g)
end
function symbol_for(F,text,ink)
    io=IOBuffer()
    if occursin('/',text)
        a,b=split(text,'/');d=diag_layout(F,String(a),String(b));L=0.86*T;s=d.s*L;X0=(T-L)/2;Y0=(T-L)/2
        function put(str,o)
            x=0.0
            for ch in str
                px=X0+L*(o[1])+x;py=Y0+L*(1-o[2])
                @printf(io,"<path transform=\"translate(%.2f %.2f) scale(%.5f %.5f)\" d=\"%s\"/>",px,py,s/F.upem,-s/F.upem,glyph_path(F,ch))
                x+=adv(F,ch)*s
            end
        end
        put(a,d.g.o1);put(b,d.g.o2);put("/",d.g.om)
    else
        l=plain_layout(F,text);x=l.x
        for ch in text
            @printf(io,"<path transform=\"translate(%.2f %.2f) scale(%.5f %.5f)\" d=\"%s\"/>",x,l.y,l.size/F.upem,-l.size/F.upem,glyph_path(F,ch))
            x+=adv(F,ch)*l.size
        end
    end
    String(take!(io))
end
sym_id(text)="g"*join(string(Int(c),base=16) for c in text)
function sticker_svg(text,ink,px)
    isempty(text) && return "<svg class=\"st\" width=\"$px\" height=\"$px\" viewBox=\"0 0 192 192\"><rect width=\"192\" height=\"192\" rx=\"14\" fill=\"$BLANK_PAPER\"/></svg>"
    "<svg class=\"st\" width=\"$px\" height=\"$px\" viewBox=\"0 0 192 192\"><rect width=\"192\" height=\"192\" rx=\"14\" fill=\"$PAPER\"/><use href=\"#$(sym_id(text))\" fill=\"$(INK[ink])\"/></svg>"
end
esc(s)=replace(s,'&'=>"&amp;",'<'=>"&lt;",'>'=>"&gt;")

function main(new_path,old_path,font_path,out)
    F=parse_font(font_path);mkpath(joinpath(out,"acceptance"))
    new=read_physical(new_path);old=read_physical(old_path);goals=stacked_goals(PURE_VARIANT)
    # 1. front variants
    io=IOBuffer();println(io,"display\tyear\tmonth\trow\tcolumn\twant_text\twant_ink\tsticker\tpiece\tsticker_text\tsticker_ink\tangle\tturned_reading")
    nturned=Dict("6->9"=>0,"9->6"=>0,"0"=>0);cells_total=0;ids_seen=0
    assigned=Vector{Any}(undef,91)
    for (id,g) in enumerate(goals)
        a=front_assignment(new,g.board);assigned[id]=a
        pieces=Set{Int}()
        for r in 1:7,c in 1:7
            x=a[(r,c)];want,wink=g.board[r,c]
            if isempty(want)
                isempty(x.face.text) || error("blank cell shows ink: display $id $r,$c")
            else
                stacked=occursin('/',want)
                shown_ok(x.face.text,x.angle,want,x.face.ink,wink,stacked) || error("display $id cell $r,$c not upright/equal")
            end
            x.piece in pieces && error("cubie used twice: display $id")
            push!(pieces,x.piece);cells_total+=1
            reading=""
            if !isempty(want) && x.angle!=0
                reading=x.face.text=="0" ? "0" : x.face.text=="6" ? "6->9" : "9->6"
                nturned[reading]+=1
            end
            println(io,join([id,g.year,g.month,r,c,want,wink,x.sid,x.piece,x.face.text,x.face.ink,x.angle,reading],'\t'))
        end
    end
    write(joinpath(out,"front-matching.tsv"),take!(io))
    println("front-variants\tdisplays=91\tcells=",cells_total,"\tall_matched_and_checked=true\tturned_reads=",
        join(["$k:$v" for (k,v) in sort!(collect(nturned))],","))
    # 2. acceptance page
    texts=sort!(unique(vcat([s.text for s in new],[s.text for s in old],[g.board[r,c][1] for g in goals for r in 1:7 for c in 1:7])))
    filter!(!isempty,texts)
    syms=join(["<symbol id=\"$(sym_id(t))\" viewBox=\"0 0 192 192\">$(symbol_for(F,t,"dark"))</symbol>" for t in texts],"\n")
    cnt(src)=(d=Dict{Tuple{String,String},Int}();for s in src;isempty(s.text)||(d[(s.text,s.ink)]=get(d,(s.text,s.ink),0)+1);end;d)
    cn=cnt(new);co=cnt(old)
    changed=[i for i in 1:294 if (new[i].text,new[i].ink,new[i].up)!=(old[i].text,old[i].ink,old[i].up)]
    h=IOBuffer()
    println(h,"<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">")
    println(h,"<title>Strict upright print: acceptance</title>")
    println(h,"<!-- Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry. SPDX-License-Identifier: CC-BY-SA-4.0. Glyph outlines: Noto Sans SemiBold (SIL OFL 1.1). -->")
    println(h,"""<style>
:root{--bg:#f6f4ee;--fg:#1f2933;--mut:#5b6670;--card:#fff;--line:#d7d2c4;--acc:#8a4a12;--new:#fff3c4}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#171a1f;--fg:#e6e8ea;--mut:#9aa5b1;--card:#20242b;--line:#3a414b;--acc:#e0a56a;--new:#4a3d12}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 "Noto Sans",system-ui,sans-serif}
main{max-width:1180px;margin:0 auto;padding:16px}h1{font-size:1.5rem}h2{font-size:1.2rem;margin-top:2rem;border-bottom:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(236px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px}.card h3{font-size:.85rem;margin:0 0 6px;color:var(--mut);font-weight:600}
.cube{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;background:$PLASTIC;padding:2px;border-radius:4px}.cube svg{width:100%;height:auto;display:block}
.st{display:block}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:middle}
.new{background:var(--new)}.row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end}.big{border:1px solid var(--line);border-radius:6px}
.mut{color:var(--mut)}.pill{display:inline-block;padding:0 6px;border-radius:9px;background:var(--new);font-size:.8rem}
</style></head><body><main>""")
    println(h,"<svg width=\"0\" height=\"0\" style=\"position:absolute\"><defs>$syms</defs></svg>")
    println(h,"<h1>Strict upright print: acceptance pages</h1>")
    println(h,"<p>Research candidate, not certified. Rule: only the digit 0 and a single 6 or 9 may read turned; every other glyph, the letters O and I included, and every split label must be upright. Noto Sans SemiBold outlines. Split labels are laid out diagonally. The 91 front views below are produced by a cubie-level matching on the proposed print (no move words yet; the rest of the cube is not shown and not proven).</p>")
    println(h,"<p><b>Print:</b> 294 stickers on 218 bodies (unchanged), $(count(s->!isempty(s.text),new)) printed, $(count(s->isempty(s.text),new)) blank, $(length(changed)) surfaces changed against the pure-split A print.</p>")
    println(h,"<h2>Split labels (diagonal)</h2><div class=\"row\">")
    for t in filter(t->occursin('/',t),texts),ink in sort!(unique(s.ink for s in new if s.text==t))
        println(h,"<div>$(sticker_svg(t,ink,160))<div class=\"mut\">$(esc(t)) $ink</div></div>")
    end
    d=diag_layout(F,"23","30");println(h,"</div><p class=\"mut\">Font size $(round(d.s;digits=3)) of the text square (0.86 of the sticker), ink clearance of the slash at least 0.04 of the square; digit height $(round(d.s*0.735;digits=3)) of the text square.</p>")
    println(h,"<h2>Sticker classes (text, ink, count)</h2><p class=\"mut\">Highlighted: more copies than in the pure-split A print. Retired: fewer or none.</p><table><tr><th>Sticker</th><th>Text</th><th>Ink</th><th>Count now</th><th>Count before</th></tr>")
    keys_=sort!(collect(union(keys(cn),keys(co))),by=k->(k[2],something(tryparse(Int,k[1]),99),k[1]))
    for k in keys_
        n=get(cn,k,0);o=get(co,k,0)
        println(h,"<tr class=\"$(n>o ? "new" : "")\"><td>$(sticker_svg(k[1],k[2],40))</td><td>$(esc(k[1]))</td><td>$(k[2])</td><td>$n</td><td>$o</td></tr>")
    end
    println(h,"</table><h2>Changed surfaces ($(length(changed)))</h2><table><tr><th>Surface</th><th>Body</th><th>Before</th><th>After</th><th>Note</th></tr>")
    for i in changed
        o=old[i];n=new[i];note=(o.text==n.text&&o.ink==n.ink) ? "same artwork, turned on the surface" : isempty(n.text) ? "now blank" : isempty(o.text) ? "was blank" : "re-printed"
        println(h,"<tr><td>$i</td><td>$(n.piece)</td><td>$(sticker_svg(o.text,o.ink,40)) $(esc(o.text))</td><td>$(sticker_svg(n.text,n.ink,40)) $(esc(n.text))</td><td>$note</td></tr>")
    end
    println(h,"</table><h2>The 91 front views</h2><p class=\"mut\">Each cell shows the sticker the matching puts there (upright). A cell marked with a turned 6 shows a 9, as the owner rule allows.</p>")
    wk=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
    order=sort(collect(1:91);by=id->(goals[id].month,firstweekday(goals[id])))
    for id in order
        g=goals[id];a=assigned[id]
        ty=g.month==2 && any(g.board[r,c][1]=="29" for r in 3:7,c in 1:7) ? "Feb (leap)" : Dates.monthname(g.month)
        println(h,"<div class=\"card\" style=\"display:inline-block;width:236px;margin:4px;vertical-align:top\"><h3>#$id $ty, 1st on $(wk[firstweekday(g)+1]) ($(g.year)-$(lpad(g.month,2,'0')), $(g.months) months)</h3><div class=\"cube\">")
        for r in 1:7,c in 1:7
            x=a[(r,c)];want,wink=g.board[r,c]
            if isempty(want);println(h,sticker_svg("","blank",32))
            else
                s=sticker_svg(want,wink,32)
                x.angle!=0 && (s=replace(s,"<use"=>"<g><title>sticker $(x.sid) turned, reads $(esc(want))</title></g><use"))
                println(h,s)
            end
        end
        println(h,"</div></div>")
    end
    println(h,"<p class=\"mut\">Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry. SPDX-License-Identifier: CC-BY-SA-4.0. Glyph outlines from Noto Sans SemiBold (SIL OFL 1.1).</p></main></body></html>")
    write(joinpath(out,"acceptance","index.html"),take!(h))
end
firstweekday(g)=mod(dayofweek(Date(g.year,g.month,1)),7)
main(ARGS...)
