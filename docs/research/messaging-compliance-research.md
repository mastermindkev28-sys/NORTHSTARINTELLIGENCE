# Messaging & Outreach Compliance Research (SMS and Voice)

**Owner:** Data Partnerships & Compliance Research
**Prepared for:** Northstar Intelligence (Northstar Acquisitions LLC)
**Research date:** 2026-11-14 (sources retrieved 2026-11 unless stated otherwise)
**Scope:** U.S. federal and selected state rules that govern automated seller outreach by SMS and voice (including AI-generated voice and AI chat agents) for residential real estate investors and wholesalers using Northstar.

> **Not legal advice.** This is a research compilation. TCPA and state telemarketing law is litigated heavily, and as of this writing it is changing (an FCC rule takes effect 2026-11-25, and courts of appeals disagree on whether texts are "calls"). Outside counsel experienced in TCPA, state telemarketing, fair housing, and real-estate licensing law must review this document and the resulting product requirements before launch, and at least quarterly afterward.

| Label | Meaning |
|---|---|
| **Fact** | Stated in a cited primary source (statute, eCFR, Federal Register, FCC order, court opinion, carrier/CTIA document) or a clearly attributed secondary source. |
| **Analysis** | Northstar's interpretation or design recommendation. |
| **Unverified** | Secondary-source report we could not confirm against the primary text. |

---

## 1. Executive summary

1. **The rule set changes on 2026-11-25 (Fact).** FCC 26-67 (adopted 2026-09-30, published 2026-10-26) rewrites 47 CFR 64.1200(a)(10)–(12). Callers may designate an **exclusive** revocation method. Texters must honor seven standard words (“stop,” “quit,” “end,” “revoke,” “opt out,” “cancel,” “unsubscribe”). A revocation of marketing consent revokes **all** future marketing from that caller. Revocations must be honored within **10 business days**. A confirmation text sent **within 5 minutes** is presumed permissible.
2. **AI voices are "artificial voices" (Fact).** FCC 24-17 (Feb. 2024): AI-generated voice calls need the called party's prior express consent. If the call is telemarketing, it needs prior express **written** consent (PEWC).
3. **One-to-one consent is dead (Fact).** It was vacated by the 11th Circuit on 2025-01-24, and the FCC restored the prior PEWC definition in 2025. **Analysis:** Carrier and Twilio policy still require brand-specific, non-transferable consent, so Northstar should design for single-seller consent anyway.
4. **DNC registry (Fact).** Scrub against a registry version no more than **31 days** old to keep the safe harbor. Honor entity-specific DNC requests within **10 business days** and keep them for **5 years**.
5. **State mini-TCPAs are stricter (Fact).** FL, OK, and MD limit telephone solicitations to **8 a.m.–8 p.m.** recipient local time and **3 per 24 hours** on the same subject. Each presumes that a number with an in-state area code belongs to an in-state resident. Texas (SB 140, eff. 2025-09-01) brought marketing texts into its registration/bond regime.
6. **Offers to buy (Analysis, contested).** Several federal district courts have held that calls or texts offering to **buy** a home are not "telephone solicitations" under the federal DNC rules (Coffey (D. Ariz. 2025); Aussieker v. Aghazadeh (E.D. Cal. 2025)). Other courts disagree where the investor also sells services. The holdings do not reach §227(b), which restricts artificial/AI voice and autodialed calls to cell phones whatever the content. Many state laws are broader. **Do not design around this defense.**
7. **Carriers are the practical gatekeeper (Fact).** Twilio's Messaging Policy (updated 2026-04-13) requires prior express consent for **all** messages and PEWC for marketing. Unregistered 10DLC traffic is blocked. Third-party lead-gen campaigns are rejected and cannot be resubmitted (Twilio error 30951). **Cold SMS to skip-traced lists is incompatible with carrier policy, whatever the TCPA defense.**
8. **AI disclosure (Fact/Analysis).** Disclosure requirements are a growing patchwork: Utah, Maine, California (bots online; AI-generated prerecorded messages), and an open FCC proposal. **Analysis:** disclose AI at the start of every AI interaction, on every channel.
9. **Fair housing and wholesaling laws restrict what the AI may target and say.** Fair housing rules bar protected-class proxies in lead scoring and targeting. Wholesaling statutes require licensing or registration, disclosures, and cancellation rights in a growing number of states (e.g., PA Act 52, OR HB 4058).

---

## 2. Federal TCPA framework

### 2.1 Key definitions (Fact — 47 CFR 64.1200(f), eCFR current as of 2026-11-10, which notes the pending amendment at 91 FR 67219)
Source: https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L/section-64.1200 (retrieved 2026-11 via eCFR API)

- **Autodialer (ATDS)** (f)(2): "equipment which has the capacity to store or produce telephone numbers to be called using a random or sequential number generator and to dial such numbers."
- **Telemarketing** (f)(13): "the initiation of a telephone call or message for the purpose of encouraging the purchase or rental of, or investment in, property, goods, or services."
- **Telephone solicitation** (f)(15): same purpose test, excluding calls with prior express invitation/permission, established business relationship, or by tax-exempt nonprofits.
- **Prior express written consent** (f)(9): "an agreement, in writing, bearing the signature of the person called that clearly authorizes the seller to deliver or cause to be delivered … advertisements or telemarketing messages using an automatic telephone dialing system or an artificial or prerecorded voice, and the telephone number…," with clear and conspicuous disclosures that (A) the person authorizes such calls and (B) signing is not a condition of purchase. E-signatures count where valid under E-SIGN/state law.

### 2.2 Autodialer after *Facebook v. Duguid* (Fact)
- *Facebook, Inc. v. Duguid*, 592 U.S. 395 (Apr. 1, 2021): to be an ATDS, equipment must have the capacity to store or produce numbers using a random or sequential number generator. — https://www.supremecourt.gov/opinions/20pdf/19-511_p86b.pdf (retrieved 2026-11)
- **Analysis:** Most list-based SMS/dialer platforms are not ATDSs under *Duguid*. That does **not** remove liability for (a) artificial/prerecorded/AI voice (§227(b)), (b) DNC violations (§227(c)), or (c) state laws whose definitions are broader:
  - Florida: "an automated system for the **selection and** dialing of telephone numbers" (Fla. Stat. §501.059(8)(a)).
  - Maryland: "an automated system for the **selection or** dialing of telephone numbers" (Md. Code, Com. Law §14-4502(a)(3)). Read literally, the disjunctive "or" may cover a system that only automates dialing.

