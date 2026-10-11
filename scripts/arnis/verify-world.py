#!/usr/bin/env python3
"""Check an Arnis Java ZIP structurally, without claiming a Minecraft play test."""
# Reused from the same owner's Malaysia/scripts/verify-arnis-world.py.
import io,json,struct,sys,zipfile,zlib,gzip

def nbt(data):
    f=io.BytesIO(data)
    def read(n):
        b=f.read(n)
        if len(b)!=n:raise ValueError('Truncated NBT')
        return b
    def num(fmt):return struct.unpack('>'+fmt,read(struct.calcsize(fmt)))[0]
    def string():return read(num('H')).decode('utf8')
    def value(t):
        if t in (1,2,3,4,5,6):return num({1:'b',2:'h',3:'i',4:'q',5:'f',6:'d'}[t])
        if t==8:return string()
        if t==9:
            k=num('B');return [value(k)for _ in range(num('i'))]
        if t==10:
            d={}
            while True:
                k=num('B')
                if k==0:return d
                name=string();d[name]=value(k)
        if t in (7,11,12):
            count=num('i');read(count*{7:1,11:4,12:8}[t]);return None
        raise ValueError('Unknown NBT tag '+str(t))
    t=num('B');string();return value(t)

def verify(path):
    chunks=0;blocks=set()
    with zipfile.ZipFile(path)as z:
        assert z.testzip() is None
        files=[n for n in z.namelist() if not n.startswith('__MACOSX/')];levels=[n for n in files if n.endswith('/level.dat')];assert len(levels)==1
        level=nbt(gzip.decompress(z.read(levels[0])))['Data']
        metadata=json.loads(z.read(next(n for n in files if n.endswith('/metadata.json'))))
        regions=[n for n in files if '/region/'in n and n.endswith('.mca')];assert len(regions)>=1
        for name in regions:
            r=z.read(name);assert len(r)>=8192
            occupied=[]
            for i in range(1024):
                loc=int.from_bytes(r[i*4:i*4+4],'big');offset=loc>>8;sectors=loc&255
                if not offset:continue
                assert offset>=2 and sectors>0 and (offset+sectors)*4096<=len(r)
                pos=offset*4096;length=int.from_bytes(r[pos:pos+4],'big');assert 1<length<=sectors*4096-4
                occupied.append((pos,length));chunks+=1
            for pos,length in occupied[::max(1,len(occupied)//10)]:
                assert r[pos+4]==2
                chunk=nbt(zlib.decompress(r[pos+5:pos+4+length]))
                for section in chunk.get('sections',[]):
                    blocks.update(p['Name']for p in section.get('block_states',{}).get('palette',[]))
        assert chunks>100 and len(blocks)>5
        assert any('glass'in b or 'concrete'in b or 'bricks'in b for b in blocks),'No sampled building materials'
        return {'region_files':len(regions),'populated_chunks':chunks,'sampled_block_types':len(blocks),'data_version':level.get('DataVersion'),'spawn':[level.get('SpawnX'),level.get('SpawnY'),level.get('SpawnZ')],'metadata':metadata}
if __name__=='__main__':print(json.dumps(verify(sys.argv[1])))
