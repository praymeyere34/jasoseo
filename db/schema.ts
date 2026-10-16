import { integer, sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  age: integer("age"),
  gender: text("gender"),
  militaryStatus: text("military_status"),
  preferredRegion1: text("preferred_region_1"),
  preferredRegion2: text("preferred_region_2"),
  preferredRegion3: text("preferred_region_3"),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("idx_sessions_user_id").on(table.userId)]);

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  position: text("position").notNull(),
  question: text("question").notNull(),
  traits: text("traits").notNull(),
  stories: text("stories").notNull(),
  content: text("content").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("idx_drafts_user_updated").on(table.userId, table.updatedAt)]);

export const workspaces = sqliteTable("workspaces", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  answers: text("answers").notNull(),
  traits: text("traits").notNull(),
  stories: text("stories").notNull(),
  background: text("background").notNull().default("{}"),
  company: text("company").notNull(),
  position: text("position").notNull(),
  question: text("question").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const loginAttempts = sqliteTable("login_attempts", {
  phone: text("phone").primaryKey(),
  failedCount: integer("failed_count").notNull(),
  windowStart: integer("window_start").notNull(),
});

export const phoneVerifications = sqliteTable("phone_verifications", {
  phone: text("phone").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull(),
  lastSentAt: integer("last_sent_at").notNull(),
  sendCount: integer("send_count").notNull(),
  windowStart: integer("window_start").notNull(),
});

export const smsRateLimits = sqliteTable("sms_rate_limits", {
  scopeKey: text("scope_key").primaryKey(),
  sentCount: integer("sent_count").notNull(),
  windowStart: integer("window_start").notNull(),
});

export const userConsents = sqliteTable("user_consents", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  version: text("version").notNull(),
  acceptedAt: integer("accepted_at").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.kind, table.version] })]);
