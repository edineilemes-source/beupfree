import { sql, relations } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  integer, 
  decimal, 
  boolean, 
  timestamp, 
  jsonb,
  index,
  pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// ENUMS
// ============================================

export const catalogStatusEnum = pgEnum('catalog_status', [
  'draft',
  'published',
  'archived'
]);

export const offerStatusEnum = pgEnum('offer_status', [
  'active',
  'paused',
  'expired',
  'removed'
]);

export const triageStatusEnum = pgEnum('triage_status', [
  'pending',
  'approved',
  'rejected',
  'skipped'
]);

export const curationActionEnum = pgEnum('curation_action', [
  'approve',
  'reject',
  'skip',
  'edit_approve'
]);

export const collectionStatusEnum = pgEnum('collection_status', [
  'running',
  'completed',
  'failed',
  'partial'
]);

// ============================================
// MARCAS
// ============================================

export const brands = pgTable("brands", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name"),
  logo: text("logo"),
  description: text("description"),
  website: text("website"),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_brands_slug").on(table.slug)
]);

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products)
}));

// ============================================
// CATEGORIAS - Hierárquica
// ============================================

export const categories = pgTable("categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  image: text("image"),
  icon: text("icon"),
  parentId: varchar("parent_id", { length: 36 }),
  level: integer("level").default(1),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_categories_parent").on(table.parentId),
  index("idx_categories_slug").on(table.slug)
]);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryParent"
  }),
  children: many(categories, { relationName: "categoryParent" }),
  products: many(products)
}));

// ============================================
// PRODUTOS - Identidade normalizada (sem preço)
// ============================================

export const products = pgTable("products", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  brandId: varchar("brand_id", { length: 36 }).references(() => brands.id),
  mainCategoryId: varchar("main_category_id", { length: 36 }).references(() => categories.id),
  mainName: text("main_name").notNull(),
  slug: text("slug").notNull().unique(),
  shortName: text("short_name"),
  shortDescription: text("short_description"),
  detailedDescription: text("detailed_description"),
  gender: varchar("gender", { length: 40 }),
  usageType: varchar("usage_type", { length: 60 }),
  primaryColor: varchar("primary_color", { length: 60 }),
  mainImageUrl: text("main_image_url"),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
  totalReviews: integer("total_reviews").default(0),
  catalogStatus: catalogStatusEnum("catalog_status").default('draft'),
  section: varchar("section", { length: 20 }),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_products_brand").on(table.brandId),
  index("idx_products_category").on(table.mainCategoryId),
  index("idx_products_slug").on(table.slug),
  index("idx_products_status").on(table.catalogStatus)
]);

export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id]
  }),
  category: one(categories, {
    fields: [products.mainCategoryId],
    references: [categories.id]
  }),
  images: many(productImages),
  offers: many(offers)
}));

// ============================================
// IMAGENS DE PRODUTO
// ============================================

export const productImages = pgTable("product_images", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: text("url").notNull(),
  alt: text("alt"),
  sortOrder: integer("sort_order").default(0),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_product_images_product").on(table.productId)
]);

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id]
  })
}));

// ============================================
// MARKETPLACES
// ============================================

