const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("config");
const { check, validationResult } = require("express-validator");

const User = require("../../models/User");

// @route    GET api/users
// @desc     Get all users
// @access   Public
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route    GET api/users/:id
// @desc     Get user by id
// @access   Public
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route    POST api/users
// @desc     Register user
// @access   Public
router.post(
  "/",
  [
    check("name", "Name is required")
      .not()
      .isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
      let user = await User.findOne({ email });

      if (user) {
        return res
          .status(400)
          .json({ errors: [{ msg: "User already exists" }] });
      }

      user = new User({
        name,
        email,
        password
      });

      const salt = await bcrypt.genSalt(10);

      user.password = await bcrypt.hash(password, salt);

      await user.save();

      const payload = {
        user: {
          id: user.id
        }
      };

      jwt.sign(
        payload,
        process.env.JWT_SECRET || config.get("jwtSecret"),
        { expiresIn: 360000 },
        (err, token) => {
          if (err) throw err;
          res.json({ token });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// @route    EDIT api/users/:id
// @desc     Edit a user
// @access   Public
router.patch("/:id", async (req, res) => {
  const { name, email, isAdmin } = req.body;

  // Build user object
  const userFields = {};

  if (name) userFields.name = name;
  if (email) userFields.email = email;
  if (isAdmin) userFields.isAdmin = isAdmin;

  try {
    let user = await User.findOneAndUpdate({ _id: req.params.id }, userFields, {
      new: true,
      upsert: true
    });
    // Check for ObjectId format and order
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/) || !user) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.status(200).json(user);
  } catch (err) {
    console.error(err.message);

    res.status(500).send("Server Error");
  }
});

module.exports = router;
