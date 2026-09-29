export interface TopicDef {
  id: string;
  label: string;
  icon: string;
  words: string;
}

/** Keyword topics. A message can belong to several; matching is per whole word. */
export const TOPICS: TopicDef[] = [
  {
    id: 'food',
    label: 'Food & drinks',
    icon: 'utensils',
    words: `food eat eating ate eaten hungry lunch dinner breakfast brunch snack snacks pizza burger burgers biryani maggi
      chai coffee tea momos cake chocolate icecream restaurant cafe canteen khana khaana bhook bhuk swiggy zomato dosa
      idli paneer chicken mutton fries shawarma rolls juice drinks beer party treat dessert sweets noodles pasta sandwich
      tiffin dabba thali vada samosa pav chaat kfc mcd dominos starbucks`,
  },
  {
    id: 'gaming',
    label: 'Gaming',
    icon: 'gamepad',
    words: `game games gaming gamer play playing played valorant val minecraft gta fortnite pubg bgmi cod csgo cs2 ps5
      ps4 xbox steam lobby ranked noob gg clutch ace headshot server fps controller console roblox apex overwatch fifa
      league respawn loot squad duo solo`,
  },
  {
    id: 'study',
    label: 'Study & work',
    icon: 'book',
    words: `exam exams test tests class classes college clg school sem semester assignment assignments project projects
      homework hw study studying studied marks grade grades result results lecture teacher sir maam professor prof
      attendance lab notes syllabus viva internship intern job office meeting interview boss salary placement
      placements cgpa gpa tuition coaching jee neet board boards paper papers revision deadline`,
  },
  {
    id: 'money',
    label: 'Money',
    icon: 'wallet',
    words: `money paise paisa paisa rupees rs inr pay paid payment gpay upi paytm phonepe cost costs price expensive cheap
      buy bought sell sold loan owe debt bill split cash budget broke rich discount sale offer emi`,
  },
  {
    id: 'plans',
    label: 'Plans & travel',
    icon: 'map',
    words: `trip travel flight train bus cab uber ola auto metro drive ride goa vacation holiday plan plans meet meetup
      hangout outing mall airport hotel booking ticket tickets tomorrow tmrw tmr weekend coming reach reached
      pickup location`,
  },
  {
    id: 'entertainment',
    label: 'Movies & music',
    icon: 'film',
    words: `movie movies film films watch watched watching netflix prime hotstar series episode season anime song
      songs music spotify playlist album concert trailer youtube yt reel reels theatre theater cinema singer rapper`,
  },
  {
    id: 'sports',
    label: 'Sports & fitness',
    icon: 'trophy',
    words: `cricket match ipl rcb csk kohli virat dhoni rohit football fifa messi ronaldo goal gym workout badminton
      tennis basketball f1 wicket century batting bowling stadium fitness`,
  },
  {
    id: 'romance',
    label: 'Love & dating',
    icon: 'heart',
    words: `gf bf girlfriend boyfriend crush dating relationship single propose proposed breakup ex rizz simp flirt
      flirting married marriage wedding shaadi valentine situationship`,
  },
  {
    id: 'tech',
    label: 'Tech',
    icon: 'cpu',
    words: `phone iphone android laptop pc app apps update wifi internet charger battery code coding python java
      javascript ai chatgpt gpt bug windows mac macbook apple samsung pixel oneplus earbuds airpods headphones keyboard
      mouse gpu cpu software hardware`,
  },
  {
    id: 'social',
    label: 'Social media',
    icon: 'at',
    words: `insta instagram story stories post posted snap snapchat twitter tweet dm dms follow followers following
      meme memes tiktok status pfp dp`,
  },
  {
    id: 'health',
    label: 'Sleep & health',
    icon: 'moon',
    words: `sleep sleeping slept sleepy tired nap sick fever cold cough doctor hospital medicine headache pain injury
      injured bed insomnia awake`,
  },
];

export const TOPIC_WORDS: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  TOPICS.forEach((t, i) => {
    for (const w of t.words.split(/\s+/)) if (w && !map.has(w)) map.set(w, i);
  });
  return map;
})();