### 2.3 Artificial, prerecorded, and AI-generated voices (Fact)
- FCC 24-17, Declaratory Ruling, CG Docket 23-362, adopted 2024-02-02, released 2024-02-08: "the TCPA's restrictions on the use of 'artificial or prerecorded voice' encompass current AI technologies that generate human voices," so such calls "require the prior express consent of the called party … absent an emergency purpose or exemption." — https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf (retrieved 2026-11)
- Consent tiers (47 CFR 64.1200(a)(1)–(3)):
  - Artificial/prerecorded voice call to a **wireless** number: prior express consent (non-marketing). If it includes an advertisement or constitutes telemarketing: **PEWC**.
  - Artificial/prerecorded voice telemarketing to a **residential** line: **PEWC**.
- Content requirements for artificial/prerecorded voice messages (64.1200(b)): at the beginning, state the identity of the responsible business (its registered name). Give a callback number. For telemarketing, provide an **automated interactive voice/key-press opt-out within two (2) seconds** of the identification, which must record the DNC request and immediately end the call. Voicemail messages must include a toll-free number that connects to the opt-out mechanism.
- FCC 24-84 NPRM (published 2024-09-10) proposed defining AI-generated calls and requiring AI disclosure and consent — https://www.federalregister.gov/documents/2024/09/10/2024-19028/implications-of-artificial-intelligence-technologies-on-protecting-consumers-from-unwanted-robocalls (retrieved 2026-11). **Status as of 2026-11: unverified.** We found no final order.

**Analysis:** An AI voice agent placing outbound calls is treated as an artificial-voice robocall. Northstar must allow AI-voice outbound **only** to numbers with documented consent at the right tier. Treat every acquisition-marketing call as requiring **PEWC**, because courts disagree on whether offers to buy are telemarketing. AI voice answering **inbound** calls is lower risk under the TCPA, though disclosure and recording laws still apply.

### 2.4 Are offers to buy a house "telemarketing" or "telephone solicitations"? (Fact + Analysis)
- **Facts (district courts, not binding nationally):**
  - *Aussieker v. Aghazadeh*, 2025 WL 2021040 (E.D. Cal. July 18, 2025): offers to buy property do not trigger TCPA DNC protections. The court followed *Coffey v. Fast Easy Offer* (D. Ariz. 2025). — https://tcpaworld.com/2025/07/24/buy-away-another-court-holds-offers-to-buy-real-estate-are-not-telephone-solicitations-under-the-tcpas-dnc-provisions/ (retrieved 2026-11)
  - Contrary: a Northern District of Georgia court found that texts may plausibly be solicitations where the business model encouraged purchase of the defendants' real-estate services. A 2026 ruling reportedly allowed similar claims to proceed. — https://www.jdsupra.com/legalnews/offers-to-buy-real-estate-via-text-7629409/ ; https://infobytes.orrick.com/2026-03-13/judge-allows-some-consumer-protection-claims-over-unsolicited-home-buying-texts-to-proceed/ (retrieved 2026-11; details **unverified**)
- **Analysis:**
  1. These holdings address the "telephone solicitation"/DNC prong (§227(c)). They do **not** authorize artificial/AI voice or prerecorded calls to cell phones without consent (§227(b)).
  2. Wholesaler messages often promote services: "we handle closing costs," "free consultation," or a referral to an agent partner. Those messages fall outside the defense.
  3. State laws use their own definitions (e.g., FL "telephonic sales call"), and some practitioners report that certain states expressly cover offers to buy.
  4. **Product stance:** treat all acquisition outreach as telemarketing for consent, DNC, quiet-hours, and frequency purposes.

### 2.5 Revocation of consent — rules, dates, delays (Fact)

| Date | Event | Source |
|---|---|---|
| 2024-02-15 / 02-16 | FCC 24-24 Report & Order (adopted/released): consumers may revoke by any reasonable means; honor within 10 business days; confirmation text rule; "revoke-all" requirement | https://docs.fcc.gov/public/attachments/FCC-24-24A1.pdf |
| 2025-04-07 | DA 25-312: compliance with 64.1200(a)(9)(i)(F), (a)(10), (a)(11), (d)(3) required **2025-04-11**, except the "revoke-all on unrelated matters" portion of (a)(10), waived to **2026-04-11** | https://docs.fcc.gov/public/attachments/DA-25-312A1.pdf |
| 2026-01-06 | DA 26-12: revoke-all portion further delayed to **2027-01-31** | https://docs.fcc.gov/public/attachments/DA-26-12A1.pdf |
| 2026-09-30 / 10-01 | FCC 26-67 Report & Order + FNPRM adopted/released | Federal Register doc. 2026-21821 |
| 2026-10-26 | FCC 26-67 published in the Federal Register | https://www.federalregister.gov/d/2026-21821 (public-inspection PDF: https://public-inspection.federalregister.gov/2026-21821.pdf) |
| **2026-11-25** | **Amended 64.1200(a)(9)(iii)(A), (a)(10)–(12) effective.** This supersedes the delayed 2027-01-31 revoke-all date. | Same; effective "30 days after publication" |
| 2026-11-25 / 12-28 | FNPRM comments / replies due. Topics: shorten the 10-day window (e.g., to 7 business days); require two-way texting; mandate a revoke-all option; affiliates; confirmation calls | Secondary: https://natlawreview.com/article/fcc-adopts-overhaul-tcpa-consent-revocation-rules-revoke-all-narrowed-exclusive-opt ; https://www.troutman.com/insights/fcc-revises-tcpa-revocation-of-consent-rules-that-were-set-to-go-into-effect-in-january/ (dates **unverified** against FCC docket) |

All rows retrieved 2026-11.

**Amended rule text (Fact — quoted from FR doc. 2026-21821):**
- (a)(10): "Callers may designate any of the following methods as the exclusive means to revoke consent: (i) an automated, interactive voice or key press-activated opt-out mechanism on a call; (ii) replying to an incoming text message with any one of the following standardized words: 'stop,' 'quit,' 'end,' 'revoke,' 'opt out,' 'cancel,' or 'unsubscribe'; and/or (iii) pursuant to a website or telephone number designated by the caller…." The method must be "clearly and conspicuously" disclosed on the call or in the text. A text sender may satisfy disclosure by including at least one standard word in each message "so long as the text sender recognizes the use of any of the standardized words."
- "Revocation requests made in response to calls or text messages that contain an advertisement or constitute telemarketing revoke consent to all future calls or text messages containing an advertisement or constitute telemarketing from that caller." For purely informational messages, a caller may limit revocation to that category.
- If the texting protocol does not allow replies, each text must disclose that and give reasonable alternative ways to revoke.
- All revocations "must be honored within a reasonable time not to exceed ten business days from receipt."
- (a)(11): callers that do **not** designate an exclusive method "must process revocation requests made by any reasonable means." Other means create "a rebuttable presumption that the consumer has revoked consent."
- (a)(12): a confirmation text that "merely confirms" the revocation and contains no marketing is permitted. "If the confirmation text is sent within five minutes of receipt, it will be presumed to fall within the consumer's prior express consent."

