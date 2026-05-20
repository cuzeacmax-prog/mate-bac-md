"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
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

const schema = z.object({
  email: z.string().email("Email invalid"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    const supabase = createClient();
    // Răspuns identic indiferent dacă emailul există sau nu (anti-enumeration)
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Verifică emailul</CardTitle>
            <CardDescription>
              Dacă există un cont cu acest email, vei primi în câteva minute un
              link de resetare. Verifică și folderul spam.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/auth/login">
              <Button variant="outline" className="w-full">
                Înapoi la autentificare
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Resetare parolă</CardTitle>
          <CardDescription>
            Introdu emailul cu care te-ai înregistrat și îți trimitem un link de
            resetare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="elev@email.com"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Se trimite..." : "Trimite link de resetare"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Ți-ai amintit parola?{" "}
            <Link
              href="/auth/login"
              className="underline underline-offset-4 hover:text-primary"
            >
              Autentifică-te
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
