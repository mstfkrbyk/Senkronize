import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentOrgPayload = { id: string; isImpersonating: boolean };

export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentOrgPayload => {
    const request = ctx.switchToHttp().getRequest();
    return {
      id: request.user.currentOrgId,
      isImpersonating: request.user.isImpersonating,
    };
  },
);
