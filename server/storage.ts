import { 
  categories, type Category, type InsertCategory,
  brands, type Brand, type InsertBrand,
  products, type Product, type InsertProduct,
  productImages, type ProductImage, type InsertProductImage,
  marketplaces, type Marketplace, type InsertMarketplace,
  offers, type Offer, type InsertOffer,
  collectionSources, type CollectionSource, type InsertCollectionSource,
  collectionBatches, type CollectionBatch, type InsertCollectionBatch,
  collectionMemberships, type CollectionMembership, type InsertCollectionMembership,
  rawCollectedItems, type RawCollectedItem, type InsertRawCollectedItem,
  processedItems, type ProcessedItem, type InsertProcessedItem,
  triageQueue, type TriageQueueItem, type InsertTriageQueue,
  curationActions, type CurationAction, type InsertCurationAction,
  affiliateClicks, type AffiliateClick, type InsertAffiliateClick,
  searchHistory, type SearchHistory, type InsertSearchHistory,
  newsletterSubscribers, type NewsletterSubscriber, type InsertNewsletterSubscriber,
  systemSettings, type SystemSetting, type InsertSystemSetting
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, like, count } from "drizzle-orm";

export interface IStorage {
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;

  getBrands(): Promise<Brand[]>;
  getBrand(id: string): Promise<Brand | undefined>;
  getBrandBySlug(slug: string): Promise<Brand | undefined>;
  createBrand(brand: InsertBrand): Promise<Brand>;
  updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined>;
  deleteBrand(id: string): Promise<boolean>;

