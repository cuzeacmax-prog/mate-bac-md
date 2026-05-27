'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { track, Events } from '@/lib/analytics/posthog-client';

export default function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleAuth() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding/diagnostic-intro`,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      setError('Nu s-a putut conecta. Încearcă din nou.');
      setLoading(false);
    }
    // On success, browser redirects to Google — no further action needed
    track(Events.SIGNUP_COMPLETED, { method: 'google' });
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full">
      <motion.div
        className="w-full space-y-8 text-center"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Pasul 3 din 3</p>
          <h2 className="text-2xl font-bold">Salvează progresul tău</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Creează un cont gratuit în 5 secunde.<br />
            Predicția BAC și planul tău rămân salvate.
          </p>
        </div>

        {/* Google OAuth button */}
        <Button
          size="lg"
          variant="outline"
          className="w-full h-14 text-base font-medium border-2 gap-3"
          onClick={handleGoogleAuth}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {/* Google Icon */}
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuă cu Google
            </>
          )}
        </Button>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <p className="text-xs text-muted-foreground">
          Prin continuare, accepți{' '}
          <a href="/termeni" className="underline underline-offset-2">
            Termenii și condițiile
          </a>
          . Gratuit 30 mesaje/lună, fără card.
        </p>

        {/* Already have account */}
        <p className="text-sm text-muted-foreground">
          Ai deja cont?{' '}
          <button
            onClick={() => router.push('/auth/login?redirectTo=/app/chat')}
            className="text-primary underline underline-offset-2"
          >
            Autentifică-te
          </button>
        </p>
      </motion.div>
    </div>
  );
}