export const marketplaces = pgTable("marketplaces", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 120 }).notNull().unique(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  baseUrl: text("base_url"),
  affiliateCode: varchar("affiliate_code", { length: 60 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// OFERTAS - Ocorrência comercial (preço + link + marketplace)
// ============================================

export const offers = pgTable("offers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id),
  marketplaceId: varchar("marketplace_id", { length: 36 }).references(() => marketplaces.id),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  discountPercent: integer("discount_percent"),
  currency: varchar("currency", { length: 10 }).default('BRL'),
  originalUrl: text("original_url"),
  affiliateUrl: text("affiliate_url"),
  sellerName: varchar("seller_name", { length: 200 }),
  sellerRating: decimal("seller_rating", { precision: 3, scale: 2 }),
  freeShipping: boolean("free_shipping").default(false),
  installments: varchar("installments", { length: 100 }),
  externalId: varchar("external_id", { length: 100 }),
  status: offerStatusEnum("status").default('active'),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  capturedAt: timestamp("captured_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_offers_product").on(table.productId),
  index("idx_offers_marketplace").on(table.marketplaceId),
  index("idx_offers_status").on(table.status),
  index("idx_offers_external").on(table.externalId)
]);

export const offersRelations = relations(offers, ({ one }) => ({
  product: one(products, {
    fields: [offers.productId],
    references: [products.id]
  }),
  marketplace: one(marketplaces, {
    fields: [offers.marketplaceId],
    references: [marketplaces.id]
  })
}));

// ============================================
// ORIGENS DE COLETA
// ============================================

export const collectionSources = pgTable("collection_sources", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  sourceType: varchar("source_type", { length: 60 }).notNull(),
  url: text("url"),
  marketplaceId: varchar("marketplace_id", { length: 36 }).references(() => marketplaces.id),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  isActive: boolean("is_active").default(true),
  collectFrequencyMinutes: integer("collect_frequency_minutes").default(120),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// MEMBERSHIPS DE COLEÇÃO (rastreia itens por fonte)
// ============================================

export const collectionMemberships = pgTable("collection_memberships", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  collectionSourceId: varchar("collection_source_id", { length: 36 }).notNull().references(() => collectionSources.id),
  externalItemId: varchar("external_item_id", { length: 100 }),
  contentHash: varchar("content_hash", { length: 64 }),
  lastBatchId: varchar("last_batch_id", { length: 36 }),
  rawTitle: text("raw_title"),
  rawPrice: decimal("raw_price", { precision: 10, scale: 2 }),
  rawUrl: text("raw_url"),
  isActive: boolean("is_active").default(true),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  missedRunsCount: integer("missed_runs_count").default(0),
}, (table) => [
  index("idx_memberships_source").on(table.collectionSourceId),
  index("idx_memberships_active").on(table.collectionSourceId, table.isActive),
  index("idx_memberships_seen").on(table.lastSeenAt),
  index("idx_memberships_external").on(table.externalItemId),
  index("idx_memberships_hash").on(table.collectionSourceId, table.contentHash),
]);

// ============================================
// LOTES DE COLETA
// ============================================

export const collectionBatches = pgTable("collection_batches", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id", { length: 36 }).references(() => collectionSources.id),
  status: collectionStatusEnum("status").default('running'),
  totalCollected: integer("total_collected").default(0),
  totalErrors: integer("total_errors").default(0),
  startedAt: timestamp("started_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
  errorLog: text("error_log"),
});

// ============================================
// ITENS BRUTOS COLETADOS
// ============================================

export const rawCollectedItems = pgTable("raw_collected_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id", { length: 36 }).notNull().references(() => collectionBatches.id),
  externalId: varchar("external_id", { length: 100 }),
  rawTitle: text("raw_title").notNull(),
  rawPrice: decimal("raw_price", { precision: 10, scale: 2 }),
  rawOriginalPrice: decimal("raw_original_price", { precision: 10, scale: 2 }),
  rawImageUrl: text("raw_image_url"),
  rawUrl: text("raw_url"),
  rawDiscount: integer("raw_discount"),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>().default({}),
  contentHash: varchar("content_hash", { length: 64 }),
  collectedAt: timestamp("collected_at").defaultNow(),
}, (table) => [
  index("idx_raw_items_batch").on(table.batchId),
  index("idx_raw_items_hash").on(table.contentHash),
  index("idx_raw_items_external").on(table.externalId)
]);

// ============================================
// ITENS PROCESSADOS
// ============================================

