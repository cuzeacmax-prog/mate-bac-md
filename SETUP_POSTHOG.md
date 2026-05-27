# 📊 Setup Posthog Analytics — 5 minute

## 1. Creează cont (2 min)

🔗 https://eu.posthog.com/signup
*(EU region — GDPR compliant pentru Moldova/Europa)*

- Sign up cu email: `cuzeacmax@gmail.com`
- Organization name: `Mate BAC MD`
- Project name: `Production`

---

## 2. Copiază API Key (30 sec)

🔗 **Project Settings → API Keys** (bara stânga → gear icon)

- Copiază valoarea `phc_xxxxxxxxxxxx...` (Project API Key)

---

## 3. Adaugă în Vercel (2 min)

🔗 https://vercel.com/dashboard → `mate-bac-md` → **Settings → Environment Variables**

Adaugă **ambele** variabile (apply to: Production + Preview + Development):

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_xxxxx` (copiată mai sus) |
| `POSTHOG_KEY` | `phc_xxxxx` (aceeași valoare) |

> `NEXT_PUBLIC_POSTHOG_KEY` — folosit client-side (browser tracking)  
> `POSTHOG_KEY` — folosit server-side (API routes)

**Save** → merge la **Deployments** → ultimul deployment → ⋯ → **Redeploy**

---

## 4. Adaugă și în .env.local (pentru dev local)

Deschide `.env.local` și adaugă:
```
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxx
POSTHOG_KEY=phc_xxxxx
```

---

## 5. Verificare (1 min)

După redeploy, deschide:
```
https://mate-bac-md.vercel.app/onboarding/welcome
```

**Posthog Dashboard → Activity → Live Events**

Ar trebui să vezi `$pageview` cu `current_url = /onboarding/welcome`.

---

## Events urmărite automat

| Event | Declanșat la |
|-------|-------------|
| `onboarding_started` | Welcome → Start |
| `onboarding_goal_selected` | Selectare notă țintă |
| `onboarding_grade_selected` | Selectare clasă |
| `diagnostic_started` | Intro → Începe testul |
| `diagnostic_completed` | Ultimul răspuns submitted |
| `bac_prediction_revealed` | Animație număr completă |
| `first_lesson_completed` | Feedback screen → Continuă |
| `trial_activated` | Click "Activează Trial" |
| `trial_skipped` | Click "Varianta gratuită" |

---

## Dashboards recomandate (după 1 săptămână de date)

1. **Onboarding funnel:** welcomed → goal → grade → auth → diagnostic → reveal → trial
2. **Conversion rate:** diagnostic_started / onboarding_started
3. **Trial activation rate:** trial_activated / first_lesson_completed
