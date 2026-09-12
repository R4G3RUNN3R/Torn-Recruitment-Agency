const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const boot=fs.readFileSync(path.join(root,'R4G3RUNN3R-Recruitment-Agency.user.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

const CORE_PIN='9475f00745f81173a114bb87451f654769b3d32a';
const V48_SHELL_PIN='bcd81943da95438244b1fdaf72e462dca646ad98';

test('v4.8.0 installer keeps reviewed v4.7.6 core immutable and adds immutable simplified shell',()=>{
  assert.match(boot,/@version\s+4\.8\.0/);
  assert.match(boot,/INSTALLER_VERSION\s*=\s*'4\.8\.0'/);
  assert.match(boot,/EXPECTED_APP_VERSION\s*=\s*'4\.7\.6'/);
  assert.ok(boot.includes(`/${CORE_PIN}/src/v45-app.js`),'reviewed v4.7.6 core remains immutable');
  assert.ok(boot.includes(`/${V48_SHELL_PIN}/src/v48-shell.js`),'simplified v4.8 shell is immutable');
  assert.match(boot,/const simplifiedShell = window\.RA_V48Shell/);
  assert.match(boot,/simplifiedShell\.VERSION/);
  assert.match(boot,/simplifiedShell\.install\(app\)/);
  assert.equal(pkg.version,'4.8.0');
});

test('v4.8 shell runtime is syntax-checked by the package release gate',()=>{
  assert.match(pkg.scripts.syntax,/node --check src\/v48-shell\.js/);
});
