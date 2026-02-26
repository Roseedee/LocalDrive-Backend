const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const routes = require("./routes/routes");
const loggerMiddleware = require("./middlewares/logger.middleware");

const app = express();

app.use(cors({
  origin: 'http://localhost:8080',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(cookieParser());

app.use(loggerMiddleware);
app.use("/api", routes);

module.exports = app;