const fs=require('node:fs');
const path=require('node:path');
const testsDir=path.join(__dirname,'..','tests');
const insert=['v46-company-ui.js','v46-company-operations.js','v46-company-workflow.js','v46-company-workflow-ui.js','v46-company-opportunity-ui.js','v46-company-platform.js'];
let changed=[];
for(const name of fs.readdirSync(testsDir).filter(n=>n.endsWith('.test.js'))){
  const file=path.join(testsDir,name);
  let src=fs.readFileSync(file,'utf8');
  if(!src.includes('v46-company-storage.js')||!src.includes('v45-app.js'))continue;
  if(insert.every(mod=>src.includes(mod)))continue;
  const patterns=[
    ["'v46-company-storage.js','v45-app.js'",`'v46-company-storage.js',${insert.map(x=>`'${x}'`).join(',')},'v45-app.js'`],
    ["'v46-company-storage.js', 'v45-app.js'",`'v46-company-storage.js', ${insert.map(x=>`'${x}'`).join(', ')}, 'v45-app.js'`]
  ];
  let replaced=false;
  for(const [search,replacement] of patterns){
    if(src.includes(search)){src=src.replace(search,replacement);replaced=true;break;}
  }
  if(!replaced){
    const needle="'v46-company-storage.js'";
    const idx=src.indexOf(needle);
    const appIdx=src.indexOf("'v45-app.js'",idx);
    if(idx>=0&&appIdx>idx){
      const between=src.slice(idx+needle.length,appIdx);
      if(/^\s*,\s*$/.test(between)){
        src=src.slice(0,idx+needle.length)+','+insert.map(x=>`'${x}'`).join(',')+','+src.slice(appIdx);
        replaced=true;
      }
    }
  }
  if(!replaced)throw new Error(`Could not safely patch module list in ${name}`);
  fs.writeFileSync(file,src);changed.push(name);
}
if(!changed.length)throw new Error('No browser/module harness files required patching.');

const runtimeFile=path.join(testsDir,'v45-ui-runtime.test.js');
let runtime=fs.readFileSync(runtimeFile,'utf8');
const oldHelper="if (expectedControl) assert.ok(document.getElementById(expectedControl), `${expectedControl} should exist after routing to ${page}`);";
const newHelper="if (expectedControl) assert.ok(document.querySelector(expectedControl), `${expectedControl} should exist after routing to ${page}`);";
if(!runtime.includes(oldHelper))throw new Error('Runtime helper patch guard failed.');
runtime=runtime.replace(oldHelper,newHelper);
const replacements=[
  ["await openPage('company-discover', 'Company Discover', 'ra-sync');","await openPage('company-discover', 'Company Discover', '#ra-sync');"],
  ["await openPage('company-candidates', 'Company Candidates', 'ra-toggle-view');","await openPage('company-candidates', 'Company Candidates', '#ra-content .ra-table');"],
  ["await openPage('company-pipeline', 'Company Pipeline', 'ra-mobile-stage-select');","await openPage('company-pipeline', 'Company Pipeline', '#ra-content .ra-pipeline');"],
  ["await openPage('scout', 'Scout', 'ra-run-scout');","await openPage('scout', 'Scout', '#ra-run-scout');"],
  ["await openPage('smart-match', 'Smart Match', 'ra-match-save');","await openPage('smart-match', 'Smart Match', '#ra-match-save');"],
  ["await openPage('global-intelligence', 'Global Intelligence', 'ra-global-test');","await openPage('global-intelligence', 'Global Intelligence', '#ra-global-test');"]
];
for(const [search,replacement] of replacements){if(!runtime.includes(search))throw new Error(`Runtime assertion patch guard failed: ${search}`);runtime=runtime.replace(search,replacement);}
fs.writeFileSync(runtimeFile,runtime);changed.push('v45-ui-runtime.test.js');
console.log(`Patched ${changed.length} test harness files: ${[...new Set(changed)].join(', ')}`);
// workflow trigger marker; no functional effect