**Analysis:**
- Until 2026-11-25 the **any-reasonable-means** standard applies with no exclusive-method option. After that date, designating "reply STOP" as exclusive is lawful under federal rules. It is risky in practice, though:
  - (a) CTIA guidance says senders should act on natural-language opt-outs ("please opt me out").
  - (b) State laws and plaintiffs will test "clear and conspicuous."
  - (c) A seller who writes "don't text me again" and keeps receiving texts is a bad fact pattern.
- **Recommendation:** do not rely on exclusivity. Honor the seven words, CTIA's list, and natural-language revocations detected by a classifier with human review.

### 2.6 One-to-one consent rule (Fact)
- *Insurance Marketing Coalition Ltd. v. FCC*, 127 F.4th 303 (11th Cir. Jan. 24, 2025) vacated the FCC's one-to-one consent and "logically and topically associated" requirements as exceeding statutory authority. — https://www.goodwinlaw.com/en/insights/blogs/2025/09/the-fcc-issues-final-rule-formally-eliminating-the-one-to-one-consent-requirement (retrieved 2026-11; reporter cite per that source)
- The FCC issued a final rule in 2025 reinstating the prior (f)(9) text. Secondary sources date it 2025-08-29 (**unverified** FR citation). The current eCFR (f)(9), quoted in §2.1 above, contains no one-to-one language (Fact).
- **Analysis:** Even without the federal rule, carrier policy (CTIA: "A Consumer opt-in to receive messages should not be transferable or assignable") and Twilio's policy ("you are prohibited … if you buy, sell, rent, or transfer consent") produce one-to-one consent in practice. Consent captured by one tenant must never authorize another tenant.

### 2.7 Courts no longer defer to FCC interpretations; texts-as-calls split (Fact)
- *McLaughlin Chiropractic Associates v. McKesson Corp.*, No. 23-1226 (U.S. June 20, 2025): the Hobbs Act does not bind district courts to the FCC's TCPA interpretations in enforcement proceedings. — https://www.supremecourt.gov/opinions/24pdf/23-1226_1a72.pdf (retrieved 2026-11)
- Since then, courts have split on whether texts are "telephone calls" under the DNC private right of action (§227(c)(5)). The Seventh Circuit held they are not in *Steidinger v. Blackstone Medical Services*, No. 25-2398 (7th Cir. July 14, 2026). Other courts disagree (e.g., *Mujahid*, N.D. Ill. Nov. 10, 2025). — https://www.troutman.com/insights/seventh-circuit-rules-text-messages-are-not-telephone-calls-under-tcpa-§-227c5-a-circuit-split-emerges/ ; https://ktslaw.com/blog/classaction/2025/11/tcpa (retrieved 2026-11; **unverified** against opinions)
- **Analysis:** Do not rely on this split. It varies by circuit, may reach the Supreme Court, and does not affect state laws that expressly cover texts (FL, MD, OK, TX after SB 140, CT).

### 2.8 Do-Not-Call: national registry, internal lists, safe harbor (Fact)
- **Calling hours (federal):** no telephone solicitation "before the hour of 8 a.m. or after 9 p.m. (local time at the called party's location)." — 47 CFR 64.1200(c)(1). The TSR has the same window — 16 CFR 310.4(c).
- **National DNC registry and safe harbor:** 64.1200(c)(2)(i)(A)–(E). Required elements: written procedures, trained personnel, a maintained internal DNC list, use of a registry version "obtained from the administrator of the registry **no more than 31 days prior** to the date any call is made" with records documenting the process, and buying registry access directly. The rule also bars "any arrangement to share the cost of accessing the national database." The TSR equivalent is 16 CFR 310.4(b)(3)(iv) ("no more than thirty-one (31) days prior").
- **Texts:** 64.1200(e) applies (c) and (d) to "telephone solicitations or telemarketing calls or text messages to wireless telephone numbers."
- **Entity-specific (internal) DNC:** 64.1200(d)(3): record the request at the time it is made and honor it within a reasonable time "not [to] exceed ten (10) business days." (d)(6): "A do-not-call request must be honored for 5 years from the time the request is made." (d)(1)–(2): written policy available on demand, and trained personnel. (d)(4): give the caller's name, the entity's name, and a contact number or address.
- **Registry fees (FY2027, effective 2026-10-01):** $85 per area code; $43 per additional area code for a half year; $23,425 maximum for all area codes; the first five area codes are free. — https://tcpaworld.com/2026/08/26/update-ftc-announces-2027-telemarketer-fees-to-access-the-national-do-not-call-registry/ (retrieved 2026-11; secondary, citing FTC). FY2026 for comparison: $82, $41, $22,626 (FTC press release via search).
- **TSR scope and records:** TSR "telemarketing" is a campaign "to induce the purchase of goods or services" (16 CFR 310.2). TSR recordkeeping requires keeping specified telemarketing records **for 5 years** (16 CFR 310.5, including per-call records of calling/called number, time, duration, script, disposition). — eCFR Title 16 Part 310 (retrieved 2026-11 via eCFR API)
- **Reassigned Numbers Database (RND) safe harbor:** 64.1200(m). A caller with prior consent is not liable for calling a reassigned number if it queried the database and got a response of **"no"** and the database was wrong. The caller bears the burden of proof. Secondary guidance: "yes" or "no data" responses do not qualify.

**Analysis:**
- TSR coverage of *buying* calls is doubtful, since the definition targets inducing purchases *from* consumers. TCPA (f)(13) "property … investment" language is broader. Apply the TSR's 5-year record retention anyway; it costs little and doubles as evidence.
- Because cost-sharing is prohibited, **each tenant (seller) needs its own SAN**. Northstar can access the registry as the tenant's service provider under the tenant's SAN and must not pool one download across tenants.

### 2.9 Statute of limitations (Analysis)
- The TCPA has no express limitations period. Courts generally apply the 4-year federal catch-all (28 U.S.C. §1658). Retain consent and contact evidence for at least **5 years after the last contact** to match the TSR/DNC 5-year periods and cover the limitations window.

---

## 3. State mini-TCPAs and telemarketing laws

