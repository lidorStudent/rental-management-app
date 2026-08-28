import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  createTenantAccountSchema,
  registerLandlordSchema,
  signInSchema,
} from "@/lib/validation/authenticationSchemas";

const VALID_REGISTRATION = {
  fullName: "Noa Ben-David",
  email: "noa.bendavid@example.co.il",
  password: "GoodPassword1",
  confirmPassword: "GoodPassword1",
};

function firstMessageFor(
  schema: { safeParse: (value: unknown) => unknown },
  input: unknown,
  field: string,
) {
  const result = schema.safeParse(input) as {
    success: boolean;
    error?: { issues: { path: (string | number)[]; message: string }[] };
  };
  return result.error?.issues.find((issue) => issue.path.join(".") === field)?.message;
}

describe("registerLandlordSchema", () => {
  it("accepts a landlord signing up", () => {
    expect(registerLandlordSchema.safeParse(VALID_REGISTRATION).success).toBe(true);
  });

  // INV-04: two spellings of one address would become two accounts for one person.
  it("trims and lowercases the email address", () => {
    const parsed = registerLandlordSchema.parse({
      ...VALID_REGISTRATION,
      email: "  Noa.BenDavid@Example.CO.IL ",
    });

    expect(parsed.email).toBe("noa.bendavid@example.co.il");
  });

  it("trims the name", () => {
    expect(
      registerLandlordSchema.parse({ ...VALID_REGISTRATION, fullName: "  Noa Ben-David " })
        .fullName,
    ).toBe("Noa Ben-David");
  });

  it("refuses a name of one character", () => {
    expect(
      firstMessageFor(registerLandlordSchema, { ...VALID_REGISTRATION, fullName: "A" }, "fullName"),
    ).toBe("Enter a full name.");
  });

  // INV-02
  it("refuses a name longer than the database column allows", () => {
    expect(
      registerLandlordSchema.safeParse({ ...VALID_REGISTRATION, fullName: "N".repeat(121) })
        .success,
    ).toBe(false);
  });

  it("refuses an address that is not an email address", () => {
    expect(
      firstMessageFor(
        registerLandlordSchema,
        { ...VALID_REGISTRATION, email: "not-an-address" },
        "email",
      ),
    ).toBe("Enter a valid email address.");
  });

  it("refuses a password shorter than ten characters", () => {
    expect(
      firstMessageFor(
        registerLandlordSchema,
        { ...VALID_REGISTRATION, password: "Short1" },
        "password",
      ),
    ).toBe("Use at least 10 characters.");
  });

  // INV-06: the same rules the Auth service applies, refused here with a better message.
  it("refuses a password with no uppercase letter", () => {
    expect(
      firstMessageFor(
        registerLandlordSchema,
        { ...VALID_REGISTRATION, password: "alllowercase123" },
        "password",
      ),
    ).toBe("Include at least one uppercase letter.");
  });

  it("refuses a password with no lowercase letter", () => {
    expect(
      firstMessageFor(
        registerLandlordSchema,
        { ...VALID_REGISTRATION, password: "ALLUPPERCASE123" },
        "password",
      ),
    ).toBe("Include at least one lowercase letter.");
  });

  it("refuses a password with no digit", () => {
    expect(
      firstMessageFor(
        registerLandlordSchema,
        { ...VALID_REGISTRATION, password: "NoDigitsAtAll" },
        "password",
      ),
    ).toBe("Include at least one digit.");
  });

  it("refuses two passwords that do not match", () => {
    expect(
      firstMessageFor(
        registerLandlordSchema,
        { ...VALID_REGISTRATION, confirmPassword: "SomethingElse1" },
        "confirmPassword",
      ),
    ).toBe("The two passwords do not match.");
  });
});

describe("signInSchema", () => {
  it("accepts an address and a password", () => {
    expect(
      signInSchema.safeParse({ email: "maya.levi@example.co.il", password: "anything" }).success,
    ).toBe(true);
  });

  it("refuses an empty password without saying anything about the address", () => {
    expect(
      firstMessageFor(signInSchema, { email: "maya.levi@example.co.il", password: "" }, "password"),
    ).toBe("Enter your password.");
  });
});

describe("changePasswordSchema", () => {
  /**
   * Each of these supplies a valid current password, so that the rule the test is named after is the
   * only thing that can fail it. Without that they would pass on the missing field instead, which is
   * how two of them behaved for a moment when the field was first added.
   */
  const currentPassword = "WhatIHadBefore1";

  it("accepts a new password typed twice, with the current one", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword,
        newPassword: "ChosenByMe1",
        confirmPassword: "ChosenByMe1",
      }).success,
    ).toBe(true);
  });

  it("refuses a new password that does not meet the policy", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword,
        newPassword: "weak",
        confirmPassword: "weak",
      }).success,
    ).toBe(false);
  });

  it("refuses two passwords that do not match", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword,
        newPassword: "ChosenByMe1",
        confirmPassword: "ChosenByYou1",
      }).success,
    ).toBe(false);
  });

  it("refuses a change with no current password at all", () => {
    expect(
      changePasswordSchema.safeParse({
        newPassword: "ChosenByMe1",
        confirmPassword: "ChosenByMe1",
      }).success,
    ).toBe(false);
  });

  it("refuses an empty current password", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "",
        newPassword: "ChosenByMe1",
        confirmPassword: "ChosenByMe1",
      }).success,
    ).toBe(false);
  });

  /**
   * The current password is only checked for being present. A temporary password issued by a
   * landlord, or one chosen before the strength rules tightened, has to be typeable here or its
   * owner could never replace it. Whether it is right is the server's question, not the schema's.
   */
  it("accepts a current password that would fail today's strength rules", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old",
        newPassword: "ChosenByMe1",
        confirmPassword: "ChosenByMe1",
      }).success,
    ).toBe(true);
  });
});

describe("createTenantAccountSchema", () => {
  const VALID_TENANT = {
    leaseId: "3f6d8f7a-1b2c-4d3e-8f90-1a2b3c4d5e6f",
    tenantFullName: "Maya Levi",
    tenantEmail: "maya.levi@example.co.il",
  };

  it("accepts a tenant being onboarded", () => {
    expect(createTenantAccountSchema.safeParse(VALID_TENANT).success).toBe(true);
  });

  it("normalises the tenant's email the same way registration does", () => {
    expect(
      createTenantAccountSchema.parse({ ...VALID_TENANT, tenantEmail: " MAYA.LEVI@Example.co.il " })
        .tenantEmail,
    ).toBe("maya.levi@example.co.il");
  });

  it("refuses a lease that is not an identifier at all", () => {
    expect(
      createTenantAccountSchema.safeParse({ ...VALID_TENANT, leaseId: "the-first-one" }).success,
    ).toBe(false);
  });

  it("refuses a tenant name of one character", () => {
    expect(
      createTenantAccountSchema.safeParse({ ...VALID_TENANT, tenantFullName: "A" }).success,
    ).toBe(false);
  });
});
