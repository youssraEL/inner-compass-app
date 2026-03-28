# Istiqama — Inner Compass App

> A personal growth mobile app for building daily life and spiritual habits, guided by your own principles and AI-powered reflections.

## What this app does

Inner Compass helps you build a strong, self-validated identity by defining the principles you live by, tracking daily life and spiritual habits against those principles, and reflecting each evening with an AI coach. It keeps you accountable to yourself — not to external approval — and gives you an honest weekly record of who you're becoming.

## Screenshots

> Placeholder — add screenshots here once the UI is built and running on a device.

## Tech stack

| Layer | Technology |
|---|---|
| Mobile framework | React Native + Expo (managed workflow) |
| Auth | Supabase Auth + Google OAuth |
| Database | Supabase (PostgreSQL + Row Level Security) |
| AI | Claude API (`claude-sonnet-4-20250514`) |
| Navigation | React Navigation (bottom tabs + stack) |
| Local storage | AsyncStorage |
| CI/CD | GitHub Actions + EAS Build + EAS Update |

## Project structure

```
inner-compass-app/
├── App.js                        # Root component — providers + navigator
├── index.js                      # Expo entry point
├── app.json                      # Expo config (name, scheme, icons)
├── babel.config.js               # Babel config (includes Reanimated plugin)
├── eas.json                      # EAS build profiles (dev / preview / production)
├── .env.example                  # Environment variable template
│
├── src/
│   ├── types/
│   │   └── index.ts              # Shared TypeScript types (User, Habit, Principle, etc.)
│   │
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client with AsyncStorage session
│   │   ├── AuthContext.tsx       # Auth provider — session, user profile, first-login
│   │   ├── constants.ts          # Colors, default principles, default habits
│   │   └── systemPrompts.ts      # Claude system prompts per chat context
│   │
│   ├── navigation/
│   │   └── AppNavigator.tsx      # Auth gate → Onboarding gate → Tabs + Chat modal
│   │
│   └── screens/
│       ├── auth/
│       │   └── AuthScreen.tsx    # Google OAuth sign-in
│       ├── onboarding/
│       │   └── OnboardingScreen.tsx  # 4-step setup: welcome → principles → habits → done
│       ├── home/
│       │   └── HomeScreen.tsx    # Today tab: habit checkboxes, reflection, AI entry points
│       ├── chat/
│       │   └── ChatScreen.tsx    # Streaming Claude chat (5 context modes)
│       ├── principles/
│       │   └── PrinciplesScreen.tsx  # Full CRUD + reorder for personal principles
│       ├── habits/
│       │   └── HabitsScreen.tsx  # Toggle, edit, add custom habits by category
│       └── history/
│           └── HistoryScreen.tsx # 5-week dot grid, streaks, last-7-days breakdown
│
├── supabase/
│   └── schema.sql                # Full schema + RLS policies (run once in Supabase SQL editor)
│
└── .github/
    ├── CODEOWNERS                # Auto-assigns reviewers on every PR
    ├── pull_request_template.md  # PR checklist (device tested, RLS, screenshots)
    └── workflows/
        ├── ci.yml                # Lint + typecheck + test on every push and PR
        ├── preview.yml           # EAS Update preview + QR code comment on PRs to main
        └── deploy.yml            # OTA update → production + optional native build on push to main
```

## Prerequisites

Before running this project you need:

- **Node.js 18** or higher — [nodejs.org](https://nodejs.org)
- **Expo CLI** — `npm install -g expo-cli`
- **EAS CLI** — `npm install -g eas-cli`
- A **Supabase** account and project — [supabase.com](https://supabase.com)
- An **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)
- A **Google Cloud project** with OAuth 2.0 credentials — [console.cloud.google.com](https://console.cloud.google.com)

## Environment variables

Create a `.env` file in the project root (copy from `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_ANTHROPIC_API_KEY=your_anthropic_api_key
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Where to get each value:

| Variable | Source |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → your project → Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → your project → Settings → API → anon public key |
| `EXPO_PUBLIC_ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys → Create key |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID |

> **Note:** The `EXPO_PUBLIC_` prefix makes these variables available in the Expo client bundle. For server-side only usage (e.g. a backend proxy), omit the prefix.

## Supabase setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Open the **SQL Editor** and run the full contents of `supabase/schema.sql`
   — this creates the `users`, `principles`, `habits`, and `daily_checkins` tables with RLS enabled
3. Enable Google as an OAuth provider:
   **Authentication → Providers → Google** → toggle on
4. Paste your Google OAuth **Client ID** and **Client Secret** (from Google Cloud Console)
5. Copy the **Supabase callback URL** shown in that panel and add it to Google Cloud Console:
   **APIs & Services → Credentials → your OAuth client → Authorised redirect URIs**

## How to run locally

```bash
git clone https://github.com/youssrael/inner-compass-app.git
cd inner-compass-app
npm install
cp .env.example .env
# Fill in your .env values
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone (iOS or Android).

## How to run on a real device (development build)

Use EAS to build a development client with full native module support:

```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android
```

## How to deploy (production)

### OTA update — for JS/UI changes (no App Store review needed)

```bash
eas update --branch production --message "describe your change"
```

This pushes the JS bundle instantly to all users' phones within minutes.

### Full native build — when native code or packages change

```bash
eas build --platform all --profile production
```

Then submit to the stores:

```bash
eas submit --platform all
```

### CI/CD — automatic via GitHub Actions

| Event | What happens |
|---|---|
| Push to any branch | TypeScript check + ESLint + tests run |
| PR opened/updated to `main` | Preview EAS Update created + QR code posted as PR comment |
| Merge to `main` | OTA update pushed to production; native build triggered if native files changed |

## GitHub secrets required

**Repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Where to get it |
|---|---|
| `EXPO_TOKEN` | expo.dev → account settings → access tokens → Create Token |
| `SLACK_WEBHOOK_URL` | Slack app settings → Incoming Webhooks (optional — deploy notifications) |

> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `ANTHROPIC_API_KEY` are set per EAS build profile inside `eas.json` → `env`, or stored as EAS Secrets via `eas secret:create` for better security.

## Branch strategy

| Branch | Purpose |
|---|---|
| `main` | Production — auto-deploys on every push |
| `develop` | Staging — CI checks only |
| `feature/*` | Feature work — CI + preview build when PR is opened against `main` |

### Enforcing branch protection on `main`

Go to: **GitHub repo → Settings → Branches → Add rule → Branch name pattern: `main`**

- ✅ Require status checks to pass before merging
  - Add: `ci / typecheck`, `ci / lint`, `ci / test`
- ✅ Require at least 1 approving review
- ✅ Do not allow bypassing the above settings

## Chat contexts (AI modes)

The Chat screen adapts its Claude system prompt based on the entry point:

| Context | Entry point | Claude's role |
|---|---|---|
| `evening_checkin` | Home → "Evening check-in with Claude" | Warm growth coach, one question at a time about principles alignment |
| `struggling` | Home → "I'm struggling right now" | Grounding, compassionate — identifies trigger and gives one immediate action |
| `principles` | Principles → "Help me define a new principle" | Draws out principles through questions, never suggests directly |
| `weekly_review` | History → "Review my week with Claude" | Honest pattern analysis + one focus area for next week |
| `habits_help` | Habits tab | Helps identify which 1–2 habits matter most right now |

## Contributing

This is a personal project. PRs are welcome — please open an issue first to discuss the change.

## License

MIT
