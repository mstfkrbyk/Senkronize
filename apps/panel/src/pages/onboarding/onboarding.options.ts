import type { ErpOption, MarketplaceOption } from './onboarding.types';

import { buildErpOptions, buildMarketplaceOptions } from '@/lib/connection-options';

export const MARKETPLACE_OPTIONS: MarketplaceOption[] = buildMarketplaceOptions();

export const ERP_OPTIONS: ErpOption[] = buildErpOptions();
