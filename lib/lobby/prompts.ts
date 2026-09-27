import { TURN_COUNT } from "./settings";

// Built-in questions rotate automatically; no generation or player setup needed.
// Each group of three moves from playful to revealing. Edit the five NPC answers
// alongside each question; they should sound like people, not scoring keywords.
const QUESTIONS = [
  // Reign 1: make an impression, handle a little friction, take a personal gamble.
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
    question: "My portrait is prettier than me. Say something.",
    answers: [
      "It also looks much easier to argue with.",
      "It hasn't looked at me the way you just did.",
      "Then let it attend the boring dinners.",
      "I was going to compliment the frame. Is this a bad time?",
      "You're allowed to have a good portrait without losing a competition.",
    ],
  },
  {
    question: "We're getting married in five minutes. Tell me something I should know.",
    answers: [
      "I invited my mother. She thinks this is a job interview.",
      "When I'm hurt, I get quiet. Please ask twice.",
      "I won't agree with you just because you're wearing a crown.",
      "My vows are written on my hand. I've been sweating.",
      "I'd still like to ask whether you want this.",
    ],
  },
  // Reign 2: an awkward date becomes a question about the future.
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
    question: "The royal oracle says we're a terrible match. What did it miss?",
    answers: [
      "My excellent soup. Prophecy is hungry work.",
      "How easy it is to sit quietly with you.",
      "That neither of us enjoys being told what to do.",
      "Its appointment with the royal optician.",
      "Maybe nothing. I'd still like one dinner to find out.",
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
  // Reign 3: play along, stand your ground, then choose a comforting lie.
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
  // Reign 4: invent an us, risk losing it, then let her see inside your head.
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
  // Reign 5: find her, negotiate her enthusiasm, decide what you'd bring to her life.
  {
    question: "I'm hiding under the banquet table. What do you say when you find me?",
    answers: [
      "Good news. The cake is within grabbing distance.",
      "Would you like company or a better hiding place?",
      "Move over. I'm hiding from the same people.",
      "Your Majesty, the table requests a dance.",
      "I'll tell them I couldn't find you.",
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
];

export function questionFor(reign: number, turn: number) {
  return QUESTIONS[((reign - 1) * TURN_COUNT + turn) % QUESTIONS.length];
}
