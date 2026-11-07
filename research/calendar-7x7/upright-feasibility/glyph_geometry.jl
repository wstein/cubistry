#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Reads Noto Sans SemiBold (OFL-1.1, not redistributed here) and measures
#  (1) the digit metrics (ink height, advance) of 0-9 and '/',
#  (2) the half-turn residual of 6 against 9 and of 2, 5 (informational: the owner has
#      decided only 0 and 6<->9 count as half-turn equal; 6 vs 9 is reported so the
#      caveat is on the record),
#  (3) the largest font size at which a diagonal split label (first number top left,
#      slash in the middle, second number bottom right, all upright) fits a square
#      with a clearance between slash and numbers, versus the one-line label and the
#      plain dates drawn by src/apps/calendar7/sticker-art.ts.
#   glyph_geometry.jl NotoSans-SemiBold.ttf
using Printf
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
# Nonzero-winding raster of a set of contours (font units) into an N x N boolean grid
# covering [x0,x0+w] x [y0,y0+w] (y up).
function raster(cs,x0,y0,w,N)
    G=falses(N,N)
    for j in 1:N
        y=y0+(j-0.5)*w/N;xs=Tuple{Float64,Int}[]
        for c in cs,i in eachindex(c)
            a=c[i];d=c[mod1(i+1,length(c))]
            ((a[2]<=y)!=(d[2]<=y)) || continue
            push!(xs,(a[1]+(y-a[2])/(d[2]-a[2])*(d[1]-a[1]),d[2]>a[2] ? 1 : -1))
        end
        sort!(xs);wn=0
        for k in 1:length(xs)-1
            wn+=xs[k][2]
            wn!=0 && for i in 1:N;x=x0+(i-0.5)*w/N;(xs[k][1]<=x<xs[k+1][1]) && (G[i,j]=true);end
        end
    end
    G
