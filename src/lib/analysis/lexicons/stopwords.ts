/**
 * Words too common to say anything about a chat. Covers English, romanised Hindi
 * (Hinglish), a little Kannada/Tamil/Telugu filler, and chat filler like "ok".
 * Slang that gives a chat its character ("bro", "yaar", "maga") is kept on purpose.
 */
const english = `a about above across actually after again against ago all almost along already also although always am among
an and another any anybody anyone anything anyway anyways are aren't around as at away back be became because become been before
being below between both but by came can can't cannot come comes could couldn't did didn't do does doesn't doing don't done down
during each either else enough etc even ever every everyone everything few for from further get gets getting give given go goes
going gone got gotten had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how
how's however i i'd i'll i'm i've if in inside instead into is isn't it it'd it'll it's its itself just keep kind know knew least
less let let's like made make makes making many may maybe me mean might mine more most much must mustn't my myself near need needs
neither never next no nobody none nor not nothing now of off often oh ok okay on once one ones only onto or other others otherwise
ought our ours ourselves out over own per perhaps please put quite rather really right said same say says see seem seems seen
several shall shan't she she'd she'll she's should shouldn't since so some somebody someone something sometimes somewhere still such
sure take tell than that that'll that's thats the their theirs them themselves then there there's these they they'd they'll they're
they've thing things think this those though through thus till to today together too took toward towards tried tries try trying
under unless until up upon us use used using very via want wanted wants was wasn't way we we'd we'll we're we've well went were
weren't what what's whatever when when's where where's whether which while who who's whoever whole whom whose why why's will with
within without won't would wouldn't yeah yes yet you you'd you'll you're you've your yours yourself yourselves`;

const chat = `u ur urs r ya yaa yah yea yeh yep yup nope nah na k kk kkk okk okkk okie oki okayy okey hmm hmmm hm mm mmm uh um umm ah ahh ill
aah oh ohh ohhh ooh ok ik idk im ive id dont doesnt didnt cant wont isnt wasnt arent werent havent hasnt couldnt shouldnt wouldnt
thats whats lets gonna wanna gotta gimme lemme tho thru cuz coz cause bcoz bcz becoz cos pls plz plss also like got get go one
two will can would much many lot lots thing things stuff also yes no not`;

const hinglish = `hai hain h he ha haan han haa hn ho hu hun hoon hua hui hue hoga hogi honge hota hoti hote tha thi the thay
ka ki ke ko se me mein mai main mera meri mere tera teri tere tu tum tumhara tumhari tumhare aap aapka apna apni apne hum
hamara hamari humara humko hume humein ye yeh yah woh wo vo voh vah is us isko usko iska uska iski uski unka unki inka inki
unke inke iske uske isse usse unse inse kya kyu kyun kyon kaise kaisa kaisi kab kahan kaha kahaan kaun kon kisko kiska kis kisi
kitna kitne kitni jo jab tab toh to bhi na nahi nhi nahin nai mat aur or par pe pr tak abhi ab phir fir bas ek kuch koi sab
sabko sabhi bahut bohot bht bhot bhut zyada jyada kam thoda thodi thode accha acha achha achaa achcha ji arre are arey areh
kar kr karo kro karna krna karke krke karta karti karte krta krti krte raha rha rahi rhi rahe rhe gaya gya gayi gyi gaye gye
kiya kia kiye liya liye lia diya diye dia de do dena dene le lo lena lene dekh dekho bol bolo bola boli bole bata batao
wala wale wali waala waale sirf kyunki kyuki lekin magar agar mujhe mujhko tujhe tujhko unko inko idhar udhar yaha yahan
waha wahan aisa aise aisi waisa waise jaisa jaise hi hii hai na nah hmm haan ji hoga raha sakta sakti sakte chahiye wahi
yahi vahi usne isne maine tune humne tumne unhone inhone apan apun`;

const southIndian = `illa ide alla adu idu nanu neenu nin nan yen enu hege yaake haudu howdu enri anna akka bidu beda
banni barthini hogi hogu andre ond ondu naan nee enna illai aamaa sari`;

export const STOPWORDS: ReadonlySet<string> = new Set(
  [english, chat, hinglish, southIndian].join(' ').split(/\s+/).filter(Boolean),
);

/** Function words that signal a romanised Hindi chat (used to disambiguate "bc", "mc", …). */
export const HINGLISH_MARKERS: ReadonlySet<string> = new Set(
  `hai hain nahi nhi kya kyu kyun mein mera tera tum bhai yaar kar raha rha tha thi aur bhi abhi haan acha accha kaise
  kab kuch sab bahut bohot hoga karo kro wala wali chal chalo bol bata mujhe tujhe apna matlab sahi bas`.split(/\s+/),
);
