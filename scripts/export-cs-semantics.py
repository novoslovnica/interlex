"""Read-only export from RuWordNet's reference database; never reads ISV semantic_relations."""
import argparse, hashlib, json, pathlib, sqlite3
p=argparse.ArgumentParser();p.add_argument('--reference',required=True);p.add_argument('--out',required=True);a=p.parse_args()
source=pathlib.Path(a.reference).resolve();out=pathlib.Path(a.out)
if out.exists():raise SystemExit('Output exists')
db=sqlite3.connect('file:'+str(source)+'?mode=ro&immutable=1',uri=True)
concepts=[dict(id=i,title=t,definition=d or '',pos=pos or '') for i,t,d,pos in db.execute('select id,title,definition,part_of_speech from synset')]
senses=[dict(lemma=l,synsetId=i) for l,i in db.execute('select distinct lemma,synset_id from sense where lemma is not null')]
antonyms=[list(r) for r in db.execute('select left_id,right_id from antonymy_relation')]
h=hashlib.file_digest(source.open('rb'),'sha256').hexdigest()
out.write_text(json.dumps(dict(format='cs-ruwordnet-v1',provider='ruwordnet',version=h,concepts=concepts,senses=senses,antonyms=antonyms),ensure_ascii=False))
print(json.dumps(dict(concepts=len(concepts),senses=len(senses),antonyms=len(antonyms),version=h)))
