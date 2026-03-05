const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('/tmp/ml_ofertas_full.html', 'utf8');
const $ = cheerio.load(html);

const cards = $('div.poly-card--grid-card');
console.log('Cards found:', cards.length);

if (cards.length > 0) {
  const first = $(cards[0]);
  const link = first.find('a').first().attr('href');
  console.log('Link:', link ? link.substring(0, 150) : 'none');
  
  const title = first.find('[class*="poly-component__title"]').text().trim();
  console.log('Title:', title.substring(0, 80));
  
  const img = first.find('img').first().attr('src') || first.find('img').first().attr('data-src');
  console.log('Image:', img ? img.substring(0, 100) : 'none');
  
  const fractions = first.find('[class*="andes-money-amount__fraction"]');
  console.log('Price fractions count:', fractions.length);
  fractions.each((i, el) => console.log('  fraction', i, ':', $(el).text().trim()));
  
  const discount = first.find('[class*="andes-money-amount__discount"]').text().trim();
  console.log('Discount:', discount);
  
  const brand = first.find('[class*="poly-component__brand"]').text().trim();
  console.log('Brand:', brand);
  
  const reviews = first.find('[class*="poly-reviews"]').text().trim();
  console.log('Reviews:', reviews);
  
  // Check all classes used in first card
  const classes = new Set();
  first.find('[class]').each((i, el) => {
    $(el).attr('class').split(' ').filter(c => c.includes('poly-')).forEach(c => classes.add(c));
  });
  console.log('\nPoly classes in card:', [...classes].join(', '));
}
