"""Bounded static extraction; never execute artifact code or preserve modes/links."""
import html,os,re,stat,sys,zipfile
from pathlib import Path,PurePosixPath
MAX_TOTAL=64*1024*1024

def extract(archive,destination,number=0,sha=''):
    root=Path(destination)
    if root.exists() and any(root.iterdir()):raise ValueError('Extraction directory must be empty')
    records=[];seen=set();total=0
    with zipfile.ZipFile(archive) as z:
        if len(z.infolist())>10000:raise ValueError('Too many artifact entries')
        for info in z.infolist():
            name=info.filename.rstrip('/')
            parts=PurePosixPath(name).parts
            mode=info.external_attr>>16
            if (not name or name.startswith('/') or '\\' in name or ':' in name or '%' in name or
                any(p in ('.','..') or p.startswith('.') for p in parts) or
                stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in (0,stat.S_IFREG,stat.S_IFDIR))):raise ValueError('Unsafe artifact path or mode')
            if str(PurePosixPath(name))!=name or name in seen:raise ValueError('Ambiguous artifact path')
            if parts[0]=='pr-preview':raise ValueError('Reserved preview namespace')
            seen.add(name);total+=info.file_size
            if total>MAX_TOTAL or info.file_size>16*1024*1024:raise ValueError('Artifact expands beyond budget')
            records.append(info)
        if 'index.html' not in seen:raise ValueError('Missing static root index')
        root.mkdir(parents=True,exist_ok=True)
        for info in records:
            path=root/info.filename
            if info.is_dir():path.mkdir(parents=True,exist_ok=True);continue
            path.parent.mkdir(parents=True,exist_ok=True)
            data=z.read(info)
            if number and path.suffix=='.html':
                text=data.decode('utf-8')
                text=re.sub(r'(<head\b[^>]*>)',r'\1<meta name="robots" content="noindex,nofollow">',text,count=1,flags=re.I)
                banner=f'<aside style="padding:12px;background:#fff0b3;color:#222">PR #{number} — non-production preview · {html.escape(sha[:12])}</aside>'
                text=re.sub(r'(<body\b[^>]*>)',lambda m:m[0]+banner,text,count=1,flags=re.I)
                if 'noindex,nofollow' not in text or banner not in text:raise ValueError('Preview HTML lacks a document boundary')
                data=text.encode()
            path.write_bytes(data);path.chmod(0o644)
    (root/'.nojekyll').write_text('')
if __name__=='__main__':extract(sys.argv[1],sys.argv[2],int(sys.argv[3]) if len(sys.argv)>3 else 0,sys.argv[4] if len(sys.argv)>4 else '')
