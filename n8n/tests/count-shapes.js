// Does the number we give the AI equal the number of releases actually in the document?
//
// Run from the repo root:   node n8n/tests/count-shapes.js n8n/extraction-stage1.v49.json
//
// Every version from v42 to v48 fixed the ONE document that had just gone wrong, and each
// time the next document broke somewhere else - v48 scored 6 of these 12. Before changing
// Chunk Source again, run this. A change that improves the document in front of you and
// lowers this score has not fixed anything.
//
// The two properties that matter more than the score:
//   - the count must NEVER exceed the real one (that orders the model to invent);
//   - "EXACTLY n" may only be said when every counted row prints a barcode.
// Both are asserted in the v49 harness alongside these counts.
const fs=require('fs'), vm=require('vm');
const P='C:/Users/User/Desktop/nika-platform/';
const shapes=require('./shapes.js');
const file=process.argv[2];
const code=JSON.parse(fs.readFileSync(P+file,'utf8')).nodes.find(n=>n.name==='Chunk Source').parameters.jsCode;
function chunk(doc){
  const src={message_id:'m',thread_id:'t',subject:'s',from:null,date:'2026-09-03T10:00:00Z',body:'',attachments_text:doc,source_kind:'manual'};
  return vm.runInNewContext('(function(){'+code+'})()',{console,String,Number,Array,Object,Set,Map,RegExp,JSON,Math,Date,parseInt,parseFloat,isNaN,$input:{all:()=>[{json:src}]}}).map(x=>x.json);
}
console.log('\n' + file.replace(/.*\//,''));
console.log('  ' + 'shape'.padEnd(48) + 'real  told   verdict');
let bad=0;
for(const s of shapes){
  const parts=chunk(s.text);
  const told=parts.reduce((n,p)=>n+p.chunk_rows,0);
  const v = told===s.releases ? 'ok' : (told<s.releases ? 'UNDERCOUNTS by '+(s.releases-told) : 'OVERCOUNTS by '+(told-s.releases));
  if(told!==s.releases) bad++;
  console.log('  ' + s.name.padEnd(48) + String(s.releases).padEnd(6) + String(told).padEnd(6) + v);
}
console.log('  ' + '-'.repeat(70));
console.log('  %d of %d shapes counted correctly', shapes.length-bad, shapes.length);
