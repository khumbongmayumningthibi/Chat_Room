const socket = io();


// ===============================
// ELEMENTS
// ===============================

const loginScreen = document.getElementById("loginScreen");
const chatApp = document.getElementById("chatApp");

const usernameInput = document.getElementById("usernameInput");
const loginButton = document.getElementById("loginButton");
const loginError = document.getElementById("loginError");

const myName = document.getElementById("myName");
const myAvatar = document.getElementById("myAvatar");

const usersList = document.getElementById("usersList");

const emptyChat = document.getElementById("emptyChat");
const activeChat = document.getElementById("activeChat");

const chatUserName = document.getElementById("chatUserName");
const chatStatus = document.getElementById("chatStatus");
const chatAvatar = document.getElementById("chatAvatar");

const messages = document.getElementById("messages");

const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

const typingIndicator =
    document.getElementById("typingIndicator");

const logoutButton =
    document.getElementById("logoutButton");

const profilePictureInput =
    document.getElementById("profilePictureInput");

const fileButton =
    document.getElementById("fileButton");

const fileInput =
    document.getElementById("fileInput");

const audioButton =
    document.getElementById("audioButton");

const emojiButton =
    document.getElementById("emojiButton");

const voiceCallButton =
    document.getElementById("voiceCallButton");

const videoCallButton =
    document.getElementById("videoCallButton");

const blockButton =
    document.getElementById("blockButton");


// CALL ELEMENTS

const callScreen =
    document.getElementById("callScreen");

const remoteVideo =
    document.getElementById("remoteVideo");

const localVideo =
    document.getElementById("localVideo");

const callName =
    document.getElementById("callName");

const callStatus =
    document.getElementById("callStatus");

const callAvatar =
    document.getElementById("callAvatar");

const endCallButton =
    document.getElementById("endCallButton");

const muteButton =
    document.getElementById("muteButton");

const cameraButton =
    document.getElementById("cameraButton");

const incomingCall =
    document.getElementById("incomingCall");

const incomingName =
    document.getElementById("incomingName");

const incomingType =
    document.getElementById("incomingType");

const incomingAvatar =
    document.getElementById("incomingAvatar");

const acceptCallButton =
    document.getElementById("acceptCallButton");

const rejectCallButton =
    document.getElementById("rejectCallButton");


// ===============================
// STATE
// ===============================

let currentUser = null;

let users = [];

let selectedUser = null;

let typingTimer = null;

let blockedUsers =
    new Set(
        JSON.parse(
            localStorage.getItem("blockedUsers") || "[]"
        )
    );

let conversations =
    JSON.parse(
        localStorage.getItem("chatHistory") || "{}"
    );


// CALL STATE

let peerConnection = null;

let localStream = null;

let currentCallUser = null;

let currentCallType = null;

let pendingOffer = null;

const iceServers = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};


// ===============================
// LOGIN
// ===============================

loginButton.addEventListener("click", login);

usernameInput.addEventListener("keydown", e => {

    if (e.key === "Enter") {
        login();
    }

});


function login() {

    const name = usernameInput.value.trim();

    loginError.textContent = "";

    if (!name) {

        loginError.textContent =
            "Please enter your name.";

        usernameInput.focus();

        return;
    }

    socket.emit("login", name);
}


socket.on("login-success", user => {

    currentUser = user;

    loginScreen.classList.add("hidden");

    chatApp.classList.remove("hidden");

    myName.textContent = user.name;

    setAvatar(
        myAvatar,
        user.name,
        user.profilePicture
    );
});


socket.on("login-error", message => {

    loginError.textContent = message;

    usernameInput.focus();
});


// ===============================
// USERS
// ===============================

socket.on("users", list => {

    users = list;

    renderUsers();

    if (selectedUser) {

        const updated = users.find(
            u => u.id === selectedUser.id
        );

        if (updated) {

            selectedUser = updated;

            updateChatHeader();
        }
    }
});


