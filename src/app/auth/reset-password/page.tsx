"use client";

import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z
  .object({
    password: z.string().min(6, "Parola trebuie să aibă cel puțin 6 caractere"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Parolele nu coincid",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;
type PageState = "exchanging" | "ready" | "expired" | "success";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pageState, setPageState] = useState<PageState>("exchanging");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    async function init() {
      const code = searchParams.get("code");
      const supabase = createClient();

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        setPageState(error ? "expired" : "ready");
        return;
      }

      // Fără code — verifică dacă există sesiune activă (recovery sau normală)
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setPageState("ready");
      } else {
        router.replace("/auth/forgot-password");
      }
    }

    init();
  }, [searchParams, router]);

  async function onSubmit(data: FormData) {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: data.password });

    if (error) {
      setServerError(
        "A apărut o eroare. Încearcă să reiei procesul de resetare."
      );
      return;
    }

    setPageState("success");
    setTimeout(() => router.push("/app/chat"), 2000);
  }

  if (pageState === "exchanging") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Se verifică link-ul...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Link invalid sau expirat</CardTitle>
            <CardDescription>
              Link-ul de resetare a expirat sau a fost deja folosit. Solicită
              unul nou.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/auth/forgot-password">
              <Button className="w-full">Solicită un link nou</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Parolă schimbată!</CardTitle>
            <CardDescription>
              Parola a fost actualizată cu succes. Ești redirecționat
              automat...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Parolă nouă</CardTitle>
          <CardDescription>Alege o parolă nouă pentru contul tău.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Parola nouă</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmă parola nouă</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {serverError && (
              <p className="text-sm text-destructive text-center">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Se schimbă parola..." : "Schimbă parola"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
