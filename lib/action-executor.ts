'use client';

import { toast } from 'react-hot-toast';

export async function executeAction<T>(
  action: () => Promise<T>,
  options?: {
    success?: string;
    error?: string;
  }
): Promise<T | undefined> {
  try {
    const result = await action();

    if (options?.success) {
      toast.success(options.success);
    }

    return result;
  } catch (err: any) {
    const message =
      err?.message ||
      options?.error ||
      'Something went wrong';

    toast.error(message);

    // IMPORTANT:
    // Do NOT swallow redirects
    if (
      message.includes('NEXT_REDIRECT') ||
      message.includes('redirect')
    ) {
      throw err;
    }

    return undefined;
  }
}