function renderUsers() {

    usersList.innerHTML = "";

    users
        .filter(u => u.id !== currentUser?.id)
        .forEach(user => {

            const item =
                document.createElement("div");

            item.className = "user-item";

            if (
                selectedUser &&
                selectedUser.id === user.id
            ) {
                item.classList.add("active");
            }

            const avatar =
                document.createElement("div");

            avatar.className = "avatar";

            setAvatar(
                avatar,
                user.name,
                user.profilePicture
            );


            const info =
                document.createElement("div");

            info.className = "user-info";

            const name =
                document.createElement("strong");

            name.textContent = user.name;


            const status =
                document.createElement("small");

            status.textContent =
                user.online
                    ? "Online"
                    : "Offline";


            info.appendChild(name);
            info.appendChild(status);


            const dot =
                document.createElement("div");

            dot.className =
                user.online
                    ? "online-dot"
                    : "offline-dot";


            item.appendChild(avatar);
            item.appendChild(info);
            item.appendChild(dot);


            item.addEventListener(
                "click",
                () => selectUser(user)
            );


            usersList.appendChild(item);
        });
}


// ===============================
// SELECT USER
// ===============================

function selectUser(user) {

    selectedUser = user;

    emptyChat.classList.add("hidden");
    activeChat.classList.remove("hidden");

    updateChatHeader();

    renderMessages();

    messageInput.focus();

    renderUsers();
}


function updateChatHeader() {

    if (!selectedUser) return;

    chatUserName.textContent =
        selectedUser.name;

    chatStatus.textContent =
        selectedUser.online
            ? "Online"
            : "Offline";

    setAvatar(
        chatAvatar,
        selectedUser.name,
        selectedUser.profilePicture
    );

    blockButton.textContent =
        blockedUsers.has(selectedUser.id)
            ? "🔓"
            : "🚫";
}


// ===============================
// AVATAR
// ===============================

function setAvatar(element, name, picture) {

    element.innerHTML = "";

    if (picture) {

        const img =
            document.createElement("img");

        img.src = picture;

        element.appendChild(img);

    } else {

        element.textContent =
            name
                ? name.charAt(0).toUpperCase()
                : "?";
    }
}


// ===============================
// MESSAGE ID
// ===============================

function generateMessageId() {

    return Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 8);
}


// ===============================
// SEND TEXT
// ===============================

function sendTextMessage() {

    if (!selectedUser) return;

    const text =
        messageInput.value.trim();

    if (!text) return;

    if (blockedUsers.has(selectedUser.id)) {

        alert("You blocked this user.");

        return;
    }

    const message = {

        id: generateMessageId(),

        from: currentUser.id,

        to: selectedUser.id,

        type: "text",

        text,

        status: "sent",

        time: Date.now()
    };


    saveMessage(
        selectedUser.id,
        message
    );

    renderMessages();


    socket.emit(
        "private-message",
        message
    );


    messageInput.value = "";

    socket.emit("typing", {
        to: selectedUser.id,
        typing: false
    });
}


sendButton.addEventListener(
    "click",
    sendTextMessage
);


messageInput.addEventListener(
    "keydown",
    e => {

        if (e.key === "Enter") {

            e.preventDefault();

            sendTextMessage();
        }

    }
);


// ===============================
// TYPING
// ===============================

messageInput.addEventListener(
    "input",
    () => {

        if (!selectedUser) return;

        socket.emit("typing", {
            to: selectedUser.id,
            typing: true
        });


        clearTimeout(typingTimer);


        typingTimer = setTimeout(() => {

            socket.emit("typing", {
                to: selectedUser.id,
                typing: false
            });

        }, 800);
    }
);


socket.on("user-typing", data => {

    if (
        selectedUser &&
        selectedUser.id === data.from
    ) {

        typingIndicator.textContent =
            data.typing
                ? `${data.name} is typing...`
                : "";
    }
});


// ===============================
// RECEIVE MESSAGE
// ===============================

socket.on("private-message", message => {

    if (blockedUsers.has(message.from)) {
        return;
    }

    const conversationId =
        message.from;

    message.status = "delivered";

    saveMessage(
        conversationId,
        message
    );


    if (
        selectedUser &&
        selectedUser.id === message.from
    ) {

        renderMessages();

        socket.emit("message-read", {
            id: message.id,
            to: message.from
        });

        markMessageRead(
            message.from,
            message.id
        );

    } else {

        // User can later be extended with unread badge
        console.log(
            "New message from",
            message.fromName
        );
    }
});


// ===============================
// MESSAGE SENT / DELIVERED
// ===============================

socket.on("message-sent", data => {

    updateMessageStatus(
        data.id,
        "sent"
    );
});


socket.on("message-delivered", data => {

    updateMessageStatus(
        data.id,
        "delivered"
    );
});


