import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../client";

async function clearDemo() {
  console.log("[ClearDemo] Clearing all demo meetings and associated demo records...");

  // Find all meetings marked as demo
  const demoMeetings = await prisma.meeting.findMany({
    where: {
      OR: [
        { metadata: { path: ["isDemo"], equals: true } },
        { metadata: { path: ["source"], equals: "v0-demo" } },
        { title: { contains: "[Demo]" } },
        { title: { in: [
          "Launch planning sync",
          "E-Commerce Replatforming Strategy Call",
          "Brand Identity & Design System Review",
          "Enterprise API Migration Check-in",
          "Acme Payments Q4 Discovery Call"
        ] } }
      ]
    },
    select: { id: true, title: true }
  });

  const ids = demoMeetings.map(m => m.id);

  if (ids.length === 0) {
    console.log("[ClearDemo] No demo meetings found in database.");
    await prisma.$disconnect();
    return;
  }

  console.log(`[ClearDemo] Found ${ids.length} demo meetings to clear:`);
  demoMeetings.forEach(m => console.log(`  - ${m.title} (${m.id})`));

  // 1. Delete associated DocumentChunks
  const deletedChunks = await prisma.documentChunk.deleteMany({
    where: { meetingId: { in: ids } }
  });

  // 2. Delete Meetings (cascades to segments, analysis, suggestions)
  const deletedMeetings = await prisma.meeting.deleteMany({
    where: { id: { in: ids } }
  });

  console.log(`[ClearDemo] Successfully removed ${deletedMeetings.count} demo meetings and ${deletedChunks.count} vector chunks.`);
  await prisma.$disconnect();
}

clearDemo().catch(err => {
  console.error("[ClearDemo] Error clearing demo data:", err);
  process.exit(1);
});
