import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { EmailTemplateService } from './email-template.service';
import { EmailService } from './email.service';

describe('EmailService', () => {
  it('should skip Resend when API key is missing (mock mode)', async () => {
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({ data: {} });
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'RESEND_API_KEY') {
          return '';
        }
        if (key === 'PANEL_URL') {
          return 'https://app.example.test';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    const templateService = new EmailTemplateService(config);
    const service = new EmailService(config, templateService);
    await service.sendWelcome('user@example.com', 'Ali');

    expect(postSpy).not.toHaveBeenCalled();
    postSpy.mockRestore();
  });
});
