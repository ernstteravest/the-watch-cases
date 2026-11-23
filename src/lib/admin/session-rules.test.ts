import { describe, expect, it } from "vitest";
import {
  beheerCsp,
  isBeheerPath,
  isPreMfaPath,
  isPublicBeheerPath,
  passwordSignInTime,
  safeNextPath,
  sessionExpiry,
} from "./session-rules";

describe("isBeheerPath", () => {
  it("matches /beheer and below only", () => {
    expect(isBeheerPath("/beheer")).toBe(true);
    expect(isBeheerPath("/beheer/inloggen")).toBe(true);
    expect(isBeheerPath("/beheerder")).toBe(false);
    expect(isBeheerPath("/en/beheer")).toBe(false);
    expect(isBeheerPath("/")).toBe(false);
  });
});

describe("public and pre-MFA pages", () => {
  it("only the sign-in pages are public", () => {
    expect(isPublicBeheerPath("/beheer/inloggen")).toBe(true);
    expect(isPublicBeheerPath("/beheer/wachtwoord-vergeten")).toBe(true);
    expect(isPublicBeheerPath("/beheer/auth/bevestigen")).toBe(true);
    expect(isPublicBeheerPath("/beheer")).toBe(false);
    expect(isPublicBeheerPath("/beheer/wachtwoord-instellen")).toBe(false);
    expect(isPublicBeheerPath("/beheer/inloggen/x")).toBe(false);
  });
  it("before MFA only the code page and choosing a password", () => {
    expect(isPreMfaPath("/beheer/tweestaps")).toBe(true);
    expect(isPreMfaPath("/beheer/wachtwoord-instellen")).toBe(true);
    expect(isPreMfaPath("/beheer")).toBe(false);
    expect(isPreMfaPath("/beheer/geen-toegang")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps paths inside /beheer", () => {
    expect(safeNextPath("/beheer/bestellingen?status=paid")).toBe("/beheer/bestellingen?status=paid");
  });
  it("refuses anything that could leave the site or loop", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/beheer//evil.example",
      "/beheer\\@evil.example",
      "/collectie",
      "/beheer/inloggen",
      "/beheer/x\nSet-Cookie:",
      null,
      42,
    ]) {
      expect(safeNextPath(bad)).toBe("/beheer");
    }
  });
});

describe("session expiry", () => {
  const now = Date.UTC(2026, 10, 23, 12, 0, 0);
  const sec = (ms: number) => Math.floor(ms / 1000);

  it("uses the latest password sign-in from amr", () => {
    expect(
      passwordSignInTime({ amr: [{ method: "password", timestamp: 100 }, { method: "totp", timestamp: 200 }], iat: 300 }),
    ).toBe(100);
    expect(passwordSignInTime({ amr: ["password"], iat: 300 })).toBe(300);
    expect(passwordSignInTime({})).toBeNull();
  });

  it("allows an active, recent session", () => {
    const claims = { amr: [{ method: "password", timestamp: sec(now - 3600_000) }] };
    expect(sessionExpiry(claims, now - 60_000, now)).toBeNull();
    expect(sessionExpiry(claims, null, now)).toBeNull();
  });

  it("ends a session idle for more than 30 minutes", () => {
    const claims = { amr: [{ method: "password", timestamp: sec(now - 3600_000) }] };
    expect(sessionExpiry(claims, now - 31 * 60_000, now)).toBe("idle");
  });

  it("ends a session older than 12 hours, however active", () => {
    const claims = { amr: [{ method: "password", timestamp: sec(now - 13 * 3600_000) }] };
    expect(sessionExpiry(claims, now - 1000, now)).toBe("max");
  });
});

describe("beheerCsp", () => {
  it("only allows scripts with the nonce, and Supabase for data", () => {
    const csp = beheerCsp("abc", "https://xyz.supabase.co/", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("connect-src 'self' https://xyz.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
  it("allows eval only in development", () => {
    expect(beheerCsp("abc", undefined, true)).toContain("'unsafe-eval'");
  });
});
