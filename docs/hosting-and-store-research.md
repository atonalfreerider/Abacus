# Hosting, domain and store research

Researched 2026-10-12. Nothing was bought, registered, submitted or signed up for. Domain status comes from live RDAP and WHOIS lookups on that date. Prices are in USD, before tax, and change often. Anything marked **(unverified)** could not be confirmed from a primary source.

## Recommendations at a glance

1. **Domain:** `abacus.education` is available at the standard (non-premium) price. Second choice is `abacusmath.app` (cheapest, and HTTPS is forced on every `.app` domain). Third is `playabacus.app`. Also register `metavirtuoso.com` (about $10.46 a year) as the developer site, for the privacy policy and support URL that both stores ask for. Avoid `.io`: `abacus.io` is listed for sale with the price on request, and every `.io` name renews at about $50 or more a year.
2. **Hosting:** Use Cloudflare Pages with the domain registered at Cloudflare Registrar. It is free, has no bandwidth cap for static files, and is the only one of the three hosts that applies the existing `_headers` file (CSP, nosniff) at no cost and with no metering. Fix the `Cache-Control` conflict in `public/_headers` first (see Part 2).
3. **Google Play:** A new app must target **API 36** (Android 16), so the Capacitor shell should use Capacitor 8. A personal account created after 13 Nov 2023 still needs **12 testers opted in for 14 consecutive days** before it can apply for production. A target audience under 13 brings in the Families policy: a privacy policy is mandatory even though the app collects nothing, and the Data safety form must still be completed (answering "no data collected").
4. **Apple, later:** The program costs $99 a year. The Kids Category requires a parental gate around external links, and allows no third-party analytics or ads. A fully offline app with real touch interaction is unlikely to be the "repackaged website" that guideline 4.2 targets, but this is not guaranteed.

---

## Part 1: Domain availability

### Method

- RDAP lookups through `rdap.org`, which redirects to each registry's RDAP server. `.io` is missing from the IANA RDAP bootstrap file, so those names were queried directly at `rdap.identitydigital.services` and checked against port-43 WHOIS at `whois.nic.io`.
- Every "available" result was also confirmed as NXDOMAIN in DNS.
- Premium status was checked in Porkbun's public search page (search only, nothing added to a cart). An RDAP 404 means unregistered, but it does not say whether the registry charges a premium price.
- Taken domains were checked with `curl -sIL` for redirects, titles and parking pages. Afternic/GoDaddy aftermarket listing pages were viewed but not submitted.

### Results

| Domain | Status | Details |
|---|---|---|
| abacus.io | **Taken, for sale** | GoDaddy registrar, created 2013-02-26, expires 2027-02-26, owner hidden behind Domains By Proxy. Uses Afternic nameservers. The GoDaddy for-sale page shows "Get a price in less than 24 hours", so the price is on request (expect four or five figures) |
| abacus.app | Taken | united-domains AG, created 2018-05-05, expires 2027-05-05. The page reads "Domain im Kundenauftrag registriert" (held for a client). No sale listing seen |
| abacus.education | **Available, standard price** | Porkbun: $21.11 first year, then $31.41 a year |
| abacus.school | **Taken, for sale** | Sav.com registrar, created 2026-05-25. Listed on Afternic at **$2,988** (buy now) |
| abacus.academy | Taken, in use | Squarespace registrar. Redirects to abacusbudgeting.com, a live budgeting product |
| abacus.study | Available, **premium** | Porkbun: $55.11 a year (premium price, including renewals). Cloudflare Registrar does not sell `.study` |
| abacus.how | Available, **premium** | Porkbun: $97.68 a year (premium price, including renewals) |
| abacus.fun | **Taken, for sale** | West263 registrar, created 2024-11-04, **expires 2026-11-04**. Listed on Afternic at **$5,000** |
| abacus.dev | Taken, in use | GoDaddy registrar. Redirects to emburse.com, the expense-software company |
| abacuslab.app | Available | Standard `.app` price |
| abacuslab.io | Available | Standard `.io` price |
| abacusmath.app | Available | Porkbun: $8.75 first year, then $14.93 (confirmed not premium) |
| abacusmath.io | Available | Porkbun: $28.12 first year, then $51.80 |
| playabacus.app | Available | Porkbun: $8.75 first year, then $14.93 (confirmed not premium) |
| abacus.cards | Taken, in use | GoDaddy registrar. Abacus Cards, a UK greeting-card shop |
| abacuscards.app | Available | Standard `.app` price |
| thewhyabacus.com | Available | Standard `.com` price |
| the-why.com | **Taken, recently re-registered** | See below |
| metavirtuoso.com | Available | Standard `.com` price |
| metavirtuoso.app | Available | Standard `.app` price |

