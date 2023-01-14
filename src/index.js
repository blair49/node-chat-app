const path = require("path");
const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const Filter = require("bad-words");
const { generateMessage, generateLocationMessage } = require("./utils/message");
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("./utils/user");

const port = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = socketio(server);

const publicDirPath = path.join(__dirname, "../public");
app.use(express.static(publicDirPath));

io.on("connection", (socket) => {
  console.log("New websocket connection");
  socket.on("join", ({ username, room }, callback) => {
    const res = addUser({ id: socket.id, username, room });

    if (res.error) {
      return callback(res.error);
    }
    socket.join(res.user.room);
    socket.emit("message", generateMessage("System", "Welcome!"));
    socket.broadcast
      .to(res.user.room)
      .emit(
        "message",
        generateMessage("System", `${res.user.username} has joined the chat`)
      );

    io.to(res.user.room).emit("roomData", {
      room: res.user.room,
      users: getUsersInRoom(res.user.room),
    });
    callback();
  });

  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);
    if (user) {
      const filter = new Filter();
      io.to(user.room).emit(
        "message",
        generateMessage(user.username, filter.clean(message))
      );
      callback();
    }
  });

  socket.on("sendLocation", (location, callback) => {
    const user = getUser(socket.id);
    if (user) {
      io.to(user.room).emit(
        "locationMessage",
        generateLocationMessage(
          user.username,
          `https://google.com/maps?q=${location.lat},${location.long}`
        )
      );
      callback();
    }
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);
    if (user) {
      io.to(user.room).emit(
        "message",
        generateMessage("System", `${user.username} has left the chat`)
      );
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(port, () => console.log(`Server running on port ${port}`));
