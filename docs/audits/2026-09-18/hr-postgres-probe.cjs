// Run only on the disposable, migrated review_release PostgreSQL database.
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/absent');
if (url.pathname !== '/review_release' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
  throw new Error('Refusing database other than localhost/review_release');
}
const api = path.resolve(__dirname, '../../../apps/api');
const { PrismaService } = require(path.join(api, 'dist/database/prisma.service.js'));
const { AccountingService } = require(path.join(api, 'dist/modules/accounting/accounting.service.js'));
const { PayrollService } = require(path.join(api, 'dist/modules/hr/payroll.service.js'));
const { AdvancesService } = require(path.join(api, 'dist/modules/hr/advances.service.js'));
const { EmployeesService } = require(path.join(api, 'dist/modules/hr/employees.service.js'));
const prisma = new PrismaService();
async function main() {
  await prisma.$connect();
  const orgId = randomUUID(), farmId = randomUUID();
  await prisma.organization.create({data:{id:orgId,name:'Disposable HR review'}});
  await prisma.farm.create({data:{id:farmId,orgId,name:'Disposable HR review'}});
  const accounting = new AccountingService(prisma);
  await accounting.ensureAccountingStructure(farmId);
  const advances = new AdvancesService(prisma, accounting);
  const payroll = new PayrollService(prisma, accounting);
  const employees = new EmployeesService(prisma);
  const actor = {id:randomUUID(),orgId,farmId};
  const year = new Date().getUTCFullYear();
  const employeeDto = code => ({employeeCode:code,firstName:'Review',lastName:code,jobTitle:'Worker',baseSalary:1000,hireDate:`${year}-01-01`});
  const emp = await employees.create(farmId, employeeDto('OVERADVANCE'));
  const cash = await prisma.account.findFirstOrThrow({where:{farmId,code:'1101'}});
  assert.equal(await prisma.account.count({where:{farmId,code:'1106'}}),0);
  let firstError;
  try { await advances.requestAdvance(farmId,emp.id,{amount:1500,requestDate:`${year}-01-15`,paymentAccountId:cash.id},actor); }
  catch (error) { firstError = {name:error.name,message:error.message,status:error.getStatus?.()}; }
  assert.ok(firstError, 'Expected first advance to fail when account 1106 is uncommitted');
  assert.equal(await prisma.employeeAdvance.count({where:{employeeId:emp.id}}),0);
  console.log('FIRST_ADVANCE',JSON.stringify(firstError));
  await prisma.account.create({data:{farmId,code:'1106',name:'Advance workaround for remaining probes',category:'ASSET',isActive:true,isSystemLocked:true}});
  const adv = await advances.requestAdvance(farmId,emp.id,{amount:1500,requestDate:`${year}-01-15`,paymentAccountId:cash.id},actor);
  const period = await payroll.generatePayroll(farmId,{startDate:`${year}-01-01`,endDate:`${year}-01-31`,monthName:'January'},actor);
  const slip = await prisma.payrollSlip.findFirstOrThrow({where:{periodId:period.id}});
  const settled = await prisma.employeeAdvance.findUniqueOrThrow({where:{id:adv.id}});
  assert.equal(Number(slip.advancesSettled),1000);
  assert.equal(settled.isSettled,true);
  await payroll.approvePayroll(farmId,period.id,actor);
  const receivable = await prisma.account.findFirstOrThrow({where:{farmId,code:'1106'}});
  assert.equal(Number(receivable.currentBalance),500);
  assert.equal(await prisma.employeeAdvance.count({where:{employeeId:emp.id,isSettled:false}}),0);
  console.log('EXCESS_ADVANCE',JSON.stringify({advance:1500,deduction:Number(slip.advancesSettled),generalLedgerReceivable:Number(receivable.currentBalance),unsettledAdvanceCount:0,settledWhileDraft:true}));
  const deletedEmp = await employees.create(farmId,employeeDto('DELETE_WITH_ADVANCE'));
  const deleteAdv = await advances.requestAdvance(farmId,deletedEmp.id,{amount:250,requestDate:`${year}-02-15`,paymentAccountId:cash.id},actor);
  await employees.remove(farmId,deletedEmp.id);
  assert.equal(await prisma.employeeAdvance.count({where:{id:deleteAdv.id}}),0);
  assert.equal(await prisma.journalEntry.count({where:{id:deleteAdv.journalEntryId}}),1);
  console.log('DELETE_ADVANCE',JSON.stringify({employeeDeleted:true,advanceDeleted:true,postedJournalStillExists:true,amount:250}));
  console.log('HR_POSTGRES_PROBES_COMPLETED');
}
main().catch(error => {console.error(error);process.exitCode=1;}).finally(() => prisma.onModuleDestroy());
