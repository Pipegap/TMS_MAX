import { z } from 'zod'

export interface DictItem {
  id: string
  label: string
}

export const REGIONS = [
  { id: '16', label: 'Республика Татарстан' },
  { id: '77', label: 'Москва' },
  { id: '78', label: 'Санкт-Петербург' },
  { id: '66', label: 'Свердловская область' },
  { id: '54', label: 'Новосибирская область' },
  { id: '23', label: 'Краснодарский край' },
] as const satisfies readonly DictItem[]

export const BUSINESS_FORMS = [
  { id: 'self_employed', label: 'Самозанятый' },
  { id: 'ip', label: 'ИП' },
  { id: 'ooo', label: 'ООО' },
] as const satisfies readonly DictItem[]

export const STAGES = [
  { id: 'idea', label: 'Ещё не открыл(а) бизнес' },
  { id: 'lt1', label: 'Работаю меньше года' },
  { id: 'y1_3', label: 'От 1 до 3 лет' },
  { id: 'gt3', label: 'Больше 3 лет' },
] as const satisfies readonly DictItem[]

export const INDUSTRIES = [
  { id: 'trade', label: 'Торговля' },
  { id: 'services', label: 'Услуги' },
  { id: 'food', label: 'Общепит' },
  { id: 'production', label: 'Производство' },
  { id: 'agro', label: 'Сельское хозяйство' },
  { id: 'it', label: 'IT' },
  { id: 'tourism', label: 'Туризм' },
  { id: 'construction', label: 'Строительство' },
  { id: 'other', label: 'Другое' },
] as const satisfies readonly DictItem[]

export const EMPLOYEES = [
  { id: 'none', label: 'Без сотрудников' },
  { id: 'e1_15', label: 'От 1 до 15' },
  { id: 'e16_100', label: 'От 16 до 100' },
] as const satisfies readonly DictItem[]

export const NEEDS = [
  { id: 'money_start', label: 'Деньги на запуск' },
  { id: 'money_growth', label: 'Деньги на развитие' },
  { id: 'equipment', label: 'Оборудование' },
  { id: 'export', label: 'Выход на экспорт' },
  { id: 'staff', label: 'Кадры' },
  { id: 'education', label: 'Обучение и консультации' },
  { id: 'tax', label: 'Налоговые льготы' },
] as const satisfies readonly DictItem[]

export const MEASURE_TYPES = [
  { id: 'grant', label: 'Грант' },
  { id: 'subsidy', label: 'Субсидия' },
  { id: 'loan', label: 'Льготный кредит' },
  { id: 'guarantee', label: 'Гарантия / поручительство' },
  { id: 'consultation', label: 'Консультация' },
  { id: 'tax_benefit', label: 'Налоговая льгота' },
] as const satisfies readonly DictItem[]

export function idsOf<const T extends readonly DictItem[]>(list: T) {
  return list.map((x) => x.id) as unknown as [
    T[number]['id'],
    ...T[number]['id'][],
  ]
}

export function labelOf(
  list: readonly DictItem[],
  id: string,
): string {
  return list.find((x) => x.id === id)?.label ?? id
}

export const dictionaries = {
  regions: REGIONS,
  businessForms: BUSINESS_FORMS,
  stages: STAGES,
  industries: INDUSTRIES,
  employees: EMPLOYEES,
  needs: NEEDS,
}

export const profileSchema = z.object({
  regionId: z.enum(idsOf(REGIONS), {
    error: 'Выберите регион',
  }),

  businessForm: z.enum(idsOf(BUSINESS_FORMS), {
    error: 'Выберите форму бизнеса',
  }),

  stage: z.enum(idsOf(STAGES), {
    error: 'Выберите стадию бизнеса',
  }),


  okvedCode: z
    .string()
    .trim()
    .min(1, 'Выберите ОКВЭД')
    .max(20),

  okvedName: z
    .string()
    .trim()
    .min(1, 'Выберите ОКВЭД')
    .max(500),

 
  industry: z.string().optional(),

  employees: z.enum(idsOf(EMPLOYEES), {
    error: 'Укажите численность сотрудников',
  }),

  needs: z
    .array(
      z.enum(idsOf(NEEDS), {
        error: 'Недопустимая цель',
      }),
      {
        error: 'Выберите хотя бы одну цель',
      },
    )
    .min(1, 'Выберите хотя бы одну цель')
    .max(NEEDS.length)
    .transform((arr) => [...new Set(arr)]),
})

export type ProfileInput = z.infer<typeof profileSchema>