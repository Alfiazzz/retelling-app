// Конфиг тарифных планов.
// В MVP все пользователи на плане 'free' с максимальными правами (демо-режим).
// При запуске монетизации — просто заполни ограничения для каждого плана.

export const PLANS = {
  free: {
    name:            'Бесплатный',
    maxRetellings:   3,          // в месяц (999 = безлимит в MVP)
    maxWordCount:    500,
    maxChildProfiles: 1,
    emailReport:     false,
    multiPage:       false,
    sessionHistory:  3,
  },
  family: {
    name:            'Семейный',
    maxRetellings:   999,
    maxWordCount:    3000,
    maxChildProfiles: 3,
    emailReport:     true,
    multiPage:       true,
    sessionHistory:  30,
  },
  teacher: {
    name:            'Учительский',
    maxRetellings:   999,
    maxWordCount:    99999,
    maxChildProfiles: 35,
    emailReport:     true,
    multiPage:       true,
    sessionHistory:  999,
  },
}

// MVP: гость получает все права (режим демо без ограничений)
export const MVP_PLAN = {
  ...PLANS.family,
  name: 'MVP (демо)',
}

export function getPlan(planKey) {
  return PLANS[planKey] ?? MVP_PLAN
}

export function canUseFeature(plan, feature) {
  const p = getPlan(plan)
  return !!p[feature]
}
