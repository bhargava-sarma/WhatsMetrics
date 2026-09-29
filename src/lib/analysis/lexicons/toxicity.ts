/**
 * Toxicity lexicon. Weights: 1 = mild (rude / insulting), 2 = profanity,
 * 3 = slurs, sexual insults and threats. Scores are a playful proxy for how
 * "spicy" someone's language is — lexicons can't read sarcasm or banter.
 */

const mild = `damn dammit damnit crap crappy piss pissed sucks suck sucked sucking stupid dumb dumbass idiot idiots idiotic
moron morons loser losers lame jerk jerks screw screwed wtf wth ffs omfg stfu gtfo noob noobs clown clowns trash garbage
bloody bugger arse butt frick fricking freaking effing pagal paagal pagla ullu gadha gadhe gadhi bewakoof bevkoof bewkoof
nalayak kamina kamine kaminey kameena kameene kamini saala sala saale sali saali bakchod bakchodi chomu chapri tharki
chirkut fattu dhakkan nautanki tatti kutta`;

const profanity = `shit shitty shits shitting bullshit horseshit ass asses asshole assholes bitch bitches bitchy bitching
dick dicks dickhead prick pricks bastard bastards fuck fucks fucked fucker fuckers fucking fuckin fking fkin fck fcking
fuk fuking fk fkn douche douchebag twat wanker wankers bollocks cock cocks pussy mf mofo motherfucking thot chutiya
chutiye chutiyapa chutiyap chootiya chootiye chutia chutiyo cutiya chodu lodu lode lawde lavde lauda lawda loda lund
lundd gaand gand gaandu gandu gandoo jhatu jhaatu jhant jhaant jhantu harami haraami haramkhor haramzade haramzada
kutte kutti kuttey bhadwa bhadwe bhadva bkl tullu thika thikka`;

const severe = `nigger niggers nigga niggas nigg faggot faggots fag fags retard retards retarded tranny spic chink kike
paki cunt cunts slut sluts whore whores motherfucker motherfuckers kys madarchod maderchod madarchood madarjaat
bhenchod behenchod bhenchodd benchod bhanchod behnchod bhosdike bhosdika bhosdiwale bhosadike bhosadi bhosdi bsdk
bhosdk randi raand randwa chinal kutiya sule soolemaga bolimaga bolimagane`;

function toMap(...groups: [string, number][]) {
  const map = new Map<string, number>();
  for (const [words, weight] of groups) {
    for (const w of words.split(/\s+/)) {
      if (w) map.set(w, weight);
    }
  }
  return map;
}

export const TOXIC_WORDS: ReadonlyMap<string, number> = toMap([mild, 1], [profanity, 2], [severe, 3]);

/**
 * Abbreviations that are swears in Hinglish chats but ordinary words elsewhere
 * ("bc" = because, "mc" = master of ceremonies). Only counted when the chat is Hinglish.
 */
export const HINGLISH_ONLY_TOXIC: ReadonlyMap<string, number> = new Map([
  ['bc', 2],
  ['bcc', 2],
  ['mc', 3],
  ['mkc', 3],
  ['tmkc', 3],
]);

/** Multi-word insults and threats, checked against the lower-cased message. */
export const TOXIC_PHRASES: [RegExp, number, string][] = [
  [/\b(kill|kil) (yo)?urself\b|\bkill urself\b|\bgo die\b|\bi('ll| will) kill (you|u)\b/, 3, 'kill yourself'],
  [/\bf+u+c*k+ (you|u|off|urself|yourself)\b/, 3, 'f*** you'],
  [/\bshut (the fuck )?up\b|\bshutup\b/, 1, 'shut up'],
  [/\bi hate (you|u)\b|\bhate (you|u)\b/, 2, 'hate you'],
  [/\b(you|u) suck\b/, 1, 'you suck'],
  [/\bpiss off\b|\bscrew (you|u)\b/, 2, 'screw you'],
  [/\bteri maa\b|\btere baap\b|\bmaa ki\b|\bmaa chod\b|\bbehen ki\b|\bnin amman\b|\bnin akkan\b|\bamma ki\b/, 3, 'teri maa'],
  [/\bchup kar\b|\bchup ho ja\b|\bmooh band\b|\bmuh band\b/, 1, 'chup kar'],
];

/** "fuck" → "f**k" style masking for display. */
export function maskWord(word: string): string {
  if (word.length <= 2) return word[0] + '*';
  if (word.length === 3) return word[0] + '*' + word[2];
  return word[0] + '*'.repeat(word.length - 2) + word[word.length - 1];
}
