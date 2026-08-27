import fs from 'node:fs';

const SOURCE='9475f00745f81173a114bb87451f654769b3d32a';
const OLD_SOURCE='999a2f9eafd28891dc5de461f08b1d29bbd41eea';

function read(file){return fs.readFileSync(file,'utf8');}
function write(file,text){fs.writeFileSync(file,text);}
function exactly(text,needle,count,label){const actual=text.split(needle).length-1;if(actual!==count)throw new Error(`${label}: expected ${count}, got ${actual}`);}

let user=read('R4G3RUNN3R-Recruitment-Agency.user.js');
exactly(user,'// @version      4.7.5',1,'metadata version');
exactly(user,OLD_SOURCE,29,'immutable requires');
exactly(user,"const INSTALLER_VERSION = '4.7.5';",1,'installer version');
exactly(user,"const EXPECTED_APP_VERSION = '4.7.4';",1,'expected app version');
user=user.replace('// @version      4.7.5','// @version      4.7.6')
  .split(OLD_SOURCE).join(SOURCE)
  .replace("const INSTALLER_VERSION = '4.7.5';","const INSTALLER_VERSION = '4.7.6';")
  .replace("const EXPECTED_APP_VERSION = '4.7.4';","const EXPECTED_APP_VERSION = '4.7.6';");
write('R4G3RUNN3R-Recruitment-Agency.user.js',user);

let staticTest=read('tests/userscript-static.test.js');
staticTest=staticTest.split(OLD_SOURCE).join(SOURCE);
staticTest=staticTest.split('v4.7.5').join('v4.7.6');
staticTest=staticTest.replace("EXPECTED_APP_VERSION\\s*=\\s*'4\\.7\\.4'","EXPECTED_APP_VERSION\\s*=\\s*'4\\.7\\.6'");
staticTest=staticTest.replace('immutable reviewed v4.7.4 core requires','immutable v4.7.6 core requires');
write('tests/userscript-static.test.js',staticTest);

fs.mkdirSync('docs/releases',{recursive:true});
write('docs/releases/v4.7.6-private-chat-recruit.md',`# v4.7.6 - Private-chat Recruit workflow\n\nDate: 27 August 2026\n\n## Scope\n\nv4.7.6 adds one clear Recruit action to Company and Faction candidate rows. It uses a fresh official Torn v2 lookup before contact preparation, keeps Company and Faction templates separate, and targets Torn private chat rather than Torn Messages/Mail.\n\nCompany Recruit checks the target's current job/company. Faction Recruit checks current faction membership. If the target already belongs to the relevant organization type, recruitment stops and reports the current membership.\n\n## Templates\n\nCompany placeholders: {name}, {company_name}, {company_type}.\nFaction placeholders: {name}, {faction_name}.\n\nBoth default templates are editable and persisted locally.\n\n## Private-chat safety\n\nFor an eligible player, Recruit opens the target profile, opens the Torn private-chat surface, inserts the prepared text, and focuses the chat input. The player still performs the final Torn Send action. The script does not click Send, synthesize Enter, auto-submit a chat, or change recruitment stage merely because a draft was prepared. Existing Do Not Contact protections and deliberate overrides remain in force.\n\n## Verification evidence\n\nRED: GitHub Actions run 33024574809 executed 290 tests. The pre-feature application passed the existing 284 tests and failed exactly the six new Recruit regression tests.\n\nGREEN source: run 33025320900 passed 290/290 tests plus JavaScript syntax.\n\nGREEN browser: run 33025440319 passed 291/291 tests plus JavaScript syntax. The added real-Chrome synthetic Torn profile regression opened a private-chat surface, filled the expected draft, focused the chat input, and asserted zero Send clicks and zero Enter submissions.\n\nImmutable v4.7.6 source commit: ${SOURCE}.\n\n## Data and architecture\n\nDB15 is unchanged. No user-data reset or migration is required. Company and Faction recruitment workflow state remain isolated. Shared Player Intelligence and the Global Intelligence privacy whitelist are unchanged. Official Torn v2 calls continue through the shared scheduler.\n\nLive confirmation against Torn's current production chat DOM remains a post-release validation step; synthetic real-Chrome behavior is verified.\n`);

console.log('Published v4.7.6 wrapper and release contract around immutable source '+SOURCE);
