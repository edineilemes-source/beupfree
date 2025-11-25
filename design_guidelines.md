# Design Guidelines: E-commerce de Calçados Esportivos

## Design Approach
**Reference-Based E-commerce Design** inspired by Nike.com, Shopify storefronts, and modern Brazilian sports retailers. Focus on product-first visual hierarchy with clean, conversion-optimized layouts that build trust for affiliate sales.

## Core Design Principles
1. **Product Photography First**: Large, high-quality product images drive purchasing decisions
2. **Clear Category Navigation**: Instant access to Tênis, Meias, and Acessórios categories
3. **Trust & Transparency**: Clearly indicate Mercado Livre partnership and affiliate relationship
4. **Filter-Friendly**: Robust filtering by brand, type, color, size, price without overwhelming users
5. **Mobile-First Commerce**: Most Brazilian shoppers browse on mobile

## Typography System

**Font Stack**: Inter (primary), system-ui (fallback)
- **Hero Headlines**: text-5xl to text-6xl, font-bold (48-60px)
- **Section Titles**: text-3xl to text-4xl, font-bold (30-36px)
- **Product Names**: text-xl, font-semibold (20px)
- **Product Prices**: text-2xl, font-bold for emphasis
- **Body Text**: text-base (16px), line-height relaxed
- **Filters/Labels**: text-sm, font-medium (14px)
- **Metadata**: text-xs, opacity-70 (12px)

## Layout System

**Spacing Units**: Tailwind 4, 6, 8, 12, 16, 24 (tight consistency)
- Container: max-w-7xl with px-4 md:px-6 lg:px-8
- Section Padding: py-12 md:py-16 lg:py-24
- Card Spacing: gap-6 md:gap-8 for product grids
- Component Spacing: space-y-4 for stacked elements

**Grid System**:
- Product Grid: grid-cols-2 md:grid-cols-3 lg:grid-cols-4
- Featured Categories: grid-cols-2 lg:grid-cols-4
- Product Detail: Two-column split (images | details)

## Component Library

### Navigation
- **Top Bar**: Promotional banner (Black Friday, shipping info)
- **Header**: Logo left, search center, cart/account right, sticky on scroll
- **Main Nav**: Horizontal mega-menu with categories, brands, and sports
- **Mobile**: Hamburger menu with slide-out drawer

### Homepage Sections
1. **Hero Carousel**: Full-width image slider with main promotions (h-[500px] md:h-[600px])
2. **Category Quick Access**: 4-column grid with large icons/images
3. **Featured Products**: "Lançamentos" and "Mais Vendidos" carousels
4. **Brand Showcase**: Grid of brand logos linking to filtered results
5. **Benefits Bar**: Free shipping, secure payment, Mercado Livre trust badges
6. **Newsletter**: Email capture with incentive

### Product Cards
- **Image**: Aspect-ratio-square with hover secondary image
- **Brand Badge**: Small logo overlay top-left
- **Heart Icon**: Wishlist toggle top-right
- **Product Name**: Two-line truncate
- **Price Display**: Large with old price strikethrough if discounted
- **Mercado Livre Badge**: Small "Via Mercado Livre" indicator
- **CTA**: "Ver no Mercado Livre" button (primary action)

### Product Detail Page
- **Image Gallery**: Large main image with thumbnail navigation
- **Product Info Panel**: Brand, name, price, size selector, CTA
- **Specifications**: Collapsible sections (Material, Tecnologia, Características)
- **Related Products**: "Você também pode gostar" carousel
- **Trust Elements**: Mercado Livre reputation score, shipping info

### Filters Sidebar
- **Category Checkboxes**: Tênis (Corrida, Casual, Futebol, etc.), Meias, Acessórios
- **Brand Checkboxes**: Nike, Adidas, Olympikus, etc.
- **Price Range**: Slider input
- **Size Selector**: Grid of size chips
- **Color Swatches**: Visual color selection
- **Active Filters**: Chips showing current filters with X to remove

### Footer
- **Categories**: Quick links to main product categories
- **About**: Info sobre afiliação, contact, FAQ
- **Social Links**: Instagram, Facebook, YouTube
- **Payment Methods**: Mercado Livre, credit cards accepted
- **Newsletter**: Repeat subscription option
- **Legal**: Privacy policy, terms of service

## Interaction Patterns

- **Product Hover**: Scale image slightly (scale-105), show secondary image
- **Add to Wishlist**: Heart fills with smooth transition
- **Filter Apply**: Instant results update without page reload
- **Search**: Autocomplete dropdown with product suggestions
- **Scroll**: Sticky header shrinks, back-to-top button appears
- **Loading**: Skeleton screens for product grids during API fetch

## Images

**Hero Section**: Large banner image featuring athletic lifestyle (person tying running shoes, action sports shot, or product showcase). Size: 1920x600px minimum. Blurred background for text overlay.

**Category Cards**: High-quality product photography on clean white background showing different shoe types. Size: 600x600px per card.

**Product Images**: Multiple angles (lateral, top, sole, detail shots). Minimum 800x800px, zoom capability on hover/click.

**Brand Logos**: Vector SVGs of partner brands for crisp rendering at any size.

**Trust Badges**: Mercado Livre logo, secure payment icons, shipping badges.

## Special Considerations

**Affiliate Transparency**: Clear "Parceiro Mercado Livre" messaging, prices update from API in real-time, external link icon on CTAs.

**AI Product Classification**: Visual tags showing AI-detected attributes (Corrida, Casual, etc.) with subtle badge design.

**Performance**: Lazy-load images below fold, optimize product grids for fast scrolling, cache API responses.

**Localization**: Brazilian Portuguese throughout, BRL currency format (R$ 299,90), Brazilian sizing standards.

**Accessibility**: Alt text for all product images, keyboard navigation for filters, ARIA labels for interactive elements, sufficient contrast ratios.