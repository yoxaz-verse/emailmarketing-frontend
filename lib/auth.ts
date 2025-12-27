import { cookies } from 'next/headers';

export async function getAuth() {
  const cookieStore = await cookies();

  const token = cookieStore.get('auth_token')?.value;
  const role = cookieStore.get('user_role')?.value;
  const operator_id = cookieStore.get('operator_id')?.value;

  if (!token || !role) {
    return null;
  }

  return {
    token,
    role,
    operator_id
  };
}
