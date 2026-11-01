"""Bounded static extraction; never execute artifact code or preserve modes/links."""
import html,os,re,stat,sys,unicodedata,zipfile
from pathlib import Path,PurePosixPath
from html.parser import HTMLParser
MAX_TOTAL=64*1024*1024
REPOSITORY='wstein/cubistry'
MAX_TITLE=80

class DocumentBoundaries(HTMLParser):
    """Strict Vite HTML document boundaries; never rewrite or execute markup."""
    CDATA_CONTENT_ELEMENTS=('script','style','title','textarea')
    unsupported=('iframe','xmp','noembed','noframes','plaintext')
    containers=('html','head','body','template','noscript','script','style','title','textarea')
    def __init__(self,text):
        super().__init__(convert_charrefs=False)
        self.offsets=[0]+[m.end() for m in re.finditer('\n',text)]
        self.positions={};self.inert=[];self.document=[];self.feed(text);self.close()
    def handle_starttag(self,tag,attrs):
        if tag in self.unsupported:raise ValueError('Unsupported ambiguous raw-text container')
        if tag in ('template','noscript'):
            self.inert.append(tag);return
        if self.inert:return
        if tag not in ('html','head','body'):
            if 'body' not in self.positions and tag not in ('meta','link','base','title','style','script'):
                raise ValueError('Unsupported markup before explicit body')
            return
        if tag in self.positions:raise ValueError('Ambiguous document boundaries')
        if (tag=='html' and self.document) or (tag in ('head','body') and self.document!=['html']):
            raise ValueError('Document container is not an HTML child')
        if tag=='head' and 'body' in self.positions:raise ValueError('Misordered document boundaries')
        line,column=self.getpos();start=self.offsets[line-1]+column
        self.positions[tag]=(start,start+len(self.get_starttag_text()));self.document.append(tag)
    def handle_startendtag(self,tag,attrs):
        if tag in self.containers or tag in self.unsupported:
            raise ValueError('Ambiguous self-closing document container')
        self.handle_starttag(tag,attrs)
    def handle_endtag(self,tag):
        if tag in self.unsupported:raise ValueError('Unsupported ambiguous raw-text container')
        if tag in ('template','noscript'):
            if not self.inert or self.inert[-1]!=tag:raise ValueError('Ambiguous inert document markup')
            self.inert.pop();return
        if self.inert:return
        if tag in ('html','head','body'):
            if not self.document or self.document[-1]!=tag:raise ValueError('Misnested document boundary')
            self.document.pop()

def clean_title(title):
    """Single-line, bounded, escaped PR title; untrusted free text from PR authors."""
    text=''.join(' ' if unicodedata.category(c) in ('Cc','Zl','Zp') else c for c in str(title or ''))
    text=''.join(c for c in text if unicodedata.category(c)!='Cf')
    text=' '.join(text.split())
    if len(text)>MAX_TITLE:text=text[:MAX_TITLE-1].rstrip()+'\u2026'
    return html.escape(text,quote=True)

def mark_preview(text,number,sha,title=''):
    boundaries=DocumentBoundaries(text).positions
    if 'html' not in boundaries or 'body' not in boundaries:raise ValueError('Preview HTML lacks explicit document boundaries')
    body_start,body_end=boundaries['body']
    head=boundaries.get('head')
    if head and head[0]>body_start:raise ValueError('Misordered document boundaries')
    marker='<meta name="robots" content="noindex,nofollow">'
    number=int(number)
    if number<1:raise ValueError('Invalid PR number')
    link=f'<a href="https://github.com/{REPOSITORY}/pull/{number}" target="_blank" rel="noopener noreferrer">PR #{number}</a>'
    label=clean_title(title)
    banner=f'<aside style="padding:12px;background:#fff0b3;color:#222">Cubistry PR preview · {link}{" · "+label if label else ""} — non-production preview · {html.escape(sha[:12])}</aside>'
    insertions=[(head[1] if head else body_start,marker),(body_end,banner)]
    for offset,value in sorted(insertions,reverse=True):text=text[:offset]+value+text[offset:]
    return text

def extract(archive,destination,number=0,sha='',title=''):
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
            if number and parts[-1]=='CNAME':raise ValueError('Preview artifacts must not carry a CNAME')
            seen.add(name);total+=info.file_size
            if total>MAX_TOTAL or info.file_size>16*1024*1024:raise ValueError('Artifact expands beyond budget')
            records.append(info)
        index=next((i for i in records if i.filename=='index.html' and not i.is_dir()),None)
        if index is None or index.file_size==0:raise ValueError('Missing nonempty regular static root index')
        try:document=z.read(index).decode('utf-8')
        except UnicodeError:raise ValueError('Root index is not UTF-8 HTML')
        if 'html' not in DocumentBoundaries(document).positions:raise ValueError('Root index lacks an HTML document')
        root.mkdir(parents=True,exist_ok=True)
        for info in records:
            path=root/info.filename
            if info.is_dir():path.mkdir(parents=True,exist_ok=True);continue
            path.parent.mkdir(parents=True,exist_ok=True)
            data=z.read(info)
            if number and path.suffix=='.html':
                text=mark_preview(data.decode('utf-8'),number,sha,title)
                data=text.encode()
            path.write_bytes(data);path.chmod(0o644)
    (root/'.nojekyll').write_text('')
if __name__=='__main__':extract(sys.argv[1],sys.argv[2],int(sys.argv[3]) if len(sys.argv)>3 else 0,sys.argv[4] if len(sys.argv)>4 else '',sys.argv[5] if len(sys.argv)>5 else '')