For comparison, these extra names were also checked: `abacusmath.com`, `abacusmath.org`, `abacuslab.com`, `playabacus.com` and `abacuscards.com` are all registered. `abacus.kids` is available but premium: $328.02 the first year, then $20.18 a year, per Porkbun. `.kids` has a child-safe content policy, which might appeal to teachers, but the first year is expensive.

**the-why.com.** The old brand domain lapsed and was registered again on **2026-08-11** at Namecheap. The owner is hidden by Withheld for Privacy, the domain expires 2027-08-11, and WHOIS still shows the `addPeriod` status. It uses Namecheap's default DNS and 301-redirects to `oh-yummy.com`, an unrelated Shopify shop. This looks like a drop-catch reused for traffic. If you did not register it yourself, it is not under your control: don't print it on materials, and expect old "The-WHY.com/ABACUS" links to land on that shop. A legacy name such as `thewhyabacus.com` would point people back towards that confusion, which counts against it.

### TLD prices (2026-10-12)

| TLD | Cloudflare (at cost)¹ | Porkbun² (first yr / renewal) | Namecheap³ (first yr / renewal) |
|---|---|---|---|
| .com | $10.46 / $10.46 | $11.08 / $11.08 | $10.98 / $18.48 |
| .app | $8.20 / $14.20 | $8.75 / $14.93 | $10.98 / $22.98 |
| .dev | $8.20 / $12.20 | $8.75 / $12.87 | $10.98 / $20.98 |
| .education | $27.20 / $27.20 | $21.11 / $31.41 | $40.98 / $52.48 |
| .school | $28.20 / $28.20 | $5.66 / $34.50 | $45.48 / $58.48 |
| .academy | $36.20 / $36.20 | $11.84 / $43.77 | $8.48 / $69.98 |
| .study | not sold | $1.54 / $31.41 (abacus.study is premium at $55.11) | $1.98 / $50.98 |
| .how | $20.20 / $20.20 | $21.11 / $21.11 (abacus.how is premium at $97.68) | $30.98 / $41.98 |
| .io | $32.00 / $50.00⁴ | $28.12 / $51.80 | $34.98 / $75.98 |
| .fun | $4.99 / $30.20 | $2.57 / $31.41 | — |
| .cards | $30.20 / $30.20 | $2.57 / $34.50 | — |

Sources:

