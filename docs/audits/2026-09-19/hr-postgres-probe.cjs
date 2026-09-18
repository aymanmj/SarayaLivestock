// Evidence only: run against a migrated disposable localhost/review_release DB.
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/absent');
if (url.pathname !== '/review_release' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw Error('Refusing non-review database');
const api = path.resolve(__dirname, '../../../apps/api');
const { PrismaService } = require(path.join(api, 'dist/database/prisma.service.js'));
const { AccountingService } = require(path.join(api, 'dist/modules/accounting/accounting.service.js'));
const { PayrollService } = require(path.join(api, 'dist/modules/hr/payroll.service.js'));
const { AdvancesService } = require(path.join(api, 'dist/modules/hr/advances.service.js'));
const { EmployeesService } = require(path.join(api, 'dist/modules/hr/employees.service.js'));
const prisma = new PrismaService();
const results = [];
const log = (name, data) => { results.push({name,...data}); console.log(name, JSON.stringify(data)); };
async function fixture(label, advanceAmount=0) {
  const orgId=randomUUID(), farmId=randomUUID();
  await prisma.organization.create({data:{id:orgId,name:label}});
  await prisma.farm.create({data:{id:farmId,orgId,name:label}});
  const accounting = new AccountingService(prisma);
  await accounting.ensureAccountingStructure(farmId);
  const payroll=new PayrollService(prisma,accounting), employees=new EmployeesService(prisma), advances=new AdvancesService(prisma,accounting);
  const actor={id:randomUUID(),orgId,farmId}, year=new Date().getUTCFullYear();
  const emp=await employees.create(farmId,{employeeCode:label,firstName:'Review',lastName:label,jobTitle:'Worker',baseSalary:1000,hireDate:`${year}-01-01`},actor);
  const cash=await prisma.account.findFirstOrThrow({where:{farmId,code:'1101'}});
  const adv=advanceAmount ? await advances.requestAdvance(farmId,emp.id,{amount:advanceAmount,requestDate:`${year}-01-15`,paymentAccountId:cash.id},actor) : null;
  const generate=(month)=>payroll.generatePayroll(farmId,{startDate:`${year}-${month}-01`,endDate:`${year}-${month}-28`,monthName:month},actor);
  return {orgId,farmId,accounting,payroll,employees,advances,actor,year,emp,cash,adv,generate};
}
async function main() {
  await prisma.$connect();
  const f=await fixture('PARTIAL_FIXED',1500);
  const p1=await f.generate('01'),p2=await f.generate('02');
  await f.payroll.approvePayroll(f.farmId,p1.id,f.actor);
  await f.payroll.approvePayroll(f.farmId,p2.id,f.actor);
  const adv=await prisma.employeeAdvance.findUniqueOrThrow({where:{id:f.adv.id}});
  const slip=await prisma.payrollSlip.findFirstOrThrow({where:{periodId:p2.id}});
  assert.equal(Number(adv.settledAmount),1500); assert.equal(Number(slip.netSalary),500);
  log('PARTIAL_DOUBLE_DRAFT_FIXED',{settled:1500,secondNet:500});
  const auditBeforeZero=await prisma.auditEvent.count({where:{farmId:f.farmId}});
  const zero=await f.payroll.payPayroll(f.farmId,p1.id,{paymentAccountId:f.cash.id},f.actor);
  assert.equal(zero.status,'PAID');
  log('ZERO_NET_FIXED',{status:zero.status,journals:await prisma.journalEntry.count({where:{referenceId:p1.id}}),newAuditEvents:(await prisma.auditEvent.count({where:{farmId:f.farmId}}))-auditBeforeZero});
  const concurrent=await Promise.allSettled([f.payroll.payPayroll(f.farmId,p2.id,{paymentAccountId:f.cash.id},f.actor),f.payroll.payPayroll(f.farmId,p2.id,{paymentAccountId:f.cash.id},f.actor)]);
  assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(await prisma.journalEntry.count({where:{referenceId:p2.id}}),2);
  log('CONCURRENT_PAYMENT_FIXED',{statuses:concurrent.map(x=>x.status),journals:2});

  const d=await fixture('FULLY_CONSUMED',500);
  const a=await d.generate('01'),b=await d.generate('02');
  await d.payroll.approvePayroll(d.farmId,a.id,d.actor);
  await d.payroll.approvePayroll(d.farmId,b.id,d.actor);
  const stale=await prisma.payrollSlip.findFirstOrThrow({where:{periodId:b.id}});
  const account=await prisma.account.findFirstOrThrow({where:{farmId:d.farmId,code:'1106'}});
  assert.equal(Number(account.currentBalance),-500);
  log('FULLY_CONSUMED_DRAFT_BUG',{originalAdvance:500,secondDeduction:Number(stale.advancesSettled),secondNet:Number(stale.netSalary),ledgerBalance:Number(account.currentBalance),reservations:await prisma.advanceSettlement.count({where:{periodId:b.id}})});

  const r=await fixture('DELETE_RACE');
  const rp=await r.generate('01');
  let readDone,continueDelete;
  const readSignal=new Promise(resolve=>readDone=resolve),gate=new Promise(resolve=>continueDelete=resolve);
  // Pause DELETE after its non-locking read, then commit approval before continuing DELETE.
  const gated={$transaction:callback=>prisma.$transaction(tx=>callback(new Proxy(tx,{get(target,key){
    if(key==='payrollPeriod')return new Proxy(target.payrollPeriod,{get(model,method){
      if(method==='findFirst')return async args=>{const row=await model.findFirst(args);readDone();await gate;return row;};
      const value=model[method];return typeof value==='function'?value.bind(model):value;
    }});
    const value=target[key];return typeof value==='function'?value.bind(target):value;
  }})),{timeout:15000})};
  const deleting=new PayrollService(gated,r.accounting).deleteDraft(r.farmId,rp.id,r.actor);
  await readSignal;
  try { await r.payroll.approvePayroll(r.farmId,rp.id,r.actor); } finally {continueDelete();}
  await deleting;
  const exists=await prisma.payrollPeriod.count({where:{id:rp.id}}),journals=await prisma.journalEntry.count({where:{referenceId:rp.id}});
  assert.equal(exists,0);assert.equal(journals,1);
  log('DELETE_APPROVED_RACE_BUG',{periodExists:exists,journals,slips:await prisma.payrollSlip.count({where:{periodId:rp.id}})});

  const legacy=await fixture('LEGACY_DRAFT',1500);
  const lp=await legacy.generate('01');
  // Reconstruct phase-1 persisted data: draft deducted 1000 but marked entire1500 settled.
  await prisma.advanceSettlement.deleteMany({where:{periodId:lp.id}});
  await prisma.employeeAdvance.update({where:{id:legacy.adv.id},data:{isSettled:true,settledPeriodId:lp.id,settledAmount:0}});
  // Run the actual data-reconciliation SQL from the new migration (constraints already installed).
  const sql=require('node:fs').readFileSync(path.join(api,'prisma/migrations/20260918120000_hr_advance_integrity/migration.sql'),'utf8');
  for(const statement of sql.split(';').filter(x=>/UPDATE/.test(x)))await prisma.$executeRawUnsafe(statement);
  await legacy.payroll.deleteDraft(legacy.farmId,lp.id,legacy.actor);
  const la=await prisma.employeeAdvance.findUniqueOrThrow({where:{id:legacy.adv.id}});
  const ledger=await prisma.account.findFirstOrThrow({where:{farmId:legacy.farmId,code:'1106'}});
  assert.equal(la.isSettled,true); assert.equal(Number(la.settledAmount),1500);assert.equal(Number(ledger.currentBalance),1500);
  log('LEGACY_DRAFT_MIGRATION_BUG',{advanceOpen:false,settledAmount:Number(la.settledAmount),ledgerReceivable:Number(ledger.currentBalance)});
  console.log('HR_RECHECK_COMPLETED',JSON.stringify(results));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.onModuleDestroy());

