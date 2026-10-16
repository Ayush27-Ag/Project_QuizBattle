const path = require("path");
// Load server/.env (or a root .env) no matter which folder `node` is started from.
require("dotenv").config({ path: [path.join(__dirname, ".env"), path.join(__dirname, "../.env")] });
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const bcrypt     = require("bcryptjs");
const http       = require("http");
const { Server } = require("socket.io");
const https      = require("https");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../client")));

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/quizBattle")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB:", err.message));

const User = require("./models/user");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/signup", async (req, res) => {
  try {
    let { name, email, password } = req.body;
    name  = (name || "").trim();
    email = (email || "").trim().toLowerCase();

    if (!name || !email || !password) return res.status(400).json({ message: "All fields required" });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Invalid email format" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    if (await User.findOne({ email })) return res.status(400).json({ message: "Email already registered" });
    const hashed = await bcrypt.hash(password, 10);
    await new User({ name, email, password: hashed }).save();
    res.json({ message: "Account created successfully!" });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: "Email already registered" });
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;
    email = (email || "").trim().toLowerCase();

    if (!email || !password) return res.status(400).json({ message: "All fields required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });
    if (!await bcrypt.compare(password, user.password)) return res.status(400).json({ message: "Wrong password" });
    res.json({ message: "Login successful", user: { id: user._id, name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ message: "Server error" }); }
});

app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/socket.io")) return next();
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

function callGemini(topic, count) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || /paste_your|your_gemini_api_key/i.test(apiKey)) {
      const err = new Error("GEMINI_API_KEY is not configured");
      err.code = "NO_API_KEY";
      return reject(err);
    }

    // Never let the key reach a log line, even by accident.
    const safe = text => String(text).split(apiKey).join("[REDACTED]");

    const prompt = `
Generate ${count} quiz questions about "${topic}".

Return ONLY a JSON array.
Format:
[
  {
    "question": "...",
    "options": ["A","B","C","D"],
    "correct": 0
  }
]
`;

    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    });
    const models = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite"
    ];

    function tryModel(index) {
      if (index >= models.length) {
        return reject(new Error("All Gemini models failed"));
      }

      const model = models[index];

      const options = {
        hostname: "generativelanguage.googleapis.com",
        path: `/v1beta/models/${model}:generateContent`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
          "Content-Length": Buffer.byteLength(body)
        }
      };

      const req = https.request(options, res => {
        let data = "";

        res.on("data", chunk => data += chunk);

        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              console.log(`❌ ${model} failed →`, safe(parsed.error.message));
              return tryModel(index + 1);
            }

            let text =
              parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";

            if (!text) {
              console.log(`⚠️ Empty response from ${model}`);
              return tryModel(index + 1);
            }
            text = text
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();
            const start = text.indexOf("[");
            const end = text.lastIndexOf("]");

            if (start === -1 || end === -1) {
              console.log(`⚠️ Invalid JSON format`);
              return tryModel(index + 1);
            }

            const json = text.slice(start, end + 1);
            const arr = JSON.parse(json);
            const valid = arr.filter(q =>
              q &&
              typeof q.question === "string" &&
              Array.isArray(q.options) &&
              q.options.length === 4 &&
              typeof q.correct === "number"
            );

            if (valid.length === 0) {
              console.log(`⚠️ No valid questions`);
              return tryModel(index + 1);
            }

            console.log(`✅ Success with ${model}:`, valid.length);
            resolve(valid);

          } catch (err) {
            console.log(`⚠️ Parse error (${model}) →`, safe(err.message));
            tryModel(index + 1);
          }
        });
      });

      req.on("error", err => {
        console.log(`❌ Request error (${model}) →`, safe(err.message));
        tryModel(index + 1);
      });

      req.setTimeout(20000, () => {
        req.destroy();
        console.log(`⏱ Timeout (${model})`);
        tryModel(index + 1);
      });

      req.write(body);
      req.end();
    }

    tryModel(0);
  });
}
const rooms = {};

function uniquePin() {
  let pin;
  do { pin = String(Math.floor(100000 + Math.random() * 900000)); } while (rooms[pin]);
  return pin;
}

function clearRoomTimer(room) {
  if (room && room.qTimer) {
    clearTimeout(room.qTimer);
    room.qTimer = null;
  }
}

