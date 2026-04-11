let audioCtx;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
document.addEventListener("click", initAudio, { once: true });

function beep(freq, type, vol, dur, delay) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  o.type = type; o.frequency.value = freq;
  const t = audioCtx.currentTime + (delay || 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur);
}
const playCorrect = () => [523,659,784,1047].forEach((f,i) => beep(f,"sine",0.2,0.25,i*0.09));
const playWrong   = () => [330,247].forEach((f,i) => beep(f,"sawtooth",0.18,0.28,i*0.18));
const playTick    = () => beep(900,"square",0.04,0.05,0);
const playUrgent  = () => beep(480,"sine",0.14,0.18,0);

const socket = io(window.location.origin);
const params = new URLSearchParams(window.location.search);
const pin    = params.get("pin");
const name   = localStorage.getItem("playerName");
const isHost = (name === "Host");

let currentQIndex  = 0;
let myScore        = 0;
let timerInterval  = null;
let totalTime      = 15;
let hasAnswered    = false;
let timerDoneSent  = false;

if (isHost) {
  document.getElementById("gameArea").innerHTML = `
    <div class="top-bar">
      <div class="q-progress" id="progressText">Starting…</div>
      <div class="score-pill host-pill">👑 Host View</div>
    </div>
    <div class="timer-wrap">
      <div class="timer-track"><div class="timer-fill" id="timerFill"></div></div>
      <div class="timer-num" id="timerNum">--</div>
    </div>
    <div class="q-card" id="qCard">
      <div class="q-text" id="qText">Waiting…</div>
    </div>
    <div class="options-grid" style="margin-bottom:20px;">
      <div class="opt host-opt" id="hOpt0"><div class="opt-badge">A</div><span class="opt-label-text" id="hTxt0">–</span></div>
      <div class="opt host-opt" id="hOpt1"><div class="opt-badge">B</div><span class="opt-label-text" id="hTxt1">–</span></div>
      <div class="opt host-opt" id="hOpt2"><div class="opt-badge">C</div><span class="opt-label-text" id="hTxt2">–</span></div>
      <div class="opt host-opt" id="hOpt3"><div class="opt-badge">D</div><span class="opt-label-text" id="hTxt3">–</span></div>
    </div>
    <div class="live-scores">
      <div class="live-title">🔴 Live Scoreboard</div>
      <div id="scoresList"></div>
    </div>`;
}

socket.on("connect", () => socket.emit("joinQuiz", { pin, name, isHost }));

socket.on("newQuestion", q => {
  hasAnsweredIndex = -1; 
  initAudio();
  hasAnswered   = false;
  timerDoneSent = false;
  currentQIndex = q.index;

  const prog = document.getElementById("progressText");
  if (prog) prog.textContent = `Question ${q.index + 1} / ${q.total}`;

  if (isHost) {
    document.getElementById("qText").textContent = q.question;
    ["A","B","C","D"].forEach((lbl, i) => {
      const opt = document.getElementById(`hOpt${i}`);
      document.getElementById(`hTxt${i}`).textContent = q.options[i];
      opt.className     = "opt host-opt";
      opt.style.opacity = "1";
      opt.querySelector(".opt-badge").textContent = lbl;
      opt.style.pointerEvents = "none";
      opt.style.cursor = "not-allowed";
    });
    const card = document.getElementById("qCard");
    card.style.animation = "none"; void card.offsetHeight; card.style.animation = "";
    startTimer(q.time, () => {
      socket.emit("hostTimerDone", { pin, questionIndex: q.index });
    });

  } else {
    document.getElementById("qText").textContent = q.question;
    const labels = ["A","B","C","D"];
    document.querySelectorAll(".opt").forEach((btn, i) => {
      btn.querySelector(".opt-badge").textContent      = labels[i];
      btn.querySelector(".opt-label-text").textContent = q.options[i];
      btn.disabled  = false;
      btn.className = "opt";
      btn.style.opacity = "1";
    });

    const card = document.getElementById("qCard");
    card.style.animation = "none"; void card.offsetHeight; card.style.animation = "";
    startTimer(q.time, () => {
      if (!timerDoneSent) {
        timerDoneSent = true;
        socket.emit("timerDone", { pin, questionIndex: currentQIndex });
      }
    });
  }
});