| State | Key rules (Fact) | Source (retrieved 2026-11) |
|---|---|---|
| **Florida** — FTSA, Fla. Stat. §501.059 (2026 statutes; last amended ch. 2023-150) | PEWC required for unsolicited "telephonic sales call" (call, **text**, or voicemail) using "an automated system for the selection and dialing of telephone numbers or the playing of a recorded message" (§501.059(8)(a)). Rebuttable presumption that a call to a Florida area code reaches a Florida resident (§501.059(8)(d)). Text opt-out: the called party replies "STOP"; the solicitor must cease within **15 days** of that notice (§501.059(10)(c)); whether the notice is a precondition to suit should be confirmed by counsel. Damages: greater of actual or **$500**, up to treble if willful/knowing (§501.059(10)). | http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0501/Sections/0501.059.html |
| **Florida** — Telemarketing Act, Fla. Stat. §501.616(6) | No commercial telephone solicitation call "before 8 a.m. or after 8 p.m. local time in the called person's time zone." No "more than three commercial telephone solicitation phone calls from any number to a person over a 24-hour period on the same subject matter or issue, regardless of the phone number used." | http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0501/Sections/0501.616.html |
| **Oklahoma** — Telephone Solicitation Act of 2022, 15 O.S. §775C.1 et seq. (eff. 2022-11-01) | Consent for automated selection/dialing or recorded messages. **8 a.m.–8 p.m.** local time. No more than **3** calls per 24 hours on the same subject. Area-code presumption. Private right of action. (Statute text not retrieved directly; enrolled bill HB 3168 and secondary summaries.) | https://oklegislature.gov/cf_pdf/2021-22%20ENR/hB/HB3168%20ENR.PDF ; https://www.manatt.com/insights/newsletters/tcpa-connect/oklahomas-mini-tcpa-takes-effect (**verify**) |
| **Maryland** — Stop the Spam Calls Act, Md. Code Com. Law §§14-4501–4503 (eff. 2024-01-01) | PEWC (state definition, §14-4501(d)) required for solicitation involving "an automated system for the selection **or** dialing of telephone numbers" or a recorded message (§14-4502(a)(3)). No solicitation "during the hours between 8 p.m. and 8 a.m. in the called party's time zone," nor "more than three times to the same called party during a 24-hour period on the same subject matter or issue, regardless of the telephone numbers used" (§14-4502(c)). Caller ID must be transmitted (§14-4502(b)). Area-code presumption (§14-4503(b)). Private action: up to $500 or actual damages, up to treble if willful (§14-4503(a)(2)). | https://mgaleg.maryland.gov/2026RS/Statute_Web/gcl/14-4501.pdf ; …/14-4502.pdf ; …/14-4503.pdf |
| **Texas** — SB 140 (89th Leg.), Tex. Bus. & Com. Code chs. 301–306 (eff. 2025-09-01) | Extends the telephone-solicitation chapters to texts and image messages. Sellers must file an annual registration with the Secretary of State (secondary: **$10,000** security + **$200** filing fee per location) unless exempt (e.g., certain current/former-customer solicitations, §302.058). Expanded DTPA private right of action; state no-call list violations (§304.052). | https://www.morganlewis.com/pubs/2025/09/texas-telephone-solicitation-law-now-covers-text-messages (secondary). A reported Nov. 2025 settlement/guidance on consent-based texting exemptions is **unverified**. |
| **Connecticut** — Conn. Gen. Stat. §42-288a (as amended by PA 23-98 / SB 1058, 2023) | Telephonic sales calls (incl. texts) require PEWC. Secondary sources report a **9 a.m.–8 p.m.** calling window. | https://manatt.com/insights/newsletters/tcpa-connect/connecticut-senate-bill-1058 (secondary). Statute page unavailable (503) at retrieval; **verify hours**. |
| **Other states with own DNC lists and/or stricter hours** | Several states maintain their own DNC lists or calling-hour rules (e.g., Texas no-call list; others commonly cited include Colorado, Indiana, Louisiana, Massachusetts, Missouri, Pennsylvania, Tennessee, Wyoming). Washington and others reportedly use an 8 p.m. evening cutoff. | **Unverified.** Counsel to confirm the list before launch. |

**Analysis — "strictest-state" operating rule for Northstar**
- **Quiet hours:** send/dial only **08:00–20:00** in the recipient's local time. Where any applicable state is stricter (e.g., CT's reported 9 a.m. start), use the stricter window. Determine the "applicable states" as the union of: (a) the state of the number's area code (FL/OK/MD presumptions), (b) the property's state, (c) the owner's mailing-address state, and (d) any known current location. If a timezone cannot be determined, do not send.
- **Frequency:** at most **3** solicitation attempts (calls + texts + voicemails) per recipient per **rolling 24 hours** per tenant on the same subject, regardless of the number used.
- **Consent standard:** require PEWC for any automated or AI channel to any recipient, since FL/MD/OK/CT define automation more broadly than federal law.
- **Texas:** block marketing texts to Texas recipients unless the tenant attests to SB 140 registration (certificate number stored) or a documented exemption reviewed by counsel.

---

## 4. Carrier rules: CTIA, A2P 10DLC, Twilio

### 4.1 CTIA Messaging Principles and Best Practices (May 2023) (Fact)
Source: https://api.ctia.org/wp-content/uploads/2023/05/230523-CTIA-Messaging-Principles-and-Best-Practices-FINAL.pdf (retrieved 2026-11)
- **Consent records to retain:** "Timestamp of consent acquisition; Consent acquisition medium …; Capture of experience (e.g., language and action) used to secure consent; Specific campaign for which the opt-in was provided; IP address used to grant consent; Consumer phone number …; and Identity of the individual who consented."
- **Opt-in confirmation (recurring programs):** send a confirmation with program name, customer-care contact (or HELP), how to opt out, message frequency, and fee disclosures before further messages.
- **One opt-in per campaign:** "A Consumer opt-in to receive messages should not be transferable or assignable."
- **Opt-out:** support multiple mechanisms (call, email, text). Send "one final opt-out confirmation message per campaign," then nothing more. Standard "STOP" wording, but "opt-out requests with normal language (i.e., stop, end, unsubscribe, cancel, quit, 'please opt me out') should also be read and acted upon." Capitalization or punctuation variances must not invalidate an opt-out.
- **No rented, sold, or shared opt-in lists.** Process deactivation files regularly (e.g., daily).

### 4.2 Twilio Messaging Policy (last updated 2026-04-13) (Fact)
Source: https://www.twilio.com/en-us/legal/messaging-policy (retrieved 2026-11)
- "You must obtain prior express consent from the message recipient" before sending. "Sending messages that market or promote a specific product or service requires prior express written consent." Consent is "freely given by each recipient to each sender for each message subject."
- Prohibited: buying, selling, renting, or transferring consent; "Sending any unsolicited or unwanted messages in bulk"; "snowshoeing"; misspelling opt-out keywords to evade filters.
- The first message must include opt-out language (e.g., "Reply STOP to unsubscribe"). Opt-out must be a single step. One final confirmation is allowed.

