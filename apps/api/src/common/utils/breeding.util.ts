/**
 * ثوابت وخوارزميات محرك التناسل والخصوبة البيولوجية
 * Biological Breeding & Reproduction Engine Utilities
 */

export enum TargetSpecies {
  CATTLE = 'CATTLE',
  SHEEP = 'SHEEP',
  GOAT = 'GOAT',
}

export interface BreedingTimelineConfig {
  gestationDays: number;       // متوسط فترة الحمل بالأيام
  dryOffLeadDays: number;      // فترة التجفيف قبل الولادة بالأيام
  heatCycleDays: number;       // دورة الشبق بالأيام
  minPdCheckDays: number;      // أقرب موعد لفحص الحمل (سونار/جس)
  voluntaryWaitPeriod: number; // فترة الانتظار الطوعي بعد الولادة للراحة الرحمية
}

export const SPECIES_BREEDING_CONFIGS: Record<TargetSpecies, BreedingTimelineConfig> = {
  [TargetSpecies.CATTLE]: {
    gestationDays: 282,
    dryOffLeadDays: 60,
    heatCycleDays: 21,
    minPdCheckDays: 35,
    voluntaryWaitPeriod: 50,
  },
  [TargetSpecies.SHEEP]: {
    gestationDays: 150,
    dryOffLeadDays: 45,
    heatCycleDays: 17,
    minPdCheckDays: 30,
    voluntaryWaitPeriod: 40,
  },
  [TargetSpecies.GOAT]: {
    gestationDays: 150,
    dryOffLeadDays: 45,
    heatCycleDays: 21,
    minPdCheckDays: 30,
    voluntaryWaitPeriod: 40,
  },
};

export class BreedingEngine {
  /**
   * حساب تاريخ الولادة المتوقع بناءً على تاريخ التلقيح ونوع الحيوان
   */
  static calculateExpectedCalvingDate(inseminationDate: Date, species: TargetSpecies = TargetSpecies.CATTLE): Date {
    const config = SPECIES_BREEDING_CONFIGS[species] || SPECIES_BREEDING_CONFIGS.CATTLE;
    const expected = new Date(inseminationDate);
    expected.setDate(expected.getDate() + config.gestationDays);
    return expected;
  }

  /**
   * حساب تاريخ التجفيف المتوقع (وقف الحلب لإراحة الضرع قبل الولادة)
   */
  static calculateExpectedDryoffDate(inseminationDate: Date, species: TargetSpecies = TargetSpecies.CATTLE): Date {
    const expectedCalving = this.calculateExpectedCalvingDate(inseminationDate, species);
    const config = SPECIES_BREEDING_CONFIGS[species] || SPECIES_BREEDING_CONFIGS.CATTLE;
    const dryOff = new Date(expectedCalving);
    dryOff.setDate(dryOff.getDate() - config.dryOffLeadDays);
    return dryOff;
  }

  /**
   * حساب موعد استحقاق فحص الحمل بالسونار/الجس
   */
  static calculatePdCheckDate(inseminationDate: Date, species: TargetSpecies = TargetSpecies.CATTLE): Date {
    const config = SPECIES_BREEDING_CONFIGS[species] || SPECIES_BREEDING_CONFIGS.CATTLE;
    const checkDate = new Date(inseminationDate);
    checkDate.setDate(checkDate.getDate() + config.minPdCheckDays);
    return checkDate;
  }

  /**
   * حساب موعد مراقبة إعادة الشبق في حال فشل التلقيح (Heat Repeat Window)
   */
  static calculateHeatRepeatWindow(inseminationDate: Date, species: TargetSpecies = TargetSpecies.CATTLE): { from: Date; to: Date } {
    const config = SPECIES_BREEDING_CONFIGS[species] || SPECIES_BREEDING_CONFIGS.CATTLE;
    const from = new Date(inseminationDate);
    from.setDate(from.getDate() + (config.heatCycleDays - 3));

    const to = new Date(inseminationDate);
    to.setDate(to.getDate() + (config.heatCycleDays + 3));

    return { from, to };
  }

  /**
   * حساب أيام الحلب منذ الولادة (Days in Milk - DIM)
   */
  static calculateDaysInMilk(lastCalvingDate: Date, referenceDate: Date = new Date()): number {
    const diffTime = Math.abs(referenceDate.getTime() - lastCalvingDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
