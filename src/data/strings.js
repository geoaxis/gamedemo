// Every piece of text in the game, Urdu first with its English subtitle.
// Edit the Urdu here; nothing else needs to change.

const t = (ur, en) => ({ ur, en });

export const AREA_NAMES = {
  home: t('اپنا گھر', 'Home'),
  mosque: t('جامع مسجد', 'The Village Mosque'),
  chowk: t('چوک — بوڑھ کا درخت', 'The Square and the Old Banyan'),
  adda: t('اڈا', 'Bus Stop and Shops'),
  pond: t('چھپڑ', 'The Village Pond'),
  tubewell: t('ٹیوب ویل', 'The Tube Well'),
  kiln: t('اینٹوں کا بھٹہ', 'The Brick Kiln'),
  canal: t('نہر', 'The Canal'),
  road: t('پکی سڑک', 'The Paved Road'),
  village: t('چک نمبر ۴۷', 'Chak No. 47'),
  fields: t('کھیت', 'The Fields'),
};

export const PROMPTS = {
  talk: t('بات کریں', 'Talk'),
  mount: t('ٹریکٹر پر بیٹھیں', 'Get on the tractor'),
  dismount: t('ٹریکٹر سے اتریں', 'Get off the tractor'),
  twOn: t('ٹیوب ویل چلائیں', 'Start the tube well'),
  twOff: t('ٹیوب ویل بند کریں', 'Stop the tube well'),
  sit: t('چارپائی پر بیٹھیں', 'Sit on the charpai'),
  stand: t('اٹھیں', 'Get up'),
  chai: t('چائے پئیں', 'Have a cup of tea'),
  pet: t('پیار کریں', 'Pet'),
  pump: t('نلکا چلائیں', 'Work the hand pump'),
  bell: t('سائیکل کی گھنٹی بجائیں', 'Ring the bicycle bell'),
};

export const TOASTS = {
  chai: t('واہ! کڑک دودھ پتی۔', 'Ah! Strong, milky tea.'),
  pump: t('ٹھنڈا میٹھا پانی!', 'Cool, sweet water!'),
  twOn: t('ٹیوب ویل چل پڑا۔', 'The tube well is running.'),
  twOff: t('ٹیوب ویل بند ہو گیا۔', 'The tube well has stopped.'),
  sit: t('ذرا دم لے لیں۔', 'A moment of rest.'),
  canalBlock: t('نہر گہری ہے، پل سے جائیں۔', 'The canal is deep. Use the bridge.'),
  subsOn: t('انگریزی ترجمہ: آن', 'English subtitles: on'),
  subsOff: t('انگریزی ترجمہ: بند', 'English subtitles: off'),
  muted: t('آواز بند', 'Sound off'),
  unmuted: t('آواز کھل گئی', 'Sound on'),
};

export const ANIMAL_NAMES = {
  buffalo: t('بھینس', 'buffalo'),
  cow: t('گائے', 'cow'),
  goat: t('بکری', 'goat'),
  sheep: t('بھیڑ', 'sheep'),
  donkey: t('گدھا', 'donkey'),
  dog: t('کتا', 'dog'),
};
export const petToast = (kind) => {
  const a = ANIMAL_NAMES[kind];
  return t(`${a.ur} کو پیار کیا۔`, `You patted the ${a.en}.`);
};

export const CLOCK = {
  fajr: t('فجر', 'Dawn'),
  morning: t('صبح', 'Morning'),
  noon: t('دوپہر', 'Midday'),
  afternoon: t('سہ پہر', 'Afternoon'),
  evening: t('شام', 'Evening'),
  night: t('رات', 'Night'),
};

