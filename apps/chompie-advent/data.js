/**
 * Chompie's December Calendar - Content Data
 *
 * Each day includes:
 * - chompieEmoji: Visual representation of Chompie (placeholder for future illustrations)
 * - poem: A festive poem from Chompie
 * - treat: The daily treat/prize with optional sponsor info
 *
 * MONETIZATION STRUCTURE:
 * - sponsor: Object containing sponsor details (name, url, logo)
 * - treatType: 'free' | 'coupon' | 'product' | 'experience'
 * - sponsorTier: 'standard' | 'premium' | 'featured'
 */

const CHOMPIE_DATA = {
  // Calendar configuration
  config: {
    year: 2025, // Update yearly
    totalDays: 25,
    startDay: 1,
    timezone: 'America/New_York', // Adjust for your audience
  },

  // Chompie character variations for each day
  chompieVariations: [
    '🎅', // 1 - Classic
    '🧙', // 2 - Wizard
    '⛷️', // 3 - Skiing
    '🎿', // 4 - More skiing
    '☕', // 5 - Hot cocoa
    '🎁', // 6 - Gift giving
    '🌟', // 7 - Star gazing
    '🎄', // 8 - Tree decorating
    '🍪', // 9 - Cookie baking
    '🛷', // 10 - Sledding
    '⛄', // 11 - Snowman building
    '🎶', // 12 - Caroling
    '🕯️', // 13 - Candlelight
    '📚', // 14 - Story time
    '🧣', // 15 - Cozy
    '🎨', // 16 - Crafting
    '🦌', // 17 - Reindeer friend
    '🏔️', // 18 - Mountain adventure
    '🎭', // 19 - Performance
    '🧁', // 20 - Baking treats
    '✨', // 21 - Magic
    '🎺', // 22 - Music
    '🕊️', // 23 - Peace
    '🌙', // 24 - Christmas Eve
    '🎉', // 25 - Christmas Day
  ],

  // Daily content
  days: [
    // Day 1
    {
      day: 1,
      poem: `Welcome, friend, to December's start,
I'm Chompie the gnome, here to warm your heart!
Each day I'll bring a little surprise,
A poem, a treat, to light up your eyes.`,
      treat: {
        icon: '🍫',
        title: 'Hot Chocolate Recipe',
        description: 'A secret gnome recipe for the coziest hot cocoa you\'ve ever tasted!',
        type: 'free',
        content: 'Mix 2 tbsp cocoa, 2 tbsp sugar, pinch of cinnamon, dash of vanilla, warm milk. Stir with joy!',
        sponsor: null,
      },
    },
    // Day 2
    {
      day: 2,
      poem: `The frost paints windows with crystal art,
While I sit here, doing my part,
Crafting joy for you each day,
In my own little gnomish way.`,
      treat: {
        icon: '🎵',
        title: 'Cozy Playlist',
        description: 'A curated playlist of winter warmth songs to set the mood.',
        type: 'free',
        content: 'Search "Chompie Cozy December" on your favorite music app!',
        sponsor: null,
      },
    },
    // Day 3
    {
      day: 3,
      poem: `Three days in, the magic grows,
Like powdered sugar on my nose,
From baking cookies, sweet and round,
The tastiest treats that can be found!`,
      treat: {
        icon: '🍪',
        title: 'Sugar Cookie Recipe',
        description: 'Chompie\'s favorite sugar cookie recipe, perfect for decorating!',
        type: 'free',
        content: 'Classic sugar cookies with a hint of almond extract - the gnome\'s secret!',
        sponsor: null,
      },
    },
    // Day 4
    {
      day: 4,
      poem: `Four candles flicker in the night,
Each one spreading gentle light,
I watch them dance from my cozy nook,
While reading from my favorite book.`,
      treat: {
        icon: '📖',
        title: 'Winter Reading Recommendation',
        description: 'A magical story to read by candlelight.',
        type: 'free',
        content: 'Try "A Christmas Carol" by Charles Dickens - a gnome classic!',
        sponsor: null,
      },
    },
    // Day 5
    {
      day: 5,
      poem: `Halfway through the first week now,
I tip my pointed hat and bow,
To thank you for visiting me,
Your friendly gnome, so full of glee!`,
      treat: {
        icon: '🧦',
        title: 'Cozy Sock Reminder',
        description: 'A gentle reminder that warm socks make everything better.',
        type: 'free',
        content: 'Put on your coziest socks today - gnome\'s orders!',
        sponsor: null,
      },
    },
    // Day 6
    {
      day: 6,
      poem: `Today I ventured through the snow,
Where winter winds so softly blow,
I found a pinecone, big and round,
The perfect treasure to be found!`,
      treat: {
        icon: '🌲',
        title: 'Nature Craft Idea',
        description: 'Turn pinecones into festive decorations!',
        type: 'free',
        content: 'Collect pinecones, add glitter and ribbon for instant holiday magic!',
        sponsor: null,
      },
    },
    // Day 7
    {
      day: 7,
      poem: `A week of December has passed us by,
Like snowflakes drifting from the sky,
But there's still so much joy ahead,
So many poems yet unsaid!`,
      treat: {
        icon: '❄️',
        title: 'Paper Snowflake Template',
        description: 'Create your own unique paper snowflakes!',
        type: 'free',
        content: 'Fold, cut, unfold - every snowflake is unique, just like you!',
        sponsor: null,
      },
    },
    // Day 8
    {
      day: 8,
      poem: `Eight tiny reindeer? That's quite a sight!
But gnomes prefer to walk at night,
Through moonlit paths and frozen streams,
Collecting wishes, hopes, and dreams.`,
      treat: {
        icon: '🌙',
        title: 'Evening Walk Challenge',
        description: 'Take a peaceful evening walk and spot the stars.',
        type: 'free',
        content: 'Bundle up and take a 10-minute walk tonight. Count the stars!',
        sponsor: null,
      },
    },
    // Day 9
    {
      day: 9,
      poem: `My workshop's busy, can't you tell?
I'm preparing treats and doing well,
Each gift wrapped with love and care,
A gnome's devotion beyond compare!`,
      treat: {
        icon: '🎀',
        title: 'Gift Wrapping Tip',
        description: 'A creative way to wrap presents like a gnome!',
        type: 'free',
        content: 'Use brown paper, twine, and a sprig of evergreen for rustic charm!',
        sponsor: null,
      },
    },
    // Day 10
    {
      day: 10,
      poem: `Ten days in, we're on a roll,
Winter's magic feeds the soul,
Come gather 'round my little fire,
Let your spirits lift up higher!`,
      treat: {
        icon: '🔥',
        title: 'Fireplace Ambiance Video',
        description: 'A cozy fireplace to warm your screen and soul.',
        type: 'free',
        content: 'Search for "crackling fireplace" on YouTube - instant coziness!',
        sponsor: null,
      },
    },
    // Day 11 - SPONSORED EXAMPLE
    {
      day: 11,
      poem: `Eleven is a lucky number, so they say,
Perfect for a special treat today!
My gnome friends gathered far and wide,
To bring you something with great pride.`,
      treat: {
        icon: '☕',
        title: 'Special Coffee Discount',
        description: 'A warm cup of holiday cheer, courtesy of our friends!',
        type: 'coupon',
        content: 'Use code CHOMPIE15 for 15% off your next coffee order!',
        sponsor: {
          name: 'Your Local Coffee Shop',
          url: 'https://example.com',
          tagline: 'Proudly supporting Chompie\'s December Calendar',
          tier: 'premium',
        },
      },
    },
    // Day 12
    {
      day: 12,
      poem: `Twelve days of December, halfway there,
The world is wrapped in frosty air,
But in my heart, the warmth persists,
Like checking items off my list!`,
      treat: {
        icon: '✅',
        title: 'Holiday Checklist',
        description: 'A printable checklist for holiday preparations.',
        type: 'free',
        content: 'Cards, gifts, baking, decorating - don\'t forget anything!',
        sponsor: null,
      },
    },
    // Day 13
    {
      day: 13,
      poem: `Lucky thirteen, some might fear,
But gnomes find joy throughout the year,
No superstitions here, I say,
Just more magic coming your way!`,
      treat: {
        icon: '🍀',
        title: 'Good Luck Charm',
        description: 'A virtual good luck charm from Chompie!',
        type: 'free',
        content: 'You\'re carrying extra luck today - use it wisely!',
        sponsor: null,
      },
    },
    // Day 14
    {
      day: 14,
      poem: `Two weeks in, the time flies fast,
Making memories meant to last,
So pause a moment, take it in,
Let gratitude rise from within.`,
      treat: {
        icon: '💝',
        title: 'Gratitude Prompt',
        description: 'Take a moment to appreciate the little things.',
        type: 'free',
        content: 'Write down three things you\'re grateful for today.',
        sponsor: null,
      },
    },
    // Day 15
    {
      day: 15,
      poem: `The month is halfway done, it's true,
But there's still so much left to do!
More poems to share, more treats to give,
More reasons to laugh, love, and live.`,
      treat: {
        icon: '😄',
        title: 'Joke of the Day',
        description: 'A gnome-approved winter joke!',
        type: 'free',
        content: 'Why was the snowman looking through carrots? He was picking his nose!',
        sponsor: null,
      },
    },
    // Day 16
    {
      day: 16,
      poem: `Sixteen snowballs in a row,
Watch out world, here I throw!
Just kidding, friend, I'd never aim,
A snowball fight is just a game!`,
      treat: {
        icon: '⛄',
        title: 'Snowman Building Tips',
        description: 'The gnome\'s guide to the perfect snowman.',
        type: 'free',
        content: 'Pack the snow tight, use coal for eyes, and don\'t forget the carrot nose!',
        sponsor: null,
      },
    },
    // Day 17
    {
      day: 17,
      poem: `Just over a week until the big day,
When joy and wonder come out to play,
I'm counting down with glee and cheer,
The best part of December is here!`,
      treat: {
        icon: '🗓️',
        title: 'Countdown Calendar',
        description: 'A printable countdown to Christmas!',
        type: 'free',
        content: 'Mark off each day until the 25th with festive stickers!',
        sponsor: null,
      },
    },
    // Day 18
    {
      day: 18,
      poem: `Eighteen candles on a winter night,
Each one glowing warm and bright,
They remind me of the hope we share,
And all the love that fills the air.`,
      treat: {
        icon: '🕯️',
        title: 'Candlelight Meditation',
        description: 'A moment of peace and reflection.',
        type: 'free',
        content: 'Light a candle, breathe deeply, and find your calm.',
        sponsor: null,
      },
    },
    // Day 19
    {
      day: 19,
      poem: `The week before Christmas has begun,
A time for family, friends, and fun,
My gnome heart swells with pure delight,
Everything feels magical and right!`,
      treat: {
        icon: '👨‍👩‍👧‍👦',
        title: 'Family Activity Idea',
        description: 'A fun activity to do with loved ones.',
        type: 'free',
        content: 'Have a holiday movie marathon with hot cocoa and popcorn!',
        sponsor: null,
      },
    },
    // Day 20 - SPONSORED EXAMPLE
    {
      day: 20,
      poem: `Twenty days of December magic,
If this ended soon, it would be tragic!
But fear not, friend, more joy's in store,
Just five more days of treats galore!`,
      treat: {
        icon: '🎁',
        title: 'Special Gift Deal',
        description: 'A last-minute gift idea with a special discount!',
        type: 'coupon',
        content: 'Get 20% off with code GNOME20 at checkout!',
        sponsor: {
          name: 'Gift Shop Partner',
          url: 'https://example.com',
          tagline: 'Making gift-giving magical',
          tier: 'featured',
        },
      },
    },
    // Day 21
    {
      day: 21,
      poem: `Winter solstice, longest night,
But stars above shine extra bright,
From darkness springs the return of light,
A gnome's favorite seasonal sight!`,
      treat: {
        icon: '✨',
        title: 'Solstice Celebration',
        description: 'Honor the longest night of the year.',
        type: 'free',
        content: 'Stay up a little later tonight and welcome back the light!',
        sponsor: null,
      },
    },
    // Day 22
    {
      day: 22,
      poem: `Three days left until Christmas morn,
When joy and wonder are reborn,
I'm putting finishing touches here,
On all the magic of the year.`,
      treat: {
        icon: '🎶',
        title: 'Carol Sing-Along',
        description: 'Lyrics to classic holiday songs.',
        type: 'free',
        content: 'Gather round and sing your favorite carols tonight!',
        sponsor: null,
      },
    },
    // Day 23
    {
      day: 23,
      poem: `The anticipation fills the air,
Holiday magic everywhere,
Two more sleeps, as children say,
'Til we reach that special day!`,
      treat: {
        icon: '🛏️',
        title: 'Sweet Dreams Wish',
        description: 'A blessing for peaceful, dream-filled sleep.',
        type: 'free',
        content: 'May sugarplums dance in your head tonight!',
        sponsor: null,
      },
    },
    // Day 24
    {
      day: 24,
      poem: `Christmas Eve, the night is here,
The most magical night of the year,
Stockings hung and cookies set,
The best is still to come, I bet!`,
      treat: {
        icon: '🌟',
        title: 'Christmas Eve Blessing',
        description: 'A special blessing for this magical night.',
        type: 'free',
        content: 'May your Christmas Eve be filled with wonder, warmth, and love.',
        sponsor: null,
      },
    },
    // Day 25
    {
      day: 25,
      poem: `Merry Christmas! The day has come,
A time of joy for everyone,
Thank you for joining me this year,
You've filled my gnome heart with such cheer!

Until next December, fare thee well,
May your year be more magic than I can tell,
Remember Chompie whenever you need,
A friend who cares, a heart that leads.`,
      treat: {
        icon: '🎄',
        title: 'Christmas Blessing',
        description: 'Chompie\'s gift to you on this special day.',
        type: 'free',
        content: 'You are loved. You are valued. Merry Christmas from Chompie the December Gnome!',
        sponsor: null,
      },
    },
  ],
};

// Export for use in script.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CHOMPIE_DATA;
}
