'use client';

import { LogOut, RefreshCw, ServerCrash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type BackendUnavailableScreenProps = {
  title?: string;
  message?: string;
  reference?: string;
  onRetry?: () => void;
};

export default function BackendUnavailableScreen({
  title = 'The dashboard is temporarily unavailable',
  message = 'We could not reach the backend service. Your session is still saved, so you can retry without signing in again.',
  reference,
  onRetry,
}: BackendUnavailableScreenProps) {
  const retry = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    window.location.reload();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <ServerCrash aria-hidden="true" className="size-6" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="leading-6">{message}</CardDescription>
        </CardHeader>
        {reference ? (
          <CardContent>
            <p className="text-xs text-muted-foreground">Reference: {reference}</p>
          </CardContent>
        ) : null}
        <CardFooter className="gap-3">
          <Button type="button" onClick={retry}>
            <RefreshCw aria-hidden="true" />
            Retry
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/auth/logout?reason=manual">
              <LogOut aria-hidden="true" />
              Sign out
            </a>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
