/**
 * Kobara Mobile — Service d'Authentification
 * 
 * Appelle l'API REST du backend Kobara web.
 * Réutilise la MÊME logique de vérification que NextAuth.
 */

import ENV from '@/config/env';

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
}

export interface MerchantProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_slug: string;
  logo_url?: string;
  email: string;
  phone?: string;
  address?: string;
  category?: string;
  status: string;
  available_balance: number;
  pending_balance: number;
  currency: string;
}

export interface LoginResponse {
  success: boolean;
  user: AuthUser;
  merchant: MerchantProfile | null;
  accessToken: string;
  refreshToken: string;
  merchantProfileComplete: boolean;
  error?: string;
}

export interface AuthError {
  message: string;
  code: 'INVALID_CREDENTIALS' | 'ACCOUNT_INACTIVE' | 'ACCOUNT_NOT_VERIFIED' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'UNAUTHORIZED';
}

class AuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = ENV.API_URL;
  }

  /**
   * Authentifie un utilisateur avec email et mot de passe.
   * Appelle le backend Kobara web (même système que NextAuth).
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/mobile/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client': 'kobara-mobile',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          message: data.error || 'Identifiants incorrects.',
          code: data.code || 'INVALID_CREDENTIALS',
        } as AuthError;
      }

      return data as LoginResponse;
    } catch (error: any) {
      if (error.code) {
        throw error; // Already an AuthError
      }
      
      // Network error
      throw {
        message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
        code: 'NETWORK_ERROR',
      } as AuthError;
    }
  }

  /**
   * Rafraîchit le token d'accès.
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/mobile/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client': 'kobara-mobile',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
           throw { code: 'UNAUTHORIZED' };
        }
        throw new Error('Token refresh failed');
      }

      return await response.json();
    } catch (error: any) {
      if (error.code === 'UNAUTHORIZED') {
        throw {
          message: 'Session expirée. Veuillez vous reconnecter.',
          code: 'UNAUTHORIZED',
        } as AuthError;
      }
      // Fallback for network errors
      throw { message: 'Network or Server Error', code: 'SERVER_ERROR' } as AuthError;
    }
  }

  /**
   * Récupère le profil utilisateur + marchand.
   */
  async getProfile(accessToken: string): Promise<{ user: AuthUser; merchant: MerchantProfile | null }> {
    const response = await fetch(`${this.baseUrl}/api/auth/mobile/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Client': 'kobara-mobile',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw { code: 'UNAUTHORIZED' };
      }
      throw new Error('Failed to fetch profile');
    }

    return await response.json();
  }
}

export const authService = new AuthService();
export default authService;
