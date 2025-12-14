import { 
  users, type User, type InsertUser,
  categories, type Category, type InsertCategory,
  brands, type Brand, type InsertBrand,
  products, type Product, type InsertProduct,
  productImages, type ProductImage, type InsertProductImage,
  productVariants, type ProductVariant, type InsertProductVariant,
  promotions, type Promotion, type InsertPromotion,
  promotionProducts,
  coupons, type Coupon, type InsertCoupon,
  addresses, type Address, type InsertAddress,
  cartItems, type CartItem, type InsertCartItem,
  orders, type Order, type InsertOrder,
  orderItems, type OrderItem, type InsertOrderItem,
  reviews, type Review, type InsertReview,
  wishlistItems, type WishlistItem, type InsertWishlistItem,
  searchHistory, type SearchHistory, type InsertSearchHistory,
  newsletterSubscribers, type NewsletterSubscriber, type InsertNewsletterSubscriber,
  systemSettings, type SystemSetting, type InsertSystemSetting
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, like, desc, asc, sql, isNull } from "drizzle-orm";

// Storage interface with all CRUD operations
export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  
  // Brands
  getBrands(): Promise<Brand[]>;
  getBrand(id: string): Promise<Brand | undefined>;
  getBrandBySlug(slug: string): Promise<Brand | undefined>;
  createBrand(brand: InsertBrand): Promise<Brand>;
  updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined>;
  deleteBrand(id: string): Promise<boolean>;
  
  // Products
  getProducts(options?: { 
    categoryId?: string; 
    brandId?: string; 
    isActive?: boolean;
    isFeatured?: boolean;
    limit?: number; 
    offset?: number;
    search?: string;
  }): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySlug(slug: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  incrementProductViews(id: string): Promise<void>;
  
  // Product Images
  getProductImages(productId: string): Promise<ProductImage[]>;
  createProductImage(image: InsertProductImage): Promise<ProductImage>;
  deleteProductImage(id: string): Promise<boolean>;
  
  // Product Variants
  getProductVariants(productId: string): Promise<ProductVariant[]>;
  getProductVariant(id: string): Promise<ProductVariant | undefined>;
  createProductVariant(variant: InsertProductVariant): Promise<ProductVariant>;
  updateProductVariant(id: string, data: Partial<InsertProductVariant>): Promise<ProductVariant | undefined>;
  deleteProductVariant(id: string): Promise<boolean>;
  
  // Promotions
  getPromotions(options?: { isActive?: boolean; isPriority?: boolean }): Promise<Promotion[]>;
  getActivePromotions(): Promise<Promotion[]>;
  getPromotion(id: string): Promise<Promotion | undefined>;
  createPromotion(promotion: InsertPromotion): Promise<Promotion>;
  updatePromotion(id: string, data: Partial<InsertPromotion>): Promise<Promotion | undefined>;
  deletePromotion(id: string): Promise<boolean>;
  addProductToPromotion(promotionId: string, productId: string, customDiscount?: number): Promise<void>;
  removeProductFromPromotion(promotionId: string, productId: string): Promise<void>;
  getPromotionProducts(promotionId: string): Promise<Product[]>;
  
  // Coupons
  getCoupon(id: string): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: string, data: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: string): Promise<boolean>;
  incrementCouponUsage(id: string): Promise<void>;
  
  // Addresses
  getUserAddresses(userId: string): Promise<Address[]>;
  getAddress(id: string): Promise<Address | undefined>;
  createAddress(address: InsertAddress): Promise<Address>;
  updateAddress(id: string, data: Partial<InsertAddress>): Promise<Address | undefined>;
  deleteAddress(id: string): Promise<boolean>;
  
  // Cart
  getCartItems(userId?: string, sessionId?: string): Promise<CartItem[]>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<CartItem | undefined>;
  removeFromCart(id: string): Promise<boolean>;
  clearCart(userId?: string, sessionId?: string): Promise<void>;
  
  // Orders
  getOrders(userId?: string): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  
  // Reviews
  getProductReviews(productId: string): Promise<Review[]>;
  getReview(id: string): Promise<Review | undefined>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: string, data: Partial<InsertReview>): Promise<Review | undefined>;
  deleteReview(id: string): Promise<boolean>;
  incrementReviewHelpful(id: string): Promise<void>;
  
  // Wishlist
  getWishlistItems(userId: string): Promise<WishlistItem[]>;
  addToWishlist(item: InsertWishlistItem): Promise<WishlistItem>;
  removeFromWishlist(id: string): Promise<boolean>;
  isInWishlist(userId: string, productId: string): Promise<boolean>;
  
  // Search History
  logSearch(search: InsertSearchHistory): Promise<SearchHistory>;
  getSearchHistory(userId: string): Promise<SearchHistory[]>;
  getPopularSearches(limit?: number): Promise<{ query: string; count: number }[]>;
  
  // Newsletter
  subscribeNewsletter(subscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber>;
  unsubscribeNewsletter(email: string): Promise<boolean>;
  isSubscribed(email: string): Promise<boolean>;
  
  // System Settings
  getSetting(key: string): Promise<SystemSetting | undefined>;
  setSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  
  // ============ USERS ============
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser as any).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set({ ...data, updatedAt: new Date() } as any).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  // ============ CATEGORIES ============
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder));
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category || undefined;
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
    return true;
  }

  // ============ BRANDS ============
  async getBrands(): Promise<Brand[]> {
    return db.select().from(brands).where(eq(brands.isActive, true)).orderBy(asc(brands.name));
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
    await db.delete(brands).where(eq(brands.id, id));
    return true;
  }

  // ============ PRODUCTS ============
  async getProducts(options?: { 
    categoryId?: string; 
    brandId?: string; 
    isActive?: boolean;
    isFeatured?: boolean;
    limit?: number; 
    offset?: number;
    search?: string;
  }): Promise<Product[]> {
    let query = db.select().from(products).where(isNull(products.deletedAt)).$dynamic();
    
    const conditions = [isNull(products.deletedAt)];
    
    if (options?.categoryId) {
      conditions.push(eq(products.categoryId, options.categoryId));
    }
    if (options?.brandId) {
      conditions.push(eq(products.brandId, options.brandId));
    }
    if (options?.isActive !== undefined) {
      conditions.push(eq(products.isActive, options.isActive));
    }
    if (options?.isFeatured !== undefined) {
      conditions.push(eq(products.isFeatured, options.isFeatured));
    }
    if (options?.search) {
      conditions.push(like(products.name, `%${options.search}%`));
    }
    
    query = db.select().from(products).where(and(...conditions)).orderBy(desc(products.createdAt)).$dynamic();
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }
    
    return query;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(and(eq(products.id, id), isNull(products.deletedAt)));
    return product || undefined;
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(and(eq(products.slug, slug), isNull(products.deletedAt)));
    return product || undefined;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(and(eq(products.sku, sku), isNull(products.deletedAt)));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product as any).returning();
    return created;
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set({ ...data, updatedAt: new Date() } as any).where(eq(products.id, id)).returning();
    return updated || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, id));
    return true;
  }

  async incrementProductViews(id: string): Promise<void> {
    await db.update(products).set({ viewCount: sql`${products.viewCount} + 1` }).where(eq(products.id, id));
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
    await db.delete(productImages).where(eq(productImages.id, id));
    return true;
  }

  // ============ PRODUCT VARIANTS ============
  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    return db.select().from(productVariants).where(eq(productVariants.productId, productId));
  }

  async getProductVariant(id: string): Promise<ProductVariant | undefined> {
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, id));
    return variant || undefined;
  }

  async createProductVariant(variant: InsertProductVariant): Promise<ProductVariant> {
    const [created] = await db.insert(productVariants).values(variant as any).returning();
    return created;
  }

  async updateProductVariant(id: string, data: Partial<InsertProductVariant>): Promise<ProductVariant | undefined> {
    const [updated] = await db.update(productVariants).set({ ...data, updatedAt: new Date() } as any).where(eq(productVariants.id, id)).returning();
    return updated || undefined;
  }

  async deleteProductVariant(id: string): Promise<boolean> {
    await db.delete(productVariants).where(eq(productVariants.id, id));
    return true;
  }

  // ============ PROMOTIONS ============
  async getPromotions(options?: { isActive?: boolean; isPriority?: boolean }): Promise<Promotion[]> {
    const conditions = [];
    if (options?.isActive !== undefined) {
      conditions.push(eq(promotions.isActive, options.isActive));
    }
    if (options?.isPriority !== undefined) {
      conditions.push(eq(promotions.isPriority, options.isPriority));
    }
    
    if (conditions.length > 0) {
      return db.select().from(promotions).where(and(...conditions)).orderBy(desc(promotions.createdAt));
    }
    return db.select().from(promotions).orderBy(desc(promotions.createdAt));
  }

  async getActivePromotions(): Promise<Promotion[]> {
    const now = new Date();
    return db.select().from(promotions).where(
      and(
        eq(promotions.isActive, true),
        lte(promotions.startDate, now),
        gte(promotions.endDate, now)
      )
    ).orderBy(desc(promotions.isPriority));
  }

  async getPromotion(id: string): Promise<Promotion | undefined> {
    const [promo] = await db.select().from(promotions).where(eq(promotions.id, id));
    return promo || undefined;
  }

  async createPromotion(promotion: InsertPromotion): Promise<Promotion> {
    const [created] = await db.insert(promotions).values(promotion).returning();
    return created;
  }

  async updatePromotion(id: string, data: Partial<InsertPromotion>): Promise<Promotion | undefined> {
    const [updated] = await db.update(promotions).set({ ...data, updatedAt: new Date() }).where(eq(promotions.id, id)).returning();
    return updated || undefined;
  }

  async deletePromotion(id: string): Promise<boolean> {
    await db.delete(promotions).where(eq(promotions.id, id));
    return true;
  }

  async addProductToPromotion(promotionId: string, productId: string, customDiscount?: number): Promise<void> {
    await db.insert(promotionProducts).values({ promotionId, productId, customDiscount: customDiscount?.toString() });
  }

  async removeProductFromPromotion(promotionId: string, productId: string): Promise<void> {
    await db.delete(promotionProducts).where(
      and(eq(promotionProducts.promotionId, promotionId), eq(promotionProducts.productId, productId))
    );
  }

  async getPromotionProducts(promotionId: string): Promise<Product[]> {
    const result = await db.select({ product: products })
      .from(promotionProducts)
      .innerJoin(products, eq(promotionProducts.productId, products.id))
      .where(eq(promotionProducts.promotionId, promotionId));
    return result.map(r => r.product);
  }

  // ============ COUPONS ============
  async getCoupon(id: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id));
    return coupon || undefined;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    return coupon || undefined;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [created] = await db.insert(coupons).values({ ...coupon, code: coupon.code.toUpperCase() }).returning();
    return created;
  }

  async updateCoupon(id: string, data: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const [updated] = await db.update(coupons).set({ ...data, updatedAt: new Date() }).where(eq(coupons.id, id)).returning();
    return updated || undefined;
  }

  async deleteCoupon(id: string): Promise<boolean> {
    await db.delete(coupons).where(eq(coupons.id, id));
    return true;
  }

  async incrementCouponUsage(id: string): Promise<void> {
    await db.update(coupons).set({ usageCount: sql`${coupons.usageCount} + 1` }).where(eq(coupons.id, id));
  }

  // ============ ADDRESSES ============
  async getUserAddresses(userId: string): Promise<Address[]> {
    return db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault));
  }

  async getAddress(id: string): Promise<Address | undefined> {
    const [address] = await db.select().from(addresses).where(eq(addresses.id, id));
    return address || undefined;
  }

  async createAddress(address: InsertAddress): Promise<Address> {
    const [created] = await db.insert(addresses).values(address).returning();
    return created;
  }

  async updateAddress(id: string, data: Partial<InsertAddress>): Promise<Address | undefined> {
    const [updated] = await db.update(addresses).set({ ...data, updatedAt: new Date() }).where(eq(addresses.id, id)).returning();
    return updated || undefined;
  }

  async deleteAddress(id: string): Promise<boolean> {
    await db.delete(addresses).where(eq(addresses.id, id));
    return true;
  }

  // ============ CART ============
  async getCartItems(userId?: string, sessionId?: string): Promise<CartItem[]> {
    if (userId) {
      return db.select().from(cartItems).where(eq(cartItems.userId, userId));
    }
    if (sessionId) {
      return db.select().from(cartItems).where(eq(cartItems.sessionId, sessionId));
    }
    return [];
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    const [created] = await db.insert(cartItems).values(item).returning();
    return created;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const [updated] = await db.update(cartItems).set({ quantity, updatedAt: new Date() }).where(eq(cartItems.id, id)).returning();
    return updated || undefined;
  }

  async removeFromCart(id: string): Promise<boolean> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
    return true;
  }

  async clearCart(userId?: string, sessionId?: string): Promise<void> {
    if (userId) {
      await db.delete(cartItems).where(eq(cartItems.userId, userId));
    } else if (sessionId) {
      await db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
    }
  }

  // ============ ORDERS ============
  async getOrders(userId?: string): Promise<Order[]> {
    if (userId) {
      return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
    }
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return order || undefined;
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values(order as any).returning();
    return created;
  }

  async updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set({ ...data, updatedAt: new Date() } as any).where(eq(orders.id, id)).returning();
    return updated || undefined;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const [created] = await db.insert(orderItems).values(item as any).returning();
    return created;
  }

  // ============ REVIEWS ============
  async getProductReviews(productId: string): Promise<Review[]> {
    return db.select().from(reviews).where(and(eq(reviews.productId, productId), eq(reviews.isApproved, true))).orderBy(desc(reviews.createdAt));
  }

  async getReview(id: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review || undefined;
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    return created;
  }

  async updateReview(id: string, data: Partial<InsertReview>): Promise<Review | undefined> {
    const [updated] = await db.update(reviews).set({ ...data, updatedAt: new Date() }).where(eq(reviews.id, id)).returning();
    return updated || undefined;
  }

  async deleteReview(id: string): Promise<boolean> {
    await db.delete(reviews).where(eq(reviews.id, id));
    return true;
  }

  async incrementReviewHelpful(id: string): Promise<void> {
    await db.update(reviews).set({ helpfulCount: sql`${reviews.helpfulCount} + 1` }).where(eq(reviews.id, id));
  }

  // ============ WISHLIST ============
  async getWishlistItems(userId: string): Promise<WishlistItem[]> {
    return db.select().from(wishlistItems).where(eq(wishlistItems.userId, userId)).orderBy(desc(wishlistItems.createdAt));
  }

  async addToWishlist(item: InsertWishlistItem): Promise<WishlistItem> {
    const [created] = await db.insert(wishlistItems).values(item).returning();
    return created;
  }

  async removeFromWishlist(id: string): Promise<boolean> {
    await db.delete(wishlistItems).where(eq(wishlistItems.id, id));
    return true;
  }

  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const [item] = await db.select().from(wishlistItems).where(
      and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId))
    );
    return !!item;
  }

  // ============ SEARCH HISTORY ============
  async logSearch(search: InsertSearchHistory): Promise<SearchHistory> {
    const [created] = await db.insert(searchHistory).values(search).returning();
    return created;
  }

  async getSearchHistory(userId: string): Promise<SearchHistory[]> {
    return db.select().from(searchHistory).where(eq(searchHistory.userId, userId)).orderBy(desc(searchHistory.createdAt)).limit(50);
  }

  async getPopularSearches(limit: number = 10): Promise<{ query: string; count: number }[]> {
    const result = await db.select({
      query: searchHistory.query,
      count: sql<number>`count(*)::int`
    })
    .from(searchHistory)
    .groupBy(searchHistory.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
    
    return result;
  }

  // ============ NEWSLETTER ============
  async subscribeNewsletter(subscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber> {
    const [created] = await db.insert(newsletterSubscribers).values(subscriber).returning();
    return created;
  }

  async unsubscribeNewsletter(email: string): Promise<boolean> {
    await db.update(newsletterSubscribers).set({ isActive: false, unsubscribedAt: new Date() }).where(eq(newsletterSubscribers.email, email));
    return true;
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
      const [updated] = await db.update(systemSettings).set({ ...setting, updatedAt: new Date() }).where(eq(systemSettings.key, setting.key)).returning();
      return updated;
    }
    const [created] = await db.insert(systemSettings).values(setting).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
