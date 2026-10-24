import { prisma } from "../client";

export interface CreateMeetingParams {
  userId: string;
  title?: string;
  metadata?: Record<string, any>;
}

export interface AppendSegmentsParams {
  meetingId: string;
  segments: Array<{
    speaker: "You" | "Others";
    text: string;
    startTimeMs: number;
    endTimeMs: number;
  }>;
}

export interface SaveMeetingAnalysisParams {
  meetingId: string;
  summary: string;
  actionItems: string[];
  requestedWork: any[];
  riskyCommitments?: any[];
  patterns?: any[];
  suggestions?: Array<{
    title: string;
    description: string;
    category: string;
    exactQuote?: string | null;
    recommendedAction: string;
    priority?: number;
  }>;
  droppedQuotesCount: number;
}

export class MeetingRepository {
  static async createMeeting(params: CreateMeetingParams) {
    return prisma.meeting.create({
      data: {
        userId: params.userId,
        title: params.title || "Untitled Meeting",
        status: "RECORDING",
        metadata: params.metadata || {},
      },
    });
  }

  static async getMeetingById(id: string, userId?: string) {
    return prisma.meeting.findFirst({
      where: {
        id,
        ...(userId ? { userId } : {}),
      },
      include: {
        segments: {
          orderBy: { startTimeMs: "asc" },
        },
        analysis: {
          include: {
            suggestions: {
              orderBy: { priority: "asc" },
            },
          },
        },
      },
    });
  }

  static async getPastCompletedMeetings(userId: string, excludeMeetingId: string, limit = 3) {
    return prisma.meeting.findMany({
      where: {
        userId,
        id: { not: excludeMeetingId },
        status: "COMPLETED",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        analysis: true,
      },
    });
  }

  static async listMeetingsByUser(userId: string, limit = 50) {
    return prisma.meeting.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        _count: {
          select: { segments: true },
        },
      },
    });
  }

  static async appendSegments(params: AppendSegmentsParams) {
    return prisma.transcriptSegment.createMany({
      data: params.segments.map((seg) => ({
        meetingId: params.meetingId,
        speaker: seg.speaker,
        text: seg.text,
        startTimeMs: seg.startTimeMs,
        endTimeMs: seg.endTimeMs,
      })),
    });
  }

  static async getSegmentsByMeetingId(meetingId: string) {
    return prisma.transcriptSegment.findMany({
      where: { meetingId },
      orderBy: { startTimeMs: "asc" },
    });
  }

  static async updateStatus(id: string, status: "RECORDING" | "PROCESSING" | "COMPLETED" | "FAILED", endTime?: Date) {
    return prisma.meeting.update({
      where: { id },
      data: {
        status,
        ...(endTime ? { endTime } : {}),
      },
    });
  }

  static async saveMeetingAnalysis(params: SaveMeetingAnalysisParams) {
    // 1. Update Meeting overview
    await prisma.meeting.update({
      where: { id: params.meetingId },
      data: {
        status: "COMPLETED",
        summary: params.summary,
        actionItems: params.actionItems,
        requestedWork: params.requestedWork,
        riskyCommitments: params.riskyCommitments || [],
        droppedQuotesCount: params.droppedQuotesCount,
      },
    });

    // 2. Clear existing suggestions if re-running
    const existingAnalysis = await prisma.meetingAnalysis.findUnique({
      where: { meetingId: params.meetingId },
    });
    if (existingAnalysis) {
      await prisma.suggestion.deleteMany({
        where: { meetingAnalysisId: existingAnalysis.id },
      });
    }

    // 3. Upsert MeetingAnalysis and Suggestions
    return prisma.meetingAnalysis.upsert({
      where: { meetingId: params.meetingId },
      create: {
        meetingId: params.meetingId,
        summary: params.summary,
        actionItems: params.actionItems,
        requestedWork: params.requestedWork,
        riskyCommitments: params.riskyCommitments || [],
        patterns: params.patterns || [],
        droppedQuotesCount: params.droppedQuotesCount,
        suggestions: {
          create: (params.suggestions || []).map((s, idx) => ({
            title: s.title,
            description: s.description,
            category: s.category,
            exactQuote: s.exactQuote || null,
            recommendedAction: s.recommendedAction,
            priority: s.priority ?? idx + 1,
          })),
        },
      },
      update: {
        summary: params.summary,
        actionItems: params.actionItems,
        requestedWork: params.requestedWork,
        riskyCommitments: params.riskyCommitments || [],
        patterns: params.patterns || [],
        droppedQuotesCount: params.droppedQuotesCount,
        suggestions: {
          create: (params.suggestions || []).map((s, idx) => ({
            title: s.title,
            description: s.description,
            category: s.category,
            exactQuote: s.exactQuote || null,
            recommendedAction: s.recommendedAction,
            priority: s.priority ?? idx + 1,
          })),
        },
      },
      include: {
        suggestions: {
          orderBy: { priority: "asc" },
        },
      },
    });
  }

  static async deleteMeeting(id: string, userId: string) {
    return prisma.meeting.deleteMany({
      where: { id, userId },
    });
  }
}