  getProducts(options?: { categoryId?: string; brandId?: string; status?: string; limit?: number; offset?: number; search?: string }): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySlug(slug: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  getProductImages(productId: string): Promise<ProductImage[]>;
  createProductImage(image: InsertProductImage): Promise<ProductImage>;
  deleteProductImage(id: string): Promise<boolean>;

  getMarketplaces(): Promise<Marketplace[]>;
  getMarketplace(id: string): Promise<Marketplace | undefined>;
  createMarketplace(marketplace: InsertMarketplace): Promise<Marketplace>;

  getOffers(options?: { productId?: string; status?: string; limit?: number; offset?: number }): Promise<Offer[]>;
  getOffer(id: string): Promise<Offer | undefined>;
  getOfferByExternalId(externalId: string): Promise<Offer | undefined>;
  createOffer(offer: InsertOffer): Promise<Offer>;
  updateOffer(id: string, data: Partial<InsertOffer>): Promise<Offer | undefined>;

  getCollectionSources(): Promise<CollectionSource[]>;
  getCollectionSource(id: string): Promise<CollectionSource | undefined>;
  createCollectionSource(source: InsertCollectionSource): Promise<CollectionSource>;
  updateCollectionSource(id: string, data: Partial<InsertCollectionSource>): Promise<CollectionSource | undefined>;

  createCollectionBatch(batch: InsertCollectionBatch): Promise<CollectionBatch>;
  updateCollectionBatch(id: string, data: Partial<InsertCollectionBatch>): Promise<CollectionBatch | undefined>;
  getCollectionBatches(sourceId: string, limit?: number): Promise<CollectionBatch[]>;

  getMembershipStats(sourceId: string): Promise<{ total: number; active: number; inactive: number }>;
  getTriageItemByContentHash(contentHash: string): Promise<TriageQueueItem | undefined>;

  createRawCollectedItem(item: InsertRawCollectedItem): Promise<RawCollectedItem>;
  getRawCollectedItemByHash(hash: string): Promise<RawCollectedItem | undefined>;

  createProcessedItem(item: InsertProcessedItem): Promise<ProcessedItem>;
  getProcessedItem(id: string): Promise<ProcessedItem | undefined>;

  getTriageQueue(options?: { status?: string; limit?: number; offset?: number }): Promise<TriageQueueItem[]>;
  getTriageItem(id: string): Promise<TriageQueueItem | undefined>;
  createTriageItem(item: InsertTriageQueue): Promise<TriageQueueItem>;
  updateTriageItem(id: string, data: Record<string, any>): Promise<TriageQueueItem | undefined>;

  createCurationAction(action: InsertCurationAction): Promise<CurationAction>;

  createAffiliateClick(click: InsertAffiliateClick): Promise<AffiliateClick>;

  logSearch(search: InsertSearchHistory): Promise<SearchHistory>;
  getPopularSearches(limit?: number): Promise<{ query: string; count: number }[]>;

  subscribeNewsletter(subscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber>;
  unsubscribeNewsletter(email: string): Promise<boolean>;
  isSubscribed(email: string): Promise<boolean>;

  getSetting(key: string): Promise<SystemSetting | undefined>;
  setSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
}

export class DatabaseStorage implements IStorage {

  // ============ CATEGORIES ============
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(asc(categories.sortOrder));
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [cat] = await db.select().from(categories).where(eq(categories.id, id));
    return cat || undefined;
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, slug));
    return cat || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [created] = await db.insert(categories).values(category).returning();
    return created;
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updated] = await db.update(categories).set({ ...data, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
    return updated || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ============ BRANDS ============
  async getBrands(): Promise<Brand[]> {
    return db.select().from(brands).orderBy(asc(brands.name));
  }

  async getBrand(id: string): Promise<Brand | undefined> {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand || undefined;
  }

  async getBrandBySlug(slug: string): Promise<Brand | undefined> {
    const [brand] = await db.select().from(brands).where(eq(brands.slug, slug));
    return brand || undefined;
  }

  async createBrand(brand: InsertBrand): Promise<Brand> {
    const [created] = await db.insert(brands).values(brand).returning();
    return created;
  }

  async updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined> {
    const [updated] = await db.update(brands).set({ ...data, updatedAt: new Date() }).where(eq(brands.id, id)).returning();
    return updated || undefined;
  }

  async deleteBrand(id: string): Promise<boolean> {
    const result = await db.delete(brands).where(eq(brands.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ============ PRODUCTS ============
  async getProducts(options?: { categoryId?: string; brandId?: string; status?: string; limit?: number; offset?: number; search?: string }): Promise<Product[]> {
    let query = db.select().from(products);
    const conditions = [];

    if (options?.categoryId) conditions.push(eq(products.mainCategoryId, options.categoryId));
    if (options?.brandId) conditions.push(eq(products.brandId, options.brandId));
    if (options?.status) conditions.push(eq(products.catalogStatus, options.status as any));
    if (options?.search) conditions.push(like(products.mainName, `%${options.search}%`));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(products.createdAt)) as any;
    if (options?.limit) query = query.limit(options.limit) as any;
    if (options?.offset) query = query.offset(options.offset) as any;

    return query;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.slug, slug));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set({ ...data, updatedAt: new Date() }).where(eq(products.id, id)).returning();
    return updated || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ============ PRODUCT IMAGES ============
  async getProductImages(productId: string): Promise<ProductImage[]> {
    return db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.sortOrder));
  }

  async createProductImage(image: InsertProductImage): Promise<ProductImage> {
    const [created] = await db.insert(productImages).values(image).returning();
    return created;
  }

  async deleteProductImage(id: string): Promise<boolean> {
    const result = await db.delete(productImages).where(eq(productImages.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ============ MARKETPLACES ============
  async getMarketplaces(): Promise<Marketplace[]> {
    return db.select().from(marketplaces);
  }

  async getMarketplace(id: string): Promise<Marketplace | undefined> {
    const [mp] = await db.select().from(marketplaces).where(eq(marketplaces.id, id));
    return mp || undefined;
  }

  async createMarketplace(marketplace: InsertMarketplace): Promise<Marketplace> {
    const [created] = await db.insert(marketplaces).values(marketplace).returning();
    return created;
  }

  // ============ OFFERS ============
  async getOffers(options?: { productId?: string; status?: string; limit?: number; offset?: number }): Promise<Offer[]> {
    let query = db.select().from(offers);
    const conditions = [];

    if (options?.productId) conditions.push(eq(offers.productId, options.productId));
    if (options?.status) conditions.push(eq(offers.status, options.status as any));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(offers.createdAt)) as any;
    if (options?.limit) query = query.limit(options.limit) as any;
    if (options?.offset) query = query.offset(options.offset) as any;

    return query;
  }

  async getOffer(id: string): Promise<Offer | undefined> {
    const [offer] = await db.select().from(offers).where(eq(offers.id, id));
    return offer || undefined;
  }

  async getOfferByExternalId(externalId: string): Promise<Offer | undefined> {
    const [offer] = await db.select().from(offers).where(eq(offers.externalId, externalId));
    return offer || undefined;
  }

  async createOffer(offer: InsertOffer): Promise<Offer> {
    const [created] = await db.insert(offers).values(offer).returning();
    return created;
  }

  async updateOffer(id: string, data: Partial<InsertOffer>): Promise<Offer | undefined> {
    const [updated] = await db.update(offers).set({ ...data, updatedAt: new Date() }).where(eq(offers.id, id)).returning();
    return updated || undefined;
  }

  // ============ COLLECTION SOURCES ============
  async getCollectionSources(): Promise<CollectionSource[]> {
    return db.select().from(collectionSources).orderBy(asc(collectionSources.createdAt));
  }

  async getCollectionSource(id: string): Promise<CollectionSource | undefined> {
    const [source] = await db.select().from(collectionSources).where(eq(collectionSources.id, id));
    return source || undefined;
  }

  async createCollectionSource(source: InsertCollectionSource): Promise<CollectionSource> {
    const [created] = await db.insert(collectionSources).values(source).returning();
    return created;
  }

  async updateCollectionSource(id: string, data: Partial<InsertCollectionSource>): Promise<CollectionSource | undefined> {
    const [updated] = await db.update(collectionSources).set(data).where(eq(collectionSources.id, id)).returning();
    return updated || undefined;
  }

  // ============ COLLECTION BATCHES ============
  async createCollectionBatch(batch: InsertCollectionBatch): Promise<CollectionBatch> {
    const [created] = await db.insert(collectionBatches).values(batch).returning();
    return created;
  }

  async updateCollectionBatch(id: string, data: Partial<InsertCollectionBatch>): Promise<CollectionBatch | undefined> {
    const [updated] = await db.update(collectionBatches).set(data).where(eq(collectionBatches.id, id)).returning();
    return updated || undefined;
  }

  async getCollectionBatches(sourceId: string, limit: number = 10): Promise<CollectionBatch[]> {
    return db.select().from(collectionBatches)
      .where(eq(collectionBatches.sourceId, sourceId))
      .orderBy(desc(collectionBatches.startedAt))
      .limit(limit);
  }

  // ============ COLLECTION MEMBERSHIPS ============
  async getMembershipStats(sourceId: string): Promise<{ total: number; active: number; inactive: number }> {
    const [totalRow] = await db
      .select({ count: count() })
      .from(collectionMemberships)
      .where(eq(collectionMemberships.collectionSourceId, sourceId));

    const [activeRow] = await db
      .select({ count: count() })
      .from(collectionMemberships)
      .where(and(
        eq(collectionMemberships.collectionSourceId, sourceId),
        eq(collectionMemberships.isActive, true)
      ));

    const total = totalRow?.count ?? 0;
    const active = activeRow?.count ?? 0;

    return { total, active, inactive: total - active };
  }

  // ============ TRIAGE — lookup by hash ============
  async getTriageItemByContentHash(contentHash: string): Promise<TriageQueueItem | undefined> {
    const [item] = await db
      .select({ triage: triageQueue })
      .from(triageQueue)
      .innerJoin(processedItems, eq(triageQueue.processedItemId, processedItems.id))
      .where(and(
        eq(processedItems.contentHash, contentHash),
        eq(triageQueue.status, "pending")
      ))
      .limit(1);
    return item?.triage || undefined;
  }

  // ============ RAW COLLECTED ITEMS ============
  async createRawCollectedItem(item: InsertRawCollectedItem): Promise<RawCollectedItem> {
    const [created] = await db.insert(rawCollectedItems).values(item).returning();
    return created;
  }

  async getRawCollectedItemByHash(hash: string): Promise<RawCollectedItem | undefined> {
    const [item] = await db.select().from(rawCollectedItems).where(eq(rawCollectedItems.contentHash, hash));
    return item || undefined;
  }

  // ============ PROCESSED ITEMS ============
  async createProcessedItem(item: InsertProcessedItem): Promise<ProcessedItem> {
    const [created] = await db.insert(processedItems).values(item).returning();
    return created;
  }

  async getProcessedItem(id: string): Promise<ProcessedItem | undefined> {
    const [item] = await db.select().from(processedItems).where(eq(processedItems.id, id));
    return item || undefined;
  }

  // ============ TRIAGE QUEUE ============
  async getTriageQueue(options?: { status?: string; limit?: number; offset?: number }): Promise<TriageQueueItem[]> {
    let query = db.select().from(triageQueue);

    if (options?.status) {
      query = query.where(eq(triageQueue.status, options.status as any)) as any;
    }

    query = query.orderBy(desc(triageQueue.priority), asc(triageQueue.createdAt)) as any;
    if (options?.limit) query = query.limit(options.limit) as any;
    if (options?.offset) query = query.offset(options.offset) as any;

    return query;
  }

  async getTriageItem(id: string): Promise<TriageQueueItem | undefined> {
    const [item] = await db.select().from(triageQueue).where(eq(triageQueue.id, id));
    return item || undefined;
  }

  async createTriageItem(item: InsertTriageQueue): Promise<TriageQueueItem> {
    const [created] = await db.insert(triageQueue).values(item).returning();
    return created;
  }

  async updateTriageItem(id: string, data: Record<string, any>): Promise<TriageQueueItem | undefined> {
    const [updated] = await db.update(triageQueue).set(data).where(eq(triageQueue.id, id)).returning();
    return updated || undefined;
  }

  // ============ CURATION ACTIONS ============
  async createCurationAction(action: InsertCurationAction): Promise<CurationAction> {
    const [created] = await db.insert(curationActions).values(action).returning();
    return created;
  }

  // ============ AFFILIATE CLICKS ============
  async createAffiliateClick(click: InsertAffiliateClick): Promise<AffiliateClick> {
    const [created] = await db.insert(affiliateClicks).values(click).returning();
    return created;
  }

  // ============ SEARCH HISTORY ============
  async logSearch(search: InsertSearchHistory): Promise<SearchHistory> {
    const [created] = await db.insert(searchHistory).values(search).returning();
    return created;
  }

  async getPopularSearches(limit: number = 10): Promise<{ query: string; count: number }[]> {
    const result = await db
      .select({
        query: searchHistory.query,
        count: sql<number>`count(*)::int`,
      })
      .from(searchHistory)
      .groupBy(searchHistory.query)
      .orderBy(sql`count(*) desc`)
      .limit(limit);
    return result;
  }

  // ============ NEWSLETTER ============
  async subscribeNewsletter(subscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber> {
    const [created] = await db.insert(newsletterSubscribers).values(subscriber).returning();
    return created;
  }

  async unsubscribeNewsletter(email: string): Promise<boolean> {
    const [updated] = await db
      .update(newsletterSubscribers)
      .set({ isActive: false, unsubscribedAt: new Date() })
      .where(eq(newsletterSubscribers.email, email))
      .returning();
    return !!updated;
  }

  async isSubscribed(email: string): Promise<boolean> {
    const [sub] = await db.select().from(newsletterSubscribers).where(and(eq(newsletterSubscribers.email, email), eq(newsletterSubscribers.isActive, true)));
    return !!sub;
  }

  // ============ SYSTEM SETTINGS ============
  async getSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting || undefined;
  }

  async setSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const existing = await this.getSetting(setting.key);
    if (existing) {
      const [updated] = await db
        .update(systemSettings)
        .set({ value: setting.value, description: setting.description, updatedAt: new Date() })
        .where(eq(systemSettings.key, setting.key))
        .returning();
      return updated;
    }
    const [created] = await db.insert(systemSettings).values(setting).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
