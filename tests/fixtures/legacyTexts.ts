// Lettering texts customers have typed or could type into the single text
// field. Phase 0.0 records how today's code treats each one. `expect` is the
// split a future Heading/Name parser should produce — data only for now; it
// becomes the acceptance set of the typography plan's T2 step (zero wrong
// splits allowed; "left whole when it could have split" is acceptable).
export interface LegacyText {
  text: string;
  group: "english" | "turkish" | "multi-word-name" | "free-phrase" | "format" | "edge" | "other-language";
  expect: { heading: string; name: string } | "whole";
}

const split = (heading: string, name: string) => ({ heading, name });

export const LEGACY_TEXTS: LegacyText[] = [
  // English patterns
  { text: "Happy Birthday Arya", group: "english", expect: split("Happy Birthday", "Arya") },
  { text: "Happy Birthday, Arya", group: "english", expect: split("Happy Birthday", "Arya") },
  { text: "Happy Birthday Arya!", group: "english", expect: split("Happy Birthday", "Arya!") },
  { text: "Happy Birthday! Arya", group: "english", expect: split("Happy Birthday", "Arya") },
  { text: "Happy Birthday. Arya", group: "english", expect: split("Happy Birthday", "Arya") },
  { text: "Happy 1st Birthday Layla", group: "english", expect: split("Happy 1st Birthday", "Layla") },
  { text: "Happy 2nd Birthday Malek", group: "english", expect: split("Happy 2nd Birthday", "Malek") },
  { text: "Happy 3rd Birthday Noah", group: "english", expect: split("Happy 3rd Birthday", "Noah") },
  { text: "Happy 4th Birthday Mia", group: "english", expect: split("Happy 4th Birthday", "Mia") },
  { text: "Happy 11th Birthday Omar", group: "english", expect: split("Happy 11th Birthday", "Omar") },
  { text: "Happy 21st Birthday Sara", group: "english", expect: split("Happy 21st Birthday", "Sara") },
  { text: "Happy 1st Birthday, Layla", group: "english", expect: split("Happy 1st Birthday", "Layla") },
  { text: "Happy Birthday", group: "english", expect: "whole" },
  { text: "Happy Birthday Princess", group: "english", expect: split("Happy Birthday", "Princess") },
  { text: "Let's Celebrate Arya", group: "english", expect: split("Let's Celebrate", "Arya") },
  { text: "Welcome to Arya's Birthday", group: "english", expect: split("Welcome to", "Arya's Birthday") },
  { text: "Welcome to Arya's 5th Birthday", group: "english", expect: split("Welcome to", "Arya's 5th Birthday") },
  // Turkish
  { text: "İyi ki doğdun Ayşe", group: "turkish", expect: split("İyi ki doğdun", "Ayşe") },
  { text: "İyi ki Doğdun Ayşe Gül", group: "turkish", expect: split("İyi ki Doğdun", "Ayşe Gül") },
  { text: "İyi ki doğdun Çağla", group: "turkish", expect: split("İyi ki doğdun", "Çağla") },
  { text: "İyi ki doğdun Işıl", group: "turkish", expect: split("İyi ki doğdun", "Işıl") },
  { text: "İyi ki doğdun Öykü", group: "turkish", expect: split("İyi ki doğdun", "Öykü") },
  { text: "İyi ki doğdun Ümit", group: "turkish", expect: split("İyi ki doğdun", "Ümit") },
  { text: "Happy Birthday Şule", group: "turkish", expect: split("Happy Birthday", "Şule") },
  { text: "Happy Birthday Ğ İ Ş ğ ı ş", group: "turkish", expect: split("Happy Birthday", "Ğ İ Ş ğ ı ş") },
  { text: "Doğum günün kutlu olsun Ela", group: "turkish", expect: "whole" },
  // Multi-word names
  { text: "Happy Birthday Ayşe Gül", group: "multi-word-name", expect: split("Happy Birthday", "Ayşe Gül") },
  { text: "Happy Birthday Mary Jane", group: "multi-word-name", expect: split("Happy Birthday", "Mary Jane") },
  { text: "Happy Birthday Al Fahim", group: "multi-word-name", expect: split("Happy Birthday", "Al Fahim") },
  { text: "Happy Birthday Mohammed Bin Rashid", group: "multi-word-name", expect: split("Happy Birthday", "Mohammed Bin Rashid") },
  { text: "Happy Birthday Arya & Leo", group: "multi-word-name", expect: split("Happy Birthday", "Arya & Leo") },
  // Free phrases
  { text: "Oh Baby", group: "free-phrase", expect: "whole" },
  { text: "Two Sweet", group: "free-phrase", expect: "whole" },
  { text: "Let's Party", group: "free-phrase", expect: "whole" },
  { text: "Welcome to the party", group: "free-phrase", expect: "whole" },
  { text: "Arya's 5th", group: "free-phrase", expect: "whole" },
  { text: "Arya Turns One", group: "free-phrase", expect: "whole" },
  { text: "Baby Shower", group: "free-phrase", expect: "whole" },
  { text: "Bride To Be", group: "free-phrase", expect: "whole" },
  { text: "Congrats", group: "free-phrase", expect: "whole" },
  { text: "Happy B-day Arya", group: "free-phrase", expect: "whole" },
  { text: "Happy Bday Arya", group: "free-phrase", expect: "whole" },
  { text: "ONE", group: "free-phrase", expect: "whole" },
  // Format
  { text: "Happy Birthday\nArya", group: "format", expect: split("Happy Birthday", "Arya") },
  { text: "  Happy Birthday Arya  ", group: "format", expect: split("Happy Birthday", "Arya") },
  { text: "HAPPY BIRTHDAY ARYA", group: "format", expect: split("HAPPY BIRTHDAY", "ARYA") },
  { text: "happy birthday arya", group: "format", expect: split("happy birthday", "arya") },
  { text: "Happy  Birthday   Arya", group: "format", expect: split("Happy Birthday", "Arya") },
  { text: "Happy Birthday\n\nArya", group: "format", expect: split("Happy Birthday", "Arya") },
  { text: "Happy\nBirthday\nArya", group: "format", expect: split("Happy Birthday", "Arya") },
  // Edge cases
  { text: "", group: "edge", expect: "whole" },
  { text: "   ", group: "edge", expect: "whole" },
  { text: "Arya", group: "edge", expect: "whole" },
  { text: "Happy Birthday Arya 🎉", group: "edge", expect: "whole" },
  { text: "🎂", group: "edge", expect: "whole" },
  { text: "1", group: "edge", expect: "whole" },
  { text: "5 Arya", group: "edge", expect: "whole" },
  { text: "Happy Birthday 1", group: "edge", expect: "whole" },
  { text: "Happy Birthday Alexandrina Montgomery-Fitzgerald", group: "edge", expect: split("Happy Birthday", "Alexandrina Montgomery-Fitzgerald") },
  { text: "Birthday Arya", group: "edge", expect: "whole" },
  { text: "Happy Arya", group: "edge", expect: "whole" },
  // Other language — behaviour recorded only
  { text: "عيد ميلاد سعيد", group: "other-language", expect: "whole" },
  { text: "Joyeux anniversaire Léa", group: "other-language", expect: "whole" },
];