export const processedItems = pgTable("processed_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  rawItemId: varchar("raw_item_id", { length: 36 }).references(() => rawCollectedItems.id),
  normalizedTitle: text("normalized_title").notNull(),
  detectedBrand: varchar("detected_brand", { length: 120 }),
  detectedCategory: varchar("detected_category", { length: 120 }),
  detectedGender: varchar("detected_gender", { length: 40 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  discountPercent: integer("discount_percent"),
  imageUrl: text("image_url"),
  sourceUrl: text("source_url"),
  affiliateUrl: text("affiliate_url"),
  externalId: varchar("external_id", { length: 100 }),
  detectedRating: decimal("detected_rating", { precision: 3, scale: 2 }),
  detectedReviews: integer("detected_reviews").default(0),
  freeShipping: boolean("free_shipping").default(false),
  contentHash: varchar("content_hash", { length: 64 }),
  isDuplicate: boolean("is_duplicate").default(false),
  matchedProductId: varchar("matched_product_id", { length: 36 }),
  promotionType: varchar("promotion_type", { length: 20 }).default('general'),
  processedAt: timestamp("processed_at").defaultNow(),
}, (table) => [
  index("idx_processed_raw").on(table.rawItemId),
  index("idx_processed_hash").on(table.contentHash),
  index("idx_processed_promo").on(table.promotionType)
]);

// ============================================
// FILA DE TRIAGEM
// ============================================

export const triageQueue = pgTable("triage_queue", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  processedItemId: varchar("processed_item_id", { length: 36 }).notNull().references(() => processedItems.id),
  status: triageStatusEnum("status").default('pending'),
  priority: integer("priority").default(0),
  suggestedProductId: varchar("suggested_product_id", { length: 36 }),
  suggestedBrandId: varchar("suggested_brand_id", { length: 36 }),
  suggestedCategoryId: varchar("suggested_category_id", { length: 36 }),
  collectionSourceId: varchar("collection_source_id", { length: 36 }),
  adminNotes: text("admin_notes"),
  // Auto-approval audit fields
  approvedBy: varchar("approved_by", { length: 20 }),  // 'system' | 'admin' | null
  autoApproved: boolean("auto_approved").default(false),
  autoApprovedReason: jsonb("auto_approved_reason").$type<Record<string, unknown>>(),
  brandDetected: varchar("brand_detected", { length: 120 }),
  brandConfidence: decimal("brand_confidence", { precision: 4, scale: 3 }),
  issues: jsonb("issues").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("idx_triage_status").on(table.status),
  index("idx_triage_processed").on(table.processedItemId)
]);

// ============================================
// AÇÕES DE CURADORIA
// ============================================

export const curationActions = pgTable("curation_actions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  triageItemId: varchar("triage_item_id", { length: 36 }).notNull().references(() => triageQueue.id),
  action: curationActionEnum("action").notNull(),
  rejectionReason: text("rejection_reason"),
  corrections: jsonb("corrections").$type<Record<string, unknown>>().default({}),
  resultProductId: varchar("result_product_id", { length: 36 }),
  resultOfferId: varchar("result_offer_id", { length: 36 }),
  performedAt: timestamp("performed_at").defaultNow(),
});

// ============================================
// CLIQUES AFILIADOS
// ============================================

export const affiliateClicks = pgTable("affiliate_clicks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  offerId: varchar("offer_id", { length: 36 }).references(() => offers.id),
  productId: varchar("product_id", { length: 36 }).references(() => products.id),
  sourcePageUrl: text("source_page_url"),
  userAgent: text("user_agent"),
  ipHash: varchar("ip_hash", { length: 64 }),
  clickedAt: timestamp("clicked_at").defaultNow(),
}, (table) => [
  index("idx_clicks_offer").on(table.offerId),
  index("idx_clicks_product").on(table.productId),
  index("idx_clicks_date").on(table.clickedAt)
]);

// ============================================
// SEO PAGES
// ============================================

