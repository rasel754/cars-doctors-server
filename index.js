const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const { lookup } = require('mime');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

//middleware

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);

app.use(express.json());

app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2zt49zv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middlewares
const logger = async (req, res, next) => {
  console.log("calling middleware"+ req.host, req.originalUrl);
  next();
};


const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log("verifying token", token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error
    if (err) {
      console.log("error: ", err);
      return res.status(401).send({ message: "unauthorized" });
    }
    // if token is valid then it will be decoded
    console.log("value in the token: ", decoded);
    req.user = decoded;
    next();
  });

  next();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db("carDoctor").collection("services");
    const bookingsCollection = client.db("carDoctor").collection("bookings");

    // auth related api
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });

    // services api
    app.get("/services", logger, async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const options = {
        // Include only the `title` and `imdb` fields in each returned document
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };

      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    //  load specified some data from the booking collection
    app.get("/bookings", logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      // console.log('tok tok token' +req.cookies.token);
      console.log('user in valid token' +req.user);

      if(req.query.email !== req.user.email) {
        return res.status(403).send({message: 'forbidden access'});
      }

      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // bookings
    app.post("/bookings", async (req, res) => {
      const bookings = req.body;
      const result = await bookingsCollection.insertOne(bookings);
      res.send(result);
    });

    //  update bookings
    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateBookings = req.body;
      console.log(updateBookings);
      const updateDoc = {
        $set: {
          status: updateBookings.status,
        },
      };
      const result = await bookingsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // delete booking
    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("car doctor is running");
});

app.listen(port, () => {
  console.log(`car doctor server is running on port ${port}`);
});
