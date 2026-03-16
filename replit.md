# BeUpFree - Portal Afiliado de Calçados Esportivos

## Overview

BeUpFree is a Brazilian affiliate portal specializing in athletic footwear and sports accessories. It scrapes public offer pages from Mercado Livre, processes them through a Collect → Process → Triage → Publish pipeline, and presents curated products with affiliate links (code: 14610626). The platform targets Brazilian consumers looking for running shoes, casual sneakers, soccer cleats, and sports accessories.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Pipeline: Collect → Process → Triage → Publish
1. **Collect**: `server/jobs/collect.ts` scrapes ML public offer pages via `server/services/mlScraper.ts`, saves raw data to `raw_collected_items`
2. **Process**: Auto-detects brand, category, generates affiliate URL; saves to `processed_items`
3. **Triage**: Items enter `triage_queue` for admin approval/rejection at `/admin/triagem`
4. **Publish**: Approved items create a `product` + `offer` + `product_image` in the public catalog

### Key Principle: Produto ≠ Oferta
- A **Product** is a catalog entry (name, brand, category, images, slug)
- An **Offer** is a price point from a marketplace (price, discount, affiliate URL, expiration)
- One product can have multiple offers; the best offer is shown publicly

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **Component Library**: shadcn/ui components built on Radix UI primitives
- **Build Tool**: Vite with React plugin

Pages:
- `/` — Home (landing page with hero, categories, featured products)
- `/catalogo` — Catalog (real products from API with offers)
- `/admin/triagem` — Admin triage page (approve/reject collected items)

Key components:
- `client/src/components/ProductCard.tsx` — Product card with affiliate link, price, discount badge
- `client/src/components/Header.tsx` — Public header with nav and admin settings link
- `client/src/pages/AdminTriagem.tsx` — Triage queue with collect, approve, reject actions

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints under `/api/` prefix
- **Development**: tsx for hot reloading, Vite middleware for frontend serving
- **Production**: esbuild bundling, static file serving

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Migrations**: Drizzle Kit with push-based migrations (`npm run db:push`)
- **Connection**: Node-postgres (pg) pool with Neon serverless support

Schema tables:
- **Reference data**: brands, categories, marketplaces
- **Catalog**: products, product_images, offers
- **Pipeline**: collection_sources, collection_batches, raw_collected_items, processed_items, triage_queue, curation_actions
- **Analytics**: affiliate_clicks, search_history, newsletter_subscribers
- **Admin**: admin_users, system_settings

### API Structure
- `/api/products` — Public product catalog (includes bestOffer with price/affiliate URL)
- `/api/brands`, `/api/categories` — Reference data
- `/api/ml/scrape-ofertas` — Direct ML scraper endpoint
- `/api/admin/collect` — POST: trigger collection pipeline
- `/api/admin/triage` — GET: pending triage items
- `/api/admin/triage/:id/approve` — POST: approve and publish
- `/api/admin/triage/:id/reject` — POST: reject item
- `/api/init` — Seed brands, categories, marketplace

### Key Files
- `shared/schema.ts` — All Drizzle tables, enums, Zod schemas, types
- `server/storage.ts` — DatabaseStorage class with all CRUD operations
- `server/routes.ts` — Express route definitions
- `server/jobs/collect.ts` — Collection pipeline job
- `server/services/mlScraper.ts` — Mercado Livre HTML scraper
- `server/services/productSync.ts` — Product sync utilities, affiliate link generator
- `server/services/perplexityService.ts` — AI classification via Perplexity

### ML Scraper Output Fields
The scraper (`mlScraper.ts`) returns objects with these fields:
- `nome`, `marca`, `preco_atual`, `preco_original`, `desconto_percent`
- `link_afiliado`, `url`, `imagens` (array), `avaliacao_media`, `qtd_avaliacoes`
- `frete_gratis`, `parcelas`, `fonte`

## External Dependencies

### Third-Party Services
- **Mercado Livre**: Product data via HTML scraping (API blocked by Replit IP - do NOT use direct ML API)
- **Perplexity AI**: Product classification and information enrichment
- **Affiliate Code**: 14610626 (appended to ML product links via matt_tool parameter)

### Key NPM Packages
- **UI**: Radix UI primitives, Embla Carousel, Lucide icons, react-icons
- **Forms**: React Hook Form with Zod validation
- **Database**: drizzle-orm, drizzle-zod, pg, @neondatabase/serverless
- **Scraping**: cheerio (HTML parsing)
- **Utilities**: date-fns, clsx, tailwind-merge, class-variance-authority, uuid

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `PERPLEXITY_API_KEY`: For AI-powered product classification
- `ML_CLIENT_ID`, `ML_CLIENT_SECRET`: Mercado Livre API credentials (not currently used due to IP block)

### Design System
Custom green/yellow/white color scheme defined in CSS variables, following Nike.com-inspired e-commerce patterns with product-first visual hierarchy and mobile-first responsive design.