socket.on("message-read", data => {

    updateMessageStatus(
        data.id,
        "read"
    );
});


function updateMessageStatus(id, status) {

    if (!selectedUser) return;

    const list =
        conversations[selectedUser.id];

    if (!list) return;

    const message =
        list.find(m => m.id === id);

    if (!message) return;

    message.status = status;

    saveConversations();

    renderMessages();
}


function markMessageRead(userId, id) {

    const list =
        conversations[userId];

    if (!list) return;

    const message =
        list.find(m => m.id === id);

    if (message) {
        message.status = "read";
    }

    saveConversations();
}


// ===============================
// SAVE CHAT
// ===============================

function saveMessage(userId, message) {

    if (!conversations[userId]) {
        conversations[userId] = [];
    }

    const existing =
        conversations[userId]
            .find(m => m.id === message.id);

    if (!existing) {

        conversations[userId].push(message);

    } else {

        Object.assign(existing, message);
    }

    saveConversations();
}


function saveConversations() {

    localStorage.setItem(
        "chatHistory",
        JSON.stringify(conversations)
    );
}


// ===============================
// RENDER MESSAGES
// ===============================

function renderMessages() {

    messages.innerHTML = "";

    if (!selectedUser) return;

    const list =
        conversations[selectedUser.id] || [];


    list.forEach(message => {

        const row =
            document.createElement("div");

        row.className =
            "message-row " +
            (
                message.from === currentUser.id
                    ? "me"
                    : "other"
            );


        const bubble =
            document.createElement("div");

        bubble.className = "message";


        // TEXT

        if (message.type === "text") {

            const text =
                document.createElement("span");

            text.textContent =
                message.text;

            bubble.appendChild(text);
        }


        // IMAGE

        else if (message.type === "image") {

            const img =
                document.createElement("img");

            img.className =
                "shared-image";

            img.src = message.data;

            bubble.appendChild(img);
        }


        // FILE

        else if (message.type === "file") {

            const link =
                document.createElement("a");

            link.className =
                "file-link";

            link.href =
                message.data;

            link.download =
                message.fileName || "file";

            link.textContent =
                "📎 " +
                (message.fileName || "Download file");

            bubble.appendChild(link);
        }


        // AUDIO

        else if (message.type === "audio") {

            const audio =
                document.createElement("audio");

            audio.controls = true;

            audio.src = message.data;

            bubble.appendChild(audio);
        }


        // TIME

        const time =
            document.createElement("span");

        time.className =
            "message-time";

        time.textContent =
            formatTime(message.time);

        bubble.appendChild(time);


        // TICKS

        if (message.from === currentUser.id) {

            const ticks =
                document.createElement("span");

            ticks.className =
                "ticks";


            if (message.status === "read") {

                ticks.classList.add(
                    "tick-red"
                );

                ticks.textContent = "✓✓";

            } else if (
                message.status === "delivered"
            ) {

                ticks.classList.add(
                    "tick-yellow"
                );

                ticks.textContent = "✓✓";

            } else {

                ticks.classList.add(
                    "tick-yellow"
                );

                ticks.textContent = "✓";
            }


            bubble.appendChild(ticks);
        }


        // REACTION BUTTON

        const reactionButton =
            document.createElement("button");

        reactionButton.className =
            "react-button";

        reactionButton.textContent =
            "😊";

        reactionButton.title =
            "React";


        reactionButton.addEventListener(
            "click",
            () => reactToMessage(message)
        );


        bubble.appendChild(reactionButton);


        // EXISTING REACTION

        if (message.reaction) {

            const reaction =
                document.createElement("span");

            reaction.className =
                "reaction";

            reaction.textContent =
                message.reaction;

            bubble.appendChild(reaction);
        }


        row.appendChild(bubble);

        messages.appendChild(row);
    });


    messages.scrollTop =
        messages.scrollHeight;
}


function formatTime(timestamp) {

    return new Date(timestamp)
        .toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
}


// ===============================
// REACTIONS
// ===============================

function reactToMessage(message) {

    const reactions = [
        "❤️",
        "😂",
        "👍",
        "😮",
        "😢",
        "😡"
    ];

    const reaction =
        prompt(
            "Choose reaction:\n" +
            reactions.join(" ")
        );

    if (!reaction) return;

    if (!reactions.includes(reaction)) {

        alert(
            "Use one of: " +
            reactions.join(" ")
        );

        return;
    }


    message.reaction = reaction;

    saveConversations();

    renderMessages();


    socket.emit("react-message", {

        to:
            message.from === currentUser.id
                ? message.to
                : message.from,

        messageId: message.id,

        reaction
    });
}


