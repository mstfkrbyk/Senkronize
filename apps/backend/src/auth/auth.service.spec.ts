jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpasswordhash'),
  compare: jest.fn(),
}));

import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { OrgType, PlanTier, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { NotificationService } from '../notification/notification.service';
import { EmailService } from '../notifications/email/email.service';
import { SmsService } from '../notifications/sms/sms.service';
import { PrismaService } from '../prisma/prisma.service';

import { AuthService } from './auth.service';
import { RegisterDto } from './auth.dto';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findFirst: jest.Mock; update: jest.Mock };
    organization: { findUnique: jest.Mock; findFirst: jest.Mock };
    subscription: { create: jest.Mock };
    refreshToken: { create: jest.Mock; findMany: jest.Mock; delete: jest.Mock };
    $transaction: jest.Mock;
  };
  let jwtSignAsync: jest.Mock;

  beforeEach(async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedpasswordhash');
    (bcrypt.compare as jest.Mock).mockReset();

    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
      organization: { findUnique: jest.fn(), findFirst: jest.fn() },
      subscription: { create: jest.fn().mockResolvedValue({}) },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'rt1' }),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    jwtSignAsync = jest
      .fn()
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { signAsync: jwtSignAsync },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_EXPIRES_IN') return '15m';
              if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
              return undefined;
            }),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') {
                return 'test_jwt_secret_minimum_thirty_two_characters';
              }
              if (key === 'JWT_REFRESH_SECRET') {
                return 'test_refresh_secret_minimum_thirty_two_characters';
              }
              return 'test';
            }),
          },
        },
        {
          provide: NotificationService,
          useValue: { dispatch: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: EmailService,
          useValue: { sendWelcome: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SmsService,
          useValue: { sendWelcome: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('register: başarılı kayıt access ve refresh token döner', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.organization.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      async (cb: (tx: typeof prisma) => Promise<unknown>) => {
        const tx = {
          organization: {
            create: jest.fn().mockResolvedValue({
              id: 'org-1',
              slug: 'acme-abc',
              name: 'Acme',
            }),
          },
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-1',
              organizationId: 'org-1',
              phone: null,
            }),
          },
          subscription: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx as unknown as typeof prisma);
      },
    );

    const result = await service.register({
      email: 'New@Example.com',
      password: 'Secret123!',
      name: 'Ada',
      phone: '05001112233',
      companyName: 'Acme',
      taxNumber: '1234567890',
      taxOffice: 'Kadıköy',
      address: 'Adres 1',
      city: 'İstanbul',
      orgType: OrgType.DIRECT,
    });

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'new@example.com', deletedAt: null },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('register: aynı e-posta ConflictException', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'existing',
      email: 'dup@example.com',
    });

    await expect(
      service.register({
        email: 'dup@example.com',
        password: 'Secret123!',
        name: 'Bob',
        phone: '05001112233',
        companyName: 'Bob Ltd.',
        taxNumber: '0987654321',
        taxOffice: 'Merkez',
        address: 'Adres',
        city: 'Ankara',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('register: aynı vergi numarası ConflictException (sabit mesaj)', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.organization.findFirst.mockResolvedValue({ id: 'org-x' });

    try {
      await service.register({
        email: 'tax@example.com',
        password: 'Secret123!',
        name: 'Ali',
        phone: '05001112233',
        companyName: 'Firma A.Ş.',
        taxNumber: '5555555555',
        taxOffice: 'Şişli',
        address: 'Adres',
        city: 'İstanbul',
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      const body = (e as ConflictException).getResponse();
      const msg =
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof (body as { message: unknown }).message === 'string'
          ? (body as { message: string }).message
          : String(body);
      expect(msg).toBe('Bu vergi numarasıyla zaten kayıt mevcut');
    }

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('register: geçersiz vergi numarası — DTO doğrulaması BadRequestException', () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'dto@example.com',
      password: 'Secret123!',
      name: 'Ada',
      phone: '05001112233',
      companyName: 'Acme',
      taxNumber: '12345',
      taxOffice: 'Kadıköy',
      address: 'Adres 1',
      city: 'İstanbul',
    });
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.some((e) => e.property === 'taxNumber')).toBe(true);
    expect(() => {
      if (errors.length > 0) {
        throw new BadRequestException(errors);
      }
    }).toThrow(BadRequestException);
  });

  it('recommendPlan: erpCount=0, marketplaceCount=1 → BASLANGIC', () => {
    expect(
      service.recommendPlan({
        erpCount: 0,
        marketplaceCount: 1,
        ecommerceCount: 0,
      }).recommendedPlan,
    ).toBe(PlanTier.BASLANGIC);
  });

  it('recommendPlan: erpCount=0, marketplaceCount=3 → GELISIM', () => {
    expect(
      service.recommendPlan({
        erpCount: 0,
        marketplaceCount: 3,
        ecommerceCount: 0,
      }).recommendedPlan,
    ).toBe(PlanTier.GELISIM);
  });

  it('recommendPlan: erpCount=1, marketplaceCount=5 → PRO', () => {
    expect(
      service.recommendPlan({
        erpCount: 1,
        marketplaceCount: 5,
        ecommerceCount: 0,
      }).recommendedPlan,
    ).toBe(PlanTier.PRO);
  });

  it('recommendPlan: erpCount=2, marketplaceCount=10 → KURUMSAL', () => {
    expect(
      service.recommendPlan({
        erpCount: 2,
        marketplaceCount: 10,
        ecommerceCount: 0,
      }).recommendedPlan,
    ).toBe(PlanTier.KURUMSAL);
  });

  it('login: geçersiz şifre UnauthorizedException fırlatır', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: '$2b$10$stored',
      organizationId: 'org-1',
      role: UserRole.OWNER,
      organization: { deletedAt: null, suspended: false },
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: 'a@b.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('login: başarılı girişte access + refresh token döner', async () => {
    jwtSignAsync
      .mockReset()
      .mockResolvedValueOnce('access-2')
      .mockResolvedValueOnce('refresh-2');

    prisma.user.findFirst.mockResolvedValue({
      id: 'u2',
      email: 'ok@example.com',
      passwordHash: '$2b$10$stored',
      organizationId: 'org-2',
      role: UserRole.OWNER,
      organization: { deletedAt: null, suspended: false },
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'OK@Example.com',
      password: 'correct',
    });

    expect(result).toEqual({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: { lastLoginAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });
});
