import checkMe from '@/utils/middlewares/checkMe';

export interface AuthorizedUser {
  id: string;
  name: string;
  email: string;
  isOnboardingComplete?: boolean;
  isEmailVerified?: boolean;
}

interface UseMeResult {
  success: boolean;
  message: string;
  user?: AuthorizedUser;
}

const getMe = async (withUserFetch: boolean = true): Promise<UseMeResult> => {
  const result = await checkMe(withUserFetch);

  if (!result.success || !result.user) {
    return {
      success: false,
      message: result.message || 'Unauthorized',
    };
  }

  return {
    success: true,
    message: result.message || 'Authorized',
    user: result.user as AuthorizedUser,
  };
};

export const useMe = getMe;

export default getMe;