socket.on("message-reaction", data => {

    if (!selectedUser) return;

    const list =
        conversations[selectedUser.id];

    if (!list) return;

    const message =
        list.find(m =>
            m.id === data.messageId
        );

    if (!message) return;

    message.reaction =
        data.reaction;

    saveConversations();

    renderMessages();
});


// ===============================
// FILE / IMAGE
// ===============================

fileButton.addEventListener(
    "click",
    () => {

        if (!selectedUser) {
            alert("Select a user first.");
            return;
        }

        fileInput.click();
    }
);


fileInput.addEventListener(
    "change",
    () => {

        const file =
            fileInput.files[0];

        if (!file) return;


        // 8 MB maximum

        if (file.size > 8 * 1024 * 1024) {

            alert(
                "File must be smaller than 8 MB."
            );

            fileInput.value = "";

            return;
        }


        const reader =
            new FileReader();


        reader.onload = () => {

            const isImage =
                file.type.startsWith("image/");


            const message = {

                id: generateMessageId(),

                from: currentUser.id,

                to: selectedUser.id,

                type:
                    isImage
                        ? "image"
                        : "file",

                data: reader.result,

                fileName: file.name,

                mimeType: file.type,

                status: "sent",

                time: Date.now()
            };


            saveMessage(
                selectedUser.id,
                message
            );

            renderMessages();


            socket.emit(
                "private-message",
                message
            );
        };


        reader.readAsDataURL(file);

        fileInput.value = "";
    }
);


// ===============================
// VOICE MESSAGE
// ===============================

let mediaRecorder = null;

let audioChunks = [];


audioButton.addEventListener(
    "click",
    async () => {

        if (!selectedUser) {

            alert(
                "Select a user first."
            );

            return;
        }


        if (
            mediaRecorder &&
            mediaRecorder.state === "recording"
        ) {

            mediaRecorder.stop();

            audioButton.textContent =
                "🎙️";

            return;
        }


        try {

            const stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });


            mediaRecorder =
                new MediaRecorder(stream);

            audioChunks = [];


            mediaRecorder.ondataavailable =
                event => {

                    audioChunks.push(
                        event.data
                    );
                };


            mediaRecorder.onstop =
                () => {

                    const blob =
                        new Blob(
                            audioChunks,
                            {
                                type:
                                    "audio/webm"
                            }
                        );


                    if (
                        blob.size >
                        5 * 1024 * 1024
                    ) {

                        alert(
                            "Audio is too large."
                        );

                        stream
                            .getTracks()
                            .forEach(
                                t => t.stop()
                            );

                        return;
                    }


                    const reader =
                        new FileReader();


                    reader.onloadend =
                        () => {

                            const message = {

                                id:
                                    generateMessageId(),

                                from:
                                    currentUser.id,

                                to:
                                    selectedUser.id,

                                type:
                                    "audio",

                                data:
                                    reader.result,

                                status:
                                    "sent",

                                time:
                                    Date.now()
                            };


                            saveMessage(
                                selectedUser.id,
                                message
                            );

                            renderMessages();


                            socket.emit(
                                "private-message",
                                message
                            );
                        };


                    reader.readAsDataURL(blob);


                    stream
                        .getTracks()
                        .forEach(
                            t => t.stop()
                        );
                };


            mediaRecorder.start();

            audioButton.textContent =
                "⏹️";

        } catch (error) {

            alert(
                "Microphone permission is required."
            );
        }
    }
);


// ===============================
// EMOJI
// ===============================

emojiButton.addEventListener(
    "click",
    () => {

        messageInput.value += " 😊";

        messageInput.focus();
    }
);


// ===============================
// PROFILE PICTURE
// ===============================

profilePictureInput.addEventListener(
    "change",
    () => {

        const file =
            profilePictureInput.files[0];

        if (!file) return;


        if (!file.type.startsWith("image/")) {

            alert(
                "Please select an image."
            );

            return;
        }


        if (file.size > 1 * 1024 * 1024) {

            alert(
                "Profile picture must be under 1 MB."
            );

            return;
        }


        const reader =
            new FileReader();


        reader.onload =
            () => {

                const picture =
                    reader.result;

                setAvatar(
                    myAvatar,
                    currentUser.name,
                    picture
                );

                socket.emit(
                    "profile-picture",
                    picture
                );
            };


        reader.readAsDataURL(file);
    }
);


