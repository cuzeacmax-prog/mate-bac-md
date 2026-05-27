# 🔑 Setup Google OAuth — 10 minute

## 1. Google Cloud Console (5 min)

### A. Creează proiect
🔗 https://console.cloud.google.com/projectcreate
- **Project name:** `Mate BAC MD`
- Create

### B. OAuth Consent Screen
🔗 (din proiect) → **APIs & Services → OAuth consent screen**
- User Type: **External** → Create
- App name: `Mate BAC MD`
- User support email: `cuzeacmax@gmail.com`
- Authorized domains: adaugă `vercel.app` și domeniul tău (dacă ai)
- Developer contact: `cuzeacmax@gmail.com`
- Save and Continue (la Scopes — skip, la Test users — add yourself)

### C. Creează OAuth Client ID
🔗 **APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID**
- Application type: **Web application**
- Name: `Mate BAC MD Web`

**Authorized JavaScript origins** (adaugă toate 3):
```
https://mate-bac-md.vercel.app
https://zrudijfezfjshpdymtst.supabase.co
http://localhost:3000
```

**Authorized redirect URIs** (exact):
```
https://zrudijfezfjshpdymtst.supabase.co/auth/v1/callback
```

- **Create**
- 📋 **COPIAZĂ** Client ID + Client Secret (le vei folosi la pasul 2)

---

## 2. Supabase — activează providerul (3 min)

🔗 https://app.supabase.com/project/zrudijfezfjshpdymtst/auth/providers

- Găsește **Google** în listă → toggle **ON**
- Paste **Client ID** (de la pasul 1C)
- Paste **Client Secret** (de la pasul 1C)
- **Save**

---

## 3. Test (2 min)

```
https://mate-bac-md.vercel.app
```

- Logout (dacă ești logat)
- Mergi la `/onboarding/auth`
- Click **Continuă cu Google**
- Ar trebui: popup Google → selectezi contul → redirecționat la `/onboarding/diagnostic-intro`

✅ Dacă ajungi la diagnostic-intro, OAuth funcționează.

---

## Troubleshooting

| Eroare | Soluție |
|--------|---------|
| `redirect_uri_mismatch` | Verifică exact URI-ul din Google Console (fără slash la final) |
| `This app isn't verified` | Normal în dev — click "Advanced" → "Go to Mate BAC MD (unsafe)" |
| `Access blocked` | Adaugă-ți email-ul ca Test User în OAuth consent screen |
