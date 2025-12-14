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
  primaryKey,
  index,
  pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// ENUMS - Estados padronizados
// ============================================

export const orderStatusEnum = pgEnum('order_status', [
  'pending',      // Aguardando pagamento
  'paid',         // Pago
  'processing',   // Em processamento
  'shipped',      // Enviado
  'delivered',    // Entregue
  'cancelled',    // Cancelado
  'refunded'      // Reembolsado
]);

export const promotionTypeEnum = pgEnum('promotion_type', [
  'percentage',   // Desconto percentual
  'fixed',        // Desconto fixo
  'bogo',         // Buy One Get One
  'shipping'      // Frete grátis
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'pix',
  'credit_card',
  'debit_card',
  'boleto',
  'affiliate'     // Link afiliado (ML)
]);

// ============================================
// CATEGORIAS - Hierárquica com auto-referência
// ============================================

export const categories = pgTable("categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  image: text("image"),
  icon: text("icon"),
  parentId: varchar("parent_id", { length: 36 }),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
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
// MARCAS - Informações de marca
// ============================================

export const brands = pgTable("brands", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  description: text("description"),
  website: text("website"),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_brands_slug").on(table.slug)
]);

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products)
}));

// ============================================
// PRODUTOS - Core do e-commerce
// ============================================

export const products = pgTable("products", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  shortDescription: text("short_description"),
  
  // Preços
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  
  // Estoque
  stock: integer("stock").default(0),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  trackInventory: boolean("track_inventory").default(true),
  
  // Relações
  categoryId: varchar("category_id", { length: 36 }).references(() => categories.id),
  brandId: varchar("brand_id", { length: 36 }).references(() => brands.id),
  
  // Atributos flexíveis (cor, tamanho, material, etc)
  attributes: jsonb("attributes").$type<{
    color?: string;
    size?: string;
    material?: string;
    weight?: number;
    dimensions?: { width: number; height: number; depth: number };
    [key: string]: unknown;
  }>().default({}),
  
  // Especificações técnicas
  specifications: jsonb("specifications").$type<Record<string, string>>().default({}),
  
  // Tags para busca e filtros
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  
  // SEO
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  
  // Status
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  isNewArrival: boolean("is_new_arrival").default(false),
  
  // Afiliados - Link externo (Mercado Livre, etc)
  affiliateUrl: text("affiliate_url"),
  affiliateSource: text("affiliate_source"), // 'mercadolivre', 'amazon', etc
  affiliateProductId: text("affiliate_product_id"),
  
  // Analytics
  viewCount: integer("view_count").default(0),
  salesCount: integer("sales_count").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete
}, (table) => [
  index("idx_products_category").on(table.categoryId),
  index("idx_products_brand").on(table.brandId),
  index("idx_products_slug").on(table.slug),
  index("idx_products_sku").on(table.sku),
  index("idx_products_active").on(table.isActive),
  index("idx_products_featured").on(table.isFeatured)
]);

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  }),
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id]
  }),
  images: many(productImages),
  variants: many(productVariants),
  reviews: many(reviews),
  promotionProducts: many(promotionProducts),
  wishlistItems: many(wishlistItems),
  cartItems: many(cartItems),
  orderItems: many(orderItems)
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
// VARIANTES DE PRODUTO (tamanhos, cores específicas)
// ============================================

export const productVariants = pgTable("product_variants", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: 'cascade' }),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(), // Ex: "Azul - 42"
  
  // Opções da variante
  options: jsonb("options").$type<{
    color?: string;
    size?: string;
    [key: string]: unknown;
  }>().default({}),
  
  // Preço específico da variante (se diferente)
  price: decimal("price", { precision: 10, scale: 2 }),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  
  // Estoque
  stock: integer("stock").default(0),
  
  // Imagem específica
  image: text("image"),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_product_variants_product").on(table.productId),
  index("idx_product_variants_sku").on(table.sku)
]);

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id]
  })
}));

// ============================================
// PROMOÇÕES - Sistema flexível de descontos
// ============================================

export const promotions = pgTable("promotions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  
  type: promotionTypeEnum("type").notNull().default('percentage'),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(), // % ou valor fixo
  
  // Regras de aplicação
  minPurchaseAmount: decimal("min_purchase_amount", { precision: 10, scale: 2 }),
  maxDiscountAmount: decimal("max_discount_amount", { precision: 10, scale: 2 }),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").default(0),
  
  // Período de validade
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Visual
  bannerImage: text("banner_image"),
  badgeText: text("badge_text"), // Ex: "50% OFF"
  badgeColor: text("badge_color"),
  
  // Aplicação
  appliesToAll: boolean("applies_to_all").default(false),
  categoryIds: text("category_ids").array().default(sql`ARRAY[]::text[]`),
  brandIds: text("brand_ids").array().default(sql`ARRAY[]::text[]`),
  
  isActive: boolean("is_active").default(true),
  isPriority: boolean("is_priority").default(false), // Exibir no carrossel
  
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_promotions_dates").on(table.startDate, table.endDate),
  index("idx_promotions_active").on(table.isActive)
]);

