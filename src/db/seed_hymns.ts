import { Hymn } from '../types.ts';

const CLASSIC_HYMNS = [
  {
    hymnNumber: 1,
    title: 'Amazing Grace',
    lyrics: `Verse 1:
Amazing grace! How sweet the sound
That saved a wretch like me!
I once was lost, but now am found;
Was blind, but now I see.

Verse 2:
'Twas grace that taught my heart to fear,
And grace my fears relieved;
How precious did that grace appear
The hour I first believed!

Verse 3:
Through many dangers, toils and snares,
I have already come;
'Tis grace hath brought me safe thus far,
And grace will lead me home.

Verse 4:
The Lord has promised good to me,
His Word my hope secures;
He will my Shield and Portion be,
As long as life endures.`,
    chorus: 'My chains are gone, I\'ve been set free! My Savior, Ransom, has ransomed me! And like a flood, His mercy reigns, unending love, amazing grace!',
    category: 'Grace & Mercy',
    language: 'English'
  },
  {
    hymnNumber: 2,
    title: 'How Great Thou Art',
    lyrics: `Verse 1:
O Lord my God, when I in awesome wonder
Consider all the worlds Thy hands have made,
I see the stars, I hear the rolling thunder,
Thy power throughout the universe displayed.

Verse 2:
And when I think that God, His Son not sparing,
Sent Him to die, I scarce can take it in;
That on the cross, my burden gladly bearing,
He bled and died to take away my sin.

Verse 3:
When Christ shall come with shout of acclamation
And take me home, what joy shall fill my heart!
Then I shall bow in humble adoration,
And there proclaim, "My God, how great Thou art!"`,
    chorus: 'Then sings my soul, my Savior God, to Thee: How great Thou art! How great Thou art! Then sings my soul, my Savior God, to Thee: How great Thou art! How great Thou art!',
    category: 'Praise & Worship',
    language: 'English'
  },
  {
    hymnNumber: 3,
    title: 'It Is Well With My Soul',
    lyrics: `Verse 1:
When peace like a river attendeth my way,
When sorrows like sea billows roll;
Whatever my lot, Thou hast taught me to say,
It is well, it is well with my soul.

Verse 2:
Though Satan should buffet, though trials should come,
Let this blest assurance control,
That Christ has regarded my helpless estate,
And has shed His own blood for my soul.

Verse 3:
My sin—oh, the bliss of this glorious thought!—
My sin, not in part, but the whole,
Is nailed to the cross, and I bear it no more,
Praise the Lord, praise the Lord, O my soul!`,
    chorus: 'It is well (it is well), with my soul (with my soul), It is well, it is well with my soul.',
    category: 'Peace & Comfort',
    language: 'English'
  },
  {
    hymnNumber: 4,
    title: 'Holy, Holy, Holy',
    lyrics: `Verse 1:
Holy, holy, holy! Lord God Almighty!
Early in the morning our song shall rise to Thee;
Holy, holy, holy, merciful and mighty!
God in three Persons, blessed Trinity!

Verse 2:
Holy, holy, holy! All the saints adore Thee,
Casting down their golden crowns around the glassy sea;
Cherubim and seraphim falling down before Thee,
Who wert, and art, and evermore shalt be.

Verse 3:
Holy, holy, holy! Lord God Almighty!
All Thy works shall praise Thy name in earth, and sky, and sea;
Holy, holy, holy, merciful and mighty!
God in three Persons, blessed Trinity!`,
    chorus: '',
    category: 'Adoration',
    language: 'English'
  },
  {
    hymnNumber: 5,
    title: 'Blessed Assurance',
    lyrics: `Verse 1:
Blessed assurance, Jesus is mine!
Oh, what a foretaste of glory divine!
Heir of salvation, purchase of God,
Born of His Spirit, washed in His blood.

Verse 2:
Perfect submission, perfect delight,
Visions of rapture now burst on my sight;
Angels descending, bring from above
Echoes of mercy, whispers of love.

Verse 3:
Perfect submission, all is at rest,
I in my Savior am happy and blest;
Watching and waiting, looking above,
Filled with His goodness, lost in His love.`,
    chorus: 'This is my story, this is my song, Praising my Savior all the day long; This is my story, this is my song, Praising my Savior all the day long.',
    category: 'Assurance & Trust',
    language: 'English'
  }
];