export const NPCS = {
  bashir: {
    name: t('چاچا بشیر', 'Uncle Bashir'),
    lines: [
      t('السلام علیکم پتر! آؤ بیٹھو، حقہ تازہ ہے۔', 'Peace be upon you, son! Come, sit. The hookah is fresh.'),
      t('اس سال گندم بہت اچھی ہے، اللہ کا شکر ہے۔', 'The wheat is very good this year, thanks be to God.'),
      t('شہر میں کیا رکھا ہے؟ اصل سکون تو گاؤں میں ہے۔', 'What is there in the city? Real peace is here in the village.'),
    ],
  },
  aslam: {
    name: t('چوہدری اسلم', 'Chaudhry Aslam'),
    lines: [
      t('آج ہماری پانی کی باری ہے۔ ٹیوب ویل چلا دو، کھیت کو پانی لگانا ہے۔', 'Today is our turn for water. Start the tube well, the field needs watering.'),
      t('سرسوں دیکھی ہے؟ پورا کھیت پیلا ہو گیا ہے۔', 'Have you seen the mustard? The whole field has turned yellow.'),
      t('ٹریکٹر لے جاؤ، بس دھیان سے چلانا۔', 'Take the tractor, just drive it carefully.'),
    ],
  },
  haji: {
    name: t('حاجی صاحب', 'Haji Sahib'),
    lines: [
      t('آؤ جی آؤ! کیا چاہیے؟ چینی، پتی، دال، سب کچھ ملے گا۔', 'Come in, come in! What do you need? Sugar, tea, lentils, we have it all.'),
      t('ادھار کا نہ پوچھنا، باقی جو مرضی لے لو!', 'Just don’t ask for credit. Anything else, take what you like!'),
      t('ابا جی کا کیا حال ہے؟ میرا سلام کہنا۔', 'How is your father? Give him my regards.'),
    ],
  },
  billu: {
    name: t('بِلّو چائے والا', 'Billu the Tea Seller'),
    lines: [
      t('گرما گرم دودھ پتی! ایک کپ ہو جائے؟', 'Piping hot milk tea! How about a cup?'),
      t('بس آنے میں ابھی دیر ہے، آرام سے بیٹھو۔', 'The bus won’t be here for a while yet. Sit down, take it easy.'),
    ],
  },
  sughran: {
    name: t('ماسی صغراں', 'Aunty Sughran'),
    lines: [
      t('روٹیاں ابھی گرم ہیں، اپنی اماں کے لیے لے جاؤ۔', 'The rotis are still hot. Take some for your mother.'),
      t('پتر، اماں کو میرا سلام کہنا۔', 'Son, give your mother my regards.'),
    ],
  },
  nasreen: {
    name: t('باجی نسرین', 'Sister Nasreen'),
    lines: [
      t('نلکے کا پانی بڑا ٹھنڈا اور میٹھا ہے، پی کر دیکھو۔', 'The pump water is so cool and sweet. Try some.'),
      t('گھڑا بھر لوں تو گھر جاؤں۔', 'Once my pot is full, I’ll head home.'),
    ],
  },
  kids: {
    name: t('بچے', 'The Children'),
    lines: [
      t('بھائی جان! ذرا گیند پکڑانا!', 'Big brother! Pass us the ball!'),
      t('آؤٹ ہے! آؤٹ ہے!', 'He’s out! He’s out!'),
      t('بھائی، آپ بھی کھیلو نا ہمارے ساتھ!', 'Brother, come and play with us!'),
    ],
  },
  imam: {
    name: t('مولوی صاحب', 'The Imam'),
    lines: [
      t('وعلیکم السلام بیٹا۔ نماز کا وقت ہونے والا ہے، آ جانا۔', 'And peace upon you, son. It is nearly time for prayer, do come.'),
      t('جیتے رہو، اللہ خوش رکھے۔', 'Long life to you. May God keep you happy.'),
    ],
  },
  jeeda: {
    name: t('جیدا', 'Jeeda'),
    lines: [
      t('میری بکریاں سارا دن نہر کے کنارے چرتی ہیں۔', 'My goats graze by the canal all day.'),
      t('وہ کالی والی بہت شرارتی ہے، ہر وقت بھاگ جاتی ہے!', 'That black one is so naughty, she runs off all the time!'),
    ],
  },
  musafir: {
    name: t('مسافر', 'Traveller'),
    lines: [
      t('لاہور کی بس کب آئے گی؟ ایک گھنٹے سے کھڑا ہوں۔', 'When will the Lahore bus come? I have been standing here for an hour.'),
      t('یہاں تو بس اللہ کے آسرے پر چلتی ہے!', 'Around here the bus runs on faith alone!'),
    ],
  },
  ammi: {
    name: t('امی', 'Mother'),
    lines: [
      t('آ گیا میرا بیٹا؟ ہاتھ منہ دھو لو، روٹی تیار ہے۔', 'Is that my son back? Wash your hands and face, the food is ready.'),
      t('سارا دن کہاں گھومتے رہتے ہو؟', 'Where do you wander off to all day?'),
      t('شام سے پہلے بھینس کو چارا ڈال دینا۔', 'Put out fodder for the buffalo before evening.'),
    ],
  },
  rahi: {
    name: t('راہ گیر', 'Passer-by'),
    lines: [
      t('السلام علیکم! خیر خیریت ہے؟', 'Peace be upon you! All well?'),
      t('آج دھوپ بڑی اچھی نکلی ہے۔', 'Lovely sunshine today.'),
      t('اللہ حافظ، پھر ملیں گے۔', 'God keep you. See you again.'),
    ],
  },
  ustad: {
    name: t('استاد پنکچر والا', 'Ustad the Tyre Man'),
    lines: [
      t('پنکچر لگوانا ہے؟ دو منٹ کا کام ہے۔', 'Need a puncture fixed? It’s a two-minute job.'),
      t('ہوا مفت ہے، بھر لو!', 'Air is free, fill up!'),
    ],
  },
};