1. Third-party tracker of Cloudflare Registrar prices, updated 2026-10-12: [cfdomainpricing.com](https://cfdomainpricing.com/). Cloudflare charges registry cost with no markup, so its renewal price is the most useful long-term number.
2. Porkbun's public pricing API (`https://api.porkbun.com/api/json/v3/pricing/get`), queried 2026-10-12. The low first-year figures are promotions labelled "1st Year Sale".
3. Namecheap list prices without coupons, via [domainoffer.net](https://domainoffer.net/tld/app/namecheap) (pages for each TLD, updated 2026-10-12). namecheap.com blocked automated fetches.
4. [domainoffer.net](https://domainoffer.net/tld/io/cloudflare) lists $50 for registration as well. The $32 first-year figure is **(unverified)**.

### TLD quirks

- **.app and .dev are on the browser HSTS preload list for the whole TLD.** `hstspreload.org` reports both as "preloaded", so browsers will only connect over HTTPS. That is no problem for static hosting, because all three hosts below provision certificates automatically. It also signals security to schools. `.education`, `.how` and `.io` are not preloaded, so the host has to redirect HTTP to HTTPS; Cloudflare's "Always Use HTTPS" setting or GitHub's "Enforce HTTPS" does this.
- **.education, .school and .academy** are Identity Digital (formerly Donuts) TLDs. Watch the renewal price, not the first-year price. `.school` and `.academy` drop to $5 to $12 in year one at Porkbun and Namecheap, then renew at $34 to $70. At Cloudflare the price stays flat ($27 to $36). No eligibility restriction to register them was found **(unverified)**.
- **.io** is the ccTLD for the British Indian Ocean Territory. It renews at about $50 a year at cost, and its long-term future depends on the stalled UK–Mauritius Chagos treaty: [DomainIncite, Apr 2026](https://domainincite.com/31642-io-safe-for-now-as-trump-puts-chagos-deal-on-ice). Existing registrations are not affected for now, but `.io` reads as "tech startup" more than "classroom".
- **School web filters:** some district filters treat new gTLDs warily. `.com`, `.app` and `.education` are less likely to be caught than `.fun` or `.cards` **(unverified)**.

### Top 3 for the app

1. **abacus.education**, about $27 a year flat at Cloudflare. This is the "abacus.<something educational>" name you floated, and it costs the standard price, not a premium. Teachers can read it aloud and it states its purpose. Downsides: it is long to type, and HTTPS has to be enforced by the host rather than by the TLD.
2. **abacusmath.app**, $8.20 the first year and $14.20 a year after at Cloudflare. It is the cheapest option, HTTPS is forced by the TLD, and it is clear to kids ("abacus math"). It matches an app that is also in the stores.
3. **playabacus.app**, same price as abacusmath.app. It is friendlier and verb-led for children, and works well as a call to action ("go to playabacus.app"), but it says less about maths than option 2.

Also register **metavirtuoso.com** ($10.46 a year) as the developer home. Google Play shows a developer website and Apple asks for a support URL and a privacy-policy URL. A developer domain covers those for every future app, for example `metavirtuoso.com/abacus/privacy`. Avoid `abacus.io`, `abacus.how`, `abacus.study` and `abacus.kids`: they are for sale with the price on request, or premium-priced, or expensive to renew.

"Abacus" is a crowded name: Abacus budgeting, Emburse's Abacus, Abacus Cards, and many "Abacus" apps on Play. A trademark knockout search before printing materials is worth the time **(not researched here)**.

---

## Part 2: Static hosting

### What the repo deploys today

- `.github/workflows/pages.yml` runs the tests and `tools/build.mjs`, then deploys `dist/` to GitHub Pages. It is triggered manually with `workflow_dispatch`.
- `public/` holds about 34 MB across 47 files. The two largest are the Ruffle `.wasm` files, about 14.2 MB each. `build.mjs` writes `.br` and `.gz` copies next to every file. All URLs are relative, so the site also works at a sub-path such as `atonalfreerider.github.io/Abacus/`.
- `public/_headers` sets the CSP (including `'wasm-unsafe-eval'` for Ruffle), `X-Content-Type-Options`, `Referrer-Policy` and `Cache-Control`. There is no `<meta http-equiv>` CSP in `index.html`.

### Comparison

| | GitHub Pages | Cloudflare Pages | Netlify |
|---|---|---|---|
| Price | Free for public repos | Free | Free tier now runs on credits |
| Bandwidth | 100 GB a month, soft limit ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)) | "requests to static assets are free and unlimited" ([pricing](https://developers.cloudflare.com/pages/functions/pricing/)) | 300 credits. Bandwidth costs 20 credits per GB and each production deploy 15 credits ([pricing](https://www.netlify.com/pricing/)), so roughly 13 to 15 GB a month. Third-party sources say sites pause when credits run out **(unverified)** |
| Size limits | Site ≤ 1 GB, deploy ≤ 10 min | 20,000 files per site, **25 MiB per file**, 500 builds a month ([limits](https://developers.cloudflare.com/pages/platform/limits/)). The 14.2 MB wasm files fit | No limit relevant at this size |
| Custom headers (`_headers`) | **No.** CSP can only be set by `<meta>`, which cannot carry `frame-ancestors`. `nosniff` cannot be set at all | **Yes.** Up to 100 rules ([docs](https://developers.cloudflare.com/pages/configuration/headers/)) | **Yes** ([docs](https://docs.netlify.com/routing/headers/)) |
| HTTPS on custom domain | Yes, Let's Encrypt; "Enforce HTTPS" can take up to 24 h to appear | Yes, automatic | Yes, automatic |
| Compression | gzip on the fly; Brotli support **(unverified)** | Gzip and Brotli on the fly ([docs](https://developers.cloudflare.com/pages/configuration/serving-pages/)) | Brotli and gzip on the fly |
| Uses the precompressed `.br`/`.gz` files? | No | No (nothing in the docs says it does) | No |
| Commercial use | "not intended" for online businesses or SaaS | Allowed | Allowed |
| Deploy from current workflow | Already done | Add `cloudflare/wrangler-action@v4` | Netlify CLI or Git integration |

The `.br` and `.gz` siblings are dead weight on all three hosts, since each host compresses on its own. Consider dropping them from the `dist/` that gets deployed, or keeping them only for `tools/serve.mjs`.

**Recommendation: Cloudflare Pages**, with the domain registered at Cloudflare Registrar so the DNS zone is on Cloudflare automatically. It is the only free option that applies the existing `_headers` file with no meter, and the bandwidth cap is irrelevant for classroom bursts (30 students loading at once). Cloudflare also offers static assets on Workers, which supports the same `_headers` file ([migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)). Pages is still the simpler fit for a project that is only a static `dist/`. GitHub Pages remains a valid zero-setup fallback if you can live without real response headers.

### Fix needed in `public/_headers` (applies to Cloudflare and Netlify)

Cloudflare documents that a request matching several rules "will inherit all rules' headers", and that "if a header is applied twice… the values are joined with a comma separator." `/vendor/ruffle/*` matches both `/*` and its own rule, so it would be served with:

```
Cache-Control: public, max-age=0, must-revalidate, public, max-age=86400
```

That is two conflicting `max-age` values, so the 1-day cache will not be honoured reliably. Since `public, max-age=0, must-revalidate` is already Cloudflare Pages' default for static assets ([docs](https://developers.cloudflare.com/pages/configuration/serving-pages/)), the simplest fix is to delete the `Cache-Control` line from the `/*` block. Alternatively, add `! Cache-Control` to the Ruffle rule before its own value. Check with `curl -I` after deploying either way, because the docs do not show removing and setting a header in the same rule.

### Exact DNS records: Cloudflare Pages (recommended)

This assumes a Pages project named `abacus` (served at `abacus.pages.dev`; Cloudflare adds a suffix if that name is taken) and the domain registered at Cloudflare. Add the domain in **Pages, Custom domains, Set up a domain** *before* creating any records. Cloudflare warns that a CNAME added by hand first can cause 522 errors ([docs](https://developers.cloudflare.com/pages/configuration/custom-domains/)). Once the domain is added there, Cloudflare creates the records itself:

| Type | Name | Content | Proxy |
|---|---|---|---|
| CNAME | `@` (apex, e.g. `abacusmath.app`) | `abacus.pages.dev` | Proxied (apex CNAME is flattened) |
| CNAME | `www` | `abacus.pages.dev` | Proxied |

Notes:

- The apex domain *must* be a Cloudflare zone (nameservers on Cloudflare). This is automatic with Cloudflare Registrar. If you register elsewhere (for example `.study` at Porkbun), switch the nameservers to the two Cloudflare assigns.
- Add `www` as a second custom domain on the project, or add a Redirect Rule from `www` to the apex.
- Optional but good practice for a domain that sends no email: `TXT @ "v=spf1 -all"` and `TXT _dmarc "v=DMARC1; p=reject;"`. These stop anyone sending email spoofed from your domain.

Deploy step to add to the workflow, after `node tools/build.mjs`, per [Cloudflare's CI guide](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/). The API token needs **Account › Cloudflare Pages › Edit**.

```yaml
      - uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=abacus
```

### DNS records: GitHub Pages fallback

From [GitHub's docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site):

| Type | Name | Content |
|---|---|---|
| A | `@` | 185.199.108.153 |
| A | `@` | 185.199.109.153 |
| A | `@` | 185.199.110.153 |
| A | `@` | 185.199.111.153 |
| AAAA | `@` | 2606:50c0:8000::153 |
| AAAA | `@` | 2606:50c0:8001::153 |
| AAAA | `@` | 2606:50c0:8002::153 |
| AAAA | `@` | 2606:50c0:8003::153 |
| CNAME | `www` | `atonalfreerider.github.io` (without the repo name) |

Set the custom domain under repo **Settings › Pages**. The current workflow deploys with Actions, so a `CNAME` file is not needed and would be ignored. GitHub also recommends verifying the domain in the account's Pages settings to prevent takeover. That adds a `TXT _github-pages-challenge-atonalfreerider` record whose value GitHub supplies.

---

## Part 3: Google Play (as of 2026-10-12)

The developer account for "Meta Virtuoso" could not be found in a public Play listing. Its **type** (personal or organization) and **creation date** decide whether the testing gate applies, so check them under Play Console › Settings › Developer account.

### Target API level

- From **31 Aug 2026**: "New apps and app updates must target Android 16 (API level 36) or higher." Wear OS and Automotive must target 35; TV and XR must target 34. Extensions run to **1 Nov 2026**. Existing apps must target API 35 or higher to stay visible to users on newer Android versions. Sources: [Play Console Help 11926878](https://support.google.com/googleplay/android-developer/answer/11926878) and [developer.android.com target-sdk](https://developer.android.com/google/play/requirements/target-sdk).
- So yes: **API 36 now applies to a new app.** Capacitor 8 uses compileSdk and targetSdk 36 with minSdk 24, while Capacitor 7 targets 35 ([Capacitor 8 upgrade guide](https://capacitorjs.com/docs/updating/plugins/8-0)). The repo has no Capacitor project yet, so start the shell on Capacitor 8.

### Personal vs organization accounts and the testing requirement

- Still in force: "personal developer accounts created after November 13, 2023" must run a closed test with "a minimum of 12 testers who have been opted in continuously for at least 14 days", and the days must be consecutive, before applying for production ([Help 14151465](https://support.google.com/googleplay/android-developer/answer/14151465)). The official page shows no change since the cut from 20 to 12 testers in late 2024. Third-party blogs say Google now also checks tester engagement **(unverified)**.
- Organization accounts are not subject to this rule (per third-party guides; the official page only covers personal accounts). They need a free D-U-N-S number, which "can take up to 28 days" ([Help 13634885](https://support.google.com/googleplay/android-developer/answer/13634885)). Organization accounts also have to show a verified developer phone number, and newer ones need a verified website ([Help 10841920](https://support.google.com/googleplay/android-developer/answer/10841920)).
- New personal accounts must verify a government ID and prove access to a real Android device through the Play Console mobile app. The legal name and address come from the payments profile ([Help 10841920](https://support.google.com/googleplay/android-developer/answer/10841920)). The registration fee is a one-off **$25** ([developer verification FAQ](https://developer.android.com/developer-verification/guides/faq)).
- **Practical tip:** Families-policy apps go through stricter review. Start the 14-day closed test (classmates, colleagues, family) as soon as the first AAB builds.

### Families policy (target audience includes under-13s)

- **Target audience and content:** choosing the 5 and under, 6–8 or 9–12 age groups brings in the Families policy. Before filling in this section you must have added a privacy policy, the ads declaration and app access ([Help 9867159](https://support.google.com/googleplay/android-developer/answer/9867159)). The separate "Designed for Families" opt-in was folded into this flow in 2020, so there is no separate opt-in now **(from prior knowledge, not re-verified today)**.
- **Families policy requirements** ([Help 9893335](https://support.google.com/googleplay/android-developer/answer/9893335)):
  - The privacy policy must accurately describe what data is handled.
  - The app must not transmit the AAID or device identifiers from children.
  - The app must not request location permission.
  - Only SDKs approved for child-directed services may be used, and ads may only come from Families Self-Certified Ads SDKs.
  - The app must comply with COPPA and GDPR.
  - Abacus already meets all of this: no SDKs, ads, accounts or network calls, and the CSP is `connect-src 'self'`. Declare "No ads" and keep Capacitor plugins to a minimum, with no analytics or crash-reporting SDKs.
- **Privacy policy:** required even with zero data collection. It must be linked in Play Console, and the Data safety form cannot be completed without it ([Help 10787469](https://support.google.com/googleplay/android-developer/answer/10787469)). A short page stating that no personal data is collected, stored or shared, with a contact email, is enough. Host it on the web domain.
- **Data safety form:** "Even developers with apps that do not collect any user data must complete this form." Answer **No** to collection. The listing will then say the app "doesn't collect or share any user data" ([Help 10787469](https://support.google.com/googleplay/android-developer/answer/10787469)).
- **COPPA:** the amended FTC rule (amended 22 Apr 2025, full compliance by 22 Apr 2026) applies to operators that collect personal information from under-13s ([FTC](https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments)). An app that collects nothing has no consent obligations. The website's host logs (Cloudflare or GitHub) should still be mentioned in the website's privacy notice.
- **Teacher Approved:** there is no application form. Apps in the Families program that target children are "eligible for consideration" ([Help 9867159](https://support.google.com/googleplay/android-developer/answer/9867159)). Teachers and specialists rate design, appeal, "enrichment", age appropriateness, ads, in-app purchases and cross-promotion. Approved apps get a badge and can appear on the Kids tab ([google.play/business/programs/teacherapproved](https://google.play/business/programs/teacherapproved/)). Abacus's lack of ads and purchases helps.
- Also required: the IARC content-rating questionnaire, plus the App access, Ads, Government and Financial features declarations under **App content**.

### Store listing assets

From [Help 9866151](https://support.google.com/googleplay/android-developer/answer/9866151) (graphics) and [Help 9859152](https://support.google.com/googleplay/android-developer/answer/9859152) (text):

| Asset | Requirement |
|---|---|
| App name | ≤ 30 characters |
| Short description | ≤ 80 characters |
| Full description | ≤ 4,000 characters |
| App icon | 512 × 512, 32-bit PNG with alpha, ≤ 1,024 KB |
| Feature graphic | 1024 × 500, JPEG or 24-bit PNG with no alpha |
| Phone screenshots | Minimum 2 to publish (counted across device types), maximum 8. JPEG or 24-bit PNG. Each side 320–3,840 px, long side ≤ 2× short side. **To be eligible for featuring:** at least 4 screenshots, 1080 × 1920 (9:16) or 1920 × 1080 (16:9) |
| 7-inch and 10-inch tablet screenshots | Up to 8 each, 1,080–7,680 px, 16:9 or 9:16. Optional for publishing, but at least 4 are needed for tablet and large-screen featuring. Worth doing, since classrooms use tablets |
| Chromebook screenshots | Same rules as tablets. Optional, but relevant for schools |
| Video | Optional YouTube URL. Must be public or unlisted, with ads off and no age restriction |

Keep the icon and screenshots free of anything that looks like a children's ad, and make sure they match the declared target audience.

### App signing and AAB

- AAB is mandatory: "From August 2021, new apps are required to publish with the Android App Bundle" ([developer.android.com/guide/app-bundle](https://developer.android.com/guide/app-bundle)).
- Play App Signing is the default for new apps. Google generates the app-signing key; the help page now describes this as "quantum-ready, hybrid signing". You sign uploads with your own **upload key** (RSA ≥ 2048-bit, in a Java keystore), and Google can reset it if it is lost. A custom signing key can only be swapped in before the first open-testing or production release ([Help 9842756](https://support.google.com/googleplay/android-developer/answer/9842756)). Back up the upload keystore and its passwords outside the repo.

### Android developer verification (2025–2026)

- **Timeline** ([developer.android.com/developer-verification](https://developer.android.com/developer-verification)):
  - Verification opened to all developers through Play Console and the Android Developer Console from March 2026.
  - On **30 Sep 2026** protection started for users installing from participating stores in **Brazil, Indonesia, Singapore and Thailand** on certified devices running Android 7+.
  - Global expansion is planned for **2027**.
  - Unverified apps can still be installed through ADB, or through a new "advanced flow" for power users that includes a waiting period ([Android Authority](https://www.androidauthority.com/android-developer-verification-rollout-sideloading-flow-3653395)).
- **Effect on this account:** Play developers already meet the identity requirement: "For most Play developers, no new action is required." Creating the app in Play Console registers the package name automatically. With Play App Signing, "your eligible apps will be part of the automatic registration process" ([Play Console guide](https://developer.android.com/developer-verification/guides/google-play-console), [FAQ](https://developer.android.com/developer-verification/guides/faq)). Check the Play Console Home page for any flags.
- **Watch out:** if you ever hand schools a sideloaded APK (GitHub release, MDM), it will be signed with *your* key, not Google's app-signing key. Register that extra key for the same package in Play Console, or it will be treated as unverified in enforced regions, and globally from 2027. The FAQ confirms several keys per package are allowed. Whether this is strictly required outside enforced regions is **(unverified)**. The free "Limited distribution" account (up to 20 devices, no ID) is meant for students and hobbyists and is not needed here.

---

## Part 4: Apple App Store (brief, for later)

- **Cost:** "The Apple Developer Program is 99 USD per membership year." Fee waivers exist for nonprofits, accredited educational institutions and government entities. Enrolling as an individual shows your legal name as the seller; enrolling as an organization needs a D-U-N-S number and a legal entity, and DBAs are not accepted ([developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/)). To show "Meta Virtuoso" as the seller name you would need an organization.
- **Kids Category** ([guidelines 1.3 and 5.1.4](https://developer.apple.com/app-store/review/guidelines/), [developer.apple.com/kids](https://developer.apple.com/kids/)):
  - Pick an age band: 5 and under, 6–8, or 9–11.
  - Links out of the app and purchases must sit behind a **parental gate**, including any "visit website" or "more apps" link.
  - No PII or device information may be sent to third parties, and there should be no third-party analytics or ads.
  - The icon and screenshots must suit a 4+ rating.
  - A **privacy policy link is required for every app**, both in App Store Connect and inside the app (5.1.1(i)). Add an in-app "Privacy" link to the menu; a link to your own policy page also needs the parental gate.
- **Guideline 4.2 (minimum functionality):** the text says an app should "elevate it beyond a repackaged website" and be "app-like". Rejections under 4.2 mostly hit wrappers that load a remote website and feel like Safari. Abacus ships its code inside the binary, works fully offline, and is a touch-driven manipulative (dragging cards, animations, a tutor), so it is a strong case. Approval is still not guaranteed and depends on the reviewer. To reduce risk:
  - Use native-feeling touch with no browser chrome, text selection or rubber-band scrolling.
  - Add a few native touches such as haptics or proper safe-area handling.
  - Explain the offline interactive design in the review notes.
  - Leave the 30 MB Ruffle/Flash comparison runtime out of the iOS build. It adds size and raises review questions under 2.5.2 (executable code) with no benefit to learners.

  This assessment rests on the guideline text and secondary reports ([Apple forums thread](https://developer.apple.com/forums/thread/812889)), **not on a confirmed precedent**.

---

## Items not verified

- Whether Cloudflare's $32 first-year `.io` price is a current promotion. $50 is confirmed for renewal.
- Netlify's behaviour when free credits run out: the official page states the per-unit costs but not what happens at the limit.
- Whether GitHub Pages serves Brotli.
- Whether `.education` has any eligibility rules.
- How school web filters treat each TLD.
- Whether Google now checks tester engagement during the 14-day test.
- That organization accounts are exempt from the testing requirement (third-party sources only).
- The "Meta Virtuoso" account's type and creation date.
- Who registered the-why.com.
