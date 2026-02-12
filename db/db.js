const mysql = require("mysql2");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "r2pp",
  waitForConnections: true
});

module.exports = pool.promise();
