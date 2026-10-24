import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../client";
import { DocumentChunkRepository } from "../repositories/chunk.repository";
import { embeddingsClient } from "../../../ai/src/embeddings";
import { chunkText, chunkTranscriptSegments } from "../../../ai/src/chunker";

async function seed() {
  console.log("[Seed] Starting database seed with sample data...");

  // 1. Create or upsert demo user
  const email = "demo@syapa.local";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Demo Freelancer",
        email,
        passwordHash: "$2a$10$wT1mX7g2YvW5t4Qp0u8eEe8kG3G4K5L6M7N8O9P0Q1R2S3T4U5V6W", // dummy hash
      },
    });
    console.log(`[Seed] Created demo user: ${user.email} (${user.id})`);
  }

  // 2. Create sample project brief
  const briefContent = `PROJECT SPECIFICATION: Acme Payments Merchant Analytics Portal
Client: Acme Financial Services Inc.
Target Budget: $6,500 fixed milestone
Timeline: 4 weeks to staging deployment
Core Deliverables:
1. Merchant transactions dashboard (filtering by date, volume, payout status).
2. Dispute management workflow with PDF receipt export.
3. Dark and light mode interface complying with WCAG AA accessibility.
Explicit Non-Goals & Scope Limits:
- Native mobile applications (iOS/Android) are explicitly NOT included in this sprint.
- Third-party processor fees and SMS verification costs are billed directly to client account.
- Revisions are capped at two rounds per milestone deliverable. Further iterations require formal change orders.`;

  const existingBrief = await prisma.projectContext.findFirst({
    where: { userId: user.id, title: "Acme Payments Merchant Portal Brief" },
  });

  let brief = existingBrief;
  if (!brief) {
    brief = await prisma.projectContext.create({
      data: {
        userId: user.id,
        title: "Acme Payments Merchant Portal Brief",
        type: "BRIEF",
        content: briefContent,
        metadata: { client: "Acme Financial Services", budget: 6500 },
      },
    });

    const briefChunks = chunkText(briefContent, 350, 50);
    const briefEmbeddings = await embeddingsClient.embedBatch(briefChunks);

    for (let i = 0; i < briefChunks.length; i++) {
      await DocumentChunkRepository.storeChunk({
        userId: user.id,
        projectContextId: brief.id,
        contextType: "BRIEF",
        chunkIndex: i,
        content: briefChunks[i],
        metadata: { title: brief.title, type: "BRIEF" },
        embedding: briefEmbeddings[i],
      });
    }
    console.log(`[Seed] Seeded brief with ${briefChunks.length} vector chunks.`);
  }

  // 3. Create sample meeting with transcript segments and post-meeting analysis
  const existingMeeting = await prisma.meeting.findFirst({
    where: { userId: user.id, title: "Acme Payments Q4 Discovery Call" },
  });

  if (!existingMeeting) {
    const meeting = await prisma.meeting.create({
      data: {
        userId: user.id,
        title: "Acme Payments Q4 Discovery Call",
        status: "COMPLETED",
        durationSeconds: 980,
        summary: "Discovery discussion covering the Acme Merchant Analytics Portal. Client requested adding mobile app support and unlimited revisions; freelancer successfully anchored price at $6,500 and reinforced the two-round revision cap. Follow-up change order agreed for any future native mobile deliverables.",
        actionItems: [
          "Send formal statement of work confirming $6,500 milestone budget.",
          "Provide Figma wireframes for dispute resolution workflow by Tuesday.",
          "Prepare separate change order estimate for Phase 2 Flutter mobile apps.",
        ],
        requestedWork: [
          {
            task: "Deliver transaction filtering dashboard",
            quote: "We need the transactions dashboard with date and payout status filtering delivered in the first milestone.",
            speaker: "Others",
            isScopeCreep: false,
          },
          {
            task: "Build native mobile iOS/Android apps",
            quote: "Could we also get native iOS and Android apps included within this initial fee?",
            speaker: "Others",
            isScopeCreep: true,
          },
          {
            task: "PDF receipt export",
            quote: "Every transaction item must generate a downloadable PDF summary receipt.",
            speaker: "Others",
            isScopeCreep: false,
          },
        ],
        riskyCommitments: [
          {
            quote: "I might be able to squeeze in some mobile styling over the weekend if time permits.",
            speaker: "You",
            risk: "Leaves scope ambiguous and invites the client to expect mobile deliverables without payment.",
            recommendedReply: "Native mobile builds require a separate mobile architecture. I will draft a Phase 2 change order so we can tackle mobile properly after the web portal ships.",
          },
        ],
        droppedQuotesCount: 0,
      },
    });

    const segmentsData = [
      { speaker: "Others" as const, text: "Thanks for meeting. We need the transactions dashboard with date and payout status filtering delivered in the first milestone.", startTimeMs: 12000, endTimeMs: 18000 },
      { speaker: "You" as const, text: "Absolutely, that aligns with Section 1 of our brief. We can deliver that for $6,500 with staging deployment in four weeks.", startTimeMs: 20000, endTimeMs: 27000 },
      { speaker: "Others" as const, text: "Could we also get native iOS and Android apps included within this initial fee? Other agencies promised full cross-platform apps.", startTimeMs: 31000, endTimeMs: 40000 },
      { speaker: "You" as const, text: "Native mobile requires separate SDKs and ongoing maintenance. Our brief explicitly covers responsive web. Mobile is outside this sprint and requires a change order.", startTimeMs: 42000, endTimeMs: 53000 },
      { speaker: "Others" as const, text: "Every transaction item must generate a downloadable PDF summary receipt. That is critical for our dispute flow.", startTimeMs: 58000, endTimeMs: 66000 },
      { speaker: "You" as const, text: "Understood. PDF receipt generation is part of the dispute management deliverable. I might be able to squeeze in some mobile styling over the weekend if time permits.", startTimeMs: 69000, endTimeMs: 79000 },
    ];

    await prisma.transcriptSegment.createMany({
      data: segmentsData.map((s) => ({
        meetingId: meeting.id,
        speaker: s.speaker,
        text: s.text,
        startTimeMs: s.startTimeMs,
        endTimeMs: s.endTimeMs,
      })),
    });

    const chunks = chunkTranscriptSegments(segmentsData, 350, 50);
    const chunkEmbeddings = await embeddingsClient.embedBatch(chunks.map((c) => c.content));

    for (let i = 0; i < chunks.length; i++) {
      await DocumentChunkRepository.storeChunk({
        userId: user.id,
        meetingId: meeting.id,
        contextType: "MEETING_CHUNK",
        chunkIndex: i,
        content: chunks[i].content,
        metadata: chunks[i].metadata,
        embedding: chunkEmbeddings[i],
      });
    }

    console.log(`[Seed] Seeded sample meeting: ${meeting.title} with ${segmentsData.length} segments and ${chunks.length} chunks.`);
  }

  console.log("[Seed] Database seed completed successfully!");
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error("[Seed] Error during seeding:", err);
  process.exit(1);
});