### 4.3 A2P 10DLC registration and common rejections (Fact)
- Unregistered 10DLC traffic to U.S. numbers is blocked (Twilio error 30034). Twilio's support article cites full blocking from 2023-09-01. Other sources cite later hard-block dates (e.g., February 2025) (**dates vary; unverified**). — https://support.twilio.com/hc/en-us/articles/14910496447771-Shutdown-of-Unregistered-10DLC-Messaging (retrieved 2026-11)
- Rejection codes relevant to real estate investors (Twilio docs, retrieved 2026-11):
  - **30951**, third-party lead generation / shared or resold consent; "not eligible for resubmission"; "Consent obtained for one business cannot be transferred to or shared with another entity." — https://www.twilio.com/docs/api/errors/30951
  - **30882**, affiliate marketing or third-party lead generation use case.
  - **30932**, privacy policy indicates opt-in data may be shared with third parties/affiliates/lead generators.
  - **30924**, missing or non-compliant consent language ("General Terms of Service acceptance does not constitute messaging consent").
  - **30925**, opt-in checkbox pre-checked; active consent required.

**Analysis — why real estate investor campaigns get rejected, and how Northstar avoids it**

| Typical cause | Northstar control |
|---|---|
| Sample messages read like cold outreach ("Hi, are you the owner of 123 Main? Would you sell?") with no evidence of opt-in | Campaign registration wizard requires a live opt-in URL/screenshot. Sample messages must reference the seller's own inquiry ("Thanks for requesting a cash offer on…"). |
| Opt-in flow is a general ToS checkbox, pre-checked, or missing SMS-specific language | Hosted lead forms with an unchecked, SMS-specific PEWC checkbox naming the tenant brand. |
| Privacy policy allows sharing leads with "partners/affiliates/buyers" | Tenant privacy-policy generator with the required "mobile opt-in data will not be shared or sold to third parties for marketing" clause. |
| Business model resembles lead gen (selling seller leads to other investors/agents) | Disallow "lead selling" use cases in Northstar ToS; one brand per tenant campaign. |
| Brand/EIN mismatch, website not live, no business identity | Brand-registration preflight (legal name = EIN record, live website, matching contact info). |
| Using purchased or skip-traced lists | Hard block: numbers without consent records cannot enter SMS sequences (§9). |

- **ISV model (Analysis; verify with Twilio):** Northstar should register each tenant as its own brand and campaign (secondary-customer model), not send all tenants' traffic under a Northstar brand.

---

## 5. Call recording consent (Fact + Analysis)

- **Federal:** one-party consent (18 U.S.C. §2511(2)(d)).
- **All-party (two-party) consent states commonly listed:** California (Penal Code §§632, 632.7), Florida (§934.03), Illinois (720 ILCS 5/14-2), Maryland (Cts. & Jud. Proc. §10-402), Massachusetts (G.L. c. 272 §99), Montana (§45-8-213), New Hampshire (RSA 570-A:2), Pennsylvania (18 Pa.C.S. §5704), Washington (RCW 9.73.030). Connecticut has a civil all-party requirement for phone calls (§52-570d). Nevada, Oregon, Michigan, and Delaware have nuances. — Reporters Committee for Freedom of the Press recording guide, https://www.rcfp.org/introduction-to-reporters-recording-guide/ , and secondary summaries (retrieved 2026-11). **Citations for FL, MD, MA, MT, NH, WA not verified against statute text in this pass.**
- **Analysis:** Northstar records and transcribes calls (AI and human) for QA, consent evidence, and audit. Use a **universal all-party disclosure** at the start of every call ("This call is recorded and may be transcribed…"). For inbound calls, disclose before substantive conversation. If the party objects, stop recording, or hand off to a human without recording. Store the disclosure event in the audit log. For cross-state calls, apply the stricter rule (CA §632.7 covers cellular/cordless communications).

---

## 6. AI disclosure laws (bots, AI voice)

| Jurisdiction | Rule (Fact) | Source (retrieved 2026-11) |
|---|---|---|
| **Federal (FCC)** | AI-generated voices are "artificial" (FCC 24-17). AI-disclosure NPRM (FCC 24-84) pending; **status unverified**. | See §2.3 |
| **California — B.O.T. Act**, Bus. & Prof. Code §§17940–17943 (SB 1001, 2018) | Unlawful to use a bot to communicate or interact with a person in California **online** with intent to mislead about its artificial identity in order to incentivize a purchase or sale of goods or services (or influence a vote). No liability if the bot clearly and conspicuously discloses that it is a bot. AB 410 (2025) proposed amendments; **enactment unverified**. | https://california.public.law/codes/business_and_professions_code_section_17941 ; https://legiscan.com/CA/bill/AB410/2172 (leginfo blocked automated retrieval) |
| **California — AB 2905** (Ch. 316, Stats. 2024; eff. 2025-01-01) | For calls using automatic dialing-announcing devices, the required natural-voice announcement must state whether the prerecorded message uses an artificial voice (AI-generated or significantly altered). Codified in the Public Utilities Code ADAD provisions (exact section **unverified**). | https://legiscan.com/CA/text/AB2905/2023 ; https://calmatters.digitaldemocracy.org/bills/ca_202320240ab2905 |
| **Utah — AI Policy Act**, Utah Code §§13-75-101 to -104 (SB 226, eff. 2025-05-07) | §13-75-103(1): a supplier using generative AI in a consumer transaction must disclose that the individual is interacting with AI "if the individual asks or otherwise prompts," and the prompt must be "a clear and unambiguous request." §13-75-103(2)–(3): regulated occupations (Department of Commerce licensees; *Analysis:* Utah real-estate licensees appear to qualify because the Division of Real Estate sits within the Department of Commerce) must "prominently disclose" AI in **high-risk** interactions (collecting financial/health/biometric data, or advice relied on for significant decisions), verbally at the start of voice interactions and in writing before text interactions. §13-75-104 **safe harbor**: no enforcement if the AI "clearly and conspicuously discloses … at the outset of any interaction … and throughout the interaction" that it is generative AI / not human / an AI assistant. | https://le.utah.gov/Session/2025/bills/enrolled/SB0226.pdf |
| **Maine** — P.L. 2025, ch. 294 (10 M.R.S. §1500-DD per secondary sources; eff. ~2025-09) | A business may not use an AI chatbot (text or "aural" communications) in trade or commerce in a way that may mislead a reasonable consumer into believing they are interacting with a human, unless it makes a clear and conspicuous disclosure. Enforced under the Unfair Trade Practices Act. | https://legislature.maine.gov/legis/statutes/10/title10sec1500-DD-1.html ; https://www.multistate.ai/ai-policy-overview-maine (section number **verify**) |
| **Colorado, Texas, others (2025–2026)** | Colorado's AI Act was reportedly repealed and reenacted in narrower form (SB 26-189, signed 2026-05-14, effective 2027-01-01). Texas TRAIGA took effect 2026-01-01. Scope as applied to outbound sales bots is **unverified**. | Secondary trackers, e.g., https://www.cooley.com/news/insight/2025/2025-10-21-ai-chatbots-at-the-crossroads-navigating-new-laws-and-compliance-risks |

