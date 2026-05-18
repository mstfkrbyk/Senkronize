jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpasswordhash'),
  compare: jest.fn(),
}));

import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { OrgType, PlanTier, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep } from 'jest-mock-extended';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CacheService } from '../../common/cache/cache.service';
import { NotificationService } from '../../notification/notification.service';
import { EmailService } from '../../notifications/email/email.service';
import { SmsService } from '../../notifications/sms/sms.service';
import { PartnerService } from '../../partner/partner.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnomalyDetectionService } from '../../security/anomaly-detection.service';
import { RegisterDto } from '../auth.dto';
import { AuthService } from '../auth.service';
import { TwoFactorService } from '../two-factor.service';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: DeepMockProxy<PrismaService>;
  let jwtSignAsync: jest.Mock;

  beforeEach(async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedpasswordhash');
    (bcrypt.compare as jest.Mock).mockReset();

    prismaService = mockDeep<PrismaService>();
    prismaService.user.update.mockResolvedValue({} as never);
    prismaService.organization.findUnique.mockResolvedValue(null);

    jwtSignAsync = jest
      .fn()
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const jwtVerifyAsync = jest.fn();

    prismaService.$transaction.mockImplementation(
      async (arg: unknown) => {
        if (typeof arg === 'function') {
          const tx = {
            organization: {
              create: jest.fn().mockResolvedValue({
                id: 'org-def',
                slug: 'def',
                name: 'Def',
              }),
            },
            user: {
              create: jest.fn().mockResolvedValue({
                id: 'user-def',
                organizationId: 'org-def',
                phone: null,
              }),
            },
            subscription: { create: jest.fn().mockResolvedValue({}) },
            refreshToken: {
              create: jest.fn().mockResolvedValue({ id: 'rt-def' }),
            },
            userSession: {
              create: jest.fn().mockResolvedValue({ id: 'sess-def' }),
            },
          };
          return (arg as (t: typeof tx) => Promise<unknown>)(tx);
        }
        return Promise.all(arg as Promise<unknown>[]);
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        {
          provide: JwtService,
          useValue: { signAsync: jwtSignAsync, verifyAsync: jwtVerifyAsync },
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
        {
          provide: PartnerService,
          useValue: {
            validateInviteToken: jest.fn(),
            completeClientOnboarding: jest.fn(),
          },
        },
        {
          provide: TwoFactorService,
          useValue: { verifyTokenForLogin: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: {
            del: jest.fn().mockResolvedValue(undefined),
            incrWithExpire: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: AnomalyDetectionService,
          useValue: { checkNewIpLogin: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('yeni kullanıcı ve organizasyon oluşturup token döndürmeli', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);
      prismaService.organization.findFirst.mockResolvedValue(null);
      prismaService.$transaction
        .mockReset()
        .mockImplementationOnce(
          async (arg: unknown) => {
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
            return (arg as (t: typeof tx) => Promise<unknown>)(tx);
          },
        )
        .mockImplementationOnce(
          async (arg: unknown) => {
            const tx = {
              refreshToken: {
                create: jest.fn().mockResolvedValue({ id: 'rt1' }),
              },
              userSession: {
                create: jest.fn().mockResolvedValue({ id: 'sess-reg' }),
              },
            };
            return (arg as (t: typeof tx) => Promise<unknown>)(tx);
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

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.sessionId).toBe('sess-reg');
      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'new@example.com', deletedAt: null },
      });
      expect(prismaService.$transaction).toHaveBeenCalledTimes(2);
    });

    it('mevcut e-posta için ConflictException vermeli', async () => {
      prismaService.user.findFirst.mockResolvedValue({
        id: 'existing',
        email: 'dup@example.com',
      } as never);

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

      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('mevcut vergi numarası için ConflictException vermeli', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);
      prismaService.organization.findFirst.mockResolvedValue({ id: 'org-x' } as never);

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

      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('geçersiz vergi numarası DTO doğrulamasında hata üretmeli', () => {
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
  });

  describe('login', () => {
    it('geçerli kimlik bilgileri ile token döndürmeli', async () => {
      jwtSignAsync
        .mockReset()
        .mockResolvedValueOnce('access-2')
        .mockResolvedValueOnce('refresh-2');

      prismaService.user.findFirst.mockResolvedValue({
        id: 'u2',
        email: 'ok@example.com',
        passwordHash: '$2b$10$stored',
        organizationId: 'org-2',
        role: UserRole.OWNER,
        twoFactorEnabled: false,
        organization: { deletedAt: null, suspended: false },
      } as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      prismaService.$transaction.mockImplementationOnce(
        async (arg: unknown) => {
          const tx = {
            refreshToken: {
              create: jest.fn().mockResolvedValue({ id: 'rt1' }),
            },
            userSession: {
              create: jest.fn().mockResolvedValue({ id: 'sess-def' }),
            },
          };
          return (arg as (t: typeof tx) => Promise<unknown>)(tx);
        },
      );

      const result = await service.login({
        email: 'OK@Example.com',
        password: 'correct',
      });

      expect(result).toEqual({
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        sessionId: 'sess-def',
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: { lastLoginAt: expect.any(Date), lockedUntil: null },
      });
    });

    it('yanlış şifre için UnauthorizedException vermeli', async () => {
      prismaService.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: '$2b$10$stored',
        organizationId: 'org-1',
        role: UserRole.OWNER,
        twoFactorEnabled: false,
        organization: { deletedAt: null, suspended: false },
      } as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('recommendPlan', () => {
    it('erpCount=0, marketplaceCount=1 → BASLANGIC', () => {
      expect(
        service.recommendPlan({
          erpCount: 0,
          marketplaceCount: 1,
          ecommerceCount: 0,
        }).recommendedPlan,
      ).toBe(PlanTier.BASLANGIC);
    });

    it('erpCount=1 → PRO önerisi', () => {
      expect(
        service.recommendPlan({
          erpCount: 1,
          marketplaceCount: 5,
          ecommerceCount: 0,
        }).recommendedPlan,
      ).toBe(PlanTier.PRO);
    });
  });

  describe('iki aşamalı doğrulama', () => {
    it('2FA etkinse geçici jeton dönmeli', async () => {
      jwtSignAsync.mockReset().mockResolvedValueOnce('temp-2fa-jwt');

      prismaService.user.findFirst.mockResolvedValue({
        id: 'u-2fa',
        email: '2fa@example.com',
        passwordHash: '$2b$10$stored',
        organizationId: 'org-2fa',
        role: UserRole.OWNER,
        twoFactorEnabled: true,
        organization: { deletedAt: null, suspended: false },
      } as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: '2fa@example.com',
        password: 'correct',
      });

      expect(result).toEqual({
        requiresTwoFactor: true,
        tempToken: 'temp-2fa-jwt',
      });
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });
  });
});
