const express = require("express");
const bodyparser = require("body-parser");
const validator = require("validator");

const app = express();

require("dotenv").config();

const port = process.env.PORT || 4000;

app.use(bodyparser.urlencoded({ extended: true }));
app.use(bodyparser.json());

app.get("/", (req, res, next) => {
  res.send("Hello");
});

app.post("/", (req, res, next) => {
  try {
    let content = req.body;
    let transaction_obj = content;
    let response_obj = {
      ID: transaction_obj.ID,
      SplitBreakdown: [],
    };
    let ratio_sum = 0,
      total_sum = 0;
    if (transaction_obj.SplitInfo.length > 20) {
      console.error("Split entities more than 20");
      throw new Error("Split entities more than 20");
    }

    let total_ratio = 0;
    let ratio_count = 0;
    transaction_obj.SplitInfo.forEach((item) => {
      if (item.SplitType == "RATIO") {
        total_ratio += item.SplitValue;
        ratio_count++;
      }
    });

    transaction_obj.SplitInfo.sort((a, b) => {
      if (a.SplitType == "FLAT") {
        return -3;
      }
      if (a.SplitType == "PERCENTAGE" && b.SplitType != "FLAT") {
        return -1;
      }
    });

    let initial_amount = transaction_obj.Amount;
    let c_balance = transaction_obj.Amount;

    for (let i = 0; i < transaction_obj.SplitInfo.length; i++) {
      let item = transaction_obj.SplitInfo[i];
      let return_obj;
      if (item.SplitType != "RATIO") {
        return_obj = calc_payment(
          c_balance,
          item.SplitType,
          item.SplitValue,
          item.SplitEntityId
        );

        if (return_obj.sent > initial_amount) {
          console.error(
            "Error processing transaction, reason: Insufficient Balance"
          );
          throw new Error(
            "Error processing transaction, reason: Insufficient Balance"
          );
        }
        if (return_obj.sent < 0) {
          console.error(
            "Error processing transaction, reason: Invalid split values"
          );
          throw new Error(
            "Error processing transaction, reason: Invalid split values"
          );
        }

        c_balance = return_obj.balance;
        total_sum += return_obj.sent;
        response_obj.SplitBreakdown.push({
          SplitEntityId: return_obj.id,
          Amount: return_obj.sent,
        });
      } else {
        let val = ratio_count < 2 ? 1 : item.SplitValue;
        total_ratio = ratio_count < 2 ? item.SplitValue : total_ratio;
        return_obj = calc_payment(
          c_balance,
          item.SplitType,
          val,
          item.SplitEntityId,
          total_ratio
        );

        if (return_obj.sent > initial_amount) {
          console.error(
            "Error processing transaction, reason: Insufficient Balance"
          );
          throw new Error(
            "Error processing transaction, reason: Insufficient Balance"
          );
        }
        if (return_obj.sent < 0) {
          console.error(
            "Error processing transaction, reason: Invalid split values"
          );
          throw new Error(
            "Error processing transaction, reason: Invalid split values"
          );
        }

        total_sum += return_obj.sent;
        ratio_sum += return_obj.sent;
        response_obj.SplitBreakdown.push({
          SplitEntityId: return_obj.id,
          Amount: return_obj.sent,
        });
      }
    }
    if (total_sum > initial_amount) {
      console.error(
        "Error processing transaction, reason: Insufficient Balance"
      );
      throw new Error(
        "Error processing transaction, reason: Insufficient Balance"
      );
    }
    if (c_balance < 0) {
      console.error(
        "Error processing transaction, reason: Insufficient Balance"
      );
      throw new Error(
        "Error processing transaction, reason: Insufficient Balance"
      );
    }
    response_obj.Balance = ratio_sum > 0 ? c_balance - ratio_sum : c_balance;
    console.log(response_obj);
    res.status(200).send(response_obj);
    function calc_payment(bal, type, value, id, total_ratio = 1) {
      let sent = 0;
      if (type == "FLAT") {
        sent = value;
        bal -= sent;
        return { balance: bal, sent, id };
      } else if (type == "PERCENTAGE") {
        sent = (value / 100) * bal;
        bal -= sent;
        return { balance: bal, sent, id };
      } else if (type == "RATIO") {
        sent = (value / total_ratio) * bal;
        bal -= sent;
        return { balance: bal, sent, id };
      }
    }
  } catch (e) {
    next(e.message, "Problem");
    e.type = "redirect"; // adding custom property to specify handling behaviour
    next(e);
  }
});

app.use((error, req, res, next) => {
  console.log("Error Handling Middleware called");
  res.status(401).send(error);
});

app.listen(port, (req, res) => {
  console.log("App is listening");
});
