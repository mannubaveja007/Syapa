import { z } from "zod";

// ==================== AUTH & TOKEN SCHEMAS ====================
export const RegisterInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const CreateApiTokenInputSchema = z.object({
  name: z.string().min(1, "Token name is required").default("Chrome Extension"),
  expiresInDays: z.number().int().positive().optional().default(30),
});
export type CreateApiTokenInput = z.infer<typeof CreateApiTokenInputSchema>;

// ==================== MEETING SCHEMAS ====================
export const SpeakerSchema = z.enum(["You", "Others"]);
export type Speaker = z.infer<typeof SpeakerSchema>;

export const MeetingStatusSchema = z.enum(["RECORDING", "PROCESSING", "COMPLETED", "FAILED"]);
export type MeetingStatus = z.infer<typeof MeetingStatusSchema>;

export const CreateMeetingInputSchema = z.object({
  title: z.string().min(1).default("Untitled Meeting"),
});
export type CreateMeetingInput = z.infer<typeof CreateMeetingInputSchema>;

export const TranscriptSegmentSchema = z.object({
  speaker: SpeakerSchema,
  text: z.string().min(1),
  startTimeMs: z.number().int().nonnegative(),
  endTimeMs: z.number().int().nonnegative(),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export const TranscriptBatchInputSchema = z.object({
  segments: z.array(TranscriptSegmentSchema).min(1),
});
export type TranscriptBatchInput = z.infer<typeof TranscriptBatchInputSchema>;

export const RequestedWorkItemSchema = z.object({
  task: z.string(),
  quote: z.string(),
  speaker: SpeakerSchema.optional(),
  isScopeCreep: z.boolean().default(false),
});
export type RequestedWorkItem = z.infer<typeof RequestedWorkItemSchema>;

export const PostMeetingAnalysisSchema = z.object({
  summary: z.string(),
  actionItems: z.array(z.string()),
  requestedWork: z.array(RequestedWorkItemSchema),
  droppedQuotesCount: z.number().int().nonnegative().default(0),
});
export type PostMeetingAnalysis = z.infer<typeof PostMeetingAnalysisSchema>;

// ==================== CONTEXT / UPLOAD SCHEMAS ====================
export const ContextTypeSchema = z.enum(["BRIEF", "CHAT", "MEETING_CHUNK"]);
export type ContextType = z.infer<typeof ContextTypeSchema>;

export const UploadContextInputSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["BRIEF", "CHAT"]),
  content: z.string().min(1),
  metadata: z.record(z.any()).optional().default({}),
});
export type UploadContextInput = z.infer<typeof UploadContextInputSchema>;

// ==================== BAD CLIENT SIMULATOR SCHEMAS ====================
export const PersonaSchema = z.enum([
  "scope_creeper",
  "budget_haggler",
  "ghost_payer",
  "micromanager",
  "vague_brief",
]);
export type Persona = z.infer<typeof PersonaSchema>;

export const DifficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const HiddenStateSchema = z.object({
  patience: z.number().min(0).max(100),
  trust: z.number().min(0).max(100),
  budgetCeiling: z.number().nonnegative(),
  hiddenAsks: z.array(z.string()),
});
export type HiddenState = z.infer<typeof HiddenStateSchema>;

export const CreateSimulationInputSchema = z.object({
  persona: PersonaSchema,
  difficulty: DifficultySchema,
  briefId: z.string().optional(),
  chatLogId: z.string().optional(),
  includeMeetingIds: z.array(z.string()).optional(),
  customContext: z.string().optional(),
});
export type CreateSimulationInput = z.infer<typeof CreateSimulationInputSchema>;

export const SimulationTurnRoleSchema = z.enum(["user", "client"]);
export type SimulationTurnRole = z.infer<typeof SimulationTurnRoleSchema>;

export const SendSimulationMessageInputSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
});
export type SendSimulationMessageInput = z.infer<typeof SendSimulationMessageInputSchema>;

export const BadClientTurnOutputSchema = z.object({
  reply: z.string(),
  hiddenStateDelta: z.object({
    patienceDelta: z.number().describe("Change in patience between -20 and +20"),
    trustDelta: z.number().describe("Change in trust between -20 and +20"),
    hiddenAsksRevealed: z.array(z.string()).describe("Any hidden asks introduced or reinforced in this turn"),
  }),
});
export type BadClientTurnOutput = z.infer<typeof BadClientTurnOutputSchema>;

// ==================== SCORECARD SCHEMAS ====================
export const ConcessionItemSchema = z.object({
  quote: z.string(),
  turnIndex: z.number().int().nonnegative(),
  critique: z.string(),
});
export type ConcessionItem = z.infer<typeof ConcessionItemSchema>;

export const BoundaryItemSchema = z.object({
  quote: z.string(),
  turnIndex: z.number().int().nonnegative(),
  praise: z.string(),
});
export type BoundaryItem = z.infer<typeof BoundaryItemSchema>;

export const PriceAnchoringSchema = z.object({
  initialOffer: z.string(),
  finalAgreed: z.string(),
  rating: z.enum(["Strong", "Moderate", "Weak"]),
  notes: z.string(),
});
export type PriceAnchoring = z.infer<typeof PriceAnchoringSchema>;

export const VaguePromiseSchema = z.object({
  quote: z.string(),
  turnIndex: z.number().int().nonnegative(),
  risk: z.string(),
});
export type VaguePromise = z.infer<typeof VaguePromiseSchema>;

export const RewriteItemSchema = z.object({
  turnIndex: z.number().int().nonnegative(),
  originalReply: z.string(),
  recommendedRewrite: z.string(),
  rationale: z.string(),
});
export type RewriteItem = z.infer<typeof RewriteItemSchema>;

export const ScorecardSchema = z.object({
  overallScore: z.number().min(0).max(100),
  summary: z.string(),
  freeConcessions: z.array(ConcessionItemSchema),
  boundariesHeld: z.array(BoundaryItemSchema),
  priceAnchoring: PriceAnchoringSchema,
  vaguePromises: z.array(VaguePromiseSchema),
  rewrites: z.array(RewriteItemSchema).length(3, "Must provide exactly 3 rewrites of weak replies"),
});
export type Scorecard = z.infer<typeof ScorecardSchema>;

// ==================== RETRIEVAL / HYBRID SEARCH SCHEMAS ====================
export const HybridSearchResultSchema = z.object({
  id: z.string(),
  content: z.string(),
  contextType: ContextTypeSchema,
  meetingId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  vectorScore: z.number(),
  keywordScore: z.number(),
  combinedScore: z.number(),
});
export type HybridSearchResult = z.infer<typeof HybridSearchResultSchema>;
