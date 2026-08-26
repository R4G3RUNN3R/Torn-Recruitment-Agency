const fs=require('node:fs');

const mode=process.argv[2];
const sourceSha=process.argv[3]||'';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,content){fs.writeFileSync(path,content);}
function replaceOnce(text,needle,replacement,label){
  const first=text.indexOf(needle);
  if(first<0) throw new Error(`Missing patch anchor: ${label}`);
  if(text.indexOf(needle,first+needle.length)>=0) throw new Error(`Patch anchor matched more than once: ${label}`);
  return text.slice(0,first)+replacement+text.slice(first+needle.length);
}

if(mode==='source'){
  const path='src/v45-app.js';
  let text=read(path);
  text=replaceOnce(text,"const SCRIPT_VERSION = '4.6.0';","const SCRIPT_VERSION = '4.6.1';",'source app version');
  write(path,text);
  process.exit(0);
}

if(mode!=='release') throw new Error('Usage: node scripts/patch-v461-hotfix.js source | release <sourceSha>');
if(!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error('release mode requires the immutable 40-character source commit SHA');

const bootPath='R4G3RUNN3R-Recruitment-Agency.user.js';
let boot=read(bootPath);
boot=replaceOnce(boot,'// @version      4.6.0','// @version      4.6.1','userscript version');
boot=replaceOnce(boot,'// @grant        GM_xmlhttpRequest','// @grant        GM_info\n// @grant        GM_xmlhttpRequest','GM_info grant');
boot=replaceOnce(boot,'// @connect      script.googleusercontent.com','// @connect      script.googleusercontent.com\n// @connect      raw.githubusercontent.com','raw GitHub connect');
boot=boot.split('520da615d418d42524761e774f10f3ab26c28572').join(sourceSha);
boot=replaceOnce(boot,"const INSTALLER_VERSION = '4.6.0';\n  const EXPECTED_APP_VERSION = '4.6.0';",`const INSTALLER_VERSION = '4.6.1';\n  const EXPECTED_APP_VERSION = '4.6.1';\n  const CANONICAL_INSTALL_URL = 'https://raw.githubusercontent.com/R4G3RUNN3R/Torn-Recruitment-Agency/main/R4G3RUNN3R-Recruitment-Agency.user.js';\n  const LATEST_USERSCRIPT_URL = CANONICAL_INSTALL_URL;\n  const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;\n  const UPDATE_CHECK_STORAGE_KEY = 'r4g3-ra-last-update-check';`,'release constants');

const functionAnchor='  function clearDomGuard() {';
const updateFunctions=`  function compareVersions(left, right) {\n    const a = String(left || '').split('.').map(value => Number.parseInt(value, 10) || 0);\n    const b = String(right || '').split('.').map(value => Number.parseInt(value, 10) || 0);\n    const length = Math.max(3, a.length, b.length);\n    for (let index = 0; index < length; index += 1) {\n      const av = a[index] || 0;\n      const bv = b[index] || 0;\n      if (av > bv) return 1;\n      if (av < bv) return -1;\n    }\n    return 0;\n  }\n\n  function shouldCheckForUpdate(lastCheckedAt, now) {\n    const last = Number(lastCheckedAt) || 0;\n    const current = Number(now) || Date.now();\n    return !last || current - last >= UPDATE_CHECK_INTERVAL_MS;\n  }\n\n  function installedUserscriptVersion() {\n    const tampermonkeyVersion = typeof GM_info !== 'undefined' ? GM_info?.script?.version : '';\n    return String(tampermonkeyVersion || INSTALLER_VERSION);\n  }\n\n  function readLastUpdateCheck() {\n    try { return Number(window.localStorage?.getItem(UPDATE_CHECK_STORAGE_KEY)) || 0; } catch { return 0; }\n  }\n\n  function writeLastUpdateCheck(value) {\n    try { window.localStorage?.setItem(UPDATE_CHECK_STORAGE_KEY, String(value)); } catch {}\n  }\n\n  function showUpdateNotice({installedVersion=installedUserscriptVersion(), runtimeVersion='', latestVersion='', mismatch=false}={}) {\n    let banner = document.getElementById('ra-update-banner');\n    if (!banner) {\n      banner = document.createElement('div');\n      banner.id = 'ra-update-banner';\n      banner.style.cssText = 'position:fixed;right:18px;top:18px;z-index:2147483647;max-width:430px;padding:16px 18px;background:#17191d;color:#f4f4f4;border:1px solid #b8793f;border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.45);font:14px/1.45 Arial,sans-serif';\n      document.body?.appendChild(banner);\n    }\n    const title = mismatch ? 'Recruitment Agency installation is out of sync' : 'Recruitment Agency update available';\n    const installedLine = 'Installed: ' + String(installedVersion || 'unknown');\n    const runtimeLine = runtimeVersion ? '<br>Runtime: ' + String(runtimeVersion) : '';\n    const latestLine = latestVersion ? '<br>Latest: ' + String(latestVersion) : '';\n    banner.innerHTML = '<strong style="font-size:15px">' + title + '</strong><div style="margin-top:7px">' + installedLine + runtimeLine + latestLine + '</div><button id="ra-update-now" type="button" style="margin-top:12px;padding:8px 12px;cursor:pointer">Update Recruitment Agency</button>';\n    const button = document.getElementById('ra-update-now');\n    if (button) button.onclick = () => window.open(CANONICAL_INSTALL_URL, '_blank', 'noopener,noreferrer');\n    return banner;\n  }\n\n  function checkForUpdates(options={}) {\n    const installedVersion = installedUserscriptVersion();\n    const runtimeVersion = String(options.runtimeVersion || '');\n    const now = Date.now();\n    const force = !!options.force;\n    const lastCheckedAt = readLastUpdateCheck();\n    if (!force && !shouldCheckForUpdate(lastCheckedAt, now)) return Promise.resolve(null);\n    writeLastUpdateCheck(now);\n    if (typeof GM_xmlhttpRequest !== 'function') return Promise.resolve(null);\n\n    return new Promise(resolve => {\n      GM_xmlhttpRequest({\n        method:'GET',\n        url:LATEST_USERSCRIPT_URL + '?ra_update=' + now,\n        headers:{'Cache-Control':'no-cache'},\n        onload:response => {\n          const text = String(response?.responseText || '');\n          const match = text.match(/@version\\s+(\\d+\\.\\d+\\.\\d+)/);\n          const latestVersion = match?.[1] || '';\n          if (latestVersion && compareVersions(latestVersion, installedVersion) > 0) {\n            showUpdateNotice({installedVersion, runtimeVersion, latestVersion, mismatch:!!options.mismatch});\n          } else if (options.mismatch) {\n            showUpdateNotice({installedVersion, runtimeVersion, latestVersion, mismatch:true});\n          }\n          resolve(latestVersion || null);\n        },\n        onerror:() => {\n          if (options.mismatch) showUpdateNotice({installedVersion, runtimeVersion, mismatch:true});\n          resolve(null);\n        },\n        ontimeout:() => {\n          if (options.mismatch) showUpdateNotice({installedVersion, runtimeVersion, mismatch:true});\n          resolve(null);\n        },\n        timeout:10000\n      });\n    });\n  }\n\n`;
if(!boot.includes(functionAnchor)) throw new Error('Missing patch anchor: update function insertion');
boot=boot.replace(functionAnchor,updateFunctions+functionAnchor);

const oldBoot=`  const app = window.RA_V45App;\n  if (!app || typeof app.start !== 'function') {\n    clearDomGuard();\n    const message = \`Recruitment Agency \${INSTALLER_VERSION} could not load its application module. Update or reinstall the userscript so Tampermonkey refreshes the pinned runtime files.\`;\n    console.error('[RA]', message);\n    alert(message);\n    return;\n  }\n\n  if (String(app.SCRIPT_VERSION || '') !== EXPECTED_APP_VERSION) {\n    clearDomGuard();\n    const message = \`Recruitment Agency \${INSTALLER_VERSION} detected a mismatched runtime (\${app.SCRIPT_VERSION || 'unknown'}). Update or reinstall the userscript before continuing.\`;\n    console.error('[RA]', message);\n    alert(message);\n    return;\n  }\n\n  const restoreResizeObserver = installShellResizeGuard();\n  app.start().then(() => {\n    restoreResizeObserver();\n    enhanceShellUi(app);\n  }).catch(error => {\n    restoreResizeObserver();\n    clearDomGuard();\n    console.error(\`[RA] \${INSTALLER_VERSION} failed to start.\`, error);\n    alert(\`Recruitment Agency could not start: \${error?.message || error}\`);\n  });`;
const newBoot=`  const app = window.RA_V45App;\n  if (!app || typeof app.start !== 'function') {\n    const installedVersion = installedUserscriptVersion();\n    const runtimeVersion = 'missing';\n    console.error('[RA]', \`Recruitment Agency \${installedVersion} could not load its application module.\`);\n    showUpdateNotice({installedVersion, runtimeVersion, mismatch:true});\n    checkForUpdates({force:true, runtimeVersion, mismatch:true}).catch(() => {});\n    return;\n  }\n\n  if (String(app.SCRIPT_VERSION || '') !== EXPECTED_APP_VERSION) {\n    const installedVersion = installedUserscriptVersion();\n    const runtimeVersion = String(app.SCRIPT_VERSION || 'unknown');\n    console.error('[RA]', \`Recruitment Agency \${installedVersion} detected a mismatched runtime (\${runtimeVersion}).\`);\n    showUpdateNotice({installedVersion, runtimeVersion, mismatch:true});\n    checkForUpdates({force:true, runtimeVersion, mismatch:true}).catch(() => {});\n    return;\n  }\n\n  const restoreResizeObserver = installShellResizeGuard();\n  app.start().then(() => {\n    restoreResizeObserver();\n    enhanceShellUi(app);\n    checkForUpdates().catch(error => console.warn('[RA] update check failed.', error));\n  }).catch(error => {\n    restoreResizeObserver();\n    clearDomGuard();\n    console.error(\`[RA] \${INSTALLER_VERSION} failed to start.\`, error);\n    alert(\`Recruitment Agency could not start: \${error?.message || error}\`);\n  });`;
boot=replaceOnce(boot,oldBoot,newBoot,'bootstrap mismatch recovery');
write(bootPath,boot);

const packagePath='package.json';
let pkg=read(packagePath);
pkg=replaceOnce(pkg,'"version": "4.6.0"','"version": "4.6.1"','package version');
write(packagePath,pkg);

const staticPath='tests/userscript-static.test.js';
let staticTest=read(staticPath);
staticTest=staticTest.split('520da615d418d42524761e774f10f3ab26c28572').join(sourceSha);
staticTest=staticTest.split('4.6.0').join('4.6.1');
write(staticPath,staticTest);
