import type { Notification } from "@/types";

function hoursAgo(h: number) {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
}

export const mockNotifications: Notification[] = [
  {
    id: "n1",
    userId: "c1",
    title: "Issue Submitted",
    message: "Your report 'Garbage Accumulation Near FC Road' has been sent to the Sanitation department of Pune.",
    type: "info",
    read: false,
    issueId: "ISS-001",
    createdAt: hoursAgo(2),
  },
  {
    id: "n2",
    userId: "c2",
    title: "Status Updated",
    message: "Your report 'Large Pothole on MG Road' is now marked as Ongoing.",
    type: "success",
    read: false,
    issueId: "ISS-002",
    createdAt: hoursAgo(5),
  },
  {
    id: "n3",
    userId: "c1",
    title: "Issue Resolved",
    message: "Water Pipe Burst Near Market has been resolved. A proof image has been uploaded.",
    type: "success",
    read: true,
    issueId: "ISS-003",
    createdAt: hoursAgo(48),
  },
  {
    id: "n4",
    userId: "c2",
    title: "Issue Escalated",
    message: "Non-functional Street Lights in Kothrud has been escalated to the Municipal Corporation after 7 days without resolution.",
    type: "warning",
    read: false,
    issueId: "ISS-004",
    createdAt: hoursAgo(12),
  },
  // Department notifications
  {
    id: "n5",
    userId: "d1",
    title: "New Issue Assigned",
    message: "A new garbage issue has been reported at FC Road, Deccan. 5 citizens have reported this.",
    type: "info",
    read: false,
    issueId: "ISS-001",
    createdAt: hoursAgo(2),
  },
  // Municipal notifications
  {
    id: "n6",
    userId: "m1",
    title: "Escalation Alert",
    message: "Non-functional Street Lights in Kothrud has been escalated. The Electrical department has not responded for 7 days.",
    type: "error",
    read: false,
    issueId: "ISS-004",
    createdAt: hoursAgo(12),
  },
];
