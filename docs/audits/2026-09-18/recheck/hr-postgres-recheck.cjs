// Evidence only: run against a migrated disposable localhost/review_release DB.
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/absent');
if (url.pathname !== '/review_release' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw Error('Refusing non-review database');
const api = path.resolve(__dirname, '../../../../apps/api');
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
  const f=await fixture('FIXED',1500);
  assert.ok(f.adv.journalEntryId);
  log('FIRST_ADVANCE_FIXED',{created:true,amount:1500});
  const p=await f.generate('01');
  let a=await prisma.employeeAdvance.findUniqueOrThrow({where:{id:f.adv.id}});
  assert.equal(a.isSettled,false); assert.equal(Number(a.settledAmount),0);
  await f.payroll.approvePayroll(f.farmId,p.id,f.actor);
  a=await prisma.employeeAdvance.findUniqueOrThrow({where:{id:f.adv.id}});
  assert.equal(Number(a.settledAmount),1000); assert.equal(a.isSettled,false);
  log('EXCESS_ADVANCE_SINGLE_DRAFT_FIXED',{settledAmount:Number(a.settledAmount),remaining:500,isSettled:a.isSettled});
  let zeroNetError;
  try { await f.payroll.payPayroll(f.farmId,p.id,{paymentAccountId:f.cash.id},f.actor); }
  catch(error) { zeroNetError={message:error.message,status:error.getStatus?.()}; }
  log('ZERO_NET_PAYMENT',{error:zeroNetError || null,status:(await prisma.payrollPeriod.findUniqueOrThrow({where:{id:p.id}})).status});
  await f.employees.remove(f.farmId,f.emp.id,f.actor);
  assert.equal(await prisma.employeeAdvance.count({where:{id:f.adv.id}}),1);
  assert.equal((await prisma.employee.findUniqueOrThrow({where:{id:f.emp.id}})).status,'TERMINATED');
  log('DELETE_PROTECTION_FIXED',{employeeTerminated:true,advancePreserved:true});

  const d=await fixture('DOUBLE_DRAFT',1500);
  const p1=await d.generate('01'), p2=await d.generate('02');
  await d.payroll.approvePayroll(d.farmId,p1.id,d.actor);
  await d.payroll.approvePayroll(d.farmId,p2.id,d.actor);
  const double=await prisma.employeeAdvance.findUniqueOrThrow({where:{id:d.adv.id}});
  const ledger=await prisma.account.findFirstOrThrow({where:{farmId:d.farmId,code:'1106'}});
  assert.equal(Number(double.settledAmount),2000); assert.equal(Number(ledger.currentBalance),-500);
  log('DOUBLE_DRAFT_BUG',{originalAdvance:1500,settledAmount:Number(double.settledAmount),ledgerBalance:Number(ledger.currentBalance)});

  const c=await fixture('CONCURRENT');
  const cp=await c.generate('01'); await c.payroll.approvePayroll(c.farmId,cp.id,c.actor);
  let arrived=0, release;
  const barrier=new Promise(resolve=>release=resolve);
  // Coordinate only the initial reads; all data operations/transactions are real PostgreSQL.
  const gated={$transaction:callback=>prisma.$transaction(tx=>callback(new Proxy(tx,{get(target,key){
    if(key==='payrollPeriod') return new Proxy(target.payrollPeriod,{get(model,method){
      if(method==='findFirst') return async args=>{const row=await model.findFirst(args); if(++arrived===2)release(); await barrier; return row;};
      const value=model[method]; return typeof value==='function'?value.bind(model):value;
    }});
    const value=target[key]; return typeof value==='function'?value.bind(target):value;
  }})),{timeout:15000})};
  const concurrent=new PayrollService(gated,c.accounting);
  const paid=await Promise.allSettled([concurrent.payPayroll(c.farmId,cp.id,{paymentAccountId:c.cash.id},c.actor),concurrent.payPayroll(c.farmId,cp.id,{paymentAccountId:c.cash.id},c.actor)]);
  const journalCount=await prisma.journalEntry.count({where:{farmId:c.farmId,referenceId:cp.id}});
  log('CONCURRENT_PAYMENT',{statuses:paid.map(x=>x.status),errors:paid.filter(x=>x.status==='rejected').map(x=>String(x.reason)),journalsIncludingAccrual:journalCount});
  assert.equal(journalCount,3,'Expected reproduction of duplicate payment');
  console.log('HR_RECHECK_COMPLETED',JSON.stringify(results));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.onModuleDestroy());
