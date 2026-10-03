export type FestivalKey =
  | 'diwali'
  | 'holi'
  | 'navratri'
  | 'chhath'
  | 'shivratri'
  | 'janmashtami'
  | 'rakshabandhan';

export interface FestivalConfig {
  id: FestivalKey;
  name: string;
  hindiName: string;
  emoji: string;
  tagline: string;
  defaultTitle: string;
  defaultSubtitle: string;
  defaultOfferText: string;
  specialTreat: string;
  themeGradient: string;
  accentBadge: string;
  bannerGradient: string;
  confettiColors: string[];
  motifs: string[];
  ambientIcons: string[];
}

export const FESTIVALS_DATA: Record<FestivalKey, FestivalConfig> = {
  diwali: {
    id: 'diwali',
    name: 'Diwali',
    hindiName: 'दीपावली (दिवाली)',
    emoji: '🪔',
    tagline: 'दीपों और मिठास का पावन प्रकाशोत्सव',
    defaultTitle: 'शुभ दीपावली! Happy Diwali ✨',
    defaultSubtitle: 'मां लक्ष्मी और विघ्नहर्ता गणेश जी की कृपा से आपका जीवन सुख, समृद्धि और स्वादिष्ट मिष्ठान्न की मिठास से जगमगाता रहे।',
    defaultOfferText: 'विशेष दीपावली थाली एवं ताज़ा देसी घी की मिठाइयों पर 15% की छूट!',
    specialTreat: 'काजू कतली, गुलाब जामुन, रसगुल्ले और रॉयल दिवाली स्पेशल थाली',
    themeGradient: 'from-amber-500 via-orange-600 to-red-600',
    accentBadge: 'bg-amber-100 text-amber-900 border-amber-300',
    bannerGradient: 'from-amber-600 via-orange-600 to-red-700',
    confettiColors: ['#f59e0b', '#ea580c', '#dc2626', '#fbbf24', '#fef08a', '#ffffff'],
    motifs: ['🪔', '✨', '🏮', '🎆'],
    ambientIcons: ['🪔', '✨', '🪔', '🌟']
  },
  holi: {
    id: 'holi',
    name: 'Holi',
    hindiName: 'होली (रंगोत्सव)',
    emoji: '🎨',
    tagline: 'रंग, उमंग और मिठास का महापर्व',
    defaultTitle: 'बुरा न मानो होली है! Happy Holi 🌈',
    defaultSubtitle: 'रंगों की फुहार और अपनों के प्यार के साथ मनाएं होली! स्वादीप के स्वादिष्ट पकवानों के साथ उत्सव का आनंद दोगुना करें।',
    defaultOfferText: 'होली स्पेशल ठंडाई और कुरकुरी मावा गुजिया के साथ हर ऑर्डर पर सरप्राइज गिफ्ट!',
    specialTreat: 'ताज़ा मावा गुजिया, शाही ठंडाई, दही भल्ले और खस्ता कचौरी',
    themeGradient: 'from-pink-500 via-purple-600 to-amber-500',
    accentBadge: 'bg-pink-100 text-pink-900 border-pink-300',
    bannerGradient: 'from-pink-600 via-purple-600 to-rose-600',
    confettiColors: ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
    motifs: ['🎨', '🌸', '✨', '🎉'],
    ambientIcons: ['🌸', '✨', '🎨', '🌟']
  },
  navratri: {
    id: 'navratri',
    name: 'Navratri & Durga Puja',
    hindiName: 'नवरात्रि एवं दुर्गा पूजा',
    emoji: '🌸',
    tagline: 'शक्ति, भक्ति और मां दुर्गा का पावन उत्सव',
    defaultTitle: 'जय माता दी! शुभ नवरात्रि व दुर्गा पूजा 🙏',
    defaultSubtitle: 'मां दुर्गे के नौ रूपों की कृपा आप और आपके परिवार पर सदा बनी रहे। व्रत और सात्विक आहार के लिए स्वादीप प्रस्तुत करता है शुद्ध फलाहारी मेनू।',
    defaultOfferText: 'शुद्ध फलाहारी सात्विक थाली और उपवास के व्यंजनों पर विशेष ऑफर!',
    specialTreat: 'साबूदाना खिचड़ी, कुट्टू पूरी, सात्विक पनीर और मखाना खीर',
    themeGradient: 'from-red-600 via-orange-600 to-amber-500',
    accentBadge: 'bg-red-100 text-red-900 border-red-300',
    bannerGradient: 'from-red-700 via-orange-600 to-amber-600',
    confettiColors: ['#dc2626', '#ea580c', '#f59e0b', '#fbbf24', '#ffd700'],
    motifs: ['🌸', '🌺', '🕉️', '✨'],
    ambientIcons: ['🌸', '🌺', '✨', '🪔']
  },
  chhath: {
    id: 'chhath',
    name: 'Chhath Puja',
    hindiName: 'छठ महापर्व (सूर्य षष्ठी)',
    emoji: '☀️',
    tagline: 'आस्था, शुचिता और प्रकृति का महापर्व',
    defaultTitle: 'छठ महापर्व की हार्दिक शुभकामनाएं! 🌅',
    defaultSubtitle: 'भगवान भास्कर और छठी मइया की असीम अनुकंपा से आपके घर में सुख, आरोग्य और शांति का वास हो।',
    defaultOfferText: 'छठ स्पेशल शुद्ध घी के पारंपरिक ठेकुआ और सात्विक भोजन उपलब्ध!',
    specialTreat: 'पारंपरिक खस्ता ठेकुआ, शुद्ध देसी घी मिष्ठान्न और सात्विक भोग',
    themeGradient: 'from-orange-500 via-amber-500 to-yellow-500',
    accentBadge: 'bg-orange-100 text-orange-900 border-orange-300',
    bannerGradient: 'from-orange-600 via-amber-600 to-yellow-600',
    confettiColors: ['#f97316', '#f59e0b', '#eab308', '#facc15', '#ffffff'],
    motifs: ['☀️', '🌾', '🪔', '✨'],
    ambientIcons: ['☀️', '✨', '🪔', '🌾']
  },
  shivratri: {
    id: 'shivratri',
    name: 'Maha Shivratri',
    hindiName: 'महाशिवरात्रि',
    emoji: '🔱',
    tagline: 'देवाधिदेव महादेव और मां पार्वती का मंगलकारी पर्व',
    defaultTitle: 'हर हर महादेव! महाशिवरात्रि की शुभकामनाएं 🕉️',
    defaultSubtitle: 'भगवान भोलेनाथ और मां पार्वती की कृपा से आपकी समस्त मनोकामनाएं पूर्ण हों और जीवन में सदैव कल्याण हो।',
    defaultOfferText: 'महाशिवरात्रि व्रत स्पेशल फलाहारी मेनू और शुद्ध पंचामृत खीर!',
    specialTreat: 'केसरिया बादाम दूध, मखाना खीर, साबूदाना वड़ा और सात्विक भोग',
    themeGradient: 'from-indigo-700 via-cyan-600 to-teal-600',
    accentBadge: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    bannerGradient: 'from-indigo-800 via-cyan-700 to-teal-700',
    confettiColors: ['#06b6d4', '#3b82f6', '#6366f1', '#14b8a6', '#ffffff'],
    motifs: ['🔱', '🌙', '🕉️', '✨'],
    ambientIcons: ['🌙', '🔱', '✨', '🕉️']
  },
  janmashtami: {
    id: 'janmashtami',
    name: 'Krishna Janmashtami',
    hindiName: 'श्रीकृष्ण जन्माष्टमी',
    emoji: '🦚',
    tagline: 'नंद के आनंद भयो, जय कन्हैया लाल की!',
    defaultTitle: 'श्रीकृष्ण जन्माष्टमी की शुभकामनाएं! 🦚',
    defaultSubtitle: 'माखनचोर भगवान श्रीकृष्ण का आशीर्वाद आपके घर में अपार हर्ष, सुख और मधुरता लेकर आए।',
    defaultOfferText: 'माखन-मिश्री, मलाई रबड़ी और स्पेशल पेड़ा कॉम्बो पर 20% की छूट!',
    specialTreat: 'माखन मिश्री भोग, रबड़ी, मथुरा पेड़ा और धनिया पंजीरी',
    themeGradient: 'from-blue-600 via-indigo-600 to-amber-500',
    accentBadge: 'bg-blue-100 text-blue-900 border-blue-300',
    bannerGradient: 'from-blue-700 via-indigo-700 to-amber-600',
    confettiColors: ['#2563eb', '#4f46e5', '#f59e0b', '#10b981', '#fbbf24'],
    motifs: ['🦚', '🪈', '🍯', '✨'],
    ambientIcons: ['🦚', '✨', '🪈', '🌟']
  },
  rakshabandhan: {
    id: 'rakshabandhan',
    name: 'Raksha Bandhan',
    hindiName: 'रक्षाबंधन',
    emoji: '🎁',
    tagline: 'स्नेह, विश्वास और भाई-बहन के अटूट प्रेम का उत्सव',
    defaultTitle: 'शुभ रक्षाबंधन! Happy Raksha Bandhan 💖',
    defaultSubtitle: 'भाई-बहन के पवित्र रिश्ते के इस पावन पर्व पर अपनों के साथ साझा करें खुशियां और स्वादीप की लजीज मिठाइयां।',
    defaultOfferText: 'रक्षाबंधन स्पेशल मिठाई बॉक्सेज और गिफ्ट हैंपर पर विशेष छूट!',
    specialTreat: 'प्रीमियम मिठाई गिफ्ट बॉक्स, केसरिया जलेबी और स्पेशल स्नैक्स',
    themeGradient: 'from-rose-600 via-pink-600 to-amber-500',
    accentBadge: 'bg-rose-100 text-rose-900 border-rose-300',
    bannerGradient: 'from-rose-700 via-pink-600 to-amber-600',
    confettiColors: ['#e11d48', '#ec4899', '#f59e0b', '#fbbf24', '#ffffff'],
    motifs: ['🎁', '🌸', '✨', '💖'],
    ambientIcons: ['🌸', '✨', '🎁', '🌟']
  }
};

export const FESTIVALS_LIST = Object.values(FESTIVALS_DATA);
