import { queryOptions } from "@tanstack/react-query";
import { getActionBoard, getIssueActivity } from "./actions.functions";

export const actionBoardQueryOptions = (date: string) =>
  queryOptions({
    queryKey: ["action-board", date],
    queryFn: () => getActionBoard({ data: { date } }),
    staleTime: 30_000,
  });

export const issueActivityQueryOptions = (issueId: string) =>
  queryOptions({
    queryKey: ["issue-activity", issueId],
    queryFn: () => getIssueActivity({ data: { issueId } }),
    staleTime: 15_000,
  });
