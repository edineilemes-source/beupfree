# BeUpFree - E-commerce de Calçados Esportivos

## Overview

BeUpFree is a Brazilian e-commerce platform specializing in athletic footwear and sports accessories (tênis, meias, tornozeleiras). The application operates as an affiliate storefront, curating products from Mercado Livre and presenting them through a modern, conversion-optimized shopping experience. The platform targets Brazilian consumers looking for running shoes, casual sneakers, soccer cleats, and sports accessories.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **Component Library**: shadcn/ui components built on Radix UI primitives
- **Build Tool**: Vite with React plugin

The frontend follows a component-based architecture with:
- Reusable UI components in `client/src/components/ui/`
- Feature components in `client/src/components/`
- Page components in `client/src/pages/`
- Path aliases configured: `@/` for client source, `@shared/` for shared code, `@assets/` for static assets

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints under `/api/` prefix
- **Development**: tsx for hot reloading, Vite middleware for frontend serving
- **Production**: esbuild bundling, static file serving

The server has separate entry points:
- `server/index-dev.ts`: Development with Vite HMR integration
- `server/index-prod.ts`: Production with static file serving

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Migrations**: Drizzle Kit with push-based migrations (`npm run db:push`)
- **Connection**: Node-postgres (pg) pool with Neon serverless support

The schema includes comprehensive e-commerce entities:
- Users, Categories (hierarchical), Brands
- Products with images, variants, and technical specifications
- Orders, Cart items, Reviews, Wishlists
- Promotions with various discount types
- Newsletter subscribers and search history

### Key Design Patterns
1. **Affiliate Model**: Products link to Mercado Livre via affiliate URLs rather than direct purchasing
2. **Product Classification**: Extensive filter taxonomy for athletic footwear (pisada, amortecimento, drop, etc.)
3. **AI Integration**: Perplexity AI service for product classification and information enrichment
4. **Product Sync**: Background service to import and sync products from Mercado Livre API

### API Structure
- `/api/ml/*`: Mercado Livre integration endpoints (search, promotions)
- `/api/products`: Product catalog with filtering and pagination
- `/api/brands`, `/api/categories`: Reference data endpoints
- Product sync endpoints for admin operations

## External Dependencies

### Third-Party Services
- **Mercado Livre API**: Primary product data source and affiliate link generation (MLB site ID for Brazil)
- **Perplexity AI**: Product classification and information enrichment via chat completions API
- **Neon Database**: PostgreSQL hosting (serverless-compatible)

### Key NPM Packages
- **UI**: Radix UI primitives, Embla Carousel, Lucide icons, react-icons
- **Forms**: React Hook Form with Zod validation
- **Database**: drizzle-orm, drizzle-zod, pg, @neondatabase/serverless
- **Utilities**: date-fns, clsx, tailwind-merge, class-variance-authority

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `PERPLEXITY_API_KEY`: For AI-powered product classification

### Design System
The project uses a custom green/yellow/white color scheme defined in CSS variables, following Nike.com-inspired e-commerce patterns with product-first visual hierarchy and mobile-first responsive design.