const http = require("http");
const fs = require("fs");
const url = require("url");
const path = require("path");
const mongoose = require("mongoose");
const queryString = require("querystring");

mongoose
  .connect("mongodb://localhost:27017/petsy", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

const userSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  age: Number,
  pno: Number,
  pin: Number,
  city: String,
  email: String,
  password: String,
  adoptedPets: { type: String, ref: 'pet_data' }
}, { collection: 'user_data' });
const User = mongoose.model("user_data", userSchema);

const petSchema = new mongoose.Schema({
  petId: Number,
  petName: String,
  petBreed: String,
  type: String,
  appearance: String,
  gender: String,
  location: String,
  age: String,
  vaccinated: String,
  desexed: String,
  wormed: String,
  image_data: String,
  adoptedBy: { type: String, ref: 'user_data' }
}, { collection: 'pet_data' });
const Pet = mongoose.model("pet_data", petSchema);

const rescueSchema = new mongoose.Schema({
  petType: String,
  conditionR: String,
  locationR: String,
  pinR: Number,
  phoneR: Number
}, { collection: 'rescue_data' });
const Rescue = mongoose.model("rescue_data", rescueSchema);

const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { pathname } = url.parse(req.url, true);

  switch (pathname) {
    case "/":
      if (req.method === "GET") {
        serveFormPage(res, "wtp.html");
      } else if (req.method === "POST") {
        collectRequestData(req, (data) => {
          if (!data.fname || !data.lname || !data.email || !data.password) {
            res.writeHead(400);
            res.end("Missing required fields");
            return;
          }
          const emailRegex = /^\S+@\S+\.\S+$/;
          if (!emailRegex.test(data.email)) {
            res.writeHead(400);
            res.end("Invalid email format");
            return;
          }
          if (data.password.length < 6) {
            res.writeHead(400);
            res.end("Password must be at least 6 characters long");
            return;
          }

          User.create(data)
            .then(() => {
              res.writeHead(302, { Location: "/" });
              res.end();
            })
            .catch((err) => {
              console.error("Error creating user:", err);
              res.writeHead(500);
              res.end("Error creating user");
            });
        });
      }
      break;

    case "/adopt":
      if (req.method === "POST") {
        collectRequestData(req, (data) => {
          const { email, password, petId } = data;
          if (!email || !password || !petId) {
            res.writeHead(400);
            res.end("Missing required fields");
            return;
          }

          const emailRegex = /^\S+@\S+\.\S+$/;
          if (!emailRegex.test(email)) {
            res.writeHead(400);
            res.end("Invalid email format");
            return;
          }

          if (password.length < 6) {
            res.writeHead(400);
            res.end("Password must be at least 6 characters long");
            return;
          }

          User.findOne({ email: email, password: password })
            .then((user) => {
              if (!user) {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end("<script>alert('Invalid email or password'); window.location='/adopt';</script>");
              } else {
                Pet.findByIdAndUpdate(petId, { adoptedBy: user.email }, { new: true })
                  .then((pet) => {
                    User.findByIdAndUpdate(user._id, { $push: { adoptedPets: pet.petId }}, { new: true })
                      .then(() => {
                        res.writeHead(302, { "Content-Type": "text/html" });
                        res.end("<script>alert('Pet adopted successfully'); window.location='/adopt';</script>");
                      })
                      .catch((err) => {
                        console.error("Error updating user with adopted pet:", err);
                        res.writeHead(500);
                        res.end("Error updating user with adopted pet");
                      });
                  })
                  .catch((err) => {
                    console.error("Error updating pet with adopter:", err);
                    res.writeHead(500);
                    res.end("Error updating pet with adopter");
                  });
              }
            })
            .catch((err) => {
              console.error("Error finding user:", err);
              res.writeHead(500);
              res.end("Error finding user");
            });
        });
      }
      break;

    case "/rescue":
      if (req.method === "POST") {
        collectRequestData(req, (data) => {
          if (!data.petType || !data.conditionR || !data.locationR || !data.pinR || !data.phoneR) {
            res.writeHead(400);
            res.end("Missing required fields");
            return;
          }
          const phoneRegex = /^\d{10}$/;
          if (!phoneRegex.test(data.phoneR)) {
            res.writeHead(400);
            res.end("Invalid phone number format");
            return;
          }

          Rescue.create(data)
            .then(() => {
              res.writeHead(302, { Location: "/" });
              res.end();
            })
            .catch((err) => {
              console.error("Error creating rescue request:", err);
              res.writeHead(500);
              res.end("Error creating rescue request");
            });
        });
      } else {
        serveFormPage(res, "rescue.html");
      }
      break;

    default:
      serveStaticFile(req, res);
      break;
  }
});

function serveStaticFile(req, res) {
  const filePath = path.join(__dirname, req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`Error reading ${filePath}:`, err);
      res.writeHead(404);
      res.end("File Not Found");
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    const contentType = {
      ".jpg": "image/jpeg",
      ".png": "image/png",
      ".css": "text/css",
      ".js": "text/javascript"
    }[extension] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function serveFormPage(res, pageName) {
  const filePath = path.join(__dirname, pageName);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`Error reading ${filePath}:`, err);
      res.writeHead(500);
      res.end("Server Error: Unable to read form page.");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
}

function collectRequestData(request, callback) {
  let data = "";
  request.on("data", (chunk) => {
    data += chunk;
  });
  request.on("end", () => {
    if (request.headers['content-type'] === 'application/json') {
      data = JSON.parse(data);
    } else {
      data = queryString.parse(data);
    }
    callback(data);
  });
}

server.listen(9200, () => {
  console.log("Server running on http://localhost:9200");
});