const CATEGORIES = [
  'Praise & Worship',
  'Grace & Mercy',
  'Peace & Comfort',
  'Adoration',
  'Assurance & Trust',
  'Salvation',
  'Faithfulness',
  'Prayer & Fellowship',
  'Consecration & Commitment',
  'Hope & Resurrection'
];

const NOUNS = [
  'Zion', 'Grace', 'Faith', 'Love', 'Peace', 'Joy', 'Hope', 'Salvation', 'Covenant', 'Mercy',
  'Glory', 'Cross', 'Shepherd', 'Rock', 'Fortress', 'Haven', 'Light', 'Wisdom', 'Spirit', 'Truth'
];

const ADJECTIVES = [
  'Everlasting', 'Glorious', 'Faithful', 'Blessed', 'Heavenly', 'Divine', 'Amazing', 'Eternal',
  'Infinite', 'Holy', 'True', 'Royal', 'Victorious', 'Gentle', 'Mighty', 'Radiant', 'Sacred', 'Gracious'
];

const VERBS = [
  'Praise', 'Sing', 'Exalt', 'Rejoice', 'Abide', 'Trust', 'Follow', 'Lead', 'Shine', 'Bless',
  'Seek', 'Proclaim', 'Honor', 'Glorify', 'Worship', 'Adore', 'Walk', 'Cling', 'Stand', 'Rest'
];

export function generateSeedHymns(): Omit<Hymn, 'id' | 'createdAt' | 'updatedAt'>[] {
  const hymns: Omit<Hymn, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  // 1. Add classic hymns
  for (const classic of CLASSIC_HYMNS) {
    hymns.push({
      hymnNumber: classic.hymnNumber,
      title: classic.title,
      lyrics: classic.lyrics,
      chorus: classic.chorus || undefined,
      category: classic.category,
      language: classic.language
    });
  }

  // 2. Programmatically generate up to 2000 hymns
  const now = new Date();
  for (let num = CLASSIC_HYMNS.length + 1; num <= 2000; num++) {
    const adj = ADJECTIVES[num % ADJECTIVES.length];
    const noun = NOUNS[(num * 3) % NOUNS.length];
    const verb = VERBS[(num * 7) % VERBS.length];
    const category = CATEGORIES[num % CATEGORIES.length];

    let title = '';
    const pattern = num % 3;
    if (pattern === 0) {
      title = `The ${adj} ${noun}`;
    } else if (pattern === 1) {
      title = `${verb} of ${noun}`;
    } else {
      title = `${adj} ${noun} of Praise`;
    }

    const lyrics = `Verse 1:
We gather together to ${verb.toLowerCase()} Thy name,
O Lord of all glory, forever the same.
Through ${noun.toLowerCase()} and through mercy, Thy hand leads us still,
To walk in Thy path and to follow Thy will.

Verse 2:
Thy ${adj.toLowerCase()} presence is always our light,
A comfort in sorrow, a shield in the night.
We trust in Thy covenant, faithful and true,
Each morning Thy mercies are made fresh and new.

Verse 3:
With hearts full of gladness, our voices we raise,
To offer Thee honor, thanksgiving, and praise.
Guide our steps, Lord, as we journey in faith,
Secure in Thy love and sustained by Thy grace.`;

    const chorus = `O ${verb} the Lord, our strong Fortress and King!
Let all of creation His praises now sing!
His ${noun} and His love will forever endure,
His Word is our anchor, established and sure.`;

    hymns.push({
      hymnNumber: num,
      title,
      lyrics,
      chorus,
      category,
      language: num % 100 === 0 ? 'Latin' : (num % 50 === 0 ? 'Spanish' : 'English')
    });
  }

  return hymns;
}
