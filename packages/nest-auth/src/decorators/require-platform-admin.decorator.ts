import { SetMetadata } from '@nestjs/common';
import { REQUIRE_PLATFORM_ADMIN_KEY } from '../constants';

export const RequirePlatformAdmin = () => SetMetadata(REQUIRE_PLATFORM_ADMIN_KEY, true);
