import { describe, expect, it } from "vitest";
import { WorkflowError, allowedEvents, csvCell, nextState } from "@/lib/coach/workflow";

const am = { role: "am" as const, userId: "am-1" };
const lead = { role: "store_lead" as const, userId: "lead-1" };
const otherLead = { role: "store_lead" as const, userId: "lead-2" };

describe("issue action workflow", () => {
  it("a manager assigns an open issue; the assignee acknowledges, starts and finishes it", () => {
    const open = { state: "open" as const, assigneeUserId: null };
    expect(nextState(open, am, { event: "assign", hasAssignee: true })).toBe("assigned");
    const assigned = { state: "assigned" as const, assigneeUserId: "lead-1" };
    expect(nextState(assigned, lead, { event: "acknowledge" })).toBe("acknowledged");
    expect(nextState({ ...assigned, state: "acknowledged" }, lead, { event: "begin" })).toBe("in_progress");
    expect(nextState({ ...assigned, state: "in_progress" }, lead, { event: "done" })).toBe("done");
    expect(nextState({ ...assigned, state: "done" }, am, { event: "review" })).toBe("reviewed");
  });

  it("only the assignee can acknowledge, and a store lead can't assign", () => {
    const assigned = { state: "assigned" as const, assigneeUserId: "lead-1" };
    expect(() => nextState(assigned, otherLead, { event: "acknowledge" })).toThrow(WorkflowError);
    expect(() => nextState(assigned, am, { event: "acknowledge" })).toThrow(/assigned to/);
    expect(() => nextState({ state: "open", assigneeUserId: null }, lead, { event: "assign", hasAssignee: true })).toThrow(/manager/);
  });

  it("blocking and dismissing need a listed reason, and Other needs a note", () => {
    const active = { state: "in_progress" as const, assigneeUserId: "lead-1" };
    expect(() => nextState(active, lead, { event: "block" })).toThrow(/reason/);
    expect(() => nextState(active, lead, { event: "block", reason: "made up" })).toThrow(/reason/);
    expect(() => nextState(active, lead, { event: "block", reason: "Other" })).toThrow(/note/);
    expect(nextState(active, lead, { event: "block", reason: "Stock not available" })).toBe("blocked");
    expect(() => nextState(active, am, { event: "dismiss", reason: "" })).toThrow(/reason/);
    expect(nextState(active, am, { event: "dismiss", reason: "Already handled" })).toBe("dismissed");
  });

  it("reopen returns to assigned when someone was assigned, otherwise to open", () => {
    expect(nextState({ state: "dismissed", assigneeUserId: null }, am, { event: "reopen" })).toBe("open");
    expect(nextState({ state: "done", assigneeUserId: "lead-1" }, am, { event: "reopen" })).toBe("assigned");
    expect(() => nextState({ state: "open", assigneeUserId: null }, am, { event: "reopen" })).toThrow(WorkflowError);
  });

  it("salespeople get no buttons and a store lead can't mark an unassigned issue done", () => {
    expect(allowedEvents({ state: "assigned", assigneeUserId: "sp" }, { role: "salesperson", userId: "sp" })).toEqual([]);
    expect(allowedEvents({ state: "open", assigneeUserId: null }, lead)).toEqual([]);
    expect(allowedEvents({ state: "open", assigneeUserId: null }, am)).toEqual(["assign", "done", "dismiss"]);
  });

  it("CSV export neutralises spreadsheet formulas and escapes quotes", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("LKO-02")).toBe('"LKO-02"');
    expect(csvCell(null)).toBe('""');
  });
});
