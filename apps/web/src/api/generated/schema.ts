export interface paths {
    "/api/v1/accounting/accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Accounting_createAccount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/accounting/balance-sheet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Accounting_getBalanceSheet"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/accounting/chart-of-accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Accounting_getChartOfAccounts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/accounting/fiscal-years": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Accounting_getFiscalYears"];
        put?: never;
        post: operations["Accounting_createFiscalYear"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/accounting/fiscal-years/{id}/rollover": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Accounting_rolloverFiscalYear"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/accounting/income-statement": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Accounting_getIncomeStatement"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/accounting/journal-entries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Accounting_getJournalEntries"];
        put?: never;
        post: operations["Accounting_createJournalEntry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/accounting/periods/{id}/close": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["Accounting_closePeriod"];
        trace?: never;
    };
    "/api/v1/accounting/periods/{id}/reopen": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["Accounting_reopenPeriod"];
        trace?: never;
    };
    "/api/v1/accounting/trial-balance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Accounting_getTrialBalance"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/animals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Animals_findAll"];
        put?: never;
        post: operations["Animals_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/animals/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Animals_findOne"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/animals/{id}/barn": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["Animals_updateBarn"];
        trace?: never;
    };
    "/api/v1/animals/{id}/life-stage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["Animals_updateLifeStage"];
        trace?: never;
    };
    "/api/v1/audit-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Audit_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Auth_login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Auth_logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Auth_logoutAll"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Auth_getProfile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Auth_refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Auth_register"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/barns": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Barns_findAll"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/breeding/{id}/calving": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Breeding_recordCalving"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/breeding/{id}/pd-result": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["Breeding_recordPdResult"];
        trace?: never;
    };
    "/api/v1/breeding/all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Breeding_getAllRecords"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/breeding/inseminate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Breeding_recordInsemination"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/breeding/upcoming-tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Breeding_getUpcomingTasks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/fattening/performance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Fattening_getPerformance"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/fattening/weight": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Fattening_recordWeight"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health/quarantine-list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Health_getActiveQuarantineList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health/treatment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Health_recordTreatment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/license/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["License_activateLicense"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/license/hardware-id": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["License_getHardwareId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/license/info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["License_getLicenseInfo"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/milking/daily-summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Milking_getDailySummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/milking/log": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Milking_logMilk"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/nutrition/dispense": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** صرف عليقة للحظيرة مع الخصم المخزني والترحيل المالي */
        post: operations["Nutrition_dispenseFeed"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/nutrition/distributions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** سجل حركات صرف وتوزيع الأعلاف للحظائر */
        get: operations["Nutrition_getDistributions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/nutrition/formulas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** عرض قائمة الخلطات والعلائق المعتمدة */
        get: operations["Nutrition_getFormulas"];
        put?: never;
        /** حفظ تركيبة علفية جديدة TMR */
        post: operations["Nutrition_createFormula"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/nutrition/formulate-least-cost": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** حساب أرخص تركيبة علفية TMR تغطي الاحتياج البروتيني */
        post: operations["Nutrition_calculateLeastCost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/nutrition/ingredients": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** إضافة مادة علفية جديدة إلى المستودع */
        post: operations["Nutrition_createIngredient"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/nutrition/ingredients/{id}/stock": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** تغذية رصيد مادة علفية (استلام شحنة واردة) */
        patch: operations["Nutrition_updateStock"];
        trace?: never;
    };
    "/api/v1/nutrition/stock": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** عرض أرصدة مخزون المواد العلفية وتنبيهات النواقص */
        get: operations["Nutrition_getStock"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/culling-candidates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** الماشية المرشحة للاستبعاد لعدم الجدوى الاقتصادية */
        get: operations["Reports_getCullingCandidates"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/executive-dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** لوحة المؤشرات التنفيذية للقطيع والإنتاج */
        get: operations["Reports_getDashboard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/export/{type}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** تجهيز بيانات التصدير لكشوفات المزرعة */
        get: operations["Reports_getExportData"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/financial-overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** التحليل المالي وحساب تكلفة اللتر وكيلو اللحم (IAS 41) */
        get: operations["Reports_getFinancialOverview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/security/rotate-secret": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Security_rotateSecret"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/security/vault-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Security_getVaultStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["SystemHealth_liveness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["SystemHealth_readiness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Users_findAll"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Users_findOne"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{id}/reset-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["Users_resetPassword"];
        trace?: never;
    };
    "/api/v1/users/{id}/role": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["Users_updateRole"];
        trace?: never;
    };
    "/api/v1/users/{id}/toggle-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["Users_toggleStatus"];
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @enum {string} */
        AccountCategory: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
        AccountResponseDto: {
            category: components["schemas"]["AccountCategory"];
            code: string;
            /** Format: date-time */
            createdAt: string;
            /** @example 1250.000 */
            currentBalance: string;
            /** Format: uuid */
            farmId: string;
            /** Format: uuid */
            id: string;
            isActive: boolean;
            isSystemLocked: boolean;
            name: string;
            nameEn: string | null;
            /** Format: uuid */
            parentId: string | null;
            /** Format: date-time */
            updatedAt: string;
        };
        AccountWithChildrenResponseDto: {
            category: components["schemas"]["AccountCategory"];
            children: components["schemas"]["AccountResponseDto"][];
            code: string;
            /** Format: date-time */
            createdAt: string;
            /** @example 1250.000 */
            currentBalance: string;
            /** Format: uuid */
            farmId: string;
            /** Format: uuid */
            id: string;
            isActive: boolean;
            isSystemLocked: boolean;
            name: string;
            nameEn: string | null;
            /** Format: uuid */
            parentId: string | null;
            /** Format: date-time */
            updatedAt: string;
        };
        ActivateLicenseDto: {
            licenseKey: string;
        };
        AnimalCountResponseDto: {
            breedingRecords: number;
            healthTreatments: number;
            milkLogs: number;
            weightLogs: number;
        };
        AnimalDetailResponseDto: {
            _count?: components["schemas"]["AnimalCountResponseDto"];
            barn?: components["schemas"]["BarnResponseDto"] | null;
            /** Format: uuid */
            barnId: string | null;
            /** Format: date-time */
            birthDate: string | null;
            breed: string | null;
            breedingRecords: components["schemas"]["BreedingRecordResponseDto"][];
            children: components["schemas"]["AnimalRecordResponseDto"][];
            /** Format: date-time */
            createdAt: string;
            currentLifeStage: components["schemas"]["LifeStage"];
            /** Format: date-time */
            entryDate: string;
            /** @example 550.000 */
            entryWeightKg: string | null;
            /** Format: uuid */
            farmId: string;
            fatherSemenCode: string | null;
            gender: components["schemas"]["Gender"];
            healthTreatments: components["schemas"]["HealthTreatmentResponseDto"][];
            /** Format: uuid */
            id: string;
            milkLogs: components["schemas"]["MilkLogResponseDto"][];
            mother?: components["schemas"]["AnimalRecordResponseDto"] | null;
            /** Format: uuid */
            motherId: string | null;
            name: string | null;
            /** @example 7250.000 */
            purchasePrice: string | null;
            purpose: components["schemas"]["Purpose"];
            rfidTag: string | null;
            species: components["schemas"]["Species"];
            status: components["schemas"]["AnimalStatus"];
            tagNumber: string;
            /** Format: date-time */
            updatedAt: string;
            weightLogs: components["schemas"]["WeightLogResponseDto"][];
            /** Format: date-time */
            withdrawalEndDate: string | null;
        };
        AnimalRecordResponseDto: {
            /** Format: uuid */
            barnId: string | null;
            /** Format: date-time */
            birthDate: string | null;
            breed: string | null;
            /** Format: date-time */
            createdAt: string;
            currentLifeStage: components["schemas"]["LifeStage"];
            /** Format: date-time */
            entryDate: string;
            /** @example 550.000 */
            entryWeightKg: string | null;
            /** Format: uuid */
            farmId: string;
            fatherSemenCode: string | null;
            gender: components["schemas"]["Gender"];
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            motherId: string | null;
            name: string | null;
            /** @example 7250.000 */
            purchasePrice: string | null;
            purpose: components["schemas"]["Purpose"];
            rfidTag: string | null;
            species: components["schemas"]["Species"];
            status: components["schemas"]["AnimalStatus"];
            tagNumber: string;
            /** Format: date-time */
            updatedAt: string;
            /** Format: date-time */
            withdrawalEndDate: string | null;
        };
        AnimalResponseDto: {
            _count?: components["schemas"]["AnimalCountResponseDto"];
            barn?: components["schemas"]["BarnResponseDto"] | null;
            /** Format: uuid */
            barnId: string | null;
            /** Format: date-time */
            birthDate: string | null;
            breed: string | null;
            /** Format: date-time */
            createdAt: string;
            currentLifeStage: components["schemas"]["LifeStage"];
            /** Format: date-time */
            entryDate: string;
            /** @example 550.000 */
            entryWeightKg: string | null;
            /** Format: uuid */
            farmId: string;
            fatherSemenCode: string | null;
            gender: components["schemas"]["Gender"];
            /** Format: uuid */
            id: string;
            mother?: components["schemas"]["AnimalRecordResponseDto"] | null;
            /** Format: uuid */
            motherId: string | null;
            name: string | null;
            /** @example 7250.000 */
            purchasePrice: string | null;
            purpose: components["schemas"]["Purpose"];
            rfidTag: string | null;
            species: components["schemas"]["Species"];
            status: components["schemas"]["AnimalStatus"];
            tagNumber: string;
            /** Format: date-time */
            updatedAt: string;
            /** Format: date-time */
            withdrawalEndDate: string | null;
        };
        /** @enum {string} */
        AnimalStatus: "ACTIVE" | "SOLD" | "CULLED" | "DECEASED" | "QUARANTINED";
        AuditEventPageResponseDto: {
            items: components["schemas"]["AuditEventResponseDto"][];
            /** Format: uuid */
            nextCursor: string | null;
        };
        AuditEventResponseDto: {
            action: string;
            /** Format: uuid */
            actorUserId: string;
            /** Format: date-time */
            createdAt: string;
            entityId: string | null;
            entityType: string;
            /** Format: uuid */
            farmId: string | null;
            httpMethod: string;
            /** Format: uuid */
            id: string;
            ipAddress: string | null;
            metadata: {
                [key: string]: unknown;
            } | null;
            /** Format: uuid */
            orgId: string;
            path: string;
            statusCode: number;
            userAgent: string | null;
        };
        AuthenticationResponseDto: {
            accessToken: string;
            permissions: string[];
            /** @description Returned only to the trusted Electron channel. */
            refreshToken?: string;
            user: components["schemas"]["AuthUserResponseDto"];
        };
        AuthUserResponseDto: {
            email: string | null;
            /** Format: uuid */
            farmId: string | null;
            fullName: string;
            /** Format: uuid */
            id: string;
            role: components["schemas"]["UserRole"];
            username: string;
        };
        BalanceSheetResponseDto: {
            /** Format: date */
            asOfDate: string;
            assets: components["schemas"]["TrialBalanceRowResponseDto"][];
            equity: components["schemas"]["TrialBalanceRowResponseDto"][];
            fiscalYear: components["schemas"]["FiscalYearSummaryResponseDto"];
            isBalanced: boolean;
            liabilities: components["schemas"]["TrialBalanceRowResponseDto"][];
            totalAssets: number;
            totalEquity: number;
            totalLiabilities: number;
        };
        BarnAnimalCountResponseDto: {
            animals: number;
        };
        BarnResponseDto: {
            capacity: number;
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            farmId: string;
            /** Format: uuid */
            id: string;
            name: string;
            sectorType: components["schemas"]["SectorType"];
            /** Format: date-time */
            updatedAt: string;
        };
        BarnSummaryResponseDto: {
            _count: components["schemas"]["BarnAnimalCountResponseDto"];
            capacity: number;
            /** Format: uuid */
            id: string;
            name: string;
            sectorType: components["schemas"]["SectorType"];
        };
        BeefEconomicsResponseDto: {
            costPerKgGain: number;
            feedCost: number;
            grossEstimatedRevenue: number;
            marketPricePerKg: number;
            profitMarginPct: number;
            totalCost: number;
            totalGainKg: number;
        };
        BreedingRecordResponseDto: {
            /** Format: date-time */
            actualCalvingDate: string | null;
            /** Format: uuid */
            animalId: string;
            calvingDifficulty: components["schemas"]["CalvingDifficulty"] | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            expectedCalvingDate: string | null;
            /** Format: date-time */
            expectedDryoffDate: string | null;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            inseminationDate: string;
            inseminationType: components["schemas"]["InseminationType"];
            inseminatorName: string | null;
            notes: string | null;
            offspringCount: number;
            offspringGender: components["schemas"]["Gender"] | null;
            /** Format: date-time */
            pdCheckDate: string | null;
            pdResult: components["schemas"]["PregnancyResult"];
            semenCode: string | null;
            /** Format: date-time */
            updatedAt: string;
        };
        BreedingRecordWithAnimalResponseDto: {
            /** Format: date-time */
            actualCalvingDate: string | null;
            animal: components["schemas"]["AnimalRecordResponseDto"];
            /** Format: uuid */
            animalId: string;
            calvingDifficulty: components["schemas"]["CalvingDifficulty"] | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            expectedCalvingDate: string | null;
            /** Format: date-time */
            expectedDryoffDate: string | null;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            inseminationDate: string;
            inseminationType: components["schemas"]["InseminationType"];
            inseminatorName: string | null;
            notes: string | null;
            offspringCount: number;
            offspringGender: components["schemas"]["Gender"] | null;
            /** Format: date-time */
            pdCheckDate: string | null;
            pdResult: components["schemas"]["PregnancyResult"];
            semenCode: string | null;
            /** Format: date-time */
            updatedAt: string;
        };
        BreedingTasksResponseDto: {
            pendingDryOffs: components["schemas"]["BreedingRecordWithAnimalResponseDto"][];
            pendingPdChecks: components["schemas"]["BreedingRecordWithAnimalResponseDto"][];
            upcomingCalvings: components["schemas"]["BreedingRecordWithAnimalResponseDto"][];
        };
        /** @enum {string} */
        CalvingDifficulty: "EASY" | "ASSISTED" | "SURGICAL" | "ABORTION";
        CostCenterResponseDto: {
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            farmId: string;
            /** Format: uuid */
            id: string;
            name: string;
            type: components["schemas"]["CostCenterType"];
        };
        /** @enum {string} */
        CostCenterType: "DAIRY_PRODUCTION" | "FATTENING_PRODUCTION" | "BREEDING_REPLACEMENT" | "GENERAL_OVERHEAD";
        CreateAccountDto: {
            /** @enum {string} */
            category: "EXPENSE" | "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE";
            code: string;
            name: string;
            nameEn?: string;
            /** Format: uuid */
            parentId?: string;
        };
        CreateAnimalDto: {
            /** Format: uuid */
            barnId?: string;
            birthDate?: string;
            breed?: string;
            /**
             * @default CALF
             * @enum {string}
             */
            currentLifeStage?: "CALF" | "WEANED" | "HEIFER" | "PREGNANT_HEIFER" | "LACTATING" | "DRY" | "FATTENING" | "SIRE";
            entryWeightKg?: number;
            fatherSemenCode?: string;
            /**
             * @default FEMALE
             * @enum {string}
             */
            gender?: "FEMALE" | "MALE";
            /** Format: uuid */
            motherId?: string;
            name?: string;
            purchasePrice?: number;
            /**
             * @default DAIRY
             * @enum {string}
             */
            purpose?: "DAIRY" | "BEEF" | "DUAL" | "BREEDING";
            rfidTag?: string;
            /**
             * @default CATTLE
             * @enum {string}
             */
            species?: "CATTLE" | "SHEEP" | "GOAT";
            tagNumber: string;
        };
        CreateFeedFormulaDto: {
            description?: string;
            items: components["schemas"]["FeedFormulaItemDto"][];
            name: string;
            /** @enum {string} */
            targetSector?: "DAIRY" | "BREEDING" | "FATTENING" | "CALVES" | "ISOLATION";
        };
        CreateFeedIngredientDto: {
            costPerUnit: number;
            currentStock: number;
            dryMatterPct?: number;
            energyMcal?: number;
            minStockAlert?: number;
            name: string;
            proteinPct?: number;
            unit?: string;
        };
        CreateFiscalYearDto: {
            endDate: string;
            startDate: string;
            yearName: string;
        };
        CreateJournalEntryDto: {
            description: string;
            entryDate: string;
            /** Format: uuid */
            fiscalPeriodId?: string;
            /** Format: uuid */
            fiscalYearId?: string;
            lines: components["schemas"]["JournalLineDto"][];
            referenceId?: string;
            /** @enum {string} */
            type?: "MANUAL" | "FEED_DISPENSE" | "MILK_SALE" | "CATTLE_SALE" | "CALVING_CAPITALIZE" | "MORTALITY_LOSS" | "OPENING_BALANCE" | "YEAR_END_CLOSING";
        };
        CreateTreatmentDto: {
            animalId: string;
            diagnosis: string;
            dosage: string;
            drugName: string;
            /** @default 0 */
            meatWithdrawalDays?: number;
            /** @default 0 */
            milkWithdrawalDays?: number;
            notes?: string;
            /** @default 0 */
            treatmentCost?: number;
            treatmentDate: string;
            vetName?: string;
        };
        CullingCandidateResponseDto: {
            breed: string | null;
            currentLifeStage: components["schemas"]["LifeStage"];
            estimatedSalvageValue: number;
            /** Format: uuid */
            id: string;
            purpose: components["schemas"]["Purpose"];
            reasons: string[];
            recommendation: string;
            rfidCode: string | null;
            /** @enum {string} */
            severity: "HIGH" | "MEDIUM" | "LOW";
            tagNumber: string;
        };
        DailyMilkingSummaryResponseDto: {
            /** @example 18.25 */
            averagePerCow: string;
            cowsMilkedCount: number;
            /** Format: date */
            date: string;
            discardedLiters: number;
            logs: components["schemas"]["MilkLogWithAnimalResponseDto"][];
            totalLiters: number;
            usableLiters: number;
        };
        DashboardAlertsResponseDto: {
            pendingDryOffs: number;
            pendingPdChecks: number;
            quarantineActive: number;
            upcomingCalvings: number;
        };
        DashboardKpisResponseDto: {
            fatteningAnimals: number;
            lactatingCows: number;
            milk: components["schemas"]["DashboardMilkKpisResponseDto"];
            quarantineCount: number;
            totalAnimals: number;
        };
        DashboardMilkKpisResponseDto: {
            /** @example 18.4 */
            avgPerCow: string | number;
            cowsMilked: number;
            total: number;
            usable: number;
            wasted: number;
        };
        DispenseFeedDto: {
            /** Format: uuid */
            barnId: string;
            /** Format: uuid */
            formulaId: string;
            quantityKg: number;
        };
        DispenseFeedResponseDto: {
            /** @example 0.425 */
            costPerKg: string;
            distribution: components["schemas"]["FeedDistributionRecordResponseDto"];
            message: string;
            totalCost: number;
        };
        ExecutiveDashboardResponseDto: {
            alerts: components["schemas"]["DashboardAlertsResponseDto"];
            kpis: components["schemas"]["DashboardKpisResponseDto"];
        };
        FarmProfitAndLossResponseDto: {
            netProfit: number;
            profitMarginPct: number;
            totalExpenses: number;
            totalRevenue: number;
        };
        FatteningPerformanceResponseDto: {
            adgKgPerDay: number | null;
            barn: string | null;
            breed: string | null;
            currentWeightKg: number | null;
            entryWeightKg: number | null;
            /** Format: uuid */
            id: string;
            /** Format: date */
            lastWeighDate: string | null;
            tagNumber: string;
            totalGainKg: number | null;
        };
        FeedDistributionRecordResponseDto: {
            /** Format: uuid */
            barnId: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            dispenseDate: string;
            /** Format: uuid */
            formulaId: string;
            /** Format: uuid */
            id: string;
            quantityKg: string;
            totalCost: string;
        };
        FeedDistributionResponseDto: {
            barn: components["schemas"]["BarnResponseDto"];
            /** Format: uuid */
            barnId: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            dispenseDate: string;
            formula: components["schemas"]["FeedFormulaRecordResponseDto"];
            /** Format: uuid */
            formulaId: string;
            /** Format: uuid */
            id: string;
            quantityKg: string;
            totalCost: string;
        };
        FeedFormulaItemDto: {
            /** Format: uuid */
            ingredientId: string;
            percentage: number;
        };
        FeedFormulaItemResponseDto: {
            /** Format: uuid */
            formulaId: string;
            /** Format: uuid */
            id: string;
            ingredient: components["schemas"]["FeedIngredientResponseDto"];
            /** Format: uuid */
            ingredientId: string;
            percentage: string;
        };
        FeedFormulaRecordResponseDto: {
            /** Format: date-time */
            createdAt: string;
            description: string | null;
            /** Format: uuid */
            farmId: string;
            /** Format: uuid */
            id: string;
            name: string;
            targetSector: components["schemas"]["SectorType"];
            /** Format: date-time */
            updatedAt: string;
        };
        FeedFormulaResponseDto: {
            /** Format: date-time */
            createdAt: string;
            description: string | null;
            /** Format: uuid */
            farmId: string;
            /** Format: uuid */
            id: string;
            items: components["schemas"]["FeedFormulaItemResponseDto"][];
            name: string;
            targetSector: components["schemas"]["SectorType"];
            /** Format: date-time */
            updatedAt: string;
        };
        FeedIngredientResponseDto: {
            costPerUnit: string;
            /** Format: date-time */
            createdAt: string;
            currentStock: string;
            dryMatterPct: string | null;
            energyMcal: string | null;
            /** Format: uuid */
            farmId: string;
            /** Format: uuid */
            id: string;
            minStockAlert: string;
            name: string;
            proteinPct: string | null;
            unit: string;
            /** Format: date-time */
            updatedAt: string;
        };
        FinancialDataQualityResponseDto: {
            laborAndOverheadIncluded: boolean;
            missingPriceConfiguration: boolean;
            usesRecordedDataOnly: boolean;
        };
        FinancialOverviewResponseDto: {
            beefEconomics: components["schemas"]["BeefEconomicsResponseDto"];
            dataQuality: components["schemas"]["FinancialDataQualityResponseDto"];
            farmPnL: components["schemas"]["FarmProfitAndLossResponseDto"];
            milkEconomics: components["schemas"]["MilkEconomicsResponseDto"];
            period: string;
        };
        FiscalPeriodResponseDto: {
            /** Format: date-time */
            closedAt: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            endDate: string;
            /** Format: uuid */
            fiscalYearId: string;
            /** Format: uuid */
            id: string;
            periodName: string;
            periodNumber: number;
            /** Format: date-time */
            startDate: string;
            status: components["schemas"]["FiscalStatus"];
        };
        /** @enum {string} */
        FiscalStatus: "OPEN" | "CLOSED";
        FiscalYearResponseDto: {
            /** Format: date-time */
            closedAt: string | null;
            closedBy: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            endDate: string;
            /** Format: uuid */
            farmId: string;
            /** Format: uuid */
            id: string;
            isCurrent: boolean;
            periods?: components["schemas"]["FiscalPeriodResponseDto"][];
            /** Format: date-time */
            startDate: string;
            status: components["schemas"]["FiscalStatus"];
            /** Format: date-time */
            updatedAt: string;
            yearName: string;
        };
        FiscalYearRolloverResponseDto: {
            closedYear: string;
            message: string;
            netProfitTransferred: number;
            newYear: string;
            success: boolean;
        };
        FiscalYearSummaryResponseDto: {
            /** Format: uuid */
            id: string;
            status: components["schemas"]["FiscalStatus"];
            yearName: string;
        };
        FormulateLeastCostDto: {
            ingredients: components["schemas"]["RationIngredientInputDto"][];
            target: components["schemas"]["FormulationTargetDto"];
        };
        FormulationTargetDto: {
            batchTotalKg: number;
            targetProteinPct: number;
        };
        /** @enum {string} */
        Gender: "FEMALE" | "MALE";
        HardwareIdResponseDto: {
            hardwareId: string;
        };
        HealthTreatmentResponseDto: {
            /** Format: uuid */
            animalId: string;
            /** Format: date-time */
            createdAt: string;
            diagnosis: string;
            dosage: string;
            drugName: string;
            /** Format: uuid */
            id: string;
            isCompleted: boolean;
            meatWithdrawalDays: number;
            milkWithdrawalDays: number;
            notes: string | null;
            treatmentCost: string;
            /** Format: date-time */
            treatmentDate: string;
            vetName: string | null;
            /** Format: date-time */
            withdrawalEndDate: string | null;
        };
        IncomeStatementResponseDto: {
            expenses: components["schemas"]["TrialBalanceRowResponseDto"][];
            fiscalYear: components["schemas"]["FiscalYearSummaryResponseDto"];
            netProfit: number;
            period: string;
            profitMarginPct: number;
            revenues: components["schemas"]["TrialBalanceRowResponseDto"][];
            totalExpenses: number;
            totalRevenue: number;
        };
        InseminateDto: {
            animalId: string;
            inseminationDate: string;
            /**
             * @default ARTIFICIAL
             * @enum {string}
             */
            inseminationType?: "ARTIFICIAL" | "NATURAL";
            inseminatorName?: string;
            notes?: string;
            semenCode?: string;
        };
        /** @enum {string} */
        InseminationType: "ARTIFICIAL" | "NATURAL";
        JournalEntryLineResponseDto: {
            account: components["schemas"]["AccountResponseDto"];
            /** Format: uuid */
            accountId: string;
            costCenter: components["schemas"]["CostCenterResponseDto"] | null;
            /** Format: uuid */
            costCenterId: string | null;
            credit: string;
            debit: string;
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            journalEntryId: string;
            memo: string | null;
        };
        JournalEntryResponseDto: {
            /** Format: date-time */
            createdAt: string;
            description: string;
            /** Format: date-time */
            entryDate: string;
            entryNumber: string;
            /** Format: uuid */
            farmId: string;
            /** Format: uuid */
            fiscalPeriodId: string | null;
            fiscalYear?: components["schemas"]["FiscalYearResponseDto"];
            /** Format: uuid */
            fiscalYearId: string;
            /** Format: uuid */
            id: string;
            lines: components["schemas"]["JournalEntryLineResponseDto"][];
            /** Format: date-time */
            postedAt: string | null;
            postedBy: string | null;
            referenceId: string | null;
            status: components["schemas"]["JournalEntryStatus"];
            totalCredit: string;
            totalDebit: string;
            type: components["schemas"]["JournalEntryType"];
            /** Format: date-time */
            updatedAt: string;
        };
        /** @enum {string} */
        JournalEntryStatus: "DRAFT" | "POSTED" | "VOIDED";
        /** @enum {string} */
        JournalEntryType: "MANUAL" | "FEED_DISPENSE" | "MILK_SALE" | "CATTLE_SALE" | "CALVING_CAPITALIZE" | "MORTALITY_LOSS" | "OPENING_BALANCE" | "YEAR_END_CLOSING";
        JournalLineDto: {
            /** Format: uuid */
            accountId: string;
            /** Format: uuid */
            costCenterId?: string;
            credit: number;
            debit: number;
            memo?: string;
        };
        LeastCostRationItemResponseDto: {
            cost: number;
            /** Format: uuid */
            ingredientId: string;
            name: string;
            percentage: number;
            weightKg: number;
        };
        LeastCostRationResponseDto: {
            actualProteinPct: number;
            batchTotalKg: number;
            costPerKg: number;
            costPerTon: number;
            items: components["schemas"]["LeastCostRationItemResponseDto"][];
            targetProteinPct: number;
            totalCost: number;
        };
        LicenseDetailsResponseDto: {
            allowedModules: string[];
            companyName: string;
            daysRemaining: number;
            /** Format: date-time */
            expiresAt: string;
            isPerpetual: boolean;
            /** Format: date-time */
            issuedAt: string;
            licenseId: string;
            maxAnimals: number;
            /** @enum {string} */
            plan: "TRIAL" | "STANDARD" | "ENTERPRISE" | "LIFETIME";
        };
        LicenseStatusResponseDto: {
            details?: components["schemas"]["LicenseDetailsResponseDto"];
            hardwareId: string;
            isReadOnly: boolean;
            isValid: boolean;
            message: string;
            /** @enum {string} */
            status: "ACTIVE" | "WARNING_EXPIRING_SOON" | "EXPIRED" | "TAMPERED_CLOCK" | "UNLICENSED" | "INVALID_HARDWARE";
        };
        /** @enum {string} */
        LifeStage: "CALF" | "WEANED" | "HEIFER" | "PREGNANT_HEIFER" | "LACTATING" | "DRY" | "FATTENING" | "SIRE";
        LivenessResponseDto: {
            /**
             * @example ok
             * @enum {string}
             */
            status: "ok" | "ready";
            /** @example 2026-08-28T12:00:00.000Z */
            timestamp: string;
            /** @example 123 */
            uptimeSeconds: number;
            /** @example 1.0.0 */
            version: string;
        };
        LoginDto: {
            password: string;
            username: string;
        };
        LogMilkDto: {
            animalId: string;
            discardReason?: string;
            fatPct?: number;
            isDiscarded?: boolean;
            logDate: string;
            proteinPct?: number;
            /**
             * @default MORNING
             * @enum {string}
             */
            shift?: "MORNING" | "NOON" | "EVENING";
            yieldLiters: number;
        };
        LogoutAllResponseDto: {
            message: string;
            sessionsRevoked: number;
        };
        MessageResponseDto: {
            message: string;
        };
        MilkEconomicsResponseDto: {
            actualCostPerLiter: number;
            feedCost: number;
            grossRevenue: number;
            laborAndOverhead: number;
            marginPct: number;
            profitPerLiter: number;
            sellingPricePerLiter: number;
            totalCost: number;
            totalMilkLiters: number;
            vetCost: number;
        };
        /** @enum {string} */
        MilkingShift: "MORNING" | "NOON" | "EVENING";
        MilkLogResponseDto: {
            /** Format: uuid */
            animalId: string;
            /** Format: date-time */
            createdAt: string;
            discardReason: string | null;
            fatPct: string | null;
            /** Format: uuid */
            id: string;
            isDiscarded: boolean;
            /** Format: date-time */
            logDate: string;
            loggedByUserId: string | null;
            proteinPct: string | null;
            shift: components["schemas"]["MilkingShift"];
            yieldLiters: string;
        };
        MilkLogWithAnimalResponseDto: {
            animal: components["schemas"]["AnimalRecordResponseDto"];
            /** Format: uuid */
            animalId: string;
            /** Format: date-time */
            createdAt: string;
            discardReason: string | null;
            fatPct: string | null;
            /** Format: uuid */
            id: string;
            isDiscarded: boolean;
            /** Format: date-time */
            logDate: string;
            loggedByUserId: string | null;
            proteinPct: string | null;
            shift: components["schemas"]["MilkingShift"];
            yieldLiters: string;
        };
        /** @enum {string} */
        PregnancyResult: "PENDING" | "PREGNANT" | "OPEN";
        /** @enum {string} */
        Purpose: "DAIRY" | "BEEF" | "DUAL" | "BREEDING";
        QuarantinedAnimalResponseDto: {
            _count?: components["schemas"]["AnimalCountResponseDto"];
            barn?: components["schemas"]["BarnResponseDto"] | null;
            /** Format: uuid */
            barnId: string | null;
            /** Format: date-time */
            birthDate: string | null;
            breed: string | null;
            /** Format: date-time */
            createdAt: string;
            currentLifeStage: components["schemas"]["LifeStage"];
            /** Format: date-time */
            entryDate: string;
            /** @example 550.000 */
            entryWeightKg: string | null;
            /** Format: uuid */
            farmId: string;
            fatherSemenCode: string | null;
            gender: components["schemas"]["Gender"];
            healthTreatments: components["schemas"]["HealthTreatmentResponseDto"][];
            /** Format: uuid */
            id: string;
            mother?: components["schemas"]["AnimalRecordResponseDto"] | null;
            /** Format: uuid */
            motherId: string | null;
            name: string | null;
            /** @example 7250.000 */
            purchasePrice: string | null;
            purpose: components["schemas"]["Purpose"];
            rfidTag: string | null;
            species: components["schemas"]["Species"];
            status: components["schemas"]["AnimalStatus"];
            tagNumber: string;
            /** Format: date-time */
            updatedAt: string;
            /** Format: date-time */
            withdrawalEndDate: string | null;
        };
        RationIngredientInputDto: {
            costPerKg: number;
            energyMcal: number;
            /** Format: uuid */
            id: string;
            maxInclusionPct?: number;
            minInclusionPct?: number;
            name: string;
            proteinPct: number;
        };
        ReadinessResponseDto: {
            /** @example connected */
            database: string;
            /** @example 0005_operational_idempotency */
            requiredMigration: string;
            /**
             * @example ready
             * @enum {string}
             */
            status: "ok" | "ready";
            /** @example 2026-08-28T12:00:00.000Z */
            timestamp: string;
            /** @example 123 */
            uptimeSeconds: number;
            /** @example 1.0.0 */
            version: string;
        };
        RecordCalvingDto: {
            actualCalvingDate: string;
            /** @enum {string} */
            offspringGender: "FEMALE" | "MALE";
            offspringTagNumber: string;
            offspringWeightKg?: number;
        };
        RecordCalvingResponseDto: {
            message: string;
            /** Format: uuid */
            motherId: string;
            newborn: components["schemas"]["AnimalRecordResponseDto"];
        };
        RecordedWeightResponseDto: {
            animal: components["schemas"]["AnimalRecordResponseDto"];
            /** Format: uuid */
            animalId: string;
            /** Format: date-time */
            createdAt: string;
            dailyGainAdg: string | null;
            daysSinceLast: number | null;
            /** Format: uuid */
            id: string;
            notes: string | null;
            /** Format: date-time */
            weighDate: string;
            weightKg: string;
        };
        RecordMilkResponseDto: {
            healthAlert: string | null;
            milkLog: components["schemas"]["MilkLogWithAnimalResponseDto"];
            safetyWarning: string | null;
        };
        RecordPregnancyResultDto: {
            /** @enum {string} */
            result: "PENDING" | "PREGNANT" | "OPEN";
        };
        RecordTreatmentResponseDto: {
            treatment: components["schemas"]["HealthTreatmentResponseDto"];
            warningMessage: string;
        };
        RecordWeightDto: {
            animalId: string;
            notes?: string;
            weighDate: string;
            weightKg: number;
        };
        RefreshTokenDto: {
            refreshToken?: string;
        };
        RegisteredUserResponseDto: {
            /** Format: date-time */
            createdAt: string;
            email: string | null;
            /** Format: uuid */
            farmId: string | null;
            fullName: string;
            /** Format: uuid */
            id: string;
            role: components["schemas"]["UserRole"];
            username: string;
        };
        RegisterUserDto: {
            /** Format: email */
            email?: string;
            /** Format: uuid */
            farmId?: string;
            fullName: string;
            password: string;
            /** @enum {string} */
            role?: "SUPER_ADMIN" | "FARM_MANAGER" | "VETERINARIAN" | "MILKER" | "ACCOUNTANT" | "WORKER";
            username: string;
        };
        ResetPasswordDto: {
            password: string;
        };
        ResetPasswordResponseDto: {
            message: string;
        };
        RolloverFiscalYearDto: {
            nextYearName: string;
        };
        RotateSecretDto: {
            /** @enum {string} */
            keyName: "JWT_SECRET";
        };
        RotateSecretResponseDto: {
            keyName: string;
            /** Format: date-time */
            lastRotated: string;
            rotationAvailable: boolean;
            rotationUnavailableReason: string | null;
            /** @enum {string} */
            source: "HASHICORP_VAULT" | "ENVIRONMENT";
            version: number;
        };
        SecretAuditLogResponseDto: {
            action: string;
            key: string;
            status: string;
            /** Format: date-time */
            timestamp: string;
        };
        SecretMetadataResponseDto: {
            keyName: string;
            /** Format: date-time */
            lastRotated: string;
            rotationAvailable: boolean;
            rotationUnavailableReason: string | null;
            /** @enum {string} */
            source: "HASHICORP_VAULT" | "ENVIRONMENT";
            version: number;
        };
        /** @enum {string} */
        SectorType: "DAIRY" | "FATTENING" | "BREEDING" | "CALVES" | "ISOLATION";
        /** @enum {string} */
        Species: "CATTLE" | "SHEEP" | "GOAT";
        TrialBalanceResponseDto: {
            accounts: components["schemas"]["TrialBalanceRowResponseDto"][];
            /** Format: date */
            asOfDate: string;
            fiscalYear: components["schemas"]["FiscalYearSummaryResponseDto"];
            isBalanced: boolean;
            totalCredits: number;
            totalDebits: number;
        };
        TrialBalanceRowResponseDto: {
            category: components["schemas"]["AccountCategory"];
            code: string;
            /** Format: uuid */
            id: string;
            name: string;
            netCredit: number;
            netDebit: number;
            totalCredit: number;
            totalDebit: number;
        };
        UpdateAnimalBarnDto: {
            /** Format: uuid */
            barnId: string;
        };
        UpdateAnimalLifeStageDto: {
            /** @enum {string} */
            stage: "CALF" | "WEANED" | "HEIFER" | "PREGNANT_HEIFER" | "LACTATING" | "DRY" | "FATTENING" | "SIRE";
        };
        UpdateFeedStockDto: {
            addedKg: number;
            costPerUnit?: number;
        };
        UpdateUserRoleDto: {
            /** @enum {string} */
            role: "SUPER_ADMIN" | "FARM_MANAGER" | "VETERINARIAN" | "MILKER" | "ACCOUNTANT" | "WORKER";
        };
        UserAdministrationResponseDto: {
            /** Format: date-time */
            createdAt: string;
            email: string | null;
            farm: components["schemas"]["UserFarmResponseDto"] | null;
            /** Format: uuid */
            farmId: string | null;
            fullName: string;
            /** Format: uuid */
            id: string;
            isActive: boolean;
            role: components["schemas"]["UserRole"];
            username: string;
        };
        UserFarmResponseDto: {
            name: string;
        };
        UserMutationResponseDto: {
            fullName: string;
            /** Format: uuid */
            id: string;
            isActive: boolean;
            role: components["schemas"]["UserRole"];
            username: string;
        };
        UserProfileResponseDto: {
            /** Format: date-time */
            createdAt: string;
            email: string | null;
            /** Format: uuid */
            farmId: string | null;
            fullName: string;
            /** Format: uuid */
            id: string;
            isActive: boolean;
            permissions: string[];
            role: components["schemas"]["UserRole"];
            username: string;
        };
        /** @enum {string} */
        UserRole: "SUPER_ADMIN" | "FARM_MANAGER" | "VETERINARIAN" | "MILKER" | "ACCOUNTANT" | "WORKER";
        VaultStatusResponseDto: {
            activeSecretsCount: number;
            isVaultOnline: boolean;
            recentAuditLogs: components["schemas"]["SecretAuditLogResponseDto"][];
            secrets: components["schemas"]["SecretMetadataResponseDto"][];
            vaultAddr: string;
        };
        WeightLogResponseDto: {
            /** Format: uuid */
            animalId: string;
            /** Format: date-time */
            createdAt: string;
            dailyGainAdg: string | null;
            daysSinceLast: number | null;
            /** Format: uuid */
            id: string;
            notes: string | null;
            /** Format: date-time */
            weighDate: string;
            weightKg: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    Accounting_createAccount: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAccountDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountResponseDto"];
                };
            };
        };
    };
    Accounting_getBalanceSheet: {
        parameters: {
            query?: {
                fiscalYearId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BalanceSheetResponseDto"];
                };
            };
        };
    };
    Accounting_getChartOfAccounts: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountWithChildrenResponseDto"][];
                };
            };
        };
    };
    Accounting_getFiscalYears: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalYearResponseDto"][];
                };
            };
        };
    };
    Accounting_createFiscalYear: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateFiscalYearDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalYearResponseDto"];
                };
            };
        };
    };
    Accounting_rolloverFiscalYear: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RolloverFiscalYearDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalYearRolloverResponseDto"];
                };
            };
        };
    };
    Accounting_getIncomeStatement: {
        parameters: {
            query?: {
                fiscalYearId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncomeStatementResponseDto"];
                };
            };
        };
    };
    Accounting_getJournalEntries: {
        parameters: {
            query?: {
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryResponseDto"][];
                };
            };
        };
    };
    Accounting_createJournalEntry: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateJournalEntryDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JournalEntryResponseDto"];
                };
            };
        };
    };
    Accounting_closePeriod: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalPeriodResponseDto"];
                };
            };
        };
    };
    Accounting_reopenPeriod: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FiscalPeriodResponseDto"];
                };
            };
        };
    };
    Accounting_getTrialBalance: {
        parameters: {
            query?: {
                fiscalYearId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TrialBalanceResponseDto"];
                };
            };
        };
    };
    Animals_findAll: {
        parameters: {
            query?: {
                barnId?: string;
                search?: string;
                status?: "ACTIVE" | "SOLD" | "CULLED" | "DECEASED" | "QUARANTINED";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnimalResponseDto"][];
                };
            };
        };
    };
    Animals_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAnimalDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnimalResponseDto"];
                };
            };
        };
    };
    Animals_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnimalDetailResponseDto"];
                };
            };
        };
    };
    Animals_updateBarn: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAnimalBarnDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnimalRecordResponseDto"];
                };
            };
        };
    };
    Animals_updateLifeStage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAnimalLifeStageDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnimalRecordResponseDto"];
                };
            };
        };
    };
    Audit_list: {
        parameters: {
            query?: {
                cursor?: string;
                entityType?: string;
                farmId?: string;
                from?: string;
                limit?: number;
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditEventPageResponseDto"];
                };
            };
        };
    };
    Auth_login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthenticationResponseDto"];
                };
            };
        };
    };
    Auth_logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefreshTokenDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MessageResponseDto"];
                };
            };
        };
    };
    Auth_logoutAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LogoutAllResponseDto"];
                };
            };
        };
    };
    Auth_getProfile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserProfileResponseDto"];
                };
            };
        };
    };
    Auth_refresh: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefreshTokenDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthenticationResponseDto"];
                };
            };
        };
    };
    Auth_register: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegisterUserDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegisteredUserResponseDto"];
                };
            };
        };
    };
    Barns_findAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BarnSummaryResponseDto"][];
                };
            };
        };
    };
    Breeding_recordCalving: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordCalvingDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordCalvingResponseDto"];
                };
            };
        };
    };
    Breeding_recordPdResult: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordPregnancyResultDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BreedingRecordWithAnimalResponseDto"];
                };
            };
        };
    };
    Breeding_getAllRecords: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BreedingRecordWithAnimalResponseDto"][];
                };
            };
        };
    };
    Breeding_recordInsemination: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InseminateDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BreedingRecordWithAnimalResponseDto"];
                };
            };
        };
    };
    Breeding_getUpcomingTasks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BreedingTasksResponseDto"];
                };
            };
        };
    };
    Fattening_getPerformance: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FatteningPerformanceResponseDto"][];
                };
            };
        };
    };
    Fattening_recordWeight: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecordWeightDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordedWeightResponseDto"];
                };
            };
        };
    };
    Health_getActiveQuarantineList: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QuarantinedAnimalResponseDto"][];
                };
            };
        };
    };
    Health_recordTreatment: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTreatmentDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordTreatmentResponseDto"];
                };
            };
        };
    };
    License_activateLicense: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ActivateLicenseDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LicenseStatusResponseDto"];
                };
            };
        };
    };
    License_getHardwareId: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HardwareIdResponseDto"];
                };
            };
        };
    };
    License_getLicenseInfo: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LicenseStatusResponseDto"];
                };
            };
        };
    };
    Milking_getDailySummary: {
        parameters: {
            query?: {
                date?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DailyMilkingSummaryResponseDto"];
                };
            };
        };
    };
    Milking_logMilk: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LogMilkDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecordMilkResponseDto"];
                };
            };
        };
    };
    Nutrition_dispenseFeed: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DispenseFeedDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DispenseFeedResponseDto"];
                };
            };
        };
    };
    Nutrition_getDistributions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedDistributionResponseDto"][];
                };
            };
        };
    };
    Nutrition_getFormulas: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedFormulaResponseDto"][];
                };
            };
        };
    };
    Nutrition_createFormula: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateFeedFormulaDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedFormulaResponseDto"];
                };
            };
        };
    };
    Nutrition_calculateLeastCost: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FormulateLeastCostDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LeastCostRationResponseDto"];
                };
            };
        };
    };
    Nutrition_createIngredient: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateFeedIngredientDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedIngredientResponseDto"];
                };
            };
        };
    };
    Nutrition_updateStock: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateFeedStockDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedIngredientResponseDto"];
                };
            };
        };
    };
    Nutrition_getStock: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FeedIngredientResponseDto"][];
                };
            };
        };
    };
    Reports_getCullingCandidates: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CullingCandidateResponseDto"][];
                };
            };
        };
    };
    Reports_getDashboard: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExecutiveDashboardResponseDto"];
                };
            };
        };
    };
    Reports_getExportData: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                type: "animals" | "milking" | "breeding" | "nutrition" | "culling";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": (components["schemas"]["AnimalRecordResponseDto"] | components["schemas"]["MilkLogWithAnimalResponseDto"] | components["schemas"]["BreedingRecordWithAnimalResponseDto"] | components["schemas"]["FeedIngredientResponseDto"] | components["schemas"]["CullingCandidateResponseDto"])[];
                };
            };
        };
    };
    Reports_getFinancialOverview: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FinancialOverviewResponseDto"];
                };
            };
        };
    };
    Security_rotateSecret: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RotateSecretDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RotateSecretResponseDto"];
                };
            };
        };
    };
    Security_getVaultStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VaultStatusResponseDto"];
                };
            };
        };
    };
    SystemHealth_liveness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LivenessResponseDto"];
                };
            };
        };
    };
    SystemHealth_readiness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadinessResponseDto"];
                };
            };
            /** @description Database is unavailable or the required migration is absent. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Users_findAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserAdministrationResponseDto"][];
                };
            };
        };
    };
    Users_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserAdministrationResponseDto"];
                };
            };
        };
    };
    Users_resetPassword: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResetPasswordDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResetPasswordResponseDto"];
                };
            };
        };
    };
    Users_updateRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateUserRoleDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserMutationResponseDto"];
                };
            };
        };
    };
    Users_toggleStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserMutationResponseDto"];
                };
            };
        };
    };
}