export const promotionsRelations = relations(promotions, ({ many }) => ({
  promotionProducts: many(promotionProducts)
}));

// ============================================
// PRODUTOS EM PROMOÇÃO (Many-to-Many)
// ============================================

export const promotionProducts = pgTable("promotion_products", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  promotionId: varchar("promotion_id", { length: 36 }).notNull().references(() => promotions.id, { onDelete: 'cascade' }),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: 'cascade' }),
  customDiscount: decimal("custom_discount", { precision: 10, scale: 2 }), // Desconto específico
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_promo_products_promotion").on(table.promotionId),
  index("idx_promo_products_product").on(table.productId)
]);

export const promotionProductsRelations = relations(promotionProducts, ({ one }) => ({
  promotion: one(promotions, {
    fields: [promotionProducts.promotionId],
    references: [promotions.id]
  }),
  product: one(products, {
    fields: [promotionProducts.productId],
    references: [products.id]
  })
}));

// ============================================
// CUPONS DE DESCONTO
// ============================================

export const coupons = pgTable("coupons", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  description: text("description"),
  
  type: promotionTypeEnum("type").notNull().default('percentage'),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  
  minPurchaseAmount: decimal("min_purchase_amount", { precision: 10, scale: 2 }),
  maxDiscountAmount: decimal("max_discount_amount", { precision: 10, scale: 2 }),
  
  usageLimit: integer("usage_limit"),
  usageLimitPerUser: integer("usage_limit_per_user").default(1),
  usageCount: integer("usage_count").default(0),
  
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_coupons_code").on(table.code)
]);

// ============================================
// USUÁRIOS
// ============================================

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  
  // Perfil
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  cpf: text("cpf"),
  birthDate: timestamp("birth_date"),
  avatar: text("avatar"),
  
  // Status
  isActive: boolean("is_active").default(true),
  isVerified: boolean("is_verified").default(false),
  isAdmin: boolean("is_admin").default(false),
  
  // Preferências (JSONB para flexibilidade)
  preferences: jsonb("preferences").$type<{
    newsletter?: boolean;
    notifications?: boolean;
    favoriteCategories?: string[];
    [key: string]: unknown;
  }>().default({}),
  
  // Auth
  lastLoginAt: timestamp("last_login_at"),
  verificationToken: text("verification_token"),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordExpires: timestamp("reset_password_expires"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_email").on(table.email)
]);

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  reviews: many(reviews),
  wishlistItems: many(wishlistItems),
  cartItems: many(cartItems),
  searchHistory: many(searchHistory)
}));

// ============================================
// ENDEREÇOS
// ============================================

export const addresses = pgTable("addresses", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  label: text("label"), // Casa, Trabalho, etc
  recipientName: text("recipient_name").notNull(),
  phone: text("phone"),
  
  zipCode: text("zip_code").notNull(),
  street: text("street").notNull(),
  number: text("number").notNull(),
  complement: text("complement"),
  neighborhood: text("neighborhood").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").default('Brasil'),
  
  isDefault: boolean("is_default").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_addresses_user").on(table.userId)
]);

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, {
    fields: [addresses.userId],
    references: [users.id]
  })
}));

// ============================================
// CARRINHO
// ============================================

export const cartItems = pgTable("cart_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text("session_id"), // Para carrinhos anônimos
  
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: varchar("variant_id", { length: 36 }).references(() => productVariants.id),
  
  quantity: integer("quantity").notNull().default(1),
  
  // Snapshot do preço no momento de adicionar
  priceAtAdd: decimal("price_at_add", { precision: 10, scale: 2 }).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cart_user").on(table.userId),
  index("idx_cart_session").on(table.sessionId),
  index("idx_cart_product").on(table.productId)
]);

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id]
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id]
  }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id]
  })
}));

// ============================================
// PEDIDOS
// ============================================

export const orders = pgTable("orders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  
  // Status
  status: orderStatusEnum("status").notNull().default('pending'),
  
  // Valores
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default('0'),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default('0'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  
  // Cupom aplicado
  couponId: varchar("coupon_id", { length: 36 }).references(() => coupons.id),
  couponCode: text("coupon_code"),
  
  // Pagamento
  paymentMethod: paymentMethodEnum("payment_method"),
  paymentDetails: jsonb("payment_details").$type<Record<string, unknown>>().default({}),
  paidAt: timestamp("paid_at"),
  
  // Endereço de entrega (snapshot)
  shippingAddress: jsonb("shipping_address").$type<{
    recipientName: string;
    phone?: string;
    zipCode: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    country: string;
  }>().notNull(),
  
  // Rastreio
  trackingCode: text("tracking_code"),
  trackingUrl: text("tracking_url"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  
  // Afiliado
  affiliateSource: text("affiliate_source"),
  affiliateOrderId: text("affiliate_order_id"),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_orders_user").on(table.userId),
  index("idx_orders_status").on(table.status),
  index("idx_orders_number").on(table.orderNumber)
]);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id]
  }),
  coupon: one(coupons, {
    fields: [orders.couponId],
    references: [coupons.id]
  }),
  items: many(orderItems)
}));

