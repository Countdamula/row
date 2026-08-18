// =============================================================
// chrysalis-nav.js — the shared chrome every Chrysalis page wears.
//
// Three things, built here once rather than four times:
//   1. the ROUTE BAR that sits directly under the hero, so the whole
//      of The Chrysalis is one hop away from anywhere inside it
//   2. the BACK control, fixed to the top right
//   3. the HOW-TO for whichever page you are on
//
// All of it is inserted BETWEEN the hero and <main>, never inside it.
// chrysalis.html replaces the whole of #chrRoot on every route change,
// so anything living in there would be destroyed on the first click.
//
// Usage:  ChrNav.mount({ page: 'traits' })
//         ChrNav.set('versions')      // hub, on route change
// =============================================================
(function () {
  'use strict';

  var LINKS = [
    { key: 'today',     href: 'chrysalis.html#/',           label: 'Today' },
    { key: 'versions',  href: 'chrysalis.html#/versions',   label: 'Versions' },
    { key: 'traits',    href: 'chrysalis.html#/traits',     label: 'Traits' },
    { key: 'practices', href: 'chrysalis.html#/practices',  label: 'Practices' },
    { key: 'review',    href: 'chrysalis.html#/review',     label: 'The Week' },
    { key: 'evidence',  href: 'chrysalis.html#/evidence',   label: 'The Log' },
    { key: 'graduate',  href: 'chrysalis.html#/graduate',   label: 'Graduate' },
    { key: 'litany',    href: 'chrysalis-stages.html',      label: 'The Litany' }
  ];

  // Pages reached from a record rather than the bar. They still get a
  // how-to and they still highlight nothing, which is correct: they are
  // not a destination in the bar.
  var HOWTO = {
    today: {
      title: 'How to use Today',
      lede: 'This is the sixty-second surface. It answers one question — <strong>who am I ' +
        'being today, and did I do it?</strong> Everything else in The Chrysalis exists to ' +
        'make this page worth opening.',
      steps: [
        'Read the line under <b>Today, be the one who…</b>. It is one of the traits your ' +
          'current version is chasing, picked by the date, so it is the same all day and a ' +
          'different one tomorrow. You do not choose it; that is the point.',
        'Look at <b>Practices</b> below it. These are the repeatable behaviours that install ' +
          'your traits. Tie the knot beside one once you have done it — the mark lasts the ' +
          'day (or the week, for a weekly one) and reaches your other devices.',
        'When something happens that is worth recording, put one line in <b>What actually ' +
          'happened</b>. Press <em>E</em> anywhere on the page to jump straight to the box.',
        'Choose which trait the line belongs to, and whether it was <b>acting as the new ' +
          'self</b> or <b>falling back to the old self</b>. Log both. A fall-back is the more ' +
          'useful of the two when you read the week back on Sunday.',
        'Press Enter. The entry appears immediately in the last three, and the box stays ' +
          'focused so you can write another.'
      ],
      note: 'There is no streak here, no score, no percentage, and no yesterday. A day you ' +
        'missed is not shown, because it is not evidence of anything. If you want to see ' +
        'everything you have ever logged, that is The Log.'
    },

    versions: {
      title: 'How to use Versions',
      lede: 'A <strong>version</strong> is a named, dated whole-person target — who you intend ' +
        'to be, and by when. You work inside one at a time, then graduate from it and begin the ' +
        'next. Everything else in The Chrysalis hangs off having one.',
      steps: [
        'Scroll to <b>Name the next self</b> at the bottom and create your first version. Give ' +
          'it a name you would actually say out loud — “the one who finishes” beats “Q3 ' +
          'self-improvement”.',
        'Write one line in <b>What this version is for</b>: what has to be true by the end of ' +
          'it. This is the sentence you will re-read when you have forgotten why you started.',
        'Set a target date. Months, not weeks — a version is a stretch of life, not a sprint.',
        'Open <b>The Becoming</b> on the row to fill in the picture: an image board of the ' +
          'person, a written portrait, and the timeline that gathers everything you log.',
        'Attach traits to it from the <b>Traits</b> page. A version <em>selects</em> traits; it ' +
          'never owns them.',
        'When the stretch is over, use <b>Graduate</b>. That freezes this version as a ' +
          'permanent record and opens the next one, carrying the traits you are still chasing.'
      ],
      note: 'Only one version is ever current — promoting another demotes the incumbent. ' +
        'Graduating keeps everything as history; Delete does not, and it takes the portrait, ' +
        'images and milestones with it.'
    },

    traits: {
      title: 'How to use Traits',
      lede: 'A <strong>trait</strong> is permanent. It completes the sentence “I am someone ' +
        'who…”, and it outlives every version that chases it — with its rung and all of its ' +
        'evidence intact. This is the spine of the whole page.',
      steps: [
        'Go to <b>I am someone who…</b> at the bottom and finish the sentence. Write the ' +
          'behaviour, not the outcome: “finishes what he starts”, not “is successful”.',
        'Fill in <b>The old self</b> — what you have done instead, until now. Being accurate ' +
          'here is worth more than being kind.',
        'Fill in <b>Why it matters</b>: what actually changes in your life if this becomes true.',
        'A trait created while a version is current is attached to it automatically. Use ' +
          '<b>Chase in this version</b> on any row to attach or detach one later.',
        'Open a trait to set its <b>embodiment rung</b> — Aspiring, Deliberate, Frequent, ' +
          'Default, Identity. Move it when it is true, not when you wish it were.',
        'Log evidence against it, from the trait page or from Today. Each row here shows how ' +
          'many entries it has and when the last one landed.'
      ],
      note: 'Three to five traits is plenty. Deleting a trait takes its evidence with it and ' +
        'detaches it from every version and practice — retiring is usually what you want, and ' +
        'that just means unchasing it.'
    },

    practices: {
      title: 'How to use Practices',
      lede: 'A <strong>practice</strong> is the repeatable behaviour that <em>installs</em> a ' +
        'trait. It is the thing you do; the trait is the person it makes you. This page is ' +
        'deliberately not a habit tracker — Main Pillar already owns that.',
      steps: [
        'Under <b>Name the behaviour</b>, describe what you actually do, concretely enough that ' +
          'you would know at the end of the day whether you did it. “One hour on the open thing ' +
          'before anything new” beats “focus more”.',
        'Choose <b>daily</b> or <b>weekly</b>. Daily practices reset each morning; weekly ones ' +
          'stay done for the rest of the week once you tie them.',
        'Press the trait chips under <b>Installs</b> to say which traits this behaviour builds. ' +
          'One practice can install several.',
        'Add it. It appears on Today with a knot beside it, ready to tie.',
        'Use the chips on any existing row to re-point a practice at different traits. Changes ' +
          'save the moment you press one.',
        'When a practice stops earning its place, <b>Retire</b> it. It leaves the day but stays ' +
          'on the record, because the fact that you once did it is part of how a trait got in.'
      ],
      note: 'There are no streaks, no scores and no completion counts anywhere here, and that ' +
        'is a deliberate constraint rather than an oversight: a system that grades you daily ' +
        'becomes an accusation on a bad week, and then you stop opening it.'
    },

    review: {
      title: 'How to use The Week',
      lede: 'The weekly ritual, in three moves: <strong>read the week back, adjust, then write ' +
        'one paragraph.</strong> Twenty minutes on a Sunday. This is where daily entries turn ' +
        'into something you can actually learn from.',
      steps: [
        'Check the week at the top. It opens on the current one; use <b>Earlier</b> to step ' +
          'back through previous weeks and read what you wrote then.',
        'Work down <b>Read It Back</b>. Each trait shows the entries that landed against it ' +
          'this week — the times you acted as the new self and the times you did not, told ' +
          'apart but not ranked.',
        'Under each trait, set its <b>rung</b> on the ladder. Move it only if the evidence ' +
          'above it says so. A week going by is not a reason.',
        'In <b>Adjust The Practices</b>, retire anything that did not survive the week. A ' +
          'practice that keeps failing is information about the practice, not about you.',
        'Write one paragraph in <b>Write The Week</b>. Name the <em>pattern</em>, not the day: ' +
          'not “Tuesday went badly” but “I quit at the boring part, not the hard part.”',
        'It saves as you type. That paragraph becomes a permanent entry on your version’s ' +
          'Timeline of Becoming.'
      ],
      note: 'A week with nothing logged is a gap in the record, not a verdict on the week — ' +
        'write the paragraph anyway if you have something to say. A week you leave blank simply ' +
        'stores nothing.'
    },

    evidence: {
      title: 'How to use The Log',
      lede: 'Every entry you have ever written, newest first, grouped by the week it landed in. ' +
        'Nothing here is totalled or ranked. Its <strong>only job is to be read back.</strong>',
      steps: [
        'Scroll. Weeks are headed by their date range, newest at the top, and each entry shows ' +
          'the trait it belongs to and whether it was acting as the new self or falling back.',
        'Use the <b>Trait</b> filter to follow one trait through its whole history. This is the ' +
          'quickest way to see whether a change is real.',
        'Use the <b>Showing</b> filter to look at just the fall-backs. Read three months of ' +
          'them together and the pattern usually names itself.',
        'Delete an entry with the bin icon on its row. This is the only page that offers that — ' +
          'evidence is meant to accumulate, so it takes a deliberate trip here.'
      ],
      note: 'Entries are written from Today or from a trait’s own page. If the log is empty, ' +
        'the first entry is the hardest and the most useful.'
    },

    graduate: {
      title: 'How to graduate a version',
      lede: 'The end of one stretch and the start of the next, as <strong>one decision.</strong> ' +
        'Graduating freezes the current version into a permanent record — nothing is deleted ' +
        'and nothing is scored.',
      steps: [
        'Read what is being closed at the top, and what is kept read-only with it: the images, ' +
          'the milestones, the weeks you wrote and the portrait.',
        'In <b>What Carries Over</b>, turn off the traits this version finished with. Everything ' +
          'left on is carried into the next one.',
        'A trait you turn off is <em>not</em> deleted. It keeps its rung and every piece of ' +
          'evidence under it — it just stops being what the next stretch is about.',
        'Name the next self, say what it is for, and set a target date.',
        'Press <b>Graduate and begin the next</b>. The old version is stamped and archived, the ' +
          'new one becomes current, and you land back on Today.',
        'Or press <b>Graduate on its own</b> to close this version without opening another. ' +
          'Nothing will be current until you name one.'
      ],
      note: 'A graduated version becomes read-only on purpose, so the person you were trying to ' +
        'become cannot later be quietly rewritten into someone easier to have been.'
    },

    becoming: {
      title: 'How to use The Becoming',
      lede: 'The page you open to <strong>look at</strong> the person you are becoming. Three ' +
        'sections in a fixed order: what they look like, who they are in words, and how far you ' +
        'have actually come.',
      steps: [
        'Start with the <b>image board</b>. Drop in images of <em>the person</em> — how they ' +
          'carry themselves, live, dress, work. Not things they own; the Dream Board already ' +
          'holds those.',
        'Caption an image if it needs one, and set one as <b>Cover</b>. The cover represents ' +
          'this version everywhere else in The Chrysalis.',
        'Work through the <b>written portrait</b>. Six questions about character, not ' +
          'circumstances. Answer the ones you can and leave the rest — it saves as you type, so ' +
          'you can come back to it a hundred times.',
        'The hardest question is the last one, and it is the one worth answering.',
        'Add <b>milestones</b> on the timeline: dated marks for things that actually changed ' +
          'the person, not tasks you completed.',
        'Read the <b>Timeline of Becoming</b> back. It gathers this version’s dates, your ' +
          'milestones, the weeks you wrote in The Week, and the weeks your evidence landed in, ' +
          'drawn as weight on the spine.'
      ],
      note: 'A graduated version is read-only here — the portrait stays exactly as it was ' +
        'written. That is the point of keeping it.'
    },

    trait: {
      title: 'How to use a trait',
      lede: 'The permanent record for one trait. <strong>Everything on this page outlives the ' +
        'version that chased it</strong> — the rungs, the history, and every piece of evidence.',
      steps: [
        'Set <b>the old self</b> and <b>the new self</b> against each other. They are shown ' +
          'symmetrically on purpose: the change is the distance between them, and writing the ' +
          'old one honestly is what makes the new one mean something.',
        'Answer <b>why it matters</b>. On the day you cannot be bothered, this is the only ' +
          'thing on the page that helps.',
        'All three fields save while you type. There is nothing to press.',
        'Set where you are on the <b>embodiment ladder</b>: Aspiring → Deliberate → Frequent → ' +
          'Default → Identity. Every move is dated and kept below, so you can see how long each ' +
          'rung actually took.',
        'Log evidence in <b>The Proof</b>. One line, and whether it was acting as the new self ' +
          'or falling back. Both count as evidence; only one of them is a surprise to read later.',
        'The entries are stamped with whichever version was current when they happened, so the ' +
          'record survives graduating.'
      ],
      note: 'Deleting a trait deletes all of its evidence too, and detaches it from every ' +
        'version and practice. If you have simply stopped chasing it, unchase it instead — it ' +
        'keeps everything and stays readable.'
    },

    litany: {
      title: 'How to use The Litany',
      lede: 'The words that write themselves across the hero of The Chrysalis as you scroll. ' +
        '<strong>You write them; the page just performs them.</strong>',
      steps: [
        'Each <b>section</b> is one full screen of the scroll. Its label is the small tracked ' +
          'line above, and its lines are what get written out below.',
        'Give a section several lines. They rotate — one is written, held, then replaced by the ' +
          'next — so a section with four lines says four things over time.',
        'Write in the second person or the first, but keep them short. These are set very ' +
          'large, and a long line breaks the composition.',
        'Reorder sections with the arrows. The order is the order you meet them on the way ' +
          'down the page.',
        'Changes save immediately and appear on the hero the next time you open it.',
        'Delete every section if you want a bare hero. Empty stays empty — it will not ' +
          're-seed itself.'
      ],
      note: 'Reset to the seed if you want the original lines back. That replaces everything ' +
        'currently here.'
    }
  };

  // ============================================================
  // AI PROMPTS — filtered to the page you are on.
  //
  // Written to be pasted whole into any model. Each one states the
  // structural rule it has to obey, because a model that does not know
  // a trait is permanent and a version is temporary will happily
  // produce goals, habits and a scoring system — which is the exact
  // shape this page exists not to be.
  // ============================================================
  var RULE = 'Context: I keep a personal identity record with four kinds of thing. ' +
    'A TRAIT is permanent and completes "I am someone who…". A VERSION is a temporary, ' +
    'named, dated whole-person target that SELECTS traits to chase. A PRACTICE is a ' +
    'repeatable behaviour that installs a trait. EVIDENCE is one timestamped line ' +
    'recording a moment I acted as the new self, or fell back to the old one. ' +
    'There are no streaks, scores or completion percentages anywhere in this system, ' +
    'and a fall-back is information, never failure. Do not propose any.';

  var PROMPTS = {
    today: [
      { title: 'Turn a messy day into one line of evidence',
        body: RULE + '\n\nHere is what happened today, unedited:\n\n"""\n[PASTE YOUR ' +
          'BRAIN-DUMP HERE]\n"""\n\nPick out the moments that are genuinely evidence about ' +
          'WHO I WAS, not what I got done. For each one give me: a single sentence under 20 ' +
          'words in my own plain voice, which trait it belongs to, and whether it was acting ' +
          'as the new self or falling back. Ignore anything that is only task completion. ' +
          'If nothing in this qualifies as identity evidence, say so plainly rather than ' +
          'inventing something.' },
      { title: 'Decide what today\'s trait actually asks of me',
        body: RULE + '\n\nToday my identity action is: "I am someone who [PASTE THE TRAIT]".\n' +
          'My day realistically contains: [LIST YOUR COMMITMENTS].\n\nName the ONE concrete ' +
          'moment in that day where this trait will actually be tested — the specific point ' +
          'where the old self takes over. Then tell me what the new self does at that exact ' +
          'moment, in one sentence. Do not give me a list, a routine or a morning ritual. ' +
          'One moment, one behaviour.' },
      { title: 'Unstick a day I cannot start',
        body: RULE + '\n\nI am not able to start today. Here is the honest reason, as far as ' +
          'I can tell:\n\n"""\n[WRITE WHAT IS ACTUALLY GOING ON]\n"""\n\nDo not motivate me ' +
          'and do not reframe this as an opportunity. Tell me which of these it most likely ' +
          'is — the task is unclear, the task is too large, I am avoiding a specific ' +
          'consequence, or I am tired — and give me the smallest possible first action that ' +
          'takes under five minutes and is still genuinely the real work.' }
    ],

    versions: [
      { title: 'Name the next version',
        body: RULE + '\n\nI am choosing my next VERSION — a named, dated, whole-person ' +
          'target for the next several months.\n\nWhere I am now: [DESCRIBE HONESTLY]\n' +
          'What keeps not changing: [WHAT YOU HAVE FAILED AT REPEATEDLY]\nWhat I want to be ' +
          'true in six months: [DESCRIBE]\n\nGive me five candidate names for this version. ' +
          'Each should be a short phrase a person would actually say out loud — "the one who ' +
          'finishes" rather than "Q3 optimisation". For each, write the one-line statement of ' +
          'what has to be true by the end of it. Then tell me which one you would pick and ' +
          'why, in two sentences.' },
      { title: 'Pressure-test a version before I commit to it',
        body: RULE + '\n\nMy proposed version: "[NAME]"\nWhat it is for: "[THE ONE LINE]"\n' +
          'Target date: [DATE]\n\nCritique this hard. Specifically: is it about WHO I am or ' +
          'about what I achieve — and if it is really an achievement in disguise, say so. Is ' +
          'the time frame honest for a change of this size? Is it so broad that any month ' +
          'could count as progress? What is the most likely way I quietly abandon this ' +
          'around week six? Be direct rather than encouraging.' },
      { title: 'Break a vague ambition into traits',
        body: RULE + '\n\nI want to become: [DESCRIBE THE PERSON, HOWEVER VAGUELY]\n\nGive me ' +
          'three to five TRAITS that this person has and I do not. Each must complete "I am ' +
          'someone who…" and describe a BEHAVIOUR, not an outcome or a feeling. For each ' +
          'trait, also write: the old self (what I do instead now), the new self (what this ' +
          'person does), and why it matters in one line. Reject any candidate that is really ' +
          'a goal, a skill or a mood.' }
    ],

    traits: [
      { title: 'Write the old self honestly',
        body: RULE + '\n\nMy trait: "I am someone who [STATEMENT]".\n\nHere is what I ' +
          'actually do instead, as best I can describe it:\n\n"""\n[BE HONEST]\n"""\n\nWrite ' +
          'the OLD SELF paragraph for me: two or three sentences, plain, specific and ' +
          'unflattering without being cruel. No therapy language, no "you are being too hard ' +
          'on yourself". Then write the NEW SELF paragraph as the exact mirror of it — same ' +
          'situations, different behaviour. Then one line on why it matters that names a real ' +
          'consequence, not a virtue.' },
      { title: 'Find the trait underneath a recurring problem',
        body: RULE + '\n\nThis keeps happening to me:\n\n"""\n[DESCRIBE THE PATTERN, WITH ' +
          'TWO OR THREE REAL EXAMPLES]\n"""\n\nWhat single TRAIT, if it were true of me, ' +
          'would make this pattern impossible? Phrase it as "I am someone who…" and make it ' +
          'a behaviour rather than an attitude. Then tell me the cheapest way I could fake ' +
          'having it without actually having it — I want to know what to watch for in myself.' },
      { title: 'Decide whether a rung has really moved',
        body: RULE + '\n\nThe embodiment ladder I use, in order: Aspiring, Deliberate, ' +
          'Frequent, Default, Identity.\nMy trait: "[STATEMENT]"\nCurrently at: [RUNG]\n' +
          'Evidence from the last month:\n\n"""\n[PASTE YOUR ENTRIES]\n"""\n\nBased only on ' +
          'the evidence, does this trait deserve to move up a rung, stay, or move down? ' +
          'Answer in one word first, then justify it in three sentences citing specific ' +
          'entries. Do not be generous. Moving too early is the failure mode here.' }
    ],

    practices: [
      { title: 'Design a practice that installs a specific trait',
        body: RULE + '\n\nTrait I want to install: "I am someone who [STATEMENT]".\nMy real ' +
          'constraints: [TIME, ENERGY, SCHEDULE, LIVING SITUATION]\n\nGive me three candidate ' +
          'PRACTICES. Each must be a single repeatable behaviour I could unambiguously say ' +
          'yes or no to at the end of a day, and each must plausibly install this exact trait ' +
          'rather than a neighbouring one. State whether each is daily or weekly. No ' +
          'routines, no stacks, no systems — one behaviour each. Then say which one you would ' +
          'start with and why.' },
      { title: 'Diagnose a practice that keeps failing',
        body: RULE + '\n\nPractice: "[NAME]" — [DAILY/WEEKLY]\nIt installs: "[TRAIT]"\nWhat ' +
          'actually happens: [DESCRIBE THE LAST FEW WEEKS HONESTLY]\n\nThe assumption I want ' +
          'you to start from is that the practice is wrong, not that I am undisciplined. ' +
          'Tell me which it most likely is: too large, wrongly timed, dependent on something ' +
          'unreliable, or not actually connected to the trait. Then give me the single ' +
          'smallest change that would make it survive an ordinary bad week.' },
      { title: 'Cut my practices down',
        body: RULE + '\n\nMy current practices:\n\n"""\n[LIST THEM WITH THE TRAITS THEY ' +
          'INSTALL]\n"""\n\nI have too many. Tell me which ONE to keep if I could only keep ' +
          'one, and why. Then rank the rest by how much each actually installs its trait ' +
          'versus how much it is just activity. Be willing to tell me a practice is doing ' +
          'nothing.' }
    ],

    review: [
      { title: 'Find the pattern in a week of evidence',
        body: RULE + '\n\nHere is every entry I logged this week:\n\n"""\n[PASTE THE WEEK]\n' +
          '"""\n\nDo not summarise it back to me. Instead: name the single pattern that ' +
          'connects the fall-backs — the specific circumstance, time of day, emotional state ' +
          'or type of task that precedes them. Then name what the successful entries have in ' +
          'common. Give me both in one sentence each, in plain language I would actually use. ' +
          'If there is genuinely no pattern in one week, say so.' },
      { title: 'Draft my weekly paragraph',
        body: RULE + '\n\nMy week, in evidence:\n\n"""\n[PASTE THE WEEK]\n"""\n\nWrite the ' +
          'paragraph I would write about this week, in first person, 80–120 words. It must ' +
          'name a PATTERN rather than recount days — not "Tuesday went badly" but "I quit at ' +
          'the boring part, not the hard part". End with what I am changing, not with ' +
          'resolve. No encouragement, no summing up, no "overall this was a good week". I ' +
          'will rewrite it in my own words; give me the observation, not the prose.' },
      { title: 'Decide what to change next week',
        body: RULE + '\n\nThis week\'s evidence:\n\n"""\n[PASTE]\n"""\nMy current practices:\n' +
          '\n"""\n[LIST]\n"""\n\nRecommend exactly one change for next week and nothing more ' +
          '— retire a practice, change one, or leave everything alone. Argue for it in three ' +
          'sentences using the evidence. If the honest answer is "change nothing, you have ' +
          'only had one week of data", say that instead.' }
    ],

    evidence: [
      { title: 'Read a long stretch of my log',
        body: RULE + '\n\nHere is my evidence log for the last [PERIOD]:\n\n"""\n[PASTE]\n' +
          '"""\n\nAnswer three questions. First: which trait shows real, sustained change, ' +
          'and what specifically in the entries shows it? Second: which trait have I been ' +
          'writing about without actually changing — where the entries are intentions rather ' +
          'than actions? Third: what circumstance most reliably precedes a fall-back across ' +
          'the whole period? Cite entries. Be blunt.' },
      { title: 'Turn my fall-backs into one useful sentence',
        body: RULE + '\n\nEvery fall-back I have logged:\n\n"""\n[PASTE ONLY THE FALL-BACKS]\n' +
          '"""\n\nThese are information, not failures, and I want the information. Give me ' +
          'one sentence that names the mechanism they share — the thing that is actually ' +
          'happening each time, underneath the different circumstances. Then give me the one ' +
          'question I should ask myself at the moment it is about to happen again.' },
      { title: 'Check whether I am fooling myself',
        body: RULE + '\n\nMy evidence for the trait "[STATEMENT]":\n\n"""\n[PASTE]\n"""\n\n' +
          'Read these as a sceptic. Which entries are genuine evidence of the trait, and ' +
          'which are me generously describing ordinary behaviour so it counts? Sort them into ' +
          'those two lists and explain the borderline cases. I would rather have a short ' +
          'honest list than a long flattering one.' }
    ],

    graduate: [
      { title: 'Decide whether this version is really finished',
        body: RULE + '\n\nVersion: "[NAME]" — [START DATE] to [TARGET DATE]\nWhat it was ' +
          'for: "[THE ONE LINE]"\nTraits it chased, and where each ended up on the ladder:\n' +
          '[LIST]\nA sample of the evidence:\n\n"""\n[PASTE]\n"""\n\nIs this version ' +
          'genuinely complete, genuinely abandoned, or just old? Answer with one of those ' +
          'three words, then justify it. Graduating something I did not actually do would ' +
          'quietly make this whole record worthless, so err towards honesty.' },
      { title: 'Choose which traits carry over',
        body: RULE + '\n\nI am closing a version and opening the next. Traits currently ' +
          'chased, with their rung and a sample of evidence:\n\n"""\n[LIST EACH]\n"""\n\nFor ' +
          'each trait, tell me: carry it forward, or stop chasing it. A trait at Default or ' +
          'Identity may no longer need active chasing; a trait still at Aspiring after months ' +
          'may need a different practice rather than another version. Give one sentence of ' +
          'reasoning each, and flag any trait I am carrying forward out of guilt.' },
      { title: 'Write the bridge to the next version',
        body: RULE + '\n\nThe version I am closing: "[NAME]" — [WHAT IT WAS FOR]\nWhat ' +
          'actually changed: [DESCRIBE]\nWhat did not: [DESCRIBE]\n\nGive me three candidate ' +
          'names for the NEXT version that follow honestly from this one — building on what ' +
          'changed rather than restarting, and not just the same target renamed. For each, ' +
          'the one line of what has to be true by the end. Then say which is the real next ' +
          'step and which two are avoidance.' }
    ],

    becoming: [
      { title: 'Write a portrait answer I am stuck on',
        body: RULE + '\n\nThe portrait question: "[PASTE THE QUESTION]"\nMy half-formed ' +
          'thoughts:\n\n"""\n[WRITE WHATEVER YOU HAVE]\n"""\n\nInterview me. Ask me four ' +
          'sharp follow-up questions, one at a time, that would get at what I actually mean. ' +
          'Wait for each answer before the next. At the end, write the answer back to me in ' +
          'my own voice, in first person, under 120 words, specific and free of self-help ' +
          'vocabulary.' },
      { title: 'Describe the person, so I can find images of them',
        body: RULE + '\n\nMy version: "[NAME]" — [WHAT IT IS FOR]\nThe traits it chases: ' +
          '[LIST]\n\nDescribe this person visually and behaviourally: how they carry ' +
          'themselves, how their ordinary Tuesday looks, what their working space looks like, ' +
          'how they are in a room with other people. Concrete and observable only — no ' +
          'adjectives about their character, only things a camera could record. I am using ' +
          'this to choose photographs for an image board, so give me 10 specific visual ' +
          'scenes rather than a paragraph.' },
      { title: 'Turn my portrait into milestones',
        body: RULE + '\n\nMy written portrait of the person I am becoming:\n\n"""\n[PASTE ' +
          'YOUR ANSWERS]\n"""\n\nGive me five MILESTONES — dated marks that would show this ' +
          'person actually exists. Each must be an observable event, not a task or a metric, ' +
          'and each must be something that would genuinely only happen if the portrait were ' +
          'true. Order them by how early each could realistically occur.' }
    ],

    trait: [
      { title: 'Sharpen this trait statement',
        body: RULE + '\n\nMy trait statement: "I am someone who [STATEMENT]".\n\nCritique the ' +
          'wording. Is it a behaviour or an outcome? Is it specific enough that I could tell, ' +
          'at the end of a day, whether I was it? Does it describe something I do, or ' +
          'something I would like to be seen as? Give me three tighter rewrites and say what ' +
          'each one fixes.' },
      { title: 'Name the moments this trait is decided in',
        body: RULE + '\n\nTrait: "I am someone who [STATEMENT]"\nOld self: [PASTE]\nNew self: ' +
          '[PASTE]\n\nList the five recurring moments in an ordinary week where this trait is ' +
          'actually decided — the specific, small, unglamorous decision points. For each, ' +
          'write what the old self does and what the new self does, in one line each. These ' +
          'should be moments I would recognise immediately, not categories.' },
      { title: 'Write evidence prompts for this trait',
        body: RULE + '\n\nTrait: "I am someone who [STATEMENT]"\n\nGive me five short ' +
          'questions I could ask myself at the end of a day that would surface evidence for ' +
          'or against this trait. They must be answerable with a specific incident, not a ' +
          'rating. Avoid anything that could be answered "yes, generally".' }
    ],

    litany: [
      { title: 'Write the lines for a section',
        body: RULE + '\n\nI have a page that writes lines across a full screen as I scroll. ' +
          'Section heading: "[e.g. I am someone who]"\nThe person I am becoming: [DESCRIBE, ' +
          'OR PASTE YOUR TRAITS]\n\nWrite six lines that complete that heading. Each under 12 ' +
          'words, set very large, so they must be short and land hard. Plain and declarative ' +
          '— no metaphor, no motivational cadence, nothing that sounds like a poster. They ' +
          'should read as things I have decided, not things I am hoping for.' },
      { title: 'Rewrite a line that is not landing',
        body: RULE + '\n\nThis line reads as generic to me: "[PASTE THE LINE]"\nWhat I ' +
          'actually mean by it: [EXPLAIN]\n\nGive me five rewrites under 12 words each. Make ' +
          'them more specific and less impressive. If a line could appear on someone else\'s ' +
          'wall unchanged, it is not specific enough — tell me which of yours fail that test.' },
      { title: 'Design the sections themselves',
        body: RULE + '\n\nMy traits: [LIST]\nMy current version: "[NAME]" — [WHAT IT IS FOR]\n' +
          '\nI want three sections of scrolling text that a person meets in order, each with ' +
          'a heading and several rotating lines. Propose the three headings and what each ' +
          'section is FOR — what it should do to someone reading it at that point in the ' +
          'scroll. Then give four lines for each. Order matters: tell me why this order.' }
    ]
  };

  var root = null, current = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Collapse state lives in 'chr:howto', so it syncs like everything
  // else: dismissing the instructions on the laptop dismisses them on
  // the phone too.
  function collapsed() {
    try { return JSON.parse(localStorage.getItem('chr:howto')) || {}; }
    catch (e) { return {}; }
  }
  function setCollapsed(key, on) {
    var all = collapsed();
    if (on) all[key] = 1; else delete all[key];
    try { localStorage.setItem('chr:howto', JSON.stringify(all)); } catch (e) {}
  }

  var CHEV = '<svg class="chr-howto__chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3.5 6l4.5 4.5L12.5 6"/></svg>';

  var ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M10 3L5 8l5 5"/></svg>';

  function barHTML(key) {
    return '<nav class="chr-subnav" aria-label="The Chrysalis"><div class="chr-subnav__scroll">' +
      LINKS.map(function (l) {
        return '<a href="' + l.href + '"' + (l.key === key ? ' aria-current="page"' : '') + '>' +
          esc(l.label) + '</a>';
      }).join('') +
    '</div></nav>';
  }

  function howtoHTML(key) {
    var h = HOWTO[key];
    if (!h) return '';
    var open = !collapsed()[key];
    return '<section class="chr-howto" data-open="' + open + '" data-howto="' + esc(key) + '">' +
      '<button class="chr-howto__head" type="button" aria-expanded="' + open + '">' +
        CHEV +
        '<p class="chr-howto__title">' + esc(h.title) + '</p>' +
        '<span class="chr-howto__hint">' + (open ? 'Hide' : 'Show') + '</span>' +
      '</button>' +
      '<div class="chr-howto__body">' +
        '<p class="chr-howto__lede">' + h.lede + '</p>' +
        '<ol class="chr-howto__steps">' +
          h.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') +
        '</ol>' +
        (h.note ? '<p class="chr-howto__note">' + h.note + '</p>' : '') +
      '</div>' +
    '</section>';
  }

  /* The bar scrolls sideways when it cannot fit — on a phone it always
     will. CSS cannot ask whether an element overflows, so the fade that
     signals "there is more this way" is toggled here. */
  function wireScrollHint() {
    var bar = root.querySelector('.chr-subnav');
    var scroller = bar && bar.querySelector('.chr-subnav__scroll');
    if (!scroller) return;

    function measure() {
      var over = scroller.scrollWidth - scroller.clientWidth;
      bar.classList.toggle('is-scrollable', over > 4);
      bar.classList.toggle('is-end', over > 4 && scroller.scrollLeft >= over - 4);
    }
    scroller.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    measure();

    // Fonts land after first paint and change the measurement.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

    // Bring the current page into view if it scrolled off the end.
    var here = scroller.querySelector('[aria-current="page"]');
    if (here) {
      var box = here.getBoundingClientRect();
      var frame = scroller.getBoundingClientRect();
      if (box.right > frame.right || box.left < frame.left) {
        scroller.scrollLeft += box.left - frame.left - 20;
        measure();
      }
    }
  }

  /* One disclosure behaviour for both panels. The collapse key is
     namespaced per page AND per panel, so hiding the instructions on
     Traits does not also hide the prompts there. */
  function wireDisclosures() {
    root.querySelectorAll('.chr-howto').forEach(function (sec) {
      sec.querySelector('.chr-howto__head').addEventListener('click', function () {
        var open = sec.getAttribute('data-open') !== 'true';
        sec.setAttribute('data-open', open);
        this.setAttribute('aria-expanded', open);
        sec.querySelector('.chr-howto__hint').textContent = open ? 'Hide' : 'Show';
        setCollapsed(sec.getAttribute('data-howto'), !open);
      });
    });
  }

  // ============================================================
  // PROMPTS
  // ============================================================
  function promptsHTML(key) {
    var list = PROMPTS[key];
    if (!list || !list.length) return '';
    var id = key + ':prompts';
    var open = !collapsed()[id];
    return '<section class="chr-howto chr-howto--prompts" data-open="' + open + '" ' +
      'data-howto="' + esc(id) + '">' +
      '<button class="chr-howto__head" type="button" aria-expanded="' + open + '">' +
        CHEV +
        '<p class="chr-howto__title">AI prompts for this page</p>' +
        '<span class="chr-howto__hint">' + (open ? 'Hide' : 'Show') + '</span>' +
      '</button>' +
      '<div class="chr-howto__body">' +
        '<p class="chr-howto__lede">Copy one, paste it into any model, fill in the ' +
        '<strong>[BRACKETS]</strong>, then bring the answer back to this page. Each one ' +
        'already tells the model the rules this record runs on, so it will not hand you ' +
        'back goals, habits or a scoring system.</p>' +
        '<ol class="chr-prompts">' +
          list.map(function (p, i) {
            return '<li>' +
              '<div class="chr-prompt__head">' +
                '<h3 class="chr-prompt__title">' + esc(p.title) + '</h3>' +
                '<button class="chr-act chr-act--small" type="button" data-copy="' + i + '">' +
                  'Copy</button>' +
              '</div>' +
              '<pre class="chr-prompt__body" data-prompt="' + i + '">' + esc(p.body) + '</pre>' +
            '</li>';
          }).join('') +
        '</ol>' +
      '</div>' +
    '</section>';
  }

  function wirePrompts(key) {
    var list = PROMPTS[key] || [];
    root.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var text = list[Number(b.getAttribute('data-copy'))].body;
        var done = function () {
          b.textContent = 'Copied';
          window.setTimeout(function () { b.textContent = 'Copy'; }, 1600);
        };
        /* navigator.clipboard needs a secure context, which a page
           served over plain http on a LAN is not. The textarea route is
           the fallback that still works there. */
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
        } else {
          legacyCopy(text, done);
        }
      });
    });
  }

  function legacyCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    ta.remove();
  }

  // ============================================================
  // NOTES — the margin of the book, per page.
  // ============================================================
  var PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M8 3h8l-1 7 3 3v2H6v-2l3-3z"/></svg>';
  var DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6' +
    'M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

  function noteWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function notesHTML(key) {
    var DB = window.ChrysalisDB;
    if (!DB || !DB.Notes) return '';
    var notes = DB.Notes.forPage(key);
    var label = (HOWTO[key] && HOWTO[key].title || '').replace(/^How to (use )?/i, '') || 'this page';

    return '<section class="chr-band chr-notes" aria-labelledby="notes-h">' +
      '<div class="chr-band__inner">' +
        '<p class="chr-label">Notes</p>' +
        '<h2 class="chr-h2" id="notes-h">In The Margin</h2>' +
        '<p class="chr-lede">Anything that arrives while you are looking at ' + esc(label) +
        ' and has nowhere else to go. Notes stay on the page they were written on. They are ' +
        'not evidence and they are never read back at you.</p>' +
        '<form class="chr-notes__form" id="chrNoteForm">' +
          '<label class="chr-meta" for="chrNoteText">Add a note</label>' +
          '<textarea class="chr-notes__field" id="chrNoteText" rows="2" maxlength="4000" ' +
            'placeholder="Write it before it goes."></textarea>' +
          '<p style="margin:0"><button class="chr-act" type="submit">Add note</button></p>' +
        '</form>' +
        (notes.length
          ? '<ul class="chr-notes__list">' + notes.map(function (n) {
              return '<li' + (n.pinned ? ' class="is-pinned"' : '') + '>' +
                '<span class="chr-notes__when chr-meta">' + esc(noteWhen(n.at)) +
                  (n.pinned ? '<br>Pinned' : '') + '</span>' +
                '<span class="chr-notes__what"><p>' + esc(n.text) + '</p></span>' +
                '<span class="chr-notes__tools">' +
                  '<button class="chr-tick" type="button" data-note="pin" data-id="' + n.id + '" ' +
                    'aria-pressed="' + !!n.pinned + '" aria-label="Pin this note">' + PIN + '</button>' +
                  '<button class="chr-tick chr-tick--danger" type="button" data-note="del" ' +
                    'data-id="' + n.id + '" aria-label="Delete this note">' + DEL + '</button>' +
                '</span>' +
              '</li>';
            }).join('') + '</ul>'
          : '<p class="chr-prose">No notes on this page yet.</p>') +
      '</div></section>';
  }

  function mountNotes(key) {
    var host = document.getElementById('chrNotes');
    if (!host) {
      host = document.createElement('div');
      host.id = 'chrNotes';
      var main = document.querySelector('main');
      if (main && main.parentNode) main.parentNode.insertBefore(host, main.nextSibling);
      else document.body.appendChild(host);
    }
    host.innerHTML = notesHTML(key);

    var form = host.querySelector('#chrNoteForm');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ta = host.querySelector('#chrNoteText');
      var text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      window.ChrysalisDB.Notes.add({ page: key, text: text });
      mountNotes(key);
      var next = document.getElementById('chrNoteText');
      if (next) next.focus();
    });

    host.querySelectorAll('[data-note]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-id');
        if (b.getAttribute('data-note') === 'pin') {
          window.ChrysalisDB.Notes.togglePin(id);
        } else {
          if (!window.confirm('Delete this note?')) return;
          window.ChrysalisDB.Notes.remove(id);
        }
        var y = window.scrollY;
        mountNotes(key);
        window.scrollTo(0, y);
      });
    });
  }

  /* The brief is explicit: under prefers-reduced-motion the poster
     shows and the footage never plays. A bare autoplay attribute
     ignores that, so every hero video on every page is stopped here —
     one guard rather than one per page. */
  function respectReducedMotion() {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('header video').forEach(function (v) {
      v.autoplay = false;
      v.pause();
      v.currentTime = 0;
    });
  }

  function mountBack() {
    if (document.querySelector('.chr-back')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chr-back';
    b.innerHTML = ARROW + '<span>Back</span>';
    b.addEventListener('click', function () {
      /* history.back() when there is somewhere to go back to, and the
         hub otherwise — a Back button that dumps you outside the
         dashboard on a fresh tab is worse than no Back button. */
      if (window.history.length > 1) { window.history.back(); return; }
      window.location.href = 'chrysalis.html#/';
    });
    document.body.appendChild(b);
  }

  var ChrNav = {
    LINKS: LINKS,
    HOWTO: HOWTO,
    PROMPTS: PROMPTS,
    notes: function () { if (current) mountNotes(current); },

    mount: function (opts) {
      opts = opts || {};
      current = opts.page || null;

      if (!root) {
        root = document.createElement('div');
        root.className = 'chr-chrome';
        /* Inserted after the LAST header — chrysalis.html carries two
           (the reel and the compact hero) and only one is ever shown.
           Never inside <main>: the hub rewrites all of it per route. */
        var heads = document.querySelectorAll('body > header');
        var anchor = heads.length ? heads[heads.length - 1] : null;
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(root, anchor.nextSibling);
        else document.body.insertBefore(root, document.querySelector('main'));
      }

      root.innerHTML = barHTML(current) + howtoHTML(current) + promptsHTML(current);
      wireScrollHint();
      wireDisclosures();
      wirePrompts(current);
      mountBack();
      mountNotes(current);
      respectReducedMotion();
      return root;
    },

    // Route changes on the hub: same chrome, different page.
    set: function (page) {
      if (page === current && root) return;
      ChrNav.mount({ page: page });
    }
  };

  window.ChrNav = ChrNav;
})();
