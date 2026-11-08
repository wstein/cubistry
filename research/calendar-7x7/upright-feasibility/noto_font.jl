# SPDX-License-Identifier: AGPL-3.0-or-later
# Minimal TrueType reader (cmap 4, hmtx, glyf simple glyphs) for Noto Sans (OFL-1.1).
function parse_font(path)
    b=read(path)
    u16(o)=Int(b[o+1])<<8|Int(b[o+2]);i16(o)=(v=u16(o);v>=32768 ? v-65536 : v)
    u32(o)=Int(u16(o))<<16|u16(o+2)
    n=u16(4);tab=Dict{String,Tuple{Int,Int}}()
    for i in 0:n-1;o=12+16i;tab[String(b[o+1:o+4])]=(u32(o+8),u32(o+12));end
    head=tab["head"][1];upem=u16(head+18);locfmt=i16(head+50)
    nh=u16(tab["hhea"][1]+34);numg=u16(tab["maxp"][1]+4)
    adv(g)=u16(tab["hmtx"][1]+4*min(g,nh-1))
    # cmap format 4
    cm=tab["cmap"][1];ns=u16(cm+2);sub=0
    for i in 0:ns-1;o=cm+4+8i;pid=u16(o);eid=u16(o+2);off=u32(o+4);(pid==3&&eid==1)&&(sub=cm+off);end
    segx2=u16(sub+6);segs=segx2÷2
    endc(i)=u16(sub+14+2i);startc(i)=u16(sub+16+segx2+2i);delta(i)=i16(sub+16+2segx2+2i)
    roff(i)=u16(sub+16+3segx2+2i)
    function gid(ch)
        c=Int(ch)
        for i in 0:segs-1
            c<=endc(i) || continue
            c>=startc(i) || return 0
            if roff(i)==0;return (c+delta(i))&0xffff;end
            o=sub+16+3segx2+2i+roff(i)+2(c-startc(i));g=u16(o);return g==0 ? 0 : (g+delta(i))&0xffff
        end
        0
    end
    glyf=tab["glyf"][1];loca=tab["loca"][1]
    locof(g)=locfmt==0 ? 2u16(loca+2g) : u32(loca+4g)
    function outline(g)
        o=glyf+locof(g);locof(g+1)==locof(g) && return Vector{Vector{Tuple{Float64,Float64}}}()
        nc=i16(o);@assert nc>=0 "composite glyph unsupported"
        ends=[u16(o+10+2i) for i in 0:nc-1];np=ends[end]+1
        il=u16(o+10+2nc);p=o+12+2nc+il
        flags=UInt8[];while length(flags)<np
            f=b[p+1];p+=1;push!(flags,f)
            if f&8!=0;r=b[p+1];p+=1;for _ in 1:r;push!(flags,f);end;end
        end
        xs=zeros(Int,np);ys=zeros(Int,np);v=0
        for i in 1:np;f=flags[i]
            if f&2!=0;d=Int(b[p+1]);p+=1;v+=(f&16!=0 ? d : -d)
            elseif f&16==0;v+=i16(p);p+=2;end
            xs[i]=v;end
        v=0
        for i in 1:np;f=flags[i]
            if f&4!=0;d=Int(b[p+1]);p+=1;v+=(f&32!=0 ? d : -d)
            elseif f&32==0;v+=i16(p);p+=2;end
            ys[i]=v;end
        cs=Vector{Vector{Tuple{Float64,Float64}}}();s=1
        for e in ends
            pts=[(Float64(xs[i]),Float64(ys[i]),flags[i]&1!=0) for i in s:e+1];s=e+2
            # expand implied on-curve points, flatten quadratics
            ex=Tuple{Float64,Float64,Bool}[]
            for (i,q) in enumerate(pts)
                push!(ex,q);nx=pts[mod1(i+1,length(pts))]
                (!q[3] && !nx[3]) && push!(ex,((q[1]+nx[1])/2,(q[2]+nx[2])/2,true))
            end
            k=findfirst(q->q[3],ex);ex=vcat(ex[k:end],ex[1:k-1]);push!(ex,ex[1])
            poly=Tuple{Float64,Float64}[];i=1
            while i<length(ex)
                a=ex[i]
                if ex[i+1][3];push!(poly,(a[1],a[2]));i+=1
                else c=ex[i+1];d=ex[i+2]
                    for t in 0:0.125:0.875;m=1-t
                        push!(poly,(m*m*a[1]+2m*t*c[1]+t*t*d[1],m*m*a[2]+2m*t*c[2]+t*t*d[2]));end
                    i+=2
                end
            end
            push!(cs,poly)
        end
        cs
    end
    (;upem,gid,adv,outline)
end
