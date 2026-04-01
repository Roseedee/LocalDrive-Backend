const app = require("./app");

const port = process.env.SERVER_PORT || 3000;
const nodeEnv = process.env.NODE_ENV || 'development';

app.listen(port, () => {
  console.log(`Server running on port ${port} in ${nodeEnv} mode`);
});