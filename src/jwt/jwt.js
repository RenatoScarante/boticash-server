const jwt = require("jsonwebtoken");
const fs = require("fs");

const userdb = JSON.parse(fs.readFileSync("src/db/user.json", "UTF-8"));

const secreteKey = process.env.JWT_SECRET_KEY;
const expiresIn = process.env.JWT_EXPIRE_IN;

// Create a token from a payload
function createToken(payload) {
  return jwt.sign(payload, secreteKey, { expiresIn });
}

// Verify the token
function verifyToken(token) {
  return jwt.verify(token, secreteKey, (err, decode) => {
    if (decode !== undefined) return decode;

    throw err;
  });
}

// Check if the user exists in database
function isAuthenticated({ email, password }) {
  let user;
  const index = userdb.findIndex(
    user => user.email === email && user.password === password
  );

  if (index !== -1) {
    user = { ...userdb[index], password: null };
  }

  return user;
}

module.exports = {
  createToken: createToken,
  verifyToken: verifyToken,
  isAuthenticated: isAuthenticated
};
