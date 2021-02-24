const net = require("net");
const conn = net.connect(10000, "127.0.0.1");

conn.on("error", (err) => {
  console.log(err);
});

conn.on("connect", () => {
  conn.write("Hello Socket!");
  conn.end();
});
