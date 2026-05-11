// src/presentation/guards/workspace-validation.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { WorkspaceMockService } from '../../infrastructure/services/workspace.mock.service';

/**
 * Guard để validate workspace tồn tại và user có quyền truy cập
 * Sẽ kiểm tra:
 * 1. Workspace ID từ request params hoặc body
 * 2. User ID từ headers (x-user-id)
 * 3. Validate workspace tồn tại
 * 4. Validate user là member của workspace
 */
@Injectable()
export class WorkspaceValidationGuard implements CanActivate {
  constructor(private readonly workspaceService: WorkspaceMockService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Lấy userId từ headers (giả định được gửi từ API Gateway sau khi xác thực)
    // Nếu không có, dùng mock user vì User Service chưa implement
    const userId = request.headers['x-user-id'] || 'user-123';
    const userName = request.headers['x-user-name'] || 'Mock User';

    // Lấy workspaceId từ body (nếu POST/PUT) hoặc query params
    let workspaceId = request.body?.workspaceId || request.query?.workspaceId;
    
    // Nếu không tìm thấy, có thể cần lấy từ resource ID (ví dụ: GET /tasks/:id)
    // Lúc này sẽ validate khi fetch task và check workspace
    
    if (!workspaceId) {
      // Cho phép tiếp tục, validation sẽ xảy ra ở handler level
      // Attach mock user vào request
      request.user = { id: userId, name: userName };
      return true;
    }

    // Validate workspace tồn tại
    const workspaceExists = await this.workspaceService.validateWorkspaceAsync(workspaceId);
    if (!workspaceExists) {
      throw new ForbiddenException(`Workspace ${workspaceId} not found`);
    }

    // Validate user là member của workspace
    const isMember = await this.workspaceService.checkUserPermissionAsync(
      workspaceId,
      userId,
      'member',
    );
    if (!isMember) {
      throw new ForbiddenException(
        `User ${userId} does not have access to workspace ${workspaceId}`,
      );
    }

    // Attach workspace info vào request object để dùng ở handler
    request.workspace = { id: workspaceId, userId };
    request.user = { id: userId, name: userName };

    return true;
  }
}
