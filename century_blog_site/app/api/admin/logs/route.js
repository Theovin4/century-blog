import { NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/editorial";
import { getActivityLogs } from "@/lib/activity-log-store";

export async function GET(request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "logs:view")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const logs = await getActivityLogs({
    query: searchParams.get("q") || "",
    action: searchParams.get("action") || "",
    userId: searchParams.get("userId") || ""
  });

  return NextResponse.json(logs.slice(0, 500));
}
