import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANS, PlanValidationError, computeQuote, effectiveQuotas, maxExtraSeats, validateExtraSeats, TRIAL_CONTACT_CAP } from "./plans";
import { chargeMockCard, detectBrand, expiryValid, luhnValid, validateCard } from "./mock-card";
import { stepsForPlan, summarizeProgress } from "./onboarding-steps";
import { analyzeRows, guessMapping } from "./contact-import";
import { adoptionTips, type AdoptionInput } from "./adoption";
import { buildDemoFiche } from "./demo-fiche";

// ---------------- plans & pricing ----------------

test("monthly quote: base price + 20% VAT", () => {
    const q = computeQuote({ plan: "INDEPENDANT", cycle: "MONTHLY" });
    assert.equal(q.subtotalCents, 6_900);
    assert.equal(q.vatCents, 1_380);
    assert.equal(q.totalCents, 8_280);
    assert.equal(q.months, 1);
});

test("annual quote bills 12 months at the annual rate, seats included", () => {
    const q = computeQuote({ plan: "SMALL_BUSINESS", cycle: "ANNUAL", extraSeats: 2 });
    assert.equal(q.lines[0].amountCents, 18_900 * 12);
    assert.equal(q.lines[1].amountCents, 4_900 * 2 * 12);
    assert.equal(q.subtotalCents, 18_900 * 12 + 4_900 * 24);
    assert.equal(q.annualSavingCents, (22_900 - 18_900) * 12);
    assert.equal(q.recurringMonthlyCents, 18_900 + 9_800);
});

test("setup fee is a one-off line", () => {
    const q = computeQuote({ plan: "MEDIUM_BUSINESS", cycle: "MONTHLY", includeSetup: true });
    assert.equal(q.lines.at(-1)?.amountCents, 75_000);
    assert.equal(q.subtotalCents, 49_900 + 75_000);
});

test("annual prices match the commercial grid", () => {
    assert.equal(PLANS.INDEPENDANT.annualMonthlyPriceCents * 12, 70_800);
    assert.equal(PLANS.SMALL_BUSINESS.annualMonthlyPriceCents * 12, 226_800);
    assert.equal(PLANS.MEDIUM_BUSINESS.annualMonthlyPriceCents * 12, 502_800);
});

test("extra seats: none for Indépendant, max 4 for Small Business, unlimited for Medium", () => {
    assert.equal(maxExtraSeats("INDEPENDANT"), 0);
    assert.equal(maxExtraSeats("SMALL_BUSINESS"), 4);
    assert.equal(maxExtraSeats("MEDIUM_BUSINESS"), null);
    assert.throws(() => validateExtraSeats("INDEPENDANT", 1), PlanValidationError);
    assert.throws(() => validateExtraSeats("SMALL_BUSINESS", 5), PlanValidationError);
    assert.throws(() => validateExtraSeats("SMALL_BUSINESS", -1), PlanValidationError);
    assert.throws(() => validateExtraSeats("SMALL_BUSINESS", 1.5), PlanValidationError);
    assert.equal(validateExtraSeats("MEDIUM_BUSINESS", 40), 40);
});

test("only Medium Business is paid-only", () => {
    assert.equal(PLANS.INDEPENDANT.trialAvailable, true);
    assert.equal(PLANS.SMALL_BUSINESS.trialAvailable, true);
    assert.equal(PLANS.MEDIUM_BUSINESS.trialAvailable, false);
});

test("trial caps contacts and AI fiches but not seats", () => {
    const trial = effectiveQuotas("SMALL_BUSINESS", { extraSeats: 2, trialing: true });
    const paid = effectiveQuotas("SMALL_BUSINESS", { extraSeats: 2, trialing: false });
    assert.equal(trial.contacts, TRIAL_CONTACT_CAP);
    assert.equal(paid.contacts, 60_000);
    assert.equal(trial.seats, 5);
    assert.ok(trial.aiFichesPerMonth < paid.aiFichesPerMonth);
});

// ---------------- mock card ----------------

test("luhn and brand detection", () => {
    assert.equal(luhnValid("4242 4242 4242 4242"), true);
    assert.equal(luhnValid("4242 4242 4242 4241"), false);
    assert.equal(luhnValid("abcd"), false);
    assert.equal(detectBrand("4242424242424242"), "visa");
    assert.equal(detectBrand("5555555555554444"), "mastercard");
    assert.equal(detectBrand("378282246310005"), "amex");
});

test("expiry: end of month is still valid, past months are not", () => {
    const now = new Date(Date.UTC(2026, 9, 15)); // 15 Oct 2026
    assert.equal(expiryValid("10/26", now), true);
    assert.equal(expiryValid("09/26", now), false);
    assert.equal(expiryValid("13/27", now), false);
    assert.equal(expiryValid("1027", now), false);
});

test("validateCard reports every bad field", () => {
    const errs = validateCard({ number: "1234", expiry: "00/00", cvc: "1", holder: "" });
    assert.deepEqual(Object.keys(errs).sort(), ["cvc", "expiry", "holder", "number"]);
    assert.deepEqual(validateCard({ number: "4242424242424242", expiry: "12/40", cvc: "123", holder: "Ada" }, new Date(Date.UTC(2026, 0, 1))), {});
});

