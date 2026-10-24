import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../client";
import { DocumentChunkRepository } from "../repositories/chunk.repository";
import { embeddingsClient } from "../../../ai/src/embeddings";
import { chunkTranscriptSegments, chunkText } from "../../../ai/src/chunker";

interface DemoMeetingDef {
  title: string;
  durationSeconds: number;
  summary: string;
  actionItems: string[];
  requestedWork: Array<{
    task: string;
    quote: string;
    speaker: "You" | "Others";
    isScopeCreep: boolean;
  }>;
  riskyCommitments: Array<{
    quote: string;
    speaker: "You" | "Others";
    risk: string;
    recommendedReply: string;
  }>;
  suggestions: Array<{
    title: string;
    description: string;
    category: "SCOPE_BOUNDARY" | "PRICE_ANCHOR" | "PROCESS_AGREEMENT" | "FOLLOW_UP";
    exactQuote: string;
    recommendedAction: string;
    priority: number;
  }>;
  patterns: Array<{
    pattern: string;
    risk: string;
    advice: string;
  }>;
  segments: Array<{
    speaker: "You" | "Others";
    text: string;
    startTimeMs: number;
    endTimeMs: number;
  }>;
}

const DEMO_MEETINGS: DemoMeetingDef[] = [
  {
    title: "Launch planning sync",
    durationSeconds: 522,
    summary: "The team aligned on the launch timeline and milestone ownership. The client requested bundling HubSpot workflows and automated SMS drip campaigns into the sprint; the freelancer informally promised weekend work without compensation before re-establishing milestone review boundaries.",
    actionItems: [
      "Share updated launch brief with the team by end of day.",
      "Confirm final milestone review owners by Friday 5 PM.",
      "Send formal change order estimate for Phase 2 HubSpot and SMS integrations.",
    ],
    requestedWork: [
      {
        task: "Deliver core analytics dashboard for Friday staging",
        quote: "The timeline looks good from our side, especially the first milestone.",
        speaker: "Others",
        isScopeCreep: false,
      },
      {
        task: "Bundle HubSpot automation and SMS drip campaigns into current sprint",
        quote: "our marketing lead asked if we can also bundle custom HubSpot workflows and automated SMS drip campaigns into this sprint without delaying Friday's staging release",
        speaker: "Others",
        isScopeCreep: true,
      },
      {
        task: "Integrate basic webhook for Monday demo",
        quote: "Can you just hook it up quickly? We already announced the SMS feature to our executive board.",
        speaker: "Others",
        isScopeCreep: true,
      },
    ],
    riskyCommitments: [
      {
        quote: "I'll see what I can do over the weekend and try to sneak a basic webhook in without charging extra.",
        speaker: "You",
        risk: "Uncompensated weekend work, sets precedent that executive pressure yields free scope, increases technical debt without formal SLA.",
        recommendedReply: "HubSpot and SMS workflows require dedicated integration testing. I will draft a Phase 2 change order with a 3-day estimate so we can implement it cleanly after staging ships.",
      },
    ],
    suggestions: [
      {
        title: "Defend Staging Deadline Against Mid-Sprint Feature Creep",
        description: "The client attempted to slip in HubSpot and SMS automation right before staging release. Counter with a dedicated Phase 2 addendum.",
        category: "SCOPE_BOUNDARY",
        exactQuote: "our marketing lead asked if we can also bundle custom HubSpot workflows and automated SMS drip campaigns into this sprint without delaying Friday's staging release",
        recommendedAction: "Send an email confirming staging scope is locked, and attach a 1-page SOW addendum for HubSpot + SMS.",
        priority: 1,
      },
      {
        title: "Retract Unbilled Weekend Commitment Before Monday",
        description: "You offered to sneak in webhook work over the weekend for free. Clarify the boundary in writing immediately.",
        category: "PRICE_ANCHOR",
        exactQuote: "I'll see what I can do over the weekend and try to sneak a basic webhook in without charging extra.",
        recommendedAction: "Write to the client stating that upon architectural review, the webhook requires proper schema migrations and cannot be done ad-hoc.",
        priority: 2,
      },
      {
        title: "Lock Review Owners in Writing by Friday",
        description: "Ensure sign-off criteria are unambiguous so the milestone payment is triggered upon staging release.",
        category: "PROCESS_AGREEMENT",
        exactQuote: "confirm final review owners by Friday",
        recommendedAction: "Identify the single designated decision-maker who holds final milestone approval authority.",
        priority: 3,
      },
    ],
    patterns: [
      {
        pattern: "Last-minute sprint inflation disguised as executive urgency",
        risk: "Client leverages internal commitments to extract unbilled weekend overtime.",
        advice: "Never absorb client internal board promises into fixed-fee sprints without formal change orders.",
      },
    ],
    segments: [
      {
        speaker: "You",
        text: "Thanks for making time today. I wanted to walk through the launch plan and make sure we are aligned on milestone one.",
        startTimeMs: 4000,
        endTimeMs: 11000,
      },
      {
        speaker: "Others",
        text: "Of course. The timeline looks good from our side, especially the first milestone. But our marketing lead asked if we can also bundle custom HubSpot workflows and automated SMS drip campaigns into this sprint without delaying Friday's staging release.",
        startTimeMs: 12500,
        endTimeMs: 27000,
      },
      {
        speaker: "You",
        text: "HubSpot automation and SMS webhooks require third-party API keys and a separate database queue. That's outside our initial scope brief, which focuses on the core dashboard.",
        startTimeMs: 28500,
        endTimeMs: 39000,
      },
      {
        speaker: "Others",
        text: "Can you just hook it up quickly? We already announced the SMS feature to our executive board.",
        startTimeMs: 41000,
        endTimeMs: 48000,
      },
      {
        speaker: "You",
        text: "I'll see what I can do over the weekend and try to sneak a basic webhook in without charging extra.",
        startTimeMs: 50000,
        endTimeMs: 59000,
      },
      {
        speaker: "Others",
        text: "Awesome, appreciate the flexibility! Let's make sure that's ready for the Monday demo.",
        startTimeMs: 61000,
        endTimeMs: 67000,
      },
      {
        speaker: "You",
        text: "Understood. I will share the updated launch brief after this call, but let's confirm final review owners by Friday.",
        startTimeMs: 69000,
        endTimeMs: 78000,
      },
    ],
  },
  {
    title: "E-Commerce Replatforming Strategy Call",
    durationSeconds: 640,
    summary: "Architecture and milestone review for Shopify Plus migration. Client requested writing custom ETL scripts for 50,000 legacy records with unvalidated schema. Freelancer offered free data migration as a courtesy to unblock launch.",
    actionItems: [
      "Send Shopify Plus architecture sign-off document.",
      "Define schema mapping requirements for legacy customer order records.",
      "Issue formal change order for database migration and historical data reconciliation.",
    ],
    requestedWork: [
      {
        task: "Shopify Plus checkout styling and product sync",
        quote: "The product sync and checkout styling are spot on.",
        speaker: "Others",
        isScopeCreep: false,
      },
      {
        task: "Write custom ETL script and migrate 50,000 legacy customer records and historical passwords",
        quote: "We need you to write a custom ETL script and migrate all historical passwords and order histories into the new schema.",
        speaker: "Others",
        isScopeCreep: true,
      },
    ],
    riskyCommitments: [
      {
        quote: "I don't want to block you, so I'll throw in the data migration script and schema cleanup for free as a courtesy.",
        speaker: "You",
        risk: "Exposes freelancer to severe liability for legacy data loss/corruption and absorbs days of unbilled debugging.",
        recommendedReply: "Legacy migration involves sensitive customer PII and complex reconciliation. I recommend treating this as an independent data migration addendum at our standard day rate.",
      },
    ],
    suggestions: [
      {
        title: "Separate Data Migration Liability from Web Storefront SOW",
        description: "Historical data cleanup carries massive hidden complexity and customer password hash security risks.",
        category: "SCOPE_BOUNDARY",
        exactQuote: "We need you to write a custom ETL script and migrate all historical passwords and order histories into the new schema.",
        recommendedAction: "Send a revised data ingestion terms clause limiting liability for legacy corrupted data.",
        priority: 1,
      },
      {
        title: "Rescind Free Data Cleanup Courtesy",
        description: "Migrating 50,000 records is not a minor courtesy; it requires dedicated validation and backup verification.",
        category: "PRICE_ANCHOR",
        exactQuote: "I don't want to block you, so I'll throw in the data migration script and schema cleanup for free as a courtesy.",
        recommendedAction: "Quote a fixed fee of $2,400 or time-and-materials rate for historical data script writing.",
        priority: 2,
      },
    ],
    patterns: [
      {
        pattern: "Conflating UI/frontend contracts with deep backend data migration",
        risk: "Client assumes storefront replatforming inherently includes legacy database cleanup.",
        advice: "Always explicitly list database migration as an excluded non-goal in initial proposals.",
      },
    ],
    segments: [
      {
        speaker: "Others",
        text: "We reviewed the Shopify Plus architecture diagram. The product sync and checkout styling are spot on.",
        startTimeMs: 5000,
        endTimeMs: 13000,
      },
      {
        speaker: "You",
        text: "Glad to hear. We have milestone two scheduled for completion next Thursday.",
        startTimeMs: 14500,
        endTimeMs: 20000,
      },
      {
        speaker: "Others",
        text: "One critical thing came up: our legacy database has fifty thousand customer records with messy custom metadata. We need you to write a custom ETL script and migrate all historical passwords and order histories into the new schema.",
        startTimeMs: 22000,
        endTimeMs: 38000,
      },
      {
        speaker: "You",
        text: "Migrating legacy credentials and cleaning unvalidated metadata wasn't in the SOW. That's typically a separate data engineering sprint.",
        startTimeMs: 40000,
        endTimeMs: 50000,
      },
      {
        speaker: "Others",
        text: "If you can't do it, the entire launch is stalled. Other contractors said it's just a simple SQL export.",
        startTimeMs: 52000,
        endTimeMs: 59000,
      },
      {
        speaker: "You",
        text: "I don't want to block you, so I'll throw in the data migration script and schema cleanup for free as a courtesy.",
        startTimeMs: 61000,
        endTimeMs: 71000,
      },
      {
        speaker: "Others",
        text: "Great, we expect zero data loss and automated reconciliation reports by Wednesday morning.",
        startTimeMs: 73000,
        endTimeMs: 81000,
      },
      {
        speaker: "You",
        text: "I'll do my best to get that reconciled alongside the product catalog.",
        startTimeMs: 83000,
        endTimeMs: 89000,
      },
    ],
  },
  {
    title: "Brand Identity & Design System Review",
    durationSeconds: 480,
    summary: "Review of design token hierarchy and web UI library. Client requested thirty print and social media banner formats beyond agreed scope; freelancer conceded five extra marketing collateral designs without charge.",
    actionItems: [
      "Deliver Figma web UI tokens and component specifications.",
      "Provide formal scope notice clarifying web vs print deliverables.",
      "Send catalog pricing for social media and marketing campaign asset bundles.",
    ],
    requestedWork: [
      {
        task: "Deliver design system tokens and component hierarchy",
        quote: "The components look sharp",
        speaker: "Others",
        isScopeCreep: false,
      },
      {
        task: "Produce thirty additional social media formats, print brochures, and animated ads",
        quote: "the marketing committee wants thirty additional social media banner formats, print-ready vector brochures, and animated banner ads for LinkedIn.",
        speaker: "Others",
        isScopeCreep: true,
      },
    ],
    riskyCommitments: [
      {
        quote: "I can probably whip up five or six extra LinkedIn banners and print exports tonight without billing you.",
        speaker: "You",
        risk: "Weakens contract boundary, trains client that withholding milestone approval forces free marketing collateral.",
        recommendedReply: "Our contract covers digital design tokens and core UI. I can provide a collateral package menu with fixed pricing per asset set.",
      },
    ],
    suggestions: [
      {
        title: "Re-anchor Deliverables on Core UI Kit SOW",
        description: "Hold firm on the two revision rounds specified in the contract and protect against unlimited revision creep.",
        category: "SCOPE_BOUNDARY",
        exactQuote: "the marketing committee wants thirty additional social media banner formats, print-ready vector brochures, and animated banner ads for LinkedIn.",
        recommendedAction: "Send a polite email reminding client that collateral design is outside the software design system scope.",
        priority: 1,
      },
      {
        title: "Enforce Revision Cap Before Releasing Exports",
        description: "Specify that the five promotional banners fulfill all remaining design revisions for this sprint.",
        category: "PROCESS_AGREEMENT",
        exactQuote: "stick to the two revision rounds agreed in the master contract.",
        recommendedAction: "Attach sign-off form to the banner delivery email requiring client sign-off.",
        priority: 2,
      },
    ],
    patterns: [
      {
        pattern: "Committee scope creep post-milestone submission",
        risk: "Secondary internal stakeholders add unbilled requirements before approving milestone invoices.",
        advice: "Establish a single primary reviewer in contract who alone has authority to approve deliverables.",
      },
    ],
    segments: [
      {
        speaker: "You",
        text: "Today we are reviewing the finalized typography, token hierarchy, and component library for the web application.",
        startTimeMs: 3000,
        endTimeMs: 11000,
      },
      {
        speaker: "Others",
        text: "The components look sharp, but the marketing committee wants thirty additional social media banner formats, print-ready vector brochures, and animated banner ads for LinkedIn.",
        startTimeMs: 13000,
        endTimeMs: 26000,
      },
      {
        speaker: "You",
        text: "Our agreement was explicitly for the digital design tokens and web UI kit, with up to two rounds of revisions.",
        startTimeMs: 28000,
        endTimeMs: 37000,
      },
      {
        speaker: "Others",
        text: "We really feel like collateral assets are part of a complete brand identity. We can't approve the milestone without the marketing assets.",
        startTimeMs: 39000,
        endTimeMs: 49000,
      },
      {
        speaker: "You",
        text: "I can probably whip up five or six extra LinkedIn banners and print exports tonight without billing you.",
        startTimeMs: 51000,
        endTimeMs: 60000,
      },
      {
        speaker: "Others",
        text: "Terrific. And if we need further tweaks next week, we assume you'll adjust them until the committee is completely satisfied.",
        startTimeMs: 62000,
        endTimeMs: 71000,
      },
      {
        speaker: "You",
        text: "Let's review the five banners first and stick to the two revision rounds agreed in the master contract.",
        startTimeMs: 73000,
        endTimeMs: 82000,
      },
    ],
  },
  {
    title: "Enterprise API Migration Check-in",
    durationSeconds: 720,
    summary: "Performance check-in on GraphQL gateway. Client pushed for 24/7 emergency on-call uptime guarantee; freelancer tentatively agreed to monitor alerts over holiday weekend without retainer agreement.",
    actionItems: [
      "Send benchmark metrics confirming 40% latency reduction.",
      "Provide SLA proposal with emergency response retainer pricing.",
      "Remove personal phone number from enterprise emergency documentation.",
    ],
    requestedWork: [
      {
        task: "Deliver GraphQL API performance optimization",
        quote: "The GraphQL endpoint latency has dropped 40%, which is fantastic.",
        speaker: "Others",
        isScopeCreep: false,
      },
      {
        task: "Provide 24/7 on-call coverage with 15-minute response SLA",
        quote: "our enterprise tier requires a 99.99% uptime guarantee and 15-minute emergency response 24/7.",
        speaker: "Others",
        isScopeCreep: true,
      },
    ],
    riskyCommitments: [
      {
        quote: "I guess I can leave my laptop open and monitor PagerDuty alerts over the long weekend just in case.",
        speaker: "You",
        risk: "Informal agreement to 24/7 unpaid on-call shifts with immense legal liability and disrupted personal time.",
        recommendedReply: "24/7 SLA coverage requires a dedicated pager rotation and retainer. I can help set up automated health checks and train your internal ops team, or draft an on-call retainer agreement.",
      },
    ],
    suggestions: [
      {
        title: "Block Personal Phone Number from Client Escalation Runbook",
        description: "Client attempted to publish freelancer personal phone number to enterprise customers without an on-call agreement.",
        category: "SCOPE_BOUNDARY",
        exactQuote: "We will put your direct mobile phone number in the enterprise client runbook.",
        recommendedAction: "Send immediate notice that personal numbers must not be circulated and only support tickets are monitored.",
        priority: 1,
      },
      {
        title: "Draft High-Tier Managed SLA Retainer Agreement",
        description: "Turn enterprise uptime demands into recurring monthly revenue rather than unpaid weekend obligation.",
        category: "PRICE_ANCHOR",
        exactQuote: "our enterprise tier requires a 99.99% uptime guarantee and 15-minute emergency response 24/7.",
        recommendedAction: "Quote a monthly DevOps on-call retainer ($3,500/mo) with defined business hour SLOs.",
        priority: 2,
      },
    ],
    patterns: [
      {
        pattern: "Creeping responsibility from code delivery to 24/7 infrastructure operation",
        risk: "Freelancer gets trapped into unpaid emergency support indefinitely.",
        advice: "Delineate development contracts from managed service provider agreements clearly in writing.",
      },
    ],
    segments: [
      {
        speaker: "Others",
        text: "The GraphQL endpoint latency has dropped 40%, which is fantastic. However, our enterprise tier requires a 99.99% uptime guarantee and 15-minute emergency response 24/7.",
        startTimeMs: 4000,
        endTimeMs: 18000,
      },
      {
        speaker: "You",
        text: "Our engagement is structured as software engineering consulting, not a managed DevOps service with an on-call rotation.",
        startTimeMs: 20000,
        endTimeMs: 29000,
      },
      {
        speaker: "Others",
        text: "Our enterprise clients are demanding an immediate escalation contact. Can we count on you if the webhook gateway alerts over Thanksgiving weekend?",
        startTimeMs: 31000,
        endTimeMs: 42000,
      },
      {
        speaker: "You",
        text: "I guess I can leave my laptop open and monitor PagerDuty alerts over the long weekend just in case.",
        startTimeMs: 44000,
        endTimeMs: 53000,
      },
      {
        speaker: "Others",
        text: "Excellent. We will put your direct mobile phone number in the enterprise client runbook.",
        startTimeMs: 55000,
        endTimeMs: 62000,
      },
      {
        speaker: "You",
        text: "Wait, I didn't mean to be the official on-call contact. We need a formal SLA discussion.",
        startTimeMs: 64000,
        endTimeMs: 72000,
      },
      {
        speaker: "Others",
        text: "You already agreed you'd monitor it. Let's make sure the alerting rules route to your phone.",
        startTimeMs: 74000,
        endTimeMs: 82000,
      },
    ],
  },
];

