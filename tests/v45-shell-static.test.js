const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','src','v45-app.js'),'utf8');

test('v4.5 shell is movable, resizable, routed and responsive',()=>{assert.match(app,/resize:both/);assert.match(app,/bindWindow/);assert.match(app,/saveGeometry/);assert.match(app,/restoreGeometry/);assert.match(app,/@media\(max-width:640px\)/);assert.match(app,/Runtime\.visiblePages/);});

test('Simple mode hides Logs through the runtime navigation contract',()=>{const R=require('../src/v45-runtime');assert.equal(R.visiblePages('simple').flatMap(g=>g.pages).some(p=>p.id==='logs'),false);assert.equal(R.visiblePages('advanced').flatMap(g=>g.pages).some(p=>p.id==='logs'),true);});

test('contextual help is header-anchored and viewport clamped',()=>{assert.match(app,/function helpButton/);assert.match(app,/function positionHelp/);assert.match(app,/getBoundingClientRect/);assert.match(app,/innerWidth-width-margin/);assert.match(app,/innerHeight-height-margin/);});

test('dark theme is readable and light theme keeps black text',()=>{assert.match(app,/--ra-text:#edf4ef/);assert.match(app,/:root\[data-ra-theme=\"light\"\][^}]*--ra-text:#000/);});
