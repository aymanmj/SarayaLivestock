import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const contract = JSON.parse(await readFile(resolve(process.cwd(), 'openapi/saraya.openapi.json'), 'utf8'));
const operationIds = new Set();
let operations = 0;
let idempotentOperations = 0;

const verifiedResponseDtoOperations = new Set();

for (const [path, pathItem] of Object.entries(contract.paths ?? {})) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const operation = pathItem?.[method];
    if (!operation) continue;
    operations += 1;
    if (!operation.operationId || operationIds.has(operation.operationId)) {
      throw new Error(`Missing or duplicate operationId at ${method.toUpperCase()} ${path}`);
    }
    operationIds.add(operation.operationId);

    const successResponse = Object.entries(operation.responses ?? {})
      .find(([status]) => /^2\d\d$/.test(status))?.[1];
    const schema = successResponse?.content?.['application/json']?.schema;
    const arrayItems = schema?.type === 'array' ? schema.items : undefined;
    const hasNamedDto = typeof schema?.$ref === 'string'
      || typeof arrayItems?.$ref === 'string'
      || (Array.isArray(arrayItems?.oneOf)
        && arrayItems.oneOf.length > 0
        && arrayItems.oneOf.every(item => typeof item?.$ref === 'string'));
    if (!hasNamedDto) {
      throw new Error(`Every operation must expose a named success response DTO: ${operation.operationId}`);
    }
    verifiedResponseDtoOperations.add(operation.operationId);

    const idempotency = (operation.parameters ?? []).find(parameter => parameter?.name === 'Idempotency-Key');
    if (idempotency) {
      if (idempotency.in !== 'header' || idempotency.required !== true || idempotency.schema?.format !== 'uuid') {
        throw new Error(`Invalid Idempotency-Key contract at ${method.toUpperCase()} ${path}`);
      }
      idempotentOperations += 1;
    }
  }
}

if (operations < 58) throw new Error(`OpenAPI operation count unexpectedly decreased: ${operations}`);
if (verifiedResponseDtoOperations.size !== operations) {
  throw new Error(`Expected every operation to have a typed response: ${verifiedResponseDtoOperations.size}/${operations}`);
}
if (idempotentOperations !== 26) {
  throw new Error(`Expected 26 idempotent operations, found ${idempotentOperations}`);
}

for (const [name, schema] of Object.entries(contract.components?.schemas ?? {})) {
  if (schema?.type === 'object' && Object.keys(schema.properties ?? {}).length === 0) {
    throw new Error(`Empty object schema is forbidden: ${name}`);
  }
}

const schemas = contract.components?.schemas ?? {};
const decimalStrings = [
  ['AnimalRecordResponseDto', 'entryWeightKg'],
  ['AnimalRecordResponseDto', 'purchasePrice'],
  ['AccountResponseDto', 'currentBalance'],
  ['JournalEntryResponseDto', 'totalDebit'],
  ['JournalEntryResponseDto', 'totalCredit'],
  ['JournalEntryLineResponseDto', 'debit'],
  ['JournalEntryLineResponseDto', 'credit'],
  ['MilkLogResponseDto', 'yieldLiters'],
  ['MilkLogResponseDto', 'fatPct'],
  ['MilkLogResponseDto', 'proteinPct'],
  ['HealthTreatmentResponseDto', 'treatmentCost'],
  ['FeedIngredientResponseDto', 'currentStock'],
  ['FeedIngredientResponseDto', 'minStockAlert'],
  ['FeedIngredientResponseDto', 'costPerUnit'],
  ['FeedFormulaItemResponseDto', 'percentage'],
  ['FeedDistributionRecordResponseDto', 'quantityKg'],
  ['FeedDistributionRecordResponseDto', 'totalCost'],
  ['CommercialSaleResponseDto', 'totalAmount'],
  ['AnimalMortalityResponseDto', 'netLoss'],
];
for (const [schemaName, propertyName] of decimalStrings) {
  if (schemas[schemaName]?.properties?.[propertyName]?.type !== 'string') {
    throw new Error(`Serialized decimal must remain a string: ${schemaName}.${propertyName}`);
  }
}

console.log(
  `OpenAPI quality check passed: ${operations} operations, ${operationIds.size} unique operation IDs, `
  + `${idempotentOperations} idempotent writes, ${verifiedResponseDtoOperations.size} typed response operations.`,
);
