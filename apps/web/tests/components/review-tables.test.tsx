import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REVIEW_CONSOLE_COPY as C,
  type AuditEventItem,
  type ClaimQueueItem,
  type CorrectionInboxItem,
} from "@channelwatch/schemas";
import { ClaimQueue } from "../../src/components/review/ClaimQueue.js";
import { CorrectionInbox } from "../../src/components/review/CorrectionInbox.js";
import { AuditTable } from "../../src/components/review/AuditTable.js";
import { ReviewNav } from "../../src/components/review/ReviewNav.js";
import { render, type Rendered } from "../render.js";
import { click } from "../interact.js";

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

function claim(overrides: Partial<ClaimQueueItem> = {}): ClaimQueueItem {
  return {
    id: "c1",
    subject_type: "CHANNEL",
    subject_id: "s1",
    subject_name: "Example Channel",
    predicate: "OWNED_BY",
    object_type: "ENTITY",
    object_id: "o1",
    object_name: "Example Media",
    confidence: 0.9,
    confidence_label: "CONFIRMED",
    claim_status: "DRAFT",
    effective_date: null,
    review_notes: null,
    sensitive: false,
    distinct_approvers: 0,
    can_publish: false,
    reviews: [],
    ...overrides,
  };
}

describe("ClaimQueue", () => {
  it("surfaces the §20.3 two-person flag for a sensitive claim", () => {
    view = render(
      <ClaimQueue
        claims={[claim({ id: "sens", sensitive: true, distinct_approvers: 1 })]}
        statusFilter=""
        onStatusChange={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(view.container.querySelector(".cw-sensitive-flag")?.textContent).toBe(C.sensitiveFlag);
    // A sensitive claim with one approval is shown as awaiting a second reviewer.
    expect(view.container.querySelector(".cw-awaiting")?.textContent).toBe(
      C.awaitingSecondReviewer,
    );
    expect(view.container.querySelector(".cw-claim-row")?.getAttribute("data-sensitive")).toBe(
      "true",
    );
  });

  it("does not flag a non-sensitive claim", () => {
    view = render(
      <ClaimQueue
        claims={[claim()]}
        statusFilter=""
        onStatusChange={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(view.container.querySelector(".cw-sensitive-flag")).toBeNull();
  });

  it("raises approve/reject with the chosen claim", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    view = render(
      <ClaimQueue
        claims={[claim({ id: "cX" })]}
        statusFilter=""
        onStatusChange={vi.fn()}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );
    click(view.container.querySelector(".cw-approve")!);
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ id: "cX" }));
    click(view.container.querySelector(".cw-reject")!);
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ id: "cX" }));
  });

  it("shows the reviewed empty message when there are no claims", () => {
    view = render(
      <ClaimQueue
        claims={[]}
        statusFilter=""
        onStatusChange={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(view.container.querySelector(".cw-empty")?.textContent).toBe(C.queueEmpty);
  });
});

describe("CorrectionInbox", () => {
  const item: CorrectionInboxItem = {
    id: "corr1",
    channel_id: null,
    claim_id: null,
    submitter_name: null,
    submitter_email: null,
    submitter_relationship: "VIEWER",
    explanation: "Please update the source.",
    status: "SUBMITTED",
    submitted_at: "2026-07-23T00:00:00Z",
    resolved_at: null,
    resolution: null,
  };

  it("raises resolve/dismiss for an open correction", () => {
    const onResolve = vi.fn();
    const onDismiss = vi.fn();
    view = render(
      <CorrectionInbox corrections={[item]} onResolve={onResolve} onDismiss={onDismiss} />,
    );
    click(view.container.querySelector(".cw-correction-resolve")!);
    expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ id: "corr1" }));
    click(view.container.querySelector(".cw-correction-dismiss")!);
    expect(onDismiss).toHaveBeenCalledWith(expect.objectContaining({ id: "corr1" }));
  });

  it("hides actions for a closed correction", () => {
    view = render(
      <CorrectionInbox
        corrections={[{ ...item, status: "RESOLVED" }]}
        onResolve={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(view.container.querySelector(".cw-correction-resolve")).toBeNull();
  });
});

describe("AuditTable", () => {
  const events: AuditEventItem[] = [
    {
      id: "a1",
      actor_id: "r1",
      action: "APPROVE_CLAIM",
      object_type: "claim",
      object_id: "c1",
      before_state: null,
      after_state: null,
      created_at: "2026-07-23T00:00:00Z",
    },
  ];

  it("renders events and disables Previous on the first page", () => {
    view = render(
      <AuditTable
        events={events}
        subjectFilter=""
        onSubjectFilterChange={vi.fn()}
        onApplyFilter={vi.fn()}
        canPrev={false}
        canNext
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(view.container.querySelector(".cw-audit-action")?.textContent).toBe("APPROVE_CLAIM");
    expect((view.container.querySelector(".cw-prev") as HTMLButtonElement).disabled).toBe(true);
    expect((view.container.querySelector(".cw-next") as HTMLButtonElement).disabled).toBe(false);
  });

  it("fires next-page navigation", () => {
    const onNext = vi.fn();
    view = render(
      <AuditTable
        events={events}
        subjectFilter=""
        onSubjectFilterChange={vi.fn()}
        onApplyFilter={vi.fn()}
        canPrev
        canNext
        onPrev={vi.fn()}
        onNext={onNext}
      />,
    );
    click(view.container.querySelector(".cw-next")!);
    expect(onNext).toHaveBeenCalled();
  });
});

describe("ReviewNav", () => {
  it("renders the four sections and fires sign-out", () => {
    const onSignOut = vi.fn();
    view = render(<ReviewNav active="queue" signedInAs="me@example.com" onSignOut={onSignOut} />);
    const links = [...view.container.querySelectorAll("nav a")].map((a) => a.textContent);
    expect(links).toEqual([C.navQueue, C.navEntities, C.navCorrections, C.navAudit]);
    // The active link is marked.
    expect(view.container.querySelector('a[aria-current="page"]')?.textContent).toBe(C.navQueue);
    click(view.container.querySelector(".cw-signout")!);
    expect(onSignOut).toHaveBeenCalled();
  });
});
