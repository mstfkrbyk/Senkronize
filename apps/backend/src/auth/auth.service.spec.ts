import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NotificationService } from '../notification/notification.service';
import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const prisma = {
      user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      organization: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirstOrThrow: jest.fn(),
      },
      subscription: { create: jest.fn() },
      refreshToken: { create: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'JWT_EXPIRES_IN') return '15m';
              if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
              return undefined;
            }),
            getOrThrow: jest.fn().mockImplementation((key: string) => {
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
          useValue: {
            dispatch: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendWelcome: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
