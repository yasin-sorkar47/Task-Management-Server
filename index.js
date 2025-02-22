require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://taskmanagement-ed7d8.web.app",
      "https://taskmanagement-ed7d8.firebaseapp.com",
    ],
  })
);
app.use(express.json());
app.use(morgan("dev"));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ze0za.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// HTTP Server & Socket.io Setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

async function run() {
  try {
    // await client.connect();
    const db = client.db("taskManagement");
    const taskCollection = db.collection("tasks");

    // WebSocket Connection
    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

      //  new task is added
      socket.on("newTask", async (task) => {
        const result = await taskCollection.insertOne(task);
        io.emit("taskAdded", { ...task, _id: result.insertedId });
      });

      // task is updated
      socket.on("updateTask", async ({ id, updatedData }) => {
        const filter = { _id: new ObjectId(id) };
        await taskCollection.updateOne(filter, { $set: updatedData });
        io.emit("taskUpdated", { id, updatedData });
      });

      // task is deleted
      socket.on("deleteTask", async (id) => {
        const filter = { _id: new ObjectId(id) };
        await taskCollection.deleteOne(filter);
        io.emit("taskDeleted", id);
      });

      socket.on("disconnect", () => {
        console.log("A user disconnected:", socket.id);
      });
    });

    // REST APIs for Fallback
    app.get("/tasks", async (req, res) => {
      const tasks = await taskCollection.find().toArray();
      res.send(tasks);
    });

    app.post("/task", async (req, res) => {
      const task = req.body;
      const result = await taskCollection.insertOne(task);
      io.emit("taskAdded", { ...task, _id: result.insertedId });
      res.send(result);
    });

    app.patch("/task/:id", async (req, res) => {
      const id = req.params.id;
      const updatedTask = req.body;
      const filter = { _id: new ObjectId(id) };
      await taskCollection.updateOne(filter, { $set: updatedTask });
      io.emit("taskUpdated", { id, updatedTask });
      res.send({ message: "Task updated" });
    });

    app.delete("/task/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      await taskCollection.deleteOne(filter);
      io.emit("taskDeleted", id);
      res.send({ message: "Task deleted" });
    });

    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error(error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Task management is running...");
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