**Analysis — Northstar's disclosure standard:** One rule for every jurisdiction:
1. Every AI voice call opens (within the first sentence, before any question) with: the AI identity ("an automated AI assistant"), the tenant's registered business name, the call purpose, and the recording notice.
2. Every AI-initiated SMS thread's first message, plus any message after 30 days of inactivity, identifies the sender as an automated assistant for [Brand].
3. Answer truthfully at any time when asked "Are you a real person?" Never claim or imply being human.
4. Offer a human handoff on request.

This meets the Utah safe harbor, Maine, the California bot law, and the anticipated FCC disclosure rule.

---

## 7. Fair Housing Act implications for lead scoring and targeting

**Facts**
- The Fair Housing Act prohibits discrimination in the sale or rental of dwellings and in residential real-estate-related transactions because of race, color, religion, sex (incl. sexual orientation and gender identity per HUD's prior interpretation, **status unverified**), familial status, national origin, or disability. It also bars making, printing, or publishing any notice, statement, or advertisement with respect to the sale of a dwelling that indicates a preference, limitation, or discrimination (42 U.S.C. §§3604, 3605). Disparate-impact claims are cognizable (*Texas Dep't of Housing & Community Affairs v. Inclusive Communities Project*, 576 U.S. 519 (2015)).
- HUD withdrew a set of fair-housing guidance documents, including its April 2024 guidance on AI and digital advertising, reportedly effective 2025-09-17 (formal publication reported 2026-04-06; **unverified**). — https://natlawreview.com/article/mapping-boundaries-algorithmic-authority (retrieved 2026-11)
- HUD proposed removing its discriminatory-effects regulation (24 CFR 100.500) on 2026-01-14 (FR doc. 2026-00590), citing Executive Order 14281, and would leave disparate-impact interpretation to the courts. We found no final rule as of 2026-11 (**unverified**). — https://www.govinfo.gov/content/pkg/FR-2026-01-14/html/2026-00590.htm (retrieved 2026-11)

**Analysis**
- The statute, private rights of action, state fair-housing laws, and state AG enforcement are unchanged. Less HUD enforcement does not mean less liability, and state laws often add protected classes (e.g., source of income, age, marital status, ancestry).
- Wholesalers **buy** from homeowners, but the transaction is still a "sale of a dwelling." Discriminatory targeting (e.g., aiming lowball cash offers at minority neighborhoods) or discriminatory statements by an AI agent can create liability.
- **Product requirements:**
  - No protected-class attributes or close proxies in lead scoring, list building, or offer logic. Excluded inputs: race/ethnicity, national origin, religion, sex, familial status, disability, age, surname-ethnicity inference, language preference used for scoring, and census-tract demographic composition.
  - Score on property and financial-distress facts only (e.g., tax delinquency, vacancy, liens, equity). Document each feature's business justification.
  - Run periodic disparate-impact testing of score and offer distributions by geography, using external demographic data in a separate, access-controlled analysis environment only.
  - AI agent guardrails: never comment on neighborhood demographics, schools-as-proxy, "type of people," religion, or disability. Never steer. Use consistent offer methodology across areas. Provide accessible handoff for persons with disabilities (TTY/relay acceptance).

---

## 8. Wholesaling licensing and disclosure laws (what an AI agent may say)

**Facts (primary sources verified)**
- **Pennsylvania — Act 52 of 2024** (SB 1173; approved 2024-07-08; effective in 180 days, i.e., 2025-01-04).
  - "Wholesale transaction": "Undertaking to promote the sale, exchange or purchase of an equitable interest or other interest in residential property with the intent to assign, sell or otherwise transfer the interest for a fee … without having taken title." It falls within brokerage, and the owner exclusion "shall not apply to a wholesale transaction."
  - Consumers may cancel until midnight of the **30th day** after execution or until conveyance, whichever is first. If required disclosures are missing, they may cancel any time before conveyance.
  - Contracts must prominently state the wholesale intent, the right to an appraisal or independent counsel, the cancellation right, and a 10-business-day refund.
  - Source: Act text, https://www.legis.state.pa.us/cfdocs/legis/li/uconsCheck.cfm?yr=2024&sessInd=0&act=52 (copy retrieved 2026-11 via https://go.stewart.com/rs/067-YWO-436/images/2024%20Act%2052%20-%20PA%20General%20Assembly.pdf)
- **Oregon — HB 4058 (2024)**: residential property wholesalers must register with the Oregon Real Estate Agency from **2025-07-01** ($300; annual renewal) unless licensed.
  - Written disclosure (≥10-pt bold) goes to buyers and sellers before contracting, to assisting brokers, and **in any advertising**.
  - It must state that the wholesaler holds only an equitable interest, "may not be a licensed broker or appraiser," and may assign for profit.
  - Three-business-day cancellation right. If the seller never received the disclosure, the seller may terminate at any time.
  - Source: https://www.oregon.gov/rea/newsroom/pages/2024-oren-j/property-wholesaling-law-rule-overview.aspx (retrieved 2026-11)

**Reported (secondary tracker; verify each before relying)** — https://ispeedtolead.com/blog/wholesaling-laws-by-state-2026/ (data "as of October 23, 2026", retrieved 2026-11):

| State | Model | Citation (reported) | Effective (reported) |
|---|---|---|---|
| Illinois | License if wholesaling on more than one occasion in 12 months | PA 101-0357; 225 ILCS 454/1-10 | 2019/2020 |
| Oklahoma | License to publicly market an equitable interest; strengthened | Predatory Real Estate Wholesaler Prohibition Act; SB 1075 | 2025-11-01 (SB 1075) |
| Ohio | Signed boldface disclosure before binding contract; cancellation if missing | SB 155; ORC 5301.95 | 2026-03-02 |
| Connecticut | Registration with Dept. of Consumer Protection; 3-business-day cancellation | Public Act 25-168 | 2026-07-01 |
| Tennessee | Disclosure to seller and assignee; notice before assignment | Public Chapter 72 (2025) | 2025-03-25 |
| Maryland | Pre-contract notice to owner-occupants; rescission if missing | HB 124, Ch. 508 (2025) | 2025-10-01 |
| Virginia | License if 2+ contract deals in 12 months | HB 917 | 2024-07-01 |
| Texas | Written equitable-interest disclosure | SB 1577 | 2024-01-01 |
| South Carolina, Nebraska, Iowa, Alabama, Arizona, Georgia, Indiana, Kentucky, Wisconsin, North Dakota, Louisiana (2026), Missouri (2026), Delaware (2026–27), Rhode Island (2027) | Various license/disclosure models | See tracker | Various |
| North Carolina | HB 797 passed House 2025; **not enacted** per tracker | — | — |

