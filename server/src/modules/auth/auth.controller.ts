import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { AuthService } from './auth.service';
import { LoginInput, RefreshTokenInput, RegisterInput, UpdateProfileInput } from './auth.types';

export class AuthController {
  private readonly authService = new AuthService();

  private getUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    return req.user.id;
  }

  register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.register(req.body as RegisterInput);
    res.status(201).json({ success: true, data: result });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.login(req.body as LoginInput);
    res.status(200).json({ success: true, data: result });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.refresh(req.body as RefreshTokenInput);
    res.status(200).json({ success: true, data: result });
  };

  logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new AppError(401, 'Missing or invalid authorization token', 'UNAUTHORIZED');
    }
    await this.authService.logout(token);
    res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
  };

  me = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const user = await this.authService.getProfile(userId);
    res.status(200).json({ success: true, data: user });
  };

  updateMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const user = await this.authService.updateProfile(userId, req.body as UpdateProfileInput);
    res.status(200).json({ success: true, data: user });
  };
}
