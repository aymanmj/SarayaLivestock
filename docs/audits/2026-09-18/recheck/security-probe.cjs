// Current source with deterministic in-memory persistence, no database/configuration access.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=path.resolve(__dirname,'../../../../apps/api');
const req=require('node:module').createRequire(path.join(api,'package.json'));
const ts=req('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,f);
const load=p=>require(path.join(api,'src',p));
const {AuthService}=load('modules/auth/auth.service.ts');
const {UsersService}=load('modules/users/users.service.ts');
const {JwtStrategy}=load('modules/auth/jwt.strategy.ts');
const {FarmsService}=load('modules/farms/farms.service.ts');
const {EmployeesService}=load('modules/hr/employees.service.ts');
const {PayrollService}=load('modules/hr/payroll.service.ts');
const match=(r,w)=>Object.entries(w).every(([k,v])=>k==='OR'?v.some(x=>match(r,x)):v&&typeof v==='object'&&!(v instanceof Date)?('in'in v?v.in.includes(r[k]):'gt'in v?r[k]>v.gt:false):r[k]===v);
async function sessions(action){
 const user={id:'user',orgId:'org',farmId:'farm',role:'FARM_MANAGER',isActive:true};
 const token='synthetic-probe-token';
 const rows=[{id:'ancestor',userId:user.id,familyId:'family',tokenHash:crypto.createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+86400000),revokedAt:null,replacedBySessionId:null}];
 let beforeCreate;
 const tx={user:{findFirst:async()=>({...user}),update:async({data})=>Object.assign(user,data)},userSession:{
  findUnique:async({where})=>{const r=rows.find(r=>match(r,where));return r?{...r,user:{...user}}:null;},
  findFirst:async({where})=>{const r=rows.find(r=>match(r,where));return r?{...r,user:{...user}}:null;},
  create:async({data})=>{if(beforeCreate){const hook=beforeCreate;beforeCreate=null;await hook();}const r={id:'s'+rows.length,revokedAt:null,replacedBySessionId:null,...data};rows.push(r);return r;},
  updateMany:async({where,data})=>{const selected=rows.filter(r=>match(r,where));selected.forEach(r=>Object.assign(r,data));return {count:selected.length};}
 },auditEvent:{create:async()=>({})}};
 const prisma={...tx,$transaction:async fn=>fn(tx)};
 const auth=new AuthService(prisma,{sign:()=> 'synthetic-access-token'});
 const first=await auth.refresh(token);
 const users=new UsersService(prisma);
 if(action==='logout')await auth.logout(first.refreshToken);
 if(action==='logoutAll')await auth.logoutAll(user);
 if(action==='passwordReset')await users.resetPassword(user.id,'synthetic-password-1234',user.orgId,user);
 if(action==='roleChange')await users.updateRole(user.id,'WORKER',user.orgId,user);
 if(action==='concurrentLogout')beforeCreate=()=>auth.logout(first.refreshToken);
 let accepted=false,status;
 try{await auth.refresh(token);const strategy=new JwtStrategy(prisma,{get:()=> 'x'.repeat(32)});await strategy.validate({sub:user.id,sid:rows.at(-1).id});accepted=true;status=200;}catch(e){status=e.getStatus?.()??e.message;}
 return {action,ancestorReplayAcceptedByJwt:accepted,status,activeSessions:rows.filter(r=>!r.revokedAt).length};
}
async function farms(role){
 const row={id:'foreign-farm',orgId:'foreign-org',name:'Before'},audits=[];
 const tx={farm:{findFirst:async({where})=>match(row,where)?row:null,update:async({data})=>Object.assign(row,data)},auditEvent:{create:async({data})=>{audits.push(data);return data;}}};
 const service=new FarmsService({$transaction:async fn=>fn(tx)});
 let status=200;try{await service.update(row.id,{name:'After'},{id:'user',orgId:'own-org',farmId:'own-farm',role});}catch(e){status=e.getStatus?.()??e.message;}
 return {role,status,foreignFarmModified:row.name==='After',auditOrgId:audits[0]?.orgId};
}
async function employeeAudit(){
 const audits=[];let rows=[];
 const tx={employee:{findUnique:async()=>null,findFirst:async()=>rows[0],create:async({data})=>{const r={id:'e',...data};rows.push(r);return r;},update:async({data})=>Object.assign(rows[0],data),delete:async()=>rows.pop()},employeeAdvance:{count:async()=>0},payrollSlip:{count:async()=>0},auditEvent:{create:async({data})=>{audits.push(data);return data;}}};
 const svc=new EmployeesService({$transaction:async fn=>fn(tx)}),actor={id:'user',orgId:'org',farmId:'farm'};
 await svc.create('farm',{employeeCode:'E',baseSalary:1000,hireDate:'2026-09-18'},actor);
 await svc.update('farm','e',{baseSalary:1200},actor);
 await svc.remove('farm','e',actor);
 return audits.map(x=>x.action);
}
async function payrollAudit(){
 let audits=0;const row={id:'period',farmId:'farm',status:'DRAFT'};
 const tx={fiscalPeriod:{findFirst:async()=>({id:'fiscal'})},employee:{findMany:async()=>[{id:'e',baseSalary:new (req('@prisma/client').Prisma.Decimal)(1000),advances:[]}]},payrollPeriod:{create:async()=>row,findFirst:async()=>row,delete:async()=>row},payrollSlip:{create:async()=>({})},advanceSettlement:{deleteMany:async()=>({count:0})},auditEvent:{create:async()=>{audits++;return {};}}};
 const svc=new PayrollService({$transaction:async fn=>fn(tx)},{});
 await svc.generatePayroll('farm',{monthName:'September',startDate:'2026-09-01',endDate:'2026-09-30'},{id:'user',orgId:'org',farmId:'farm'});
 await svc.deleteDraft('farm',row.id);
 return {generatedAndDeleted:true,auditEvents:audits};
}
(async()=>{const result={sessions:await Promise.all(['logout','logoutAll','passwordReset','roleChange','concurrentLogout'].map(sessions)),farms:await Promise.all(['FARM_MANAGER','SUPER_ADMIN'].map(farms)),employeeAudit:await employeeAudit(),payrollAudit:await payrollAudit()};fs.writeFileSync(path.join(__dirname,'security-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});
