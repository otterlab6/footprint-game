/*
 * Footprint Game — web port
 * Original (Python/pygame): https://github.com/KierranFalloon/FootprintGame  (MIT, © 2023 Kierran Falloon)
 *
 * All layout coordinates are in a fixed 1920x1080 logical space (the original's 1080p layout);
 * the canvas is scaled to fit the window.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------
  const W = 1920, H = 1080;
  const NUM_SPECIES = 898;              // footprint sprites exist for #1–#898 (Gen I–VIII)
  const SEGMENTS = 10;                  // timer bars
  const SEGMENT_MS = 3000;              // one bar turns red every 3 s → 30 s per round
  const ROUND_MS = SEGMENTS * SEGMENT_MS;
  const RANKED_LIVES = 3;
  const SHINY_ODDS = 4096;
  const JUDGE_MS = 750;                 // "The footprint is X's!" before the verdict
  const CORRECT_MS = 1300;
  const WRONG_MS = 1000;                // practice: back to the same round
  const REVEAL_MS = 2000;               // ranked miss / timeout: show the answer
  const IMG_TIMEOUT_MS = 12000;

  const SPRITE_URL = (id, shiny) =>
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny ? 'shiny/' : ''}${id}.png`;
  const FOOTPRINT_URL = (id) =>
    `https://raw.githubusercontent.com/KierranFalloon/FootprintAPI/main/Sprites/${id}.png`;

  // Layout ------------------------------------------------------------------
  const CARD = { w: 480, h: 270 };
  const SLOTS = [{ x: 0, y: 0 }, { x: 480, y: 0 }, { x: 0, y: 270 }, { x: 480, y: 270 }];
  const CARD_SPRITE = { cx: 157, cy: 119, size: 150 };   // left white square of Card.png
  const CARD_FOOT = { cx: 354, cy: 150, size: 96 };      // right rounded square of Card.png
  const CARD_NAME = { cx: 142, cy: 229, maxW: 236 };
  const SENTRY_BG = { x: 960, y: 0, w: 960, h: 810 };
  const BIG_FOOT = { cx: 1440, cy: 320, size: 192 };
  const TIMER = { x: 1160, cy: 658, w: 14, h: 34, gap: 50 };
  const STONE_BG = { x: 0, y: 540, w: 960, h: 540 };
  const TEXTBOX = { x: 960, y: 810, w: 960, h: 270 };
  const TEXT = { x: 1010, y: 852, lineH: 64, maxW: 860, maxLines: 3 };
  const HUD = { right: 1890, y: 30, heartPx: 5, heartGap: 46 };

  // ---------------------------------------------------------------------------
  // Strings
  // ---------------------------------------------------------------------------
  const names = window.POKEMON_NAMES;
  const randInt = (n) => Math.floor(Math.random() * n);

  // Korean particle helper: picks a form based on whether the last syllable has a final consonant.
  const BATCHIM_EXTRA = new Set(['0', '1', '3', '6', '7', '8', 'L', 'M', 'N', 'R', '♀', '♂']);
  function josa(word, withFinal, withoutFinal) {
    const ch = word[word.length - 1];
    const code = ch.charCodeAt(0) - 0xac00;
    let hasFinal;
    if (code >= 0 && code < 11172) hasFinal = code % 28 !== 0;
    else hasFinal = BATCHIM_EXTRA.has(ch.toUpperCase());
    return word + (hasFinal ? withFinal : withoutFinal);
  }

  const STR = {
    en: {
      htmlLang: 'en',
      title: 'Footprint Game!',
      subtitle: 'Sentry Duty from Pokémon Mystery Dungeon —<br>check out the footprint and tell me what species it is!',
      ranked: 'Ranked',
      rankedNote: '3 lives · online leaderboard',
      practice: 'Practice',
      practiceNote: 'endless · no lives',
      board: 'Leaderboard',
      hint: 'Mouse · touch · keys 1–4 · 30 seconds per footprint · Esc for menu',
      loading: 'Loading Pokémon…',
      loadFail: "Couldn't load the images. Please check your internet connection.",
      idle: () => ['KF: Here comes a Pokémon! Check out its footprint', 'and tell me what species it is!'],
      hover: (n) => [`KF: Is this Pokémon ${n}?`],
      waiting: () => ['KF: Waiting for the next Pokémon…'],
      judge: (n) => [`The footprint is ${n}'s!`, `The footprint is ${n}'s!`],
      correct: [() => ["KF: .... Yep! Looks like you're right to me!"], () => ['KF: Heard ya! Come on in, visitor!']],
      wrong: [() => ['KF: .... Huh?! Looks wrong to me!'], () => ["KF: Huh? I don't think so. Try again!"]],
      wrongReveal: (n) => ['KF: .... Huh?! Looks wrong to me!', `That footprint was ${n}'s!`],
      timeout: [
        (n) => ['KF: Out of time! Pick up the pace!', `That footprint was ${n}'s!`],
        (n) => [`The correct answer is ${n}!`, 'Buck up and snap out of it!'],
      ],
      stats: (w, t) => `P: ${w}, T: ${t}` + (t ? `, ${((w / t) * 100).toFixed(1)}%` : ''),
      hudScore: (n) => `Score ${n}`,
      time: (ms) => `${(ms / 1000).toFixed(1)}s`,
      gameOver: 'Game Over',
      overScore: (n, ms) => `You identified <b>${n}</b> footprint${n === 1 ? '' : 's'} in ${(ms / 1000).toFixed(1)}s`,
      namePlaceholder: 'Nickname (max 16)',
      submit: 'Submit',
      submitting: 'Submitting…',
      submitted: (rank) => `You placed #${rank}!`,
      submitFail: "Couldn't submit your score. Please try again.",
      nameRequired: 'Please enter a nickname.',
      noScore: 'No footprints identified — nothing to submit this time.',
      again: 'Play again',
      home: 'Menu',
      boardTitle: 'Leaderboard · 3 lives',
      boardLoading: 'Loading…',
      boardEmpty: 'No scores yet — be the first!',
      boardFail: "Couldn't load the leaderboard.",
      back: 'Back',
      langBtn: '한국어',
      soundOn: '♪ ON',
      soundOff: '♪ OFF',
      menu: 'Menu',
      reset: 'Reset stats',
      resetConfirm: 'Press again to reset',
      nameFont: (px) => `${px}px "PokemonSolid", "Galmuri11 Bold", "Galmuri11", sans-serif`,
      textFont: '50px "PMD", "Galmuri11", sans-serif',
      hudFont: '30px "PokemonSolid", "Galmuri11", sans-serif',
      nameBase: 34,
    },
    ko: {
      htmlLang: 'ko',
      title: '<span class="ko">발자국 게임</span>',
      subtitle: '포켓몬 불가사의 던전의 「망보기」처럼<br>발자국을 보고 어떤 포켓몬인지 맞혀 보세요!',
      ranked: '랭킹 도전',
      rankedNote: '목숨 3개 · 온라인 랭킹',
      practice: '연습 모드',
      practiceNote: '무한 반복 · 목숨 없음',
      board: '랭킹 보기',
      hint: '마우스 · 터치 · 키보드 1–4로 선택 · 발자국당 30초 · Esc로 메뉴',
      loading: '포켓몬을 불러오는 중…',
      loadFail: '이미지를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.',
      idle: () => ['KF: 포켓몬이 온다! 발자국을 잘 보고', '어떤 포켓몬인지 말해 줘!'],
      hover: (n) => [`KF: 이 포켓몬, ${josa(n, '이야', '야')}?`],
      waiting: () => ['KF: 다음 포켓몬을 기다리는 중…'],
      judge: (n) => [`${n}의 발자국이다!`, `${n}의 발자국이다!`],
      correct: [() => ['KF: ……응! 맞는 것 같아!'], () => ['KF: 잘 들었어! 들어와, 손님!']],
      wrong: [() => ['KF: ……뭐?! 틀린 것 같은데!'], () => ['KF: 응? 아닌 것 같아. 다시 해 봐!']],
      wrongReveal: (n) => ['KF: ……뭐?! 틀린 것 같은데!', `정답은 ${josa(n, '이었어', '였어')}!`],
      timeout: [
        (n) => ['KF: 시간 초과! 좀 더 서둘러!', `정답은 ${josa(n, '이었어', '였어')}!`],
        (n) => [`정답은 ${josa(n, '이었어', '였어')}!`, '정신 똑바로 차려!'],
      ],
      stats: (w, t) => `정답 ${w} · 시도 ${t}` + (t ? ` · ${((w / t) * 100).toFixed(1)}%` : ''),
      hudScore: (n) => `점수 ${n}`,
      time: (ms) => `${(ms / 1000).toFixed(1)}초`,
      gameOver: '게임 오버',
      overScore: (n, ms) => `발자국 <b>${n}</b>개 맞힘 · ${(ms / 1000).toFixed(1)}초`,
      namePlaceholder: '닉네임 (최대 16자)',
      submit: '등록',
      submitting: '등록 중…',
      submitted: (rank) => `${rank}위에 올랐어요!`,
      submitFail: '등록하지 못했어요. 잠시 후 다시 시도해 주세요.',
      nameRequired: '닉네임을 입력해 주세요.',
      noScore: '맞힌 발자국이 없어서 이번엔 등록할 기록이 없어요.',
      again: '다시 도전',
      home: '메뉴',
      boardTitle: '온라인 랭킹 · 목숨 3개',
      boardLoading: '불러오는 중…',
      boardEmpty: '아직 기록이 없어요. 첫 번째가 되어 보세요!',
      boardFail: '랭킹을 불러오지 못했어요.',
      back: '돌아가기',
      langBtn: 'EN',
      soundOn: '♪ 켜짐',
      soundOff: '♪ 꺼짐',
      menu: '메뉴',
      reset: '기록 초기화',
      resetConfirm: '한 번 더 누르면 초기화',
      nameFont: (px) => `${px}px "Galmuri11 Bold", "Galmuri11", sans-serif`,
      textFont: '44px "Galmuri11", sans-serif',
      hudFont: '28px "Galmuri11 Bold", "Galmuri11", sans-serif',
      nameBase: 32,
    },
  };

  // ---------------------------------------------------------------------------
  // Persistence (best effort)
  // ---------------------------------------------------------------------------
  const STORE_KEY = 'footprintGame.v1';
  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  const prefs = loadPrefs();
  const stats = { w: prefs.w | 0, t: prefs.t | 0 };
  const browserLang = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
  let lang = prefs.lang === 'en' || prefs.lang === 'ko' ? prefs.lang : (/^ko\b/i.test(browserLang) ? 'ko' : 'en');
  let soundOn = prefs.soundOn !== false;
  let lastName = typeof prefs.name === 'string' ? prefs.name : '';
  function savePrefs() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ w: stats.w, t: stats.t, lang, soundOn, name: lastName }));
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const overlay = $('overlay');
  const panels = { title: $('panel-title'), over: $('panel-over'), board: $('panel-board') };
  const el = {
    title: $('title'), subtitle: $('subtitle'), hint: $('hint-text'), status: $('status-text'),
    ranked: $('btn-ranked'), practice: $('btn-practice'), board: $('btn-board'),
    overTitle: $('over-title'), overScore: $('over-score'), form: $('submit-form'), name: $('name-input'),
    submit: $('btn-submit'), submitStatus: $('submit-status'), overBoard: $('over-board'),
    again: $('btn-again'), home: $('btn-home'),
    boardTitle: $('board-title'), boardList: $('board-list'), boardStatus: $('board-status'), back: $('btn-back'),
    lang: $('btn-lang'), sound: $('btn-sound'), menu: $('btn-menu'), reset: $('btn-reset'),
  };

  // Status lines are stored as keys so they re-render when the language changes.
  const statusState = new Map();
  function setStatus(node, key, arg, ok) {
    if (key) statusState.set(node, { key, arg, ok }); else statusState.delete(node);
    renderStatus(node);
  }
  function renderStatus(node) {
    const st = statusState.get(node);
    if (!st) { node.textContent = ''; node.classList.remove('ok'); return; }
    const v = STR[lang][st.key];
    node.textContent = typeof v === 'function' ? v(st.arg) : v;
    node.classList.toggle('ok', !!st.ok);
  }

  // ---------------------------------------------------------------------------
  // Assets
  // ---------------------------------------------------------------------------
  function loadImage(src, timeoutMs) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let timer = null;
      img.decoding = 'async';
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('Failed to load ' + src)); };
      if (timeoutMs) timer = setTimeout(() => { img.src = ''; reject(new Error('Timed out: ' + src)); }, timeoutMs);
      img.src = src;
    });
  }

  const ui = {};
  const UI_IMAGES = {
    sentry: 'assets/images/Background.png',
    stone: 'assets/images/Background_2.png',
    card: 'assets/images/Card.png',
    highlight: 'assets/images/Highlight.png',
    textbox: 'assets/images/text_box_blank.png',
    green: 'assets/images/Green_timer.png',
    red: 'assets/images/Red_timer.png',
  };
  for (const [key, src] of Object.entries(UI_IMAGES)) loadImage(src).then((img) => { ui[key] = img; }, () => {});

  const music = new Audio('assets/sounds/Music.mp3');
  music.loop = true;
  music.volume = 0.3;
  const sfx = {
    hover: new Audio('assets/sounds/5.wav'),
    correct: new Audio('assets/sounds/7.wav'),
    wrong: new Audio('assets/sounds/3.wav'),
  };
  for (const a of Object.values(sfx)) { a.preload = 'auto'; a.volume = 0.7; }

  function playSfx(a) {
    if (!soundOn) return;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }
  function startMusic() {
    if (!soundOn || !music.paused) return;
    const p = music.play();
    if (p) p.catch(() => {});
  }
  let audioUnlocked = false;
  function unlockAudio() {
    // iOS only allows audio elements that were first played inside a user gesture.
    if (audioUnlocked) return;
    audioUnlocked = true;
    for (const a of Object.values(sfx)) {
      a.muted = true;
      const done = () => { a.pause(); a.currentTime = 0; a.muted = false; };
      const p = a.play();
      if (p) p.then(done, done); else done();
    }
  }

  if (document.fonts && document.fonts.load) {
    for (const f of ['50px "PMD"', '34px "PokemonSolid"', '44px "Galmuri11"', '32px "Galmuri11 Bold"']) {
      document.fonts.load(f, 'Aa가').catch(() => {});
    }
  }

  // ---------------------------------------------------------------------------
  // Rounds
  // ---------------------------------------------------------------------------
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // The answer always has a visible footprint (≈24% of species have a blank one), and no decoy
  // shares the answer's footprint shape — the original could produce unwinnable rounds.
  const groupOf = (id) => window.FOOTPRINT_GROUP[id - 1];
  const randomId = () => 1 + randInt(NUM_SPECIES);
  function pickIds() {
    let answer;
    do { answer = randomId(); } while (groupOf(answer) === 0);
    const ids = new Set([answer]);
    while (ids.size < 4) {
      const id = randomId();
      if (groupOf(id) !== groupOf(answer)) ids.add(id);
    }
    return [...ids]; // index 0 is the answer
  }

  async function buildRound() {
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      const ids = pickIds();
      const slots = shuffle([0, 1, 2, 3]);
      const shiny = randInt(SHINY_ODDS) === 0;
      try {
        const mons = await Promise.all(ids.map(async (id, i) => {
          const [sprite, foot] = await Promise.all([
            loadImage(SPRITE_URL(id, shiny), IMG_TIMEOUT_MS),
            loadImage(FOOTPRINT_URL(id), IMG_TIMEOUT_MS),
          ]);
          return { id, slot: slots[i], sprite, foot, correct: i === 0, pressed: false };
        }));
        return { mons, shiny, elapsed: 0, over: false, revealed: false };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  let nextRound = null;
  let nextRoundFailed = false;
  function prefetch() {
    nextRoundFailed = false;
    nextRound = buildRound();
    nextRound.catch(() => { nextRoundFailed = true; });
  }

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  // phases: title | loading | playing | judging | verdict | reveal | gameover
  let phase = 'title';
  let mode = 'ranked';      // 'ranked' | 'practice'
  let run = null;           // ranked run: { lives, score, timeMs, submitted }
  let round = null;
  let hoverSlot = null;
  let msg = null;           // { key, variant, id }
  let pending = [];         // setTimeout ids for the current round
  let token = 0;            // invalidates async work when leaving a game

  const inGame = () => overlay.hidden;
  const monAt = (slot) => (round ? round.mons.find((m) => m.slot === slot) : null);
  const correctMon = () => (round ? round.mons.find((m) => m.correct) : null);
  const nameOf = (mon) => names[lang][mon.id - 1];

  function later(fn, ms) { pending.push(setTimeout(fn, ms)); }
  function clearPending() { pending.forEach(clearTimeout); pending = []; }

  function addPracticeTry(won) {
    stats.t += 1;
    if (won) stats.w += 1;
    savePrefs();
  }

  function startGame(newMode) {
    token++;
    clearPending();
    mode = newMode;
    run = mode === 'ranked' ? { lives: RANKED_LIVES, score: 0, timeMs: 0, submitted: false } : null;
    round = null;
    hideOverlay();
    unlockAudio();
    startMusic();
    if (!nextRound || nextRoundFailed) prefetch();
    advance();
  }

  async function advance() {
    clearPending();
    const t = token;
    phase = 'loading';
    msg = null;
    round = null;
    try {
      const r = await nextRound;
      if (t !== token) return;
      round = r;
      prefetch();                 // fetch the following round in the background
      phase = 'playing';
    } catch (e) {
      if (t !== token) return;
      console.error(e);
      goToTitle('loadFail');
    }
  }

  function reveal() {
    const m = correctMon();
    m.pressed = true;
    round.revealed = true;
    round.over = true;
  }

  function afterMiss() {
    if (run.lives <= 0) gameOver();
    else advance();
  }

  function selectSlot(slot) {
    if (phase !== 'playing' || !round) return;
    const mon = monAt(slot);
    if (!mon || mon.pressed) return;
    const clickMs = Math.round(round.elapsed);
    mon.pressed = true;
    phase = 'judging';
    msg = { key: 'judge', id: mon.id };
    later(() => {
      if (mon.correct) {
        playSfx(sfx.correct);
        round.over = true;
        if (run) { run.score += 1; run.timeMs += clickMs; } else addPracticeTry(true);
        phase = 'verdict';
        msg = { key: 'correct', variant: randInt(2) };
        later(advance, CORRECT_MS);
      } else if (run) {
        playSfx(sfx.wrong);
        run.lives -= 1;
        run.timeMs += clickMs;
        reveal();
        phase = 'reveal';
        msg = { key: 'wrongReveal', id: correctMon().id };
        later(afterMiss, REVEAL_MS);
      } else {
        playSfx(sfx.wrong);
        addPracticeTry(false);
        phase = 'verdict';
        msg = { key: 'wrong', variant: randInt(2) };
        later(() => { phase = 'playing'; msg = null; }, WRONG_MS);
      }
    }, JUDGE_MS);
  }

  function timeUp() {
    reveal();
    phase = 'reveal';
    msg = { key: 'timeout', variant: randInt(2), id: correctMon().id };
    playSfx(sfx.wrong);
    if (run) {
      run.lives -= 1;
      run.timeMs += ROUND_MS;
      later(afterMiss, REVEAL_MS);
    } else {
      addPracticeTry(false);
      later(advance, REVEAL_MS);
    }
  }

  function setHover(slot) {
    if (slot === hoverSlot) return;
    hoverSlot = slot;
    if (slot !== null && inGame() && phase !== 'loading') playSfx(sfx.hover);
  }

  // ---------------------------------------------------------------------------
  // Overlay panels
  // ---------------------------------------------------------------------------
  function showPanel(name) {
    overlay.hidden = false;
    for (const [k, p] of Object.entries(panels)) p.hidden = k !== name;
    hoverSlot = null;
    refreshTexts();
  }
  function hideOverlay() {
    overlay.hidden = true;
    refreshTexts();
  }

  function goToTitle(statusKey) {
    token++;
    clearPending();
    phase = 'title';
    run = null;
    round = null;
    msg = null;
    setStatus(el.status, statusKey || (nextRoundFailed ? 'loadFail' : null));
    showPanel('title');
    el.ranked.focus({ preventScroll: true });
  }

  function gameOver() {
    token++;
    clearPending();
    phase = 'gameover';
    showPanel('over');
    el.overBoard.innerHTML = '';
    if (run.score > 0) {
      el.form.hidden = false;
      el.submit.disabled = false;
      el.name.value = lastName;
      setStatus(el.submitStatus, null);
      setTimeout(() => el.name.focus({ preventScroll: true }), 50);
    } else {
      el.form.hidden = true;
      setStatus(el.submitStatus, 'noScore');
      el.again.focus({ preventScroll: true });
    }
    loadBoard(el.overBoard, null, null, el.submitStatus, true);
  }

  function renderBoard(list, rows, me) {
    list.innerHTML = '';
    const s = STR[lang];
    const addRow = (rank, row, isMe) => {
      const li = document.createElement('li');
      if (isMe) li.className = 'me';
      for (const [cls, text] of [
        ['rank', '#' + rank], ['name', row.name], ['score', String(row.score)], ['time', s.time(row.time_ms)],
      ]) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        if (cls === 'time') span.dataset.ms = String(row.time_ms);
        li.appendChild(span);
      }
      list.appendChild(li);
    };
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = s.boardEmpty;
      list.appendChild(li);
      return;
    }
    let meShown = false;
    rows.forEach((row, i) => {
      const isMe = !!me && row.id === me.id;
      if (isMe) meShown = true;
      addRow(i + 1, row, isMe);
    });
    if (me && !meShown) addRow(me.rank, me, true);
  }

  async function loadBoard(list, me, statusNode, overStatusNode, quiet) {
    const t = token;
    if (statusNode) setStatus(statusNode, 'boardLoading');
    try {
      const rows = await window.Leaderboard.top();
      if (t !== token) return;
      renderBoard(list, rows || [], me);
      if (statusNode) setStatus(statusNode, null);
    } catch (e) {
      if (t !== token) return;
      console.warn('Leaderboard:', e);
      if (statusNode) setStatus(statusNode, 'boardFail');
      else if (!quiet && overStatusNode) setStatus(overStatusNode, 'boardFail');
    }
  }

  function showLeaderboard() {
    token++;
    showPanel('board');
    el.boardList.innerHTML = '';
    loadBoard(el.boardList, null, el.boardStatus);
    el.back.focus({ preventScroll: true });
  }

  el.ranked.addEventListener('click', () => startGame('ranked'));
  el.practice.addEventListener('click', () => startGame('practice'));
  el.board.addEventListener('click', showLeaderboard);
  el.back.addEventListener('click', () => goToTitle());
  el.again.addEventListener('click', () => startGame('ranked'));
  el.home.addEventListener('click', () => goToTitle());

  el.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!run || run.submitted) return;
    const name = el.name.value.replace(/\s+/g, ' ').trim().slice(0, 16);
    if (!name) { setStatus(el.submitStatus, 'nameRequired'); el.name.focus(); return; }
    const t = token;
    el.submit.disabled = true;
    setStatus(el.submitStatus, 'submitting');
    try {
      const res = await window.Leaderboard.submit(name, run.score, run.timeMs, lang);
      if (t !== token) return;
      run.submitted = true;
      lastName = name;
      savePrefs();
      el.form.hidden = true;
      setStatus(el.submitStatus, 'submitted', res.rank, true);
      const me = { id: res.id, rank: res.rank, name, score: run.score, time_ms: Math.round(run.timeMs) };
      loadBoard(el.overBoard, me, null, null, true);
      el.again.focus({ preventScroll: true });
    } catch (err) {
      if (t !== token) return;
      console.warn('Submit failed:', err);
      el.submit.disabled = false;
      setStatus(el.submitStatus, 'submitFail');
    }
  });

  // ---------------------------------------------------------------------------
  // Toolbar / texts
  // ---------------------------------------------------------------------------
  function refreshTexts() {
    const s = STR[lang];
    document.documentElement.lang = s.htmlLang;
    el.title.innerHTML = s.title;
    el.subtitle.innerHTML = s.subtitle;
    el.ranked.innerHTML = `${s.ranked}<span class="mode-note">${s.rankedNote}</span>`;
    el.practice.innerHTML = `${s.practice}<span class="mode-note">${s.practiceNote}</span>`;
    el.board.textContent = s.board;
    el.hint.textContent = s.hint;
    el.overTitle.textContent = s.gameOver;
    if (run) el.overScore.innerHTML = s.overScore(run.score, run.timeMs);
    el.name.placeholder = s.namePlaceholder;
    el.submit.textContent = s.submit;
    el.again.textContent = s.again;
    el.home.textContent = s.home;
    el.boardTitle.textContent = s.boardTitle;
    el.back.textContent = s.back;
    el.lang.textContent = s.langBtn;
    el.sound.textContent = soundOn ? s.soundOn : s.soundOff;
    el.sound.setAttribute('aria-pressed', String(soundOn));
    el.menu.textContent = s.menu;
    el.menu.hidden = !inGame();
    el.reset.hidden = !(inGame() && mode === 'practice');
    if (!resetArmed) el.reset.textContent = s.reset;
    statusState.forEach((_, node) => renderStatus(node));
    // Re-render time labels on boards in the new language.
    for (const list of [el.overBoard, el.boardList]) {
      list.querySelectorAll('li').forEach((li) => {
        const tNode = li.querySelector('.time');
        if (tNode && tNode.dataset.ms) tNode.textContent = s.time(+tNode.dataset.ms);
      });
    }
  }

  el.lang.addEventListener('click', () => {
    lang = lang === 'ko' ? 'en' : 'ko';
    savePrefs();
    refreshTexts();
  });

  el.sound.addEventListener('click', () => {
    soundOn = !soundOn;
    savePrefs();
    if (soundOn) { if (phase !== 'title' || audioUnlocked) startMusic(); } else { music.pause(); }
    refreshTexts();
  });

  el.menu.addEventListener('click', () => goToTitle());

  let resetArmed = false, resetTimer = null;
  el.reset.addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      el.reset.textContent = STR[lang].resetConfirm;
      resetTimer = setTimeout(() => { resetArmed = false; refreshTexts(); }, 2500);
      return;
    }
    clearTimeout(resetTimer);
    resetArmed = false;
    stats.w = 0; stats.t = 0;
    savePrefs();
    refreshTexts();
  });

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  function toLogical(evt) {
    const r = canvas.getBoundingClientRect();
    return { x: ((evt.clientX - r.left) / r.width) * W, y: ((evt.clientY - r.top) / r.height) * H };
  }
  function slotAt(p) {
    for (let i = 0; i < SLOTS.length; i++) {
      const s = SLOTS[i];
      if (p.x >= s.x && p.x < s.x + CARD.w && p.y >= s.y && p.y < s.y + CARD.h) return i;
    }
    return null;
  }

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && inGame()) setHover(slotAt(toLogical(e)));
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') setHover(null);
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (!inGame() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const slot = slotAt(toLogical(e));
    if (slot === null) return;
    setHover(slot);
    selectSlot(slot);
  });
  window.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key >= '1' && e.key <= '4' && inGame()) {
      const slot = Number(e.key) - 1;
      setHover(slot);
      selectSlot(slot);
    } else if (e.key === 'Escape') {
      if (inGame() || !panels.board.hidden) goToTitle();
    }
  });

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  let scale = 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    scale = w / W;
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  resize();

  function draw(img, x, y, w, h, smooth) {
    if (!img) return;
    ctx.imageSmoothingEnabled = !!smooth;
    if (smooth) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, w, h);
  }
  function drawCentered(img, cx, cy, size) {
    draw(img, Math.round(cx - size / 2), Math.round(cy - size / 2), size, size, false);
  }

  const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  function drawHeart(x, y, px, color) {
    for (let r = 0; r < HEART.length; r++) {
      for (let c = 0; c < HEART[r].length; c++) {
        if (HEART[r][c] !== 'X') continue;
        ctx.fillStyle = '#1b1b33';
        ctx.fillRect(x + c * px + 3, y + r * px + 3, px, px);
      }
    }
    ctx.fillStyle = color;
    for (let r = 0; r < HEART.length; r++) {
      for (let c = 0; c < HEART[r].length; c++) {
        if (HEART[r][c] === 'X') ctx.fillRect(x + c * px, y + r * px, px, px);
      }
    }
  }

  function outlinedText(text, x, y, fill) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#1b1b33';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  function wrapLines(lines, maxW, maxLines) {
    const out = [];
    for (const line of lines) {
      if (ctx.measureText(line).width <= maxW) { out.push(line); continue; }
      let cur = '';
      for (const word of line.split(' ')) {
        const test = cur ? cur + ' ' + word : word;
        if (ctx.measureText(test).width <= maxW || !cur) cur = test;
        else { out.push(cur); cur = word; }
      }
      if (cur) out.push(cur);
    }
    return out.slice(0, maxLines);
  }

  function currentLines() {
    const s = STR[lang];
    if (phase === 'title' || phase === 'gameover') return s.idle();
    if (phase === 'loading' || !round) return s.waiting();
    if (phase === 'playing' || !msg) {
      const m = hoverSlot !== null ? monAt(hoverSlot) : null;
      return m ? s.hover(nameOf(m)) : s.idle();
    }
    const entry = s[msg.key];
    const fn = Array.isArray(entry) ? entry[msg.variant] : entry;
    return fn(msg.id ? names[lang][msg.id - 1] : '');
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    const s = STR[lang];
    const target = correctMon();

    // Right: sentry view with the footprint to identify
    draw(ui.sentry, SENTRY_BG.x, SENTRY_BG.y, SENTRY_BG.w, SENTRY_BG.h, false);
    if (round && target) drawCentered(target.foot, BIG_FOOT.cx, BIG_FOOT.cy, BIG_FOOT.size);

    // Timer bars
    const used = round ? Math.min(SEGMENTS, Math.floor(round.elapsed / SEGMENT_MS)) : 0;
    for (let i = 0; i < SEGMENTS; i++) {
      const img = i < SEGMENTS - used ? ui.green : ui.red;
      draw(img, TIMER.x + i * TIMER.gap, TIMER.cy - TIMER.h / 2, TIMER.w, TIMER.h, false);
    }

    // HUD: lives + score (ranked) or lifetime stats (practice)
    ctx.font = s.hudFont;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    if (run) {
      const hw = 7 * HUD.heartPx;
      for (let i = 0; i < RANKED_LIVES; i++) {
        const x = HUD.right - (RANKED_LIVES - i) * HUD.heartGap + (HUD.heartGap - hw);
        drawHeart(x, HUD.y, HUD.heartPx, i < run.lives ? '#ff4b6e' : '#4a3a5a');
      }
      outlinedText(s.hudScore(run.score), HUD.right - RANKED_LIVES * HUD.heartGap - 16, HUD.y, '#ffe14d');
    } else if (mode === 'practice' && phase !== 'title') {
      outlinedText(s.stats(stats.w, stats.t), HUD.right, HUD.y, '#cfcfcf');
    }

    // Left: the four candidate cards
    for (let slot = 0; slot < 4; slot++) {
      const p = SLOTS[slot];
      draw(ui.card, p.x, p.y, CARD.w, CARD.h, true);
      const mon = monAt(slot);
      if (!mon) continue;
      drawCentered(mon.sprite, p.x + CARD_SPRITE.cx, p.y + CARD_SPRITE.cy, CARD_SPRITE.size);
      if (mon.pressed) drawCentered(mon.foot, p.x + CARD_FOOT.cx, p.y + CARD_FOOT.cy, CARD_FOOT.size);

      const name = nameOf(mon);
      let px = s.nameBase;
      ctx.font = s.nameFont(px);
      while (ctx.measureText(name).width > CARD_NAME.maxW && px > 14) { px -= 2; ctx.font = s.nameFont(px); }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#0d4f1c';
      ctx.strokeText(name, p.x + CARD_NAME.cx, p.y + CARD_NAME.cy);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(name, p.x + CARD_NAME.cx, p.y + CARD_NAME.cy);
    }

    // Highlight: hovered card, or the answer once revealed
    const hl = new Set();
    if (round && round.revealed && target) hl.add(target.slot);
    else if (hoverSlot !== null && inGame() && round) hl.add(hoverSlot);
    for (const slot of hl) draw(ui.highlight, SLOTS[slot].x, SLOTS[slot].y, CARD.w, CARD.h, false);

    // Bottom-left decoration
    draw(ui.stone, STONE_BG.x, STONE_BG.y, STONE_BG.w, STONE_BG.h, false);

    // Dialogue box
    draw(ui.textbox, TEXTBOX.x, TEXTBOX.y, TEXTBOX.w, TEXTBOX.h, false);
    ctx.font = s.textFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    const lines = wrapLines(currentLines(), TEXT.maxW, TEXT.maxLines);
    lines.forEach((line, i) => ctx.fillText(line, TEXT.x, TEXT.y + i * TEXT.lineH));
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(100, Math.max(0, now - last)); // clamp so a background tab doesn't eat the timer
    last = now;
    if (round && !round.over && (phase === 'playing' || phase === 'judging' || phase === 'verdict')) {
      round.elapsed += dt;
      if (phase === 'playing' && round.elapsed >= ROUND_MS) timeUp();
    }
    render();
    requestAnimationFrame(frame);
  }

  // Boot
  prefetch();
  setStatus(el.status, 'loading');
  nextRound.then(
    () => { if (statusState.get(el.status)?.key === 'loading') setStatus(el.status, null); },
    () => { if (phase === 'title') setStatus(el.status, 'loadFail'); }
  );
  if (!window.Leaderboard || !window.Leaderboard.enabled) el.board.hidden = true;
  showPanel('title');
  requestAnimationFrame(frame);

  // Small debug hook (handy in the console and for automated tests).
  window.__footprint = {
    get state() { return { phase, mode, run, round, stats, lang }; },
  };
})();