export const seoPages = pgTable("seo_pages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  heading: text("heading"),
  introText: text("intro_text"),
  pageType: varchar("page_type", { length: 60 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// NEWSLETTER
// ============================================

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  isActive: boolean("is_active").default(true),
  subscribedAt: timestamp("subscribed_at").defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at"),
}, (table) => [
  index("idx_newsletter_email").on(table.email)
]);

// ============================================
// HISTÓRICO DE BUSCAS
// ============================================

export const searchHistory = pgTable("search_history", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id"),
  query: text("query").notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>>().default({}),
  resultsCount: integer("results_count"),
  clickedProductId: varchar("clicked_product_id", { length: 36 }).references(() => products.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_search_query").on(table.query)
]);

// ============================================
// CONFIGURAÇÕES DO SISTEMA
// ============================================

export const systemSettings = pgTable("system_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// ADMIN USERS (simples, sem auth completa no MVP)
// ============================================

export const adminUsers = pgTable("admin_users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// ZOD SCHEMAS & TYPES
// ============================================

export const insertBrandSchema = createInsertSchema(brands).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brands.$inferSelect;

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const insertProductImageSchema = createInsertSchema(productImages).omit({ id: true, createdAt: true });
export type InsertProductImage = z.infer<typeof insertProductImageSchema>;
export type ProductImage = typeof productImages.$inferSelect;

export const insertMarketplaceSchema = createInsertSchema(marketplaces).omit({ id: true, createdAt: true });
export type InsertMarketplace = z.infer<typeof insertMarketplaceSchema>;
export type Marketplace = typeof marketplaces.$inferSelect;

export const insertOfferSchema = createInsertSchema(offers).omit({ id: true, createdAt: true, updatedAt: true, capturedAt: true, lastSeenAt: true });
export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type Offer = typeof offers.$inferSelect;

export const insertCollectionSourceSchema = createInsertSchema(collectionSources).omit({ id: true, createdAt: true });
export type InsertCollectionSource = z.infer<typeof insertCollectionSourceSchema>;
export type CollectionSource = typeof collectionSources.$inferSelect;

export const insertCollectionMembershipSchema = createInsertSchema(collectionMemberships).omit({ id: true, firstSeenAt: true, lastSeenAt: true });
export type InsertCollectionMembership = z.infer<typeof insertCollectionMembershipSchema>;
export type CollectionMembership = typeof collectionMemberships.$inferSelect;

export const insertCollectionBatchSchema = createInsertSchema(collectionBatches).omit({ id: true });
export type InsertCollectionBatch = z.infer<typeof insertCollectionBatchSchema>;
export type CollectionBatch = typeof collectionBatches.$inferSelect;

export const insertRawCollectedItemSchema = createInsertSchema(rawCollectedItems).omit({ id: true, collectedAt: true });
export type InsertRawCollectedItem = z.infer<typeof insertRawCollectedItemSchema>;
export type RawCollectedItem = typeof rawCollectedItems.$inferSelect;

export const insertProcessedItemSchema = createInsertSchema(processedItems).omit({ id: true, processedAt: true });
export type InsertProcessedItem = z.infer<typeof insertProcessedItemSchema>;
export type ProcessedItem = typeof processedItems.$inferSelect;

export const insertTriageQueueSchema = createInsertSchema(triageQueue).omit({ id: true, createdAt: true });
export type InsertTriageQueue = z.infer<typeof insertTriageQueueSchema>;
export type TriageQueueItem = typeof triageQueue.$inferSelect;

export const insertCurationActionSchema = createInsertSchema(curationActions).omit({ id: true, performedAt: true });
export type InsertCurationAction = z.infer<typeof insertCurationActionSchema>;
export type CurationAction = typeof curationActions.$inferSelect;

export const insertAffiliateClickSchema = createInsertSchema(affiliateClicks).omit({ id: true, clickedAt: true });
export type InsertAffiliateClick = z.infer<typeof insertAffiliateClickSchema>;
export type AffiliateClick = typeof affiliateClicks.$inferSelect;

export const insertSeoPageSchema = createInsertSchema(seoPages).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSeoPage = z.infer<typeof insertSeoPageSchema>;
export type SeoPage = typeof seoPages.$inferSelect;

export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({ id: true, subscribedAt: true, unsubscribedAt: true });
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;

export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({ id: true, createdAt: true });
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, updatedAt: true });
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({ id: true, createdAt: true });
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
