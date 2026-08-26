// =============================================================
// asclepion-seed.js — every word of content in The Asclepion.
//
//   window.AscSeed
//
// Must load BEFORE asclepion-data.js, which reads it in seedNow().
//
// WHY THE CONTENT IS ITS OWN FILE
//
// This is the file you edit when you want to change what a
// tapping script says or add a line to a deck. asclepion-data.js
// is the file you edit when you want to change what a tapping
// script IS. Keeping them apart means the ~200KB of writing below
// never has to be scrolled past to read the machinery, and the
// machinery never has to be re-read to fix a typo.
//
// Nothing here has an `id`. seedNow() lets the models mint them,
// so re-running a seed on a fresh device cannot collide with
// anything, and an id is never a thing you have to keep unique by
// hand while writing prose.
//
// EVERY RECORD HERE IS EDITABLE ONCE SEEDED. `builtin: true` is
// stamped on at seed time and means only "this arrived with the
// page" — it never makes a record read-only.
// =============================================================

window.AscSeed = (function () {
  'use strict';
  var S = {};

  // ===========================================================
  // BREATH — five techniques.
  //
  // Written from Damian's own notes, kept in his own words where
  // he used them. Three of these cannot be expressed as
  // inhale/hold/exhale/hold with one cycle count, which is why
  // the model is rounds-of-phases; see asclepion-data.js.
  //
  // `seconds: 0` on a phase means SELF-PACED — the pacer holds
  // there until you tap. It is how "fill your lungs" is stored
  // without inventing a duration for it.
  // ===========================================================
  S.breath = [
    {
      name: '4-7-8 Breathing',
      goal: 'Sleep',
      summary: 'Four in through the nose, seven held, eight out through the mouth. Four rounds.',
      why: 'One of the two you already trust. The long forced exhale is doing the work: ' +
           'emptying the lungs further than a resting breath does means the next inhale ' +
           'arrives without you having to pull for it, and the ratio pushes you further ' +
           'toward the out-breath than any normal breathing pattern goes. Four rounds is ' +
           'the whole dose. It is not a technique that rewards doing more of it.',
      cues: [
        'Tongue tip on the ridge of the mouth, touching the back of the top front teeth. It stays there the whole time.',
        'The exhale is forceful and audible. Through the mouth, around the tongue.',
        'Four cycles. Not more.'
      ],
      rounds: [
        {
          label: '',
          cycles: 4,
          phases: [
            { kind: 'inhale', seconds: 4, route: 'nose',  note: 'Quietly, through the nose.' },
            { kind: 'hold',   seconds: 7,                 note: 'Hold.' },
            { kind: 'exhale', seconds: 8, route: 'mouth', force: true, note: 'Forcefully, through the mouth.' }
          ]
        }
      ]
    },
    {
      name: 'The Physiological Sigh',
      goal: 'In the moment',
      summary: 'Two inhales stacked, then one long exhale. Two or three times, and it is done.',
      why: 'The other one you already trust, and the fastest thing on this page. The second ' +
           'inhale reinflates the parts of the lungs the first one did not reach, so the long ' +
           'exhale that follows can offload far more than a single breath could. Two or three ' +
           'is genuinely all of it — this is the one you can do in a conversation, in a queue, ' +
           'in the ninety seconds before something you are dreading.',
      cues: [
        'Two inhales, the second stacked straight on top of the first. Fill the lungs.',
        'Then one long, unhurried exhale. Let it be longer than feels necessary.',
        'Two or three rounds. It works or it does not within about twenty seconds.'
      ],
      rounds: [
        {
          label: '',
          cycles: 3,
          phases: [
            { kind: 'inhale', seconds: 3, route: 'nose', note: 'Fill the lungs.' },
            { kind: 'inhale', seconds: 1, route: 'nose', note: 'And again, on top.' },
            { kind: 'exhale', seconds: 7, route: 'mouth', note: 'Long, and all the way out.' }
          ]
        }
      ]
    },
    {
      name: 'Another Physiological Sigh',
      goal: 'Calm',
      summary: 'The same shape, both breaths through the nose, the second one squeezed in.',
      why: 'A naturally occurring pattern. It is what the body does on its own as you fall ' +
           'asleep, and what it does when you have been crying — the double-inhale hitch is ' +
           'the body downshifting without being asked. That means it can be run deliberately: ' +
           'you are not learning a new trick, you are triggering something already installed.\n\n' +
           'Damian has not used this variant much. It differs from the one above only in that ' +
           'the second inhale is a genuine squeeze rather than a stack, and both go through ' +
           'the nose if the nose will allow it.',
      cues: [
        'One big inhale, then one extra inhale on top — squeezing in the extra air.',
        'Both through the nose, if you can.',
        'Then one extended exhale.',
        'Two or three rounds.'
      ],
      rounds: [
        {
          label: '',
          cycles: 3,
          phases: [
            { kind: 'inhale', seconds: 4, route: 'nose', note: 'One big inhale.' },
            { kind: 'inhale', seconds: 2, route: 'nose', note: 'Squeeze in the extra air.' },
            { kind: 'exhale', seconds: 8, route: 'nose', note: 'Extended, unhurried.' }
          ]
        }
      ]
    },
    {
      name: 'Box Breathing',
      goal: 'Focus',
      summary: 'In for five, hold for five, out for five. Four rounds, at least.',
      why: 'Used by Navy SEALs, Olympic athletes and other people whose job is to stay ' +
           'level in conditions that do not encourage it. Its value is not that it is ' +
           'relaxing — it is that it is boring and countable, and something boring and ' +
           'countable is exactly what a mind running too fast can be given to hold.\n\n' +
           'Written here as three sides: in, hold, out. Some versions add a fourth — a hold ' +
           'after the exhale, same count — which is where the name comes from. If you want ' +
           'that version, edit this technique and add a hold-after-exhale phase; nothing ' +
           'else has to change.',
      cues: [
        'Four to five seconds a side. Pick one count and keep it.',
        'Through the nose on the way in. Slowly on the way out.',
        'At least four rounds. It takes a couple before it starts working.'
      ],
      rounds: [
        {
          label: '',
          cycles: 4,
          phases: [
            { kind: 'inhale', seconds: 5, route: 'nose', note: 'In through the nose.' },
            { kind: 'hold',   seconds: 5,                note: 'Hold.' },
            { kind: 'exhale', seconds: 5,                note: 'Slowly out.' }
          ]
        }
      ]
    },
    {
      name: 'Vortex Breath',
      goal: 'Energy',
      summary: 'Five descending rounds — 13, 8, 5, 3, 2 — and then you begin.',
      why: 'A ladder rather than a loop. Each round is one inhale and one exhale of the same ' +
           'count, and the counts fall away underneath you: thirteen, eight, five, three, two. ' +
           'By the last pair the breath has become short and the attention has become narrow, ' +
           'which is the point — this is a doorway, not a destination.\n\n' +
           'Meant for inner growth and mental focus. Run it and then move straight on to ' +
           'whatever mental or spiritual work you sat down for. From the bottom of the ladder ' +
           'a meditative state is very close.',
      cues: [
        'Inhale for the count, exhale for the same count. One pair per round.',
        'Thirteen, eight, five, three, two.',
        'Do not stop at the end. Go straight into the thing you came to do.'
      ],
      rounds: [
        { label: '13 x 13', cycles: 1, phases: [
          { kind: 'inhale', seconds: 13, route: 'nose' }, { kind: 'exhale', seconds: 13 } ] },
        { label: '8 x 8', cycles: 1, phases: [
          { kind: 'inhale', seconds: 8, route: 'nose' },  { kind: 'exhale', seconds: 8 } ] },
        { label: '5 x 5', cycles: 1, phases: [
          { kind: 'inhale', seconds: 5, route: 'nose' },  { kind: 'exhale', seconds: 5 } ] },
        { label: '3 x 3', cycles: 1, phases: [
          { kind: 'inhale', seconds: 3, route: 'nose' },  { kind: 'exhale', seconds: 3 } ] },
        { label: '2 x 2', cycles: 1, phases: [
          { kind: 'inhale', seconds: 2, route: 'nose' },  { kind: 'exhale', seconds: 2 } ] }
      ]
    }
  ];

  // ===========================================================
  // THE TAPPING POINTS
  //
  // Nine points, in the order they are tapped. The karate chop is
  // the setup point and is tapped only while saying the setup
  // statement; the other eight are the round, top to bottom and
  // then back to the crown.
  //
  // `where` is for the diagram's caption. `cue` is what to
  // actually do with your hand — it is the half that gets left
  // out of every tapping chart and is the half you need the first
  // twenty times.
  // ===========================================================
  S.eftPoints = [
    { key: 'kc', n: 0, name: 'Karate chop',
      where: 'The fleshy outer edge of the hand, below the little finger.',
      cue: 'Tap it with the four fingers of the other hand. This is the setup point — you only use it while saying the setup statement.' },
    { key: 'eb', n: 1, name: 'Eyebrow',
      where: 'Where the eyebrow begins, just above and to one side of the bridge of the nose.',
      cue: 'Two fingers, firm but gentle, about seven taps. Either side, or both at once.' },
    { key: 'se', n: 2, name: 'Side of the eye',
      where: 'On the bone at the outside corner of the eye.',
      cue: 'On the bone, not on the soft tissue. Two fingers.' },
    { key: 'ue', n: 3, name: 'Under the eye',
      where: 'On the bone under the eye, roughly below the pupil.',
      cue: 'Light here. It is a thin bone and a tender spot.' },
    { key: 'un', n: 4, name: 'Under the nose',
      where: 'The small hollow between the nose and the top lip.',
      cue: 'One or two fingers. A small target, so slow down.' },
    { key: 'ch', n: 5, name: 'Chin',
      where: 'The crease between the bottom lip and the chin.',
      cue: 'Two fingers in the crease itself, not on the point of the chin.' },
    { key: 'cb', n: 6, name: 'Collarbone',
      where: 'Just below the inner end of the collarbone, about an inch down and an inch out from the notch at the base of the throat.',
      cue: 'You can tap this one with a loose fist across both sides at once. Often the strongest point of the round.' },
    { key: 'ua', n: 7, name: 'Under the arm',
      where: 'About four inches below the armpit, level with a bra strap.',
      cue: 'Flat fingers, or the whole hand. Reach across the body.' },
    { key: 'th', n: 8, name: 'Top of the head',
      where: 'The crown, the centre of the top of the head.',
      cue: 'Fingers spread, tapping in a small circle. This closes the round.' }
  ];

  // ===========================================================
  // THE JOURNALS
  //
  // Five, and they are five because they have five different
  // jobs. A journal here is a DEFINITION — its purpose and its
  // sections; an entry is one filling-in of one definition.
  //
  // `lines: n` on a section means n numbered lines instead of one
  // open field. It exists for the 3/3/3 journal, where three is
  // the whole method and an open box would quietly let it become
  // two or five.
  // ===========================================================
  S.journals = [
    {
      key: 'innerwork',
      name: 'Inner Work Journal',
      glyph: '☾',
      purpose: 'Resistance, shadow, and the patterns running underneath.',
      about: 'This is the one you open when something has got to you and you cannot yet say why.\n\n' +
             'Its job is to make two separations you cannot make in your head while the feeling ' +
             'is still happening. The first is emotion from identity: "I feel unwanted" and ' +
             '"I am unwanted" are different sentences and only one of them is a fact. The second ' +
             'is information from automatic reaction: a feeling can be data about a situation ' +
             'without also being an instruction about what to do next.\n\n' +
             'Write it plainly. This is not the journal to be eloquent in.',
      sections: [
        { label: 'What happened',
          prompt: 'The situation, plainly, with no interpretation in it yet. Just the facts a camera would have caught.' },
        { label: 'What I felt',
          prompt: 'Name the feeling, not the story about the feeling. If several, list them.' },
        { label: 'The story I told myself about it',
          prompt: 'What did you conclude, instantly and without checking? Write the conclusion in its own words, however unfair.' },
        { label: 'Emotion, or identity?',
          prompt: 'Look back at what you just wrote. Which parts are things you felt, and which parts are claims about who you are? Rewrite the identity claims as feelings.' },
        { label: 'Information, or reaction?',
          prompt: 'What is this feeling actually telling you about the situation? And separately: what did it make you want to do immediately? Those are two different things.' },
        { label: 'How old is this pattern?',
          prompt: 'Have you felt exactly this before? When was the first time you can remember it? You are not solving that here, only noticing that it predates today.' },
        { label: 'If this were information and not an instruction',
          prompt: 'What would you do next? Not what would fix the feeling — what would be the reasonable move, given what you now know.' }
      ]
    },
    {
      key: 'muse',
      name: 'Muse',
      glyph: '✧',
      purpose: 'Rabbit holes, strange ideas, and things with no immediate use.',
      about: 'The wonder journal. Rabbit holes, strange ideas, art, dreams, quotations, ' +
             'aesthetics, symbolism, mythology, psychology, history, story concepts, questions, ' +
             'things that blow your mind, and ideas that have no immediate practical purpose.\n\n' +
             'That last one is the entry requirement, not a disclaimer. Nothing in here has to ' +
             'be going anywhere.\n\n' +
             'The point is an inner life so rich that your mind itself becomes somewhere worth ' +
             'inhabiting.',
      sections: [
        { label: 'The thing',
          prompt: 'What is it? A link, a line, an image, a half-idea. Get it down before it goes.' },
        { label: 'Why it caught me',
          prompt: 'Something in it hooked. What?' },
        { label: 'Where it might go',
          prompt: 'Optional, and often better left empty. If it wants to connect to something else, say so.' }
      ]
    },
    {
      key: 'evidence',
      name: 'Evidence Journal',
      glyph: '◇',
      purpose: 'Proof of who you are becoming.',
      about: 'Extremely simple, and psychologically the heaviest thing on this page.\n\n' +
             'Its only job is to collect proof. Not wins, not gratitude, not progress — ' +
             'evidence. A thing you did that the person you are becoming would have done, ' +
             'however small, written down on the day you did it.\n\n' +
             'It works because the argument about who you are is not won by deciding. It is won ' +
             'by accumulating a record that is hard to argue with, and then being able to read it ' +
             'on a day when you would otherwise have argued with it.',
      sections: [
        { label: "Today's evidence", lines: 3,
          prompt: 'What did you do today that the person you are becoming would have done?' }
      ]
    },
    {
      key: 'threethree',
      name: 'The 3/3/3 Day',
      glyph: '⁂',
      purpose: 'Three wins, three gratitudes, three goals. End of day, every day.',
      about: 'At the end of the day, three of each. That is the whole method.\n\n' +
             'The third box is the one that does the work. Deciding tomorrow\'s three wins ' +
             'tonight is a genuine catalyst, because you get to choose what kind of win you ' +
             'need — and you have enough freedom here to change your mind about it:\n\n' +
             '  Time-bound — finish the workout in 25 minutes.\n' +
             '  Number-bound — read 15 pages of the latest Stephen King.\n' +
             '  General — talk to parents and friends.\n\n' +
             'Having a clear pathway for tomorrow does not stop you doing anything else. It ' +
             'lays a foundation the day gets conquered from.',
      sections: [
        { label: 'Three wins from today', lines: 3,
          prompt: 'Things that actually happened. They do not have to be impressive.' },
        { label: 'Three things I have gratitude for', lines: 3,
          prompt: 'Specific beats general. "The coffee" beats "my life".' },
        { label: 'Three goals for tomorrow', lines: 3,
          prompt: 'Choose the kind of win you need: time-bound, number-bound, or general.' }
      ]
    },
    {
      // NOT an ordinary journal. `system: 'hia'` makes
      // asclepion-journal.html render the working method — the
      // goal, the three actions, the thirty squares — above the
      // entries. The prose below is the article it comes from.
      //
      // This replaced a journal called Unstick, which was a method
      // invented to fill a title that arrived without one. This is
      // the real thing, so the invention is gone.
      key: 'hia',
      system: 'hia',
      name: 'High Impact Actions',
      glyph: '⟡',
      purpose: 'Three steps, one tracker, and the rule that never skip twice.',
      about:
        'An action-packed, three-step method to keep you on track every day.\n\n' +
        'You are 100% committed to work effectively towards your goal today. But then… ' +
        'nothing happens. So, with a strong resolve, you commit not to procrastinate ' +
        'tomorrow, only to watch with horror as your monkey mind joyfully hops all over the ' +
        'place, engaging in anything but the one thing that you should be doing.\n\n' +
        'Two things you need to know in order to beat procrastination:\n\n' +
        '— You need to start doing the important task at any cost, and stay focused for long ' +
        'enough to get it done. Nobody can do that for you.\n' +
        '— You can use a system to help you. That is what the page below is.\n\n' +
        'You will need twenty minutes to set it up, and then one to ten minutes every day to ' +
        'keep yourself on track.\n\n' +
        'What the author noticed after a few months of using it: the number of days spent ' +
        'procrastinating dropped sharply — five in a month; even on those days the minimum ' +
        'required to make progress still got done, all but once; and getting back on track ' +
        'the following day became easy.\n\n' +
        '§1 · DEFINE THE GOAL\n' +
        'If you do not know where you are going, you will likely end up somewhere else. Your ' +
        'goal is your compass, so keep it visible — which is why it sits at the top of this ' +
        'page and not behind a click.\n\n' +
        'It can be a specific quest (write a thesis), a behaviour (meditate an hour every ' +
        'day) or a principle to live by (win-win or no deal). Make it as specific as you can. ' +
        '"Run a marathon" is not specific. "Run a marathon within a year" is better. "Run the ' +
        'Edinburgh Marathon in 2020" is better still.\n\n' +
        '§2 · BREAK IT DOWN\n' +
        'We are naturally wired to avoid what is hard. Procrastination is a negative habit ' +
        'loop: the goal seems hard to achieve; challenging emotions surface — self-doubt, ' +
        'anxiety, stress; procrastination provides temporary emotional relief, especially the ' +
        'socially acceptable kind like reading or tidying up; and then awareness of having ' +
        'procrastinated reinforces those same emotions, which closes the loop and begins a ' +
        'new cycle. It is a trap.\n\n' +
        'To break the cycle, start at the beginning: break the goal down into simple actions. ' +
        'But not just any actions — High Impact Actions. They are few (aim for no more than ' +
        'three), within your control, habitual enough to do every day, and highly predictive ' +
        'of your success: if you do those things, you are most likely to achieve the goal.\n\n' +
        'If the goal were to write a thesis, they might be: study for an hour every day; ' +
        'write for an hour every day; plan tomorrow\'s writing, an hour every day. That gives ' +
        'three things to do daily. It stops being about writing a thesis, which seems ' +
        'complicated and hard, and becomes about maintaining three habits, which seems clear ' +
        'and easy.\n\n' +
        'If you are engaging in something that is not one of your High Impact Actions, then ' +
        'you are likely procrastinating.\n\n' +
        '§3 · TRACK AND OPTIMIZE\n' +
        'One square is one day. If you complete all of your High Impact Actions that day, you ' +
        'mark the square with a symbol you like.\n\n' +
        'NEVER SKIP TWICE. According to the research, skipping twice in a row is what breaks ' +
        'habits — not skipping once.\n\n' +
        'If you miss a day, for whatever reason, complete a review. Ask: why didn\'t I ' +
        'complete my High Impact Actions today? And then: what measures can I put in place to ' +
        'make sure that this will not prevent me from completing them ever again? Write the ' +
        'reflections down — they are what you optimize the process from. Marking a day missed ' +
        'on the grid below opens that review for you.\n\n' +
        '§ THE ACTION PLAN\n' +
        'You know the goal. You know how to get there. And you have the system in place.\n\n' +
        'Every morning, look at your goal and your High Impact Actions. Then complete them. ' +
        'If you fail, review why it happened and make sure it does not happen again.\n\n' +
        'And remember: never, ever, skip twice.\n\n' +
        'Bottom line — there are various tricks that can help, but you need to do the work. ' +
        'And you are more than capable of doing it.',
      // The article's own two diagrams. Rendered where the §
      // markers above put them, by the journal view.
      figures: [
        { after: '§2', src: 'images_by_admin/asclepion/hia-tracker.webp',
          caption: 'The page itself: the goal along the top, the High Impact Actions as columns, and the tracking symbol in its own column on the right.' },
        { after: '§3', src: 'images_by_admin/asclepion/hia-symbols.webp',
          caption: 'Some symbols from the author\'s partner\'s journal. Days missed are circled; the review usually needs a page of its own.' }
      ],
      // Used for the review that opens when you mark a day missed.
      sections: [
        { label: 'Why didn\'t I complete my High Impact Actions today?',
          prompt: 'The real reason, not the presentable one. This is the half that makes the next box possible.' },
        { label: 'What will I put in place so it cannot stop me again?',
          prompt: 'A measure, not a resolution. Something that changes the conditions rather than asking more of your willpower.' }
      ]
    }
  ];

  // ===========================================================
  // THE EXAMPLE ENTRY
  //
  // A worked example, shown collapsed at the top of every entry
  // and reachable inside composition mode. It is here rather than
  // in the renderer because it is content, and because it is the
  // sort of thing you would want to swap for one of your own.
  //
  // It is deliberately an ordinary day rather than a remarkable
  // one — the point it demonstrates is that specificity, not
  // significance, is what makes a journal entry worth rereading.
  // ===========================================================
  S.exampleEntry = {
    title: 'Example diary entry',
    note: 'Not a template — a demonstration. Notice how little happens in it, and how much of it you can still see.',
    paragraphs: [
      'The day all started with a six-dollar hot dog.',
      'Eric and I met up at the station and decided to go for a bike ride, and halfway to the hire we realized that we didn\'t have lunch.',
      'There was a hot dog stand near the sidewalk, and we went up to it.',
      'A Turkish woman was running the stand, and I ordered a hot dog.',
      '"Would you like a drink with that?" she said.',
      '"Oh yeah, sure," I said and pulled out my card.',
      'She said, "That\'ll be $9.60, please."',
      '$9.60 was completely ridiculous even to Melbourne standards, but it was way too late. The sausage was ready on the grill and halfway toward being quite hot.',
      'I sat down on a rock with Eric and looked at the tomato sauce on the stand.',
      '"Don\'t you think that thing\'s full of germs?" I said. "I\'d never squeeze anything out of that thing on my hot dog."',
      '"Well, if not, you\'d have to have it plain," he said. "Pick your poison, because they\'re both poisons."',
      'I weighed my options and decided that unless someone had deliberately suckled on the end of that tomato sauce bottle, it should be safe enough for a squeeze.',
      'Because eating a plain hot dog — that\'s just a crime.',
      'I had a lot of tomato sauce on my hot dog, and I took a bite.',
      'It was terrible.',
      '"Not bad for $9.60," Eric giggled.',
      'The first bike rental place was closed, and we went up to a second place across the river.',
      'It was called Blue Tongue Bike Hire, and the guy in there had a golden beard.',
      '"Do you have an ID I can keep around for your hire?" he said.',
      '"Well, sure," I said and gave him my driver\'s permit.',
      'He took it and shoved it in a drawer, and I never felt so unsafe leaving one of my most important identifications with a stranger.',
      '"Well, see you around here in two hours."',
      'Eric smiled and took the lead of the bikes.',
      'The bike lanes were especially narrow around the streets of Melbourne, but it was really intuitive.',
      'A few crossroads later, we ended up on Melbourne University\'s campus.',
      'It was a gorgeous sight, but the ride there was anything but that.',
      'My legs were aching, and I was completely out of it.',
      'I bought a Coke out of a vending machine and drank it, only to find out that Eric wouldn\'t be riding me back to the train station.',
      '"Just follow the bike lane, and you should be able to find your way back. I\'m staying here to study."',
      'I cursed under my breath and went through to the bike lane.',
      'Nothing\'s ever more horrifying than riding a bike beside motor vehicles.',
      'At Swanston\'s main junction, it was a free-for-all, and everyone wanted to gain the upper hand.',
      'I almost got run over by a car doing a left turn, but in the end I managed to escape it.',
      'All right, riding a bike in a city was quite an experience.',
      'You\'re in a no-man\'s-land of discomfort, and the only security you really have is your steer and whatever biking skills you\'ve inherited from when you were seven.',
      'But my opinion-in-the-ass seven-year-old self served me quite well.',
      'I got back to the rental place in one piece, and I was two minutes over time.',
      'After checking the bike in, I caught a train back home.',
      'At the stairs, a kid was crying at seemingly nothing.',
      'His mother turned around and smiled at me.',
      '"He\'s afraid of heights."',
      'I looked at those three flights of stairs the kid considered as cry-worthy height, and I figured I\'d had enough of the city.',
      'I tapped my ticket, and I went home.'
    ]
  };

  // ===========================================================
  // EFT — twelve topics.
  //
  // Every one has the same six parts, because the session runner
  // walks them in the same order every time and a session you
  // have to re-learn the shape of is a session you skip:
  //
  //   1. setup      three statements, tapped on the karate chop
  //   2. points     the diagram, if you need it
  //   3. round 1    ACKNOWLEDGE. what is actually true right now.
  //   4. round 2    LOOSEN. the first move away from it.
  //   5. reframe    the positive round.
  //   6. after      the second 0-10 reading.
  //
  // Round 1 is deliberately unflattering. Tapping while telling
  // yourself something you do not believe is the most common way
  // people get nothing out of this — the round has to start where
  // you actually are or there is nothing to move.
  //
  // Eight lines per round, one per point, in tapping order:
  // eyebrow, side of eye, under eye, under nose, chin,
  // collarbone, under arm, top of head.
  // ===========================================================
  S.eft = [
    {
      name: 'Anxiety',
      blurb: 'For when the body has decided something is wrong and will not be talked out of it.',
      setup: [
        'Even though I feel all this anxiety in my body right now, I deeply and completely accept myself.',
        'Even though my body has decided something is wrong and I cannot reason it out of that, I accept how I feel.',
        'Even though I do not know exactly what this is about, I am safe enough to feel it.'
      ],
      round1: [
        { point: 'eb', phrase: 'All this anxiety.' },
        { point: 'se', phrase: 'This tightness in my chest.' },
        { point: 'ue', phrase: 'My body thinks something is coming.' },
        { point: 'un', phrase: 'And I cannot argue it out of that.' },
        { point: 'ch', phrase: 'It has been sitting here all day.' },
        { point: 'cb', phrase: 'I cannot get a full breath.' },
        { point: 'ua', phrase: 'I am so tired of feeling like this.' },
        { point: 'th', phrase: 'All of this anxiety.' }
      ],
      round2: [
        { point: 'eb', phrase: 'But this is my body trying to protect me.' },
        { point: 'se', phrase: 'It is doing the only thing it knows how to do.' },
        { point: 'ue', phrase: 'It is not wrong about danger, it is just early.' },
        { point: 'un', phrase: 'I am in a room, and I am safe in it.' },
        { point: 'ch', phrase: 'Nothing is happening right this second.' },
        { point: 'cb', phrase: 'I am allowed to put some of this down.' },
        { point: 'ua', phrase: 'Some of it can leave now.' },
        { point: 'th', phrase: 'It is already less than it was.' }
      ],
      reframe: [
        { point: 'eb', phrase: 'I am safe in this moment.' },
        { point: 'se', phrase: 'My body is beginning to settle.' },
        { point: 'ue', phrase: 'I can feel my breath again.' },
        { point: 'un', phrase: 'Whatever is coming, I will meet it then, not now.' },
        { point: 'ch', phrase: 'I am allowed to be calm.' },
        { point: 'cb', phrase: 'There is more room in my chest.' },
        { point: 'ua', phrase: 'I am okay right now.' },
        { point: 'th', phrase: 'I am here, and I am okay.' }
      ],
      closing: 'Stop. Take one long breath out. Then read the number again — and be honest if it has not moved much, because a second pass on an honest six does more than a first pass on a pretend three.'
    },
    {
      name: 'Stress',
      blurb: 'For too much at once, and no obvious thing to put down.',
      setup: [
        'Even though there is too much and I cannot see the end of it, I deeply and completely accept myself.',
        'Even though I am carrying all of this at the same time, I accept myself and how I feel.',
        'Even though I do not have room for any of this, I choose to be on my own side about it.'
      ],
      round1: [
        { point: 'eb', phrase: 'There is too much.' },
        { point: 'se', phrase: 'All of it, at the same time.' },
        { point: 'ue', phrase: 'And none of it can wait.' },
        { point: 'un', phrase: 'My shoulders have been up all day.' },
        { point: 'ch', phrase: 'I am running and not arriving.' },
        { point: 'cb', phrase: 'I cannot think clearly enough to prioritise.' },
        { point: 'ua', phrase: 'All this pressure.' },
        { point: 'th', phrase: 'All of this stress.' }
      ],
      round2: [
        { point: 'eb', phrase: 'But it is not all happening right now.' },
        { point: 'se', phrase: 'Most of it is happening in my head, in advance.' },
        { point: 'ue', phrase: 'Only one thing can be done at a time anyway.' },
        { point: 'un', phrase: 'I do not have to hold all of it to do the next bit.' },
        { point: 'ch', phrase: 'My shoulders can come down.' },
        { point: 'cb', phrase: 'I am allowed to set some of it down while I work.' },
        { point: 'ua', phrase: 'It will still be there. I do not need to carry it.' },
        { point: 'th', phrase: 'I can loosen my grip a little.' }
      ],
      reframe: [
        { point: 'eb', phrase: 'One thing at a time.' },
        { point: 'se', phrase: 'I know what the next thing is.' },
        { point: 'ue', phrase: 'My shoulders are down.' },
        { point: 'un', phrase: 'I am steady enough to start.' },
        { point: 'ch', phrase: 'I am allowed to work at a human pace.' },
        { point: 'cb', phrase: 'The rest can wait its turn.' },
        { point: 'ua', phrase: 'I have handled more than this before.' },
        { point: 'th', phrase: 'One thing at a time, and I am fine.' }
      ],
      closing: 'Before you get up: name the single next action out loud. Stress usually comes back the moment the list becomes abstract again.'
    },
    {
      name: 'Fear',
      blurb: 'For a specific thing you are afraid of, named out loud.',
      setup: [
        'Even though I am afraid of this, I deeply and completely accept myself.',
        'Even though part of me is certain it will go badly, I accept myself and how I feel.',
        'Even though I would rather not look at this directly, I am willing to look at it now.'
      ],
      round1: [
        { point: 'eb', phrase: 'This fear.' },
        { point: 'se', phrase: 'I know exactly what I am afraid of.' },
        { point: 'ue', phrase: 'And I have already watched it go wrong in my head.' },
        { point: 'un', phrase: 'Several times.' },
        { point: 'ch', phrase: 'My body reacts as if it has already happened.' },
        { point: 'cb', phrase: 'I do not want to face it.' },
        { point: 'ua', phrase: 'All of this fear.' },
        { point: 'th', phrase: 'This fear, right here.' }
      ],
      round2: [
        { point: 'eb', phrase: 'But rehearsing it is not the same as it happening.' },
        { point: 'se', phrase: 'I have been wrong about how things would go before.' },
        { point: 'ue', phrase: 'Often, in fact.' },
        { point: 'un', phrase: 'And if the worst did happen, I would still be here.' },
        { point: 'ch', phrase: 'Fear is not a prediction.' },
        { point: 'cb', phrase: 'It is a warning that has not checked its facts.' },
        { point: 'ua', phrase: 'I can be afraid and still go.' },
        { point: 'th', phrase: 'Some of this can go now.' }
      ],
      reframe: [
        { point: 'eb', phrase: 'I can be afraid and do it anyway.' },
        { point: 'se', phrase: 'That is the only kind of brave there is.' },
        { point: 'ue', phrase: 'I am more capable than I feel right now.' },
        { point: 'un', phrase: 'Whatever happens, I will handle it.' },
        { point: 'ch', phrase: 'I have handled every other thing I was sure I could not.' },
        { point: 'cb', phrase: 'I am steadier than this fear says.' },
        { point: 'ua', phrase: 'I can walk toward it.' },
        { point: 'th', phrase: 'I am ready enough.' }
      ],
      closing: 'If the number barely moved, the fear underneath is probably a different one. Run it again with the more embarrassing sentence.'
    },
    {
      name: 'Overthinking',
      blurb: 'For the loop that feels like problem-solving and is not.',
      setup: [
        'Even though my mind will not stop turning this over, I deeply and completely accept myself.',
        'Even though I have thought about this a hundred times and gained nothing, I accept myself and how I feel.',
        'Even though thinking feels safer than deciding, I accept where I am.'
      ],
      round1: [
        { point: 'eb', phrase: 'Round and round.' },
        { point: 'se', phrase: 'The same loop, again.' },
        { point: 'ue', phrase: 'I have already thought this exact thought today.' },
        { point: 'un', phrase: 'It feels like I am working on it.' },
        { point: 'ch', phrase: 'But nothing new has arrived in hours.' },
        { point: 'cb', phrase: 'I cannot put it down.' },
        { point: 'ua', phrase: 'My head is exhausting.' },
        { point: 'th', phrase: 'All this thinking.' }
      ],
      round2: [
        { point: 'eb', phrase: 'But thinking is not the same as deciding.' },
        { point: 'se', phrase: 'And I already know what I think.' },
        { point: 'ue', phrase: 'The loop is not looking for an answer.' },
        { point: 'un', phrase: 'It is looking for a guarantee, and there is not one.' },
        { point: 'ch', phrase: 'I am allowed to act without being certain.' },
        { point: 'cb', phrase: 'I can let the question sit unanswered.' },
        { point: 'ua', phrase: 'The loop can slow down.' },
        { point: 'th', phrase: 'It is already quieter.' }
      ],
      reframe: [
        { point: 'eb', phrase: 'My mind can rest.' },
        { point: 'se', phrase: 'I do not have to solve this tonight.' },
        { point: 'ue', phrase: 'I trust myself to know when it is time to decide.' },
        { point: 'un', phrase: 'Uncertainty is survivable.' },
        { point: 'ch', phrase: 'I can leave the question open.' },
        { point: 'cb', phrase: 'My head is quieter.' },
        { point: 'ua', phrase: 'I am allowed to think about something else.' },
        { point: 'th', phrase: 'Quiet.' }
      ],
      closing: 'The loop restarts fastest with nothing else to do. Go straight into something with your hands in it.'
    },
    {
      name: 'Self-Doubt',
      blurb: 'For the voice that arrives exactly when you are about to try.',
      setup: [
        'Even though I do not think I am good enough for this, I deeply and completely accept myself.',
        'Even though part of me is certain I will be found out, I accept myself and how I feel.',
        'Even though I doubt myself, I am willing to act anyway.'
      ],
      round1: [
        { point: 'eb', phrase: 'This doubt.' },
        { point: 'se', phrase: 'Who am I to be doing this.' },
        { point: 'ue', phrase: 'Someone else would do it better.' },
        { point: 'un', phrase: 'They are going to see through me.' },
        { point: 'ch', phrase: 'I have got away with it so far.' },
        { point: 'cb', phrase: 'All this doubt.' },
        { point: 'ua', phrase: 'It arrives right when I am about to start.' },
        { point: 'th', phrase: 'Every time.' }
      ],
      round2: [
        { point: 'eb', phrase: 'But the timing gives it away.' },
        { point: 'se', phrase: 'It never shows up when I am doing nothing.' },
        { point: 'ue', phrase: 'It shows up when I am about to be seen.' },
        { point: 'un', phrase: 'That is not an assessment. That is a reflex.' },
        { point: 'ch', phrase: 'And I have done things I doubted I could do.' },
        { point: 'cb', phrase: 'More than once.' },
        { point: 'ua', phrase: 'The doubt was wrong then too.' },
        { point: 'th', phrase: 'Some of this can go.' }
      ],
      reframe: [
        { point: 'eb', phrase: 'I am allowed to take up this space.' },
        { point: 'se', phrase: 'I do not need to be certain to begin.' },
        { point: 'ue', phrase: 'I have evidence, and I have been collecting it.' },
        { point: 'un', phrase: 'I know more than I give myself credit for.' },
        { point: 'ch', phrase: 'Being new at something is not being a fraud.' },
        { point: 'cb', phrase: 'I can do this badly first and well later.' },
        { point: 'ua', phrase: 'I trust myself enough to start.' },
        { point: 'th', phrase: 'I am enough for this.' }
      ],
      closing: 'Open the Evidence Journal afterwards. Doubt argues with feelings and loses to records.'
    },
    {
      name: 'Procrastination',
      blurb: 'For the thing that has been on the list for eleven days.',
      setup: [
        'Even though I am still not doing this, I deeply and completely accept myself.',
        'Even though I do not fully know why I am avoiding it, I accept myself and how I feel.',
        'Even though I have made this harder by leaving it, I am not going to punish myself for it now.'
      ],
      round1: [
        { point: 'eb', phrase: 'I am still not doing it.' },
        { point: 'se', phrase: 'It has been on the list for days.' },
        { point: 'ue', phrase: 'It gets heavier every day I leave it.' },
        { point: 'un', phrase: 'And the heavier it gets, the less I want to start.' },
        { point: 'ch', phrase: 'I keep doing everything except this.' },
        { point: 'cb', phrase: 'I am annoyed at myself.' },
        { point: 'ua', phrase: 'Which has not helped once.' },
        { point: 'th', phrase: 'All this avoidance.' }
      ],
      round2: [
        { point: 'eb', phrase: 'But this is not laziness.' },
        { point: 'se', phrase: 'There is a feeling under it I have not looked at.' },
        { point: 'ue', phrase: 'Maybe it is that I might do it badly.' },
        { point: 'un', phrase: 'Maybe it is just that it is boring and I resent it.' },
        { point: 'ch', phrase: 'Either way, avoiding it costs more than doing it.' },
        { point: 'cb', phrase: 'And it is smaller than it has become in my head.' },
        { point: 'ua', phrase: 'I could do five minutes of it.' },
        { point: 'th', phrase: 'Five minutes is not a decision.' }
      ],
      reframe: [
        { point: 'eb', phrase: 'I can start without wanting to.' },
        { point: 'se', phrase: 'Motivation comes after, not before.' },
        { point: 'ue', phrase: 'I only have to do the first small piece.' },
        { point: 'un', phrase: 'Badly done is further along than not started.' },
        { point: 'ch', phrase: 'I am allowed to do this imperfectly.' },
        { point: 'cb', phrase: 'The relief afterwards is worth more than the comfort now.' },
        { point: 'ua', phrase: 'I am starting today.' },
        { point: 'th', phrase: 'I am starting now.' }
      ],
      closing: 'Do not close this and plan. Open Unstick, fill the last box only, and go.'
    },
    {
      name: 'Shame',
      blurb: 'For the thing you would not want said out loud. Go gently here.',
      setup: [
        'Even though I feel this shame, and I do not want to look at it, I deeply and completely accept myself.',
        'Even though part of me believes I am the problem, I accept myself and how I feel.',
        'Even though this is hard to say even alone, I am willing to say it.'
      ],
      round1: [
        { point: 'eb', phrase: 'This shame.' },
        { point: 'se', phrase: 'I do not want anyone to know this about me.' },
        { point: 'ue', phrase: 'It is heavy and it is old.' },
        { point: 'un', phrase: 'It does not say I did something bad.' },
        { point: 'ch', phrase: 'It says I am something bad.' },
        { point: 'cb', phrase: 'I want to disappear when I think about it.' },
        { point: 'ua', phrase: 'All of this shame.' },
        { point: 'th', phrase: 'All of it.' }
      ],
      round2: [
        { point: 'eb', phrase: 'But shame only survives in the dark.' },
        { point: 'se', phrase: 'And I have just said it, here, to myself.' },
        { point: 'ue', phrase: 'That already changes something.' },
        { point: 'un', phrase: 'What I did and what I am are different things.' },
        { point: 'ch', phrase: 'I was doing what I knew how to do at the time.' },
        { point: 'cb', phrase: 'I would forgive anyone else for this.' },
        { point: 'ua', phrase: 'I am allowed the same.' },
        { point: 'th', phrase: 'It can weigh less than it did.' }
      ],
      reframe: [
        { point: 'eb', phrase: 'I am a person who did a thing, not a bad thing that walks around.' },
        { point: 'se', phrase: 'I can hold this without being crushed by it.' },
        { point: 'ue', phrase: 'I have already changed since then.' },
        { point: 'un', phrase: 'I am allowed to be human about it.' },
        { point: 'ch', phrase: 'I can be honest and still be okay.' },
        { point: 'cb', phrase: 'I am worthy of my own kindness.' },
        { point: 'ua', phrase: 'I forgive myself for this.' },
        { point: 'th', phrase: 'I am still worth something.' }
      ],
      closing: 'This one often needs more than one pass, and it is normal for the number to move slowly. Stop while you still feel steady. There is no prize for finishing.'
    },
    {
      name: 'Anger',
      blurb: 'For anger that has nowhere to go. It does not need justifying first.',
      setup: [
        'Even though I am furious about this, I deeply and completely accept myself.',
        'Even though I have nowhere to put this anger, I accept myself and how I feel.',
        'Even though part of me thinks I should not feel this strongly, I am allowed to.'
      ],
      round1: [
        { point: 'eb', phrase: 'This anger.' },
        { point: 'se', phrase: 'I am furious.' },
        { point: 'ue', phrase: 'And I am right to be.' },
        { point: 'un', phrase: 'It was not fair.' },
        { point: 'ch', phrase: 'It is sitting in my jaw and my hands.' },
        { point: 'cb', phrase: 'And there is nowhere to put it.' },
        { point: 'ua', phrase: 'All this anger.' },
        { point: 'th', phrase: 'All of it, with nowhere to go.' }
      ],
      round2: [
        { point: 'eb', phrase: 'But it does not have to be justified to be released.' },
        { point: 'se', phrase: 'I can be right and still put it down.' },
        { point: 'ue', phrase: 'Carrying it is not the same as being taken seriously.' },
        { point: 'un', phrase: 'It is costing me more than it is costing them.' },
        { point: 'ch', phrase: 'There is usually hurt underneath this.' },
        { point: 'cb', phrase: 'And the hurt is allowed too.' },
        { point: 'ua', phrase: 'My jaw can unclench.' },
        { point: 'th', phrase: 'Some of this heat can leave.' }
      ],
      reframe: [
        { point: 'eb', phrase: 'I can feel this without being run by it.' },
        { point: 'se', phrase: 'My anger tells me a boundary was crossed.' },
        { point: 'ue', phrase: 'I have heard it. It can stand down now.' },
        { point: 'un', phrase: 'I choose what I do next.' },
        { point: 'ch', phrase: 'My hands are loose.' },
        { point: 'cb', phrase: 'My jaw is loose.' },
        { point: 'ua', phrase: 'I am cooler than I was.' },
        { point: 'th', phrase: 'I am in charge of this, not the other way round.' }
      ],
      closing: 'If this leaves you flat rather than calm, that is usually the hurt arriving. Grounding, or the Inner Work Journal, is the better next step than another round.'
    },
    {
      name: 'Confidence',
      blurb: 'Before the thing. Not a session for after it has gone badly.',
      setup: [
        'Even though I do not feel ready for this, I deeply and completely accept myself.',
        'Even though part of me wants to shrink, I accept myself and how I feel.',
        'Even though I do not feel confident, I choose to act like someone who is.'
      ],
      round1: [
        { point: 'eb', phrase: 'I do not feel ready.' },
        { point: 'se', phrase: 'I want to make myself smaller.' },
        { point: 'ue', phrase: 'I am worried about how I will come across.' },
        { point: 'un', phrase: 'I am watching myself from outside.' },
        { point: 'ch', phrase: 'That is not helping.' },
        { point: 'cb', phrase: 'All this self-consciousness.' },
        { point: 'ua', phrase: 'I would rather not be seen.' },
        { point: 'th', phrase: 'All of it.' }
      ],
      round2: [
        { point: 'eb', phrase: 'But confidence is not a feeling I have to wait for.' },
        { point: 'se', phrase: 'It is what happens after doing the thing, not before.' },
        { point: 'ue', phrase: 'Nobody watching me is watching as closely as I am.' },
        { point: 'un', phrase: 'I can stand up straight even feeling like this.' },
        { point: 'ch', phrase: 'I have prepared. I know what I am doing.' },
        { point: 'cb', phrase: 'I can let myself take up the room I am in.' },
        { point: 'ua', phrase: 'Some of this can go.' },
        { point: 'th', phrase: 'I am steadier than a minute ago.' }
      ],
      reframe: [
        { point: 'eb', phrase: 'I am allowed to be seen.' },
        { point: 'se', phrase: 'I have something worth saying.' },
        { point: 'ue', phrase: 'I am calm in my own body.' },
        { point: 'un', phrase: 'I do not need everyone to approve.' },
        { point: 'ch', phrase: 'I trust myself in the room.' },
        { point: 'cb', phrase: 'I can take up space.' },
        { point: 'ua', phrase: 'I am ready enough, and ready enough is ready.' },
        { point: 'th', phrase: 'I have got this.' }
      ],
      closing: 'Stand up before you finish. This one does not hold if you do it slumped.'
    },
    {
      name: 'Sleep',
      blurb: 'For a body that will not switch off. Run it in bed, in the dark.',
      setup: [
        'Even though my body will not switch off, I deeply and completely accept myself.',
        'Even though my mind starts up the moment it goes quiet, I accept myself and how I feel.',
        'Even though I am frustrated about being awake, I am going to be gentle about it.'
      ],
      round1: [
        { point: 'eb', phrase: 'I am still awake.' },
        { point: 'se', phrase: 'My body will not switch off.' },
        { point: 'ue', phrase: 'My mind started the moment it got quiet.' },
        { point: 'un', phrase: 'Tomorrow is going to be harder because of this.' },
        { point: 'ch', phrase: 'Which is not making me sleepier.' },
        { point: 'cb', phrase: 'I am wired and I am tired.' },
        { point: 'ua', phrase: 'All this restlessness.' },
        { point: 'th', phrase: 'Still awake.' }
      ],
      round2: [
        { point: 'eb', phrase: 'But nothing has to be solved tonight.' },
        { point: 'se', phrase: 'Nothing on that list is a night-time problem.' },
        { point: 'ue', phrase: 'Lying still and resting counts for something.' },
        { point: 'un', phrase: 'Sleep is not a test I can fail.' },
        { point: 'ch', phrase: 'My body knows how to do this.' },
        { point: 'cb', phrase: 'It has done it thousands of times.' },
        { point: 'ua', phrase: 'I can let it get heavy.' },
        { point: 'th', phrase: 'Heavier already.' }
      ],
      reframe: [
        { point: 'eb', phrase: 'It is safe to let go now.' },
        { point: 'se', phrase: 'There is nothing I need to be awake for.' },
        { point: 'ue', phrase: 'My body is heavy and warm.' },
        { point: 'un', phrase: 'My breathing is slowing on its own.' },
        { point: 'ch', phrase: 'Tomorrow will be handled tomorrow.' },
        { point: 'cb', phrase: 'I am allowed to rest.' },
        { point: 'ua', phrase: 'I am sinking.' },
        { point: 'th', phrase: 'Letting go.' }
      ],
      closing: 'Do not check the number. Go straight into 4-7-8 and stop there.'
    },
    {
      name: 'Abundance',
      blurb: 'For the tightness around money, opportunity, and having enough.',
      setup: [
        'Even though I am afraid there will not be enough, I deeply and completely accept myself.',
        'Even though I feel behind, I accept myself and where I am.',
        'Even though part of me does not believe good things are for me, I am open to being wrong.'
      ],
      round1: [
        { point: 'eb', phrase: 'This tightness about money.' },
        { point: 'se', phrase: 'The fear that there will not be enough.' },
        { point: 'ue', phrase: 'I feel behind everyone else.' },
        { point: 'un', phrase: 'It always seems to come to other people more easily.' },
        { point: 'ch', phrase: 'I am bracing for something to go wrong.' },
        { point: 'cb', phrase: 'It is hard to want things out loud.' },
        { point: 'ua', phrase: 'All this scarcity.' },
        { point: 'th', phrase: 'All of this.' }
      ],
      round2: [
        { point: 'eb', phrase: 'But bracing has never once made more arrive.' },
        { point: 'se', phrase: 'Fear makes me small, and small does not earn.' },
        { point: 'ue', phrase: 'This is mostly an old inheritance, not a forecast.' },
        { point: 'un', phrase: 'I have had enough before and did not notice.' },
        { point: 'ch', phrase: 'Wanting something is not greedy.' },
        { point: 'cb', phrase: 'Other people having things does not take from me.' },
        { point: 'ua', phrase: 'I can loosen this grip.' },
        { point: 'th', phrase: 'A little looser already.' }
      ],
      reframe: [
        { point: 'eb', phrase: 'There is enough, and I am allowed some of it.' },
        { point: 'se', phrase: 'I am allowed to want more than I have.' },
        { point: 'ue', phrase: 'Opportunities are for people like me.' },
        { point: 'un', phrase: 'I can receive without flinching.' },
        { point: 'ch', phrase: 'I am building something.' },
        { point: 'cb', phrase: 'I am not behind. I am on my own line.' },
        { point: 'ua', phrase: 'I am open to good things arriving.' },
        { point: 'th', phrase: 'There is enough.' }
      ],
      closing: 'Then do one concrete thing about it — a number checked, an email sent. This one goes stale fastest if it stays a feeling.'
    },
    {
      name: 'Self-Worth',
      blurb: 'The deepest one here. Not about a situation — about the baseline.',
      setup: [
        'Even though somewhere I believe I am not worth much, I deeply and completely accept myself.',
        'Even though I have to earn my place before I am allowed to rest, I accept myself and how I feel.',
        'Even though this one is old and I cannot argue it away, I am willing to loosen it.'
      ],
      round1: [
        { point: 'eb', phrase: 'This feeling that I am not worth much.' },
        { point: 'se', phrase: 'That I have to earn my place, every day.' },
        { point: 'ue', phrase: 'That I am only as good as what I produced this week.' },
        { point: 'un', phrase: 'I cannot rest without feeling I am getting away with something.' },
        { point: 'ch', phrase: 'It is not about today. It is much older than today.' },
        { point: 'cb', phrase: 'I have believed it for a long time.' },
        { point: 'ua', phrase: 'All of this.' },
        { point: 'th', phrase: 'All of this, and how tired it makes me.' }
      ],
      round2: [
        { point: 'eb', phrase: 'But I learned this. It did not come with me.' },
        { point: 'se', phrase: 'Someone taught it, and I believed them.' },
        { point: 'ue', phrase: 'I do not apply this rule to anyone else.' },
        { point: 'un', phrase: 'I would never say this to a person I loved.' },
        { point: 'ch', phrase: 'Worth is not a wage.' },
        { point: 'cb', phrase: 'It is not something I have to keep re-earning.' },
        { point: 'ua', phrase: 'I can loosen my hold on this.' },
        { point: 'th', phrase: 'Just a little, for now.' }
      ],
      reframe: [
        { point: 'eb', phrase: 'I am worth something as I am.' },
        { point: 'se', phrase: 'Not because of what I produced.' },
        { point: 'ue', phrase: 'I am allowed to rest without having earned it.' },
        { point: 'un', phrase: 'I am allowed to take up room.' },
        { point: 'ch', phrase: 'I can be kind to myself on a bad day.' },
        { point: 'cb', phrase: 'I would want this for anyone else. I am included.' },
        { point: 'ua', phrase: 'I matter.' },
        { point: 'th', phrase: 'I matter, and that is not conditional.' }
      ],
      closing: 'This is the one that moves in tenths, not points. Do not judge it by one session — the Evidence Journal is where this argument is actually won, over months.'
    }
  ];

  // ===========================================================
  // THE FEEL ROUTER
  //
  // Seven feelings, each pointing at a category. This is the
  // front door to Yoga and it is the front door on purpose: on
  // the day you need it you know how you feel, and you do not
  // know whether what you need is yin or restorative.
  //
  // Not a collection — a constant. These seven are the shape of
  // the screen, not records to be edited, and a user-editable
  // router would let the page arrive at a feeling with nothing
  // behind it.
  // ===========================================================
  S.feelings = [
    { key: 'stiff',        label: 'Stiff',            to: 'mobility',    lead: 'Mobility Flow' },
    { key: 'anxious',      label: 'Anxious',          to: 'restorative', lead: 'Grounding Yoga' },
    { key: 'tired',        label: 'Tired',            to: 'restorative', lead: 'Gentle Yoga' },
    { key: 'restless',     label: 'Restless',         to: 'morning',     lead: 'Active Flow' },
    { key: 'wired',        label: 'Wired before bed', to: 'yin',         lead: 'Bedtime Yoga' },
    { key: 'sore',         label: 'Sore',             to: 'stretching',  lead: 'Recovery Flow' },
    { key: 'disconnected', label: 'Disconnected',     to: 'somatic',     lead: 'Somatic Movement' }
  ];

  // ===========================================================
  // YOGA & MOVEMENT
  //
  // NO URLS. Every practice below is described but unlinked, and
  // that is deliberate rather than unfinished: a seeded library
  // full of invented YouTube links is a library that is broken
  // the first time you trust it, and a dead link is worse than an
  // empty field because it costs you the tap to find out.
  //
  // Paste your own links in. The card shows an "Add link" state
  // until you do, and everything else about the record already
  // works.
  // ===========================================================
  S.yoga = [
    { title: 'Full-body mobility flow', category: 'mobility', minutes: 20,
      feelings: ['stiff'],
      description: 'Every major joint through its full range, in order, from the neck down to the ankles. The one to reach for when you have been at a desk and everything feels short.' },
    { title: 'Spine and shoulders', category: 'mobility', minutes: 12,
      feelings: ['stiff'],
      description: 'Cat-cow, thread the needle, thoracic rotations. Short, and aimed squarely at where a day of sitting collects.' },
    { title: 'Hips and hamstrings', category: 'mobility', minutes: 18,
      feelings: ['stiff', 'sore'],
      description: 'Low lunges, half splits, pigeon. Slow enough that the hips actually let go rather than bracing.' },

    { title: 'Grounding practice', category: 'restorative', minutes: 15,
      feelings: ['anxious'],
      description: 'Low to the floor and heavily supported the whole way. Child\'s pose, supported forward fold, legs up the wall. Weight and contact are the active ingredients.' },
    { title: 'Anxious body reset', category: 'restorative', minutes: 10,
      feelings: ['anxious'],
      description: 'For the day the anxiety is physical. Long holds, nothing to balance on, nothing to get right.' },
    { title: 'Gentle practice for a tired body', category: 'restorative', minutes: 15,
      feelings: ['tired'],
      description: 'Almost entirely seated and supine. Movement that asks nothing back — for the evening where doing nothing feels worse but doing anything feels impossible.' },
    { title: 'Supported rest', category: 'restorative', minutes: 25,
      feelings: ['tired', 'sore'],
      description: 'Four or five shapes, held for minutes each, with cushions doing all the work. Closer to sleep than to exercise, and that is the point.' },

    { title: 'Morning wake-up flow', category: 'morning', minutes: 15,
      feelings: ['restless'],
      description: 'Sun salutations, standing shapes, one balance. Enough to change your state before the day starts making decisions for you.' },
    { title: 'Active flow', category: 'morning', minutes: 25,
      feelings: ['restless'],
      description: 'Continuous and warm. For the restlessness that will not be sat still with and has to be spent first.' },
    { title: 'Short morning mobility', category: 'morning', minutes: 8,
      feelings: ['restless', 'stiff'],
      description: 'The version that survives a bad morning. Eight minutes, standing, no mat required.' },

    { title: 'Bedtime wind-down', category: 'yin', minutes: 20,
      feelings: ['wired'],
      description: 'Floor shapes held for three to five minutes. Done in dim light, ideally already in what you are sleeping in.' },
    { title: 'Yin for a wired mind', category: 'yin', minutes: 30,
      feelings: ['wired'],
      description: 'Long holds where the discomfort is mild and the mind has nowhere to go but the breath. The stillness is the practice, not the shape.' },
    { title: 'Legs up the wall', category: 'yin', minutes: 10,
      feelings: ['wired', 'tired', 'sore'],
      description: 'One shape, ten minutes, against an actual wall. The highest ratio of effect to effort on this page.' },

    { title: 'Post-workout stretch', category: 'stretching', minutes: 12,
      feelings: ['sore'],
      description: 'Quads, hamstrings, calves, chest, lats. Straight after training, while everything is still warm.' },
    { title: 'Recovery flow', category: 'stretching', minutes: 20,
      feelings: ['sore'],
      description: 'For the day after. Gentle range work rather than deep stretching — sore tissue does not want to be pulled on.' },
    { title: 'Desk recovery', category: 'stretching', minutes: 7,
      feelings: ['sore', 'stiff'],
      description: 'Neck, forearms, hip flexors, upper back. Can be done in normal clothes without lying down.' },

    { title: 'Somatic shaking and settling', category: 'somatic', minutes: 12,
      feelings: ['disconnected'],
      description: 'Shake first, then be completely still and notice what is left. The stillness afterwards is where the practice actually happens.' },
    { title: 'Body scan in movement', category: 'somatic', minutes: 15,
      feelings: ['disconnected'],
      description: 'Move one region at a time and pay attention to it while it moves. For when you have been living several inches above your own body.' },
    { title: 'Slow floor somatics', category: 'somatic', minutes: 20,
      feelings: ['disconnected', 'anxious'],
      description: 'Very small, very slow movements on the floor, led by curiosity rather than a sequence. Nothing to achieve and no shape to reach.' },

    { title: 'Evening unwind', category: 'evening', minutes: 15,
      feelings: ['wired', 'tired'],
      description: 'The transition practice — for the gap between finishing work and being a person again.' },
    { title: 'Evening full-body', category: 'evening', minutes: 30,
      feelings: ['stiff'],
      description: 'A longer evening session for a day with room in it. Everything, unhurried.' }
  ];

  // ===========================================================
  // ENERGY PRACTICES
  //
  // Five groups. Every practice has real steps, because "do a
  // grounding visualisation" is not an instruction — it is the
  // name of an instruction, and on the day you need it you will
  // not be in a state to fill in the rest.
  //
  // Written plainly and without cosmology. These work whether you
  // read them as energetic practice or as attention and
  // physiology, and nothing here asks you to decide which.
  // ===========================================================
  S.energy = [
    // --- GROUNDING -------------------------------------------
    { group: 'grounding', title: 'Grounding visualization', minutes: 5,
      summary: 'Roots down from the base of the spine into the ground, and weight arriving with them.',
      steps: [
        'Sit with both feet flat. Let your weight actually land in the chair.',
        'Picture a root running down from the base of your spine, through the floor, through everything under the floor, into the ground.',
        'Let it go further than feels reasonable. Deep, and thick, and slow.',
        'On each exhale, send whatever you are carrying down the root.',
        'On each inhale, draw something steady and cool back up.',
        'Stay until your body feels heavier than when you started. That heaviness is the whole point.'
      ] },
    { group: 'grounding', title: 'Rooting', minutes: 3,
      summary: 'Standing, barefoot if possible. Weight, contact, and nothing else.',
      steps: [
        'Stand with your feet about hip width apart. Bare feet if you can.',
        'Press down through all four corners of each foot — big toe, little toe, inner heel, outer heel.',
        'Rock very slightly forward and back until you find the place where you are genuinely balanced.',
        'Soften your knees. A locked knee cannot ground.',
        'Breathe down into your feet for ten breaths, as though the breath went that far.'
      ] },
    { group: 'grounding', title: 'Nature grounding', minutes: 15,
      summary: 'Outside, on actual ground, with your attention on the outside rather than the inside.',
      steps: [
        'Get outside. A garden, a park, a verge — it does not have to be beautiful.',
        'If you can, put your bare feet on grass or earth.',
        'Name five things you can see, then four you can hear, then three you can feel.',
        'Do not narrate. If a thought about your day arrives, go back to naming.',
        'Ten to fifteen minutes. Longer is better and shorter still works.'
      ] },
    { group: 'grounding', title: 'Body awareness', minutes: 6,
      summary: 'A scan from the feet up, with no attempt to change anything on the way.',
      steps: [
        'Sit or lie down. Close your eyes if that is comfortable.',
        'Start at your feet. What is actually there — temperature, pressure, tingling, nothing at all?',
        'Move up slowly: shins, knees, thighs, hips, belly, chest, hands, arms, shoulders, neck, face.',
        'Do not fix anything. You are taking an inventory, not doing repairs.',
        'When you reach the top, notice the whole body at once for a few breaths.'
      ] },

    // --- CLEANSING -------------------------------------------
    { group: 'cleansing', title: 'Energy clearing', minutes: 5,
      summary: 'A sweep from head to feet, brushing off what is not yours.',
      steps: [
        'Stand up. Shake your hands out for a few seconds.',
        'Starting at the top of your head, sweep your hands down over your body a few inches away from it — head, face, shoulders, arms, chest, belly, legs.',
        'At the end of each sweep, flick your hands away from you.',
        'Do the back of your body too, as far as you can reach.',
        'Three full passes. Then stand still and notice what changed.'
      ] },
    { group: 'cleansing', title: 'Cleansing visualization', minutes: 6,
      summary: 'Light entering at the crown, moving down, and taking the residue out through the feet.',
      steps: [
        'Sit comfortably. Take three slow breaths.',
        'Picture a clear light entering at the top of your head.',
        'Let it move down slowly, filling you like water fills a glass — head, throat, chest, belly, hips, legs.',
        'Anything cloudy or heavy it meets, it carries down with it.',
        'It leaves through the soles of your feet and goes into the ground, where it is composted rather than stored.',
        'Repeat until the light runs clear.'
      ] },
    { group: 'cleansing', title: 'Breath clearing', minutes: 4,
      summary: 'Sharp exhales through the mouth. Loud, and slightly undignified.',
      steps: [
        'Stand with your feet planted.',
        'Take a normal breath in through the nose.',
        'Exhale sharply through the mouth with a sound — a "ha" from the belly, not the throat.',
        'Ten of these. Let them be loud. Muffling it defeats the point.',
        'Then stop completely and stand still for thirty seconds without moving.'
      ] },
    { group: 'cleansing', title: 'Shower cleansing ritual', minutes: 8,
      summary: 'The one that needs no extra time in the day, because you were going to shower anyway.',
      steps: [
        'Get in. Stand under the water for a few seconds before doing anything else.',
        'As the water runs over your head and shoulders, decide it is carrying the day off you.',
        'Name what you are letting go of. Out loud if you are alone, silently if you are not.',
        'Turn slowly so the water reaches your back and neck.',
        'Before you get out, take one breath and name what you want to walk out with instead.'
      ] },

    // --- PROTECTION ------------------------------------------
    { group: 'protection', title: 'Energy shielding', minutes: 4,
      summary: 'A worn shield rather than a wall. Built in the morning, checked in the evening.',
      steps: [
        'Stand or sit. Feet on the floor.',
        'Picture a layer about a hand\'s width off your skin, covering you completely — including underneath your feet and above your head.',
        'Give it a texture. Mirrored, or woven, or simply solid; whatever you can actually picture.',
        'Set the rule: what is mine passes through, what is not mine does not.',
        'Check it once during the day. Repair anything thin.'
      ] },
    { group: 'protection', title: 'Bubble visualization', minutes: 3,
      summary: 'The fast one, for a doorway or a car park before you go in.',
      steps: [
        'One breath in.',
        'On the way out, picture a bubble expanding to about an arm\'s length around you.',
        'Make it a colour. The colour matters less than being definite about it.',
        'Say, internally: this is mine, and it holds.',
        'Walk in.'
      ] },
    { group: 'protection', title: 'Boundaries', minutes: 10,
      summary: 'The unmystical one. Naming a limit is what makes it exist.',
      steps: [
        'Name the person or situation you have been leaking into.',
        'Write, in one plain sentence, the limit you actually want. Not the diplomatic version — the true one.',
        'Ask: is this a limit on THEM, or a limit on what I will do? Rewrite it as the second one, because that is the only kind you can enforce.',
        'Decide what you will do the next time it is crossed.',
        'Say the sentence out loud once, to nobody. It has to have been said somewhere before it can be said to them.'
      ] },
    { group: 'protection', title: 'Cord visualization', minutes: 8,
      summary: 'For a relationship you are still carrying around after it is over.',
      steps: [
        'Sit somewhere you will not be interrupted. Bring the person to mind without arguing with them.',
        'Notice where a cord seems to run between you — usually the belly, the chest, or the throat.',
        'Look at what it is made of, and how long it has been there.',
        'Say what you actually want to say. All of it.',
        'Then release it — cut it, untie it, let it dissolve. Whichever you can genuinely picture.',
        'Close the place it was attached with a hand there and a breath. Sit for a minute afterwards; this one leaves a gap.'
      ] },

    // --- ENERGY WORK -----------------------------------------
    { group: 'energywork', title: 'Chakra practices', minutes: 15,
      summary: 'Seven centres, bottom to top, a minute or two each.',
      steps: [
        'Sit upright. Three settling breaths.',
        'Base of the spine — red. Am I safe? Breathe there until it feels present.',
        'Below the navel — orange. Am I able to feel and to want?',
        'Solar plexus — yellow. Do I have any power here?',
        'Heart — green. Am I open, or closed?',
        'Throat — blue. Am I saying what is true?',
        'Brow — indigo. Can I see clearly?',
        'Crown — violet or white. Am I connected to anything larger?',
        'End by drawing attention back down to the base. Never finish this one at the top.'
      ] },
    { group: 'energywork', title: 'Reiki', minutes: 12,
      summary: 'Hands on, one position at a time, with attention rather than pressure.',
      steps: [
        'Rub your palms together until they are warm.',
        'Place both hands over your eyes. Stay for two or three minutes.',
        'Move to the sides of the head, then the back of the head, then the throat.',
        'Then the heart, then the solar plexus, then the belly.',
        'No pressure. The hand rests; the attention does the work.',
        'Finish with both hands on the belly and a few slow breaths.'
      ] },
    { group: 'energywork', title: 'Energy circulation', minutes: 10,
      summary: 'A loop up the back and down the front, moved by the breath.',
      steps: [
        'Sit upright, feet flat, tongue resting on the roof of the mouth.',
        'On the inhale, draw attention from the base of the spine up the back to the crown.',
        'On the exhale, let it fall down the front of the body to the base again.',
        'Keep the circle turning at the pace of the breath, not faster.',
        'Twenty circuits. If you lose it, pick it up from wherever you are.'
      ] },
    { group: 'energywork', title: 'Qi practices', minutes: 10,
      summary: 'Standing, knees soft, hands moving slowly with something between them.',
      steps: [
        'Stand with feet shoulder width, knees soft, weight in the middle of the feet.',
        'Raise your hands to chest height, palms facing each other, about a foot apart.',
        'Move them slowly together and apart. Look for resistance between them.',
        'When you find it, stay at that distance and breathe.',
        'Then slowly lower your hands to your belly and stand still for a minute.'
      ] },
    { group: 'energywork', title: 'Aura visualization', minutes: 8,
      summary: 'Looking at the field around you rather than at the body inside it.',
      steps: [
        'Sit with your eyes closed. Settle for a minute.',
        'Bring your attention to the space immediately around your body, rather than to your body.',
        'Notice size — does it feel close in, or wide? Even, or lopsided?',
        'Notice colour, if a colour arrives. Do not force one.',
        'Where it feels thin, breathe into that side until it evens out.',
        'Finish by drawing the whole field in slightly, to about arm\'s length.'
      ] },

    // --- STATE SHIFTING --------------------------------------
    { group: 'stateshift', title: 'Shaking', minutes: 4,
      summary: 'The fastest state change on this page. Two minutes, whole body.',
      steps: [
        'Stand up. Start with the hands, then the arms.',
        'Let it spread — shoulders, ribs, hips, legs. Bounce through the knees.',
        'Keep it going for two minutes. It will feel silly around forty seconds. Continue.',
        'Then stop dead and stand completely still with your eyes closed.',
        'Stay still for a full minute. The stillness after is where the change lands.'
      ] },
    { group: 'stateshift', title: 'Humming', minutes: 3,
      summary: 'A long hum on the out-breath. Vibration in the chest and the face.',
      steps: [
        'Take a normal breath in through the nose.',
        'Hum all the way out, low and steady, until you actually run out.',
        'Find the pitch that buzzes most in your face and chest, and stay there.',
        'Ten breaths.',
        'Then sit quietly for thirty seconds and notice the difference.'
      ] },
    { group: 'stateshift', title: 'Movement', minutes: 6,
      summary: 'Not exercise. Moving whichever way the body asks, with no sequence.',
      steps: [
        'Put on one piece of music you like.',
        'Start moving before you have decided how. Any part, any way.',
        'Follow whatever wants to move rather than leading it.',
        'No mirrors, no watching yourself, no correct version of this.',
        'Stop when the track ends and stand still for a moment.'
      ] },
    { group: 'stateshift', title: 'Sound', minutes: 4,
      summary: 'Making a noise on purpose. Loud enough to be slightly embarrassing.',
      steps: [
        'Somewhere you can be heard without consequence. In the car, if nowhere else.',
        'Take a full breath in.',
        'Make a sound on the way out — a vowel, a sigh, a shout. Not a word.',
        'Let it be genuinely loud at least once.',
        'Five or six of these, then sit in the silence afterwards.'
      ] },
    { group: 'stateshift', title: 'State-shift visualization', minutes: 5,
      summary: 'Change the channel. Borrow a state you have actually had.',
      steps: [
        'Name the state you are in now, plainly. One word.',
        'Name the state you would rather be in.',
        'Find a real memory of being in the second one. Not a fantasy — a time it actually happened.',
        'Go into it fully: where you were, what you could see, what your body felt like, what you were doing with your hands.',
        'Stay in it for a full minute rather than glancing at it.',
        'Open your eyes still holding it, and do the next thing from there.'
      ] }
  ];

  // ===========================================================
  // MEDITATION & HYPNOSIS
  //
  // Five shelves. Same rule as Yoga: described but unlinked, so
  // that nothing here is a dead link on the day you need it. The
  // `forWhen` line is what the shelf is actually browsed by — you
  // arrive knowing your state, not knowing a runtime.
  // ===========================================================
  S.media = {
    meditation: [
      { title: 'Ten-minute sit', minutes: 10, forWhen: 'Most days',
        description: 'Plain attention on the breath, coming back when it wanders. The default, and the one to build the habit on.' },
      { title: 'Body scan', minutes: 20, forWhen: 'When you are living in your head',
        description: 'Feet to crown, region by region. Doubles as a way to fall asleep if you do it lying down, which is either a bug or a feature.' },
      { title: 'Noting practice', minutes: 15, forWhen: 'A busy mind',
        description: 'Label what arrives — thinking, hearing, feeling — and let it go. Gives an overactive mind a job small enough to keep it out of the way.' },
      { title: 'Loving-kindness', minutes: 15, forWhen: 'After a bad day with people',
        description: 'Goodwill directed outward in widening circles, starting with yourself, which is usually the hardest one.' },
      { title: 'Open awareness', minutes: 20, forWhen: 'When you are already fairly settled',
        description: 'No object at all. Not a beginner practice, and frustrating if you arrive agitated.' },
      { title: 'Two-minute reset', minutes: 2, forWhen: 'Between things',
        description: 'Short enough that there is no excuse. Sit down, close your eyes, follow ten breaths, get up.' }
    ],
    visualization: [
      { title: 'Safe place', minutes: 12, forWhen: 'Anxious or unsettled',
        description: 'Build one place in full detail and return to the same one every time. It gets stronger with repetition, which a new place each session never does.' },
      { title: 'Future self', minutes: 15, forWhen: 'When the direction has gone blurry',
        description: 'A day in the life of the person you are becoming, in specifics — what they do first, what they refuse, what their afternoon looks like.' },
      { title: 'Healing light', minutes: 12, forWhen: 'Tired, or run down',
        description: 'Light moving through the body, resting anywhere that asks for it.' },
      { title: 'The staircase', minutes: 10, forWhen: 'Going deeper before other work',
        description: 'Ten steps down, counted, each one deeper. A doorway practice rather than a destination.' },
      { title: 'Mountain', minutes: 14, forWhen: 'When everything feels unstable',
        description: 'You are the mountain; the weather is the weather. Borrowed from MBSR and worth the fifteen minutes.' }
    ],
    hypnosis: [
      { title: 'Sleep induction', minutes: 30, forWhen: 'In bed, lights off',
        description: 'Long, slow, and designed not to be finished. Falling asleep partway through is success.' },
      { title: 'Confidence installation', minutes: 25, forWhen: 'Before something that matters',
        description: 'Suggestion work aimed at how you carry yourself rather than at what you believe.' },
      { title: 'Anxiety release', minutes: 25, forWhen: 'A high-anxiety stretch',
        description: 'Deepening, then direct suggestion, then a slow return. Do not run this while driving or doing anything else.' },
      { title: 'Self-worth rewrite', minutes: 30, forWhen: 'The long slow work',
        description: 'The deepest of these, and the one that wants repetition — daily for a few weeks beats occasionally forever.' },
      { title: 'Habit change', minutes: 20, forWhen: 'Installing or removing one specific thing',
        description: 'One habit per session. Two at once and neither lands.' }
    ],
    breathmed: [
      { title: 'Breath counting', minutes: 10, forWhen: 'A scattered mind',
        description: 'Count to ten on the exhale, then start again. Losing count is not failure; noticing you lost count is the practice.' },
      { title: 'Coherent breathing', minutes: 15, forWhen: 'Regulating, not relaxing',
        description: 'Five and a half seconds in, five and a half out, for the whole session. Boring by design.' },
      { title: 'Breath and body', minutes: 12, forWhen: 'When the breath will not settle',
        description: 'Follow the breath by where it is felt — nostrils, chest, belly — rather than by counting it.' },
      { title: 'Extended exhale sit', minutes: 12, forWhen: 'Wound up',
        description: 'Exhale roughly twice the length of the inhale, held for the whole sit rather than a few rounds.' }
    ],
    walking: [
      { title: 'Slow walking practice', minutes: 15, forWhen: 'Restless and unable to sit',
        description: 'Ten paces, turn, ten paces back. Attention on the sole of the foot as it lands. Indoors, and slower than feels sensible.' },
      { title: 'Walking outside', minutes: 25, forWhen: 'Overthinking',
        description: 'Normal pace, no headphones, attention on what is actually around you. The loop dies faster walking than sitting.' },
      { title: 'Counting steps', minutes: 15, forWhen: 'A mind that needs a handle',
        description: 'Breathe in for four steps, out for six. The rhythm does most of the work.' },
      { title: 'Gratitude walk', minutes: 20, forWhen: 'Flat, or resentful',
        description: 'Name one thing you are glad of per street, or per hundred paces. Specific things, not categories.' }
    ]
  };

  // ===========================================================
  // AFFIRMATION DECKS
  //
  // Decks, not one long list. A list of two hundred affirmations
  // is a list nobody reads; a deck of twelve about one thing is
  // something you can actually work with on the day that thing is
  // the problem.
  //
  // "My Deck" ships empty and is the only deck with
  // isPersonal:true. It is not a separate mechanism — it is a
  // deck like the others, which is why anything you write in it
  // shows up in Today's Word alongside everything else.
  // ===========================================================
  S.decks = [
    { key: 'confidence',    name: 'Confidence',    blurb: 'For before, not after.' },
    { key: 'anxiety',       name: 'Anxiety',       blurb: 'For a body that has decided something is wrong.' },
    { key: 'selfworth',     name: 'Self-Worth',    blurb: 'The baseline. The one underneath the others.' },
    { key: 'futureself',    name: 'Future Self',   blurb: 'Spoken as the person you are becoming.' },
    { key: 'creativity',    name: 'Creativity',    blurb: 'For the blank page and the fear of being obvious.' },
    { key: 'discipline',    name: 'Discipline',    blurb: 'For the gap between deciding and doing.' },
    { key: 'abundance',     name: 'Abundance',     blurb: 'For the tightness around money and enough.' },
    { key: 'relationships', name: 'Relationships', blurb: 'For being known without disappearing.' },
    { key: 'body',          name: 'Body',          blurb: 'For living in it rather than managing it.' },
    { key: 'healing',       name: 'Healing',       blurb: 'For the slow work, on the days it does not feel like work.' },
    { key: 'identity',      name: 'Identity',      blurb: 'Who you are, stated in the present tense.' },
    { key: 'writing',       name: 'Writing',       blurb: 'For the desk. Specific to the work.' },
    { key: 'courage',       name: 'Courage',       blurb: 'For doing it afraid.' },
    { key: 'mine',          name: 'My Deck',       blurb: 'The ones you wrote. Starts empty on purpose.', isPersonal: true }
  ];

  // Keyed by the deck key above; seedNow() resolves each key to
  // the deck id it just minted. Writing them keyed like this
  // means no id has to be invented by hand in a content file.
  S.affirmations = {
    confidence: [
      'I am allowed to take up the space I am in.',
      'I do not need to feel ready to begin.',
      'I have something worth saying.',
      'Nobody is watching me as closely as I am watching myself.',
      'I can be nervous and still be good at this.',
      'I trust myself in the room.',
      'I would rather be seen trying than safe and unseen.',
      'My voice is worth the air it takes.',
      'I can do this badly first and well later.',
      'Confidence comes after the doing, so I will do it first.',
      'I belong in the rooms I have worked to get into.',
      'I am ready enough, and ready enough is ready.'
    ],
    anxiety: [
      'I am safe in this moment.',
      'My body is trying to protect me, and I can thank it and stand down.',
      'This feeling is weather, not climate.',
      'I have felt this before and it passed every time.',
      'I can breathe out for longer than I breathe in.',
      'Whatever is coming, I will meet it then, not now.',
      'I do not have to solve this tonight.',
      'My mind is allowed to be quiet.',
      'I can be uncomfortable without being in danger.',
      'Nothing is required of me in this exact second.',
      'The anxiety is not the truth about the situation.',
      'I am here, and I am okay.'
    ],
    selfworth: [
      'I am worth something as I am, not as I perform.',
      'My worth is not a wage I have to keep earning.',
      'I am allowed to rest without having earned it.',
      'I would never speak to someone I love the way I speak to me.',
      'I am included in the kindness I extend to everyone else.',
      'A bad week does not change what I am worth.',
      'I do not have to be useful to be allowed here.',
      'I matter, and that is not conditional.',
      'I am allowed to want things for myself.',
      'I take up room, and that is not a cost to anyone.',
      'What I produced this week is not what I am.',
      'I am on my own side.'
    ],
    futureself: [
      'I am becoming someone I would have admired.',
      'I do the things now that he does without thinking.',
      'I am closer than I was, and that is the only comparison that counts.',
      'The person I am becoming is built out of ordinary days like this one.',
      'I keep promises to myself, and I am the person that makes.',
      'I choose the harder thing because he would.',
      'My future is being decided by what I do this afternoon.',
      'I am no longer the person that story was about.',
      'I am collecting evidence, and it is mounting.',
      'He is not waiting somewhere. He is being made here.',
      'I act from who I am becoming, not from who I was.',
      'This is who I am now.'
    ],
    creativity: [
      'The first version is allowed to be bad.',
      'I make things, and making is a practice, not a verdict.',
      'Being obvious is a stage, not a failure.',
      'I have more ideas than I have time, and that is the right way round.',
      'My taste is ahead of my ability, and that is why I keep going.',
      'I am allowed to make something nobody asked for.',
      'The blank page is not judging me.',
      'I follow what interests me, even when it is not useful.',
      'Finishing badly teaches more than planning well.',
      'My strange ideas are the ones worth having.',
      'I do not need permission to make this.',
      'I make things. That is a fact about me.'
    ],
    discipline: [
      'I do it whether or not I feel like it.',
      'Motivation arrives after the start, not before it.',
      'Small and daily beats large and occasional.',
      'I keep the promises I make to myself.',
      'Five minutes counts. Five minutes is not nothing.',
      'I do not negotiate with myself before nine in the morning.',
      'Missing once is an accident. Missing twice is a decision.',
      'The version of this I can keep is the version that works.',
      'I choose the discomfort I want rather than the one I get.',
      'Consistency is a skill, and I am practising it.',
      'I begin before I am ready, on purpose.',
      'I am someone who does what he said he would.'
    ],
    abundance: [
      'There is enough, and I am allowed some of it.',
      'Wanting more is not greed.',
      'Money is a tool, not a verdict on me.',
      'Other people doing well does not take anything from me.',
      'I can receive without flinching.',
      'I am building something, and building takes time.',
      'I am not behind. I am on my own line.',
      'Opportunities are for people like me.',
      'I am allowed to charge what my work is worth.',
      'Bracing has never once made more arrive.',
      'I notice what I already have.',
      'Good things are allowed to happen to me.'
    ],
    relationships: [
      'I can be known and still be safe.',
      'I am allowed to need things from people.',
      'A boundary is a kindness, not a rejection.',
      'I do not have to be useful to be wanted.',
      'I can love someone and still disagree with them.',
      'I am allowed to disappoint people and remain a good person.',
      'I do not have to earn my place in the people who love me.',
      'I can say the true thing gently.',
      'I am worth staying for.',
      'I let people in at the pace I can manage.',
      'I am not too much.',
      'I am allowed to take up space in the people I love.'
    ],
    body: [
      'I live in this body, I do not manage it.',
      'My body is on my side.',
      'I feed myself like someone I care about.',
      'Rest is part of the training, not the opposite of it.',
      'I move because it feels good, not because I owe it.',
      'My body has carried me through everything so far.',
      'I listen to it before it has to shout.',
      'I am allowed to be tired.',
      'I am strong, and I am getting stronger.',
      'I am not at war with my own body.',
      'I notice what my body is telling me.',
      'I am at home here.'
    ],
    healing: [
      'I am allowed to still be working on this.',
      'Healing is not linear, and a bad week is not a relapse.',
      'I was doing what I knew how to do at the time.',
      'I can hold what happened without being crushed by it.',
      'I forgive myself for what I did not know yet.',
      'The pattern is old, which means it is learned, which means it can change.',
      'I am not the worst thing that happened to me.',
      'I go at the pace I can actually sustain.',
      'I am allowed to grieve something I chose to leave.',
      'I am further along than I can see from here.',
      'I am gentle with myself on the hard days.',
      'I am healing, even today.'
    ],
    identity: [
      'I am someone who follows through.',
      'I am someone who tells the truth, including to himself.',
      'I am someone who builds things.',
      'I am someone who reads.',
      'I am someone who trains.',
      'I am someone who is kind when it is inconvenient.',
      'I am someone who keeps going after a bad week.',
      'I am someone who asks the better question.',
      'I am someone who does the unglamorous part.',
      'I am someone who takes care of himself.',
      'I am someone who notices things.',
      'I am becoming, and I am already someone.'
    ],
    writing: [
      'I write. That is the whole requirement.',
      'The first draft only has to exist.',
      'I can fix a bad page. I cannot fix a blank one.',
      'Words on the page beat a better idea in my head.',
      'I write to find out what I think.',
      'Nobody sees the drafts.',
      'I am allowed to write badly today.',
      'The book is written one ordinary session at a time.',
      'I know this story better than anyone.',
      'I show up at the desk whether or not it is going well.',
      'Rewriting is where it becomes good, so drafting does not have to be.',
      'I am a writer because I am writing.'
    ],
    courage: [
      'I can be afraid and do it anyway.',
      'That is the only kind of brave there is.',
      'Fear is a warning that has not checked its facts.',
      'I have survived every worst case I predicted.',
      'I walk toward the thing.',
      'I say the true thing even when my voice shakes.',
      'I would rather regret trying.',
      'The discomfort is temporary and the avoidance is not.',
      'I do the hard thing first.',
      'I am braver than the story I tell about myself.',
      'I can handle whatever happens next.',
      'I go.'
    ],
    mine: []
  };

  // ===========================================================
  // ROUTINES
  //
  // Four, and they are named after states rather than times of
  // day, because the thing you need to know when you open this
  // page is not what o'clock it is.
  //
  // `seedRef` is resolved to a real record id by seedNow(). A
  // step with no seedRef and no refId is a step that opens its
  // category and lets you choose — which is correct for "tap on
  // whatever is loudest", and would be a lie if it named a topic
  // for you.
  // ===========================================================
  S.routines = [
    {
      name: 'Morning Reset',
      tint: 'breath',
      forWhen: 'The default start. Twenty-five minutes, and the day begins on your terms.',
      steps: [
        { kind: 'breath', seedRef: 'Box Breathing', label: 'Box breathing', minutes: 3,
          note: 'Four rounds is plenty. This is to arrive, not to change your state.' },
        { kind: 'meditation', shelf: 'meditation', seedRef: 'Ten-minute sit', label: 'Sit', minutes: 10 },
        { kind: 'affirmation', label: "Today's word", minutes: 1,
          note: 'Read it once, slowly, out loud.' },
        { kind: 'journal', label: 'Morning pages', minutes: 10,
          note: 'Whichever journal is asking to be written in.' }
      ]
    },
    {
      name: 'Anxiety Reset',
      tint: 'eft',
      forWhen: 'When it has already started. Fifteen minutes, in this order.',
      steps: [
        { kind: 'breath', seedRef: 'The Physiological Sigh', label: 'Physiological sigh', minutes: 1,
          note: 'Do this one first. It is the fastest thing here and it buys you the attention for the rest.' },
        { kind: 'energy', seedRef: 'Grounding visualization', label: 'Grounding', minutes: 5 },
        { kind: 'eft', seedRef: 'Anxiety', label: 'Tap on the anxiety', minutes: 8 },
        { kind: 'journal', seedRef: 'Inner Work Journal', label: 'Get it out of your head', minutes: 10,
          note: 'Do not skip this because you feel better. Feeling better is when it is worth writing.' }
      ]
    },
    {
      name: 'Evening Wind-Down',
      tint: 'medit',
      forWhen: 'For the hour before bed, when the day has not finished with you yet.',
      steps: [
        { kind: 'yoga', seedRef: 'Bedtime wind-down', label: 'Gentle yoga', minutes: 20 },
        { kind: 'breath', seedRef: '4-7-8 Breathing', label: '4-7-8', minutes: 3 },
        { kind: 'journal', seedRef: 'The 3/3/3 Day', label: 'Close the day', minutes: 10 },
        { kind: 'meditation', shelf: 'hypnosis', seedRef: 'Sleep induction', label: 'Sleep hypnosis', minutes: 30,
          note: 'Already in bed, lights off. Falling asleep partway through is the point.' }
      ]
    },
    {
      name: 'Bad Day Protocol',
      tint: 'affirm',
      forWhen: 'For the day it has all gone wrong. Start at the top and do not skip the water.',
      steps: [
        { kind: 'free', label: 'Drink a full glass of water', minutes: 1,
          note: 'Genuinely first. Half of a bad afternoon is dehydration wearing a costume.' },
        { kind: 'breath', seedRef: 'The Physiological Sigh', label: 'Two minutes of breathing', minutes: 2 },
        { kind: 'free', label: 'Five minute walk', minutes: 5,
          note: 'Outside. Round the block is enough. No phone.' },
        { kind: 'eft', label: 'Tap on whatever is loudest', minutes: 8,
          note: 'You pick. On a day like this the topic is usually obvious.' },
        { kind: 'journal', seedRef: 'Inner Work Journal', label: 'Write it down', minutes: 10 },
        { kind: 'meditation', shelf: 'visualization', seedRef: 'Safe place', label: 'Somewhere safe', minutes: 12 }
      ]
    }
  ];

  return S;
})();
