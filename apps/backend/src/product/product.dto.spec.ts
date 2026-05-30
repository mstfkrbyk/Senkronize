import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import {
  PRODUCT_COST_PRICE_MAX,
  UpdateProductDto,
} from './product.dto';

function validateUpdate(
  input: Partial<UpdateProductDto>,
): ReturnType<typeof validateSync> {
  const dto = plainToInstance(UpdateProductDto, input);
  return validateSync(dto);
}

describe('UpdateProductDto', () => {
  it('accepts optional costPrice as decimal', () => {
    const errors = validateUpdate({ costPrice: 42.5 });
    expect(errors).toHaveLength(0);
  });

  it('accepts empty body (partial patch)', () => {
    const errors = validateUpdate({});
    expect(errors).toHaveLength(0);
  });

  it('rejects negative costPrice', () => {
    const errors = validateUpdate({ costPrice: -1 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects costPrice above DECIMAL(12,2) max', () => {
    const errors = validateUpdate({ costPrice: PRODUCT_COST_PRICE_MAX + 0.01 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects non-numeric costPrice', () => {
    const dto = plainToInstance(UpdateProductDto, { costPrice: 'abc' });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
