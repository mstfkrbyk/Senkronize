import { enUS, tr } from 'date-fns/locale';
import i18n from '@/i18n';

export function pricingDateLocale(): typeof tr {
  return i18n.language.startsWith('tr') ? tr : enUS;
}
