// Isolated source-level integration: actual controller, guard and interceptor; fake persistence only.
const fs=require('node:fs'),path=require('node:path');
const api=path.resolve(__dirname,'../../../apps/api');
const req=require('node:module').createRequire(path.join(api,'package.json'));
const ts=req('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,f);
const load=p=>require(path.join(api,'src',p));
const {Reflector}=req('@nestjs/core');
const {lastValueFrom,from}=req('rxjs');
const {FarmsController}=load('modules/farms/farms.controller.ts');
const {FarmsService}=load('modules/farms/farms.service.ts');
const {EmployeesController}=load('modules/hr/employees.controller.ts');
const {EmployeesService}=load('modules/hr/employees.service.ts');
const {RolesGuard}=load('modules/auth/roles.guard.ts');
const {AuditInterceptor}=load('common/audit/audit.interceptor.ts');
async function main(){
  let audits=0;
  const otherFarm={id:'foreign-farm',orgId:'foreign-org',name:'Before'};
  const user={id:'manager',orgId:'own-org',farmId:'own-farm',role:'FARM_MANAGER'};
  const prisma={farm:{findUnique:async({where})=>where.id===otherFarm.id?otherFarm:null,update:async({data})=>Object.assign(otherFarm,data)},employee:{findUnique:async()=>null,create:async({data})=>({id:'employee',...data})}};
  const reflector=new Reflector();
  const audit=new AuditInterceptor({append:async()=>{audits++;}},reflector);
  const guard=new RolesGuard(reflector);
  async function invoke(controller,method,call,verb){
    const ctx={getType:()=> 'http',getHandler:()=>controller[method],getClass:()=>controller.constructor,switchToHttp:()=>({getRequest:()=>({user,method:verb}),getResponse:()=>({statusCode:200})})};
    if(!guard.canActivate(ctx))throw new Error('guard denied');
    return lastValueFrom(audit.intercept(ctx,{handle:()=>from(call())}));
  }
  const farms=new FarmsController(new FarmsService(prisma));
  await invoke(farms,'update',()=>farms.update(otherFarm.id,{name:'Changed across organization'}),'PATCH');
  const employees=new EmployeesController(new EmployeesService(prisma));
  await invoke(employees,'create',()=>employees.create(user,{employeeCode:'P1',hireDate:'2026-09-18',firstName:'Probe',lastName:'Employee',baseSalary:1000}),'POST');
  const result={foreignOrganizationFarmModified:otherFarm.name==='Changed across organization',employeeCreated:true,auditEvents:audits};
  fs.writeFileSync(path.join(__dirname,'standards-farm-audit-result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