// ============================================
// ITENS DO PEDIDO
// ============================================

export const orderItems = pgTable("order_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id),
  variantId: varchar("variant_id", { length: 36 }).references(() => productVariants.id),
  
  quantity: integer("quantity").notNull(),
  
  // Snapshot do produto no momento da compra
  productSnapshot: jsonb("product_snapshot").$type<{
    name: string;
    sku: string;
    price: number;
    image?: string;
    attributes?: Record<string, unknown>;
  }>().notNull(),
  
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  
  // Se for afiliado, link usado
  affiliateUrl: text("affiliate_url"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_order_items_order").on(table.orderId),
  index("idx_order_items_product").on(table.productId)
]);

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id]
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id]
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id]
  })
}));

// ============================================
// AVALIAÇÕES
// ============================================

export const reviews = pgTable("reviews", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: varchar("order_id", { length: 36 }).references(() => orders.id),
  
  rating: integer("rating").notNull(), // 1-5
  title: text("title"),
  comment: text("comment"),
  
  // Pros e Contras
  pros: text("pros").array().default(sql`ARRAY[]::text[]`),
  cons: text("cons").array().default(sql`ARRAY[]::text[]`),
  
  // Imagens da avaliação
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  
  // Moderação
  isApproved: boolean("is_approved").default(false),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false),
  
  // Utilidade
  helpfulCount: integer("helpful_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_reviews_product").on(table.productId),
  index("idx_reviews_user").on(table.userId),
  index("idx_reviews_rating").on(table.rating)
]);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id]
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id]
  }),
  order: one(orders, {
    fields: [reviews.orderId],
    references: [orders.id]
  })
}));

// ============================================
// WISHLIST
// ============================================

export const wishlistItems = pgTable("wishlist_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: 'cascade' }),
  
  // Notificar quando houver promoção
  notifyOnSale: boolean("notify_on_sale").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_wishlist_user").on(table.userId),
  index("idx_wishlist_product").on(table.productId)
]);

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  user: one(users, {
    fields: [wishlistItems.userId],
    references: [users.id]
  }),
  product: one(products, {
    fields: [wishlistItems.productId],
    references: [products.id]
  })
}));

// ============================================
// HISTÓRICO DE BUSCAS - Para analytics e recomendações
// ============================================

export const searchHistory = pgTable("search_history", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  sessionId: text("session_id"),
  
  query: text("query").notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>>().default({}),
  resultsCount: integer("results_count"),
  
  // Qual produto foi clicado após a busca
  clickedProductId: varchar("clicked_product_id", { length: 36 }).references(() => products.id),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_search_user").on(table.userId),
  index("idx_search_query").on(table.query)
]);

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  user: one(users, {
    fields: [searchHistory.userId],
    references: [users.id]
  }),
  clickedProduct: one(products, {
    fields: [searchHistory.clickedProductId],
    references: [products.id]
  })
}));

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
// ZOD SCHEMAS para validação
// ============================================

// Categories
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Brands
export const insertBrandSchema = createInsertSchema(brands).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brands.$inferSelect;

// Products
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, viewCount: true, salesCount: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Product Images
export const insertProductImageSchema = createInsertSchema(productImages).omit({ id: true, createdAt: true });
export type InsertProductImage = z.infer<typeof insertProductImageSchema>;
export type ProductImage = typeof productImages.$inferSelect;

// Product Variants
export const insertProductVariantSchema = createInsertSchema(productVariants).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type ProductVariant = typeof productVariants.$inferSelect;

// Promotions
export const insertPromotionSchema = createInsertSchema(promotions).omit({ id: true, createdAt: true, updatedAt: true, usageCount: true });
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Promotion = typeof promotions.$inferSelect;

// Coupons
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, updatedAt: true, usageCount: true });
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;

// Users
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, lastLoginAt: true, verificationToken: true, resetPasswordToken: true, resetPasswordExpires: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Addresses
export const insertAddressSchema = createInsertSchema(addresses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Address = typeof addresses.$inferSelect;

// Cart Items
export const insertCartItemSchema = createInsertSchema(cartItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type CartItem = typeof cartItems.$inferSelect;

// Orders
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Order Items
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true, createdAt: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// Reviews
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true, updatedAt: true, helpfulCount: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

// Wishlist
export const insertWishlistItemSchema = createInsertSchema(wishlistItems).omit({ id: true, createdAt: true });
export type InsertWishlistItem = z.infer<typeof insertWishlistItemSchema>;
export type WishlistItem = typeof wishlistItems.$inferSelect;

// Search History
export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({ id: true, createdAt: true });
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;

// Newsletter
export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({ id: true, subscribedAt: true, unsubscribedAt: true });
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;

// System Settings
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, updatedAt: true });
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
