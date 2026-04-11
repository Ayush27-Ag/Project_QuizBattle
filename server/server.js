require("dotenv").config();
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const bcrypt     = require("bcryptjs");
const http       = require("http");
const { Server } = require("socket.io");
const path       = require("path");
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

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "All fields required" });
    if (await User.findOne({ email })) return res.status(400).json({ message: "Email already registered" });
    const hashed = await bcrypt.hash(password, 10);
    await new User({ name, email, password: hashed }).save();
    res.json({ message: "Account created successfully!" });
  } catch (e) { res.status(500).json({ message: "Server error" }); }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "All fields required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });
    if (!await bcrypt.compare(password, user.password)) return res.status(400).json({ message: "Wrong password" });
    res.json({ message: "Login successful", user: { id: user._id, name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ message: "Server error" }); }
});

app.get("/{*splat}", (req, res) => res.sendFile(path.join(__dirname, "../client/index.html")));

function callGemini(topic, count) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.includes("paste_your")) {
      return reject(new Error("No API key"));
    }

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
        path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
              console.log(`❌ ${model} failed →`, parsed.error.message);
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
            console.log(`⚠️ Parse error (${model}) →`, err.message);
            tryModel(index + 1);
          }
        });
      });

      req.on("error", err => {
        console.log(`❌ Request error (${model}) →`, err.message);
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

io.on("connection", socket => {
  console.log("🔌", socket.id);

  socket.on("createQuiz", async ({ pin, title, numQ, time }) => {
    numQ = parseInt(numQ);
    console.log(`📝 PIN:${pin} "${title}" Q:${numQ} T:${time}s`);
    let questions = [];
    try   { questions = await callGemini(title, numQ); }
    catch (e) { console.log("Gemini fail:", e.message); questions = makeFallback(title, numQ); }
    if (questions.length > numQ) questions = questions.slice(0, numQ);
    while (questions.length < numQ)
      questions.push({ question:`${title} Q${questions.length+1}`, options:["A","B","C","D"], correct:0 });

    rooms[pin] = {
      pin, title, questions, players:[], answeredBy:{},
      timePerQ: parseInt(time)||15,
      started: false,
      currentQIndex: 0,
      createdAt: Date.now()
    };
    console.log(`🟢 Room ${pin}: ${questions.length} Qs`);
    socket.emit("roomReady", { pin, total: questions.length });
  });

  socket.on("joinQuiz", ({ pin, name, isHost }) => {
    const room = rooms[pin];
    if (!room) { socket.emit("errorMsg","Room not found!"); return; }
    socket.join(pin);
    let p = room.players.find(p => p.name === name);
    if (!p) {
      room.players.push({
        id: socket.id,
        name,
        score: 0,
        isHost: isHost === true,
        answers: []
      });
    } else {
      p.id = socket.id;
      p.isHost = isHost === true;
    }
    socket.emit("joinSuccess", { pin, title:room.title });
    io.to(pin).emit("playersUpdate", room.players.filter(p=>!p.isHost));

    if (room.started && !isHost) {
      setTimeout(() => {
        if (rooms[pin]) {
          socket.emit("newQuestion", buildQ(room, room.currentQIndex || 0));
        }
      }, 500);
    }
  });

  socket.on("getPlayers", pin => {
    if (rooms[pin]) socket.emit("playersUpdate", rooms[pin].players.filter(p=>!p.isHost));
  });

  socket.on("startGame", ({ pin }) => {
    const room = rooms[pin]; if (!room) return;
    const s = room.players.find(p => p.id === socket.id);
    if (!s || !s.isHost) return;
    room.answeredBy = {};
    room.started = true;
    room.currentQIndex = 0;
    console.log("🚀 Game:", pin);
    io.to(pin).emit("gameStarted", { pin, title:room.title, total:room.questions.length });
    setTimeout(() => sendQ(pin, 0), 800);
  });

  socket.on("submitAnswer", ({ pin, questionIndex, answer }) => {
    const room = rooms[pin]; if (!room) return;
    const sender = room.players.find(p => p.id === socket.id);
    if (!sender || sender.isHost === true) return;

    const qIdx = typeof questionIndex === "number" ? questionIndex : 0;
    const q    = room.questions[qIdx];
    if (!q) return;
    if (!room.answeredBy[qIdx]) room.answeredBy[qIdx] = {};
    if (room.answeredBy[qIdx][socket.id] !== undefined) return;
    const isCorrect = (answer === q.correct);
    room.answeredBy[qIdx][socket.id] = { answer, isCorrect };

    if (isCorrect) sender.score += 10;
    sender.answers.push({ qIdx, answer, correct: isCorrect });
    const sorted = [...room.players.filter(p=>!p.isHost)].sort((a,b)=>b.score-a.score);
    io.to(pin).emit("playersUpdate", sorted);
  });

  socket.on("timerDone", ({ pin, questionIndex }) => {
    const room = rooms[pin]; if (!room) return;
    const sender = room.players.find(p => p.id === socket.id);
    if (!sender || sender.isHost) return;

    const qIdx = typeof questionIndex === "number" ? questionIndex : 0;
    const q    = room.questions[qIdx];
    if (!q) return;
    if (!room.answeredBy[qIdx]) room.answeredBy[qIdx] = {};
    if (room.answeredBy[qIdx][socket.id] === undefined) {
      room.answeredBy[qIdx][socket.id] = { answer: -1, isCorrect: false };
    }
    io.to(pin).emit("showCorrectAnswer", {
      correctAnswer: q.correct,
      questionIndex: qIdx
    });
    const next = qIdx + 1;
    setTimeout(() => {
      if (!rooms[pin]) return;
      if (next < room.questions.length) {
        room.currentQIndex = next;
        io.to(pin).emit("newQuestion", buildQ(room, next));
      } else {
        const final = [...room.players.filter(p=>!p.isHost)].sort((a,b)=>b.score-a.score);
        io.to(pin).emit("quizEnd", final);
      }
    }, 2500);
  });

  socket.on("hostTimerDone", ({ pin, questionIndex }) => {
    const room = rooms[pin]; if (!room) return;

    const q = room.questions[questionIndex];
    if (!q) return;
    io.to(pin).emit("showCorrectAnswer", {
      correctAnswer: q.correct,
      questionIndex
    });

    const next = questionIndex + 1;
    setTimeout(() => {
      if (!rooms[pin]) return;
      if (next < room.questions.length) {
        room.currentQIndex = next;
        io.to(pin).emit("newQuestion", buildQ(room, next));
      } else {
        const final = [...room.players.filter(p=>!p.isHost)].sort((a,b)=>b.score-a.score);
        io.to(pin).emit("quizEnd", final);
      }
    }, 2500);
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
  room.currentQIndex = i;
  io.to(pin).emit("newQuestion", buildQ(room, i));
}

setInterval(() => {
  const now = Date.now();
  for (const p in rooms) if (now - rooms[p].createdAt > 3600000) { delete rooms[p]; }
}, 3600000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
