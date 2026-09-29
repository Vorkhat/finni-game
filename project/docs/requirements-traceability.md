# Requirements traceability — Этап 5

Статусы подтверждаются реализацией, UI и автоматизированной проверкой. Нативные UX-сценарии без подключённого устройства отмечены отдельно и не считаются подтверждёнными browser evidence.

| Requirement | Implementation | Test | UI route | Status |
|---|---|---|---|---|
| Appendix A.1: запуск и три понятия | `Onboarding`, `interfaceContent.concepts` | `appendix-a.spec.ts`, `first-playable.spec.ts` | `/onboarding` | DONE |
| Appendix A.2: локальный профиль без PII | `createInitialProfile`, localStorage adapter | Appendix A field/source audit | `/pet/create` | DONE |
| Appendix A.3: выбор и имя питомца | `PetNameSchema`, registry pet options | unit + first playable + Appendix A | `/pet/create` | DONE |
| Appendix A.4: Home с бюджетом, целью, заданием и Финни | `Home`, derived profile cards | existing Home E2E + Appendix A screenshot | `/home` | DONE |
| Appendix A.5: план Нужно/Хочу/Коплю до расходов | budget domain + `BudgetControls` | domain tests + Appendix A | `/day/start`, `/budget` | DONE |
| Appendix A.6: решение, feedback, reward | `TaskRenderer`, `completeTask` | six renderer E2E + Appendix A | `/tasks/:id` | DONE |
| Appendix A.7: две покупки и нехватка | `executePurchase`, `purchasePreview`, Shop modal | gameplay + Appendix A | `/shop` | DONE |
| Appendix A.8: цель и реальный deposit | savings operations, GoalCard | gameplay + Appendix A | `/goal/select`, `/savings` | DONE |
| Appendix A.9: balance, Plan vs Fact, feedback, PetState | `closePeriod`, `ResultDetails` | periods + Appendix A | `/day/result` | DONE |
| Appendix A.10: следующий период, PetProgress, stage | period carry-over + evolution acknowledgement | five-period + Appendix A | `/day/start`, `/day/evolution`, `/progress` | DONE |
| Appendix A.11: reload восстанавливает состояние | atomic service commit + migration | persistence tests + reload assertions | boot → current route | DONE |
| Appendix A.12: adult progress, info, reset/delete | `AdultGate`, `AdultDashboard`, lifecycle context methods | Appendix A + isolated reset/delete | `/adult`, `/adult/dashboard` | DONE |
| Demo entry secondary action | onboarding/settings actions | Demo Mode E2E | `/onboarding`, `/settings` | DONE |
| Demo не уничтожает normal save | separate normal/demo keys and active mode key | namespace unit + integration + E2E | all demo routes | DONE |
| Demo deterministic/resettable/no wait | `createDemoProfile`, `resetDemoProfile`, immediate periods | domain + integration + five-day E2E | Settings + gameplay | DONE |
| Demo indicator and guidance | `DemoBadge`, `DemoGuide` | Demo Mode E2E + screenshots | gameplay routes | DONE |
| Adult parental gate | three-second pointer/keyboard hold with progress/cancel | Appendix A + reset/delete E2E | `/adult` | DONE |
| Adult LearningProgress without grades | `learningStatus` mapped to positive labels | Appendix A | `/adult/dashboard` | DONE |
| Adult education/privacy/offline | static concise information from product facts | Appendix A text checks | `/adult/dashboard` | DONE |
| Reset differs from delete | `GameService.resetGame` vs `deleteGame` | lifecycle integration + isolated E2E | `/adult/dashboard` | DONE |
| Tutorial replay preserves game | onboarding replay reads current profile | existing first-playable E2E | `/settings` → `/onboarding` | DONE |
| All tasks completed empty state | `all-tasks-complete` | source/type check; existing completed task fixtures | `/tasks` | DONE |
| Old saves use nontechnical copy | `ResultDetails` snapshot fallback | v1 migration unit + UI implementation | `/day/result/:id` | DONE |
| Global unexpected-error fallback | Solid `ErrorBoundary`, console logging, Home CTA | implementation/type/build check | global | DONE |
| Corrupt storage recovery without silent delete | boot error screen + explicit confirmation | recovery E2E | boot | DONE |
| Direct-route guards | `Guard` profile/result/evolution/adult conditions | recovery/guards E2E | global | DONE |
| Accessible mobile-safe dialogs | native dialog, focus/restore, Escape, 48dp controls, destructive role/style | all modal E2E + screenshot bounds | modal routes | DONE |
| Local click sound and animation preference | Web Audio click; local preferences; reduced motion | existing settings/reduced-motion E2E | `/settings` | DONE |
| No external runtime requests | bundled JS/CSS/WebP; blocked network routes | every E2E spec | all | DONE |
| Portrait QA 360/390/412 | responsive CSS + safe-area variables | three Playwright projects + screenshots | key routes | DONE |
| PWA offline shell | Android wrapper выбран как устанавливаемый target | documented boundary | N/A | N/A |
| Cloud backup/account/tab sync | outside MVP and feature freeze | documented boundary | N/A | N/A |

## Android packaging and acceptance

| Requirement | Implementation | Test / evidence | Status |
|---|---|---|---|
| Capacitor Android wrapper | `capacitor.config.ts`, `android/`, Capacitor 8 packages | `cap sync android`, Gradle builds | DONE |
| Identity and SDK | app ID `ru.onesolution.finni`, label «Финни», 1.0.0 (1), min 26, target 36 | `apkanalyzer`, `aapt`, merged manifest | DONE |
| Bundled offline web runtime | `webDir: apps/web/dist`, no `server.url`, no INTERNET permission | 55 packaged web files; URL/archive audit | DONE |
| Android Back | native listener closes dialog, navigates history, exits on root | source/build validation; no device available | DEVICE QA REQUIRED |
| System bars and safe areas | SystemBars config, CSS inset fallback, non-overlay status bar | source/build validation; no device available | DEVICE QA REQUIRED |
| Keyboard/touch/long press | `adjustResize`, responsive scroll/dialog rules, existing Adult hold logic | browser E2E PASS; no device available | DEVICE QA REQUIRED |
| Pause/resume/process kill | atomic persistence in localStorage; no duplicate action on reload | unit/integration/browser reload PASS | DEVICE QA REQUIRED |
| Update preservation | unchanged application ID and localStorage origin | implementation audit only | DEVICE QA REQUIRED |
| Icon and splash | deterministic source composition + generated Android resources | source/generated images reviewed | DONE; DEVICE DISPLAY REQUIRED |
| Debug APK | `Finni-1.0.0-debug.apk` | build, zipalign and debug certificate audit | DONE; INSTALL REQUIRED |
| Release APK | `Finni-1.0.0-release-unsigned.apk` | build and zipalign PASS; signature absent as named | OWNER SIGNING REQUIRED |
| Release AAB | `Finni-1.0.0-release-unsigned.aab` | bundle build PASS; `jar is unsigned` | OWNER SIGNING REQUIRED |
| Minimal permissions | only AndroidX signature-level dynamic-receiver permission | merged manifest audit | DONE |
| Appendix A Android | same tested production bundle packaged into APK | Appendix A browser PASS ×3 viewports | DEVICE QA REQUIRED |
| Demo/Adult Android | same tested production bundle packaged into APK | browser E2E PASS ×3 viewports | DEVICE QA REQUIRED |
| Emulator/device evidence | `docs/android-device-qa.md`, `docs/qa/android/README.md` | no emulator/AVD/device; no screenshots fabricated | NOT TESTED |
