const express = require("express");
const routes = require("./routes/routes");
const loggerMiddleware = require("./middlewares/logger.middleware");

const app = express();

app.use(express.json());
app.use(loggerMiddleware);
app.use("/api", routes);

module.exports = app;