export const SIGNS = {
  kiryana: 'حاجی کریانہ سٹور',
  credit: 'ادھار مانگ کر شرمندہ نہ کریں',
  chai: 'بسم اللہ چائے ہوٹل',
  chaiSub: 'دودھ پتی • پراٹھا • انڈا',
  tandoor: 'تنور — گرم روٹی',
  puncture: 'پنکچر شاپ',
  mosque: 'جامع مسجد چک نمبر ۴۷',
  busStop: 'بس سٹاپ — چک ۴۷',
  milestone: ['فیصل آباد', '۳۲'],
  school: 'گورنمنٹ پرائمری سکول',
  schoolSub: 'داخلہ جاری ہے',
  polio: 'پولیو کے دو قطرے — ہر بچہ، ہر بار',
  seed: 'اچھا بیج، اچھی فصل',
  truckBack: 'ماں کی دعا، جنت کی ہوا',
  truckHorn: 'ہارن دو، راستہ لو',
  truckSide: 'دیکھ مگر پیار سے',
  truckCrown: 'ماشاءاللہ',
  trolley: 'پھر ملیں گے',
  rickshaw: 'شہزادہ',
};

export const HELP = [
  ['W A S D', 'چلیں', 'Move'],
  ['Shift', 'دوڑیں', 'Run'],
  ['Mouse', 'اِدھر اُدھر دیکھیں', 'Look around'],
  ['E', 'بات یا کام', 'Talk or use'],
  ['H', 'ہارن', 'Horn (on the tractor)'],
  ['N', 'وقت آگے بڑھائیں', 'Skip time ahead'],
  ['T', 'انگریزی ترجمہ', 'English subtitles on or off'],
  ['M', 'آواز', 'Sound on or off'],
];

export const HELP_TOUCH = [
  ['🕹️', 'بائیں انگوٹھے سے چلیں', 'Left thumb: move (push far to run)'],
  ['👆', 'دائیں طرف انگلی پھیر کر دیکھیں', 'Drag on the right: look around'],
  ['🤏', 'دو انگلیوں سے قریب یا دور', 'Pinch: zoom in or out'],
  ['✋', 'پیلے اشارے کو چھوئیں', 'Tap the yellow prompt: talk or use'],
  ['⏩', 'وقت آگے بڑھائیں', 'Skip time ahead'],
  ['EN', 'انگریزی ترجمہ', 'English subtitles on or off'],
  ['🔊', 'آواز', 'Sound on or off'],
];

export const UI = {
  start: t('شروع کریں', 'Start'),
  rotate: t('بہتر نظارے کے لیے فون کو آڑا کر لیں', 'Turn your phone sideways for a better view'),
};
