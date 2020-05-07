require("dotenv").config();

const jsonServer = require("json-server");
const bodyParser = require("body-parser");

const { createToken, verifyToken, isAuthenticated } = require("./jwt/jwt");

const server = jsonServer.create();
const router = jsonServer.router(require("./db/db.js")());

server.use(jsonServer.defaults());
server.use(bodyParser.urlencoded({ extended: true }));
server.use(bodyParser.json());

function round(value, decimals) {
  return Number(Math.round(value + "e" + decimals) + "e-" + decimals);
}

// POST /api/auth/login
server.post(process.env.ROUTE_AUTHENTICATION, (req, res) => {
  const { email, password } = req.body;
  const user = isAuthenticated({ email, password });

  if (user === undefined) {
    const status = 401;
    const message = "Incorrect email or password";
    res.status(status).json({ status, message });
    return;
  }
  const token = createToken({ email, password });
  res.status(200).json({ user, token });
});

// POST /api/user
server.post(process.env.ROUTE_USER_POST, (req, res) => {
  var newUser = ({ name, email, cpf, password } = req.body);
  var db = router.db;

  var user = db
    .get("user")
    .find({ name: name } || { email: email } || { cpf: cpf })
    .value();

  if (user !== undefined) {
    const status = 401;
    const message = "User exists";
    res.status(status).json({ status, message });
    return;
  }

  newUser = db
    .get("user")
    .insert(newUser)
    .value();

  newUser = { ...newUser, password: null };

  db.get("cashback")
    .insert({
      userId: newUser.id,
      accumulated_value: 0,
      last_date: ""
    })
    .value();

  const token = createToken({ email, password });

  res.status(200).json({ user: newUser, token });
});

function upsertCashback(newPurchase) {
  var db = router.db;

  var purchaseList = db
    .get("purchase")
    .filter({ userId: newPurchase.userId })
    .value();

  var totalCashback = purchaseList.reduce((acumulador, valorAtual) => {
    return acumulador + valorAtual.cashbackValue;
  }, 0);

  var cashback = db
    .get("cashback")
    .find({ userId: newPurchase.userId })
    .value();

  if (cashback) {
    cashback = db
      .get("cashback")
      .find({ id: cashback.id })
      .assign({
        userId: newPurchase.userId,
        accumulated_value: totalCashback,
        last_date: newPurchase.date
      })
      .write();
  } else {
    cashback = db
      .get("cashback")
      .insert({
        userId: newPurchase.userId,
        accumulated_value: totalCashback,
        last_date: newPurchase.date
      })
      .value();
  }

  return cashback;
}

// POST /api/purchase
server.post(process.env.ROUTE_PURCHASE_POST, (req, res) => {
  var newPurchase = req.body;

  var db = router.db;

  var cashback_rule = db
    .get("cashback_rule")
    .find(
      rule =>
        rule.start_value <= newPurchase.value &&
        rule.end_value >= newPurchase.value
    )
    .value();

  if (cashback_rule) {
    newPurchase = {
      ...newPurchase,
      cashbackPercent: cashback_rule.percent,
      cashbackValue: round(newPurchase.value * (cashback_rule.percent / 100), 2)
    };
  } else {
    newPurchase = {
      ...newPurchase,
      cashbackPercent: 0,
      cashbackValue: 0
    };
  }

  newPurchase = db
    .get("purchase")
    .insert(newPurchase)
    .value();

  upsertCashback(newPurchase);

  res.status(200).json(newPurchase);
});

// PUT /api/purchase
server.put(process.env.ROUTE_PURCHASE_PUT, (req, res) => {
  var newPurchase = req.body;

  var db = router.db;

  var cashback_rule = db
    .get("cashback_rule")
    .find(
      rule =>
        rule.start_value <= newPurchase.value &&
        rule.end_value >= newPurchase.value
    )
    .value();

  if (cashback_rule) {
    newPurchase = {
      ...newPurchase,
      cashbackPercent: cashback_rule.percent,
      cashbackValue: round(newPurchase.value * (cashback_rule.percent / 100), 2)
    };
  } else {
    newPurchase = {
      ...newPurchase,
      cashbackPercent: 0,
      cashbackValue: 0
    };
  }

  newPurchase = db
    .get("purchase")
    .find({ id: newPurchase.id })
    .assign({
      code: newPurchase.code,
      value: newPurchase.value,
      date: newPurchase.date,
      purchase_statusId: newPurchase.purchase_statusId,
      cashbackPercent: newPurchase.cashbackPercent,
      cashbackValue: newPurchase.cashbackValue
    })
    .write();

  upsertCashback(newPurchase);

  res.status(200).json(newPurchase);
});

// DELETE /api/purchase
server.delete(process.env.ROUTE_PURCHASE_DELETE, (req, res) => {
  var { id } = req.query;

  var db = router.db;

  var purchase = db
    .get("purchase")
    .find({ id: id })
    .value();

  if (purchase) {
    db.get("purchase")
      .remove({ id: id })
      .write();

    upsertCashback(newPurchase);
  }

  res.status(200).json(newPurchase);
});

server.use(/^(?!\/auth).*$/, (req, res, next) => {
  if (
    req.headers.authorization === undefined ||
    req.headers.authorization.split(" ")[0] !== "Bearer"
  ) {
    const status = 401;
    const message = "Bad authorization header";
    res.status(status).json({ status, message });
    return;
  }
  try {
    const token = req.headers.authorization.split(" ")[1];
    verifyToken(token);
    next();
  } catch (err) {
    const status = 401;
    const message = "Error: access_token is not valid";
    res.status(status).json({ status, message });
  }
});

server.use("/api", router);

const port = process.env.PORT ? process.env.PORT : 5000;

server.listen(port, () => {
  console.log(`Boticash Server is running on port ${port}`);
});