async function seed() {
  console.log("[Seed] Starting database seed with 4 demo meetings...");

  // 1. Create or upsert demo user
  const email = "demo@syapa.local";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Demo Freelancer",
        email,
        passwordHash: "$2a$10$wT1mX7g2YvW5t4Qp0u8eEe8kG3G4K5L6M7N8O9P0Q1R2S3T4U5V6W",
      },
    });
    console.log(`[Seed] Created demo user: ${user.email} (${user.id})`);
  }

  // 2. Ensure demo API token exists for Chrome Extension
  const demoTokenStr = "syp_demofreelancertoken98765432101234567890";
  let apiToken = await prisma.apiToken.findUnique({ where: { token: demoTokenStr } });
  if (!apiToken) {
    apiToken = await prisma.apiToken.create({
      data: {
        userId: user.id,
        name: "Demo Chrome Extension",
        token: demoTokenStr,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`[Seed] Created demo API token: ${demoTokenStr}`);
  }

  // 3. Create sample project brief
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

  let brief = await prisma.projectContext.findFirst({
    where: { userId: user.id, title: "Acme Payments Merchant Portal Brief" },
  });

  if (!brief) {
    brief = await prisma.projectContext.create({
      data: {
        userId: user.id,
        title: "Acme Payments Merchant Portal Brief",
        type: "BRIEF",
        content: briefContent,
        metadata: { client: "Acme Financial Services", budget: 6500, isDemo: true },
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
        metadata: { title: brief.title, type: "BRIEF", isDemo: true },
        embedding: briefEmbeddings[i],
        embeddingModel: embeddingsClient.getModel(),
      });
    }
    console.log(`[Seed] Seeded brief with ${briefChunks.length} vector chunks.`);
  }

  // 4. Seed all four demo meetings through the pipeline
  for (const mDef of DEMO_MEETINGS) {
    let meeting = await prisma.meeting.findFirst({
      where: { userId: user.id, title: mDef.title },
    });

    if (meeting) {
      console.log(`[Seed] Demo meeting "${mDef.title}" already exists (${meeting.id}). Skipping recreation.`);
      continue;
    }

    meeting = await prisma.meeting.create({
      data: {
        userId: user.id,
        title: mDef.title,
        status: "COMPLETED",
        durationSeconds: mDef.durationSeconds,
        summary: mDef.summary,
        actionItems: mDef.actionItems,
        requestedWork: mDef.requestedWork,
        riskyCommitments: mDef.riskyCommitments,
        droppedQuotesCount: 0,
        metadata: {
          isDemo: true,
          demoTag: "v0-seed",
        },
      },
    });

    // Save segments
    await prisma.transcriptSegment.createMany({
      data: mDef.segments.map((s) => ({
        meetingId: meeting.id,
        speaker: s.speaker,
        text: s.text,
        startTimeMs: s.startTimeMs,
        endTimeMs: s.endTimeMs,
      })),
    });

    // Save MeetingAnalysis + Suggestions
    const analysis = await prisma.meetingAnalysis.create({
      data: {
        meetingId: meeting.id,
        summary: mDef.summary,
        actionItems: mDef.actionItems,
        requestedWork: mDef.requestedWork,
        riskyCommitments: mDef.riskyCommitments,
        patterns: mDef.patterns,
        droppedQuotesCount: 0,
      },
    });

    for (const sugg of mDef.suggestions) {
      await prisma.suggestion.create({
        data: {
          meetingAnalysisId: analysis.id,
          title: sugg.title,
          description: sugg.description,
          category: sugg.category,
          exactQuote: sugg.exactQuote,
          recommendedAction: sugg.recommendedAction,
          priority: sugg.priority,
        },
      });
    }

    // Embed segments into vector store (batched 1024 embeddings call)
    const chunks = chunkTranscriptSegments(mDef.segments, 350, 50);
    const chunkEmbeddings = await embeddingsClient.embedBatch(chunks.map((c) => c.content));

    for (let i = 0; i < chunks.length; i++) {
      await DocumentChunkRepository.storeChunk({
        userId: user.id,
        meetingId: meeting.id,
        contextType: "MEETING_CHUNK",
        chunkIndex: i,
        content: chunks[i].content,
        metadata: {
          ...chunks[i].metadata,
          meetingTitle: mDef.title,
          isDemo: true,
        },
        embedding: chunkEmbeddings[i],
        embeddingModel: embeddingsClient.getModel(),
      });
    }

    console.log(
      `[Seed] Successfully seeded "${mDef.title}" (${meeting.id}) with ${mDef.segments.length} segments, ${mDef.suggestions.length} suggestions, and ${chunks.length} chunks.`
    );
  }

  console.log("[Seed] Database seed completed successfully!");
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error("[Seed] Error during seeding:", err);
  process.exit(1);
});
