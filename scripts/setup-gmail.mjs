// Import Google's downloaded OAuth JSON without printing credentials.
import { readFileSync,writeFileSync,existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
const file=process.argv[2]
if(!file){console.error('Usage: node scripts/setup-gmail.mjs <path-to-google-json>');process.exit(1)}
const w=JSON.parse(readFileSync(file,'utf8')).web,redirect='http://localhost:5173/api/gmail/callback'
if(!w?.client_id||!w.client_secret||!w.redirect_uris?.includes(redirect))throw Error('Invalid web OAuth credentials or localhost redirect missing.')
const path='.env.local',old=existsSync(path)?readFileSync(path,'utf8'):''
const key=/^GMAIL_TOKEN_ENCRYPTION_KEY=([0-9a-f]{64})\s*$/mi.exec(old)?.[1]||randomBytes(32).toString('hex')
const entries={GOOGLE_OAUTH_CLIENT_ID:w.client_id,GOOGLE_OAUTH_CLIENT_SECRET:w.client_secret,GOOGLE_OAUTH_REDIRECT_URI:redirect,GMAIL_TOKEN_ENCRYPTION_KEY:key,GMAIL_ALLOWED_EMAIL:'gotoward7@gmail.com'}
if(Object.values(entries).some(v=>typeof v!=='string'||/[\r\n]/.test(v)))throw Error('Invalid OAuth values.')
const content=old.split(/\r?\n/).filter(line=>!Object.keys(entries).some(k=>new RegExp('^\\s*(?:export\\s+)?'+k+'\\s*=').test(line))).join('\n').trimEnd()
writeFileSync(path,content+'\n\n'+Object.entries(entries).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600})
console.log('Gmail configuration saved in .env.local. Restart npm run dev; then connect Gmail in /admin/live.')