test("test cards produce the documented outcomes", () => {
    const card = (number: string) => ({ number, expiry: "12/40", cvc: "123", holder: "Ada" });
    assert.equal(chargeMockCard(card("4242424242424242")).ok, true);
    const declined = chargeMockCard(card("4000000000000002"));
    assert.equal(declined.ok, false);
    assert.equal(!declined.ok && declined.code, "card_declined");
    const sca = chargeMockCard(card("4000002760003184"));
    assert.equal(!sca.ok && sca.code, "requires_3ds");
    assert.equal(chargeMockCard(card("4000002760003184"), { threeDsConfirmed: true }).ok, true);
    const ok = chargeMockCard(card("4242 4242 4242 4242"));
    assert.equal(ok.ok && ok.last4, "4242");
});

// ---------------- onboarding progress ----------------

test("each plan gets its own steps", () => {
    const indep = stepsForPlan("INDEPENDANT").map((s) => s.key);
    const small = stepsForPlan("SMALL_BUSINESS").map((s) => s.key);
    const medium = stepsForPlan("MEDIUM_BUSINESS").map((s) => s.key);
    assert.ok(!indep.includes("team") && !indep.includes("white_label"));
    assert.ok(small.includes("team") && small.includes("exclusions") && !small.includes("white_label"));
    assert.ok(medium.includes("white_label") && medium.includes("client_viewer") && medium.includes("api_webhooks"));
    for (const list of [indep, small, medium]) assert.equal(list.at(-1), "go_live");
});

test("summary: skipped optional steps count as done, required ones block finishing", () => {
    const steps = stepsForPlan("INDEPENDANT");
    const none = summarizeProgress("INDEPENDANT", []);
    assert.equal(none.done, 0);
    assert.equal(none.nextStep, "profile");
    assert.equal(none.canFinish, false);

    const rows = steps
        .filter((s) => s.key !== "go_live")
        .map((s) => ({ key: s.key, status: (s.required ? "COMPLETED" : "SKIPPED") as "COMPLETED" | "SKIPPED" }));
    const almost = summarizeProgress("INDEPENDANT", rows);
    assert.equal(almost.canFinish, true);
    assert.equal(almost.nextStep, "go_live");
    assert.equal(almost.done, steps.length - 1);

    const skippedRequired = summarizeProgress("INDEPENDANT", [{ key: "phone_line", status: "SKIPPED" }]);
    assert.ok(skippedRequired.requiredRemaining.includes("phone_line"));
});

// ---------------- contact import ----------------

test("guessMapping recognises common French and English headers", () => {
    const m = guessMapping(["Prénom", "Nom", "Société", "Téléphone", "E-mail", "Poste", "Notes"]);
    assert.deepEqual(m, { Prénom: "firstName", Nom: "lastName", Société: "company", Téléphone: "phone", "E-mail": "email", Poste: "title", Notes: "ignore" });
});

test("analyzeRows keeps reachable, identifiable contacts and drops duplicates", () => {
    const mapping = { first: "firstName", last: "lastName", co: "company", tel: "phone", mail: "email" };
    const rows = [
        { first: "Ada", last: "L", co: "A", tel: "06 12 34 56 78", mail: "" },
        { first: "Ada", last: "L", co: "A", tel: "+33 6 12 34 56 78", mail: "" }, // duplicate phone
        { first: "", last: "", co: "B", tel: "", mail: "b@b.fr" },
        { first: "No", last: "Contact", co: "C", tel: "", mail: "" }, // unreachable
        { first: "", last: "", co: "", tel: "0700000000", mail: "" }, // no identity
    ];
    const r = analyzeRows(rows, mapping);
    assert.equal(r.rowCount, 5);
    assert.equal(r.validCount, 2);
    assert.equal(r.duplicateCount, 1);
    assert.equal(r.sample.length, 2);
});

// ---------------- adoption ----------------

const baseInput: AdoptionInput = {
    plan: "SMALL_BUSINESS",
    status: "TRIALING",
    isAdmin: true,
    trialDaysLeft: 10,
    usage: { seats: 1, contacts: 0, phoneLines: 0, workspaces: 1 },
    quotas: { seats: 3, contacts: 2000 },
    verifiedLines: 0,
    pendingInvites: 0,
    onboardingDone: false,
    skippedSteps: [],
    dismissed: [],
};

test("tips: most important first, dismissed ones hidden", () => {
    const tips = adoptionTips(baseInput);
    assert.equal(tips[0].id, "line-unverified");
    assert.ok(tips.some((t) => t.id === "no-contacts"));
    assert.ok(!tips.some((t) => t.id === "trial-ending"));
    const later = adoptionTips({ ...baseInput, trialDaysLeft: 2, dismissed: ["line-unverified"] });
    assert.ok(!later.some((t) => t.id === "line-unverified"));
    assert.ok(later.some((t) => t.id === "trial-ending"));
});

test("tips: non-admins don't get billing nudges", () => {
    const tips = adoptionTips({ ...baseInput, isAdmin: false, trialDaysLeft: 1 });
    assert.ok(!tips.some((t) => t.href?.startsWith("/espace/paiement")));
});

// ---------------- demo fiche ----------------

test("demo fiche extracts BANT signals from notes", () => {
    const fiche = buildDemoFiche({
        prospectCompany: "Acme",
        prospectName: "Claire",
        notes: "Claire est DG. Ils perdent du temps. Budget d'environ 5k€, décision avant la rentrée. Un peu cher selon elle.",
    });
    assert.deepEqual(fiche.bant, { budget: true, authority: true, need: true, timing: true });
    assert.ok(fiche.objections.some((o) => o.includes("prix")));
    const empty = buildDemoFiche({ prospectCompany: "Acme", prospectName: "Claire", notes: "" });
    assert.equal(empty.bant.budget, false);
    assert.equal(empty.objections.length, 1);
});