**Analysis — AI agent speech rules derived from these laws**
1. **Identity and intent:** In disclosure states, the AI must not describe the tenant as "the buyer who will close" if the tenant intends to assign. It must deliver (or trigger delivery of) the state's required wholesaler disclosure before any contract is presented. Contract generation is gated on the disclosure being acknowledged.
2. **No public marketing of equitable interests** in licensing-gated states (e.g., OK, PA, IL patterns). Disposition (buyer-side) blasts are outside MVP and must be licensing-gated per state.
3. **No valuation opinions presented as appraisals:** never call an offer "fair market value," "appraised value," or "what your home is worth." Use "our offer" and "our estimate based on [sources]." Oregon's disclosure itself warns that wholesalers "may not be a licensed … appraiser."
4. **No legal, tax, or financial advice.** Remind sellers of rights where required (PA: appraisal, independent counsel, 30-day cancellation; OR: 3-business-day cancellation).
5. **Licensing attestation per tenant per state:** tenants declare license or registration numbers (PA license, OR registration, CT registration, TX disclosures). The agent's state-specific script pack activates only when attestations exist.
6. **No pressure or deception:** no false urgency ("offer expires in 1 hour"), no misrepresenting the business as a government program, lender, or agent.

---

## 9. Product requirements (controls Northstar must implement)

Each requirement is **Analysis** (a design decision) derived from the facts above. "MUST" = launch blocker.

### 9.1 Consent capture and evidence
1. **MUST** capture consent per **tenant brand × phone number × channel (SMS / voice / AI-voice / prerecorded) × purpose (marketing / informational)**. Consent never transfers across tenants.
2. **MUST** use hosted or embeddable forms with an **unchecked** checkbox and PEWC language that names the tenant's legal business name and covers "calls and texts, including by automated technology and AI-generated or prerecorded voice." The language must state that consent is not a condition of any purchase or sale, and the form must link to Terms and a Privacy Policy that says mobile opt-in data is not shared or sold.
3. **MUST** store the evidence record. Fields: timestamp (UTC + recipient local), phone number, name/identifier, IP address, user agent, page URL, form/version ID, **exact disclosure text shown**, checkbox state, a screenshot or DOM snapshot hash, campaign ID, capture medium (web, inbound SMS keyword, IVR, verbal, paper upload), and the e-signature method. Records are immutable, with a SHA-256 hash.
4. **MUST** support verbal-consent capture on recorded calls only for non-telemarketing purposes. Verbal consent is **not** treated as PEWC unless E-SIGN-compliant signature evidence exists.
5. **MUST** classify every imported or skip-traced number as `consent = none`. These numbers are **ineligible** for automated SMS, AI-voice, prerecorded, or power/predictive dialing. Only human, one-at-a-time click-to-dial is allowed, subject to 9.4–9.6.
6. **MUST** send a CTIA opt-in confirmation for recurring SMS programs (brand, HELP/contact, frequency, "Msg & data rates may apply," STOP instructions).

### 9.2 Suppression lists
7. **MUST** maintain layered suppression checked at send/dial time, not only at upload:
   - (a) tenant internal DNC (entity-specific);
   - (b) Northstar platform-wide hard-suppression (court orders, verified litigator/complaint numbers, carrier-reported deactivations, wrong-number flags);
   - (c) National DNC registry;
   - (d) state DNC lists where applicable;
   - (e) the RND result for consented numbers;
   - (f) tenant-uploaded suppressions.
8. **MUST** honor internal DNC entries for **≥5 years** from the request (47 CFR 64.1200(d)(6)). Default: never auto-expire.
9. **SHOULD** run a commercial litigator scrub. Treat it as a risk signal, not a substitute for consent.

### 9.3 Opt-out and revocation handling
10. **MUST** treat as revocation, case- and punctuation-insensitively:
    - the seven FCC words (stop, quit, end, revoke, opt out, cancel, unsubscribe);
    - CTIA terms;
    - common variants ("stop texting," "remove me," "do not contact," "wrong number," profanity-plus-stop);
    - opt-outs by voice ("take me off your list"), key press, email, web form, or inbound call;
    - **natural-language revocations** detected by an NLU classifier.
11. **MUST** auto-apply suppression **within 60 seconds** of receipt for keyword or high-confidence matches. Ambiguous messages go to a human review queue with an SLA of **≤1 business day**, and messaging is paused for that number while in review. The legal outer limit is 10 business days (64.1200(a)(10)–(11), (d)(3)); Northstar's target is same-minute.
12. **MUST** treat a revocation of marketing consent as revoking **all** tenant marketing on all channels and campaigns (FCC 26-67). Informational-only scoping is allowed only for genuinely non-marketing messages (e.g., a closing-date reminder on a signed contract), and counsel must approve the template.
13. **MUST** send at most **one** confirmation text within **5 minutes**, with no marketing content, then nothing further (64.1200(a)(12); CTIA; Twilio).
14. **MUST** include an opt-out instruction ("Reply STOP to opt out") in the first message of every thread and periodically after (at least once every 5 messages or 30 days). AI voice calls offer key-press/voice opt-out per 64.1200(b)(3) within 2 seconds of identification for any prerecorded or artificial-voice telemarketing message.
15. **MUST NOT** rely on exclusive revocation methods, even after 2026-11-25. Honor revocations by any reasonable means.

### 9.4 Quiet hours and frequency (recipient local time, strictest state)
16. **MUST** allow sends and dials only between **08:00 and 20:00** recipient local time. Exception: where any applicable state is stricter (CT reportedly 09:00 start), apply the stricter window. Applicable states are the union of area-code state, property state, mailing-address state, and known location. Use the **earliest end and latest start** across them. Unknown timezone means no send.
17. **MUST** enforce a cap of **3** solicitation attempts per recipient per **rolling 24 hours** per tenant on the same subject, across all numbers and channels (FL §501.616(6)(b); MD §14-4502(c)(2); OK). Count voicemail drops and AI calls as attempts.
18. **SHOULD** support tenant-configurable stricter limits and a state-holiday calendar (holiday restrictions in certain states are **unverified**; default to no outreach on federal holidays until confirmed).
19. **MUST** queue messages scheduled during quiet hours to the next permitted window rather than dropping them silently, and must re-check suppression at actual send time.

### 9.5 DNC scrubbing integration
20. **MUST** require each tenant to hold its own National DNC Registry SAN (no cost-sharing; 64.1200(c)(2)(i)(E)). Northstar downloads or queries under each tenant's SAN as service provider.
21. **MUST** refresh registry data at least every **31 days**. Northstar target: **daily** delta refresh, with a full refresh at least weekly. Scrub at send time, and log the registry version date used for each message or call.
22. **MUST** block telephone solicitations to registry numbers unless a documented PEWC/signed written agreement exists (64.1200(c)(2)(ii)). Northstar does not apply the "offer-to-buy" exemption by default.
23. **MUST** query the FCC Reassigned Numbers Database for consented numbers at least every **30 days** (and before the first contact after a gap of more than 30 days). Suppress "yes" results; treat "no data" as unverified.
24. **MUST** maintain written DNC procedures and a training record (safe-harbor elements); generate the tenant-facing policy document automatically.

