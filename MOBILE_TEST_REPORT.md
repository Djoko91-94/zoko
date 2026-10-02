# Mobile Test Report - Zoko Pro

Date: ____ / ____ / ______
Tester: __________________
Device: __________________
OS version: __________________
Browser/App: __________________
Environment: [ ] Staging  [ ] Production

## 1) PWA installation

- [ ] App URL opens successfully on mobile.
- [ ] Install prompt is visible (or Add to Home Screen is available).
- [ ] App installs and launches from home-screen icon.
- [ ] App icon and app name are correct.

Result:
- [ ] Pass
- [ ] Fail
Notes:

---

## 2) Authentication flow

- [ ] Register works with valid input.
- [ ] Login works with valid credentials.
- [ ] Logout works and session is cleared.
- [ ] Re-login works after logout.

Result:
- [ ] Pass
- [ ] Fail
Notes:

---

## 3) Task management

- [ ] Create task works.
- [ ] Edit/update status works.
- [ ] Delete task works.
- [ ] Completed vs in-progress counts update correctly.
- [ ] Pie chart updates after task changes.

Result:
- [ ] Pass
- [ ] Fail
Notes:

---

## 4) Responsive UX

- [ ] Header and footer are readable.
- [ ] Buttons are tap-friendly (no accidental taps).
- [ ] Forms are usable without zoom.
- [ ] Modals open/close correctly.
- [ ] Scrolling is smooth and content is not cut off.

Result:
- [ ] Pass
- [ ] Fail
Notes:

---

## 5) Backend & connectivity

- [ ] Health endpoint returns OK: /api/health
- [ ] No visible CORS/network errors in normal flows.
- [ ] Login + task CRUD works with backend online.

Result:
- [ ] Pass
- [ ] Fail
Notes:

---

## 6) Reminder & email checks

- [ ] Profile has email configured.
- [ ] Email reminder option is enabled in profile.
- [ ] Reminder test action executes.
- [ ] Email is received (when RESEND keys are configured).

Result:
- [ ] Pass
- [ ] Fail
Notes:

---

## 7) Final release decision

Blocking issues found: [ ] Yes  [ ] No

Go/No-Go:
- [ ] GO (Ready for client release)
- [ ] NO-GO (Fix blocking issues first)

Summary:

Action items:
1. 
2. 
3. 
