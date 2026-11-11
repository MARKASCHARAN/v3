import { supabase, supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error.middleware';
import { AuthRepository } from './auth.repository';
import { LoginInput, RefreshTokenInput, RegisterInput, UpdateProfileInput } from './auth.types';

export class AuthService {
  constructor(private readonly authRepository: AuthRepository = new AuthRepository()) {}

  async register(input: RegisterInput) {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: input.name ? { data: { name: input.name } } : undefined,
    });

    if (error) {
      throw new AppError(error.status || 400, error.message, 'AUTH_REGISTER_FAILED');
    }

    const user = data.user
      ? await this.authRepository.upsertUser({
          id: data.user.id,
          email: data.user.email || input.email,
          name: input.name ?? null,
        })
      : null;

    return {
      user,
      session: data.session,
    };
  }

  async login(input: LoginInput) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user || !data.session) {
      throw new AppError(401, error?.message || 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const metadataName =
      typeof data.user.user_metadata?.name === 'string' ? data.user.user_metadata.name : undefined;

    const user = await this.authRepository.upsertUser({
      id: data.user.id,
      email: data.user.email || input.email,
      name: metadataName,
    });

    return {
      user,
      session: data.session,
    };
  }

  async refresh(input: RefreshTokenInput) {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: input.refreshToken,
    });

    if (error || !data.session) {
      throw new AppError(401, error?.message || 'Invalid or expired refresh token', 'UNAUTHORIZED');
    }

    return {
      session: data.session,
    };
  }

  async logout(accessToken: string) {
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken);
    if (error) {
      throw new AppError(error.status || 400, error.message, 'AUTH_LOGOUT_FAILED');
    }
  }

  async getProfile(userId: string) {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    await this.getProfile(userId);
    return this.authRepository.updateUserName(userId, input.name);
  }
}