function revealAndAdvance(pin, qIdx) {
  const room = rooms[pin];
  if (!room || !room.started) return;
  if (room.currentIndex !== qIdx) return;
  if (room.revealed[qIdx]) return;
  room.revealed[qIdx] = true;
  clearRoomTimer(room);

  const q = room.questions[qIdx];
  if (!q) return;

  if (!room.answeredBy[qIdx]) room.answeredBy[qIdx] = {};
  for (const p of room.players) {
    if (p.isHost || !p.id) continue;
    if (room.answeredBy[qIdx][p.id] === undefined) {
      room.answeredBy[qIdx][p.id] = { answer: -1, isCorrect: false };
    }
  }

  io.to(pin).emit("showCorrectAnswer", {
    correctAnswer: q.correct,
    questionIndex: qIdx
  });

  const next = qIdx + 1;
  setTimeout(() => {
    if (!rooms[pin]) return;
    if (next < room.questions.length) {
      sendQ(pin, next);
    } else {
      const final = [...room.players.filter(p => !p.isHost)].sort((a, b) => b.score - a.score);
      io.to(pin).emit("quizEnd", final);
    }
  }, 2500);
}

io.on("connection", socket => {
  console.log("🔌", socket.id);

  socket.on("createQuiz", async ({ pin, title, numQ, time }) => {
    try {
      // --- Input validation ---
      numQ = parseInt(numQ, 10);
      if (!numQ || numQ < 1 || numQ > 50) {
        socket.emit("errorMsg", "Invalid question count. Please enter a number between 1 and 50.");
        return;
      }
      title = (title || "").trim();
      if (!title) {
        socket.emit("errorMsg", "Quiz topic cannot be empty.");
        return;
      }
      const timePerQ = parseInt(time, 10);
      if (![10, 15, 20, 30, 45].includes(timePerQ)) {
        socket.emit("errorMsg", "Invalid time per question.");
        return;
      }

      pin = String(pin || "");
      if (!/^\d{6}$/.test(pin) || rooms[pin]) pin = uniquePin();

      console.log(`📝 PIN:${pin} "${title}" Q:${numQ} T:${timePerQ}s`);

      // --- Gemini is the only question source ---
      let questions;
      try {
        questions = await callGemini(title, numQ);
      } catch (e) {
        console.log("Gemini fail:", e.message);
        if (e.code === "NO_API_KEY") {
          socket.emit("errorMsg", "❌ Quiz generation is not configured on the server. Please contact the site admin.");
        } else {
          socket.emit("errorMsg", "❌ Could not generate questions. Please try again or use a different topic.");
        }
        return;
      }

      // --- Reject empty results ---
      if (!Array.isArray(questions) || questions.length === 0) {
        socket.emit("errorMsg", "❌ Gemini returned no valid questions. Try a different topic.");
        return;
      }

      // --- Reject incomplete results (no padding allowed) ---
      if (questions.length < numQ) {
        socket.emit("errorMsg", `❌ Gemini only returned ${questions.length} of ${numQ} questions. Try a smaller number or a different topic.`);
        return;
      }

      // --- Trim to exact count if over ---
      if (questions.length > numQ) questions = questions.slice(0, numQ);

      // --- Deep-validate every question ---
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q || typeof q.question !== "string" || !q.question.trim()) {
          socket.emit("errorMsg", `❌ Question ${i + 1} has an empty or invalid question text. Please try again.`);
          return;
        }
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          socket.emit("errorMsg", `❌ Question ${i + 1} does not have exactly 4 answer options. Please try again.`);
          return;
        }
        for (let j = 0; j < 4; j++) {
          if (typeof q.options[j] !== "string" || !q.options[j].trim()) {
            socket.emit("errorMsg", `❌ Question ${i + 1} has an empty or invalid option ${j + 1}. Please try again.`);
            return;
          }
        }
        const ci = q.correct;
        if (!Number.isInteger(ci) || ci < 0 || ci > 3) {
          socket.emit("errorMsg", `❌ Question ${i + 1} has an invalid correct-answer index (${ci}). Please try again.`);
          return;
        }
      }

      // --- All checks passed: create room ---
      rooms[pin] = {
        pin, title, questions, players: [], answeredBy: {}, revealed: {},
        currentIndex: 0, qTimer: null,
        timePerQ, started: false, createdAt: Date.now()
      };
      console.log(`🟢 Room ${pin}: ${questions.length} Qs`);
      socket.emit("roomReady", { pin, total: questions.length });

    } catch (fatalErr) {
      console.log("createQuiz fatal error:", fatalErr.message);
      socket.emit("errorMsg", "❌ An unexpected error occurred while creating the quiz. Please try again.");
    }
  });

  socket.on("joinQuiz", ({ pin, name, isHost, playerId }) => {
    pin = String(pin || "");
    name = (name || "").trim();
    playerId = (playerId || "").trim();
    if (!pin || !name) { socket.emit("errorMsg", "Missing PIN or name."); return; }

    const room = rooms[pin];
    if (!room) { socket.emit("errorMsg", "Room not found!"); return; }

    const wantHost = isHost === true || name === "Host";
    if (!wantHost && name.toLowerCase() === "host") {
      socket.emit("errorMsg", '"Host" is a reserved name. Please use another.');
      return;
    }

    let existing = playerId
      ? room.players.find(p => p.playerId && p.playerId === playerId)
      : null;

    if (!existing) {
      const sameName = room.players.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (sameName) {
        if (sameName.playerId && playerId && sameName.playerId !== playerId) {
          socket.emit("errorMsg", "That name is already taken in this room.");
          return;
        }
        if (sameName.id && sameName.id !== socket.id && !playerId) {
          socket.emit("errorMsg", "That name is already taken in this room.");
          return;
        }
        existing = sameName;
      }
    }

    if (existing) {
      existing.id = socket.id;
      existing.isHost = wantHost;
      existing.name = name;
      if (playerId) existing.playerId = playerId;
    } else {
      if (room.started && !wantHost) {
        socket.emit("errorMsg", "Game already started!");
        return;
      }
      room.players.push({
        id: socket.id,
        playerId: playerId || socket.id,
        name,
        score: 0,
        isHost: wantHost,
        answers: []
      });
    }

    socket.join(pin);
    socket.emit("joinSuccess", { pin, title: room.title });
    io.to(pin).emit("playersUpdate", room.players.filter(p => !p.isHost));

    if (room.started && room.questions[room.currentIndex]) {
      if (room.revealed[room.currentIndex]) {
        socket.emit("showCorrectAnswer", {
          correctAnswer: room.questions[room.currentIndex].correct,
          questionIndex: room.currentIndex
        });
      } else if (room.qTimer) {
        socket.emit("newQuestion", buildQ(room, room.currentIndex));
      }
    }
  });

  socket.on("getPlayers", pin => {
    pin = String(pin || "");
    if (rooms[pin]) socket.emit("playersUpdate", rooms[pin].players.filter(p => !p.isHost));
  });

  socket.on("startGame", ({ pin }) => {
    pin = String(pin || "");
    const room = rooms[pin]; if (!room) return;
    const s = room.players.find(p => p.id === socket.id);
    if (!s || !s.isHost) return;
    if (room.started) return;
    if (room.players.filter(p => !p.isHost).length === 0) {
      socket.emit("errorMsg", "Wait for at least 1 player to join!");
      return;
    }
    room.answeredBy = {};
    room.revealed = {};
    room.started = true;
    room.currentIndex = 0;
    console.log("🚀 Game:", pin);
    io.to(pin).emit("gameStarted", { pin, title: room.title, total: room.questions.length });
    setTimeout(() => sendQ(pin, 0), 1500);
  });

  socket.on("submitAnswer", ({ pin, questionIndex, answer }) => {
    pin = String(pin || "");
    const room = rooms[pin]; if (!room) return;
    const sender = room.players.find(p => p.id === socket.id);
    if (!sender || sender.isHost === true) return;
    if (!room.started) return;

    const qIdx = Number.isInteger(questionIndex) ? questionIndex : 0;
    if (qIdx !== room.currentIndex) return;
    if (room.revealed[qIdx]) return;

    const q = room.questions[qIdx];
    if (!q) return;
    if (!Number.isInteger(answer) || answer < 0 || answer > 3) return;
    if (!room.answeredBy[qIdx]) room.answeredBy[qIdx] = {};
    if (room.answeredBy[qIdx][socket.id] !== undefined) return;
    const isCorrect = (answer === q.correct);
    room.answeredBy[qIdx][socket.id] = { answer, isCorrect };

    if (isCorrect) sender.score += 10;
    sender.answers.push({ qIdx, answer, correct: isCorrect });
    const sorted = [...room.players.filter(p => !p.isHost)].sort((a, b) => b.score - a.score);
    io.to(pin).emit("playersUpdate", sorted);
  });

  socket.on("hostTimerDone", ({ pin, questionIndex }) => {
    pin = String(pin || "");
    const room = rooms[pin]; if (!room) return;
    const sender = room.players.find(p => p.id === socket.id);
    if (!sender || !sender.isHost) return;
    revealAndAdvance(pin, questionIndex);
  });

  socket.on("disconnect", () => {
    console.log("❌", socket.id);
    for (const pin in rooms) {
      const p = rooms[pin].players.find(p => p.id === socket.id);
      if (p) { p.id = null; break; }
    }
  });
});

function buildQ(room, i) {
  const q = room.questions[i];
  return { index:i, total:room.questions.length, question:q.question, options:q.options, time:room.timePerQ };
}
function sendQ(pin, i) {
  const room = rooms[pin]; if (!room) return;
  room.currentIndex = i;
  if (room.revealed[i]) return;
  io.to(pin).emit("newQuestion", buildQ(room, i));
  clearRoomTimer(room);
  const ms = Math.max(1000, (room.timePerQ + 0.4) * 1000);
  room.qTimer = setTimeout(() => revealAndAdvance(pin, i), ms);
}

setInterval(() => {
  const now = Date.now();
  for (const p in rooms) {
    if (now - rooms[p].createdAt > 3600000) {
      clearRoomTimer(rooms[p]);
      delete rooms[p];
    }
  }
}, 3600000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