// ===============================
// BLOCK
// ===============================

blockButton.addEventListener(
    "click",
    () => {

        if (!selectedUser) return;


        if (
            blockedUsers.has(
                selectedUser.id
            )
        ) {

            blockedUsers.delete(
                selectedUser.id
            );

            socket.emit(
                "unblock-user",
                selectedUser.id
            );

        } else {

            blockedUsers.add(
                selectedUser.id
            );

            socket.emit(
                "block-user",
                selectedUser.id
            );

            alert(
                `${selectedUser.name} has been blocked.`
            );
        }


        localStorage.setItem(
            "blockedUsers",
            JSON.stringify(
                [...blockedUsers]
            )
        );


        updateChatHeader();
    }
);


// ===============================
// LOGOUT
// ===============================

logoutButton.addEventListener(
    "click",
    () => {

        endCall(false);

        socket.emit("logout");

        currentUser = null;

        selectedUser = null;

        chatApp.classList.add("hidden");

        loginScreen.classList.remove(
            "hidden"
        );

        usernameInput.value = "";

        messages.innerHTML = "";
    }
);


// ===============================
// CALLS
// ===============================

async function startCall(type) {

    if (!selectedUser) {

        alert("Select a user first.");

        return;
    }


    if (!selectedUser.online) {

        alert("User is offline.");

        return;
    }


    currentCallUser =
        selectedUser.id;

    currentCallType =
        type;


    showCallScreen(
        selectedUser.name,
        type
    );


    try {

        localStream =
            await navigator.mediaDevices
                .getUserMedia({

                    audio: true,

                    video:
                        type === "video"
                });


        localVideo.srcObject =
            localStream;


        if (type === "voice") {

            localVideo.style.display =
                "none";

        } else {

            localVideo.style.display =
                "block";
        }


        createPeerConnection();


        localStream
            .getTracks()
            .forEach(track => {

                peerConnection.addTrack(
                    track,
                    localStream
                );
            });


        const offer =
            await peerConnection
                .createOffer();


        await peerConnection
            .setLocalDescription(offer);


        socket.emit("call-user", {

            to:
                currentCallUser,

            type,

            offer
        });


        callStatus.textContent =
            "Calling...";

    } catch (error) {

        alert(
            "Camera/microphone permission is required."
        );

        endCall(false);
    }
}


voiceCallButton.addEventListener(
    "click",
    () => startCall("voice")
);


videoCallButton.addEventListener(
    "click",
    () => startCall("video")
);


// ===============================
// PEER CONNECTION
// ===============================

function createPeerConnection() {

    peerConnection =
        new RTCPeerConnection(
            iceServers
        );


    peerConnection.onicecandidate =
        event => {

            if (
                event.candidate &&
                currentCallUser
            ) {

                socket.emit(
                    "ice-candidate",
                    {
                        to:
                            currentCallUser,

                        candidate:
                            event.candidate
                    }
                );
            }
        };


    peerConnection.ontrack =
        event => {

            remoteVideo.srcObject =
                event.streams[0];
        };


    peerConnection.onconnectionstatechange =
        () => {

            if (
                peerConnection.connectionState ===
                "connected"
            ) {

                callStatus.textContent =
                    "Connected";

            }

            if (
                peerConnection.connectionState ===
                "failed"
            ) {

                endCall(false);
            }
        };
}


// ===============================
// INCOMING CALL
// ===============================

socket.on(
    "incoming-call",
    data => {

        pendingOffer = data;

        currentCallUser =
            data.from;

        currentCallType =
            data.type;


        incomingName.textContent =
            data.name;

        incomingType.textContent =
            data.type === "video"
                ? "Incoming video call"
                : "Incoming voice call";


        setAvatar(
            incomingAvatar,
            data.name,
            null
        );


        incomingCall.classList.remove(
            "hidden"
        );
    }
);


// ===============================
// ACCEPT CALL
// ===============================

