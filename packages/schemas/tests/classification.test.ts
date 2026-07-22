import { describe, it, expect } from "vitest";
import { classificationToBadgeColor } from "../src/classification.js";
import { CLASSIFICATION_LABELS } from "../src/enums.js";

describe("classificationToBadgeColor (§9.2)", () => {
  it("maps every classification label per spec", () => {
    expect(classificationToBadgeColor("INDEPENDENT")).toBe("GREEN");
    expect(classificationToBadgeColor("CREATOR_OWNED")).toBe("GREEN");
    expect(classificationToBadgeColor("EXTERNALLY_FUNDED")).toBe("BLUE");
    expect(classificationToBadgeColor("CORPORATE_OWNED")).toBe("PURPLE");
    expect(classificationToBadgeColor("PE_BACKED")).toBe("ORANGE");
    expect(classificationToBadgeColor("DISPUTED")).toBe("RED");
    expect(classificationToBadgeColor("OWNERSHIP_CHANGED")).toBe("NEUTRAL");
    expect(classificationToBadgeColor("OWNERSHIP_UNCLEAR")).toBe("NEUTRAL");
  });

  it("PE_BACKED maps to ORANGE and NEVER to RED", () => {
    expect(classificationToBadgeColor("PE_BACKED")).toBe("ORANGE");
    expect(classificationToBadgeColor("PE_BACKED")).not.toBe("RED");
  });

  it("RED is reserved exclusively for DISPUTED", () => {
    const redLabels = CLASSIFICATION_LABELS.filter(
      (label) => classificationToBadgeColor(label) === "RED",
    );
    expect(redLabels).toEqual(["DISPUTED"]);
  });

  it("produces a valid color for every classification label", () => {
    for (const label of CLASSIFICATION_LABELS) {
      expect(classificationToBadgeColor(label)).toMatch(/^(NEUTRAL|GREEN|BLUE|PURPLE|ORANGE|RED)$/);
    }
  });
});
