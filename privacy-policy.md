# Privacy Policy — Istiqama (Inner Compass)

**Last updated:** March 2026

This privacy policy explains how Istiqama ("the app", "we", "us") collects, uses, and stores your personal data.

---

## 1. What data we collect

When you use Istiqama, we collect and store the following data:

| Data | Why we collect it |
|---|---|
| **Email address** | To identify your account, provided via Google Sign-In |
| **Display name and profile photo** | Shown in the app, provided by Google OAuth |
| **Personal principles** | Text you write yourself — stored to power your daily reflections |
| **Habit names and settings** | The habits you choose to track each day |
| **Daily habit completions** | Whether you marked each habit done on a given day |
| **Evening reflections** | Text you write in the daily reflection field |
| **Chat messages** | Messages you send to the AI coach during a session |

We do **not** collect:
- Device identifiers or advertising IDs
- Location data
- Contacts or calendar data
- Biometric data

---

## 2. Where your data is stored

All user data is stored in **Supabase**, a hosted PostgreSQL database.

- Supabase infrastructure is hosted on **AWS** (region: `eu-west-1` by default — confirm in your Supabase project settings)
- All data is encrypted at rest and in transit (TLS 1.2+)
- Row Level Security (RLS) is enabled on all tables — your data is strictly isolated from other users

AI chat messages are sent to **Anthropic's Claude API** to generate responses. Messages sent during a chat session are processed by Anthropic to generate a reply and are not stored by us beyond the active session. Anthropic's data use is governed by their [privacy policy](https://www.anthropic.com/privacy).

---

## 3. How we use your data

We use your data solely to:
- Provide the features of the app (habit tracking, reflections, AI coaching)
- Display your personal history and progress within the app
- Authenticate your identity via Google Sign-In

We do **not**:
- Sell your data to any third party
- Use your data for advertising
- Share your data with any party other than Supabase (storage) and Anthropic (AI responses)
- Use your data to train AI models

---

## 4. Data retention

- Your data is retained as long as your account exists
- If you delete your account, all your data (principles, habits, check-ins, reflections) is permanently deleted from our database within 30 days

---

## 5. Your rights

You have the right to:
- **Access** your data — all your data is visible within the app
- **Correct** your data — you can edit or delete any principle, habit, or reflection at any time inside the app
- **Delete** your account and all associated data — contact us at the email below
- **Export** your data — contact us and we will provide a data export

---

## 6. How to delete your account

To delete your account and all associated data:

1. Send an email to **youssraeh1997@gmail.com** with the subject: "Delete my account"
2. Include the email address associated with your account
3. We will confirm deletion within 7 days

---

## 7. Children's privacy

Istiqama is not directed at children under the age of 13. We do not knowingly collect personal data from children.

---

## 8. Changes to this policy

We may update this privacy policy from time to time. When we do, we will update the "Last updated" date at the top of this page. Continued use of the app after changes are posted constitutes your acceptance of the updated policy.

---

## 9. Contact

If you have questions or concerns about this privacy policy or your data, contact us at:

**Email:** youssraeh1997@gmail.com
**GitHub:** [github.com/youssrael/inner-compass-app](https://github.com/youssrael/inner-compass-app)
