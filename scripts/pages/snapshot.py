"""Copy the static storage tree without Git metadata, links or partial roots."""
import shutil,stat,sys
from pathlib import Path

def snapshot(source,destination):
    source=Path(source);destination=Path(destination)
    if not (source/'index.html').is_file():raise ValueError('Refusing previews-only publication without production root')
    size=0
    for p in source.rglob('*'):
        rel=p.relative_to(source)
        if rel.parts[0]=='.git':continue
        if p.is_symlink() or not(p.is_file()or p.is_dir()):raise ValueError('Unsafe storage-tree entry')
        if p.is_file():
            size+=p.stat().st_size
            if size>512*1024*1024:raise ValueError('Combined Pages snapshot exceeds budget')
            target=destination/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target);target.chmod(0o644)
if __name__=='__main__':snapshot(sys.argv[1],sys.argv[2])