socket.on("showCorrectAnswer", ({ correctAnswer }) => {
  document.querySelectorAll(".opt").forEach((btn, i) => {
    btn.disabled = true;

    if (i === correctAnswer) {
      btn.classList.add("correct");
    } 
    else if (hasAnsweredIndex !== -1 && i === hasAnsweredIndex) {
      btn.classList.add("wrong");
    } 
    else {
      btn.style.opacity = "0.35";
    }
  });

  [0,1,2,3].forEach(i => {
    const opt = document.getElementById(`hOpt${i}`);
    if (!opt) return;

    if (i === correctAnswer) {
      opt.classList.add("correct");
      opt.style.opacity = "1";
    } else {
      opt.style.opacity = "0.2";
    }
  });
  if (!isHost) {
    
    if (hasAnsweredIndex === -1) {
      return;
    }

    if (hasAnsweredIndex === correctAnswer) {
      myScore += 10;
      document.getElementById("myScore").textContent = myScore;
      playCorrect();
      showFeedback(true);
    } else {
      playWrong();
      showFeedback(false);
    }
  } 
});

socket.on("hostQuizEnd", () => {
  clearInterval(timerInterval);
  document.getElementById("qText").textContent = "🏆 Quiz complete! Players seeing results.";
  const prog = document.getElementById("progressText");
  if (prog) prog.textContent = "Quiz finished";
});

socket.on("playersUpdate", players => {
  const list = document.getElementById("scoresList");
  if (!list) return;
  list.innerHTML = "";
  ["🥇","🥈","🥉","4️⃣","5️⃣"].forEach((medal, i) => {
    const p = players[i]; if (!p) return;
    const div = document.createElement("div");
    div.className = "score-row";
    div.innerHTML = `<div class="sr-rank">${medal}</div><div class="sr-name">${p.name}</div><div class="sr-pts">${p.score} pts</div>`;
    list.appendChild(div);
  });
});

socket.on("quizEnd", players => {
  clearInterval(timerInterval);
  window.location.href = `leaderboard.html?pin=${pin}&scores=${encodeURIComponent(JSON.stringify(players))}`;
});

let hasAnsweredIndex = -1;

function submitAnswer(index) {
  if (hasAnswered || isHost) return;
  hasAnswered      = true;
  hasAnsweredIndex = index;
  initAudio();

  document.querySelectorAll(".opt").forEach((b, i) => {
    b.disabled = true;
    if (i !== index) b.classList.add("dim");
  });
  document.querySelectorAll(".opt")[index].classList.add("selected");
  socket.emit("submitAnswer", { pin, answer: index, questionIndex: currentQIndex });
}

function showFeedback(correct) {
  const box = document.getElementById("feedbackBox");
  document.getElementById("fbEmoji").textContent = correct ? "✅" : "❌";
  document.getElementById("fbLabel").textContent = correct ? "Correct!" : "Wrong!";
  document.getElementById("fbPts").textContent   = correct ? "+10 points" : "Better luck!";
  box.className = "feedback-box show " + (correct ? "is-correct" : "is-wrong");
  setTimeout(() => { box.className = "feedback-box"; }, 1500);
}

function startTimer(duration, onDone) {
  clearInterval(timerInterval);
  totalTime = duration || 15;
  let time  = totalTime;

  const fill = document.getElementById("timerFill");
  const num  = document.getElementById("timerNum");
  if (!fill || !num) { onDone && onDone(); return; }
  fill.style.transition = "none";
  fill.style.width      = "100%";
  fill.style.background = "linear-gradient(90deg,#7c6af7,#f7776a)";
  num.textContent       = time;
  num.style.color       = "var(--text)";
  void fill.offsetHeight;
  fill.style.transition = "width 1s linear, background 0.4s";

  timerInterval = setInterval(() => {
    time--;
    num.textContent  = time;
    fill.style.width = Math.max(0, (time / totalTime) * 100) + "%";

    if (time <= 5) {
      fill.style.background = "linear-gradient(90deg,#f87171,#ef4444)";
      num.style.color        = "var(--error)";
      playUrgent();
    } else {
      playTick();
    }

    if (time <= 0) {
      clearInterval(timerInterval);
      if (onDone) onDone();
    }
  }, 1000);
}
