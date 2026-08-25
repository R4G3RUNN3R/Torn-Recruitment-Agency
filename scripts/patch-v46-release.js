const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const PIN='520da615d418d42524761e774f10f3ab26c28572';
const modules=['scout-core.js','results-core.js','global-core.js','match-core.js','forum-core.js','v45-runtime.js','v45-candidates.js','v45-discovery.js','v45-messaging.js','v46-domain-core.js','v46-storage-core.js','v46-navigation.js','v46-company-core.js','v46-company-storage.js','v46-company-ui.js','v46-company-operations.js','v46-company-workflow.js','v46-company-workflow-ui.js','v46-company-opportunity-ui.js','v46-company-platform.js','v45-app.js'];

function write(file,src){fs.writeFileSync(path.join(root,file),src);}
function read(file){return fs.readFileSync(path.join(root,file),'utf8');}
function replaceOnce(src,search,replacement,label){if(!src.includes(search))throw new Error(`Release patch guard failed: ${label}`);return src.replace(search,replacement);}

let boot=read('R4G3RUNN3R-Recruitment-Agency.user.js');
boot=replaceOnce(boot,'// @version      4.5.4','// @version      4.6.0','userscript version');
const requireStart=boot.indexOf('// @require      ');
const requireEnd=boot.indexOf('// @downloadURL',requireStart);
if(requireStart<0||requireEnd<requireStart)throw new Error('Release patch guard failed: require block');
const requires=modules.map(file=>`// @require      https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/${PIN}/src/${file}`).join('\n')+'\n';
boot=boot.slice(0,requireStart)+requires+boot.slice(requireEnd);
boot=replaceOnce(boot,"const INSTALLER_VERSION = '4.5.4';","const INSTALLER_VERSION = '4.6.0';",'installer version');
boot=replaceOnce(boot,"const EXPECTED_APP_VERSION = '4.5.0';","const EXPECTED_APP_VERSION = '4.6.0';",'expected app version');
write('R4G3RUNN3R-Recruitment-Agency.user.js',boot);

let app=read('src/v45-app.js');
app=replaceOnce(app,"const SCRIPT_VERSION = '4.5.0';","const SCRIPT_VERSION = '4.6.0';",'source app version');
write('src/v45-app.js',app);

let pkg=read('package.json');
pkg=replaceOnce(pkg,'"version": "4.5.4"','"version": "4.6.0"','package version');
write('package.json',pkg);

let readme=read('README.md');
readme=replaceOnce(readme,"R4G3RUNN3R's Recruitment Agency **v4.5.4** is a modular Torn recruitment workspace","R4G3RUNN3R's Recruitment Agency **v4.6.0** is a modular Torn recruitment workspace",'README version');
readme=replaceOnce(readme,'## v4.6 source development','## v4.6 Company Recruitment release','README release heading');
readme=replaceOnce(readme,'The repository now contains the internal **v4.6 Foundation plus the complete source-level Company Recruitment slice** behind the still-public v4.5.4 installer. Company Recruitment is implemented and verified in source, while the public installer remains intentionally release-isolated until the separate v4.6 pin/version hardening step is complete.','The repository now contains the **v4.6 Foundation and complete Company Recruitment slice**, released through the public **v4.6.0** userscript. Runtime modules are loaded through immutable `@require` pins to the reviewed source commit used for this release.','README release status');
readme=replaceOnce(readme,'- The public userscript remains **v4.5.4** with its existing immutable `@require` pins until a separate reviewed release explicitly advances the installer and module pins.','- The public userscript is **v4.6.0** and pins its runtime modules immutably to reviewed source commit `520da615d418d42524761e774f10f3ab26c28572`. Faction recruitment remains a separate domain and is not merged into the Company workflows.','README public release bullet');
write('README.md',readme);

console.log('Applied guarded v4.6.0 release patch.');
// trigger marker only; no functional effect
