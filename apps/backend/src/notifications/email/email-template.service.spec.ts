import { ConfigService } from '@nestjs/config';

import {
  EMAIL_PREVIEW_TEMPLATE_KEYS,
  EmailTemplateService,
} from './email-template.service';

function mockConfig(): ConfigService {
  return {
    get: jest.fn((key: string) => {
      if (key === 'PANEL_URL') {
        return 'https://app.example.test';
      }
      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService(mockConfig());
  });

  const assertRendered = (html: string): void => {
    expect(html.length).toBeGreaterThan(200);
    expect(html).toContain('<html');
    expect(html).not.toMatch(/\{\{[a-zA-Z0-9_]+\}\}/);
  };

  it.each([...EMAIL_PREVIEW_TEMPLATE_KEYS])(
    'should render %s without placeholder leaks',
    (key) => {
      const html = service.previewHtml(key);
      assertRendered(html);
    },
  );
});
