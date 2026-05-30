# Admin & Partner Panel — Open Product / UX Questions

Audit date: 2026-05-22. Scope: `apps/panel` Super Admin (`/admin/*`) and Partner (`/partner/*`) surfaces, plus related backend contracts referenced from the UI.

These items need **explicit product decisions** before implementation. Safe technical fixes (i18n, missing enum in admin dropdowns) are handled in code separately.

---

## Organizations & identity

1. **Should Super Admin be able to edit organization `slug`?**  
   Slug is shown everywhere (`@slug`, CSV, deep links) but there is no admin UI or API to change it after registration. If yes: define uniqueness rules, broken-link handling, and audit action naming.

2. **Should admin edit org display name, tax ID (VKN), or billing contact from org detail?**  
   General tab fields appear read-only; operational edits today are plan, subscription, product line, and partner assignment only.

3. **When should admin use “Organizasyonu sil” vs “Askıya al”?**  
   Soft-delete exists with platform/partner guards. Need a support playbook: default action, customer communication, and whether deleted orgs are ever purged from DB.

---

## Subscriptions & billing (admin)

4. **Which subscription statuses may admin set manually, and with what side effects?**  
   Org settings expose `TRIAL`, `ACTIVE`, `PAUSED`, `CANCELLED`, `EXPIRED` (not `CANCELING`). Should admin mirror customer `CANCELING`, trigger PayTR/webhooks, or only override for support cases?

5. **Is “Deneme uzat (+7 gün)” the only trial extension model?**  
   Fixed +7 days and a fixed audit reason string. Decide max extensions, custom day count, and whether the customer is notified automatically.

---

## Platform audit & compliance

6. **What is platform audit log retention, pagination, and export scope?**  
   Platform audit page uses `limit: 100`; CSV may export only loaded rows if server export fails. Org detail has per-org audit + export. Define retention period, PII rules, and whether super-admin needs full history search.

7. **Should impersonation be labeled in Turkish for internal users?**  
   Mixed TR/EN (“Impersonation” column, Turkish audit labels on backend). Pick consistent internal terminology.

---

## Partner program — economics & ops

8. **What is the SLA / process for partner payout approval?**  
   Admin queue: one-click approve/reject; reject API accepts optional `note` but the UI does not ask for it. Define response time, finance handoff, and partner-visible rejection reasons.

9. **Minimum payout amount and payout cadence?**  
   UI allows requests from 1 TRY up to pending balance (single pending request enforced server-side). Confirm business minimums and payout calendar (e.g. monthly batch).

10. **Can admin commission rate changes apply retroactively?**  
    Partner commission is editable 0–50% per partner org. Clarify effective date and whether past accruals recalculate.

11. **Should one DIRECT client org have multiple active partners?**  
    Admin can attach multiple partners to the same client. Confirm if multi-partner revenue share is intentional or should be capped at one.

---

## Partner linking & onboarding

12. **Partner–client linking: when is admin instant assign allowed?**  
    Org settings assign partner immediately (no client approval). “Partner keşfet” flow requires admin approval and mandatory reject note. Align: can support always bypass client consent?

13. **How should demo partner / demo client orgs behave in production admin?**  
    Demo slugs are documented in UI and sorted last. Decide: hide from lists, block payout approval, or allow for sales demos only.

---

## Partner panel UX

14. **White-label `customDomain` — what is the go-live flow?**  
    Field exists with validation only; no DNS/SSL verification. Product choice: display URL only vs verified custom domain with setup wizard.

15. **Partner dashboard when `canImpersonate` is false?**  
    Row still clickable; navigates to client list without entering the client panel. Should the UI block access, show rationale, or offer read-only client summary?

---

## Suggested decision order

| Priority | Questions |
|----------|-----------|
| P0 | #6 audit retention, #8 payout SLA/reject note, #4 admin subscription rules |
| P1 | #1 slug edit, #12 linking policy, #11 multi-partner |
| P2 | #14 white-label domain, #13 demo orgs, #15 impersonation UX |

---

## Out of scope for product Q&A

- Tenant `organizationId` isolation and impersonation audit logging (enforced server-side).
- API validation bounds (commission 0–50%, payout ≤ balance) — implemented; gaps above are policy/UX only.
