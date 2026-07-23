import { afterEach, describe, expect, it, vi } from "vitest";
import { REVIEW_CONSOLE_COPY as C } from "@channelwatch/schemas";
import { LoginForm } from "../../src/components/review/LoginForm.js";
import { EntityForm } from "../../src/components/review/EntityForm.js";
import { ReasoningDialog } from "../../src/components/review/ReasoningDialog.js";
import { render, type Rendered } from "../render.js";
import { click, submit, type } from "../interact.js";

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

describe("LoginForm", () => {
  it("submits the entered email and password", () => {
    const onSubmit = vi.fn();
    view = render(<LoginForm onSubmit={onSubmit} />);
    type(view.container.querySelector(".cw-login-email")!, "reviewer@example.com");
    type(view.container.querySelector(".cw-login-password")!, "hunter2hunter2");
    submit(view.container.querySelector(".cw-login")!);
    expect(onSubmit).toHaveBeenCalledWith("reviewer@example.com", "hunter2hunter2");
  });

  it("shows the reviewed error message when error is set", () => {
    view = render(<LoginForm error onSubmit={vi.fn()} />);
    expect(view.container.querySelector(".cw-error")?.textContent).toBe(C.loginError);
  });
});

describe("ReasoningDialog", () => {
  it("blocks confirm until reasoning is long enough, then passes the trimmed text", () => {
    const onConfirm = vi.fn();
    view = render(<ReasoningDialog heading="Approve" onConfirm={onConfirm} onCancel={vi.fn()} />);

    // Too short → confirm is blocked and the reviewed error appears.
    type(view.container.querySelector(".cw-reasoning")!, "short");
    click(view.container.querySelector(".cw-confirm")!);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(view.container.querySelector(".cw-error")?.textContent).toBe(C.reasoningTooShort);

    // Long enough → confirm fires with the trimmed reasoning.
    type(view.container.querySelector(".cw-reasoning")!, "  Tier-1 filing confirms it.  ");
    click(view.container.querySelector(".cw-confirm")!);
    expect(onConfirm).toHaveBeenCalledWith("Tier-1 filing confirms it.");
  });

  it("cancels without confirming", () => {
    const onCancel = vi.fn();
    view = render(<ReasoningDialog heading="Reject" onConfirm={vi.fn()} onCancel={onCancel} />);
    click(view.container.querySelector(".cw-cancel")!);
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("EntityForm", () => {
  it("builds a create body from the fields", () => {
    const onSubmit = vi.fn();
    view = render(<EntityForm onSubmit={onSubmit} />);
    type(view.container.querySelector(".cw-entity-name")!, "Acme Media");
    submit(view.container.querySelector(".cw-entity-form")!);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: "COMPANY", canonical_name: "Acme Media" }),
    );
  });

  it("prefills from an existing entity when editing", () => {
    view = render(
      <EntityForm
        initial={{
          id: "e1",
          entity_type: "PRIVATE_EQUITY_FIRM",
          canonical_name: "Blackstone Inc.",
          legal_name: null,
          jurisdiction: null,
          registry_identifier: null,
          website: null,
          description: null,
        }}
        onSubmit={vi.fn()}
      />,
    );
    const name = view.container.querySelector(".cw-entity-name") as HTMLInputElement;
    expect(name.value).toBe("Blackstone Inc.");
    expect(view.container.querySelector("h3")?.textContent).toBe(C.entityEditHeading);
  });
});
