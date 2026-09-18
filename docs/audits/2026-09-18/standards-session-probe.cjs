// Current source, deterministic in-memory Prisma substitute; no configuration or database access.
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const api = path.resolve(__dirname, '../../../apps/api');
const req = createRequire(path.join(api, 'package.json'));
const ts = req('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators:true, emitDecoratorMetadata:true, esModuleInterop:true}}).outputText,file);
const {AuthService} = require(path.join(api,'src/modules/auth/auth.service.ts'));
const {UsersService} = require(path.join(api,'src/modules/users/users.service.ts'));
const {JwtStrategy} = require(path.join(api,'src/modules/auth/jwt.strategy.ts'));
async function run(action) {
  const user = {id:'probe-user', orgId:'probe-org', farmId:'probe-farm', username:'probe', fullName:'Probe', role:'SUPER_ADMIN', isActive:true};
  const crypto = require('node:crypto');
  const token = 'invented-probe-token';
  const rows = [{id:'ancestor',userId:user.id,familyId:'family',tokenHash:crypto.createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+86400000),revokedAt:null,replacedBySessionId:null}];
  const match = (row, where) => Object.entries(where).every(([k,v])=>row[k]===v);
  const tx = {user:{findFirst:async()=>({...user}),update:async({data})=>Object.assign(user,data)}, userSession:{
    findUnique:async({where})=>{const row=rows.find(r=>match(r,where));return row?{...row,user:{...user}}:null;},
    findFirst:async({where})=>{const row=rows.find(r=>r.id===where.id&&!r.revokedAt);return row?{...row,user:{...user}}:null;},
    create:async({data})=>{const row={id:'session-'+rows.length,revokedAt:null,replacedBySessionId:null,...data};rows.push(row);return row;},
    updateMany:async({where,data})=>{const selected=rows.filter(r=>match(r,where));selected.forEach(r=>Object.assign(r,data));return {count:selected.length};},
  },auditEvent:{create:async()=>({})}};
  const prisma = {...tx,$transaction:async fn=>fn(tx)};
  const auth = new AuthService(prisma,{sign:()=> 'probe-access-token'});
  const first = await auth.refresh(token);
  if(action==='logout') await auth.logout(first.refreshToken);
  if(action==='logoutAll') await auth.logoutAll(user);
  if(action==='passwordReset') await new UsersService(prisma).resetPassword(user.id,'invented-new-probe-password',user.orgId,user);
  const activeBefore=rows.filter(r=>!r.revokedAt).length;
  const replay = await auth.refresh(token);
  const latest=rows.at(-1);
  const strategy=new JwtStrategy(prisma,{get:()=> 'x'.repeat(32)});
  const accepted=await strategy.validate({sub:user.id,sid:latest.id});
  return {action,activeSessionsAfterRevocation:activeBefore,ancestorReplaySucceeded:!!replay.accessToken,newSessionAccepted:accepted.id===user.id};
}
Promise.all(['logout','logoutAll','passwordReset'].map(run)).then(results=>{
  fs.writeFileSync(path.join(__dirname,'standards-session-result.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
}).catch(e=>{console.error(e);process.exitCode=1;});
