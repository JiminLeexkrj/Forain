import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  loginId: text("login_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordIterations: integer("password_iterations").notNull(),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockoutUntil: text("lockout_until"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_auth_sessions_user").on(table.userId), index("idx_auth_sessions_expiry").on(table.expiresAt)]);

export const diaries = sqliteTable("diaries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default(""),
  body: text("body").notNull(),
  status: text("status").notNull().default("saved"),
  localDate: text("local_date").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_diaries_user_created").on(table.userId, table.createdAt)]);

export const activityMentions = sqliteTable("activity_mentions", {
  id: text("id").primaryKey(),
  diaryId: text("diary_id").notNull().references(() => diaries.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name"),
  category: text("category").notNull(),
  confidence: real("confidence").notNull(),
  evidence: text("evidence").notNull(),
  status: text("status").notNull().default("pending"),
  rawGrowth: real("raw_growth").notNull().default(1),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_mentions_user_diary").on(table.userId, table.diaryId)]);

export const activityGrowthEvents = sqliteTable("activity_growth_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  diaryId: text("diary_id").notNull().references(() => diaries.id, { onDelete: "cascade" }),
  activityMentionId: text("activity_mention_id").notNull().references(() => activityMentions.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  rawGrowth: real("raw_growth").notNull(),
  appliedGrowth: real("applied_growth").notNull().default(0),
  localDate: text("local_date").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("uidx_growth_mention").on(table.activityMentionId), index("idx_growth_user_date").on(table.userId, table.localDate)]);

export const dailyGrowthLedgers = sqliteTable("daily_growth_ledgers", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  localDate: text("local_date").notNull(),
  category: text("category").notNull(),
  rawGrowth: real("raw_growth").notNull(),
  appliedGrowth: real("applied_growth").notNull(),
  categoryCap: real("category_cap").notNull().default(3),
  totalCap: real("total_cap").notNull().default(10),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("uidx_ledger_user_date_category").on(table.userId, table.localDate, table.category)]);

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  forestSeed: integer("forest_seed").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
