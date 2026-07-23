import { afterEach, describe, expect, it } from "vitest";
import { CHAIN_COPY, type OwnershipChainStep } from "@channelwatch/schemas";
import { OwnershipChain } from "../../src/components/OwnershipChain.js";
import { render, type Rendered } from "../render.js";

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

const STEPS: OwnershipChainStep[] = [
  {
    name: "Moonbug Entertainment",
    type: "COMPANY",
    relationship: "OWNS",
    ownership_percentage: null,
    control_level: "CONTROLLING",
    effective_from: null,
  },
  {
    name: "Candle Media",
    type: "COMPANY",
    relationship: "OWNS",
    ownership_percentage: 75,
    control_level: "CONTROLLING",
    effective_from: "2021-11-04",
  },
  {
    name: "Blackstone Inc.",
    type: "PRIVATE_EQUITY_FIRM",
    relationship: "PORTFOLIO_COMPANY_OF",
    ownership_percentage: null,
    control_level: "UNKNOWN",
    effective_from: null,
  },
];

describe("OwnershipChain", () => {
  it("renders the heading, full names, mechanisms, stakes, and dates", () => {
    view = render(<OwnershipChain steps={STEPS} />);
    const text = view.container.textContent ?? "";
    expect(text).toContain(CHAIN_COPY.heading);
    expect(text).toContain("Moonbug Entertainment");
    expect(text).toContain("Blackstone Inc.");
    expect(text).toContain("controlling stake");
    expect(text).toContain("portfolio company of");
    expect(text).toContain("75% stake");
    expect(text).toContain("stake not publicly disclosed");
    expect(text).toContain("2021-11-04");
    expect(view.container.querySelectorAll("ol.cw-chain__list > li")).toHaveLength(3);
  });

  it("renders nothing when there are no steps", () => {
    view = render(<OwnershipChain steps={[]} />);
    expect(view.container.querySelector("ol.cw-chain__list")).toBeNull();
  });
});
