import {describe,it,expect} from 'vitest';
import {csProto} from './csProto';
describe('CS application etymology reads',()=>{
 it('does not require an API key or expose extra database fields',async()=>{const response=await csProto(new Request('http://localhost'), '42',async id=>({id,lemma:'*bratrъ',body:'Свидетельство',sourceUrl:'https://example.org',morphemes:[],internalNote:'private'}));expect(response.status).toBe(200);const body=await response.json();expect(body.lemma).toBe('*bratrъ');expect(body).not.toHaveProperty('internalNote');expect(body.bodySha256).toMatch(/^[a-f0-9]{64}$/);expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');});
 it('validates IDs and isolates service failures',async()=>{expect((await csProto(new Request('http://localhost'),'../1',async()=>null)).status).toBe(400);expect((await csProto(new Request('http://localhost'),'43',async()=>null)).status).toBe(404);expect((await csProto(new Request('http://localhost'),'44',async()=>{throw Error('private database path');})).status).toBe(503);});
});
