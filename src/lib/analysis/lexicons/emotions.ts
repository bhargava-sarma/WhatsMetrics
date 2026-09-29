import type { Emotion } from '../types';

/**
 * Hand-built emotion lexicon (English + Hinglish + emoji). Humor is fed by laugh
 * detection rather than words. 😭 and 💀 are deliberately *not* sadness — in
 * modern chats they mostly mean "I'm dying of laughter".
 */
const words: Partial<Record<Emotion, string>> = {
  joy: `happy happiness glad yay yayy yayyy yippee woohoo hurray hooray excited exciting excitement enjoy enjoyed enjoying
    fun awesome amazing great fantastic wonderful lit hype hyped cool nice best stoked thrilled delighted cheers party
    celebrate celebrating win won victory finally mast maza mazaa mazza khush khushi badhiya jhakaas bindaas sahi`,
  love: `love loved loving lovely luv ily ilu adore crush darling sweetheart babe baby cute cutie jaan pyaar pyar ishq
    romantic kiss hug hugs`,
  surprise: `wow woah whoa omg omfg shocked shocking shock surprised surprise surprising unbelievable unexpected insane
    crazy wild wtf damn bruh sachme sachi`,
  fear: `scared scary afraid fear feared terrified terrifying worried worry worrying nervous anxious anxiety panic
    panicking creepy horror horrible dread tense tension dar darr darta darti`,
  sadness: `sad sadness cry crying cried tears depressed depression lonely alone hurt hurts hurting upset unhappy
    heartbroken broken disappointed disappointing miss missed missing regret regrets lost lose pain rip dukh dukhi
    udaas rona`,
  anger: `angry anger mad furious hate hated hates hating pissed annoyed annoying irritated irritating irritate rage
    raging frustrated frustrating stfu gussa ghussa naraz chid chidd`,
};

export const EMOTION_WORDS: ReadonlyMap<string, Emotion[]> = (() => {
  const map = new Map<string, Emotion[]>();
  for (const [emotion, list] of Object.entries(words) as [Emotion, string][]) {
    for (const w of list.split(/\s+/)) {
      if (!w) continue;
      const cur = map.get(w);
      if (cur) {
        if (!cur.includes(emotion)) cur.push(emotion);
      } else map.set(w, [emotion]);
    }
  }
  return map;
})();

const emoji: Partial<Record<Emotion, string>> = {
  joy: '😀 😃 😄 😁 😊 ☺ 🙂 😎 🥳 🎉 ✨ 🤩 😇 🙌 👌 👍 💯 🔥 🤙 🕺 💃 🎊 😌 😋',
  humor: '😂 🤣 💀 😹 😆 😭 😝 😜 🤪 😛',
  love: '❤ 🧡 💛 💚 💙 💜 🤍 🖤 💕 💖 💗 💓 💞 💘 ♥ 😍 🥰 😘 😻 🫶 💋 😚 😙',
  surprise: '😮 😲 😯 😳 🤯 😱 👀 ⁉ ‼ 🫢',
  fear: '😨 😰 😱 😧 😬 🫣 😟 😥',
  sadness: '😢 😞 😔 🥺 💔 😿 🥲 ☹ 🙁 😪 😓 😩 😫',
  anger: '😡 🤬 😠 👿 💢 😤 🖕 😒 🙄 😑',
};

export const EMOTION_EMOJI: ReadonlyMap<string, Emotion[]> = (() => {
  const map = new Map<string, Emotion[]>();
  for (const [emotion, list] of Object.entries(emoji) as [Emotion, string][]) {
    for (const e of list.split(' ')) {
      if (!e) continue;
      const cur = map.get(e);
      if (cur) cur.push(emotion);
      else map.set(e, [emotion]);
    }
  }
  return map;
})();

export const EMOTION_LABELS: Record<Emotion, string> = {
  joy: 'Joy',
  humor: 'Humor',
  love: 'Love',
  surprise: 'Surprise',
  fear: 'Worry',
  sadness: 'Sadness',
  anger: 'Anger',
};
