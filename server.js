const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    maxHttpBufferSize: 10 * 1024 * 1024
});

app.use(express.static("public"));
app.use(express.json());

// Stores users while server is running
const users = new Map();

function makeId(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_");
}

function getUserBySocket(socketId) {
    for (const user of users.values()) {
        if (user.socketId === socketId) {
            return user;
        }
    }

    return null;
}

function sendUsers() {
    const list = [...users.values()].map(user => ({
        id: user.id,
        name: user.name,
        online: user.online,
        profilePicture: user.profilePicture || null
    }));

    io.emit("users", list);
}

function canCommunicate(fromId, toId) {
    const from = users.get(fromId);
    const to = users.get(toId);

    if (!from || !to) return false;

    if (from.blocked?.has(toId)) return false;
    if (to.blocked?.has(fromId)) return false;

    return true;
}

io.on("connection", socket => {

    console.log("User connected:", socket.id);

    // -------------------------
    // LOGIN
    // -------------------------

    socket.on("login", name => {

        if (!name || !name.trim()) {
            socket.emit("login-error", "Please enter your name.");
            return;
        }

        name = name.trim();

        if (name.length > 20) {
            socket.emit("login-error", "Name must be 20 characters or less.");
            return;
        }

        const id = makeId(name);

        if (!id) {
            socket.emit("login-error", "Invalid username.");
            return;
        }

        const existing = users.get(id);

        // Prevent same user being logged in twice
        if (existing && existing.online && existing.socketId !== socket.id) {
            socket.emit("login-error", "This username is already online.");
            return;
        }

        const user = existing || {
            id,
            name,
            socketId: null,
            online: false,
            profilePicture: null,
            blocked: new Set()
        };

        user.name = name;
        user.socketId = socket.id;
        user.online = true;

        if (!user.blocked) {
            user.blocked = new Set();
        }

        users.set(id, user);

        socket.userId = id;

        socket.emit("login-success", {
            id: user.id,
            name: user.name,
            profilePicture: user.profilePicture
        });

        sendUsers();

        console.log(`${name} joined`);
    });

    // -------------------------
    // LOGOUT
    // -------------------------

    socket.on("logout", () => {

        const user = getUserBySocket(socket.id);

        if (!user) return;

        user.online = false;
        user.socketId = null;

        sendUsers();

        console.log(`${user.name} logged out`);

        socket.disconnect(true);
    });

    // -------------------------
    // TEXT / FILE / IMAGE / AUDIO
    // -------------------------

    socket.on("private-message", data => {

        const sender = getUserBySocket(socket.id);

        if (!sender) return;

        const receiver = users.get(data.to);

        if (!receiver) return;

        if (!canCommunicate(sender.id, receiver.id)) {
            socket.emit("message-blocked", {
                message: "This user is blocked."
            });
            return;
        }

        const message = {
            id: data.id,
            from: sender.id,
            fromName: sender.name,
            to: receiver.id,

            type: data.type || "text",

            text: data.text || "",
            data: data.data || null,
            fileName: data.fileName || null,
            mimeType: data.mimeType || null,

            time: Date.now()
        };

        // Receiver online
        if (receiver.online && receiver.socketId) {

            io.to(receiver.socketId).emit(
                "private-message",
                message
            );

            socket.emit("message-delivered", {
                id: data.id
            });

        } else {

            socket.emit("message-sent", {
                id: data.id
            });
        }
    });

    // -------------------------
    // TYPING
    // -------------------------

    socket.on("typing", data => {

        const sender = getUserBySocket(socket.id);

        if (!sender) return;

        const receiver = users.get(data.to);

        if (!receiver || !receiver.online) return;

        if (!canCommunicate(sender.id, receiver.id)) return;

        io.to(receiver.socketId).emit("user-typing", {
            from: sender.id,
            name: sender.name,
            typing: data.typing
        });
    });

    // -------------------------
    // READ RECEIPT
    // -------------------------

    socket.on("message-read", data => {

        const sender = getUserBySocket(socket.id);

        if (!sender) return;

        const receiver = users.get(data.to);

        if (!receiver || !receiver.online) return;

        io.to(receiver.socketId).emit("message-read", {
            id: data.id
        });
    });

    // -------------------------
    // MESSAGE REACTION
    // -------------------------

    socket.on("react-message", data => {

        const sender = getUserBySocket(socket.id);

        if (!sender) return;

        const receiver = users.get(data.to);

        if (!receiver) return;

        if (!canCommunicate(sender.id, receiver.id)) return;

        const reaction = {
            messageId: data.messageId,
            reaction: data.reaction,
            by: sender.id
        };

        socket.emit("message-reaction", reaction);

        if (receiver.online) {
            io.to(receiver.socketId).emit(
                "message-reaction",
                reaction
            );
        }
    });

    // -------------------------
    // BLOCK USER
    // -------------------------

    socket.on("block-user", userId => {

        const user = getUserBySocket(socket.id);

        if (!user) return;

        if (!user.blocked) {
            user.blocked = new Set();
        }

        user.blocked.add(userId);

        socket.emit("block-success", userId);
    });

    // -------------------------
    // UNBLOCK USER
    // -------------------------

    socket.on("unblock-user", userId => {

        const user = getUserBySocket(socket.id);

        if (!user) return;

        if (user.blocked) {
            user.blocked.delete(userId);
        }

        socket.emit("unblock-success", userId);
    });

    // -------------------------
    // PROFILE PICTURE
    // -------------------------

    socket.on("profile-picture", picture => {

        const user = getUserBySocket(socket.id);

        if (!user) return;

        if (
            typeof picture !== "string" ||
            !picture.startsWith("data:image/")
        ) {
            return;
        }

        // Prevent very large profile pictures
        if (picture.length > 2 * 1024 * 1024) {
            socket.emit(
                "profile-picture-error",
                "Profile picture is too large."
            );
            return;
        }

        user.profilePicture = picture;

        sendUsers();
    });

    // -------------------------
    // VOICE / VIDEO CALL
    // -------------------------

    socket.on("call-user", data => {

        const caller = getUserBySocket(socket.id);

        if (!caller) return;

        const receiver = users.get(data.to);

        if (!receiver || !receiver.online) {
            socket.emit("call-error", "User is offline.");
            return;
        }

        if (!canCommunicate(caller.id, receiver.id)) {
            socket.emit("call-error", "You cannot call this user.");
            return;
        }

        io.to(receiver.socketId).emit("incoming-call", {
            from: caller.id,
            name: caller.name,
            type: data.type,
            offer: data.offer
        });
    });

    socket.on("answer-call", data => {

        const user = getUserBySocket(socket.id);

        if (!user) return;

        const caller = users.get(data.to);

        if (!caller || !caller.online) return;

        io.to(caller.socketId).emit("call-answered", {
            from: user.id,
            answer: data.answer
        });
    });

    socket.on("ice-candidate", data => {

        const user = getUserBySocket(socket.id);

        if (!user) return;

        const receiver = users.get(data.to);

        if (!receiver || !receiver.online) return;

        io.to(receiver.socketId).emit("ice-candidate", {
            from: user.id,
            candidate: data.candidate
        });
    });

    socket.on("reject-call", data => {

        const user = getUserBySocket(socket.id);

        if (!user) return;

        const caller = users.get(data.to);

        if (!caller || !caller.online) return;

        io.to(caller.socketId).emit("call-rejected");
    });

    socket.on("end-call", data => {

        const user = getUserBySocket(socket.id);

        if (!user) return;

        const receiver = users.get(data.to);

        if (!receiver || !receiver.online) return;

        io.to(receiver.socketId).emit("call-ended");
    });

    // -------------------------
    // DISCONNECT
    // -------------------------

    socket.on("disconnect", () => {

        const user = getUserBySocket(socket.id);

        if (!user) return;

        user.online = false;
        user.socketId = null;

        sendUsers();

        console.log(`${user.name} disconnected`);
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`REAL TIME CHAT ROOM running on http://localhost:${PORT}`);
});