acceptCallButton.addEventListener(
    "click",
    async () => {

        if (!pendingOffer) return;


        incomingCall.classList.add(
            "hidden"
        );


        showCallScreen(
            pendingOffer.name,
            pendingOffer.type
        );


        try {

            localStream =
                await navigator.mediaDevices
                    .getUserMedia({

                        audio: true,

                        video:
                            pendingOffer.type ===
                            "video"
                    });


            localVideo.srcObject =
                localStream;


            localVideo.style.display =
                pendingOffer.type === "video"
                    ? "block"
                    : "none";


            createPeerConnection();


            localStream
                .getTracks()
                .forEach(track => {

                    peerConnection.addTrack(
                        track,
                        localStream
                    );
                });


            await peerConnection
                .setRemoteDescription(
                    new RTCSessionDescription(
                        pendingOffer.offer
                    )
                );


            const answer =
                await peerConnection
                    .createAnswer();


            await peerConnection
                .setLocalDescription(answer);


            socket.emit("answer-call", {

                to:
                    pendingOffer.from,

                answer
            });


            callStatus.textContent =
                "Connected";


            pendingOffer = null;

        } catch (error) {

            alert(
                "Could not access camera/microphone."
            );

            endCall(false);
        }
    }
);


// ===============================
// ANSWER RECEIVED
// ===============================

socket.on(
    "call-answered",
    async data => {

        if (!peerConnection) return;

        await peerConnection
            .setRemoteDescription(
                new RTCSessionDescription(
                    data.answer
                )
            );


        callStatus.textContent =
            "Connected";
    }
);


// ===============================
// ICE
// ===============================

socket.on(
    "ice-candidate",
    async data => {

        if (!peerConnection) return;


        try {

            await peerConnection
                .addIceCandidate(
                    new RTCIceCandidate(
                        data.candidate
                    )
                );

        } catch (error) {

            console.error(
                "ICE error:",
                error
            );
        }
    }
);


// ===============================
// REJECT
// ===============================

rejectCallButton.addEventListener(
    "click",
    () => {

        if (pendingOffer) {

            socket.emit(
                "reject-call",
                {
                    to:
                        pendingOffer.from
                }
            );
        }

        pendingOffer = null;

        incomingCall.classList.add(
            "hidden"
        );
    }
);


socket.on(
    "call-rejected",
    () => {

        alert(
            "Call rejected."
        );

        endCall(false);
    }
);


// ===============================
// END CALL
// ===============================

endCallButton.addEventListener(
    "click",
    () => endCall(true)
);


function endCall(notifyOtherUser = true) {

    if (
        notifyOtherUser &&
        currentCallUser
    ) {

        socket.emit(
            "end-call",
            {
                to:
                    currentCallUser
            }
        );
    }


    if (peerConnection) {

        peerConnection.close();

        peerConnection = null;
    }


    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track => track.stop()
            );

        localStream = null;
    }


    remoteVideo.srcObject = null;

    localVideo.srcObject = null;


    callScreen.classList.add(
        "hidden"
    );


    incomingCall.classList.add(
        "hidden"
    );


    currentCallUser = null;

    currentCallType = null;

    pendingOffer = null;
}


socket.on(
    "call-ended",
    () => {

        endCall(false);

    }
);


// ===============================
// MUTE
// ===============================

muteButton.addEventListener(
    "click",
    () => {

        if (!localStream) return;

        const audioTracks =
            localStream.getAudioTracks();

        if (!audioTracks.length) return;

        audioTracks.forEach(track => {

            track.enabled =
                !track.enabled;

            muteButton.textContent =
                track.enabled
                    ? "🎤"
                    : "🔇";
        });
    }
);


// ===============================
// CAMERA
// ===============================

cameraButton.addEventListener(
    "click",
    () => {

        if (!localStream) return;

        const videoTracks =
            localStream.getVideoTracks();

        if (!videoTracks.length) return;

        videoTracks.forEach(track => {

            track.enabled =
                !track.enabled;

            cameraButton.textContent =
                track.enabled
                    ? "📹"
                    : "🚫";
        });
    }
);


// ===============================
// CALL UI
// ===============================

function showCallScreen(
    name,
    type
) {

    callScreen.classList.remove(
        "hidden"
    );

    callName.textContent =
        name;

    callStatus.textContent =
        type === "video"
            ? "Starting video call..."
            : "Starting voice call...";

    setAvatar(
        callAvatar,
        name,
        null
    );
}


// ===============================
// BLOCK MESSAGE
// ===============================

socket.on(
    "message-blocked",
    data => {

        alert(
            data.message ||
            "Message blockedd."
        );
    }
);