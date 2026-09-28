import { TURN_COUNT } from "./settings";

// One deck of built-in questions, shuffled once. Reigns deal from that deck, so
// every prompt is used before any repeats. Edit the five NPC answers alongside
// each question; they should sound like people, not scoring keywords.
const QUESTIONS = [
  {
    question: "My pet monster hates you. Win it over.",
    answers: [
      "I brought snacks. One of us is going to like me.",
      "I'll sit nearby until it decides I'm safe.",
      "It can hate me. I'm here to see you.",
      "I'll let it eat my rival's introduction first.",
      "Fair. We both want your attention.",
    ],
  },
  {
    question: "They painted my portrait to be prettier than me. Say something.",
    answers: [
      "It also looks much easier to argue with.",
      "It hasn't looked at me the way you just did.",
      "Then let it attend the boring dinners.",
      "I was going to compliment the frame. Is this a bad time?",
      "You're allowed to have a good portrait without losing a competition.",
    ],
  },
  {
    question: "We're getting married in five minutes. Tell me a horrible secret I should know.",
    answers: [
      "I sold tickets. Your aunt paid for the good seats.",
      "I read your diary to plan our first date. You thought we had so much in common.",
      "I applied to marry your sister first. She suggested you.",
      "My touching proposal speech was mostly from my last wedding.",
      "I told everyone you proposed to me. I liked how impressed they looked.",
    ],
  },
  {
    question: "I turned you into a frog. Are we still on for dinner?",
    answers: [
      "Yes. Somewhere with flies.",
      "I was nervous about what to wear anyway.",
      "Change me back, then ask me.",
      "Only if you become a frog too.",
      "I'm already outside. Please watch your step.",
    ],
  },
  {
    question: "The royal oracle says we're a terrible match. What do you think?",
    answers: [
      "It also predicted sunshine. We're standing in a puddle.",
      "I like who I am around you. I'd rather start there.",
      "We're probably difficult people. That isn't the same as a terrible match.",
      "Did it suggest anyone else? Particularly anyone employed as an oracle?",
      "What part sounded true to you? You've been quiet since we left.",
    ],
  },
  {
    question: "You can ask my future self one question about us. What is it?",
    answers: [
      "Did we ever get rid of that sofa?",
      "Do you still tell me when something hurts?",
      "What did we do that everyone said we shouldn't?",
      "Which of us finally learned to cook?",
      "Would you do it again?",
    ],
  },
  {
    question: "I'm tired of being human today. What should I become?",
    answers: [
      "A spoon. Nobody expects a spoon to make small talk.",
      "A tree. I'll sit with you and bring a book.",
      "The sea. Let them try telling you to sit still.",
      "Thursday. I'd look forward to you all week.",
      "Stay yourself. I'll tell everyone you're a chair.",
    ],
  },
  {
    question: "I've outlawed your favorite thing. Convince me to make an exception.",
    answers: [
      "Without naps, I become a much worse subject.",
      "My mother sings when she cooks. Please leave her that.",
      "You can ban dancing. You'll have to catch me first.",
      "I didn't know you could outlaw yourself.",
      "Keep the law. I'll bring you some and we can both be guilty.",
    ],
  },
  {
    question: "Tell me a lie I'll wish were true.",
    answers: [
      "Your cat thinks you're very competent.",
      "Nobody you miss has forgotten you.",
      "We have all the time we need.",
      "Every lost earring is on its way home.",
      "I came here with no idea who you were.",
    ],
  },
  {
    question: "Invent a rumor about us.",
    answers: [
      "We're only doing this for the wedding cake.",
      "We met because we were both hiding from the same party.",
      "You offered me a kingdom. I asked for a second date instead.",
      "We've been writing each other's royal speeches. It explains a lot.",
      "Everyone thinks we're in love. We haven't discussed it yet.",
    ],
  },
  {
    question: "I'm banishing you. Where should I secretly come visit?",
    answers: [
      "The bakery across the border. Follow the complaints about your taxes.",
      "A little house by the water. I'll leave a light on.",
      "Your garden. I haven't agreed to go very far.",
      "The moon. Bring a ladder and something for dinner.",
      "You can write first. I'm going to need a little time.",
    ],
  },
  {
    question: "I can hear your thoughts for ten seconds. What am I hearing?",
    answers: [
      "Don't think about soup. Don't think about soup. Soup.",
      "I hope you're having a good time too.",
      "I'm wondering whether you'd let me kiss you.",
      "An orchestra tuning up. Nobody has found the conductor.",
      "You could have asked me to tell you.",
    ],
  },
  {
    question: "I bought us matching coffins. Did I move too fast?",
    answers: [
      "A little. We haven't even picked matching towels.",
      "I like that you pictured us together. Could we start with a picnic?",
      "Yes. Let me choose my own lining.",
      "Can mine have a window? I get carsick.",
      "Keep the receipt. I'm planning to haunt you for free.",
    ],
  },
  {
    question: "I have one empty room in my heart. What are you putting in it?",
    answers: [
      "A very small bowling alley. You'll hear when I miss you.",
      "A chair. You don't have to entertain me.",
      "A door to somewhere you've never been.",
      "My things, apparently. This courtship is moving quickly.",
      "Nothing yet. Show me what you used to keep there.",
    ],
  },
  {
    question: "You have my attention. Now what?",
    answers: [
      "I hadn't planned this far. You looked busy.",
      "Come for a walk. I'm better without an audience.",
      "Now you try to get mine.",
      "I was hoping to borrow money, but this feels promising.",
      "I'd like to take you out. Somewhere you haven't already judged everyone.",
    ],
  },
  {
    question: "You practiced that compliment. Let me hear the first draft.",
    answers: [
      "You have very symmetrical authority.",
      "I like your face. It got complicated when I tried to explain why.",
      "The first one was better, but less appropriate for court.",
      "Your eyes are like stars. My sister confiscated it.",
      "I wanted you to notice I'd noticed something besides your looks.",
    ],
  },
  {
    question: "I'm wearing something hideous you helped me choose. Defend yourself.",
    answers: [
      "I wanted to be the attractive one for an evening.",
      "You looked so pleased. I lost my nerve.",
      "I still like it. We're allowed to be wrong together.",
      "I thought we were punishing the guests.",
      "I was watching you try things on. I wasn't paying attention to the clothes.",
    ],
  },
  {
    question: "What's the easiest way for me to make you blush?",
    answers: [
      "Compliment me in front of someone who knows me.",
      "Remember a tiny thing I told you weeks ago.",
      "Tell me exactly what you want. I'm less composed than I look.",
      "Wave at me. I'll wave back at the person behind you.",
      "Take my hand first. I always end up being the one who asks.",
    ],
  },
  {
    question: "My mother asks what you see in me. I'm sitting right here.",
    answers: [
      "I'd prepared an answer for your father. How similar are your interests?",
      "She makes ordinary things feel worth telling someone about.",
      "You raised her. Surely you know she's attractive.",
      "A future full of being asked difficult questions over soup.",
      "She looks at me as though she expects an honest answer. I like that.",
    ],
  },
  {
    question: "Name one thing you hope we never do as a couple.",
    answers: [
      "Call each other baby in front of a waiter.",
      "Stop dressing up because we already know we like each other.",
      "Share every hobby. I want something to tell you when I get home.",
      "Become the people who bring a lute to dinner.",
      "Pretend we don't want something because the other person might say no.",
    ],
  },
  {
    question: "Your mother likes your ex more than me. What's your next move?",
    answers: [
      "She can date them, then.",
      "I'm bringing you anyway. She'll have to get to know you.",
      "I'll tell her she doesn't get a vote. Neither does yours.",
      "You like my mother? This is already going better than last time.",
      "Stop asking her for relationship advice. It's how she got this confident.",
    ],
  },
  {
    question: "We've been on a few dates and you still call me 'Your Majesty.' What are we?",
    answers: [
      "Moving slowly. I only recently stopped bowing.",
      "I was hoping we were together. I'm bad at this conversation.",
      "I'd like to be yours. Would you like to be mine?",
      "Flirting. I thought you liked the formality.",
      "A few dates in. I like you, but I'm not choosing wedding china yet.",
    ],
  },
];

function shuffled<T>(items: readonly T[], seed: number) {
  const order = items.map((_, index) => index);
  let state = seed >>> 0;
  for (let index = order.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swap = state % (index + 1);
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return order.map(index => items[index]);
}

const DECK = shuffled(QUESTIONS, 0x5e1d);

export function questionFor(reign: number, turn: number) {
  return DECK[((reign - 1) * TURN_COUNT + turn) % DECK.length];
}
