import { SetMetadata } from '@nestjs/common';
import { DOMAIN_AUDIT_KEY } from './domain-audit';

/** Marks a handler whose service writes its audit evidence inside the domain transaction. */
export const DomainAudited = () => SetMetadata(DOMAIN_AUDIT_KEY, true);