end
function main(path)
    F=parse_font(path);U=F.upem
    println("font-upem\t",U)
    box(cs)=(minimum(p[1] for c in cs for p in c),maximum(p[1] for c in cs for p in c),
             minimum(p[2] for c in cs for p in c),maximum(p[2] for c in cs for p in c))
    println("glyph-header\tchar\tadvance_em\tink_w_em\tink_h_em\tink_ymin_em")
    M=Dict{Char,Any}()
    for ch in "0123456789/"
        g=F.gid(ch);cs=F.outline(g);bx=box(cs);M[ch]=(g=g,adv=F.adv(g)/U,cs=cs,bx=bx)
        @printf("glyph\t%c\t%.4f\t%.4f\t%.4f\t%.4f\n",ch,F.adv(g)/U,(bx[2]-bx[1])/U,(bx[4]-bx[3])/U,bx[3]/U)
    end
    # half-turn residual: rotate glyph 6 by 180 deg about its ink box centre, compare
    # to glyph 9 aligned by ink-box centre; report symmetric difference / union (IoU gap).
    N=240
    function turned_gap(a,b)
        ca=M[a].cs;cb=M[b].cs;ba=M[a].bx;bb=M[b].bx
        cxa=(ba[1]+ba[2])/2;cya=(ba[3]+ba[4])/2;cxb=(bb[1]+bb[2])/2;cyb=(bb[3]+bb[4])/2
        rot=[[(2cxa-p[1],2cya-p[2]) for p in c] for c in ca]   # half turn about own centre
        sh=[[(p[1]-cxa+cxb,p[2]-cya+cyb) for p in c] for c in rot]
        x0=cxb-U*0.6;y0=cyb-U*0.6;w=1.2U
        A=raster(sh,x0,y0,w,N);B=raster(cb,x0,y0,w,N)
        sum(A.⊻B)/sum(A.|B)
    end
    for (a,b) in (('6','9'),('2','2'),('5','5'),('8','8'),('1','1'),('0','0'))
        @printf("halfturn\t%c vs %c\tsymmetric_difference/union=%.4f\n",a,b,turned_gap(a,b))
    end
    # ---- sticker fits (square side 1 = printable text square) ----
    digit_h=maximum((M[c].bx[4]-M[c].bx[3])/U for c in "0123456789")
    println("digit-ink-height-em\t",round(digit_h;digits=4))
    adv=M['0'].adv
    # current sticker-art.ts: TEXTURE=192, text area 0.86*TEXTURE, base 140/110/80 px
    T=192.0
    fit(textem,base)=min(base,floor(base*T*0.86/(textem*base)))   # width in px = textem*base
    one=min(140.0,0.86T/adv);two=min(110.0,0.86T/(2adv))
    oneline_em=4adv+M['/'].adv;five=min(80.0,0.86T/oneline_em)
    println("current-art-header\tlabel\tfont_px\tdigit_height_px\tdigit_height_frac_of_sticker")
    for (l,s) in (("1 digit",one),("2 digits",two),("23/30 one line",five))
        @printf("current-art\t%s\t%.1f\t%.1f\t%.3f\n",l,s,s*digit_h,s*digit_h/T)
    end
    # ---- diagonal layout: tight-ink placement in unit square, clearance in square units
    function lay(s,clear;slashf=1.0,res=300)
        num(str)=begin   # ink polygons of a number at font size s (square units), origin at pen start
            pts=Vector{Vector{Tuple{Float64,Float64}}}();x=0.0
            for ch in str
                for c in M[ch].cs;push!(pts,[((x*U+p[1])*s/U,p[2]*s/U) for p in c]);end
                x+=M[ch].adv
            end;pts
        end
        n1=num("23");n2=num("30");sl=[[(p[1]*s*slashf/U,p[2]*s*slashf/U) for p in c] for c in M['/'].cs]
        bb(cs)=box(cs)
        b1=bb(n1);b2=bb(n2);bs=bb(sl)
        shift(cs,dx,dy)=[[(p[1]+dx,p[2]+dy) for p in c] for c in cs]
        w1=b1[2]-b1[1];h1=b1[4]-b1[3];w2=b2[2]-b2[1];h2=b2[4]-b2[3]
        top=shift(n1,-b1[1],1-h1-b1[3]);bot=shift(n2,1-w2-b2[1],-b2[3])
        mid=shift(sl,0.5-(bs[1]+bs[2])/2,0.5-(bs[3]+bs[4])/2)
        sample(cs)=begin   # boundary sample points
            P=Tuple{Float64,Float64}[]
            for c in cs,i in eachindex(c);a=c[i];d=c[mod1(i+1,length(c))]
                for t in 0:0.25:0.75;push!(P,(a[1]+t*(d[1]-a[1]),a[2]+t*(d[2]-a[2])));end;end;P
        end
        # bitmap-free clearance: min distance between boundary samples of different parts,
        # but only if the shapes do not overlap (overlap shows as distance ~0 anyway).
        function mind(A,B);m=Inf;for p in A,q in B;d=hypot(p[1]-q[1],p[2]-q[2]);d<m&&(m=d);end;m;end
        Pt=sample(top);Pb=sample(bot);Pm=sample(mid)
        (clearance=min(mind(Pt,Pm),mind(Pb,Pm)),gap_numbers=mind(Pt,Pb),
         fits=(max(w1,w2)<=1+1e-9 && h1+h2<=1+1e-9),digit_h=s*digit_h,w1=w1,h1=h1)
    end
    println("diagonal-header\tclearance_frac_of_square\tmax_font_size_square_units\tdigit_height\tnumber_ink_w\tgap_between_numbers")
    for cl in (0.02,0.04,0.06,0.08)
        lo=0.05;hi=0.9
        for _ in 1:30;mid=(lo+hi)/2;r=lay(mid,cl);ok=r.fits&&r.clearance>=cl;ok ? (lo=mid) : (hi=mid);end
        r=lay(lo,cl)
        @printf("diagonal\t%.2f\t%.4f\t%.4f\t%.4f\t%.4f\n",cl,lo,r.digit_h,r.w1,r.gap_numbers)
    end
    # one-line reference in the same square: width 4*adv+slash must be <=1
    s1=1/oneline_em;@printf("oneline-ref\tfont=%.4f\tdigit_height=%.4f\n",s1,s1*digit_h)
    s2=1/(2adv);@printf("plain2-ref\tfont=%.4f\tdigit_height=%.4f\n",s2,s2*digit_h)
end
main(ARGS[1])
