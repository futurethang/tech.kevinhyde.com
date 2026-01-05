# Chompie's December Calendar

A digital advent calendar featuring Chompie the December Gnome. Visit every day in December to discover a festive poem and reveal a special treat!

## Features

- **25 Days of Magic**: Each day from December 1-25 has unique content
- **Daily Poems**: Original festive poems from Chompie
- **Hidden Treats**: Click to reveal daily surprises
- **Date-Locked Content**: In production mode, only current/past days are accessible
- **Test Mode**: Toggle to preview all days during development
- **Progress Tracking**: Remembers which days you've opened
- **Responsive Design**: Works on desktop and mobile
- **Festive Theme**: Snowfall animation, warm colors, holiday atmosphere

## Usage

### Test Mode

Add `?test=true` to the URL or toggle the switch in the header to unlock all days for preview.

### Production Mode

Users can only access days that have passed. Day 5 is accessible on December 5th, etc.

---

## Monetization Opportunities

This calendar is designed with sponsorship and advertising in mind. Here are the monetization strategies:

### 1. Daily Sponsor Slots

Each day's "treat" can feature a paying sponsor. The data structure supports:

```javascript
treat: {
  icon: '☕',
  title: 'Special Coffee Discount',
  description: 'A warm cup of holiday cheer!',
  type: 'coupon', // 'free' | 'coupon' | 'product' | 'experience'
  content: 'Use code CHOMPIE15 for 15% off!',
  sponsor: {
    name: 'Local Coffee Shop',
    url: 'https://sponsor-site.com',
    tagline: 'Proudly supporting Chompie',
    tier: 'premium', // 'standard' | 'premium' | 'featured'
  },
}
```

**Pricing Tiers:**

| Tier | Price Range | Features |
|------|-------------|----------|
| Standard | $50-100 | Logo, link, brief mention |
| Premium | $150-300 | Full treat takeover, coupon code, extended description |
| Featured | $400-750 | Premium + social media promotion, highlighted door |

**Premium Days:**
- Day 1 (Opening Day): 2x price
- Day 24 (Christmas Eve): 2x price
- Day 25 (Christmas Day): 3x price
- Weekends: 1.5x price

### 2. Coupon/Discount Partnerships

Partner with local businesses or e-commerce sites to offer exclusive discount codes:

- **Local Businesses**: Coffee shops, bakeries, restaurants, boutiques
- **E-commerce**: Holiday gift retailers, subscription boxes
- **Services**: Streaming services, apps, online courses
- **Experiences**: Local attractions, escape rooms, classes

**Revenue Model:**
- Flat fee per day featured
- Affiliate commission on code redemptions
- Hybrid: smaller flat fee + commission

### 3. Branded Advent Calendars

Offer white-label versions for businesses:

- Company branding instead of Chompie
- Custom poems/content
- Internal employee engagement tool
- Customer loyalty program

**Pricing:**
- Basic customization: $500-1,000
- Full branding + custom content: $2,000-5,000
- Enterprise (multiple calendars): Custom pricing

### 4. Premium Content Upgrades

Offer enhanced experiences:

- **Illustrated Days**: Commission real Chompie illustrations ($25-50/day add-on)
- **Audio Poems**: Narrated poems with holiday music
- **Interactive Games**: Mini-games behind certain doors
- **Printable Activities**: Coloring pages, recipes, crafts

### 5. Merchandise Integration

Link treats to purchasable items:

- Chompie plush toys
- Holiday cards featuring Chompie
- Recipe books
- Ornaments

### 6. Email List Building

Capture emails for:

- "Unlock tomorrow's door early" signup incentive
- Annual Chompie newsletter
- Sponsor communications (with consent)
- Early access to next year's calendar

### 7. Sponsorship Package Example

**"Chompie's Friends" Package - $1,500**

Includes:
- 3 sponsored days (your choice of dates)
- Logo on footer all month
- Social media shoutout (3 posts)
- Email mention to subscriber list
- "Presented by" credit on homepage

---

## Technical Implementation Notes

### Adding a Sponsor

1. Open `data.js`
2. Find the day you want to sponsor
3. Update the `treat` object with sponsor details:

```javascript
{
  day: 11,
  poem: `...`,
  treat: {
    icon: '☕',
    title: 'Free Coffee!',
    description: 'Your local cafe is treating you!',
    type: 'coupon',
    content: 'Show this screen for a free small coffee!',
    sponsor: {
      name: 'Sunrise Coffee Co.',
      url: 'https://sunrisecoffee.example.com',
      tagline: 'Fueling your December mornings',
      tier: 'premium',
    },
  },
},
```

### Tracking & Analytics

Consider adding:

- Google Analytics events for door opens
- Coupon code redemption tracking
- Sponsor link click tracking
- Heatmap of popular days

### Future Enhancements

- [ ] Admin panel for sponsor management
- [ ] Analytics dashboard
- [ ] Automated sponsor billing
- [ ] A/B testing for treat formats
- [ ] Push notifications for daily reminders
- [ ] Social sharing for each day
- [ ] Leaderboard for streak tracking

---

## File Structure

```
chompie-advent/
├── index.html      # Main HTML
├── styles.css      # All styling
├── script.js       # Interaction logic
├── data.js         # Content for all 25 days
├── manifest.json   # PWA manifest
├── icon-192.svg    # App icon
├── icon-512.svg    # App icon (large)
└── README.md       # This file
```

## Development

This is a static app - no build step required. Just open `index.html` in a browser.

For testing:
1. Enable test mode via toggle or `?test=true` URL parameter
2. All 25 doors will be unlocked
3. Click any door to preview content

## Credits

Created by Kevin Hyde
Chompie the December Gnome - a festive creation for spreading holiday joy!