### 9.6 Channel and technology controls
25. **MUST** register every tenant brand and campaign for A2P 10DLC (or verified toll-free) before any SMS. Block sending until the campaign is approved. Run a preflight: EIN/legal name match, live website, opt-in evidence URL, compliant privacy policy, sample messages that reference consent.
26. **MUST NOT** offer predictive/power dialing, ringless voicemail, or AI-voice outbound to non-consented numbers.
27. **MUST** present accurate caller ID (tenant-owned or tenant-authorized numbers; CNAM = tenant brand where available). No spoofing, and no "snowshoeing" across number pools.
28. **MUST** block Texas marketing texts absent a stored SB 140 registration certificate or a counsel-approved exemption.

### 9.7 AI disclosure and conduct
29. **MUST** have AI voice open with the AI identity, the tenant's legal business name, the purpose, and the recording disclosure, before any question. AI SMS must self-identify in the first message of each thread. The agent must answer truthfully whenever asked whether it is human (Utah §13-75-103/104; Maine; CA §17941).
30. **MUST** apply content guardrails: no fair-housing-sensitive statements, no appraisal/FMV claims, no legal/tax advice, no false urgency, no misrepresentation of identity or of wholesale intent. State script packs (PA, OR, OH, TN, MD, CT, TX, etc.) inject required disclosures.
31. **MUST** gate contract generation on state wholesaler disclosure acknowledgment and on tenant licensing/registration attestations where required.

### 9.8 Human handoff
32. **MUST** offer warm transfer or a callback to a human: on request; on any revocation ambiguity; on any legal, eviction, foreclosure-deadline, probate, divorce, or disability accommodation topic; on signs of distress, confusion, or diminished capacity; on any fair-housing-sensitive topic; and when AI confidence falls below threshold.
33. **MUST** meet handoff SLAs. Live transfer when an agent is available during business hours. Otherwise, a scheduled callback within the next business day inside quiet hours. The AI must state honestly when a human is not available.

### 9.9 Call recording
34. **MUST** give an all-party recording/transcription disclosure at the start of every call (inbound and outbound). On objection, stop recording, or transfer to a human without recording. Log the disclosure event.

### 9.10 Record retention
35. **MUST** retain for at least **5 years** after the later of last contact or revocation:
    - consent evidence and revocations;
    - DNC requests (≥5 years from request; 64.1200(d)(6));
    - per-message/per-call logs (to, from, timestamps, content/script, AI prompt version, disposition, recording/transcript references);
    - registry and RND scrub results;
    - campaign registrations.
   This aligns with TSR 16 CFR 310.5 (5 years), the 4-year federal limitations period, BatchData §6.13(d), and DPPA §2721(c) (5 years). Recordings and transcripts follow the same period unless tenant policy or law requires shorter; that choice is pending counsel review of privacy and state law.
36. **MUST** support legal hold (suspends deletion) and per-tenant export of the evidence package for a given phone number.

### 9.11 Audit logs
37. **MUST** keep append-only, tamper-evident (hash-chained) audit logs for every outbound attempt. Each entry records: the consent record ID relied on, the suppression checks performed with their list versions, the applicable states and computed allowed window, the frequency counter, the AI disclosure and recording disclosure events, the policy-engine decision and reason codes, and the actor (user, AI agent version, or automation rule).
38. **MUST** log admin changes to consent, suppression, quiet-hours settings, and scripts with before/after values and actor identity. Provide compliance dashboards for opt-out latency, quiet-hour blocks, cap hits, and complaint rates, with alerting.
39. **MUST** provide a platform kill switch (per tenant, per campaign, global) and automatic campaign pause when carrier complaint or opt-out rates exceed thresholds (e.g., opt-out rate >5% on a campaign day; threshold to be tuned).

### 9.12 Governance
40. **MUST** route every legal parameter in this list (hours, caps, state packs, keyword lists) through a versioned policy configuration reviewed by counsel. Review quarterly and on legal change. The next scheduled change is FCC 26-67 on **2026-11-25**; FNPRM outcomes are pending, including a possible reduction of the 10-business-day window.

---

## 10. Source index (all retrieved 2026-11)

- eCFR 47 CFR 64.1200 (current, via eCFR API) — https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L/section-64.1200
- eCFR 16 CFR Part 310 (TSR) — https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-310
- FCC 26-67 / FR doc. 2026-21821 — https://public-inspection.federalregister.gov/2026-21821.pdf
- FCC 24-24 — https://docs.fcc.gov/public/attachments/FCC-24-24A1.pdf
- FCC DA 25-312 — https://docs.fcc.gov/public/attachments/DA-25-312A1.pdf
- FCC DA 26-12 — https://docs.fcc.gov/public/attachments/DA-26-12A1.pdf
- FCC 24-17 — https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf
- FCC 24-84 NPRM (FR 2024-09-10) — https://www.federalregister.gov/documents/2024/09/10/2024-19028/implications-of-artificial-intelligence-technologies-on-protecting-consumers-from-unwanted-robocalls
- *Facebook v. Duguid* — https://www.supremecourt.gov/opinions/20pdf/19-511_p86b.pdf
- *McLaughlin Chiropractic v. McKesson* — https://www.supremecourt.gov/opinions/24pdf/23-1226_1a72.pdf
- Florida §501.059, §501.616 — leg.state.fl.us (links in §3)
- Maryland Com. Law §§14-4501–4503 — mgaleg.maryland.gov (links in §3)
- Utah SB 226 (2025) — https://le.utah.gov/Session/2025/bills/enrolled/SB0226.pdf
- CTIA Messaging Principles (May 2023) — https://api.ctia.org/wp-content/uploads/2023/05/230523-CTIA-Messaging-Principles-and-Best-Practices-FINAL.pdf
- Twilio Messaging Policy — https://www.twilio.com/en-us/legal/messaging-policy ; Twilio error 30951 — https://www.twilio.com/docs/api/errors/30951
- Pennsylvania Act 52 of 2024 — https://www.legis.state.pa.us/cfdocs/legis/li/uconsCheck.cfm?yr=2024&sessInd=0&act=52
- Oregon REA wholesaling overview — https://www.oregon.gov/rea/newsroom/pages/2024-oren-j/property-wholesaling-law-rule-overview.aspx
- HUD disparate impact NPRM (FR 2026-01-14) — https://www.govinfo.gov/content/pkg/FR-2026-01-14/html/2026-00590.htm
- 18 U.S.C. §2721 (DPPA) — https://www.law.cornell.edu/uscode/text/18/2721

*End of document. Research only — not legal advice. Have qualified counsel review before launch.*
