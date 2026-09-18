// Review evidence: real PostgreSQL transactions; only execution scheduling is controlled.
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const {randomUUID, createHash} = require('node:crypto');
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/absent');
if (url.pathname !== '/review_release' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw Error('Refusing non-review database');
const api=path.resolve(__dirname,'../../../apps/api');
const {PrismaService}=require(path.join(api,'dist/database/prisma.service.js'));
const {AuthService}=require(path.join(api,'dist/modules/auth/auth.service.js'));
const {UsersService}=require(path.join(api,'dist/modules/users/users.service.js'));
const {JwtStrategy}=require(path.join(api,'dist/modules/auth/jwt.strategy.js'));
const {FarmsService}=require(path.join(api,'dist/modules/farms/farms.service.js'));
const prisma=new PrismaService();
const jwt={sign:payload=>JSON.stringify(payload)};
const auth=new AuthService(prisma,jwt);
const results=[];
async function fixture(){
 const org=await prisma.organization.create({data:{name:'Security review'}});
 const farm=await prisma.farm.create({data:{orgId:org.id,name:'Security review'}});
 const user=await prisma.user.create({data:{orgId:org.id,farmId:farm.id,username:'review-'+randomUUID(),password:'synthetic-disabled-login',fullName:'Review',role:'FARM_MANAGER'}});
 const token=randomUUID();
 await prisma.userSession.create({data:{userId:user.id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+86400000)}});
 const first=await auth.refresh(token);
 return {user,token,first};
}
async function sequential(action){
 const f=await fixture();
 if(action==='logout')await auth.logout(f.first.refreshToken);
 if(action==='logoutAll')await auth.logoutAll(f.user);
 if(action==='roleChange')await new UsersService(prisma).updateRole(f.user.id,'WORKER',f.user.orgId,f.user);
 if(action==='passwordReset')await new UsersService(prisma).resetPassword(f.user.id,'synthetic-new-password-1234',f.user.orgId,f.user);
 let status=200;try{await auth.refresh(f.token);}catch(e){status=e.getStatus?.()||500;}
 assert.equal(status,401);
 results.push({action,status,active:await prisma.userSession.count({where:{userId:f.user.id,revokedAt:null}})});
}
async function race(){
 const f=await fixture();let activeAfterLogout;
 // Audit insertion occurs after BOTH revocation reads. Pause refresh there while
 // the real logout commits. Its UPDATE cannot see the uncommitted new session.
 const gated={$transaction:callback=>prisma.$transaction(tx=>callback(new Proxy(tx,{get(target,key){
  if(key!=='auditEvent')return target[key];
  return new Proxy(target.auditEvent,{get(model,method){
   if(method!=='create')return model[method];
   return async args=>{
    if(args.data.action==='identity.session.refreshed'){
     await auth.logout(f.first.refreshToken);
     activeAfterLogout=await prisma.userSession.count({where:{userId:f.user.id,revokedAt:null}});
    }
    return model.create(args);
   };
  }});
 }})),{timeout:15000})};
 const refreshed=await new AuthService(gated,jwt).refresh(f.token);
 const payload=JSON.parse(refreshed.accessToken);
 const accepted=await new JwtStrategy(prisma,{get:()=> 'x'.repeat(32)}).validate(payload);
 const activeAfterRefresh=await prisma.userSession.count({where:{userId:f.user.id,revokedAt:null}});
 assert.equal(activeAfterLogout,0);assert.equal(activeAfterRefresh,1);assert.equal(accepted.id,f.user.id);
 results.push({action:'logoutAfterFinalCheckBeforeRefreshCommit',activeAfterLogout,activeAfterRefresh,jwtAccepted:true});
}
async function farmScope(){
 const own=await fixture(),foreign=await fixture();
 const svc=new FarmsService(prisma);
 for(const role of ['FARM_MANAGER','SUPER_ADMIN']){
  let status=200;try{await svc.update(foreign.user.farmId,{name:'Unexpected modification'},{...own.user,role});}catch(e){status=e.getStatus?.()||500;}
  assert.equal(status,404);results.push({action:'foreignFarmUpdate',role,status});
 }
}
(async()=>{
 await prisma.$connect();
 for(const action of ['logout','logoutAll','roleChange','passwordReset'])await sequential(action);
 await farmScope();await race();
 fs.writeFileSync(path.join(__dirname,'security-postgres-result.json'),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
})().then(async()=>{await prisma.$disconnect();process.exit(0);},async e=>{console.error(e);await prisma.$disconnect();process.exit(1);});
