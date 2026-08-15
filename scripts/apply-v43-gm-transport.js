const fs = require('node:fs');
const file = 'R4G3RUNN3R-Recruitment-Agency.user.js';
let s = fs.readFileSync(file, 'utf8');

function replaceOnce(from, to, label) {
  if (!s.includes(from)) throw new Error('Missing patch target: ' + label);
  s = s.replace(from, to);
}

replaceOnce(
  '// @grant        none\n',
  '// @grant        GM_xmlhttpRequest\n// @connect      script.google.com\n// @connect      script.googleusercontent.com\n',
  'userscript grants'
);

replaceOnce(
`    async function globalJson(url, options = {}) {
        const response = await fetch(url, {redirect:"follow", cache:"no-store", ...options});
        if (!response.ok) throw new Error("Global service HTTP " + response.status);
        const text = await response.text();
        try { return JSON.parse(text); } catch { throw new Error("Global service returned invalid JSON"); }
    }
`,
`    async function globalJson(url, options = {}) {
        const method = String(options.method || "GET").toUpperCase();
        const body = options.body == null ? null : String(options.body);
        const headers = {...(options.headers || {})};
        if (typeof GM_xmlhttpRequest === "function") {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method,
                    url,
                    headers,
                    data: body,
                    anonymous: true,
                    timeout: 15000,
                    onload: response => {
                        const status = Number(response.status || 0);
                        if (status < 200 || status >= 300) return reject(new Error("Global service HTTP " + status));
                        try { resolve(JSON.parse(String(response.responseText || ""))); }
                        catch { reject(new Error("Global service returned invalid JSON")); }
                    },
                    ontimeout: () => reject(new Error("Global service timed out")),
                    onerror: () => reject(new Error("Global service request failed"))
                });
            });
        }
        const response = await fetch(url, {redirect:"follow", cache:"no-store", method, headers, body});
        if (!response.ok) throw new Error("Global service HTTP " + response.status);
        const text = await response.text();
        try { return JSON.parse(text); } catch { throw new Error("Global service returned invalid JSON"); }
    }
`,
  'global JSON transport'
);

fs.writeFileSync(file, s);
console.log('Applied v4.3 GM cross-origin transport patch.');
