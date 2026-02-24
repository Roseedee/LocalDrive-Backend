const express = require("express");
const cookieParser = require("cookie-parser");

const routes = require("./routes/routes");
const loggerMiddleware = require("./middlewares/logger.middleware");

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(loggerMiddleware);
app.use("/api", routes);

module.exports = app;